/**
 * SYRAVEN — Data access client selection
 * lib/data/client.ts
 *
 * Phase 4 (see IMPLEMENTATION_PLAN.md).
 *
 * THE RULE
 *
 * The RLS-enforced, request-scoped client is the DEFAULT data path.
 * `supabaseAdmin` bypasses Row Level Security entirely and is the
 * exception, permitted only where there is no caller identity for RLS to
 * evaluate against, or where the operation must be unforgeable by a
 * client.
 *
 * WHY THIS MATTERS
 *
 * ARCHITECTURE_AUDIT.md §8.6: the service-role client was the default
 * data client, which is why the RLS policies never executed for
 * application traffic and why a single missing `.eq("user_id", …)`
 * became a full breach (§8.1). Using the caller's own client makes RLS a
 * real second line of defence rather than dormant configuration.
 *
 * IMPORTANT — RLS IS NOT A SUBSTITUTE FOR OWNERSHIP FILTERS
 *
 * Routes must keep their explicit `user_id` filters. RLS is defence in
 * depth *underneath* them, not a replacement for them. Two independent
 * controls is the point.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuthenticatedSession } from "@/lib/auth/session";
import type { Database } from "@/types/database";

/* -------------------------------------------------------------------------- */
/*                          ELEVATED ACCESS REASONS                           */
/* -------------------------------------------------------------------------- */

/**
 * The complete set of reasons a route may bypass RLS.
 *
 * Adding a member here is a security decision. Each value documents a
 * situation where the caller's own client genuinely cannot perform the
 * work — not merely where it would be more convenient.
 */
export type ElevatedAccessReason =
  /**
   * No user session exists at the point of the query, so there is no
   * identity for RLS to evaluate. Example: a Stripe webhook authenticated
   * by signature, or account provisioning before the first session.
   */
  | "NO_CALLER_IDENTITY"
  /**
   * The record must not be forgeable by the account it describes.
   * Example: usage metering — a client able to write its own consumption
   * rows could defeat the limits Phase 5 will enforce.
   */
  | "UNFORGEABLE_RECORD"
  /**
   * The operation is governed by storage bucket policies rather than
   * table RLS, so a table-scoped client provides no protection.
   */
  | "STORAGE_OPERATION"
  /**
   * The table's RLS predicate does not match the column the application
   * uses for ownership, so the caller's client would return nothing.
   * This is a schema defect being worked around, NOT a design choice —
   * every use must name the mismatch and the migration that would fix it.
   */
  | "RLS_PREDICATE_MISMATCH";

/* -------------------------------------------------------------------------- */
/*                              CLIENT SELECTION                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns the default data client: the caller's own, RLS-enforced.
 *
 * Prefer this everywhere. Queries through it are constrained by the
 * policies in supabase/migrations, so a missing ownership filter degrades
 * to "no rows" rather than "somebody else's rows".
 */
export function dataClient(
  session: AuthenticatedSession,
): SupabaseClient<Database> {
  return session.supabase;
}

/**
 * Returns the RLS-bypassing service-role client, with the reason recorded
 * at the call site.
 *
 * The `reason` argument is not decorative: it forces the author to state
 * which of the permitted situations applies, and it makes every elevated
 * use greppable and auditable.
 *
 * @example
 *   const db = elevatedClient(
 *     supabaseAdmin,
 *     "UNFORGEABLE_RECORD",
 *     "Usage rows must not be writable by the account they meter.",
 *   );
 */
export function elevatedClient(
  admin: SupabaseClient<Database>,
  reason: ElevatedAccessReason,
  justification: string,
): SupabaseClient<Database> {
  if (
    typeof justification !== "string" ||
    justification.trim().length < 20
  ) {
    /*
     * A bare reason code with no explanation is how "documented" decays
     * into a rubber stamp. Fail loudly in development instead.
     */
    throw new Error(
      `elevatedClient(${reason}) requires a specific written justification.`,
    );
  }

  return admin;
}
