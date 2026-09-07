-- =========================================================
-- SYRAVEN — RLS coverage
--
-- Phase 2 (see IMPLEMENTATION_PLAN.md).
--
-- Closes the Row Level Security gaps recorded in ARCHITECTURE_AUDIT.md:
--
--   §8.8 — `teams` and `usage_events` are created by 20260901165535 but
--          never receive `enable row level security`. That migration
--          enables RLS on only `knowledge`, `notifications` and `tasks`.
--
--   §8.7 — six tables have RLS ENABLED but ZERO policies, making them
--          deny-all to normal clients. Whether that is intended is
--          resolved explicitly below rather than left ambiguous.
--
--   §9.1 — the 13 tables introduced by 20260904121000 need a deliberate
--          RLS decision like every other table.
--
--
-- SAFETY AND SCOPE
--
-- Additive and idempotent: `enable row level security` is a no-op when
-- already enabled, and every policy is wrapped in `drop policy if
-- exists` + `create policy`, so re-application is safe.
--
-- Policies follow the owner-scoped pattern already established by
-- 20260901165535 for `knowledge` / `notifications` / `tasks`:
--
--     to authenticated
--     using (auth.uid() = user_id)
--
-- IMPORTANT — this migration does NOT change how the application reads
-- data today. Every data route currently uses the service role client,
-- which bypasses RLS entirely (ARCHITECTURE_AUDIT.md §8.6). These
-- policies are therefore defence in depth: they take effect for the
-- anon/authenticated roles, and they become the primary control when
-- Phase 3 migrates routes onto a user-scoped client. Nothing here
-- pre-empts that Phase 3 work.
--
-- Enabling RLS on a table that previously had none DENIES access to the
-- anon and authenticated roles except where a policy allows it. That is
-- the intended direction (restricting, not widening). The service role
-- is unaffected, so current application behaviour is preserved.
-- =========================================================


-- =========================================================
-- 1. TABLES CREATED WITHOUT RLS (§8.8)
--
-- `teams` and `usage_events` are reachable by the anon role today.
-- Both carry a user-owned column, so an owner-scoped policy is exact.
-- =========================================================

alter table public.teams              enable row level security;
alter table public.usage_events       enable row level security;


-- ---------------------------------------------------------
-- teams — owner scoped via owner_id
--
-- Note: `teams.owner_id` is NULLABLE. `auth.uid() = owner_id` is NULL
-- (not true) for an ownerless row, so ownerless teams are invisible to
-- every non-service caller. That is the safe default; broader team
-- membership visibility belongs to the Phase 3 authorization model.
-- ---------------------------------------------------------

drop policy if exists "teams_select_own" on public.teams;

create policy "teams_select_own"
on public.teams
for select
to authenticated
using (auth.uid() = owner_id);


drop policy if exists "teams_insert_own" on public.teams;

create policy "teams_insert_own"
on public.teams
for insert
to authenticated
with check (auth.uid() = owner_id);


drop policy if exists "teams_update_own" on public.teams;

create policy "teams_update_own"
on public.teams
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);


drop policy if exists "teams_delete_own" on public.teams;

create policy "teams_delete_own"
on public.teams
for delete
to authenticated
using (auth.uid() = owner_id);


-- ---------------------------------------------------------
-- usage_events — read-only to the owning user.
--
-- Deliberately NO insert/update/delete policy: usage records are written
-- by trusted server code through the service role, which bypasses RLS.
-- Allowing a client to write its own metering rows would let a user
-- forge usage and defeat the limits Phase 5 will enforce.
-- ---------------------------------------------------------

drop policy if exists "usage_events_select_own" on public.usage_events;

create policy "usage_events_select_own"
on public.usage_events
for select
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- 2. TABLES CREATED BY THE PHASE 2 BASELINE (§9.1)
--
-- Every table introduced by 20260904121000 gets a deliberate decision.
-- =========================================================

alter table public.profiles              enable row level security;
alter table public.usage                 enable row level security;
alter table public.user_settings         enable row level security;
alter table public.agents                enable row level security;
alter table public.agent_conversations   enable row level security;
alter table public.agent_messages        enable row level security;
alter table public.agent_tasks           enable row level security;
alter table public.agent_runs            enable row level security;
alter table public.chats                 enable row level security;
alter table public.conversations         enable row level security;
alter table public.messages              enable row level security;
alter table public.files                 enable row level security;
alter table public.memories              enable row level security;


-- ---------------------------------------------------------
-- profiles — a user may read and update their own profile.
--
-- No INSERT policy: profile rows are provisioned by trusted server code.
-- No DELETE policy: profiles carry billing state and must not be
-- removable by a client.
--
-- Billing columns are writable through this UPDATE policy, which is why
-- the server must remain the source of truth for them (the Stripe
-- webhook already writes via the service role). Narrowing this to
-- non-billing columns requires column-level privileges and belongs with
-- the Phase 3 authorization work.
-- ---------------------------------------------------------

drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);


drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


-- ---------------------------------------------------------
-- usage — read-only to the owning user, for the same reason as
-- usage_events above: clients must not be able to forge metering.
-- ---------------------------------------------------------

drop policy if exists "usage_select_own" on public.usage;

create policy "usage_select_own"
on public.usage
for select
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- user_settings — full owner control (keyed by user_id).
-- ---------------------------------------------------------

drop policy if exists "user_settings_select_own" on public.user_settings;

create policy "user_settings_select_own"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "user_settings_insert_own" on public.user_settings;

create policy "user_settings_insert_own"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "user_settings_update_own" on public.user_settings;

create policy "user_settings_update_own"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- ---------------------------------------------------------
-- agents — full owner control.
-- ---------------------------------------------------------

drop policy if exists "agents_select_own" on public.agents;

create policy "agents_select_own"
on public.agents
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "agents_insert_own" on public.agents;

create policy "agents_insert_own"
on public.agents
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "agents_update_own" on public.agents;

create policy "agents_update_own"
on public.agents
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "agents_delete_own" on public.agents;

create policy "agents_delete_own"
on public.agents
for delete
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- agent_conversations — owner scoped via its own user_id column.
-- ---------------------------------------------------------

drop policy if exists "agent_conversations_select_own"
  on public.agent_conversations;

create policy "agent_conversations_select_own"
on public.agent_conversations
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "agent_conversations_insert_own"
  on public.agent_conversations;

create policy "agent_conversations_insert_own"
on public.agent_conversations
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "agent_conversations_update_own"
  on public.agent_conversations;

create policy "agent_conversations_update_own"
on public.agent_conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "agent_conversations_delete_own"
  on public.agent_conversations;

create policy "agent_conversations_delete_own"
on public.agent_conversations
for delete
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- agent_messages — no user_id column, so ownership is derived through
-- the parent conversation. `exists` keeps the check to a single indexed
-- lookup on agent_conversations.id.
-- ---------------------------------------------------------

drop policy if exists "agent_messages_select_via_conversation"
  on public.agent_messages;

create policy "agent_messages_select_via_conversation"
on public.agent_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.agent_conversations c
    where c.id = agent_messages.conversation_id
      and c.user_id = auth.uid()
  )
);


drop policy if exists "agent_messages_insert_via_conversation"
  on public.agent_messages;

create policy "agent_messages_insert_via_conversation"
on public.agent_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agent_conversations c
    where c.id = agent_messages.conversation_id
      and c.user_id = auth.uid()
  )
);


-- ---------------------------------------------------------
-- agent_tasks — owner scoped.
-- ---------------------------------------------------------

drop policy if exists "agent_tasks_select_own" on public.agent_tasks;

create policy "agent_tasks_select_own"
on public.agent_tasks
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "agent_tasks_insert_own" on public.agent_tasks;

create policy "agent_tasks_insert_own"
on public.agent_tasks
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "agent_tasks_update_own" on public.agent_tasks;

create policy "agent_tasks_update_own"
on public.agent_tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "agent_tasks_delete_own" on public.agent_tasks;

create policy "agent_tasks_delete_own"
on public.agent_tasks
for delete
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- agent_runs — read-only to the owner of the parent agent.
--
-- Runs are execution records written by trusted server code; a client
-- must not be able to forge run history or token/cost accounting.
-- ---------------------------------------------------------

drop policy if exists "agent_runs_select_via_agent" on public.agent_runs;

create policy "agent_runs_select_via_agent"
on public.agent_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.agents a
    where a.id = agent_runs.agent_id
      and a.user_id = auth.uid()
  )
);


-- ---------------------------------------------------------
-- chats — owner scoped.
--
-- `chats.user_id` is NULLABLE, so rows without an owner are invisible to
-- every non-service caller, which is the safe default.
-- ---------------------------------------------------------

drop policy if exists "chats_select_own" on public.chats;

create policy "chats_select_own"
on public.chats
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "chats_insert_own" on public.chats;

create policy "chats_insert_own"
on public.chats
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "chats_update_own" on public.chats;

create policy "chats_update_own"
on public.chats
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "chats_delete_own" on public.chats;

create policy "chats_delete_own"
on public.chats
for delete
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- conversations — owner scoped.
-- ---------------------------------------------------------

drop policy if exists "conversations_select_own" on public.conversations;

create policy "conversations_select_own"
on public.conversations
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "conversations_insert_own" on public.conversations;

create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "conversations_update_own" on public.conversations;

create policy "conversations_update_own"
on public.conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "conversations_delete_own" on public.conversations;

create policy "conversations_delete_own"
on public.conversations
for delete
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- messages — ownership is ambiguous by design: a row may hang off
-- `conversation_id`, off `chat_id`, or carry its own `user_id`, and all
-- three are nullable. The policy therefore accepts a row only when at
-- least one of those paths proves ownership, and denies when none does.
-- ---------------------------------------------------------

drop policy if exists "messages_select_own" on public.messages;

create policy "messages_select_own"
on public.messages
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chats ch
    where ch.id = messages.chat_id
      and ch.user_id = auth.uid()
  )
);


drop policy if exists "messages_insert_own" on public.messages;

create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chats ch
    where ch.id = messages.chat_id
      and ch.user_id = auth.uid()
  )
);


-- ---------------------------------------------------------
-- files — owner scoped.
-- ---------------------------------------------------------

drop policy if exists "files_select_own" on public.files;

create policy "files_select_own"
on public.files
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "files_insert_own" on public.files;

create policy "files_insert_own"
on public.files
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "files_delete_own" on public.files;

create policy "files_delete_own"
on public.files
for delete
to authenticated
using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- memories — full owner control.
-- ---------------------------------------------------------

drop policy if exists "memories_select_own" on public.memories;

create policy "memories_select_own"
on public.memories
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "memories_insert_own" on public.memories;

create policy "memories_insert_own"
on public.memories
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "memories_delete_own" on public.memories;

create policy "memories_delete_own"
on public.memories
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- 3. DELIBERATE DENY-ALL TABLES (§8.7)
--
-- These six have RLS enabled by 20260901154222 and no policies. That is
-- CORRECT and intentional: each is infrastructure written and read only
-- by trusted server code through the service role, which bypasses RLS.
-- Adding client-facing policies would widen access for no product
-- reason, so none are added here. The rationale is recorded in
-- DATABASE.md so the absence reads as a decision rather than an
-- oversight:
--
--   feature_flags               — deployment configuration
--   organization_feature_flags  — deployment configuration
--   rate_limit_events           — abuse-control telemetry; a client that
--                                 could read or write these could evade
--                                 the limits Phase 5 will enforce
--   webhook_deliveries          — delivery log containing provider
--                                 payloads
--   workflow_steps              — engine internals
--
-- `organization_invites` is the one case where a genuine product need
-- for client access is foreseeable (an invitee reading their own
-- invite). It is intentionally left deny-all here because the correct
-- predicate depends on the organization membership model that Phase 3
-- defines. Widening it now would mean guessing at that model.
--
-- No statements are emitted for these tables. This block is the record
-- of the decision.
-- =========================================================
