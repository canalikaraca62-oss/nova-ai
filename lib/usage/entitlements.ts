/**
 * SYRAVEN — Entitlement resolution
 * lib/usage/entitlements.ts
 *
 * Phase 5 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Resolves what a caller is ALLOWED to do, from the database, using only
 * a verified session id.
 *
 * ARCHITECTURE_AUDIT.md §17: lib/plans.ts defines every plan limit and is
 * imported only by the pricing page. Limits are advertised to users and
 * never enforced. This module is what makes them real.
 *
 * THE RULE
 *
 * A caller's plan is READ FROM public.profiles. It is never taken from a
 * request body, header, query parameter, or JWT claim. A client that
 * could assert its own plan could assert "enterprise" and lift every
 * limit at once.
 *
 * TRIAL HANDLING
 *
 * TRIAL_CONFIG grants 14 days of full access and explicitly does NOT
 * auto-convert to paid. An expired trial therefore falls back to the
 * free tier rather than continuing at trial limits — expiry is evaluated
 * against the database timestamp on every request, never cached in a
 * token the client holds.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import {
  DEFAULT_PLAN,
  type PlanId,
  type PlanLimits,
  TRIAL_CONFIG,
  TRIAL_EFFECTIVE_PLAN,
  getPlanLimit,
  isPlanId,
} from "@/lib/plans";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sentinel used by lib/plans.ts for "no limit".
 *
 * Mirrored here because the constant is not exported from that module.
 * A test asserts the two stay in agreement.
 */
export const UNLIMITED = -1;

export type TrialState =
  | "none"
  | "active"
  | "expired";

export interface Entitlement {
  /**
   * The plan whose limits apply RIGHT NOW.
   *
   * During an active trial this is the trial's effective plan, which may
   * exceed the plan recorded on the profile.
   */
  effectivePlan: PlanId;

  /**
   * The plan recorded on the profile, ignoring trial state.
   */
  billedPlan: PlanId;

  trial: TrialState;

  trialEndsAt: string | null;

  /**
   * Subscription status from the billing provider, as recorded on the
   * profile. Used to deny access when a subscription has lapsed.
   */
  subscriptionStatus: string;
}

export type EntitlementResult =
  | { ok: true; entitlement: Entitlement }
  | { ok: false; reason: "PROFILE_NOT_FOUND" | "LOOKUP_FAILED" };

/* -------------------------------------------------------------------------- */
/*                          SUBSCRIPTION STATUS                               */
/* -------------------------------------------------------------------------- */

/**
 * Statuses that permit paid-plan limits.
 *
 * Anything else (past_due, unpaid, canceled, incomplete…) falls back to
 * the free tier: a lapsed subscription must not keep paid entitlements.
 */
const ENTITLED_STATUSES = new Set([
  "active",
  "trialing",
]);

/* -------------------------------------------------------------------------- */
/*                            TRIAL EVALUATION                                */
/* -------------------------------------------------------------------------- */

/**
 * Determines trial state from stored timestamps.
 *
 * Evaluated per request against `now`, so a trial cannot be extended by a
 * stale client-side value.
 */
export function evaluateTrial(
  trialEndsAt: string | null,
  now: Date = new Date(),
): TrialState {
  if (!TRIAL_CONFIG.enabled) return "none";

  if (typeof trialEndsAt !== "string" || trialEndsAt.length === 0) {
    return "none";
  }

  const endsAt = Date.parse(trialEndsAt);

  if (!Number.isFinite(endsAt)) {
    /*
     * An unparseable timestamp is treated as no trial rather than an
     * active one: malformed data must not grant access.
     */
    return "none";
  }

  return now.getTime() < endsAt ? "active" : "expired";
}

/* -------------------------------------------------------------------------- */
/*                          ENTITLEMENT RESOLUTION                            */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the caller's entitlement from the database.
 *
 * @param db      A Supabase client. The caller's RLS-enforced client is
 *                sufficient: public.profiles has an owner-scoped select
 *                policy (auth.uid() = id).
 * @param userId  The VERIFIED session user id.
 */
export async function resolveEntitlement(
  db: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<EntitlementResult> {
  const { data, error } = await db
    .from("profiles")
    .select("plan, subscription_status, trial_ends_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("SYRAVEN ENTITLEMENT: profile lookup failed.", {
      userId,
      error: error.message,
    });

    /* Fail closed: a lookup error must never read as "unlimited". */
    return { ok: false, reason: "LOOKUP_FAILED" };
  }

  if (!data) {
    return { ok: false, reason: "PROFILE_NOT_FOUND" };
  }

  const record = data as {
    plan?: unknown;
    subscription_status?: unknown;
    trial_ends_at?: unknown;
  };

  /*
   * An unrecognised plan value degrades to the default rather than
   * being trusted. A row containing "enterprise-unlimited" (or anything
   * this code does not know) must not widen access.
   */
  const billedPlan: PlanId = isPlanId(record.plan)
    ? record.plan
    : DEFAULT_PLAN;

  const subscriptionStatus =
    typeof record.subscription_status === "string"
      ? record.subscription_status
      : "unknown";

  const trialEndsAt =
    typeof record.trial_ends_at === "string" ? record.trial_ends_at : null;

  const trial = evaluateTrial(trialEndsAt, now);

  const effectivePlan = resolveEffectivePlan({
    billedPlan,
    subscriptionStatus,
    trial,
  });

  return {
    ok: true,
    entitlement: {
      effectivePlan,
      billedPlan,
      trial,
      trialEndsAt,
      subscriptionStatus,
    },
  };
}

/**
 * Decides which plan's limits actually apply.
 *
 * Precedence, most to least specific:
 *
 *   1. An ACTIVE trial grants full access (TRIAL_CONFIG.fullAccess).
 *   2. A paid plan applies only while the subscription is in good
 *      standing.
 *   3. Everything else — expired trial, lapsed subscription, unknown
 *      state — falls back to the free tier.
 *
 * Note there is no path here that grants MORE than the profile says
 * except an active trial, which is bounded by a database timestamp.
 */
export function resolveEffectivePlan(input: {
  billedPlan: PlanId;
  subscriptionStatus: string;
  trial: TrialState;
}): PlanId {
  const { billedPlan, subscriptionStatus, trial } = input;

  if (trial === "active" && TRIAL_CONFIG.fullAccess) {
    return TRIAL_EFFECTIVE_PLAN;
  }

  if (billedPlan === DEFAULT_PLAN) {
    return DEFAULT_PLAN;
  }

  if (!ENTITLED_STATUSES.has(subscriptionStatus)) {
    /*
     * A paid plan recorded on the profile but not backed by an active
     * subscription (past_due, canceled, unpaid) does not entitle. This is
     * the safe direction: billing state is reconciled by the Stripe
     * webhook, and until it says active the caller gets free limits.
     */
    return DEFAULT_PLAN;
  }

  return billedPlan;
}

/* -------------------------------------------------------------------------- */
/*                              LIMIT LOOKUP                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns the numeric limit for a metric under an entitlement.
 *
 * `UNLIMITED` (-1) means no ceiling.
 */
export function limitFor(
  entitlement: Entitlement,
  metric: keyof PlanLimits,
): number {
  return getPlanLimit(entitlement.effectivePlan, metric);
}

/* -------------------------------------------------------------------------- */
/*                            TOKEN CEILINGS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Maximum `max_tokens` a caller may request for a single completion,
 * by effective plan.
 *
 * IMPLEMENTATION_PLAN.md Phase 5 calls this out specifically:
 *
 *   "Caller-controlled maxTokens (up to 32,768) must be clamped by plan
 *    entitlement, not merely by the current hard cap."
 *
 * Before Phase 5 a free-tier caller could request 16,000 tokens on
 * /api/chat and 32,768 on /api/agents/execute — the per-request cost was
 * bounded only by a constant, identically for every plan.
 *
 * These are per-REQUEST ceilings. Aggregate consumption is bounded
 * separately by the message quotas in PlanLimits.
 */
const PLAN_MAX_TOKENS: Record<PlanId, number> = {
  free: 2_000,
  starter: 4_000,
  pro: 8_000,
  business: 16_000,
  enterprise: 32_000,
};

/**
 * Clamps a requested token count to what the plan permits.
 *
 * A non-numeric, non-finite, or non-positive request falls back to the
 * plan ceiling rather than to an unbounded default.
 */
export function clampMaxTokens(
  entitlement: Entitlement,
  requested: unknown,
): number {
  const ceiling = PLAN_MAX_TOKENS[entitlement.effectivePlan];

  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return ceiling;
  }

  const floored = Math.floor(requested);

  if (floored < 1) return ceiling;

  return Math.min(floored, ceiling);
}

/**
 * True when `used` is strictly below the metric's ceiling.
 *
 * Boundary semantics are deliberate: a limit of N permits N successful
 * operations, so the check that guards operation number N+1 must fail
 * when `used === N`.
 */
export function withinLimit(
  entitlement: Entitlement,
  metric: keyof PlanLimits,
  used: number,
): boolean {
  const maximum = limitFor(entitlement, metric);

  if (maximum === UNLIMITED) return true;

  /* A non-positive limit denies outright. */
  if (maximum <= 0) return false;

  return used < maximum;
}
