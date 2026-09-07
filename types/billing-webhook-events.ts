/**
 * SYRAVEN — Types for public.billing_webhook_events
 *
 * Phase 6 (see IMPLEMENTATION_PLAN.md).
 *
 * WHY THIS FILE EXISTS
 *
 * `types/database.ts` is GENERATED from the live database
 * (`supabase gen types`). The billing idempotency table is introduced by
 * 20260904130000_syraven_billing_idempotency.sql, which has deliberately
 * NOT been pushed — production migrations require explicit approval.
 *
 * So the table exists in the repository but not yet in the generated
 * types. Rather than hand-edit a generated file (which the next
 * regeneration would silently discard), the shape is declared here and
 * composed into the client type where it is used.
 *
 * WHEN THE MIGRATION IS APPLIED
 *
 * Regenerate types:
 *
 *     npx supabase gen types typescript --linked > types/database.ts
 *
 * then delete this file and the `BillingDatabase` composition in
 * lib/billing/idempotency.ts. The generated definition supersedes it.
 *
 * This mirrors the migration exactly; a test asserts the two agree.
 */

/**
 * Processing status of a received Stripe event.
 *
 * Matches the CHECK constraint in the migration.
 */
export type BillingWebhookEventStatus =
  | "pending"
  | "processed"
  | "ignored"
  | "failed";

export interface BillingWebhookEventRow {
  id: string;
  stripe_event_id: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  status: BillingWebhookEventStatus;
  user_id: string | null;
  stripe_customer_id: string | null;
  resolved_plan: string | null;
  plan_source: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BillingWebhookEventInsert {
  id?: string;
  stripe_event_id: string;
  event_type: string;
  received_at?: string;
  processed_at?: string | null;
  status?: BillingWebhookEventStatus;
  user_id?: string | null;
  stripe_customer_id?: string | null;
  resolved_plan?: string | null;
  plan_source?: string | null;
  error_message?: string | null;
  created_at?: string;
}

export interface BillingWebhookEventUpdate {
  id?: string;
  stripe_event_id?: string;
  event_type?: string;
  received_at?: string;
  processed_at?: string | null;
  status?: BillingWebhookEventStatus;
  user_id?: string | null;
  stripe_customer_id?: string | null;
  resolved_plan?: string | null;
  plan_source?: string | null;
  error_message?: string | null;
  created_at?: string;
}

/**
 * A Database type carrying only this table.
 *
 * Composed with the generated Database where the idempotency store is
 * accessed, so the rest of the schema keeps its generated types.
 */
export type BillingWebhookEventsSchema = {
  /*
   * The generated Database carries this marker and the Supabase client
   * generics key off it. Without it the schema resolves to `never` and
   * every query is unassignable.
   */
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };

  public: {
    Tables: {
      billing_webhook_events: {
        Row: BillingWebhookEventRow;
        Insert: BillingWebhookEventInsert;
        Update: BillingWebhookEventUpdate;
        Relationships: [];
      };
    };
    /*
     * These mirror the `[_ in never]: never` shape that
     * `supabase gen types` emits for an empty section. The Supabase
     * client generics require that exact form — `Record<never, never>`
     * resolves to `never` and makes every query unassignable.
     */
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
