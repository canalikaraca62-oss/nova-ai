-- =========================================================
-- SYRAVEN — Integration connections
--
-- NOT YET APPLIED. Awaiting explicit approval.
--
--
-- PROBLEM
--
-- services/integrations/ holds roughly 5,850 lines of real API clients
-- -- Gmail, Google Calendar, GitHub, Slack, Notion -- that call the
-- genuine REST endpoints of those services. Nothing imports them. No
-- route, no orchestration tool, no UI, and no table in which a
-- credential could live.
--
-- So the product's central promise, "give SYRAVEN the goal, it runs the
-- work", stops at the boundary of SYRAVEN itself. The orchestrator has
-- six tools, all internal (knowledge and task CRUD). It cannot send an
-- email because there is nowhere to keep the token that would let it,
-- and no way to ask whether the user has connected an account.
--
-- The missing piece was never the HTTP calls. It is this table.
--
--
-- WHAT THIS ADDS
--
-- One table recording that a user has connected an account with a
-- provider, what that connection is permitted to do, and whether it is
-- still usable.
--
--
-- CREDENTIALS ARE NOT STORED HERE
--
-- This is the load-bearing decision in the migration, so it is stated
-- plainly: there is no access_token column and no refresh_token column.
--
-- A refresh token is a long-lived bearer credential for somebody's real
-- mailbox. Postgres RLS protects a row from other TENANTS; it does not
-- protect it from a SQL injection in any route that reaches this table,
-- from a database backup, from a support engineer with read access, or
-- from a logged query plan. A table that is safe against the tenant
-- next door is not the same as a table that is safe to put mail
-- credentials in.
--
-- `credential_ref` therefore holds an OPAQUE POINTER into a secret
-- store, never the secret. The pointer is useless on its own: it names
-- a location that requires separate authentication to read. Choosing
-- that store is a deployment decision, not a schema one, so this
-- migration does not presume it.
--
-- What IS stored here is the metadata needed to make decisions without
-- ever touching the secret: which provider, whose it is, whether it is
-- active, when it expires, and which scopes were actually granted.
-- lib/integrations/capabilities.ts answers "can SYRAVEN do X for this
-- user" entirely from these columns.
--
--
-- WHY granted_scopes IS RECORDED
--
-- Connecting an account is not the same as granting everything the
-- product might one day want from it. A user may connect Gmail for
-- reading and refuse send. Without the granted set, the only way to
-- discover that is to attempt the send and read the provider's 403 --
-- which means finding out at the moment of the side effect, having
-- already told the user it was under way.
--
--
-- AUTHORIZATION
--
-- Owner-scoped, matching public.canvases and public.knowledge:
--
--   select / insert / update / delete   auth.uid() = user_id
--
-- `workspace_id` is nullable and deliberately NOT part of any policy.
-- Being a member of a workspace must not grant use of another member's
-- mailbox. Shared, org-level connections are a real product need and a
-- genuinely harder consent question; they are out of scope here rather
-- than smuggled in as a side effect.
--
-- The UNIQUE constraint is on (user_id, provider, external_account_id),
-- so one person may connect two different Gmail accounts, but cannot
-- accumulate duplicate rows for the same one -- which would make
-- "is this connected?" ambiguous and revocation unreliable.
--
--
-- SAFETY
--
--   Additive        One CREATE TABLE plus its policies and indexes.
--   Idempotent      create table if not exists / drop policy if exists.
--   Data loss       None. No existing table is touched.
--   Reversible      drop table public.integration_connections;
--   Backfill        None required. An empty table means "nobody has
--                   connected anything", which is the truthful state.
-- =========================================================

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  -- Nullable, and not part of any policy. See AUTHORIZATION above.
  workspace_id uuid
    references public.workspaces(id)
    on delete set null,

  -- Mirrors IntegrationProvider in services/integrations/types.ts.
  -- Constrained rather than free text so an unrecognised provider
  -- cannot be written and then silently mishandled at read time.
  provider text not null
    check (
      provider in (
        'gmail',
        'calendar',
        'github',
        'slack',
        'notion'
      )
    ),

  -- Mirrors IntegrationStatus. Only 'active' permits a capability;
  -- every other value fails closed in resolveAvailability().
  status text not null default 'pending'
    check (
      status in (
        'active',
        'inactive',
        'expired',
        'revoked',
        'error',
        'pending'
      )
    ),

  auth_type text not null default 'oauth2'
    check (
      auth_type in (
        'oauth2',
        'api_key',
        'personal_access_token',
        'bot_token',
        'service_account',
        'custom'
      )
    ),

  -- OPAQUE POINTER into a secret store. Never a token. See above.
  credential_ref text,

  -- Which account this is, so a user with two mailboxes can tell them
  -- apart, and so revocation targets the right one.
  external_account_id text,
  external_account_email text,

  display_name text,

  -- What the provider actually granted, not what was requested.
  granted_scopes text[] not null default '{}',

  -- NULL means the credential does not expire. A non-null value in the
  -- past fails closed.
  expires_at timestamptz,

  last_used_at timestamptz,

  -- Last failure, for showing connection health. Must never carry a
  -- provider response body: those can echo the request, including
  -- headers.
  last_error text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per account per provider per user. See AUTHORIZATION.
  constraint integration_connections_unique_account
    unique (user_id, provider, external_account_id)
);


create index if not exists integration_connections_user_id_idx
on public.integration_connections(user_id);

-- Serves the hot path: "does this user have an active connection for
-- this provider?", asked before every capability check.
create index if not exists integration_connections_user_provider_idx
on public.integration_connections(user_id, provider, status);

create index if not exists integration_connections_workspace_id_idx
on public.integration_connections(workspace_id);


-- =========================================================
-- ROW LEVEL SECURITY
--
-- Enabled BEFORE any policy exists, so there is no window in which the
-- table is readable by the anon role.
-- =========================================================

alter table public.integration_connections
  enable row level security;


drop policy if exists "integration_connections_select_own"
  on public.integration_connections;

create policy "integration_connections_select_own"
on public.integration_connections
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "integration_connections_insert_own"
  on public.integration_connections;

create policy "integration_connections_insert_own"
on public.integration_connections
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "integration_connections_update_own"
  on public.integration_connections;

create policy "integration_connections_update_own"
on public.integration_connections
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "integration_connections_delete_own"
  on public.integration_connections;

-- Disconnecting must always be possible. A user who cannot delete a
-- connection cannot withdraw access to their own mailbox.
create policy "integration_connections_delete_own"
on public.integration_connections
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- GRANTS
--
-- The anon role is granted nothing. An unauthenticated caller has no
-- business knowing that a connection exists, let alone for whom.
-- =========================================================

revoke all on public.integration_connections from anon;

grant select, insert, update, delete
on public.integration_connections
to authenticated;
