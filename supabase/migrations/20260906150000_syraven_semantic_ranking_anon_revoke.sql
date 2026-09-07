-- =========================================================
-- SYRAVEN — Remove PUBLIC execute on match_knowledge_chunks
--
-- Follows 20260906140000_syraven_semantic_ranking.sql, which is NOT
-- modified. This is a corrective migration, applied forward.
--
--
-- DEFECT
--
-- 20260906140000 ended with:
--
--   revoke execute on function public.match_knowledge_chunks(...)
--     from anon;
--
-- That was a NO-OP, and post-apply verification caught it: `anon`
-- retained EXECUTE.
--
-- PostgreSQL grants EXECUTE TO PUBLIC on every new function by default.
-- `anon` therefore never held a DIRECT grant — it inherited access
-- through PUBLIC. `REVOKE ... FROM anon` removes a direct grant, and
-- removing a grant that was never made changes nothing.
--
-- The observed ACL after that migration was:
--
--   {=X/postgres, postgres=X/postgres, authenticated=X/postgres}
--     ^^ the leading `=X` is the grant to PUBLIC
--
--
-- FIX
--
-- Revoke from PUBLIC, then re-grant to `authenticated`. The order
-- matters: revoking from PUBLIC removes the blanket default, and the
-- explicit grant then restores access for exactly the role that needs
-- it. Doing only the revoke would break legitimate callers.
--
--
-- SECURITY CONTEXT
--
-- The exposure this closes was real but narrow. RLS was never bypassed:
-- an `anon` caller has auth.uid() = NULL, so the ai_knowledge_chunks
-- policy matched no rows and the function returned nothing. What was
-- exposed was the function's existence and signature, plus the ability
-- for an unauthenticated caller to make the database perform vector
-- work — an information-disclosure and DoS-amplification surface, not a
-- data leak.
--
--
-- SCOPE
--
-- This migration touches ONE function. It creates, alters or drops no
-- policy, no table, no index, and no other function's privileges.
--
-- NOTE for a future audit: the same PUBLIC-execute default applies to
-- other functions in this schema (is_organization_member and
-- handle_updated_at were both observed with proacl = null, the bare
-- default). That is a repository-wide convention gap and is
-- deliberately NOT addressed here — this migration was approved for
-- match_knowledge_chunks only.
--
--
-- SAFETY
--
--   Idempotent      GRANT/REVOKE are declarative; re-running is a no-op.
--   Data loss       None. Catalog ACL only; no DDL, no DML.
--   RLS             Untouched.
--   Reversible      grant execute ... to public; (not recommended)
-- =========================================================

revoke execute on function public.match_knowledge_chunks(
  vector(1536), double precision, integer, uuid
) from public;

grant execute on function public.match_knowledge_chunks(
  vector(1536), double precision, integer, uuid
) to authenticated;
