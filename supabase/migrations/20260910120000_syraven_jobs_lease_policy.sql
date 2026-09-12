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
-- RLS, so it needs no policy; what it needs is for everyone ELSE to be
-- unable to reach these columns, and that is what the absence of a
-- broad update policy already provides.
--
-- What this migration adds is the one update a USER legitimately owns:
-- cancelling their own job. A person who queued work must be able to
-- stop it. That is the only state transition a client may perform, and
-- the WITH CHECK clause pins it to exactly that.
--
--
-- WHY A CANCEL POLICY IS SAFE WHEN A GENERAL ONE IS NOT
--
--   USING      restricts WHICH rows: the caller's own, and only while
--              the job has not already finished.
--   WITH CHECK restricts WHAT THEY BECOME: status must be 'cancelled'.
--
-- Without WITH CHECK, "update your own queued job" is "set your own job
-- to completed", which is the forgery above. With it, the only
-- reachable end state is cancellation.
--
-- The lease columns are not mentioned because a policy cannot restrict
-- columns; that is why the transition itself is constrained instead.
-- A caller who sets status='cancelled' and also writes locked_by has
-- still only cancelled their own job, and the runner's compare-and-set
-- (.eq("status", …)) will then decline to claim it.
--
--
-- SAFETY
--
-- Additive, idempotent, non-destructive:
--   - drop policy if exists + create policy (the established pattern
--     from 20260904122000 and 20260905120000)
--   - no create table, no column change, no index change
--   - no drop table, truncate, delete, or alter-drop
--   - no existing policy is modified; the two existing jobs policies
--     are left exactly as they are
--
-- Applying to a database that already has the policy is a no-op.
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
