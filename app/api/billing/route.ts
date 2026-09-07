import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import type { AuthenticatedSession } from "@/lib/auth/session";
import { isPlanId, DEFAULT_PLAN } from "@/lib/plans";

/*
  SYRAVEN — Billing status (read-only)

  WHY THIS ROUTE EXISTS

  app/billing/page.tsx and app/billing/success/page.tsx both perform a
  live GET on "/api/billing", and the route did not exist. The page
  throws "Unable to load billing information." on a non-OK response, so
  the billing screen showed a permanent error banner — the subscription
  UI was unusable even though checkout and portal worked.

  SCOPE — DELIBERATELY READ-ONLY

  This is a PROJECTION of `public.profiles`, nothing more. It creates no
  Stripe object, mutates no subscription, and calls no Stripe API. The
  billing architecture is unchanged:

    checkout      -> app/api/billing/checkout/route.ts   (existing)
    portal        -> app/api/billing/portal/route.ts     (existing)
    state changes -> app/api/billing/webhook/route.ts    (existing)

  Cancel, resume and change-plan remain UNIMPLEMENTED by design: those
  are mutations, and Stripe's Customer Portal (already wired) performs
  them. Adding parallel mutation endpoints would create a second source
  of truth for subscription state.

  WHY NOT REUSE /api/usage

  It also reads `plan` and `subscription_status`, but its response is
  shaped around quota counters and carries no Stripe identifiers. Bending
  the billing page onto that contract would couple two unrelated
  concerns; this route answers exactly the question the page asks.

  AUTHORIZATION

  Session-scoped through `withAuth`, reading through the caller's
  RLS-scoped client. A caller sees only their own profile row — the
  `profiles` RLS policy is the boundary, and no user id is accepted from
  the request.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/**
 * Shape consumed by `BillingResponse` in app/billing/page.tsx.
 *
 * `current_period_end` and `cancel_at_period_end` are declared because
 * the page reads them, but they are NOT stored in `public.profiles`.
 * They are reported as null/false rather than invented: the page already
 * defaults them (`?? null`, `Boolean(...)`), and fabricating a renewal
 * date would be worse than showing none — a user would plan around it.
 *
 * Populating them truthfully requires reading the Stripe subscription,
 * which is a paid API call and out of scope for a status projection.
 */
interface BillingResponseBody {
  plan: string;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  usage: Record<string, never>;
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export const GET = withAuth(async (_request, session: AuthenticatedSession) => {
  const { data, error } = await session.supabase
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) {
    /*
     * Logged without the database message: it can carry column names and
     * constraint detail. The caller learns only that the read failed.
     */
    console.error("SYRAVEN BILLING: profile read failed.", {
      userId: session.userId,
      error: error.message,
    });

    return NextResponse.json(
      { error: "Unable to load billing information." },
      { status: 503 },
    );
  }

  /*
   * A verified session with no profile row falls back to the default
   * plan rather than failing. Registration provisions the row, so this
   * is defensive; showing the free tier is the safe direction, since it
   * grants nothing.
   */
  const rawPlan = data?.plan;

  const plan = isPlanId(rawPlan) ? rawPlan : DEFAULT_PLAN;

  const body: BillingResponseBody = {
    plan,
    subscription_status: data?.subscription_status ?? null,
    /* Not stored locally — see the contract note above. */
    current_period_end: null,
    cancel_at_period_end: false,
    usage: {},
  };

  return NextResponse.json(body, { status: 200 });
});
