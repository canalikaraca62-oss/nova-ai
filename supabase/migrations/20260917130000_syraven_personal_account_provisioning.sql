-- =========================================================
-- SYRAVEN — Atomic personal-account provisioning (Phase 3, Batch 2-B)
--
-- STATUS: WRITTEN. TEST first; PRODUCTION only with explicit founder
-- approval. Evidence: docs/engineering/SECURITY_EVIDENCE.md.
--
--
-- PROBLEM (P2-B2-2, P2-B2-3)
--
-- Two application paths create an organization, each in several
-- non-atomic steps:
--
--   app/api/auth/register/route.ts   service role, org + membership +
--                                    workspace + audit, best-effort
--                                    compensating deletes
--   app/api/workspaces/route.ts      caller's client, org + membership,
--                                    rollback that can itself fail
--
-- A failure between steps leaves an organization its owner cannot use,
-- two concurrent calls can create two organizations, and the two paths
-- disagree on what they create.
--
--
-- WHAT THIS ADDS
--
-- public.provision_personal_account() — the single provisioning
-- authority. It takes no arguments: the only identity is auth.uid().
-- In one transaction it returns the caller's personal organization and
-- workspace, creating whatever is missing.
--
-- Callers are switched to it in Batch 2-D. Nothing calls it yet; the
-- application flow is unchanged by this migration.
--
--
-- INVARIANTS
--
--   P1  No parameters. Identity is auth.uid() and nothing else; no
--       request header, JWT claim other than sub, or metadata is read.
--   P2  auth.uid() NULL is refused (42501) before any read or write.
--   P3  The caller's auth.users row must have email_confirmed_at set;
--       otherwise refused (42501) before any lock or write. A missing
--       row is refused the same way.
--   P4  A per-user transaction advisory lock serializes concurrent calls
--       for the same user before the existence check, so two calls
--       cannot both create.
--   P5  An existing organization is recognised by the Batch 1 ownership
--       rule (app/api/workspaces resolveOrganizationId): an ACTIVE OWNER
--       membership of the caller in an organization whose owner_id is
--       the caller; the oldest such membership wins. Nothing else — a
--       non-owner or suspended membership, or an owner_id without the
--       membership — is treated as the caller's organization.
--   P6  owner_id, membership user_id and workspace created_by are the
--       caller. Role is 'owner', status 'active'.
--   P7  Idempotent: once provisioned, further calls return the same
--       organization and workspace and write nothing, including no
--       audit row.
--   P8  Atomic: organization, owner membership, default workspace and
--       audit row commit together or not at all.
--   P9  Only authenticated may execute. public, anon and service_role
--       are revoked (service_role has no auth.uid() and must not call
--       this).
--
--
-- DESIGN NOTES
--
--   SECURITY DEFINER   The inserts bypass RLS. P1/P6 are what keep them
--                      bound to the caller; they are pinned by tests.
--   search_path = ''   Every relation and built-in is schema-qualified.
--   Workspace          The organization's oldest workspace is returned.
--                      An owned organization with no workspace gets the
--                      default one (this is completion, not a duplicate).
--   Organization slug  'personal-' + 16 random hex characters, unique by
--                      constraint. Not derived from the user id, so no
--                      other account can pre-claim it.
--   Audit              Written only when something was created.
--
--
-- NOT DONE HERE
--
--   No change to register, login or /api/workspaces (Batch 2-D), no
--   backfill (Batch 2-C), no trial logic (Batch 2-A), no RLS or grant on
--   any table. An organization whose owner_id is the caller but which
--   has no owner membership is not adopted (P5); it is left as it is.
--
--
-- SAFETY
--
--   Additive      One function, one revoke, one grant.
--   Idempotent    create or replace; revoke/grant are declarative.
--   Reversible    drop function public.provision_personal_account();
--                 rows it created remain valid rows.
-- =========================================================

create or replace function public.provision_personal_account()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  confirmed_at timestamptz;
  org_id uuid;
  ws_id uuid;
  created_org boolean := false;
  created_ws boolean := false;
begin
  if caller is null then
    raise exception 'Authentication is required to provision an account.'
      using errcode = '42501';
  end if;

  select u.email_confirmed_at
    into confirmed_at
    from auth.users u
   where u.id = caller;

  if confirmed_at is null then
    raise exception 'A confirmed email address is required to provision an account.'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('syraven.provision_personal_account:' || caller::text, 0)
  );

  select m.organization_id
    into org_id
    from public.organization_members m
    join public.organizations o
      on o.id = m.organization_id
   where m.user_id = caller
     and m.role = 'owner'
     and m.status = 'active'
     and o.owner_id = caller
   order by m.created_at asc, m.organization_id asc
   limit 1;

  if org_id is null then
    insert into public.organizations (name, slug, owner_id)
    values (
      'Personal',
      'personal-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.gen_random_uuid()::text), 1, 16),
      caller
    )
    returning id into org_id;

    insert into public.organization_members (organization_id, user_id, role, status, joined_at)
    values (org_id, caller, 'owner', 'active', pg_catalog.now());

    created_org := true;
  end if;

  select w.id
    into ws_id
    from public.workspaces w
   where w.organization_id = org_id
   order by w.created_at asc, w.id asc
   limit 1;

  if ws_id is null then
    insert into public.workspaces (organization_id, name, slug, created_by)
    values (org_id, 'Personal Workspace', 'personal-workspace', caller)
    returning id into ws_id;

    created_ws := true;
  end if;

  if created_org or created_ws then
    insert into public.audit_logs (
      organization_id, workspace_id, user_id, action, resource_type, resource_id, description, metadata
    )
    values (
      org_id,
      ws_id,
      caller,
      'account.provisioned',
      'organization',
      org_id,
      'Personal organization and default workspace provisioned.',
      pg_catalog.jsonb_build_object(
        'source', 'provision_personal_account',
        'created_organization', created_org,
        'created_workspace', created_ws
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'organization_id', org_id,
    'workspace_id', ws_id,
    'created', created_org or created_ws
  );
end;
$$;

revoke all on function public.provision_personal_account()
  from public, anon, service_role;

grant execute on function public.provision_personal_account()
  to authenticated;
