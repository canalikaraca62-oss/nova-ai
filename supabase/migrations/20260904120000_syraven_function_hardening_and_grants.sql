-- =========================================================
-- SYRAVEN — Function hardening and grant correction
--
-- Phase 2 (see IMPLEMENTATION_PLAN.md).
--
-- Addresses two findings from ARCHITECTURE_AUDIT.md:
--
--   1. §9.3 — public.handle_updated_at() is defined twice. The later
--      definition (20260901165535) omits `set search_path = public`,
--      silently replacing the hardened definition from 20260901154222
--      for ALL 14 triggers that use it.
--
--   2. Live finding — public.messages has SELECT granted to the `anon`
--      role. Verified against the running database: an anonymous caller
--      receives HTTP 200 from /rest/v1/messages, while every other table
--      returns 401 (error 42501). No rows were returned and writes are
--      denied, so this was not an active data breach, but the grant is
--      inconsistent with every other table and is removed here.
--
-- This migration is ADDITIVE and IDEMPOTENT:
--   - It creates no tables and drops no data.
--   - `create or replace function` re-points existing triggers safely;
--     trigger definitions themselves are untouched.
--   - `revoke ... if exists`-style guards make re-application a no-op.
--
-- It must sort AFTER 20260901165535 so that it wins over the unhardened
-- definition. Do not renumber it earlier.
-- =========================================================


-- =========================================================
-- 1. RESTORE HARDENED handle_updated_at()
--
-- `security invoker` keeps the caller's privileges.
-- `set search_path = public` pins name resolution so the function cannot
-- be redirected by a caller-controlled search_path. Without it, a trigger
-- function is vulnerable to search_path manipulation.
--
-- Body is byte-identical to the 20260901154222 definition; only the
-- search_path guard is restored.
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
-- 2. REMOVE STRAY ANON GRANT ON public.messages
--
-- Every other table in this schema denies `anon` at the grant level.
-- `messages` was the sole exception.
--
-- `revoke` on a privilege that was never granted is a no-op in
-- PostgreSQL, so this is safe to run repeatedly and safe on a fresh
-- database where the grant never existed.
--
-- Note: this revokes only the anon (unauthenticated) privilege.
-- `authenticated` and `service_role` access is deliberately untouched,
-- so application behaviour for signed-in users does not change.
-- =========================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'messages'
  ) then
    revoke select, insert, update, delete
      on public.messages
      from anon;
  end if;
end;
$$;
