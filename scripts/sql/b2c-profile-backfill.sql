-- =========================================================
-- SYRAVEN — Profile backfill for existing accounts (Phase 3, B2-C)
--
-- RUN BY: TEST through the supabase-test MCP server; PRODUCTION only by
-- the founder in the SQL Editor, after the read-only counts
-- (b2c-production-profile-counts.sql) and explicit approval.
--
-- ORDER ON PRODUCTION: apply 20260917120000 (B2-A) FIRST. Without its
-- insert trigger, an account created after this backfill has no profile
-- again.
--
--
-- WHAT IT DOES
--
-- Creates the missing public.profiles row for every auth.users row that
-- has none, writing ONLY the id. Every other column takes its default:
-- plan 'free', subscription_status 'inactive', no Stripe ids, and NO
-- trial dates. Founder decision D6: existing accounts receive no trial
-- from the backfill, and nothing is inferred from user metadata.
--
-- It never updates or deletes. An existing profile is untouched, and
-- a duplicate is impossible (primary key + not exists + on conflict).
--
--
-- SELF-VERIFYING, ALL OR NOTHING
--
-- One DO block, so one transaction. After the insert it checks, and
-- raises (rolling everything back) unless:
--
--   B1  no auth.users row is left without a profile
--   B2  every profile that existed before is byte-identical after
--   B3  every profile created by this run is free / inactive / no Stripe
--       ids / no trial dates
--
-- A profile created concurrently by the B2-A signup trigger is outside
-- B2; if that user also confirmed during the run, B3 can fail safe
-- (abort). Re-run it.
--
-- Idempotent: a second run inserts 0 rows and passes the same checks.
-- Nothing here reads or returns personal data.
-- =========================================================

do $backfill$
declare
  existing_ids uuid[];
  existing_hash text;
  preserved_hash text;
  inserted bigint;
  still_missing bigint;
  invalid_new bigint;
begin
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]),
         coalesce(md5(string_agg(p::text, '|' order by p.id)), '')
    into existing_ids, existing_hash
    from public.profiles p;

  insert into public.profiles (id)
  select u.id
    from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict (id) do nothing;

  get diagnostics inserted = row_count;

  select count(*)
    into still_missing
    from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id);

  if still_missing <> 0 then
    raise exception 'B2-C aborted: % account(s) still have no profile.', still_missing;
  end if;

  select coalesce(md5(string_agg(p::text, '|' order by p.id)), '')
    into preserved_hash
    from public.profiles p
   where p.id = any (existing_ids);

  if preserved_hash is distinct from existing_hash then
    raise exception 'B2-C aborted: an existing profile would change.';
  end if;

  select count(*)
    into invalid_new
    from public.profiles p
   where not (p.id = any (existing_ids))
     and (p.plan <> 'free'
          or p.subscription_status <> 'inactive'
          or p.stripe_customer_id is not null
          or p.stripe_subscription_id is not null
          or p.trial_started_at is not null
          or p.trial_ends_at is not null);

  if invalid_new <> 0 then
    raise exception 'B2-C aborted: % new profile(s) are not restricted free without a trial.', invalid_new;
  end if;

  raise notice 'B2-C profile backfill: inserted %, missing after 0, existing preserved %.', inserted, cardinality(existing_ids);
end
$backfill$;
