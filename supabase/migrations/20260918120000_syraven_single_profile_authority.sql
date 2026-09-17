-- =========================================================
-- SYRAVEN — One profile provisioning authority (Phase 3, Batch 2-A2)
--
-- STATUS: WRITTEN. TEST first; PRODUCTION only in ONE transaction
-- together with 20260917120000, with explicit founder approval.
-- Founder decisions: D9 (fix forward, 20260917120000 is not edited),
-- D8 (existing unconfirmed users get the trial when they confirm),
-- D10 (revoke client EXECUTE only after the TEST supabase_auth_admin
-- proof). Evidence: docs/engineering/SECURITY_EVIDENCE.md.
--
-- FINDING (production, founder read-only, 2026-09-17)
--   Production already provisions profiles outside the repository:
--   trigger on_auth_user_created (AFTER INSERT ON auth.users) executes
--   public.handle_new_user(): SECURITY DEFINER, search_path '', owner
--   postgres, insert (id, 'free', 'inactive') on conflict do nothing.
--   7/7 profiles were created within 5s of their user. EXECUTE is held by
--   anon, authenticated and service_role.
--   20260917120000 added a second insert authority
--   (syraven_provision_profile). This migration makes production's
--   function the single authority in every environment.
--
-- WHAT THIS DOES
--   1. Refuses to run if an existing public.handle_new_user() differs
--      from the audited production definition (normalized body).
--   2. Defines public.handle_new_user() exactly as production has it.
--      On production this changes nothing.
--   3. Revokes client EXECUTE (public, anon, authenticated). A trigger
--      function's EXECUTE is checked when the trigger is created, not when
--      it fires; verified on TEST before production.
--   4. Ensures trigger on_auth_user_created.
--   5. Retires the duplicate: syraven_provision_profile and
--      public.provision_profile_for_new_user().
--
-- NOT CHANGED
--   syraven_start_trial_on_email_confirmation and its function (trial
--   start on confirmation, D3a), public.profiles columns, RLS and table
--   grants, supabase_auth_admin privileges (Batch 4).
--
-- ROLLBACK
--   Production: restore the EXECUTE grants recorded before applying (PQ-2);
--   drop the trial trigger and function to undo 20260917120000.
--   TEST: drop trigger on_auth_user_created, drop function
--   handle_new_user(), re-run section 1 of 20260917120000.
-- =========================================================

do $guard$
declare
  existing text;
  expected constant text :=
    'begin insert into public.profiles ( id, plan, subscription_status ) '
    || 'values ( new.id, ''free'', ''inactive'' ) on conflict (id) do nothing; return new; end;';
begin
  select pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(p.prosrc), '\s+', ' ', 'g'))
    into existing
    from pg_catalog.pg_proc p
   where p.oid = pg_catalog.to_regprocedure('public.handle_new_user()');

  if existing is not null and existing <> expected then
    raise exception 'public.handle_new_user() differs from the audited production definition; refusing to replace it.';
  end if;
end
$guard$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    plan,
    subscription_status
  )
  values (
    new.id,
    'free',
    'inactive'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

drop trigger if exists syraven_provision_profile
  on auth.users;

drop function if exists public.provision_profile_for_new_user();
