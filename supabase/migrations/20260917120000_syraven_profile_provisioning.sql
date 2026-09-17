-- =========================================================
-- SYRAVEN — Profile provisioning and trial start (Phase 3, Batch 2-A)
--
-- STATUS: WRITTEN. TEST first; PRODUCTION only with explicit founder
-- approval. Evidence: docs/engineering/SECURITY_EVIDENCE.md.
--
--
-- PROBLEM (P1-B2-3)
--
-- Nothing creates public.profiles. Registration never inserts a row, no
-- trigger exists on auth.users (TEST: none), and the Stripe webhook only
-- UPDATEs. lib/usage/entitlements.ts reads plan, subscription_status and
-- trial_ends_at from that row, so every new account resolves
-- PROFILE_NOT_FOUND and every metered route refuses it with 403 -- while
-- the registration response claims a 14-day trial nothing records.
--
--
-- WHAT THIS DOES
--
--   1. AFTER INSERT on auth.users: create the caller's profile with the
--      column defaults (plan 'free', subscription_status 'inactive') and
--      NO trial. It writes no trial column on any path.
--
--   2. AFTER UPDATE OF email_confirmed_at on auth.users, only when it
--      changes from NULL to a value: start the 14-day trial on that
--      profile, once. (Founder decision D3a: the trial clock starts only
--      when email confirmation succeeds; unconfirmed accounts get none.)
--
--
-- INVARIANTS
--
--   T1  Every auth.users row inserted after this migration has exactly
--       one profile. An existing profile is left untouched.
--   T2  A trial starts only on the NULL -> confirmed transition of
--       email_confirmed_at, never at insert. A user inserted already
--       confirmed (dashboard, admin API) receives no trial.
--   T3  A trial starts at most once: never over an existing
--       trial_started_at or trial_ends_at, including after an
--       unconfirm/reconfirm cycle.
--   T4  trial_ends_at = trial_started_at + 14 days, matching
--       TRIAL_CONFIG.durationDays in lib/plans.ts (guarded by a test).
--   T5  Values come only from the server clock and the row id. Nothing
--       is read from raw_user_meta_data or raw_app_meta_data.
--   T6  Neither function is client-executable.
--
--
-- NOT DONE HERE
--
--   No backfill (Batch 2-C; D6: existing users get no trial). The
--   confirmation trigger only UPDATEs: a user created before this
--   migration has no profile, so confirming does not create one or start
--   a trial. No change to entitlement precedence (Batch 2-E), plan,
--   subscription_status, Stripe columns, RLS or grants on profiles.
--
--
-- DESIGN
--
--   SECURITY DEFINER   GoTrue inserts and confirms as supabase_auth_admin,
--                      which holds no write on public.profiles
--                      (20260913120000 revoked client writes).
--   search_path = ''   Every relation is schema-qualified; now() and
--                      interval resolve from pg_catalog.
--   AFTER, not BEFORE  The auth.users row is never modified.
--   on conflict        A profile that already exists never fails a
--                      signup: an error here aborts GoTrue's insert.
--
--
-- SAFETY
--
--   Additive      Two functions, two triggers. No table, column, policy,
--                 grant or existing row is changed.
--   Idempotent    create or replace function; drop trigger if exists
--                 before each create trigger.
--   Reversible    drop both triggers on auth.users, then both functions.
--                 Profiles created in the meantime remain valid rows.
-- =========================================================


-- =========================================================
-- 1. Profile on user creation (no trial)
-- =========================================================

create or replace function public.provision_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_profile_for_new_user()
  from public, anon, authenticated;

drop trigger if exists syraven_provision_profile
  on auth.users;

create trigger syraven_provision_profile
  after insert on auth.users
  for each row
  execute function public.provision_profile_for_new_user();


-- =========================================================
-- 2. Trial starts when email confirmation succeeds, once
-- =========================================================

create or replace function public.start_trial_on_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set trial_started_at = now(),
         trial_ends_at = now() + interval '14 days',
         updated_at = now()
   where id = new.id
     and trial_started_at is null
     and trial_ends_at is null;

  return new;
end;
$$;

revoke all on function public.start_trial_on_email_confirmation()
  from public, anon, authenticated;

drop trigger if exists syraven_start_trial_on_email_confirmation
  on auth.users;

create trigger syraven_start_trial_on_email_confirmation
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.start_trial_on_email_confirmation();
