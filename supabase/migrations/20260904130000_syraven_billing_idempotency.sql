-- =========================================================
-- SYRAVEN — Billing webhook idempotency and audit trail
--
-- Phase 6 (see IMPLEMENTATION_PLAN.md).
--
-- PROBLEM
--
-- ARCHITECTURE_AUDIT.md §8.4: the Stripe webhook verifies signatures
-- correctly but records nothing about which events it has already
-- processed. Stripe guarantees AT-LEAST-ONCE delivery, so a redelivered
-- `checkout.session.completed` re-runs `updateBilling` unconditionally.
--
-- Master protocol §24 states the requirement directly: "A webhook
-- delivered twice must not create two billing side effects."
--
-- Since Phase 5, this is no longer only a billing concern.
-- `profiles.plan` drives AI entitlement, so a replayed or out-of-order
-- event changes what a user is authorized to consume.
--
--
-- SOLUTION
--
-- `billing_webhook_events` records every Stripe event id the moment it
-- is accepted. The UNIQUE constraint on `stripe_event_id` is the
-- idempotency key: a duplicate insert fails, and the handler treats that
-- failure as "already processed" and returns success without repeating
-- the side effect.
--
-- The row is inserted BEFORE the side effect and marked processed AFTER,
-- so a crash in between leaves a claimed-but-unprocessed row that can be
-- identified by `processed_at is null` rather than silently retried into
-- a double charge.
--
--
-- SAFETY
--
-- Additive and idempotent:
--   - `create table if not exists`
--   - `create index if not exists`
--   - no drop, truncate, delete, or alter-drop
--
-- Applying to a database that already has the table is a no-op.
--
-- NOTE: existing tables are NOT modified. `public.profiles` keeps its
-- current shape; nothing here changes billing columns.
-- =========================================================


-- =========================================================
-- billing_webhook_events
--
-- One row per Stripe event the application has accepted.
-- =========================================================

create table if not exists public.billing_webhook_events (
  id                  uuid primary key default gen_random_uuid(),

  /*
    The Stripe event id (evt_…). UNIQUE — this is the idempotency key.

    A second delivery of the same event fails to insert, which is how
    duplicate processing is prevented.
  */
  stripe_event_id     text not null unique,

  event_type          text not null,

  /*
    When the event was CLAIMED (row inserted) versus when processing
    finished. A row with processed_at still null after a crash is
    visible for investigation rather than being silently reprocessed.
  */
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,

  /*
    Outcome, for the audit trail.

      pending   — claimed, side effect not yet confirmed
      processed — completed successfully
      ignored   — a Stripe event type this application does not handle
      failed    — handler raised; retained for diagnosis
  */
  status              text not null default 'pending'
    check (
      status in ('pending', 'processed', 'ignored', 'failed')
    ),

  /*
    Billing audit fields. Populated where the event carries them, so the
    trail answers "what did this event change, and why" without needing
    to re-fetch from Stripe.
  */
  user_id             uuid,
  stripe_customer_id  text,
  resolved_plan       text,

  /*
    How the plan was determined: 'price', 'metadata_confirmed' or
    'default'. Makes it visible when entitlement rested on metadata
    rather than on the purchased price
    (ARCHITECTURE_AUDIT.md §8.5).
  */
  plan_source         text,

  error_message       text,

  created_at          timestamptz not null default now()
);


-- Replay lookups are by Stripe event id; the unique constraint already
-- provides that index. These support operational queries.

create index if not exists billing_webhook_events_received_at_idx
  on public.billing_webhook_events (received_at desc);

create index if not exists billing_webhook_events_status_idx
  on public.billing_webhook_events (status);

create index if not exists billing_webhook_events_user_id_idx
  on public.billing_webhook_events (user_id);


-- =========================================================
-- ROW LEVEL SECURITY
--
-- Deny-all by design.
--
-- This table is written and read ONLY by the webhook handler, which runs
-- with the service-role client because a Stripe webhook carries no user
-- session (it is authenticated by signature). No client-facing policy is
-- added: a caller able to read it would learn other customers' billing
-- events, and one able to write it could forge an "already processed"
-- row to suppress a legitimate billing update.
--
-- This mirrors the deliberate deny-all decision recorded in DATABASE.md
-- §3.4 for the other infrastructure tables.
-- =========================================================

alter table public.billing_webhook_events enable row level security;
