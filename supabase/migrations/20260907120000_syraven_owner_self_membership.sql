-- =========================================================
-- SYRAVEN — Owner self-membership on organization_members
--
-- Step 8 (dashboard dead-end remediation).
--
--
-- PROBLEM
--
-- A user with no organisation cannot create one they can use.
--
-- `public.organizations` already lets an authenticated caller create an
-- organisation they own:
--
--   [organizations/INSERT]  WITH CHECK (owner_id = auth.uid())
--
-- But the only INSERT path on `organization_members` is the admin
-- policy:
--
--   [organization_members/ALL]  WITH CHECK (is_organization_admin(organization_id))
--
-- `is_organization_admin` reads `organization_members` itself, so at the
-- moment the owner tries to insert their FIRST membership they are not
-- yet a member, the check returns false, and the write is refused.
--
-- The result is an organisation its own owner cannot join. Verified
-- against production as `authenticated`:
--
--   org=t  member=f  workspace=f
--
-- and, with a membership seeded, the same workspace insert succeeds.
-- So RLS is behaving correctly; the missing piece is the bootstrap.
--
-- Consequence today: all seven production users have no organisation,
-- so none of them can create a workspace — the dashboard dead end one
-- layer down.
--
--
-- WHAT THIS POLICY PERMITS, AND NOTHING MORE
--
-- Exactly one thing: inserting YOUR OWN membership into an organisation
-- YOU ALREADY OWN.
--
--   user_id = auth.uid()          the row is about the caller
--   organizations.owner_id = auth.uid()   the caller owns that org
--
-- Both conditions must hold, so this cannot be used to:
--
--   - add anyone else to any organisation (user_id is pinned to the caller)
--   - join an organisation the caller does not own (the EXISTS fails)
--   - escalate inside an existing organisation, since ownership is
--     established by `organizations.owner_id`, which this policy does
--     not and cannot change
--
-- It grants no capability the caller did not already have: they can
-- already create an organisation with themselves as owner. This only
-- lets them finish that act.
--
-- `role` is deliberately NOT constrained. The owner of an organisation
-- setting their own role is not a privilege boundary — they own it —
-- and pinning a value here would silently rewrite what the application
-- inserts.
--
--
-- EXISTING BOUNDARIES ARE PRESERVED
--
-- The admin policy is untouched and still governs every other case:
-- adding other members, changing roles, removing people. This migration
-- only ADDS a narrow INSERT path; it drops and alters nothing.
--
--
-- SAFETY
--
--   Additive        One CREATE POLICY. No table, column or data change.
--   Idempotent      Guarded by `drop policy if exists`.
--   Data loss       None.
--   Reversible      `drop policy "owners can create their own membership"`.
-- =========================================================

drop policy if exists "owners can create their own membership"
  on public.organization_members;

create policy "owners can create their own membership"
  on public.organization_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_id
        and o.owner_id = auth.uid()
    )
  );
