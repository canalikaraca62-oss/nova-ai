-- =========================================================
-- SYRAVEN ENTERPRISE CORE
-- Multi-tenant architecture
-- Organizations, memberships, projects, API keys,
-- audit logs, jobs, workflows and production infrastructure
-- =========================================================


-- =========================================================
-- EXTENSIONS
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================================================
-- ORGANIZATIONS
-- =========================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,

  description text,

  avatar_url text,

  website text,

  plan text not null default 'free'
    check (
      plan in (
        'free',
        'pro',
        'business',
        'enterprise'
      )
    ),

  status text not null default 'active'
    check (
      status in (
        'active',
        'suspended',
        'deleted'
      )
    ),

  owner_id uuid not null
    references auth.users(id)
    on delete restrict,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists organizations_owner_id_idx
on public.organizations(owner_id);


create index if not exists organizations_slug_idx
on public.organizations(slug);


-- =========================================================
-- ORGANIZATION MEMBERS
-- =========================================================

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member'
    check (
      role in (
        'owner',
        'admin',
        'manager',
        'member',
        'viewer'
      )
    ),

  status text not null default 'active'
    check (
      status in (
        'active',
        'invited',
        'suspended'
      )
    ),

  invited_by uuid
    references auth.users(id)
    on delete set null,

  joined_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    organization_id,
    user_id
  )
);


create index if not exists organization_members_user_id_idx
on public.organization_members(user_id);


create index if not exists organization_members_org_id_idx
on public.organization_members(organization_id);


-- =========================================================
-- ORGANIZATION INVITES
-- =========================================================

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  email text not null,

  role text not null default 'member'
    check (
      role in (
        'admin',
        'manager',
        'member',
        'viewer'
      )
    ),

  token uuid not null default gen_random_uuid()
    unique,

  invited_by uuid
    references auth.users(id)
    on delete set null,

  expires_at timestamptz not null
    default (
      now() + interval '7 days'
    ),

  accepted_at timestamptz,

  created_at timestamptz not null default now()
);


create index if not exists organization_invites_org_id_idx
on public.organization_invites(organization_id);


create index if not exists organization_invites_email_idx
on public.organization_invites(email);


-- =========================================================
-- WORKSPACES
-- =========================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  name text not null,

  slug text not null,

  description text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    organization_id,
    slug
  )
);


create index if not exists workspaces_organization_id_idx
on public.workspaces(organization_id);


-- =========================================================
-- PROJECTS
-- =========================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  workspace_id uuid
    references public.workspaces(id)
    on delete set null,

  owner_id uuid
    references auth.users(id)
    on delete set null,

  name text not null,

  slug text,

  description text,

  status text not null default 'active'
    check (
      status in (
        'draft',
        'active',
        'archived',
        'completed'
      )
    ),

  visibility text not null default 'private'
    check (
      visibility in (
        'private',
        'organization',
        'public'
      )
    ),

  settings jsonb not null default '{}'::jsonb,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists projects_organization_id_idx
on public.projects(organization_id);


create index if not exists projects_workspace_id_idx
on public.projects(workspace_id);


create index if not exists projects_owner_id_idx
on public.projects(owner_id);


-- =========================================================
-- PROJECT MEMBERS
-- =========================================================

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member'
    check (
      role in (
        'owner',
        'admin',
        'editor',
        'member',
        'viewer'
      )
    ),

  created_at timestamptz not null default now(),

  unique (
    project_id,
    user_id
  )
);


create index if not exists project_members_user_id_idx
on public.project_members(user_id);


-- =========================================================
-- API KEYS
-- =========================================================

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  user_id uuid
    references auth.users(id)
    on delete cascade,

  name text not null,

  key_prefix text not null,

  key_hash text not null unique,

  permissions jsonb not null
    default '[]'::jsonb,

  last_used_at timestamptz,

  expires_at timestamptz,

  revoked_at timestamptz,

  created_at timestamptz not null default now(),

  metadata jsonb not null
    default '{}'::jsonb
);


create index if not exists api_keys_organization_id_idx
on public.api_keys(organization_id);


create index if not exists api_keys_user_id_idx
on public.api_keys(user_id);


create index if not exists api_keys_key_prefix_idx
on public.api_keys(key_prefix);


-- =========================================================
-- AUDIT LOGS
-- =========================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id)
    on delete set null,

  workspace_id uuid
    references public.workspaces(id)
    on delete set null,

  user_id uuid
    references auth.users(id)
    on delete set null,

  action text not null,

  resource_type text,

  resource_id uuid,

  description text,

  ip_address inet,

  user_agent text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null default now()
);


create index if not exists audit_logs_org_created_idx
on public.audit_logs(
  organization_id,
  created_at desc
);


create index if not exists audit_logs_user_created_idx
on public.audit_logs(
  user_id,
  created_at desc
);


create index if not exists audit_logs_action_idx
on public.audit_logs(action);


create index if not exists audit_logs_resource_idx
on public.audit_logs(
  resource_type,
  resource_id
);


-- =========================================================
-- BACKGROUND JOBS
-- =========================================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  user_id uuid
    references auth.users(id)
    on delete set null,

  type text not null,

  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled',
        'retrying'
      )
    ),

  priority integer not null default 0,

  payload jsonb not null
    default '{}'::jsonb,

  result jsonb,

  error jsonb,

  attempts integer not null default 0,

  max_attempts integer not null default 3,

  scheduled_for timestamptz,

  started_at timestamptz,

  completed_at timestamptz,

  locked_at timestamptz,

  locked_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists jobs_queue_idx
on public.jobs(
  status,
  priority desc,
  scheduled_for asc
);


create index if not exists jobs_org_id_idx
on public.jobs(organization_id);


create index if not exists jobs_type_idx
on public.jobs(type);


-- =========================================================
-- WORKFLOWS
-- =========================================================

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  workspace_id uuid
    references public.workspaces(id)
    on delete set null,

  created_by uuid
    references auth.users(id)
    on delete set null,

  name text not null,

  description text,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'active',
        'paused',
        'archived'
      )
    ),

  definition jsonb not null
    default '{}'::jsonb,

  settings jsonb not null
    default '{}'::jsonb,

  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists workflows_org_id_idx
on public.workflows(organization_id);


-- =========================================================
-- WORKFLOW RUNS
-- =========================================================

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),

  workflow_id uuid not null
    references public.workflows(id)
    on delete cascade,

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  triggered_by uuid
    references auth.users(id)
    on delete set null,

  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  input jsonb not null
    default '{}'::jsonb,

  output jsonb,

  error jsonb,

  started_at timestamptz,

  completed_at timestamptz,

  created_at timestamptz not null default now()
);


create index if not exists workflow_runs_workflow_id_idx
on public.workflow_runs(workflow_id);


create index if not exists workflow_runs_org_created_idx
on public.workflow_runs(
  organization_id,
  created_at desc
);


-- =========================================================
-- WORKFLOW STEPS
-- =========================================================

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),

  workflow_id uuid not null
    references public.workflows(id)
    on delete cascade,

  name text not null,

  step_type text not null,

  position integer not null,

  configuration jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    workflow_id,
    position
  )
);


create index if not exists workflow_steps_workflow_idx
on public.workflow_steps(workflow_id);


-- =========================================================
-- WEBHOOK ENDPOINTS
-- =========================================================

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  created_by uuid
    references auth.users(id)
    on delete set null,

  name text not null,

  url text not null,

  secret_hash text,

  events jsonb not null
    default '[]'::jsonb,

  status text not null default 'active'
    check (
      status in (
        'active',
        'disabled'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists webhook_endpoints_org_id_idx
on public.webhook_endpoints(organization_id);


-- =========================================================
-- WEBHOOK DELIVERIES
-- =========================================================

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),

  webhook_endpoint_id uuid not null
    references public.webhook_endpoints(id)
    on delete cascade,

  event text not null,

  payload jsonb not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'delivered',
        'failed'
      )
    ),

  response_status integer,

  response_body text,

  attempts integer not null default 0,

  delivered_at timestamptz,

  created_at timestamptz not null default now()
);


create index if not exists webhook_deliveries_endpoint_idx
on public.webhook_deliveries(webhook_endpoint_id);


-- =========================================================
-- FEATURE FLAGS
-- =========================================================

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),

  key text not null unique,

  name text not null,

  description text,

  enabled boolean not null default false,

  rollout_percentage integer not null default 0
    check (
      rollout_percentage >= 0
      and rollout_percentage <= 100
    ),

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- ORGANIZATION FEATURE FLAGS
-- =========================================================

create table if not exists public.organization_feature_flags (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  feature_flag_id uuid not null
    references public.feature_flags(id)
    on delete cascade,

  enabled boolean not null default true,

  created_at timestamptz not null default now(),

  unique (
    organization_id,
    feature_flag_id
  )
);


-- =========================================================
-- RATE LIMIT TRACKING
-- =========================================================

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,

  user_id uuid
    references auth.users(id)
    on delete cascade,

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  endpoint text not null,

  created_at timestamptz not null default now()
);


create index if not exists rate_limit_events_lookup_idx
on public.rate_limit_events(
  user_id,
  endpoint,
  created_at desc
);


-- =========================================================
-- SYSTEM EVENTS
-- =========================================================

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),

  event_type text not null,

  source text,

  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  user_id uuid
    references auth.users(id)
    on delete set null,

  payload jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null default now()
);


create index if not exists system_events_type_created_idx
on public.system_events(
  event_type,
  created_at desc
);


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

drop trigger if exists organizations_updated_at
on public.organizations;

create trigger organizations_updated_at
before update
on public.organizations
for each row
execute function public.handle_updated_at();


drop trigger if exists organization_members_updated_at
on public.organization_members;

create trigger organization_members_updated_at
before update
on public.organization_members
for each row
execute function public.handle_updated_at();


drop trigger if exists workspaces_updated_at
on public.workspaces;

create trigger workspaces_updated_at
before update
on public.workspaces
for each row
execute function public.handle_updated_at();


drop trigger if exists projects_updated_at
on public.projects;

create trigger projects_updated_at
before update
on public.projects
for each row
execute function public.handle_updated_at();


drop trigger if exists jobs_updated_at
on public.jobs;

create trigger jobs_updated_at
before update
on public.jobs
for each row
execute function public.handle_updated_at();


drop trigger if exists workflows_updated_at
on public.workflows;

create trigger workflows_updated_at
before update
on public.workflows
for each row
execute function public.handle_updated_at();


drop trigger if exists workflow_steps_updated_at
on public.workflow_steps;

create trigger workflow_steps_updated_at
before update
on public.workflow_steps
for each row
execute function public.handle_updated_at();


drop trigger if exists webhook_endpoints_updated_at
on public.webhook_endpoints;

create trigger webhook_endpoints_updated_at
before update
on public.webhook_endpoints
for each row
execute function public.handle_updated_at();


drop trigger if exists feature_flags_updated_at
on public.feature_flags;

create trigger feature_flags_updated_at
before update
on public.feature_flags
for each row
execute function public.handle_updated_at();


-- =========================================================
-- HELPER: CHECK ORGANIZATION MEMBERSHIP
-- =========================================================

create or replace function public.is_organization_member(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
    and user_id = auth.uid()
    and status = 'active'
  );
$$;


-- =========================================================
-- HELPER: CHECK ORGANIZATION ADMIN
-- =========================================================

create or replace function public.is_organization_admin(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
    and user_id = auth.uid()
    and status = 'active'
    and role in (
      'owner',
      'admin'
    )
  );
$$;


-- =========================================================
-- HELPER: CHECK ORGANIZATION OWNER
-- =========================================================

create or replace function public.is_organization_owner(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
    and user_id = auth.uid()
    and status = 'active'
    and role = 'owner'
  );
$$;


-- =========================================================
-- ENABLE ROW LEVEL SECURITY
-- =========================================================

alter table public.organizations
enable row level security;

alter table public.organization_members
enable row level security;

alter table public.organization_invites
enable row level security;

alter table public.workspaces
enable row level security;

alter table public.projects
enable row level security;

alter table public.project_members
enable row level security;

alter table public.api_keys
enable row level security;

alter table public.audit_logs
enable row level security;

alter table public.jobs
enable row level security;

alter table public.workflows
enable row level security;

alter table public.workflow_runs
enable row level security;

alter table public.workflow_steps
enable row level security;

alter table public.webhook_endpoints
enable row level security;

alter table public.webhook_deliveries
enable row level security;

alter table public.feature_flags
enable row level security;

alter table public.organization_feature_flags
enable row level security;

alter table public.rate_limit_events
enable row level security;

alter table public.system_events
enable row level security;


-- =========================================================
-- ORGANIZATIONS POLICIES
-- =========================================================

create policy "organization members can view organizations"
on public.organizations
for select
to authenticated
using (
  public.is_organization_member(id)
  or owner_id = auth.uid()
);


create policy "authenticated users can create organizations"
on public.organizations
for insert
to authenticated
with check (
  owner_id = auth.uid()
);


create policy "organization admins can update organizations"
on public.organizations
for update
to authenticated
using (
  public.is_organization_admin(id)
  or owner_id = auth.uid()
)
with check (
  public.is_organization_admin(id)
  or owner_id = auth.uid()
);


create policy "organization owners can delete organizations"
on public.organizations
for delete
to authenticated
using (
  owner_id = auth.uid()
);


-- =========================================================
-- ORGANIZATION MEMBERS POLICIES
-- =========================================================

create policy "members can view organization members"
on public.organization_members
for select
to authenticated
using (
  public.is_organization_member(
    organization_id
  )
);


create policy "admins can manage organization members"
on public.organization_members
for all
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
)
with check (
  public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- WORKSPACES POLICIES
-- =========================================================

create policy "organization members can view workspaces"
on public.workspaces
for select
to authenticated
using (
  public.is_organization_member(
    organization_id
  )
);


create policy "organization members can create workspaces"
on public.workspaces
for insert
to authenticated
with check (
  public.is_organization_member(
    organization_id
  )
);


create policy "organization admins can update workspaces"
on public.workspaces
for update
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
)
with check (
  public.is_organization_admin(
    organization_id
  )
);


create policy "organization admins can delete workspaces"
on public.workspaces
for delete
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- PROJECT POLICIES
-- =========================================================

create policy "users can view accessible projects"
on public.projects
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_organization_member(
    organization_id
  )
  or visibility = 'public'
);


create policy "users can create projects"
on public.projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
);


create policy "owners and admins can update projects"
on public.projects
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.is_organization_admin(
    organization_id
  )
)
with check (
  owner_id = auth.uid()
  or public.is_organization_admin(
    organization_id
  )
);


create policy "owners and admins can delete projects"
on public.projects
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- PROJECT MEMBERS POLICIES
-- =========================================================

create policy "project members can view members"
on public.project_members
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id =
      project_members.project_id
    and (
      projects.owner_id = auth.uid()
      or public.is_organization_member(
        projects.organization_id
      )
    )
  )
);


-- =========================================================
-- API KEY POLICIES
-- =========================================================

create policy "users can view own api keys"
on public.api_keys
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_organization_admin(
    organization_id
  )
);


create policy "users can create own api keys"
on public.api_keys
for insert
to authenticated
with check (
  user_id = auth.uid()
);


create policy "users can revoke own api keys"
on public.api_keys
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- AUDIT LOG POLICIES
-- =========================================================

create policy "organization admins can view audit logs"
on public.audit_logs
for select
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- JOB POLICIES
-- =========================================================

create policy "users can view organization jobs"
on public.jobs
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_organization_member(
    organization_id
  )
);


create policy "users can create own jobs"
on public.jobs
for insert
to authenticated
with check (
  user_id = auth.uid()
);


-- =========================================================
-- WORKFLOW POLICIES
-- =========================================================

create policy "organization members can view workflows"
on public.workflows
for select
to authenticated
using (
  public.is_organization_member(
    organization_id
  )
);


create policy "organization members can create workflows"
on public.workflows
for insert
to authenticated
with check (
  public.is_organization_member(
    organization_id
  )
);


create policy "organization admins can manage workflows"
on public.workflows
for update
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
)
with check (
  public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- WORKFLOW RUN POLICIES
-- =========================================================

create policy "organization members can view workflow runs"
on public.workflow_runs
for select
to authenticated
using (
  public.is_organization_member(
    organization_id
  )
);


create policy "organization members can create workflow runs"
on public.workflow_runs
for insert
to authenticated
with check (
  public.is_organization_member(
    organization_id
  )
);


-- =========================================================
-- WEBHOOK POLICIES
-- =========================================================

create policy "organization admins can view webhooks"
on public.webhook_endpoints
for select
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
);


create policy "organization admins can manage webhooks"
on public.webhook_endpoints
for all
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
)
with check (
  public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- SYSTEM EVENT POLICIES
-- =========================================================

create policy "organization admins can view system events"
on public.system_events
for select
to authenticated
using (
  public.is_organization_admin(
    organization_id
  )
);


-- =========================================================
-- REALTIME
-- =========================================================

alter publication supabase_realtime
add table public.jobs;

alter publication supabase_realtime
add table public.workflow_runs;

alter publication supabase_realtime
add table public.system_events;


-- =========================================================
-- COMMENTS
-- =========================================================

comment on table public.organizations is
'Syraven multi-tenant organization layer';

comment on table public.organization_members is
'Organization membership and RBAC';

comment on table public.workspaces is
'Organization workspaces';

comment on table public.projects is
'Projects belonging to users and organizations';

comment on table public.api_keys is
'Hashed API credentials';

comment on table public.audit_logs is
'Immutable security and activity audit trail';

comment on table public.jobs is
'Background job execution queue';

comment on table public.workflows is
'AI and automation workflow definitions';

comment on table public.workflow_runs is
'Workflow execution history';

comment on table public.system_events is
'Platform-wide internal event stream';