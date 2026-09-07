/**
 * SYRAVEN — Usage metering and rate limiting
 * lib/usage/meter.ts
 *
 * Phase 5 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Counts what a caller has actually consumed, and refuses work once a
 * ceiling is reached.
 *
 * WHY POSTGRES AND NOT AN IN-MEMORY COUNTER
 *
 * An in-memory counter is per-process. Next.js route handlers run across
 * multiple lambdas/instances, so a per-process limit is trivially
 * defeated by concurrency and lost on every restart — it is not a
 * security control. `public.usage` and `public.rate_limit_events` are
 * durable and shared, and `rate_limit_events` already carries the exact
 * index this needs:
 *
 *     rate_limit_events_lookup_idx (user_id, endpoint, created_at desc)
 *
 * No Redis is introduced: the existing Postgres infrastructure already
 * supports the access pattern, so an extra dependency would not be
 * justified.
 *
 * WHAT IS NEVER TRUSTED
 *
 *   - the caller's plan            -> read from public.profiles
 *   - the caller's user id         -> the verified session only
 *   - reported token counts        -> taken from the PROVIDER response
 *   - the caller's usage total     -> counted in the database
 *
 * A client can influence none of these.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { Database } from "@/types/database";
import type { PlanLimits } from "@/lib/plans";
import {
  type Entitlement,
  limitFor,
  UNLIMITED,
  withinLimit,
} from "./entitlements";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

/**
 * A metered operation.
 *
 * `metric` names the PlanLimits key this operation consumes, and
 * `window` says over what period the ceiling applies.
 */
export interface UsageMetric {
  /** Stored in public.usage.type. Stable, greppable. */
  readonly event: string;

  readonly metric: keyof PlanLimits;

  readonly window: "day" | "month";
}

/**
 * The metered operations this application enforces.
 *
 * Declared centrally so an endpoint cannot invent its own weaker metric,
 * and so "which routes are metered" is answerable by reading one list.
 */
export const USAGE_METRICS = {
  chatMessage: {
    event: "chat_message",
    metric: "messagesPerDay",
    window: "day",
  },
  chatMessageMonthly: {
    event: "chat_message",
    metric: "messagesPerMonth",
    window: "month",
  },
  agentRun: {
    event: "agent_run",
    metric: "agentRunsPerMonth",
    window: "month",
  },
  visionRequest: {
    event: "vision_request",
    metric: "visionRequestsPerMonth",
    window: "month",
  },
  voiceRequest: {
    event: "voice_request",
    metric: "voiceMinutesPerMonth",
    window: "month",
  },
  fileUpload: {
    event: "file_upload",
    metric: "fileUploadsPerDay",
    window: "day",
  },
} as const satisfies Record<string, UsageMetric>;

export type UsageMetricKey = keyof typeof USAGE_METRICS;

export type QuotaDecision =
  | {
      allowed: true;
      /** Remaining operations, or null when unlimited. */
      remaining: number | null;
      limit: number;
      used: number;
    }
  | {
      allowed: false;
      reason: "QUOTA_EXCEEDED" | "COUNT_FAILED";
      limit: number;
      used: number;
      /** ISO timestamp when the window resets, when known. */
      resetsAt: string | null;
    };

/* -------------------------------------------------------------------------- */
/*                              WINDOW BOUNDARIES                             */
/* -------------------------------------------------------------------------- */

/**
 * Start of the current window, in UTC.
 *
 * UTC is used deliberately: a local-timezone boundary would let a caller
 * straddling midnight get two allowances, and would make limits behave
 * differently per deployment region.
 */
export function windowStart(
  window: "day" | "month",
  now: Date = new Date(),
): Date {
  if (window === "day") {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
  }

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
}

/**
 * Start of the NEXT window — when the caller's allowance resets.
 */
export function windowReset(
  window: "day" | "month",
  now: Date = new Date(),
): Date {
  if (window === "day") {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      ),
    );
  }

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
}

/* -------------------------------------------------------------------------- */
/*                                COUNTING                                    */
/* -------------------------------------------------------------------------- */

/**
 * Counts a caller's events of one type in the current window.
 *
 * Uses a HEAD count so no row contents are transferred.
 */
export async function countUsage(
  db: SupabaseClient<Database>,
  userId: string,
  metric: UsageMetric,
  now: Date = new Date(),
): Promise<number | null> {
  const since = windowStart(metric.window, now).toISOString();

  const { count, error } = await db
    .from("usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", metric.event)
    .gte("created_at", since);

  if (error) {
    console.error("SYRAVEN METER: usage count failed.", {
      userId,
      event: metric.event,
      error: error.message,
    });

    return null;
  }

  return count ?? 0;
}

/* -------------------------------------------------------------------------- */
/*                              QUOTA DECISION                                */
/* -------------------------------------------------------------------------- */

/**
 * Decides whether one more operation is permitted.
 *
 * Fails CLOSED: if the count cannot be read, the operation is refused
 * rather than allowed. An attacker who can induce a database error must
 * not thereby gain unlimited access.
 */
export async function checkQuota(
  db: SupabaseClient<Database>,
  userId: string,
  entitlement: Entitlement,
  metricKey: UsageMetricKey,
  now: Date = new Date(),
): Promise<QuotaDecision> {
  const metric: UsageMetric = USAGE_METRICS[metricKey];

  const limit = limitFor(entitlement, metric.metric);

  if (limit === UNLIMITED) {
    return { allowed: true, remaining: null, limit, used: 0 };
  }

  const used = await countUsage(db, userId, metric, now);

  if (used === null) {
    return {
      allowed: false,
      reason: "COUNT_FAILED",
      limit,
      used: 0,
      resetsAt: null,
    };
  }

  if (!withinLimit(entitlement, metric.metric, used)) {
    return {
      allowed: false,
      reason: "QUOTA_EXCEEDED",
      limit,
      used,
      resetsAt: windowReset(metric.window, now).toISOString(),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - used),
    limit,
    used,
  };
}

/* -------------------------------------------------------------------------- */
/*                              RECORDING                                     */
/* -------------------------------------------------------------------------- */

/**
 * Records one consumed operation.
 *
 * `tokens` and `model` come from the PROVIDER's response, never from the
 * request body, so a caller cannot under-report what it used.
 *
 * Recording is best-effort by design: a metering write must not fail a
 * request whose real work already succeeded. A failure is logged loudly
 * because sustained failures mean limits are silently not accumulating.
 */
/* -------------------------------------------------------------------------- */
/*                            TRUSTED USAGE WRITER                            */
/* -------------------------------------------------------------------------- */

/**
 * Minimal shape `recordUsage` needs from a writer.
 *
 * Narrower than `SupabaseClient` on purpose: it describes exactly one
 * operation — inserting a usage row — so nothing else in this module can
 * reach for another service-role capability through the same handle.
 */
export interface UsageWriter {
  from(table: "usage"): {
    insert(values: Record<string, unknown>): PromiseLike<{
      error: { message: string } | null;
    }>;
  };
}

let injectedUsageWriter: UsageWriter | null = null;

/**
 * Replaces the trusted writer. TESTS ONLY.
 *
 * `lib/supabaseAdmin` validates its environment on first use, so a test
 * that exercised `recordUsage` would otherwise need real service-role
 * credentials — or would silently pass because the write failed. This
 * seam lets a test assert what was written without either.
 *
 * Pass `null` to restore the real client.
 */
export function __setUsageWriterForTests(writer: UsageWriter | null): void {
  injectedUsageWriter = writer;
}

/**
 * The service-role client, resolved lazily.
 *
 * Imported through a dynamic-free indirection so that merely importing
 * this module does not construct an admin client or validate its
 * environment — `countUsage`, `checkQuota` and the rate limiter all live
 * here and none of them need service-role.
 */
function usageWriter(): UsageWriter {
  if (injectedUsageWriter !== null) return injectedUsageWriter;

  return supabaseAdmin as unknown as UsageWriter;
}

export async function recordUsage(
  db: SupabaseClient<Database>,
  userId: string,
  metricKey: UsageMetricKey,
  detail: {
    model?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    endpoint?: string | null;
  } = {},
): Promise<void> {
  const metric: UsageMetric = USAGE_METRICS[metricKey];

  /*
   * TRUSTED WRITE PATH.
   *
   * `db` — the caller's RLS-scoped client — is deliberately IGNORED for
   * this insert. `public.usage` is a metering ledger and must remain
   * client-write-protected: it has SELECT policies only, and no INSERT,
   * UPDATE or DELETE policy exists for `authenticated`.
   *
   * Granting the client an INSERT policy would be the easy fix and is
   * the wrong one. A caller able to write its own usage rows can forge
   * metering, and a ledger the metered party can write is not a ledger.
   * The service-role client is therefore the only writer.
   *
   * WHY THIS IS NOT AN AUTHORIZATION SHORTCUT
   *
   * `userId` is NOT taken from the request. It arrives from
   * `enforceUsage(session, ...)`, which reads it from
   * `session.userId` — the verified Supabase subject. No route accepts a
   * user id for usage attribution, so service-role here cannot be
   * steered at a different account.
   *
   * Reads remain RLS-scoped: `countUsage` still uses the caller's client
   * (see above), so service-role is never used to SERVE user data. It is
   * used only to write a row the user is not permitted to write
   * themselves.
   */
  const writer = usageWriter();

  const { error } = await writer.from("usage").insert({
    user_id: userId,
    type: metric.event,
    metadata: {
      model: detail.model ?? null,
      promptTokens: nonNegative(detail.promptTokens),
      completionTokens: nonNegative(detail.completionTokens),
      totalTokens: nonNegative(detail.totalTokens),
      endpoint: detail.endpoint ?? null,
      recordedAt: new Date().toISOString(),
    },
  });

  if (error) {
    console.error("SYRAVEN METER: usage record FAILED.", {
      userId,
      event: metric.event,
      error: error.message,
    });
  }
}

/**
 * Clamps a reported token count.
 *
 * Provider responses are generally trustworthy, but a negative or
 * non-finite value must never be stored: it would let a total be dragged
 * downwards and mask real consumption.
 */
function nonNegative(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value < 0 ? 0 : Math.floor(value);
}

/* -------------------------------------------------------------------------- */
/*                              RATE LIMITING                                 */
/* -------------------------------------------------------------------------- */

export interface RateLimitRule {
  /** Maximum requests permitted inside the window. */
  readonly max: number;
  /** Window length in seconds. */
  readonly windowSeconds: number;
}

/**
 * Per-endpoint burst limits.
 *
 * These are ABUSE controls, distinct from plan quotas: they bound how
 * fast a caller may act, not how much they may consume in a billing
 * period. Both apply — a caller within their monthly quota can still be
 * throttled for hammering an endpoint.
 */
export const RATE_LIMITS: Record<string, RateLimitRule> = {
  "ai:chat": { max: 20, windowSeconds: 60 },
  "ai:agent": { max: 10, windowSeconds: 60 },
  "ai:stream": { max: 20, windowSeconds: 60 },
  "ai:vision": { max: 10, windowSeconds: 60 },
  "ai:voice": { max: 10, windowSeconds: 60 },
  "ai:canvas": { max: 10, windowSeconds: 60 },
  "files:upload": { max: 20, windowSeconds: 60 },

  /*
   * Search (Phase 10.2).
   *
   * Rate limited but NOT quota metered: it calls no paid provider, so
   * charging it against a plan allowance would be wrong. The limit
   * exists because search is a cheap-to-issue, expensive-to-serve read
   * (unindexed ilike scans) and an obvious probing surface — an
   * attacker enumerating terms wants many small queries, which is
   * exactly what a per-minute ceiling stops.
   *
   * Higher than the AI endpoints because interactive
   * search-as-you-type is a legitimate pattern.
   */
  "search:query": { max: 60, windowSeconds: 60 },

  /*
   * Embedding ingestion (Phase 12 follow-up).
   *
   * Rate limited AND cost bounded. Unlike search, every call here
   * reaches a PAID provider, so the limit is a spend control rather
   * than a load control.
   *
   * Deliberately the strictest rule in this table. Ingestion is a
   * background/bulk operation, not an interactive one: nobody is
   * waiting on a keystroke, so a low ceiling costs no usability. Five
   * requests per minute against a batch limit of 10 chunks bounds a
   * runaway loop to 50 embeddings per minute per user.
   *
   * This key MUST exist: `checkRateLimit` refuses any endpoint it does
   * not recognise, so omitting it would deny all ingestion rather than
   * allow it — fail-closed, but for the wrong reason.
   *
   * See lib/search/ingestPolicy.ts for the batch and rolling-window
   * ceilings that sit alongside this burst limit.
   */
  "embedding:ingest": { max: 5, windowSeconds: 60 },
};

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | {
      allowed: false;
      reason: "RATE_LIMITED" | "COUNT_FAILED";
      retryAfterSeconds: number;
    };

/**
 * Sliding-window rate limit, counted in Postgres.
 *
 * Keyed on the VERIFIED session user id, never on an IP or a
 * client-supplied identifier: an IP is shared by many legitimate users
 * and trivially rotated by an attacker.
 *
 * Fails CLOSED on a count error, for the same reason as checkQuota.
 */
export async function checkRateLimit(
  db: SupabaseClient<Database>,
  userId: string,
  endpoint: string,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const rule = RATE_LIMITS[endpoint];

  if (!rule) {
    /*
     * An endpoint with no declared rule is not silently unlimited — the
     * caller passed a key this module does not know, which is a
     * programming error. Refuse rather than wave it through.
     */
    console.error("SYRAVEN RATE LIMIT: unknown endpoint key.", { endpoint });

    return {
      allowed: false,
      reason: "COUNT_FAILED",
      retryAfterSeconds: 60,
    };
  }

  const since = new Date(
    now.getTime() - rule.windowSeconds * 1000,
  ).toISOString();

  const { count, error } = await db
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("created_at", since);

  if (error) {
    console.error("SYRAVEN RATE LIMIT: count failed.", {
      userId,
      endpoint,
      error: error.message,
    });

    return {
      allowed: false,
      reason: "COUNT_FAILED",
      retryAfterSeconds: rule.windowSeconds,
    };
  }

  const used = count ?? 0;

  if (used >= rule.max) {
    return {
      allowed: false,
      reason: "RATE_LIMITED",
      retryAfterSeconds: rule.windowSeconds,
    };
  }

  return { allowed: true, remaining: rule.max - used - 1 };
}

/**
 * Records one request against the rate-limit window.
 *
 * Called BEFORE the expensive work, so a caller cannot escape accounting
 * by aborting mid-flight. This is the deliberate trade-off named in
 * IMPLEMENTATION_PLAN.md Phase 5: a request that later fails still
 * consumes burst allowance, which is the safe direction for an abuse
 * control.
 */
export async function recordRateLimitEvent(
  db: SupabaseClient<Database>,
  userId: string,
  endpoint: string,
): Promise<void> {
  const { error } = await db.from("rate_limit_events").insert({
    user_id: userId,
    endpoint,
  });

  if (error) {
    console.error("SYRAVEN RATE LIMIT: record FAILED.", {
      userId,
      endpoint,
      error: error.message,
    });
  }
}
