-- =========================================================
-- SYRAVEN — Repair usage.type CHECK constraint
--
-- Phase 12 follow-up. Found while auditing embedding ingestion cost
-- control; the defect is pre-existing and affects ALL plan quota
-- enforcement, not only ingestion.
--
--
-- DEFECT
--
-- `usage_type_check` permits only 'message' and 'file':
--
--   CHECK (type = ANY (ARRAY['message'::text, 'file'::text]))
--
-- Every metric in USAGE_METRICS (lib/usage/meter.ts) writes a different
-- value — 'chat_message', 'agent_run', 'vision_request',
-- 'voice_request', 'file_upload'. There is ZERO overlap: no metric
-- produces an allowed value, and no allowed value is produced by any
-- metric. The constraint and the application have never agreed.
--
-- Because `recordUsage()` returns Promise<void> and only logs its
-- error, every rejected write was invisible. `countUsage()` has
-- therefore always returned 0, and no caller has ever reached a plan
-- limit across the nine metered routes.
--
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
-- It does NOT add an INSERT policy to public.usage.
--
-- An earlier draft did, and it was abandoned. `usage` is a metering
-- ledger: a client that can write its own usage rows can forge
-- metering, and a ledger the metered party can write is not a ledger.
-- tests/schema/migration-integrity.test.ts encodes exactly this rule
-- ("metering tables grant no client write policy"), and that rule is
-- correct.
--
-- The write path is instead moved to trusted server code:
-- `recordUsage()` now inserts through the service-role client while
-- `countUsage()` continues to read through the CALLER'S RLS-scoped
-- client. Service role is used only to write a row the user may not
-- write themselves — never to serve user-facing data.
--
-- The resulting model for public.usage is unchanged from today except
-- for the type vocabulary:
--
--   SELECT   allowed to the row owner, via the two existing policies
--   INSERT   denied to authenticated; performed by service role only
--   UPDATE   denied (no policy)
--   DELETE   denied (no policy)
--
--
-- SAFETY
--
--   Data loss       None. public.usage holds 0 rows, verified
--                   immediately before this migration was written.
--   Widening only   The constraint gains values and loses none.
--   Backward compat 'message' and 'file' are RETAINED.
--   Idempotent      Guarded by `drop constraint if exists`.
--   Policies        UNTOUCHED. No policy is created, altered or dropped.
--   Indexes         UNTOUCHED.
--
-- NOTE — USER-VISIBLE BEHAVIOUR CHANGE: once this is applied and the
-- trusted writer is live, quota enforcement becomes effective for the
-- first time. Users already at or over their plan allowance will begin
-- receiving 429 responses. That is the intended behaviour, but it is a
-- change rather than a silent repair.
-- =========================================================

alter table public.usage
  drop constraint if exists usage_type_check;

alter table public.usage
  add constraint usage_type_check
  check (type in (
    'message',          -- legacy, retained for backward compatibility
    'file',             -- legacy, retained for backward compatibility
    'chat_message',     -- chatMessage, chatMessageMonthly
    'agent_run',        -- agentRun
    'vision_request',   -- visionRequest
    'voice_request',    -- voiceRequest
    'file_upload'       -- fileUpload (metric defined; route not yet wired)
  ));
