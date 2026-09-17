-- =========================================================
-- SYRAVEN - Profile backfill: production read-only counts (Phase 3, B2-C)
--
-- RUN BY: the founder, in the PRODUCTION SQL Editor. Never through MCP.
-- EFFECT: none. SELECT-only, inside a READ ONLY transaction that is
-- rolled back. Any write attempt fails with 25006 before it happens.
--
-- PURPOSE
--
-- Measure production before any profile backfill is considered:
-- how many accounts have no profile (entitlement answers 403 for them),
-- whether any orphan or unexpected profile rows exist, and whether
-- B2-A / B2-B are present (they are expected to be ABSENT until the
-- founder approves them). Paste the single result row back verbatim.
--
-- Nothing here reads or returns an email address, a name, metadata or
-- any other personal field: every column is a count or a boolean.
--
-- Every select-list item is on ONE line so that copying the script
-- into an editor cannot split a subquery across a wrapped line.
-- =========================================================

begin transaction read only;

select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from auth.users where email_confirmed_at is null) as unconfirmed_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) as users_without_profile,
  (select count(*) from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)) as orphan_profiles,
  (select count(*) from public.profiles where trial_started_at is not null or trial_ends_at is not null) as profiles_with_trial_dates,
  (select count(*) from public.profiles where trial_ends_at > now()) as profiles_with_active_trial,
  (select count(*) from public.profiles where plan <> 'free') as profiles_non_free_plan,
  (select count(*) from public.profiles where plan not in ('free', 'starter', 'pro', 'business', 'enterprise')) as profiles_unknown_plan,
  (select count(*) from public.profiles where subscription_status <> 'inactive') as profiles_non_inactive_status,
  (select count(*) from public.profiles where stripe_subscription_id is not null) as profiles_with_subscription,
  (select count(*) from public.organizations) as organizations,
  (select count(*) from auth.users u where not exists (select 1 from public.organization_members m where m.user_id = u.id and m.role = 'owner' and m.status = 'active')) as users_without_owner_membership,
  (to_regprocedure('public.provision_profile_for_new_user()') is not null) as b2a_profile_function_present,
  (to_regprocedure('public.start_trial_on_email_confirmation()') is not null) as b2a_trial_function_present,
  (to_regprocedure('public.provision_personal_account()') is not null) as b2b_function_present,
  (select count(*) from pg_catalog.pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal) as auth_users_triggers;

rollback;
