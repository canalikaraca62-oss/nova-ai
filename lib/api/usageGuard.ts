/**
 * SYRAVEN — Usage enforcement guard for API routes
 * lib/api/usageGuard.ts
 *
 * Phase 5 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * One call that a route makes BEFORE doing expensive work:
 *
 *   1. resolve the caller's entitlement from the database
 *   2. apply the per-endpoint burst rate limit
 *   3. apply the plan quota for the metric being consumed
 *   4. record the rate-limit event so aborting mid-flight cannot evade it
 *
 * Usage:
 *
 *   const guard = await enforceUsage(session, "ai:chat", "chatMessage");
 *   if (guard.denied) return guard.response;
 *
 *   // … do the expensive work …
 *
 *   await guard.record({ model, totalTokens: usage.total_tokens });
 *
 * WHY ONE HELPER RATHER THAN PER-ROUTE CHECKS
 *
 * ARCHITECTURE_AUDIT.md §8.2 exists because each route decided its own
 * controls. A single boundary means a new endpoint is metered by adding
 * one line, and "which routes enforce limits" is answerable by grepping
 * for this function.
 */

import "server-only";

import { NextResponse } from "next/server";

import type { AuthenticatedSession } from "@/lib/auth/session";
import { resolveEntitlement, type Entitlement } from "@/lib/usage/entitlements";
import {
  checkQuota,
  checkRateLimit,
  recordRateLimitEvent,
  recordUsage,
  type UsageMetricKey,
} from "@/lib/usage/meter";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface UsageRecordDetail {
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}

export type UsageGuardOutcome =
  | {
      denied: false;
      entitlement: Entitlement;
      /**
       * Records the consumed operation. Call AFTER the work succeeds,
       * with token counts taken from the provider response.
       */
      record: (detail?: UsageRecordDetail) => Promise<void>;
    }
  | {
      denied: true;
      response: NextResponse;
    };

/* -------------------------------------------------------------------------- */
/*                              DENIAL RESPONSES                              */
/* -------------------------------------------------------------------------- */

function denial(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...headers,
      },
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                                ENFORCEMENT                                 */
/* -------------------------------------------------------------------------- */

/**
 * Enforces rate limit and plan quota for one operation.
 *
 * @param session    The verified session. Identity comes from here only.
 * @param endpoint   A key in RATE_LIMITS, e.g. "ai:chat".
 * @param metricKey  A key in USAGE_METRICS, e.g. "chatMessage".
 * @param extraMetrics
 *   Additional quotas that must ALSO pass — used where an operation is
 *   bounded on more than one window (daily AND monthly message caps).
 */
export async function enforceUsage(
  session: AuthenticatedSession,
  endpoint: string,
  metricKey: UsageMetricKey,
  extraMetrics: readonly UsageMetricKey[] = [],
): Promise<UsageGuardOutcome> {
  const db = session.supabase;
  const userId = session.userId;

  /* ---------------------------------------------------------------- */
  /* 1. Entitlement — from the database, never from the request        */
  /* ---------------------------------------------------------------- */

  const entitlementResult = await resolveEntitlement(db, userId);

  if (!entitlementResult.ok) {
    if (entitlementResult.reason === "PROFILE_NOT_FOUND") {
      /*
       * A verified session with no profile row cannot have its plan
       * determined. Denying is the safe direction: the alternative is
       * serving paid-tier work to an account whose entitlement is
       * unknown.
       */
      return {
        denied: true,
        response: denial(
          403,
          "PROFILE_NOT_FOUND",
          "No billing profile is associated with this account.",
        ),
      };
    }

    return {
      denied: true,
      response: denial(
        503,
        "ENTITLEMENT_UNAVAILABLE",
        "Usage entitlement could not be verified.",
      ),
    };
  }

  const entitlement = entitlementResult.entitlement;

  /* ---------------------------------------------------------------- */
  /* 2. Burst rate limit                                              */
  /* ---------------------------------------------------------------- */

  const rate = await checkRateLimit(db, userId, endpoint);

  if (!rate.allowed) {
    const status = rate.reason === "RATE_LIMITED" ? 429 : 503;

    return {
      denied: true,
      response: denial(
        status,
        rate.reason,
        rate.reason === "RATE_LIMITED"
          ? "Too many requests. Please slow down."
          : "Rate limit could not be verified.",
        { "Retry-After": String(rate.retryAfterSeconds) },
      ),
    };
  }

  /* ---------------------------------------------------------------- */
  /* 3. Plan quotas — every applicable window must pass               */
  /* ---------------------------------------------------------------- */

  for (const key of [metricKey, ...extraMetrics]) {
    const quota = await checkQuota(db, userId, entitlement, key);

    if (!quota.allowed) {
      if (quota.reason === "COUNT_FAILED") {
        return {
          denied: true,
          response: denial(
            503,
            "QUOTA_UNAVAILABLE",
            "Usage could not be verified.",
          ),
        };
      }

      return {
        denied: true,
        response: denial(
          429,
          "QUOTA_EXCEEDED",
          `You have reached your plan limit for this action (${quota.used}/${quota.limit}).`,
          quota.resetsAt ? { "X-Quota-Resets-At": quota.resetsAt } : {},
        ),
      };
    }
  }

  /* ---------------------------------------------------------------- */
  /* 4. Record the attempt against the burst window                   */
  /*                                                                  */
  /* Deliberately BEFORE the work: a caller that aborts mid-request    */
  /* must still consume burst allowance, otherwise the rate limit is   */
  /* bypassable by disconnecting.                                     */
  /* ---------------------------------------------------------------- */

  await recordRateLimitEvent(db, userId, endpoint);

  return {
    denied: false,
    entitlement,
    record: async (detail: UsageRecordDetail = {}) => {
      await recordUsage(db, userId, metricKey, {
        ...detail,
        endpoint,
      });
    },
  };
}
