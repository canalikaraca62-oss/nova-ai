-- =========================================================
-- SYRAVEN — Lease control for public.jobs
--
-- NOT APPLIED. Pending explicit human approval, like
-- 20260909120000_syraven_integration_connections.sql.
--
--
-- PROBLEM
--
-- public.jobs is a complete durable queue: status with a CHECK
-- constraint, priority, scheduled_for, attempts, max_attempts,
-- locked_at, locked_by, payload, result, error. jobs_queue_idx is
-- already ordered (status, priority desc, scheduled_for asc), which is
-- precisely a queue scan.
--
-- It has RLS enabled and exactly two policies:
--
--   "users can view organization jobs"   for select
--   "users can create own jobs"          for insert
--
-- There is no UPDATE policy. Under RLS that means no authenticated
-- caller can move a job from 'queued' to 'running', write locked_by, or
-- record a result. The queue can be filled and read, and never drained.
--
--
-- WHAT THIS MIGRATION DOES, AND DELIBERATELY DOES NOT DO
--
-- It does NOT grant authenticated callers the right to lease jobs.
--
-- An earlier draft did, and it was wrong for the same reason
-- 20260906160000 gives for public.usage: a queue whose workers are the
-- metered party is not a queue. A caller able to set status='completed'
-- on their own job can mark work done that never ran, and a caller able
-- to write locked_by can steal another tenant's lease.
--
-- Leasing is therefore reserved to trusted server code through the
-- service-role client (lib/autopilot/queue.ts), exactly as
-- lib/usage/meter.ts writes the metering ledger. Service role bypasses
-- RLS and holds its own privileges, so nothing here affects it.
--
-- What this migration adds is the one update a USER legitimately owns:
-- cancelling their own job. A person who queued work must be able to
-- stop it. That is the only state transition a client may perform.
--
--
-- WHY A CANCEL POLICY IS SAFE WHEN A GENERAL ONE IS NOT
--
--   USING      restricts WHICH rows: the caller's own, and only while
--              the job has not already finished.
--   WITH CHECK restricts WHAT THEY BECOME: status must be 'cancelled'.
--
-- Without WITH CHECK, "update your own queued job" is "set your own job
-- to completed", which is the forgery above.
--
-- A policy constrains rows and their final state, not COLUMNS. On its
-- own, "cancel your own job" would still let the same statement write
-- result, error, completed_at or locked_by -- a cancelled job carrying a
-- fabricated result. So the UPDATE privilege for authenticated is
-- narrowed to the two columns a cancellation needs: status and
-- updated_at. Postgres checks column privileges before RLS, so a
-- request touching any other column is refused outright.
--
--
-- SAFETY
--
-- Additive, idempotent, non-destructive:
--   - drop policy if exists + create policy (the established pattern
--     from 20260904122000 and 20260905120000)
--   - revoke/grant of the UPDATE privilege for authenticated only; no
--     other role, privilege, table, column, index or existing policy
--     is changed, and re-applying yields the same grant
--   - no drop table, truncate, delete, or alter-drop
--
-- No application code updates public.jobs as an authenticated user, so
-- narrowing the privilege removes nothing that is in use.
-- =========================================================


-- =========================================================
-- A user may cancel their own unfinished job. Nothing else.
-- =========================================================

drop policy if exists "users can cancel own jobs" on public.jobs;

create policy "users can cancel own jobs"
on public.jobs
for update
to authenticated
using (
  user_id = auth.uid()
  and status in ('queued', 'retrying', 'running')
)
with check (
  user_id = auth.uid()
  and status = 'cancelled'
);


-- =========================================================
-- ...and a cancellation can only touch the columns it needs.
-- =========================================================

revoke update on public.jobs from authenticated;

grant update (status, updated_at) on public.jobs to authenticated;
