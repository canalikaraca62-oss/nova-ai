-- =========================================================
-- SYRAVEN — tenant write boundaries: messages, projects, approvals
-- 20260913130000_syraven_tenant_write_boundaries.sql
--
-- STATUS: WRITTEN, NOT APPLIED. Needs explicit founder approval before it
-- touches production (MIGRATION_APPROVAL_REQUIRED.md).
--
-- Found in the Phase 1 adversarial review (2026-09-13). Since
-- 20260906120000 grants DML on every public table to `authenticated`,
-- RLS is the only thing between a signed-in user calling PostgREST
-- directly and the rows below. Each hole is in the SQL as written.
--
-- 1. messages -- a message planted in another user's conversation
--
--    messages_insert_own (20260904122000) OR'd three ownership paths, so
--    `auth.uid() = user_id` alone satisfied it whatever conversation_id
--    or chat_id named. A user who knew another user's conversation id
--    could insert an 'assistant' or 'system' message into it, and the
--    victim's select policy shows it to them: a prompt injected into
--    their history.
--
--    The fix is a PRIVILEGE, not only a policy. `messages` is one of the
--    drifted tables whose production policies were never captured in
--    migrations (20260901165000), and Postgres ORs permissive policies:
--    replacing messages_insert_own cannot close the hole if production
--    holds any other permissive INSERT policy this repository cannot
--    see. Revoking INSERT from `authenticated` closes it whatever
--    policies exist. The corrected policy (every ownership path named on
--    the row must be the caller's) stays as defense in depth, should the
--    grant ever be restored.
--
--    Verified before revoking (Phase 1, step 2): nothing inserts into
--    messages with any client other than the service role --
--      - no .from("messages") in app/, lib/ or services/, on one line or
--        split across lines, at HEAD or anywhere in git history
--      - the chat UI and /api/chat, /api/stream make no Supabase call
--      - the variable-table helpers (lib/search/query.ts, semantic.ts,
--        ingest.ts) name only projects, tasks, knowledge, ai_knowledge_*
--      - no database function or trigger inserts into messages
--    Existing rows predate this code and are untouched.
--
-- 2. projects -- a project planted in another organization
--
--    "users can create projects" checked only owner_id; organization_id
--    was free, and the select policy admits
--    is_organization_member(organization_id). A user could insert a
--    project into an organization they do not belong to and its members
--    would see it. The update policy let an owner move a project there
--    the same way. /api/projects inserts no organization_id, so it is
--    unaffected.
--
-- 3. agent_approvals -- the record of what a person agreed to could be
--    rewritten
--
--    The insert policy let the client choose expires_at, so a pending row
--    could be born with a 2099 expiry and then approved: a standing grant
--    past the 15-minute TTL (APPROVAL_TTL_MS). The update policy let a
--    pending or approved row be rewritten -- expires_at, tool_id,
--    execution_key, effect, risk, scope -- so long as the decider stayed
--    the caller. Limited to the caller's own approvals, but an approval
--    is the audit trail of a human decision and must mean what it said.
--
--    Now:
--      - column privileges are exactly what
--        lib/orchestration/approvalStore.ts writes: insert of the request
--        columns, update of status / decided_by_user_id / decided_at only
--      - created_at is not insertable, so it is always the database clock
--      - expiry is bounded to the TTL plus one minute of clock difference
--        between the application and the database (NOT VALID: existing
--        rows are not re-checked, so a row already extended cannot block
--        this migration -- but any update to such a row now fails, so it
--        can no longer be decided or claimed)
--      - an update must leave the row decided by the caller
--        ('approved', 'rejected' or 'used'); a row cannot be moved back
--        to 'pending' or 'expired'
--
-- EXPECTED PRODUCTION EFFECT
--
--   - Any insert into messages by a signed-in user through PostgREST:
--     refused (permission denied), whatever policies production holds.
--     Application: no change (no writer). The service role is unaffected.
--   - Project insert/update naming an organization the caller is not an
--     active member of: refused. /api/projects: no change.
--   - agent_approvals: requestApprovals / decideApproval / claimApproval
--     keep working (their columns are granted); writing created_at,
--     rewriting expires_at/tool_id/effect/scope, or reverting a status:
--     refused.
--   - Existing rows: untouched.
--
-- REVERSIBILITY
--
--   Recreate the three policies from 20260901154222 / 20260904122000 /
--   20260905120000, `grant insert on public.messages to authenticated`,
--   `grant insert, update on public.agent_approvals to authenticated`,
--   drop constraint agent_approvals_ttl_bounded.
--   (Reopens the holes; documented so rollback is not improvised.)
--
-- SAFETY
--
--   - drop policy if exists + create policy; drop constraint if exists
--   - no table, column or row is created, altered or removed
--   - NOT TESTED against a database: no local Postgres is available on
--     the machine that wrote it. Apply to the test project first.
-- =========================================================


-- =========================================================
-- 1. messages
-- =========================================================

drop policy if exists "messages_insert_own" on public.messages;

create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    conversation_id is null
    or exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  and (
    chat_id is null
    or exists (
      select 1
      from public.chats ch
      where ch.id = messages.chat_id
        and ch.user_id = auth.uid()
    )
  )
);

-- The operative statement. With no INSERT privilege, no policy -- tracked
-- here or present only in production -- can admit a client insert. The
-- policy above is defense in depth.
revoke insert on table public.messages from authenticated;


-- =========================================================
-- 2. projects
-- =========================================================

drop policy if exists "users can create projects" on public.projects;

create policy "users can create projects"
on public.projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (
    organization_id is null
    or public.is_organization_member(organization_id)
  )
);


drop policy if exists "owners and admins can update projects" on public.projects;

create policy "owners and admins can update projects"
on public.projects
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.is_organization_admin(organization_id)
)
with check (
  (
    owner_id = auth.uid()
    and (
      organization_id is null
      or public.is_organization_member(organization_id)
    )
  )
  or public.is_organization_admin(organization_id)
);


-- =========================================================
-- 3. agent_approvals
-- =========================================================

revoke insert, update on table public.agent_approvals from authenticated;

grant insert (
  execution_key,
  requested_for_user_id,
  agent_id,
  tool_id,
  risk,
  effect,
  organization_id,
  workspace_id,
  project_id,
  status,
  expires_at
) on public.agent_approvals to authenticated;

grant update (status, decided_by_user_id, decided_at)
  on public.agent_approvals to authenticated;


alter table public.agent_approvals
  drop constraint if exists agent_approvals_ttl_bounded;

alter table public.agent_approvals
  add constraint agent_approvals_ttl_bounded
  check (expires_at <= created_at + interval '16 minutes')
  not valid;


drop policy if exists "agent_approvals_update_own" on public.agent_approvals;

create policy "agent_approvals_update_own"
on public.agent_approvals
for update
to authenticated
using (
  auth.uid() = requested_for_user_id
  and status in ('pending', 'approved')
)
with check (
  auth.uid() = requested_for_user_id
  and decided_by_user_id = auth.uid()
  and status in ('approved', 'rejected', 'used')
);
