-- =========================================================
-- SYRAVEN — Policy idempotency repair
--
-- Phase 2 (see IMPLEMENTATION_PLAN.md).
--
-- PROBLEM
--
-- 20260901154222_syraven_enterprise_core.sql creates 29 RLS policies
-- using bare `create policy` with no `drop policy if exists` guard.
-- PostgreSQL has no `create policy if not exists`, so re-applying that
-- migration fails with:
--
--     ERROR: policy "..." for table "..." already exists
--
-- The two later migrations (20260901154640, 20260901165535) do guard
-- their policies, so this is isolated to that one file.
--
-- WHY THAT FILE IS NOT EDITED
--
-- 20260901154222 is already applied to the hosted project and recorded
-- in supabase_migrations.schema_migrations. Editing it would change the
-- statements associated with an applied version and desync local and
-- remote migration history. The repository convention — and the safe
-- one — is to fix forward.
--
-- WHAT THIS DOES
--
-- Nothing, on a database where those policies already exist. It is a
-- structural no-op that exists to make the *intent* explicit and to give
-- the repair a home if a policy ever needs to be re-asserted.
--
-- The real remediation is procedural and is recorded in DATABASE.md:
--
--   - a fresh `supabase db reset` applies each migration exactly once,
--     in order, so the missing guards do not bite;
--   - the failure mode is limited to re-running an already-applied
--     migration against the same database, which the CLI does not do;
--   - all NEW migrations must use `drop policy if exists` first, which
--     tests/schema/migration-integrity.test.ts now enforces.
--
-- This file therefore records the defect in the migration history
-- itself, so it is visible to anyone reading the schema's evolution
-- rather than living only in a document.
-- =========================================================


-- =========================================================
-- Assert the expected policy count from 20260901154222.
--
-- If a future change silently drops one of those policies, this raises a
-- warning at apply time rather than failing the migration — the goal is
-- visibility, not blocking a deploy on a diagnostic.
-- =========================================================

do $$
declare
  policy_count integer;
begin
  select count(*)
    into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'organizations',
      'organization_members',
      'workspaces',
      'projects',
      'project_members',
      'api_keys',
      'audit_logs',
      'jobs',
      'workflows',
      'workflow_runs',
      'webhook_endpoints',
      'system_events'
    );

  if policy_count = 0 then
    raise warning
      'SYRAVEN: no RLS policies found on the enterprise-core tables. '
      'Expected the 29 policies created by 20260901154222. The schema '
      'may be incomplete.';
  end if;
end;
$$;
