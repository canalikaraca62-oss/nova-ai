-- =========================================================
-- SYRAVEN — Membership fortress (Phase 3, Batch 1)
--
-- STATUS: WRITTEN, NOT APPLIED. The founder applies it: TEST first,
-- then PRODUCTION. Evidence: docs/engineering/SECURITY_EVIDENCE.md.
--
--
-- THREAT (P1-1)
--
-- "admins can manage organization members" (20260901154222) is FOR ALL
-- with USING / WITH CHECK only is_organization_admin(organization_id).
-- An organization admin could therefore insert ANY user into their
-- organization with ANY role, give anyone the owner role, and rewrite
-- owner rows. With that membership, a victim's next workspace could be
-- created in the attacker's organization (the route took an arbitrary
-- membership), and deleting that workspace — or the organization above
-- it — cascaded into the victim's tasks, teams and approvals and
-- detached their knowledge, canvases and projects. RLS does not apply to
-- foreign-key cascades.
--
-- Separately, "organization admins can update organizations" has no
-- column limit, so an admin could reassign organizations.owner_id.
--
--
-- INVARIANTS ENFORCED HERE
--
--   I1  A client INSERT can create only the caller's own membership in
--       an organization the caller owns. The only INSERT policy left is
--       "owners can create their own membership" (20260907120000).
--   I2  An admin cannot change a membership's organization_id or user_id
--       (column privileges), cannot grant owner (WITH CHECK) and cannot
--       touch an owner row (USING). No ownership transfer through UPDATE.
--   I3  An admin manages non-owner memberships only: role admin, manager,
--       member or viewer; status active or suspended.
--   I4  No client can delete an owner membership. A non-owner may leave;
--       an admin may remove non-owners.
--   I6  organizations.owner_id is not updatable by clients. Only that
--       column loses UPDATE; plan and status are left for Batch 4.
--   I7  A workspace delete — direct, or cascaded from an organization
--       delete — is refused while it holds a row owned by anyone other
--       than the deleting user. Ambiguous ownership (a NULL owner, a
--       projects row whose user_id and owner_id disagree, or no
--       signed-in actor) is refused. Nothing is detached or modified.
--
--   (I5, owner-bound workspace resolution, is in app/api/workspaces.)
--
--
-- NOT CHANGED
--
--   The owner self-membership policy (20260907120000), every SELECT
--   policy, the workspaces and organizations INSERT/DELETE policies,
--   service_role privileges (registration provisions through it), and
--   every applied migration.
--
--
-- SAFETY
--
--   Additive      New policies, a trigger function and a trigger; one
--                 policy dropped; privileges narrowed. No table, column or
--                 row is created, altered or removed.
--   Idempotent    drop ... if exists before every create; create or
--                 replace for the function.
--   Reversible    drop the two new policies; re-create "admins can manage
--                 organization members" exactly as in 20260901154222;
--                 grant insert, update on public.organization_members and
--                 update on public.organizations to authenticated; drop
--                 trigger workspaces_refuse_foreign_data_delete and the
--                 function refuse_workspace_delete_with_foreign_data().
-- =========================================================


-- =========================================================
-- 1. organization_members — remove the admin FOR ALL policy
-- =========================================================

drop policy if exists "admins can manage organization members"
  on public.organization_members;


-- =========================================================
-- 2. organization_members — UPDATE: non-owner rows, non-owner roles
-- =========================================================

drop policy if exists "admins can update non-owner memberships"
  on public.organization_members;

create policy "admins can update non-owner memberships"
  on public.organization_members
  for update
  to authenticated
  using (
    public.is_organization_admin(organization_id)
    and role <> 'owner'
  )
  with check (
    public.is_organization_admin(organization_id)
    and role in ('admin', 'manager', 'member', 'viewer')
    and status in ('active', 'suspended')
  );


-- =========================================================
-- 3. organization_members — DELETE: never an owner row
-- =========================================================

drop policy if exists "members leave and admins remove non-owner members"
  on public.organization_members;

create policy "members leave and admins remove non-owner members"
  on public.organization_members
  for delete
  to authenticated
  using (
    role <> 'owner'
    and (
      user_id = auth.uid()
      or public.is_organization_admin(organization_id)
    )
  );


-- =========================================================
-- 4. organization_members — column privileges
--
-- The route's self-membership insert names organization_id, user_id,
-- role and status. Registration uses service_role and is unaffected.
-- A client may update role and status only, so organization_id and
-- user_id cannot be moved.
-- =========================================================

revoke insert, update on table public.organization_members
  from anon, authenticated;

grant insert (organization_id, user_id, role, status, joined_at)
  on table public.organization_members
  to authenticated;

grant update (role, status)
  on table public.organization_members
  to authenticated;


-- =========================================================
-- 5. organizations — owner_id is not client-updatable
--
-- Every other column keeps exactly the UPDATE it had.
-- =========================================================

revoke update on table public.organizations
  from anon, authenticated;

grant update (
  id,
  name,
  slug,
  description,
  avatar_url,
  website,
  plan,
  status,
  metadata,
  created_at,
  updated_at
)
  on table public.organizations
  to authenticated;


-- =========================================================
-- 6. Workspace destructive-delete guard
--
-- BEFORE DELETE, FOR EACH ROW: fires for a direct delete and for every
-- workspace removed by the organizations -> workspaces cascade.
--
-- SECURITY DEFINER so the check sees every user's rows (no table forces
-- RLS); search_path pinned; takes no input except old.id and auth.uid().
-- It only refuses: it never deletes, detaches or modifies a child row.
--
-- Covered: tasks and teams and agent_approvals (cascade), knowledge and
-- canvases and projects (set null). Not covered, by design: audit_logs
-- and workflows (organization records, not user data), and
-- integration_connections (migration not applied; Batch 9 must extend
-- this guard before that table exists).
-- =========================================================

create or replace function public.refuse_workspace_delete_with_foreign_data()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  if exists (
       select 1
       from public.tasks t
       where t.workspace_id = old.id
         and (actor is null or t.user_id is distinct from actor)
     )
     or exists (
       select 1
       from public.teams tm
       where tm.workspace_id = old.id
         and (actor is null or tm.owner_id is distinct from actor)
     )
     or exists (
       select 1
       from public.knowledge k
       where k.workspace_id = old.id
         and (actor is null or k.user_id is distinct from actor)
     )
     or exists (
       select 1
       from public.canvases c
       where c.workspace_id = old.id
         and (actor is null or c.user_id is distinct from actor)
     )
     or exists (
       select 1
       from public.projects p
       where p.workspace_id = old.id
         and (
           actor is null
           or p.user_id is distinct from actor
           or p.owner_id is distinct from actor
         )
     )
     or exists (
       select 1
       from public.agent_approvals a
       where a.workspace_id = old.id
         and (actor is null or a.requested_for_user_id is distinct from actor)
     )
  then
    raise exception 'This workspace cannot be removed while it holds data that belongs to another account.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

revoke all on function public.refuse_workspace_delete_with_foreign_data()
  from public, anon, authenticated;

drop trigger if exists workspaces_refuse_foreign_data_delete
  on public.workspaces;

create trigger workspaces_refuse_foreign_data_delete
  before delete on public.workspaces
  for each row
  execute function public.refuse_workspace_delete_with_foreign_data();
