/**
 * SYRAVEN — Stripe webhook idempotency
 * lib/billing/idempotency.ts
 *
 * Phase 6 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Guarantees that a Stripe event is applied AT MOST ONCE, however many
 * times Stripe delivers it.
 *
 * WHY
 *
 * ARCHITECTURE_AUDIT.md §8.4: the webhook stored no event id, so a
 * redelivered `checkout.session.completed` re-ran the billing update.
 * Master protocol §24: "A webhook delivered twice must not create two
 * billing side effects."
 *
 * Since Phase 5 this is an AUTHORIZATION concern, not only a billing
 * one: `profiles.plan` decides what AI work a user may consume, so a
 * replayed or out-of-order event changes entitlement.
 *
 * HOW
 *
 * `billing_webhook_events.stripe_event_id` carries a UNIQUE constraint.
 * The claim is an INSERT:
 *
 *   - insert succeeds -> this process owns the event, proceed
 *   - insert fails on the unique violation -> already claimed, skip
 *
 * The database enforces the mutual exclusion, so two concurrent
 * deliveries of the same event cannot both proceed — a check-then-act in
 * application code would race.
 *
 * ORDER MATTERS
 *
 * The claim is written BEFORE the side effect and marked processed
 * AFTER. A crash in between leaves `status = 'pending'`, which is
 * visible for investigation rather than silently retried into a double
 * application.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BillingWebhookEventInsert,
  BillingWebhookEventUpdate,
} from "@/types/billing-webhook-events";
import type { Database } from "@/types/database";

/**
 * The idempotency store is typed separately from the generated schema
 * because its migration is not yet applied — see
 * types/billing-webhook-events.ts for why, and how to collapse this
 * once it is.
 *
 * `types/database.ts` is generated from the LIVE database, so it does
 * not yet contain `billing_webhook_events`. Passing an unknown table
 * name to the generated client type resolves to `never`, which is
 * correct behaviour on the client's part — the table genuinely is not in
 * that schema yet.
 *
 * Rather than weaken the generated types or hand-edit a generated file,
 * the two calls in this module reach the table through this narrow,
 * fully-typed surface. It describes exactly the two operations used and
 * nothing else, so nothing else in the codebase loses type safety.
 *
 * DELETE THIS once the migration is applied and types regenerated: the
 * generated definition then covers the table and `SupabaseClient<Database>`
 * can be used directly.
 */
interface BillingEventsTable {
  insert(values: BillingWebhookEventInsert): PromiseLike<{
    error: { code?: string; message: string } | null;
  }>;

  update(values: BillingWebhookEventUpdate): {
    eq(
      column: "stripe_event_id",
      value: string,
    ): PromiseLike<{
      error: { code?: string; message: string } | null;
    }>;
  };
}

export interface BillingEventsClient {
  from(table: "billing_webhook_events"): BillingEventsTable;
}

/**
 * Narrows a Supabase client to the idempotency-store surface.
 *
 * The cast is confined to this one function. It is sound because the
 * migration in supabase/migrations defines exactly the columns declared
 * in types/billing-webhook-events.ts, and a test asserts the two agree.
 */
export function asBillingEventsClient(
  client: SupabaseClient<Database>,
): BillingEventsClient {
  return client as unknown as BillingEventsClient;
}

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: "ALREADY_PROCESSED" | "CLAIM_FAILED" };

export interface EventOutcome {
  status: "processed" | "ignored" | "failed";
  userId?: string | null;
  stripeCustomerId?: string | null;
  resolvedPlan?: string | null;
  planSource?: string | null;
  errorMessage?: string | null;
}

/**
 * PostgreSQL unique-violation SQLSTATE.
 *
 * Matched explicitly so a genuine outage is not mistaken for "already
 * processed" — treating a connection error as a duplicate would silently
 * DROP a legitimate billing event.
 */
const UNIQUE_VIOLATION = "23505";

/* -------------------------------------------------------------------------- */
/*                                  CLAIM                                     */
/* -------------------------------------------------------------------------- */

/**
 * Attempts to claim a Stripe event for processing.
 *
 * Returns `claimed: true` exactly once per event id across all
 * concurrent deliveries.
 *
 * @param db      Service-role client. A Stripe webhook has no user
 *                session, so there is no caller identity for RLS to
 *                evaluate; the table is deny-all to every other role.
 */
export async function claimEvent(
  db: BillingEventsClient,
  stripeEventId: string,
  eventType: string,
): Promise<ClaimResult> {
  const { error } = await db
    .from("billing_webhook_events")
    .insert({
      stripe_event_id: stripeEventId,
      event_type: eventType,
      status: "pending",
    });

  if (!error) {
    return { claimed: true };
  }

  if (error.code === UNIQUE_VIOLATION) {
    /*
     * Stripe redelivered an event we have already accepted. This is
     * normal and expected — acknowledge without repeating the side
     * effect.
     */
    console.warn("SYRAVEN BILLING: duplicate event ignored.", {
      stripeEventId,
      eventType,
    });

    return { claimed: false, reason: "ALREADY_PROCESSED" };
  }

  /*
   * Anything else — connectivity, permissions, a missing table — must
   * NOT be treated as a duplicate. Returning CLAIM_FAILED makes the
   * handler respond with an error so Stripe retries, rather than
   * silently dropping a real billing event.
   */
  console.error("SYRAVEN BILLING: event claim failed.", {
    stripeEventId,
    eventType,
    code: error.code,
    message: error.message,
  });

  return { claimed: false, reason: "CLAIM_FAILED" };
}

/* -------------------------------------------------------------------------- */
/*                                 SETTLE                                     */
/* -------------------------------------------------------------------------- */

/**
 * Records the outcome of a claimed event.
 *
 * Best-effort: the side effect has already been applied by this point,
 * so a failure to annotate must not fail the request or cause Stripe to
 * retry an event that already took effect. It is logged loudly because
 * repeated failures leave the audit trail incomplete.
 */
export async function settleEvent(
  db: BillingEventsClient,
  stripeEventId: string,
  outcome: EventOutcome,
): Promise<void> {
  const { error } = await db
    .from("billing_webhook_events")
    .update({
      status: outcome.status,
      processed_at: new Date().toISOString(),
      user_id: outcome.userId ?? null,
      stripe_customer_id: outcome.stripeCustomerId ?? null,
      resolved_plan: outcome.resolvedPlan ?? null,
      plan_source: outcome.planSource ?? null,
      error_message: outcome.errorMessage ?? null,
    })
    .eq("stripe_event_id", stripeEventId);

  if (error) {
    console.error("SYRAVEN BILLING: settle failed.", {
      stripeEventId,
      status: outcome.status,
      message: error.message,
    });
  }
}
