-- =========================================================
-- SYRAVEN — Canvas persistence
--
-- Final hardening pass.
--
--
-- PROBLEM
--
-- Canvas is a reachable, first-class feature: it is linked from the
-- desktop sidebar, the mobile nav, the command palette, universal
-- search and /apps. It has an editor with nodes, edges, drag, zoom, a
-- manual Save button and a 1.2s debounced autosave.
--
-- None of it persists. There is no canvas table at all.
--
--   GET  /api/canvas   returns a static service-status blob and ignores
--                      ?id= entirely, so every canvas opens empty as
--                      "Untitled Canvas"
--   PATCH /api/canvas  is not exported -- Next.js answers 405, and the
--                      autosave runs with silent=true, so the failure is
--                      invisible
--
-- The user draws a diagram, sees "saved", navigates away, and the work
-- is gone. POST /api/canvas exists but is an AI GENERATION endpoint
-- (it enforces usage and calls a provider); it was never a save path.
--
--
-- WHAT THIS ADDS
--
-- One table. Nodes and edges are stored as jsonb rather than as
-- separate node/edge tables: the editor loads and saves a whole canvas
-- as a single document, never a single node, so row-per-node would add
-- joins and write amplification for no query the product performs.
--
-- `title` is NOT NULL with a default so an autosave of an untouched
-- canvas cannot violate it.
--
--
-- AUTHORIZATION
--
-- Owner-scoped, matching public.knowledge and public.agents:
--
--   select / insert / update / delete   auth.uid() = user_id
--
-- `workspace_id` is nullable and references public.workspaces with
-- ON DELETE SET NULL, so deleting a workspace does not destroy a user's
-- canvases. It is deliberately NOT part of the policy: membership of a
-- workspace must not grant read access to another member's canvas.
-- Sharing is a product decision, not a side effect of this migration.
--
--
-- SAFETY
--
--   Additive        One CREATE TABLE plus its policies and indexes.
--   Idempotent      create table if not exists / drop policy if exists.
--   Data loss       None. No existing table is touched.
--   Reversible      drop table public.canvases;
-- =========================================================

create table if not exists public.canvases (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  workspace_id uuid references public.workspaces(id) on delete set null,

  title text not null default 'Untitled Canvas',

  description text,

  /*
    The editor's document. `nodes` and `edges` mirror the CanvasNode and
    CanvasEdge shapes in app/canvas/[id]/page.tsx.
  */
  nodes jsonb not null default '[]'::jsonb,

  edges jsonb not null default '[]'::jsonb,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

alter table public.canvases enable row level security;

/*
  A canvas is private to its owner. Four separate policies rather than
  one FOR ALL, so a future change to read semantics cannot silently
  widen the write path.
*/

drop policy if exists "canvases_select_own" on public.canvases;

create policy "canvases_select_own"
  on public.canvases
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "canvases_insert_own" on public.canvases;

create policy "canvases_insert_own"
  on public.canvases
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "canvases_update_own" on public.canvases;

create policy "canvases_update_own"
  on public.canvases
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "canvases_delete_own" on public.canvases;

create policy "canvases_delete_own"
  on public.canvases
  for delete
  to authenticated
  using (auth.uid() = user_id);

/*
  The listing query is "my canvases, most recently updated first".
*/
create index if not exists canvases_user_updated_idx
  on public.canvases (user_id, updated_at desc);

create index if not exists canvases_workspace_idx
  on public.canvases (workspace_id)
  where workspace_id is not null;

/*
  Matches the trigger used by the other application tables so
  `updated_at` cannot be back-dated by a client.
*/
drop trigger if exists set_canvases_updated_at on public.canvases;

create trigger set_canvases_updated_at
  before update on public.canvases
  for each row
  execute function public.set_updated_at();
