-- =========================================================
-- SYRAVEN — Privilege repair
--
-- Phase 12 follow-up (see PRODUCTION_RELIABILITY.md).
--
--
-- ROOT CAUSE
--
-- The `public` schema carries a malformed DEFAULT PRIVILEGES entry owned
-- by `postgres` which grants only {TRUNCATE, REFERENCES, TRIGGER} on new
-- tables and omits all DML. Every one of the 63 public tables is
-- postgres-owned, so every one inherited it:
--
--   service_role=Dxtm/postgres
--     D = TRUNCATE, x = REFERENCES, t = TRIGGER, m = MAINTAIN
--
-- The stock Supabase default (owned by `supabase_admin`, granting
-- `service_role=arwdDxtm`) is shadowed by it for anything `postgres`
-- creates.
--
-- Measured consequence before this migration:
--
--   service_role   0 DML grants across 63 tables
--   authenticated  DML on only the 7 pre-SYRAVEN tables
--                  (chats, conversations, memories, messages, profiles,
--                   usage, user_settings)
--
-- Every table introduced by the SYRAVEN migrations — projects, tasks,
-- knowledge, ai_knowledge_chunks, billing_webhook_events and the rest —
-- was unreachable by both roles. Requests failed with SQLSTATE 42501 at
-- the grant layer, BEFORE row level security was ever evaluated, so RLS
-- policies never came into play.
--
-- No migration in this repository caused this: there are zero GRANT
-- statements across the preceding 9 migrations, and the only REVOKE
-- (20260904120000) targets `anon` on `public.messages` and explicitly
-- leaves service_role untouched. The change was made outside version
-- control and left no trace in migration history.
--
--
-- WHY THIS IS SAFE
--
-- Verified read-only against production before this migration was
-- written:
--
--   - 63 of 63 public tables have RLS ENABLED (0 disabled)
--   - 136 of 136 policies target {authenticated}
--   - authenticated.rolbypassrls = false
--   - no SQL TRUNCATE exists in app/, lib/, services/ or any migration
--
-- For `authenticated`, restoring DML exposes no row: RLS still filters
-- everything, and the 7 tables that have RLS enabled with no policy
-- become deny-all rather than readable.
--
--
-- ACKNOWLEDGED RISK — service_role
--
-- service_role.rolbypassrls = true and NO policy targets it, so after
-- this migration service_role has unrestricted read/write on all 63
-- tables, including ai_provider_credentials and api_keys.
--
-- This is stock Supabase semantics, not something introduced here. The
-- security boundary for service_role is not RLS; it is that the key is
-- never exposed to a client. That boundary is verified: the key is
-- server-only and no service-role path exists in user-scoped retrieval
-- or ingestion (Phases 10-11).
--
-- This risk was reviewed and explicitly accepted before execution.
--
--
-- PROPERTIES
--
--   Idempotent      GRANT/REVOKE are declarative; re-running is a no-op.
--   Data loss       None. Catalog ACLs only; no DDL, no DML.
--   Transactional   All four statements commit or roll back together.
--   Reversible      See the rollback plan in the phase report.
--
-- Sequence privileges are deliberately NOT granted. The schema has one
-- sequence (rate_limit_events_id_seq) whose column is GENERATED AS
-- IDENTITY, which advances internally and needs no USAGE grant; the
-- other 61 tables key on gen_random_uuid().
--
-- OUT OF SCOPE: organization_invites and workflow_steps have RLS
-- enabled with no policies and remain deny-all for `authenticated`
-- after this migration. That is a policy-design question held for a
-- separate audit; this migration neither creates nor worsens it.
-- =========================================================


-- =========================================================
-- 1. FUTURE TABLES — grant DML by default
--
-- Without this, statement 2 is undone by the next CREATE TABLE and the
-- outage silently returns one migration later. Affects only objects
-- created after this point; grants nothing on existing data and cannot
-- expose a current row. `anon` is deliberately not named.
-- =========================================================

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables
  to authenticated, service_role;


-- =========================================================
-- 2. EXISTING TABLES — restore DML
--
-- The operative statement. Restores the table-level layer BENEATH row
-- level security; it does not alter, add or remove a single policy.
--
--   authenticated  every row still filtered by the 136 existing
--                  policies; the 7 policy-less tables become deny-all
--   service_role   full access (see ACKNOWLEDGED RISK above)
--   anon           unchanged — not named here, retains zero DML
-- =========================================================

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;


-- =========================================================
-- 3. EXISTING TABLES — remove stray TRUNCATE
--
-- The only privilege REDUCTION here, and the one piece of hardening.
--
-- TRUNCATE bypasses RLS entirely and cannot be constrained by any
-- policy. Holding it was measured at 61 tables for `anon` and 63 for
-- authenticated and service_role. For an unauthenticated role it is
-- indefensible.
--
-- Verified unused: no SQL TRUNCATE appears anywhere in app/, lib/,
-- services/ or the migrations (every source match was the Tailwind
-- `truncate` CSS class), and no .rpc() wrapper could invoke one.
-- =========================================================

revoke truncate on all tables in schema public
  from anon, authenticated, service_role;


-- =========================================================
-- 4. FUTURE TABLES — stop seeding TRUNCATE
--
-- Without this, statement 3 is cosmetic: the malformed default
-- re-grants TRUNCATE on the very next table created. Pairs with
-- statement 1 so the default ACL is coherent in both directions.
-- =========================================================

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated, service_role;
