-- =========================================================
-- SYRAVEN — public.set_updated_at() in the repository
--
-- STATUS: WRITTEN, NOT APPLIED. The founder applies it through the
-- SQL Editor: TEST first. On PRODUCTION it is a no-op (see WHAT THIS
-- DOES). Evidence: docs/engineering/SECURITY_EVIDENCE.md.
--
--
-- PROBLEM
--
-- 20260908120000_syraven_canvases.sql creates trigger
-- set_canvases_updated_at, which executes public.set_updated_at(). No
-- migration defines that function. Production has it, created outside
-- the repository, so the canvases migration succeeded there. TEST, and
-- any database built from these files, does not: CREATE TRIGGER fails
-- with 42883 and the whole canvases migration rolls back (TEST: no
-- table, no policies, no history row; founder read-only, 2026-09-15).
--
--
-- PRODUCTION DEFINITION (founder read-only, 2026-09-15)
--
--   returns trigger, language plpgsql, SECURITY INVOKER, volatile,
--   owner postgres, search_path = '' (empty),
--   body: new.updated_at = now(); return new;
--
--
-- WHAT THIS DOES
--
-- Creates exactly that function ONLY IF public.set_updated_at() does not
-- exist. An existing function (production) is not replaced, altered,
-- re-owned or re-granted. The definition mirrors production, including
-- the empty search_path: now() resolves from pg_catalog, which is always
-- searched, and the body references no relation.
--
--
-- ORDER
--
-- Sorts immediately before 20260908120000, so a database built in
-- filename order has the function before the canvases trigger needs it.
-- Relative to production's history this file is out of order, the same
-- situation as the Phase 2 baseline (20260901165000, DATABASE.md §1):
-- `supabase db push` refuses it without --include-all. Never db push
-- from this checkout (DATABASE.md §6); apply through the SQL Editor.
--
--
-- SAFETY
--
--   Additive      One conditional CREATE FUNCTION. No table, row, grant
--                 or policy is touched.
--   Idempotent    Guarded by to_regprocedure(...) is null.
--   Production    No-op: the function already exists there.
--   Reversible    Only where this file created it (never production):
--                 remove every trigger that uses the function, then the
--                 function itself.
-- =========================================================

do $migration$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    security invoker
    set search_path = ''
    as $function$
    begin
      new.updated_at = now();
      return new;
    end;
    $function$;
  end if;
end;
$migration$;
