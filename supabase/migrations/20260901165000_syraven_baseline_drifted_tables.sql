-- =========================================================
-- SYRAVEN — Baseline for drifted tables
--
-- Phase 2 (see IMPLEMENTATION_PLAN.md).
--
-- PURPOSE
--
-- ARCHITECTURE_AUDIT.md §9.1: the live database contains 61 tables while
-- the migrations create only 48. The 13 tables below exist ONLY in the
-- hosted project — they were created by hand and were never captured in a
-- migration. Consequences: the database cannot be rebuilt from this
-- repository, there is no staging parity, and there is no disaster
-- recovery path. `profiles` holds all billing state and `usage` backs all
-- metering, so this is the highest-impact gap in the schema.
--
-- This migration brings them under version control.
--
--
-- ORDERING — THIS MIGRATION MUST RUN BEFORE 20260901165535
--
-- 20260901165535 creates `public.tasks` with:
--
--     agent_id uuid references public.agents(id) on delete set null
--
-- but NO migration ever created `public.agents` — it was one of the
-- drifted tables. That migration therefore FAILS on a fresh database
-- with "relation public.agents does not exist". It only ever succeeded
-- against the hosted project because `agents` had already been created
-- by hand there.
--
-- In other words the migration set was never reproducible, and the
-- failure was invisible precisely because nobody could rebuild the
-- database. This file is timestamped 20260901165000 — before
-- 20260901165535 — so that `agents` exists by the time `tasks`
-- references it. Do not renumber it later than that migration.
--
--
-- SAFETY
--
-- Every statement is ADDITIVE and IDEMPOTENT:
--   - `create table if not exists`     — no-op where the table exists
--   - `create index if not exists`     — no-op where the index exists
--   - no `drop`, `truncate`, `delete`, or `alter ... drop`
--
-- Applying this to the existing hosted database changes nothing.
-- Applying it to an empty database reproduces the 13 tables.
--
--
-- PROVENANCE — read this before trusting the definitions
--
-- Docker is not available in the environment where this was authored, so
-- `supabase db dump` and `supabase db reset` could not be run. The
-- definitions below were reconstructed from two READ-ONLY sources against
-- the live database:
--
--   1. The PostgREST OpenAPI description (`GET /rest/v1/` with
--      `Accept: application/openapi+json`) — gives column names, types,
--      nullability, defaults, primary keys, and foreign keys within the
--      `public` schema.
--
--   2. `supabase inspect db index-stats --linked` — gives real index
--      names and their column lists.
--
-- VERIFIED from the live database:
--   - column names, types, nullability, defaults
--   - primary keys
--   - foreign keys between public-schema tables
--   - index names and indexed columns
--
-- NOT VERIFIABLE through those interfaces, and therefore NOT asserted
-- here (see DATABASE.md, "Unverified schema elements"):
--   - foreign keys into `auth.users` (cross-schema FKs are invisible to
--     both PostgREST and the generated types)
--   - CHECK constraints
--   - triggers
--   - whether RLS is enabled per table, and any policy bodies
--
-- Rather than invent those, this migration omits them and DATABASE.md
-- records them as unverified. A later migration should reconcile against
-- a real `pg_dump` once one is available — see
-- supabase/SCHEMA_DUMP_INSTRUCTIONS.md.
--
-- Note on `user_id`: these columns are declared `uuid` WITHOUT a foreign
-- key to `auth.users`. That mirrors what could be verified, and it is
-- deliberately conservative: adding an FK that production does not have
-- would cause a fresh database to diverge from production and could
-- reject writes that production accepts. If the dump shows the FK exists,
-- add it in a follow-up migration.
-- =========================================================


-- =========================================================
-- profiles
--
-- Billing state of record. Read and written by
-- app/api/billing/webhook/route.ts and app/api/usage/route.ts.
--
-- `id` is the user id (matching auth.users.id) and is NOT defaulted,
-- which is consistent with rows being created per authenticated user.
-- =========================================================

create table if not exists public.profiles (
  id                        uuid primary key,

  plan                      text not null default 'free',
  subscription_status       text not null default 'inactive',

  stripe_customer_id        text,
  stripe_subscription_id    text,

  trial_started_at          timestamptz,
  trial_ends_at             timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists profiles_trial_ends_at_idx
  on public.profiles (trial_ends_at);


-- =========================================================
-- usage
--
-- Metering events. Read by app/api/usage/route.ts.
-- =========================================================

create table if not exists public.usage (
  id            uuid primary key default gen_random_uuid(),

  user_id       uuid not null,

  type          text not null,
  metadata      jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now()
);

create index if not exists usage_user_id_idx
  on public.usage (user_id);

create index if not exists usage_user_id_type_created_at_idx
  on public.usage (user_id, type, created_at);


-- =========================================================
-- user_settings
--
-- Per-user preferences. `user_id` is the primary key (one row per user).
-- =========================================================

create table if not exists public.user_settings (
  user_id           uuid primary key,

  memory_enabled    boolean not null default true,

  created_at        timestamptz not null default now()
);


-- =========================================================
-- agents
--
-- Legacy agent definitions. Read by app/api/agents/route.ts and
-- app/api/tasks/route.ts. Distinct from the `ai_agents` table created in
-- 20260901154640 — both exist in production and are NOT merged here.
-- =========================================================

create table if not exists public.agents (
  id                uuid primary key default gen_random_uuid(),

  user_id           uuid not null,

  name              text not null,
  description       text,
  system_prompt     text,

  model             text default 'default',
  avatar_url        text,

  status            text not null default 'active',
  visibility        text not null default 'private',

  configuration     jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_agents_user_id
  on public.agents (user_id);

create index if not exists idx_agents_status
  on public.agents (status);


-- =========================================================
-- agent_conversations
-- =========================================================

create table if not exists public.agent_conversations (
  id            uuid primary key default gen_random_uuid(),

  agent_id      uuid not null
                references public.agents (id)
                on delete cascade,

  user_id       uuid not null,

  title         text default 'Yeni Konuşma',

  metadata      jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_agent_conversations_agent_id
  on public.agent_conversations (agent_id);

create index if not exists idx_agent_conversations_user_id
  on public.agent_conversations (user_id);


-- =========================================================
-- agent_messages
-- =========================================================

create table if not exists public.agent_messages (
  id                uuid primary key default gen_random_uuid(),

  conversation_id   uuid not null
                    references public.agent_conversations (id)
                    on delete cascade,

  role              text not null,
  content           text not null,

  metadata          jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now()
);

create index if not exists idx_agent_messages_conversation_id
  on public.agent_messages (conversation_id);

create index if not exists idx_agent_messages_created_at
  on public.agent_messages (created_at);


-- =========================================================
-- agent_tasks
-- =========================================================

create table if not exists public.agent_tasks (
  id              uuid primary key default gen_random_uuid(),

  agent_id        uuid not null
                  references public.agents (id)
                  on delete cascade,

  user_id         uuid not null,

  title           text not null,
  description     text,

  status          text not null default 'pending',
  priority        integer not null default 0,

  input           jsonb not null default '{}'::jsonb,
  output          jsonb,
  error           text,

  started_at      timestamptz,
  completed_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_agent_tasks_agent_id
  on public.agent_tasks (agent_id);

create index if not exists idx_agent_tasks_user_id
  on public.agent_tasks (user_id);

create index if not exists idx_agent_tasks_status
  on public.agent_tasks (status);


-- =========================================================
-- agent_runs
-- =========================================================

create table if not exists public.agent_runs (
  id                uuid primary key default gen_random_uuid(),

  agent_id          uuid not null
                    references public.agents (id)
                    on delete cascade,

  task_id           uuid
                    references public.agent_tasks (id)
                    on delete set null,

  conversation_id   uuid
                    references public.agent_conversations (id)
                    on delete set null,

  status            text not null default 'queued',
  model             text,

  input_tokens      integer default 0,
  output_tokens     integer default 0,
  cost              numeric default 0,

  metadata          jsonb not null default '{}'::jsonb,
  error             text,

  started_at        timestamptz,
  completed_at      timestamptz,

  created_at        timestamptz not null default now()
);

create index if not exists idx_agent_runs_agent_id
  on public.agent_runs (agent_id);

create index if not exists idx_agent_runs_task_id
  on public.agent_runs (task_id);

create index if not exists idx_agent_runs_status
  on public.agent_runs (status);


-- =========================================================
-- chats
--
-- Legacy chat container. `user_id` and `created_at` are nullable in
-- production; that is preserved rather than tightened, so a rebuilt
-- database accepts exactly what production accepts.
-- =========================================================

create table if not exists public.chats (
  id            uuid primary key default gen_random_uuid(),

  user_id       uuid,

  title         text not null,

  created_at    timestamptz default now()
);


-- =========================================================
-- conversations
--
-- Newer chat container, used alongside `chats`.
-- =========================================================

create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),

  user_id       uuid not null,

  title         text not null default 'Yeni Sohbet',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at);


-- =========================================================
-- messages
--
-- Chat messages. Carries columns for BOTH containers (`chat_id` and
-- `conversation_id`), and both attachment representations (the three
-- flat attachment_* columns and the newer `attachment` jsonb). All are
-- nullable in production and are preserved as-is: this table is the one
-- with the largest live footprint (296 kB) and tightening it could
-- reject writes production currently accepts.
-- =========================================================

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),

  chat_id             uuid
                      references public.chats (id)
                      on delete cascade,

  conversation_id     uuid
                      references public.conversations (id)
                      on delete cascade,

  user_id             uuid,

  role                text not null,
  content             text not null,

  attachment_path     text,
  attachment_name     text,
  attachment_type     text,
  attachment          jsonb,

  created_at          timestamptz default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);


-- =========================================================
-- files
--
-- Uploaded file metadata. `storage_path` carries a UNIQUE constraint in
-- production (index `files_storage_path_key`), reproduced here.
-- =========================================================

create table if not exists public.files (
  id                uuid primary key default gen_random_uuid(),

  user_id           uuid not null,

  chat_id           uuid
                    references public.chats (id)
                    on delete cascade,

  name              text not null,
  original_name     text not null,
  mime_type         text,

  size              bigint not null default 0,

  storage_path      text not null,

  created_at        timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'files_storage_path_key'
      and conrelid = 'public.files'::regclass
  ) then
    alter table public.files
      add constraint files_storage_path_key unique (storage_path);
  end if;
end;
$$;

create index if not exists files_user_id_idx
  on public.files (user_id);

create index if not exists files_chat_id_idx
  on public.files (chat_id);

create index if not exists files_created_at_idx
  on public.files (created_at);


-- =========================================================
-- memories
--
-- Simple per-user memory store.
-- =========================================================

create table if not exists public.memories (
  id            uuid primary key default gen_random_uuid(),

  user_id       uuid not null,

  content       text not null,

  created_at    timestamptz not null default now()
);
