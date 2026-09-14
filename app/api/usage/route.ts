import { NextResponse } from "next/server";

/*
  DATA ACCESS (Phase 4):

  This route only READS, through the CALLER'S OWN RLS-enforced client:
    - public.profiles: owner-scoped select (auth.uid() = id)
    - public.usage:    owner-scoped select (auth.uid() = user_id)

  The asymmetry is deliberate: usage rows are READ-ONLY to their owner.
  Writing metering needs an elevated client precisely so a client cannot
  forge its own consumption (20260904122000_syraven_rls_coverage.sql).
*/
import { withAuth } from "@/lib/api/withAuth";
import {
  UNLIMITED,
  limitFor,
  resolveEntitlement,
} from "@/lib/usage/entitlements";
import {
  USAGE_METRICS,
  type UsageMetricKey,
  countUsage,
  windowReset,
} from "@/lib/usage/meter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==================================================
   SYRAVEN USAGE API
   app/api/usage/route.ts

   Reports the caller's consumption of every metered operation, against
   the limit that is actually enforced, from the modules that enforce it:

     plan and trial -> lib/usage/entitlements.ts (resolveEntitlement)
     limits         -> lib/plans.ts, through limitFor
     consumption    -> lib/usage/meter.ts (USAGE_METRICS, countUsage)

   This route used to keep its own plan vocabulary, its own limit table
   and its own counting. The limits existed nowhere else, and the
   counting summed metadata keys the meter never writes, so it reported
   0 of everything against numbers no request was ever checked against
   (docs/engineering/PURIFICATION_EVIDENCE.md P2-F06).

   Only the current window can be reported: the meter counts the window
   in progress, which is the one enforcement uses.
================================================== */

const NO_STORE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Authorization",
};

type UsageMetricReport = {
  event: string;
  window: "day" | "month";
  used: number;
  /** null when the plan sets no ceiling. */
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
};

function errorResponse(
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

function currentMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

/* ==================================================
   GET USAGE
================================================== */

export const GET = withAuth(async (
  request,
  session
) => {
  const now = new Date();

  /*
    `period` was accepted for any past month. The meter counts only the
    window in progress, so another month is refused rather than answered
    with the current one under its name.
  */
  const requestedPeriod =
    request.nextUrl.searchParams
      .get("period")
      ?.trim();

  if (
    requestedPeriod &&
    requestedPeriod !== currentMonthKey(now)
  ) {
    return errorResponse(
      "PERIOD_NOT_AVAILABLE",
      "Only the current period can be reported.",
      400
    );
  }

  const entitlementResult =
    await resolveEntitlement(
      session.supabase,
      session.userId,
      now
    );

  if (!entitlementResult.ok) {
    return entitlementResult.reason === "PROFILE_NOT_FOUND"
      ? errorResponse(
          "PROFILE_NOT_FOUND",
          "User profile was not found.",
          404
        )
      : errorResponse(
          "USAGE_FETCH_FAILED",
          "Failed to retrieve usage information.",
          500
        );
  }

  const { entitlement } = entitlementResult;

  const keys = Object.keys(
    USAGE_METRICS
  ) as UsageMetricKey[];

  const counts = await Promise.all(
    keys.map((key) =>
      countUsage(
        session.supabase,
        session.userId,
        USAGE_METRICS[key],
        now
      )
    )
  );

  /*
    A count that could not be read is a failed report, never a 0: a
    reported 0 would tell the caller they have their whole allowance.
  */
  if (counts.some((count) => count === null)) {
    return errorResponse(
      "USAGE_FETCH_FAILED",
      "Failed to retrieve usage information.",
      500
    );
  }

  const metrics: Record<string, UsageMetricReport> = {};

  keys.forEach((key, index) => {
    const metric = USAGE_METRICS[key];
    const used = counts[index] ?? 0;
    const ceiling = limitFor(entitlement, metric.metric);
    const limit = ceiling === UNLIMITED ? null : ceiling;

    metrics[key] = {
      event: metric.event,
      window: metric.window,
      used,
      limit,
      remaining:
        limit === null
          ? null
          : Math.max(0, limit - used),
      resetsAt: windowReset(
        metric.window,
        now
      ).toISOString(),
    };
  });

  return NextResponse.json(
    {
      success: true,

      plan: entitlement.effectivePlan,
      billedPlan: entitlement.billedPlan,
      trial: entitlement.trial,
      trialEndsAt: entitlement.trialEndsAt,
      subscriptionStatus: entitlement.subscriptionStatus,

      metrics,

      generatedAt: now.toISOString(),
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    }
  );
});

/* ==================================================
   METHOD NOT ALLOWED
================================================== */

function methodNotAllowed() {
  return errorResponse(
    "METHOD_NOT_ALLOWED",
    "This endpoint only supports GET requests.",
    405
  );
}

export async function POST() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
