-- =========================================================
-- SYRAVEN MISSING APPLICATION TABLES
-- Knowledge, Notifications, Tasks + Project compatibility
-- =========================================================

-- Required extension
create extension if not exists "pgcrypto";

-- =========================================================
-- TEAMS
-- =========================================================

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid references auth.users(id) on delete cascade,

  workspace_id uuid references public.workspaces(id) on delete cascade,

  name text not null,

  slug text,

  description text,

  avatar_url text,

  metadata jsonb not null default '{}'::jsonb,

  settings jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create unique index if not exists teams_workspace_slug_unique
on public.teams(workspace_id, slug)
where slug is not null;

create index if not exists teams_owner_id_idx
on public.teams(owner_id);

create index if not exists teams_workspace_id_idx
on public.teams(workspace_id);
-- =========================================================
-- KNOWLEDGE
-- =========================================================

create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  workspace_id uuid references public.workspaces(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,

  title text not null,

  description text,

  content text,

  type text not null default 'document',

  status text not null default 'active',

  visibility text not null default 'private',

  source_url text,

  file_name text,

  file_path text,

  file_type text,

  file_size bigint,

  metadata jsonb not null default '{}'::jsonb,

  tags text[] not null default '{}',

  embedding jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists knowledge_user_id_idx
on public.knowledge(user_id);

create index if not exists knowledge_workspace_id_idx
on public.knowledge(workspace_id);

create index if not exists knowledge_project_id_idx
on public.knowledge(project_id);

create index if not exists knowledge_team_id_idx
on public.knowledge(team_id);

create index if not exists knowledge_status_idx
on public.knowledge(status);

create index if not exists knowledge_type_idx
on public.knowledge(type);

create index if not exists knowledge_created_at_idx
on public.knowledge(created_at desc);


-- =========================================================
-- NOTIFICATIONS
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  type text not null default 'info',

  priority text not null default 'normal',

  title text not null,

  message text not null,

  action_url text,

  action_label text,

  metadata jsonb not null default '{}'::jsonb,

  read boolean not null default false,

  read_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
on public.notifications(user_id);

create index if not exists notifications_read_idx
on public.notifications(read);

create index if not exists notifications_type_idx
on public.notifications(type);

create index if not exists notifications_priority_idx
on public.notifications(priority);

create index if not exists notifications_created_at_idx
on public.notifications(created_at desc);


-- =========================================================
-- TASKS
-- =========================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  project_id uuid references public.projects(id) on delete cascade,

  workspace_id uuid references public.workspaces(id) on delete cascade,

  agent_id uuid references public.agents(id) on delete set null,

  title text not null,

  description text,

  status text not null default 'pending',

  priority text not null default 'medium',

  due_date timestamptz,

  scheduled_at timestamptz,

  started_at timestamptz,

  completed_at timestamptz,

  tags text[] not null default '{}',

  metadata jsonb not null default '{}'::jsonb,

  result jsonb,

  error text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx
on public.tasks(user_id);

create index if not exists tasks_project_id_idx
on public.tasks(project_id);

create index if not exists tasks_workspace_id_idx
on public.tasks(workspace_id);

create index if not exists tasks_agent_id_idx
on public.tasks(agent_id);

create index if not exists tasks_status_idx
on public.tasks(status);

create index if not exists tasks_priority_idx
on public.tasks(priority);

create index if not exists tasks_due_date_idx
on public.tasks(due_date);


-- =========================================================
-- PROJECT COMPATIBILITY COLUMNS
-- =========================================================

alter table public.projects
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.projects
add column if not exists priority text default 'medium';

alter table public.projects
add column if not exists start_date timestamptz;

alter table public.projects
add column if not exists due_date timestamptz;

create index if not exists projects_user_id_idx
on public.projects(user_id);

create index if not exists projects_priority_idx
on public.projects(priority);


-- =========================================================
-- USAGE EVENTS
-- =========================================================

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  type text not null,

  period text not null default 'monthly',

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_id_idx
on public.usage_events(user_id);

create index if not exists usage_events_type_idx
on public.usage_events(type);

create index if not exists usage_events_period_idx
on public.usage_events(period);

create index if not exists usage_events_created_at_idx
on public.usage_events(created_at desc);


-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

drop trigger if exists set_knowledge_updated_at on public.knowledge;

create trigger set_knowledge_updated_at
before update on public.knowledge
for each row
execute function public.handle_updated_at();


drop trigger if exists set_notifications_updated_at on public.notifications;

create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute function public.handle_updated_at();


drop trigger if exists set_tasks_updated_at on public.tasks;

create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.handle_updated_at();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.knowledge enable row level security;

alter table public.notifications enable row level security;

alter table public.tasks enable row level security;


-- =========================================================
-- KNOWLEDGE POLICIES
-- =========================================================

drop policy if exists "knowledge_select_own" on public.knowledge;

create policy "knowledge_select_own"
on public.knowledge
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "knowledge_insert_own" on public.knowledge;

create policy "knowledge_insert_own"
on public.knowledge
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "knowledge_update_own" on public.knowledge;

create policy "knowledge_update_own"
on public.knowledge
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "knowledge_delete_own" on public.knowledge;

create policy "knowledge_delete_own"
on public.knowledge
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- NOTIFICATION POLICIES
-- =========================================================

drop policy if exists "notifications_select_own" on public.notifications;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "notifications_update_own" on public.notifications;

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "notifications_delete_own" on public.notifications;

create policy "notifications_delete_own"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- TASK POLICIES
-- =========================================================

drop policy if exists "tasks_select_own" on public.tasks;

create policy "tasks_select_own"
on public.tasks
for select
to authenticated
using (auth.uid() = user_id);


drop policy if exists "tasks_insert_own" on public.tasks;

create policy "tasks_insert_own"
on public.tasks
for insert
to authenticated
with check (auth.uid() = user_id);


drop policy if exists "tasks_update_own" on public.tasks;

create policy "tasks_update_own"
on public.tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


drop policy if exists "tasks_delete_own" on public.tasks;

create policy "tasks_delete_own"
on public.tasks
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- COMMENTS
-- =========================================================

comment on table public.knowledge is
'Syraven knowledge base documents and AI context sources';

comment on table public.notifications is
'Syraven user notification system';

comment on table public.tasks is
'Syraven tasks, automation jobs and agent executions';