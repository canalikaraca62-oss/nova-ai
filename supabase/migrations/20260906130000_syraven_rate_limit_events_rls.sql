-- =========================================================
-- SYRAVEN — Row level security for rate_limit_events
--
-- Phase 12 follow-up (see PRODUCTION_RELIABILITY.md).
--
--
-- PROBLEM
--
-- `public.rate_limit_events` had RLS ENABLED with ZERO policies, which
-- in PostgreSQL denies every row to every non-bypassing role. The burst
-- rate limiter reads and writes this table through the CALLER'S
-- RLS-scoped client, not a service-role client:
--
--   lib/api/usageGuard.ts:118   const db = session.supabase;
--   lib/usage/meter.ts:423      count of recent events  -> always 0
--   lib/usage/meter.ts:470      insert of a new event   -> always denied
--
-- So the control failed in both directions at once:
--
--   - every count returned 0, so no caller was ever rate limited
--   - every insert was rejected, so no event was ever recorded
--
-- `recordRateLimitEvent` returns Promise<void> and only logs its error,
-- so the request proceeded regardless. That is why a completely
-- inoperative abuse control looked healthy: nothing failed loudly, and
-- the empty table read as "no traffic yet" rather than "nothing can be
-- written". Burst limiting was inactive across all nine paid routes.
--
-- The earlier privilege repair (20260906120000) fixed the GRANT layer.
-- This fixes the ROW layer, which is a separate and independent gate.
--
--
-- MODEL
--
-- A rate-limit event belongs to exactly one user. There is no
-- organization or workspace dimension to enforce: `user_id` is the whole
-- ownership boundary, and it is matched against `auth.uid()` — the
-- verified session subject, never a client-supplied value.
--
--
-- WHY INSERT AND SELECT ONLY
--
-- UPDATE and DELETE are deliberately NOT granted a policy, so they
-- remain denied by the enabled-but-unpolicied default.
--
-- This is the security property of the table. An abuse control whose
-- subject can edit or erase its own records is not a control: a caller
-- able to DELETE their own rows could reset their burst allowance at
-- will and issue unlimited paid AI requests. Retention and cleanup are
-- an operational concern for a privileged path, not something the
-- rate-limited party may perform on itself.
--
-- The INSERT policy is self-attested by design (`user_id = auth.uid()`).
-- A caller can therefore insert EXTRA events for themselves and consume
-- their own allowance faster. That is self-harm, not escalation, and is
-- the correct direction for an abuse control to fail.
--
--
-- SAFETY
--
--   Additive        Two CREATE POLICY statements; no table is altered.
--   Idempotent      Guarded by `drop policy if exists`, the idiom
--                   already used by 20260904123000.
--   Data loss       None. No DDL against data, no DML.
--   Scope           public.rate_limit_events only. No other table,
--                   policy, grant, or role is touched.
-- =========================================================


-- =========================================================
-- INSERT — a caller may record only their own events
--
-- WITH CHECK is the operative clause: it constrains the row being
-- WRITTEN. Without it, any authenticated caller could insert events
-- attributed to another user_id and exhaust that user's burst
-- allowance — a denial-of-service against a specific account.
--
-- INSERT policies take WITH CHECK only; a USING clause is not
-- applicable, because there is no pre-existing row to test.
-- =========================================================

drop policy if exists "users record own rate limit events"
  on public.rate_limit_events;

create policy "users record own rate limit events"
  on public.rate_limit_events
  for insert
  to authenticated
  with check (user_id = auth.uid());


-- =========================================================
-- SELECT — a caller may read only their own events
--
-- USING filters the rows returned. This keeps the limiter's own count
-- query working (it counts the caller's recent events) while making
-- another user's rows invisible.
--
-- Read access to another user's events would leak their activity
-- pattern: which endpoints they call and how often.
-- =========================================================

drop policy if exists "users read own rate limit events"
  on public.rate_limit_events;

create policy "users read own rate limit events"
  on public.rate_limit_events
  for select
  to authenticated
  using (user_id = auth.uid());
