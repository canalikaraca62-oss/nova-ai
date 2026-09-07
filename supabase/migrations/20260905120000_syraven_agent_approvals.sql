-- =========================================================
-- SYRAVEN — Human-in-the-loop approvals for high-risk agent actions
--
-- Phase 9 (see IMPLEMENTATION_PLAN.md, AGENT_ARCHITECTURE.md §10).
--
-- PROBLEM
--
-- Phase 9 made approval a SERVER-SIDE record rather than a request
-- field: `verifyApproval()` refuses anything that is not an approved
-- record matching the exact tool, user and tenant scope.
--
-- But there was nowhere to keep one. `agent_runs` cannot hold these:
-- its `agent_id` is `not null references public.agents(id)` and the
-- orchestration agents are code constants, not rows; it also has a
-- select-only RLS policy and no `user_id` column.
--
-- So `loadApprovals()` returns an empty map and EVERY high-risk step
-- stops at `awaiting_approval`. The control is correct and fails in the
-- safe direction — it is simply unusable.
--
-- This table is the missing store, and nothing more.
--
--
-- WHY A TABLE AND NOT A FLAG
--
-- The alternative — trusting `approved: true` from the request body —
-- is exactly the vulnerability Phase 9 removed (ARCHITECTURE_AUDIT.md
-- §14: risk was read from the client-supplied
-- `action.requiresConfirmation`). An approval is a statement a specific
-- human made, at a specific moment, about a specific action. Only a
-- server-side record can carry that.
--
--
-- SAFETY
--
-- Additive, idempotent, non-destructive:
--   - `create table if not exists`
--   - `create index if not exists`
--   - `drop policy if exists` + `create policy` (the established
--     re-application pattern from 20260904122000)
--   - no drop table, truncate, delete, or alter-drop
--   - no existing table, column, policy or function is modified
--
-- Applying to a database that already has the table is a no-op.
-- =========================================================


-- =========================================================
-- agent_approvals
--
-- One row per approval request for a high-risk agent action.
--
-- Column names mirror the `ApprovalRecord` interface in
-- lib/orchestration/execution.ts so the mapping stays obvious.
-- =========================================================

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),

  /*
    The execution this approval belongs to.

    `deriveExecutionKey()` — sha256 of the VERIFIED user id plus the
    request's semantic content. Text, not uuid, because it is a hash.
  */
  execution_key text not null,

  /*
    The user the approval was requested for, and who must therefore be
    the one to grant it.

    `on delete cascade`: a deleted user's pending approvals must not
    outlive them as grants nobody can be accountable for.
  */
  requested_for_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  /*
    Who actually decided, recorded separately from who was asked.

    Kept distinct so the two can be COMPARED rather than assumed equal —
    `verifyApproval()` requires both to equal the acting user, which is
    what stops a colleague's approval authorizing this caller.
  */
  decided_by_user_id uuid
    references auth.users(id)
    on delete set null,

  /* Server-side registry ids (lib/orchestration/registry.ts). */
  agent_id text not null,
  tool_id text not null,

  /*
    Risk at the time of the request, from the TOOL REGISTRY.

    Stored so the audit trail shows what the user was told they were
    approving, even if the tool's risk is later reclassified.
  */
  risk text not null
    check (risk in ('low', 'medium', 'high')),

  /*
    Human-readable statement of the effect, shown before deciding.
    Bounded: this is displayed to a person, not parsed.
  */
  effect text not null
    check (char_length(effect) <= 1000),

  /*
    Tenant scope. Nullable because an execution may be personal rather
    than workspace- or project-scoped.

    `verifyApproval()` compares BOTH against the attempt, so an approval
    issued in one workspace cannot be replayed in another.
  */
  organization_id uuid
    references public.organizations(id)
    on delete cascade,

  workspace_id uuid
    references public.workspaces(id)
    on delete cascade,

  project_id uuid
    references public.projects(id)
    on delete cascade,

  /*
    Lifecycle.

      pending  — awaiting a human decision
      approved — granted, not yet used
      rejected — refused
      expired  — TTL elapsed before a decision
      used     — consumed by an execution; see the replay note below
  */
  status text not null default 'pending'
    check (
      status in ('pending', 'approved', 'rejected', 'expired', 'used')
    ),

  created_at timestamptz not null default now(),
  decided_at timestamptz,

  /*
    Hard expiry, set by the application from APPROVAL_TTL_MS (15 min).

    An approval is a statement about a moment. One that never expires
    becomes a standing grant nobody remembers issuing.
  */
  expires_at timestamptz not null,

  /* -----------------------------------------------------------------
     CONSTRAINTS — the parts that must hold regardless of app code
     ----------------------------------------------------------------- */

  /*
    A decided approval must record WHO decided and WHEN.

    Without this, a row could read `status = 'approved'` with a null
    decider — an approval nobody made. `verifyApproval()` already
    rejects that case in code; this makes the malformed row
    unrepresentable in the first place.
  */
  constraint agent_approvals_decided_fields_present
    check (
      (status in ('pending', 'expired'))
      or (decided_by_user_id is not null and decided_at is not null)
    ),

  constraint agent_approvals_expires_after_created
    check (expires_at > created_at)
);


-- =========================================================
-- REPLAY PREVENTION
--
-- At most ONE live approval per (execution, tool, requested user).
--
-- A partial unique index over the non-terminal states means a second
-- pending/approved row for the same action cannot be created while one
-- is outstanding. Terminal rows (rejected/expired/used) are excluded so
-- the audit trail accumulates rather than being overwritten.
--
-- Consuming an approval is therefore a state change to 'used', and the
-- index makes issuing a fresh one for the same action a deliberate act
-- rather than something that can happen twice concurrently.
-- =========================================================

create unique index if not exists agent_approvals_live_unique_idx
  on public.agent_approvals (
    execution_key,
    tool_id,
    requested_for_user_id
  )
  where status in ('pending', 'approved');


-- Lookup path used by `loadApprovals()`: the caller's live approvals
-- for one execution.
create index if not exists agent_approvals_lookup_idx
  on public.agent_approvals (
    requested_for_user_id,
    execution_key,
    status
  );


-- Supports expiring stale rows.
create index if not exists agent_approvals_expires_at_idx
  on public.agent_approvals (expires_at)
  where status in ('pending', 'approved');


-- =========================================================
-- ROW LEVEL SECURITY
--
-- Defense in depth. The application already filters by the verified
-- session user; these policies mean a mistake there does not become a
-- cross-tenant disclosure or a forged grant.
--
-- The governing rule: a user may only ever see and decide approvals
-- addressed to THEM, and only within an organization they belong to.
-- =========================================================

alter table public.agent_approvals enable row level security;


-- ---------------------------------------------------------
-- SELECT — only your own approvals, only in your org
-- ---------------------------------------------------------

drop policy if exists "agent_approvals_select_own"
  on public.agent_approvals;

create policy "agent_approvals_select_own"
on public.agent_approvals
for select
to authenticated
using (
  auth.uid() = requested_for_user_id
  and (
    organization_id is null
    or public.is_organization_member(organization_id)
  )
);


-- ---------------------------------------------------------
-- INSERT — you may only request an approval FOR YOURSELF,
--          and only as 'pending'
--
-- The status restriction is the important half: without it a caller
-- could insert a row that is already 'approved' and self-grant a
-- high-risk action. Creating a request and deciding it are separated
-- at the database level, not only in application code.
-- ---------------------------------------------------------

drop policy if exists "agent_approvals_insert_own"
  on public.agent_approvals;

create policy "agent_approvals_insert_own"
on public.agent_approvals
for insert
to authenticated
with check (
  auth.uid() = requested_for_user_id
  and status = 'pending'
  and decided_by_user_id is null
  and (
    organization_id is null
    or public.is_organization_member(organization_id)
  )
);


-- ---------------------------------------------------------
-- UPDATE — you decide your own approvals, as yourself
--
-- `using` restricts WHICH rows may be updated; `with check` restricts
-- what they may become. Both are required: `using` alone would let a
-- user rewrite their own row to name someone else as the decider.
--
-- A row can only be decided while it is still pending, so a rejected
-- or used approval cannot be revived into a grant.
-- ---------------------------------------------------------

drop policy if exists "agent_approvals_update_own"
  on public.agent_approvals;

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
  and (
    decided_by_user_id is null
    or decided_by_user_id = auth.uid()
  )
);


-- ---------------------------------------------------------
-- DELETE — none.
--
-- No delete policy is created, so no authenticated caller may remove an
-- approval record. Approvals are an audit trail of who authorized a
-- destructive action; a user who could delete them could erase the
-- evidence of the grant they used.
-- ---------------------------------------------------------
