# SYRAVEN — Security Evidence (Phase 3)

Every Phase 3 change has a record here **before** it is made. Findings
and severities come from the Phase 3 preflight (2026-09-15, HEAD
`187e5fd`); they are not re-rated here.

This file is append-only history. A status line written before an
application is kept and marked **Superseded**, with a pointer to the
record that replaces it. The table below is the reconciled current state.

## Current state (reconciled 2026-09-17)

**Phase 3: IN PROGRESS.** Batch 1, B2-A, B2-A2, B2-B (TEST) and B2-C are
done, B2-B now on production too; B2-D1 is implemented on repository and
TEST (PARTIAL, committed locally, not deployed); B2-D2 and later are not
started.

| Migration / artifact | Repository (SHA-256) | TEST (`akhkukajdgayqwhedeoo`) | PRODUCTION (`wpmbumtpcuahyqmdeqgf`) |
|---|---|---|---|
| `20260907120000` owner self-membership | `7D417819…A5D1` | applied (founder, 2026-09-16, P0-05) | not recorded in this repository |
| `20260908110000` `set_updated_at()` | `CE3E2302…EFAF` | applied (founder) | not applied; production already had the function |
| `20260908120000` canvases | `A0DB540D…5DE2` (pinned) | applied (founder) | table present (created before Phase 3) |
| `20260915120000` Batch 1 membership fortress | `2AF2E963…B55B` | **applied** (founder, 2026-09-16); catalog 8/8, probe 15/15 | **applied, founder-reported** (2026-09-17); P1–P6 not recorded here |
| `20260917120000` B2-A profile provisioning | `44C91FD3…8FE9` | applied | **applied** (founder, 2026-09-17, together with B2-A2) |
| `20260917130000` B2-B personal-account provisioning | `DBD0DEC2…9F47` | applied, PASS | **applied** (founder, 2026-09-17), postcheck PASS; body CRLF-normalised equal |
| `20260918120000` B2-A2 single profile authority | `EA5CCA30…5662` | applied, PASS | **applied** (founder, 2026-09-17), read-only verification PASS |
| `scripts/sql/b2c-profile-backfill.sql` B2-C | `46308AE9…1F5D` | applied | not needed (7/7 profiles) |

| Batch | Status |
|---|---|
| Batch 1: tenant and membership fortress | **PASS** on TEST (founder-applied, catalog 8/8, probe 15/15). Production applied as reported by the founder |
| B2-A: profile provisioning + trial on confirmation | **PASS**, TEST and production |
| B2-A2: one profile provisioning authority | **PASS**, TEST (real signup proofs 1–7) and production |
| B2-B: atomic personal-account provisioning | **PASS**, repository, TEST and production (founder-applied 2026-09-17) |
| B2-C: profile backfill + production counts | **PASS**, closed; no production backfill needed |
| B2-D1: application provisioning (login, `POST /api/account/provision`, `/api/workspaces`) | **PARTIAL** on repository/TEST: tests, mutations 21/21, TEST live + concurrency PASS; route-level check through a running Next server **PASS 40/40**; browser E2E BLOCKED. Founder-accepted as PARTIAL. Uncommitted; not deployable before B2-B production |
| B2-D2, B2-E, B2-F, B2-G, Batches 3–10 | NOT STARTED |

**Open findings carried forward:**

- T-B2-1: **5** of 7 production users have no owner membership (6 before
  the B2-D1 deployment; one provisioned themselves by signing in on
  2026-09-18). 3 of 3 on TEST. Creating a workspace fails closed until then. Investigated
  read-only (PASS). **Founder decision: login-time provisioning via
  B2-D.** No one-time provisioning; B2-B production not approved yet.
  Wiring implemented in B2-D1 (repository/TEST); not deployed.
- Register flow: P1-B2-1, P1-B2-2, P1-B2-4, P2-B2-1/2/3. Owners: B2-D2 and
  B2-F.
- D7 trial/paid precedence and the dead trial helpers. Owner: B2-E.
- `supabase_auth_admin` INSERT on `profiles`, the anon/MAINTAIN privilege
  baseline and `handle_updated_at` PUBLIC EXECUTE. Owner: Batch 4.
- Production `start_trial_on_email_confirmation()` ACL not measured.
- Production Auth "Confirm email": **ON** (founder-verified read-only
  2026-09-17, unchanged). Not an open finding; recorded because B2-D1 and
  T-B2-1 depend on it.
- Migration history not recorded on either project.

---

## Batch 1 — Tenant / membership fortress (founder-authorized 2026-09-15)

### Threat (P1-1, confirmed in the repository)

An organization admin could insert **any** user into their organization
and use that membership to capture and then destroy the victim's workspace
data.

The four weaknesses that combine:

1. `organization_members` "admins can manage organization members" is FOR
   ALL. Both USING and WITH CHECK are only
   `is_organization_admin(organization_id)`
   (`20260901154222_syraven_enterprise_core.sql:1147-1160`). No binding on
   `user_id`, `role` or consent, and `authenticated` holds table-level DML on
   every table (`20260906120000_syraven_privilege_repair.sql:99-118`).
2. `app/api/workspaces/route.ts` `resolveOrganizationId` (`:183-192`) took
   any active membership with an unordered `.limit(1)`. A victim holding an
   injected membership could have their next workspace created in the
   attacker's organization.
3. The attacker, as admin, may DELETE that workspace
   (`20260901154222:1205-1213`). As owner of their own organization, they may
   also delete the organization (`:1123-1128`), which cascades to its
   workspaces (`workspaces.organization_id ON DELETE CASCADE`).
4. Foreign keys then act on other users' rows, and RLS does not apply to
   cascades. `tasks.workspace_id` and `teams.workspace_id` are
   `20260901165535:173` and `:18`.

   | Reference | On workspace delete |
   |---|---|
   | `tasks.workspace_id` | cascade |
   | `teams.workspace_id` | cascade |
   | `agent_approvals.workspace_id` (`20260905120000:120-122`) | cascade |
   | `knowledge.workspace_id` | set null |
   | `canvases.workspace_id` | set null |
   | `projects.workspace_id` | set null |
   | `audit_logs.workspace_id` | set null |
   | `workflows.workspace_id` | set null |

Related, and closed in the same batch (founder decision):
- An admin can grant the owner role through the same FOR ALL policy.
- An admin can reassign `organizations.owner_id` through "organization
  admins can update organizations" (`:1109-1120`), which has no column
  limit.

### Verified before writing SQL (read-only, repository migrations)

- **Policies.** Only enterprise core and `20260907120000` define policies on
  `organization_members`, `organizations` and `workspaces`.
  `20260904123000` only counts them.
- **Owner self-membership.** "owners can create their own membership"
  (`20260907120000`) is INSERT with `user_id = auth.uid()` and ownership of
  the organization; its role is deliberately unconstrained. It is kept.
- **Helpers.** `is_organization_member`, `is_organization_admin` and
  `is_organization_owner` are SECURITY DEFINER with a pinned `search_path`.
- **No FORCE RLS** anywhere, so a SECURITY DEFINER guard owned by
  `postgres` sees every row.
- **Columns.** `organizations` has no columns added after enterprise core.
  The child ownership columns:

  | Column | Nullable? |
  |---|---|
  | `tasks.user_id` | no |
  | `knowledge.user_id` | no |
  | `canvases.user_id` | no |
  | `agent_approvals.requested_for_user_id` | no |
  | `teams.owner_id` | yes |
  | `projects.owner_id` | yes |
  | `projects.user_id` | yes (added by `20260901165535:233`) |

- **Code paths.**
  - The client writers of `organization_members` are the workspaces route
    (owner self-membership on the caller's RLS client) and register, which
    uses the service role and is unaffected by RLS or client grants.
  - No route deletes workspaces.
  - The only organization deletes are the two compensating rollbacks, each
    bounded to the row it just created.
- **Invites.** No code accepts an invite, and `organization_invites` is
  deny-all under RLS (`20260904122000:632-634`).
- **Types.** `types/database.ts` declares
  `organization_members_organization_id_fkey`, so the embedded owner join is
  typed.

### Invariants

- **I1.** A client INSERT can only create the caller's own membership, and
  only in an organization the caller owns. That is the existing
  `20260907120000` policy, now the only INSERT policy.
- **I2.** An admin cannot change a membership's `organization_id` or
  `user_id` (column grants). An admin cannot grant owner (WITH CHECK) or
  touch an owner row (USING), so no ownership transfer can happen through an
  UPDATE.
- **I3.** An admin manages non-owner memberships only: role
  admin/manager/member/viewer, status active/suspended.
- **I4.** No client can delete an owner membership. A non-owner may leave;
  an admin may remove non-owners.
- **I5.** Workspace creation resolves only to an organization whose
  server-side `owner_id` is the caller.
  - It requires an active owner membership joined to
    `organizations.owner_id = caller`, oldest first, then `limit(1)`.
  - It never falls back to another membership.
  - A lookup error returns 503.
- **I6.** `organizations.owner_id` is not updatable by clients. Only that
  column loses its UPDATE grant; `plan` and `status` stay as they are for
  Batch 4.
- **I7.** A workspace delete, whether direct or cascaded from an
  organization delete, is refused if any row in the six covered tables
  references the workspace and belongs to someone other than the actor.
  - **Ambiguous ownership fails closed.** A NULL owner column, a `projects`
    row whose `user_id` and `owner_id` disagree, or no signed-in actor (the
    service role) means refuse.
  - Nothing is set to NULL and no child row is modified: the guard only
    refuses.

### Design

**New additive migration.** `supabase/migrations/20260915120000_syraven_membership_fortress.sql`:

- `drop policy if exists "admins can manage organization members"`.
- UPDATE policy "admins can update non-owner memberships":
  - USING `is_organization_admin(organization_id) and role <> 'owner'`;
  - WITH CHECK `is_organization_admin(organization_id)`, role in
    `('admin','manager','member','viewer')`, and status in
    `('active','suspended')`.
- DELETE policy "members leave and admins remove non-owner members": USING
  `role <> 'owner'`, and the caller is either the member or an admin.
- `organization_members` grants for `authenticated`:
  - revoke INSERT and UPDATE from anon and authenticated;
  - grant INSERT on `organization_id`, `user_id`, `role`, `status`,
    `joined_at`;
  - grant UPDATE on `role`, `status`.
- `organizations` grants: revoke UPDATE from anon and authenticated, then
  grant UPDATE on every column **except `owner_id`**.
- Function `public.refuse_workspace_delete_with_foreign_data()`:
  - plpgsql, SECURITY DEFINER, `set search_path = public`;
  - no arguments; reads only `old.id` and `auth.uid()`;
  - `revoke all … from public, anon, authenticated`. A trigger fires without
    an EXECUTE check;
  - raises SQLSTATE 42501 with a generic message.
- Trigger `workspaces_refuse_foreign_data_delete`: BEFORE DELETE ON
  `public.workspaces`, FOR EACH ROW. Row triggers fire for rows removed by a
  foreign-key cascade, so this also covers organization deletes.
- **Covered child tables:**

  | Table | Ownership column checked |
  |---|---|
  | `tasks` | `user_id` |
  | `teams` | `owner_id` |
  | `knowledge` | `user_id` |
  | `canvases` | `user_id` |
  | `projects` | `user_id` and `owner_id` |
  | `agent_approvals` | `requested_for_user_id` |

- **Excluded, with reason:**
  - `audit_logs` and `workflows` hold organization-level records, not user
    data.
  - `integration_connections` is an **unapplied** migration. Batch 9 must
    extend this guard before that table exists; referencing a missing table
    here would make every workspace delete error.
- **Organizations delete that cascades to other tables.** When an owner
  deletes an organization, rows in other tables that carry
  `organization_id … on delete cascade` (for example `projects`) are
  removed. Batch 1 does not address this. It is not a cross-tenant path once
  I1 holds, because only members can carry that organization id and no
  client can make someone a member. Recorded as a residual below.

**Route change.** `app/api/workspaces/route.ts` `resolveOrganizationId`:
the membership lookup changes (owner role, `organizations!inner(owner_id)`
with `organizations.owner_id = session.userId`, ordered by `created_at`
ascending, then `.limit(1)`). Provisioning and rollback are unchanged.

**Unchanged:** register, the `20260907120000` file, every applied
migration, cookies, and Batches 2–10.

### Tests and mutations (planned)

- **`tests/security/membership-fortress.test.ts`** builds an *effective*
  model by replaying every migration in order:
  - policies (create and drop);
  - `authenticated` table and column privileges on `organization_members`
    and `organizations`;
  - the last definition of the guard function and trigger.

  It then asserts I1–I7 on that model. Two further checks:
  - Every table that references `workspaces` is either covered by the guard
    or excluded with a reason, so a future table cannot slip past.
  - The resolver's query shape.
- **`architecture-invariants`:** the deferred `todo` "an organization admin
  cannot take ownership or grant the owner role" becomes a real test. It is
  closed in the repository, not applied.
- **`scripts/security/probe-batch1.mjs`:** a TEST-only two-user probe. It
  refuses the production project reference and requires an explicit flag.
  **It is written but not run.** A static test pins its production guard.
- **Mutations (at least 14):**
  1. Restore the FOR ALL admin policy.
  2. Drop the owner exclusion from UPDATE USING.
  3. Allow owner in WITH CHECK.
  4. Drop the owner exclusion from DELETE.
  5. Restore client UPDATE on `owner_id`.
  6. Drop the owner-role filter from the resolver.
  7. Drop the organization-owner join.
  8. Drop the ordering.
  9. Add a fallback to any membership.
  10. Drop a child table from the guard.
  11. Drop SECURITY DEFINER.
  12. Drop the pinned `search_path`.
  13. Drop the `raise`.
  14. Make ambiguous ownership deletable (`<>` for `is distinct from`).

### What changed

| File | Change |
|---|---|
| `supabase/migrations/20260915120000_syraven_membership_fortress.sql` (new, 226 lines) | Drops the admin FOR ALL policy; adds the non-owner UPDATE policy and the DELETE policy; narrows `organization_members` INSERT/UPDATE to named columns; removes client UPDATE of `organizations.owner_id`; adds the guard function, its execute revoke and the BEFORE DELETE trigger. It is additive and idempotent: `migration-integrity` passes its four checks. |
| `app/api/workspaces/route.ts` | `resolveOrganizationId`: the lookup is owner-only and inner-joined to `organizations.owner_id = session.userId`, ordered by `created_at` ascending, then `.limit(1)`. Provisioning and rollback are unchanged. |
| `tests/security/membership-fortress.test.ts` (new) | 42 tests: effective policy/privilege model (A, B), resolver (C), guard (D), regression (E), probe guard. |
| `tests/security/architecture-invariants.test.ts` | The deferred `todo` "an organization admin cannot take ownership or grant the owner role" becomes a real test, under "Deferred boundaries closed in the repository (Phase 3)". |
| `scripts/security/probe-batch1.mjs` (new) | TEST-only two-user probe. It refuses production, an unknown target and a missing flag before its first request, reads only `.env.e2e.local`, and uses no service role. **Not run.** |

Unchanged: register, `20260907120000`, every applied migration, cookies,
Batches 2–10, and `PHASE_STATE.md`.

### Verification (each heavy step alone, 300 MB gate)

| # | Step | Result |
|---|---|---|
| 1 | Targeted: `membership-fortress`, `workspaces-route`, `architecture-invariants`, `migration-integrity`, `workspace-tenant-guard`, `authorization-boundary` | **PASS**: 286 tests, 280 pass, 0 fail, 6 todo |
| 2 | Mutations (`scratchpad/mut-b1.mjs`), 14 below | **PASS**: 14 of 14 caught; every file restored by hash; `git status` and the zip unchanged |
| 3 | `npx tsc --noEmit` (heap 1,536 MB) | **PASS**: exit 0, 0 `error TS` |
| 4 | `npx eslint` on the route, the two test files and the probe (heap 768 MB) | **PASS**: exit 0, 0 problems |
| 5 | `npm run test:lowmem` | **PASS**: 1,911 tests, 359 suites: 1,905 pass, 0 fail, 6 todo |

**Test-count delta.** Name-by-name against the `187e5fd` run (1,865 →
1,911, +46):
- +42 `membership-fortress` tests.
- +4 `migration-integrity` checks on the new migration.
- The converted invariant was already counted as a `todo`, so todos go from
  7 to 6. That boundary is **closed in the repository only**; the migration
  is not applied.
- Suites go from 352 to 359 (six fortress describes, plus the closed
  boundaries describe).

### Mutation testing

Each mutation re-created one defect, ran `membership-fortress` and
`architecture-invariants`, and restored the file. Restored hashes: the
migration `2AF2E9638B31`, the route `CF2F0A8CC0E6`.

| # | Defect re-created | Caught by |
|---|---|---|
| M1 | FOR ALL admin membership policy restored | "no FOR ALL policy remains"; the architecture invariant |
| M2 | Owner exclusion removed from UPDATE USING | "an UPDATE can never reach an owner row"; the invariant |
| M3 | Owner allowed in UPDATE WITH CHECK | "an UPDATE can never grant owner…"; the invariant |
| M4 | Owner protection removed from DELETE | "no client DELETE can remove an owner membership" |
| M5 | Client UPDATE on `organizations.owner_id` restored | "owner_id is not client-updatable"; column list; the invariant |
| M6 | Owner-role filter removed from the resolver | "only an active OWNER membership … qualifies" |
| M7 | Organization-owner join filter removed | "the membership is bound to the organization's server-side owner" |
| M8 | Deterministic ordering removed | "the selection is deterministic: ordered, then limited" |
| M9 | Fallback to any membership added | "there is no fallback to any other membership" |
| M10 | `tasks` removed from the guard | "another user's tasks row blocks the delete…" |
| M11 | SECURITY DEFINER removed | "it is SECURITY DEFINER with a pinned search_path" |
| M12 | Pinned `search_path` removed | same test |
| M13 | The guard's `raise` removed | "a blocked delete raises…"; "the refusal names no other user" |
| M14 | Ambiguous (NULL) ownership made deletable (`<>` for `is distinct from`) | "another user's tasks row blocks the delete, and so does ambiguous ownership" |

### Residual, recorded (not fixed in Batch 1)

- The migration is **NOT APPLIED** to TEST or production. The founder
  applies it, TEST first. Until then, production still has P1-1.
  > **Superseded (2026-09-17):** applied to TEST and, as reported by the
  > founder, to production. See "Batch 1 — applied state".
- **TEST probe: PENDING.** It needs the migration on TEST and a second TEST
  user.
  > **Superseded (2026-09-16):** the probe ran 15/15 PASS on TEST. See
  > "Batch 1 — applied state".
- **Production reads the founder needs before applying:**
  - `pg_policies` for `organization_members`, `organizations` and
    `workspaces`;
  - column privileges on those tables;
  - an audit of existing non-owner memberships. With no legitimate path
    that creates one, any such row is suspect.
- No client owner transfer exists, and none is added (founder).
- An organization delete by its owner still cascades to its own
  organization-bound rows (for example `projects.organization_id`). Not
  cross-tenant after I1.
- `organizations.plan` and `status` stay admin-writable (Batch 4).

### Batch 1 — applied state (reconciled 2026-09-17)

**TEST (`akhkukajdgayqwhedeoo`):**

1. **Prerequisites, all applied by the founder:**
   - `20260908110000` (`set_updated_at()`) and `20260908120000` (canvases);
   - `20260907120000` (owner self-membership; it was missing, so P0-05
     failed at first).
2. **P0 read-only precheck:** 12/12 PASS.
3. **P3 privilege check:** STOP. `anon` holds direct table grants
   (DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE; later also
   MAINTAIN) on `organization_members`, `organizations` and
   `workspaces`, plus default-ACL grants; there are no PUBLIC grants.
   It is systemic and platform-default, and RLS denies `anon` (every
   policy targets `authenticated`). It was moved to Batch 4 and did not
   block Batch 1.
4. **Batch 1 migration applied** (founder, 2026-09-16).
5. **Probe `scripts/security/probe-batch1.mjs`** (TEST only, two users):
   - **First run:** 9 PASS / 6 FAIL, exit 5. The cause was the probe,
     not the migration. `Prefer: return=representation` makes PostgREST
     add `RETURNING`, which re-checks the `organization_members` SELECT
     policy (`is_organization_member`, a STABLE function that cannot see
     the row being inserted). The owner bootstrap was refused on the
     read-back, and most other checks became vacuous.
   - **Fix:** membership inserts send `return=minimal`, as the
     application does (commit `6f60179`).
   - **Second run: 15/15 PASS, exit 0.** The organization-cascade delete
     was refused with 403 by the BEFORE DELETE guard. Cleanup left 0
     rows.
6. **Catalog check through `supabase-test` MCP** (2026-09-17): **8/8
   PASS**.
   - Policy inventory; UPDATE and DELETE policies.
   - The owner bootstrap INSERT policy exists, and the FOR ALL policy is
     gone.
   - Guard function: SECURITY DEFINER with a pinned `search_path`.
   - Trigger: `tgtype` 11, BEFORE DELETE ROW.
   - No client EXECUTE on the guard function.
   - `authenticated` cannot UPDATE `organizations.owner_id`.

**PRODUCTION (`wpmbumtpcuahyqmdeqgf`):**

- The founder reported (2026-09-17) that Batch 1 is applied, confirmed
  by production read-only checks Q3/Q4.
- The production P1–P6 outputs were not pasted into this session and are
  **not recorded** in this repository.
- The later production B2-C counts show 1 organization whose owner holds
  an active owner membership.

### Batch 1 TEST prerequisite — `set_updated_at()` schema drift (2026-09-15)

**Finding.** The Batch 1 read-only P0 check against TEST
(`akhkukajdgayqwhedeoo`, anon REST, `limit=0`) returned 404 `PGRST205`
for `public.canvases`. The other five guarded tables answered 200. The
delete guard queries `canvases` at run time, so applying Batch 1 to TEST
as it stands would make every workspace delete, and every organization
delete, fail. Batch 1 was therefore **not applied**, and it is **not
changed** (founder).

**TEST reads (founder, SQL Editor, read-only):**

| Query | Result |
|---|---|
| T1 | `public.canvases` is NULL; `public.set_updated_at()` is NULL; `public.handle_updated_at()` exists |
| T3 | The `canvases` policies return 0 rows |
| T2 | `20260908120000` does not appear in `supabase_migrations.schema_migrations` |

T2 contradicts `VERIFICATION_STATE.md:79` (2026-09-13, "recorded:
`20260908120000`"). That row is now out of date. Correcting it is a
separate, approved documentation change and is not made here.

**Root cause.**
- `20260908120000_syraven_canvases.sql` (unchanged since `1c5a2c9`) ends
  with `create trigger set_canvases_updated_at … execute function
  public.set_updated_at()`.
- No migration defines that function. The repository defines
  `handle_updated_at()` and `ai_set_updated_at()` only.
- `CREATE TRIGGER` requires the function to exist. The failure (42883)
  rolls back the whole migration, so there is no table, no policies and no
  history row.
- Production has the function, created outside the repository, which is
  why the migration succeeded there. This was already recorded as a known
  defect (`MIGRATION_APPROVAL_REQUIRED.md:33`,
  `ARCHITECTURE_NORTH_STAR.md:504`).

**Production definition** (founder, SQL Editor, read-only):

| Property | Value |
|---|---|
| Returns | `trigger` |
| Language | `plpgsql` |
| Security | invoker (`prosecdef = false`) |
| Volatility | `v` |
| Owner | `postgres` |
| `search_path` | `''` (empty) |
| Body | `new.updated_at = now(); return new;` |

It matches `handle_updated_at()` except for `search_path`, which is
`public` in the repository.

**Fix (repository only).** New migration
`20260908110000_syraven_set_updated_at.sql`:
- a `do $migration$ … $migration$` block that creates
  `public.set_updated_at()` **only if `to_regprocedure(...)` is NULL**;
- the definition is production's exactly, including `search_path = ''`.
  `now()` resolves from `pg_catalog`, which is always searched, and the
  body references no relation;
- no `create or replace`, `alter`, `grant` or `revoke`. On production it
  is a no-op;
- it sorts before the canvases migration, so a database built in
  filename order has the function first;
- relative to production's history the file is out of order, like the
  Phase 2 baseline. `db push` is never used; apply through the SQL Editor.

**Guard.** `tests/schema/set-updated-at-migration.test.ts`:
- file order;
- a generic check that every `execute function public.X()` is defined
  earlier in migration order;
- the definition matches production;
- the create is conditional;
- no side effects;
- a dollar-quote-aware parse of the file;
- the canvases migration is pinned by SHA-256 (LF-normalized).

**Mutations planned (9):**
1. File moved after the canvases migration.
2. Conditional removed and `create or replace` used.
3. `search_path` set to `public`.
4. `search_path` removed.
5. `security definer`.
6. Body changed to `clock_timestamp()`.
7. File deleted.
8. A migration referencing an undefined trigger function added.
9. The canvases migration altered.

**Status: NOT APPLIED to TEST or production.**

> **Superseded:** the founder applied `20260908110000` and `20260908120000`
> to TEST, and the steps below were then completed. See "Batch 1 —
> applied state". Production already had `set_updated_at()`.

The TEST order was:
1. `20260908110000` (this file).
2. `20260908120000` (canvases, unchanged).
3. Batch 1 P0 re-run, then P1–P6.
4. `20260915120000` (Batch 1).
5. Probe (needs TEST user B).

`20260909120000` and `20260910120000` stay unapplied.

**Verification** (repository only; each heavy step alone, behind the
300 MB gate):

| Check | Result |
|---|---|
| Targeted: `set-updated-at-migration`, `migration-integrity`, `canvas-persistence`, `membership-fortress`, `architecture-invariants` | **PASS**: 246 tests, 240 pass, 0 fail, 6 todo. The generic check finds no other migration that executes an undefined trigger function. |
| Mutations (`scratchpad/mut-sua.mjs`) | **PASS**: 9 of 9 caught; files restored by hash (`set_updated_at` `CE3E230241C6`, canvases `A0DB540DCFB6`); moved, parked and added files removed; `git status` and the zip unchanged |
| `npx tsc --noEmit` | **PASS**: exit 0 |
| ESLint on the new test | **PASS**: exit 0 |
| `npm run test:lowmem` | **PASS**: 1,931 tests, 365 suites: 1,925 pass, 0 fail, 6 todo |

Test-count delta: +20 from the Batch 1 run (1,911). That is 16 new tests
plus 4 `migration-integrity` checks for the new file. Suites go from 359
to 365.

M6 (body changed to `clock_timestamp()`) survived the first mutation
pass. The mutation script's unanchored replace hit the identical text in
the migration's header comment, not the function body. The script was
fixed to target the body line and re-run, and "the body is exactly
production's" catches it.

**Not done:** no migration applied, no SQL Editor use, no database
connection, no probe run, `VERIFICATION_STATE.md` unchanged, no commit.
- **A trade-off of failing closed: deletion can be blocked by planting a
  row.**
  - `tasks`, `knowledge`, `teams`, `canvases` and `projects` let a user
    insert their *own* row with any existing `workspace_id`. Their INSERT
    policies bind only the owner column; the preflight's P3 already records
    the unbound foreign references.
  - So anyone who knows a workspace's id can make that workspace
    undeletable. Its owner gets the generic refusal.
  - This is denial of deletion, not loss or disclosure of data. It follows
    from the founder's fail-closed decision.
  - It closes when child inserts must also pass the workspace tenant check,
    which belongs to Batch 4 (database/RLS: tenant binding of foreign
    references). Recorded here and in the Batch 4 scope; not fixed in
    Batch 1.

## Batch 2-A — Profile provisioning and trial start (founder-authorized 2026-09-17)

Scope: B2-A only. B2-B (provisioning function) and later sub-batches are
not started. No production access, no production migration, no push.

### Founder decisions applied

- **D3a:** the trial clock starts only when email confirmation succeeds.
  Unconfirmed accounts get no trial.
- **D6:** no trial from backfill. The backfill itself is B2-C and is not
  done here.
- **Metadata:** `user_metadata` never decides plan, trial or limits.
- **D7:** trial/paid precedence is B2-E. Not changed here.

### Threat (P1-B2-3, confirmed read-only)

- Nothing inserts `public.profiles`:
  - no trigger on `auth.users` (TEST: 0 triggers in schema `auth`);
  - the register route never writes a profile;
  - the Stripe webhook only `UPDATE`s (`app/api/billing/webhook/route.ts:448-450`).
- `resolveEntitlement` returns `PROFILE_NOT_FOUND` and `usageGuard`
  answers 403 for every new account.
- TEST before the migration: 3 users, 1 profile, 0 profiles with trial
  dates.

### Invariants

- **T1:** every `auth.users` row inserted after the migration has exactly
  one profile, created with the column defaults (`free` / `inactive`). An
  existing profile is never overwritten and never fails a signup.
- **T2:** a trial starts only on the NULL → set transition of
  `email_confirmed_at`, never at insert. A user inserted already confirmed
  (dashboard, admin API) gets no trial.
- **T3:** a trial starts at most once. It never overwrites a set
  `trial_started_at` or `trial_ends_at`, including after an
  unconfirm/reconfirm cycle or a half-set trial.
- **T4:** `trial_ends_at = trial_started_at + 14 days`, tied to
  `TRIAL_CONFIG.durationDays` by a cross-file test.
- **T5:** values come only from the server clock and the row id. No
  metadata is read; no plan, subscription or Stripe column is written.
- **T6:** neither function is client-executable (`public`, `anon` and
  `authenticated` are revoked).

### What changed

- `supabase/migrations/20260917120000_syraven_profile_provisioning.sql`
  (SHA-256 `44C91FD3A982…8FE9`):
  - `public.provision_profile_for_new_user()`, run AFTER INSERT ON
    `auth.users`, does `insert … (id) on conflict (id) do nothing`;
  - `public.start_trial_on_email_confirmation()`, run AFTER UPDATE OF
    `email_confirmed_at`, with `WHEN (old IS NULL AND new IS NOT NULL)`.
    It does one update guarded by `trial_started_at is null and
    trial_ends_at is null`;
  - both are SECURITY DEFINER with `search_path = ''` and fully qualified
    relations, and are revoked from clients;
  - each `create trigger` is preceded by `drop trigger if exists`.
- `tests/schema/profile-provisioning-migration.test.ts`: 25 tests,
  including a repo-wide rule that every `auth.users` trigger runs a
  SECURITY DEFINER function with `search_path = ''` revoked from clients.
- No application code, `lib/`, RLS, grant or existing migration changed.

### TEST verification (`akhkukajdgayqwhedeoo`, through `supabase-test` MCP)

The target is pinned by `--project-ref` in `.mcp.json`; the MCP server
cannot report the ref from inside the connection.

- **Applied:** the migration's eight statements, verbatim, with
  `execute_sql`. No `schema_migrations` row was written, as with earlier
  TEST applications.
- **Catalog check:**

  | Object | Evidence |
  |---|---|
  | `syraven_provision_profile` | enabled `O`, `tgtype` 5 (ROW + INSERT, AFTER) |
  | `syraven_start_trial_on_email_confirmation` | enabled `O`, `tgtype` 17 (ROW + UPDATE, AFTER), UPDATE OF `email_confirmed_at`, the WHEN clause as written |
  | Both functions | `prosecdef` true, `search_path=""`, owner `postgres`, ACL `{postgres=X, service_role=X}`, `anon` and `authenticated` EXECUTE false; bodies equal the file |

- **Behaviour:** one `DO` block ended with a deliberate `RAISE`, so every
  write rolled back. All 17 assertions held:

  | Case | Result |
  |---|---|
  | A: unconfirmed insert with hostile metadata (`plan: enterprise`, `trial_active: true`) | 1 profile, `free`, `inactive`, no trial |
  | G: unrelated update (`last_sign_in_at`) | no trial |
  | B: confirmation | trial started, length exactly 14 days, still `free` / `inactive` |
  | C: confirmed → different confirmed value | a sentinel trial is unchanged |
  | D: unconfirm then reconfirm | the sentinel trial is unchanged |
  | D2: half-set trial (`ends` only) | untouched |
  | E: insert already confirmed | profile created, no trial |
  | F: profile already existed | insert succeeds, 1 row, existing `plan` kept |
  | H: confirmation for a user without a profile | no error, no profile created |

- **Residue check:** 3 users and 1 profile, as before; 0 probe users; 0
  profiles with trial dates; 2 triggers on `auth.users`.

Not verified: the real GoTrue path (`signUp` → email link →
`verifyOtp`). It needs B2-D, the B2-F dashboard configuration and the
B2-G probe.

### Mutation testing (`scratchpad/mutate-b2a.mjs`)

**16 of 16 caught.** Both files were restored by hash; `git status` was
unchanged.

| # | Mutation |
|---|---|
| M01 | `search_path = public` |
| M02 | `on conflict` removed |
| M03 | insert path writes a trial |
| M04 | 15-day interval |
| M05 | once-only guard removed |
| M06 | WHEN without the NULL check |
| M07 | `after update` on every column |
| M08 | SECURITY INVOKER |
| M09 | revoke from `public` only |
| M10 | `grant execute` to `authenticated` |
| M11 | unqualified `profiles` |
| M12 | trial conditioned on `raw_user_meta_data` |
| M13 | BEFORE INSERT |
| M14 | idempotent `drop trigger` removed |
| M15 | insert path writes `plan` |
| M16 | `TRIAL_CONFIG.durationDays` 15 in `lib/plans.ts` |

On the first pass, the M01 and M08 replacement text contained `$$`, which
JavaScript `String.replace` collapses to `$`. That broke dollar-quoting,
so those two were caught for the wrong reason. The script now uses a
function replacement. On the re-run both are caught by the intended
guards: the header check and the repo-wide `auth.users` rule, fail=2
each.

### Repository verification (300 MB gate, one heavy step at a time)

| Check | Result |
|---|---|
| New test file | **PASS**: 25 of 25 |
| `migration-integrity`, `set-updated-at-migration`, `membership-fortress` | **PASS**: 180 of 180 |
| `npx tsc --noEmit` | **PASS**: exit 0 |
| ESLint on the new test | **PASS**: exit 0 |
| `npm run test:lowmem` | **FAIL, not caused by B2-A**: 1,960 tests, 371 suites, 1,952 pass, **2 fail**, 6 todo |

- **Test-count delta:** +29 from 1,931, which is the 25 new tests plus 4
  `migration-integrity` checks for the new file.
- **The two failures:**
  - where: `tests/security/engineering-control-plane.test.ts:42-53`
    ("exactly the audited servers are configured", "both run the
    repository's pinned Playwright");
  - cause: the uncommitted `.mcp.json` `supabase-test` server added on
    2026-09-17 with founder approval;
  - status: not fixed in B2-A. Resolving it means auditing that server in
    `MCP_AUDIT.md` and extending the guard to pin its version,
    `--project-ref` (TEST only), `--features` and the env-reference token.
    That needs a founder decision; the guard must not simply be loosened.

### Residual, recorded

- **Confirmed before B2-A:** users confirmed before the migration have no
  profile. Existing users get a profile, with no trial, in B2-C (D6).
- **Admin-confirmed users:** a user inserted already confirmed gets no
  trial (T2). Today's register route creates users with
  `email_confirm: true`, so until B2-D replaces it, such users get a
  profile (403 removed) but no trial.
- **`service_role` EXECUTE:** it keeps EXECUTE through default
  privileges, as Batch 1's guard function does. These are trigger
  functions and are not callable outside a trigger.
- **Signup blocking:** a failure inside the insert trigger would block
  every signup. The body is one `on conflict` insert with no external
  dependency. Rollback: drop both triggers, then both functions.
- **Production:** NOT APPLIED. It needs a read-only count first and
  explicit founder approval.
  > **Superseded (2026-09-17):** applied to production together with
  > B2-A2 in one founder-run transaction; verification PASS. See "Batch
  > 2-A + 2-A2 — Production application". On production, profiles come
  > from `handle_new_user()`; this file's insert trigger was retired
  > there by B2-A2.

## Batch 2-B — Atomic personal-account provisioning (founder-authorized 2026-09-17)

Scope: B2-B only. No change to register, login or `/api/workspaces`
(B2-D), no backfill (B2-C), no trial logic (B2-A). No production access,
no push.

### Threat (P2-B2-2, P2-B2-3, confirmed read-only)

- Two application paths create an organization in several non-atomic
  steps:
  - `app/api/auth/register/route.ts`: service role, with best-effort
    compensating deletes;
  - `app/api/workspaces/route.ts` `resolveOrganizationId`: caller's
    client, with a rollback that can itself fail.
- A failure between steps leaves an unusable organization.
- Concurrent calls can create two organizations.
- No migration inserts `organizations`, `organization_members` or
  `workspaces` (repository grep).
- TEST before the migration: 0 organizations, 0 members, 0 workspaces,
  0 audit rows, PostgreSQL 17.6.

### Invariants

- **P1:** the function takes no parameters. Identity is `auth.uid()`
  only; no other claim, header or metadata is read.
- **P2:** a NULL `auth.uid()` is refused with 42501 before any read or
  write.
- **P3:** the caller's own `auth.users` row must have `email_confirmed_at`
  set, otherwise the call is refused with 42501. A missing row is refused
  the same way. Both refusals come before the lock or any write.
- **P4:** a per-user `pg_advisory_xact_lock` is taken before the
  existence check. It is never a session or try-lock.
- **P5:** an existing organization is recognised only by the Batch 1 rule
  (`resolveOrganizationId`): an active owner membership of the caller, in
  an organization whose `owner_id` is the caller; the oldest membership
  wins. A test cross-checks the route against this rule.
- **P6:** `owner_id`, membership `user_id` and workspace `created_by` are
  the caller; the membership is `owner` / `active`. The organization slug
  is random, not derived from the user id.
- **P7:** repeated calls return the same ids and write nothing, including
  no audit row.
- **P8:** atomic. No exception handler, commit or rollback inside the
  function.
- **P9:** EXECUTE for `authenticated` only; revoked from `public`, `anon`
  and `service_role`.

### What changed

- `supabase/migrations/20260917130000_syraven_personal_account_provisioning.sql`
  (SHA-256 `DBD0DEC2C93C…9F47`), three statements:
  1. `create or replace function public.provision_personal_account()`,
     which returns `jsonb`, volatile, SECURITY DEFINER,
     `search_path = ''`, every relation and built-in qualified;
  2. `revoke all … from public, anon, service_role`;
  3. `grant execute … to authenticated`.
- **Returns** `{organization_id, workspace_id, created}`.
- **Behaviour:**
  - an owned organization with no workspace gets the default workspace
    (completion, not a duplicate);
  - the oldest workspace is returned when several exist;
  - the audit row (`account.provisioned`) is written only when something
    was created.
- `tests/schema/personal-account-provisioning-migration.test.ts`: 38
  tests.
- Nothing calls the function yet. The application flow is unchanged.

### TEST verification (`akhkukajdgayqwhedeoo`, `supabase-test` MCP)

**Applied:** the three statements, verbatim, with `execute_sql`.

**Catalog:**

| Property | Value |
|---|---|
| `pronargs` / identity arguments | 0 / empty |
| Return type | `jsonb` |
| Security | `prosecdef` true, `provolatile` `v`, `search_path=""` |
| Language, owner | `plpgsql`, `postgres` |
| ACL | exactly `{postgres=X, authenticated=X}` |
| EXECUTE | `authenticated` true; `anon` false; `service_role` false; 0 PUBLIC grants |
| Body | contains `pg_catalog.pg_advisory_xact_lock(` |
| Overloads | 1 |

**Behaviour.** One `DO` block ran as the real roles (`set local role`,
with `request.jwt.claim.sub` and `request.jwt.claims` set as PostgREST
sets them). It ended with a deliberate `RAISE`, so every write rolled
back.

| # | Case | Result |
|---|---|---|
| T0 | `authenticated`, no `sub` | `42501` "Authentication is required…" |
| T1 | `anon` role | `42501` permission denied for function |
| T1b | `service_role` | `42501` permission denied for function |
| T2 | unconfirmed user | `42501` "A confirmed email address is required…" |
| T2b | `sub` with no `auth.users` row | `42501`, same message |
| T3 | confirmed A, called twice | first `created` true, second false; same org and workspace; A owns 1 org; A has 1 membership (`owner`/`active`); org has 1 workspace, `created_by` = A; 1 audit row |
| T4 | A reads through RLS | sees own workspace (1) and org (1) |
| T5 | B calls, then reads A's rows through RLS | B gets a distinct org, owned by B; sees A's workspace 0 and A's org 0 |
| T6 | `provision_personal_account($1)` and `(owner_id => $1)` | `42883` function does not exist, both |
| T7 | C holds an injected `owner`/`active` membership in A's org | not returned; C gets its own org; A's org membership count 2 = A plus the injected row, nothing added |
| T8 | D already owns an org (Batch 1 rule) with 2 workspaces | existing org returned, oldest workspace, `created` false; still 1 org and 2 workspaces; 0 audit rows |
| T9 | E owns an org with no workspace | first call creates the default workspace only (`created` true, audit metadata `created_organization` false, `created_workspace` true); second call `created` false, same workspace, still 1 audit row |
| T10 | F's owner membership is suspended | F's org is not returned |
| T11 | lock check during A's transaction | the advisory lock keyed by `hashtextextended('syraven.provision_personal_account:' ‖ A, 0)` is held (1 row) |
| T12 | G owns an org with no membership | not adopted; it still has 0 members |

**Residue after rollback:** 3 users, 1 profile, 0 organizations, 0
members, 0 workspaces, 0 audit rows, 0 advisory locks. The lock was
released at transaction end, which confirms it is transaction-scoped.

**PostgREST, anon key only, no session** (`scratchpad/b2b-anon-rpc.mjs`,
refuses the production ref):

| Call | Response |
|---|---|
| No body | `401` / `42501` |
| Body `{owner_id: …}` | `404` / `PGRST202` (no such signature) |
| Body `{user_id: …}` | `404` / `PGRST202` |

### Mutation testing (`scratchpad/mutate-b2b.mjs`)

**27 of 27 caught.** Replacements are literal (function form, so `$$` is
kept). The migration and route were restored by hash, and the extra
migration file was removed.

| # | Mutation |
|---|---|
| N01 | a parameter |
| N02 | identity from a non-`sub` claim |
| N03 | NULL refusal removed |
| N04 | unconfirmed refusal removed |
| N05 | confirmation read not bound to the caller |
| N06 | session lock |
| N07 | lock removed |
| N08 | lock after the existence check |
| N09 | ownership rule without `owner_id = caller` |
| N10 | ownership rule without `role = owner` |
| N11 | ownership rule without `status = active` |
| N12 | `owner_id` not the caller |
| N13 | membership `user_id` not the caller |
| N14 | membership outside the new-org branch |
| N15 | unconditional audit |
| N16 | SECURITY INVOKER |
| N17 | `search_path = public` |
| N18 | unqualified relation |
| N19 | unqualified built-in |
| N20 | grant to `anon` |
| N21 | revoke from `public` only |
| N22 | exception handler that swallows errors |
| N23 | slug derived from the user id |
| N24 | dynamic SQL |
| N25 | update of existing rows |
| N26 | route drops `role = owner` |
| N27 | a second migration that provisions organizations |

### Repository verification (300 MB gate)

| Check | Result |
|---|---|
| New test file | **PASS**: 38 of 38 |
| `migration-integrity`, `set-updated-at`, `profile-provisioning`, `membership-fortress` | **PASS**: 209 of 209 |
| Mutations | **PASS**: 27 of 27 (started at 345 MB free) |
| `npx tsc --noEmit` | **PASS**: exit 0, 0 `error TS` (final run, 2026-09-17) |
| ESLint on the new test | **PASS**: exit 0 |
| `npm run test:lowmem` | **PASS**: 2,008 tests, 381 suites, 2,002 pass, **0 fail**, 6 todo; 689 MB free at the end |

**How these were reached.**

- **First attempts:** blocked, and not forced. `tsc` waited at 238 MB
  and ESLint at 225 MB; the waiting job was then stopped by the system
  for low memory. Later re-checks read 41, 214, 174 and 90 MB.
- **Final run:** one background job ran the three checks in order. It
  waited for 300 MB free before each check, with a 25-minute deadline.
- **Test-count delta:** +42 from 1,966 (the MCP guard run). That is 38
  new tests plus 4 `migration-integrity` checks for the new file.

**Gate-log defect (in the verification script, not in B2-B).**

- **The defect:** the helper wrote its `GATE_OPEN` / `GATE_TIMEOUT` line
  into its return value instead of printing it, and the caller tested
  that value.
- **What is lost:**
  - the free-memory reading at the start of each check was never logged;
  - on a timeout, a check would still have run.
- **What is known:**
  - all three checks ran to completion and passed;
  - nothing was killed;
  - 689 MB were free at the end.
- **What is not provable from this log:** that each check started at 300
  MB or more.

**Concurrency.** Two overlapping sessions were attempted through the
`supabase-test` MCP server; it runs calls one after another. S1 ended at
08:49:10.287 and S2 started at 08:49:13.553, and S2 saw
`other_session_holding_lock = 0`. The result is inconclusive and the
live concurrency test is **NOT RUN**. Serialization rests on the static
lock guards and T11.

### Residual, recorded

- **Orphan organizations are not adopted.** An organization whose
  `owner_id` is the caller but which has no active owner membership is
  left as it is, and the caller gets a new personal organization
  (P5, T12).
- **Suspended owners are not recognised.** A suspended owner membership
  yields a new personal organization (T10). Whether a suspended owner
  should be provisioned at all is a product question.
- **Concurrency is not tested live.** Serialization rests on the
  transaction lock, verified statically and by T11; two real concurrent
  sessions were not run.
- **Banned or deleted accounts are not checked.** The function checks
  only `email_confirmed_at`; `banned_until` and `deleted_at` are not. A
  banned user's still-valid JWT could provision.
- **Nothing calls the function yet.** Register and `/api/workspaces`
  still use their own paths until B2-D.
- **Production:** NOT APPLIED.

## Batch 2-C — Profile backfill and production read-only counts (founder-authorized 2026-09-17)

Scope: B2-C only. No app-flow change (B2-D), no trial logic change, no
production access or write, no push. B2-D and B2-E are not started.

### Founder decision applied

- **D6:** existing accounts get NO trial from the backfill. A missing
  profile becomes restricted free with no trial dates.
- **Metadata:** nothing is inferred from user metadata.

### Threat / gap

- Accounts created before B2-A have no `public.profiles` row, so
  `resolveEntitlement` returns `PROFILE_NOT_FOUND` and every metered
  route answers 403.
- TEST before the backfill: 3 users (1 unconfirmed), 1 profile, **2
  users without a profile**, 0 orphan profiles, 0 profiles with trial
  dates, profiles hash `fc5ec74aa245c74fe1be8e0bffdce6f9`.

### What changed

**`scripts/sql/b2c-profile-backfill.sql`** (SHA-256 `46308AE9…1F5D`)

- One `do $backfill$` block, so the backfill and its checks commit or
  roll back together.
- **Order:**
  1. snapshot the existing profile ids and a row hash;
  2. `insert into public.profiles (id) select u.id from auth.users u
     where not exists (…) on conflict (id) do nothing`: the id only, so
     every other column takes its default (`free` / `inactive`, no
     Stripe ids, no trial dates);
  3. abort unless all three hold:
     - **B1:** 0 accounts are left without a profile;
     - **B2:** the existing profiles are byte-identical (same row hash);
     - **B3:** every new profile is free, inactive, without Stripe ids
       and without trial dates.
- **Never:** no update or delete, no clock or interval, no metadata read,
  no exception handler.
- **Not a migration:** a one-time founder-applied data operation, so a
  fresh database build never runs it silently.
- **Production order:** apply B2-A first, or accounts created after the
  backfill are again left without a profile.

**`scripts/sql/b2c-production-profile-counts.sql`** (SHA-256 `F134AC8F…8CC8`)

- **Shape:** `begin transaction read only;`, one `SELECT`, `rollback;`.
- **Output:** counts and booleans only, with no email, metadata or
  aggregated identifier.
- **Measures:**
  - accounts: `auth_users`, `unconfirmed_users`;
  - profiles: `profiles`, `users_without_profile`, `orphan_profiles`;
  - trial and billing state already present: `profiles_with_trial_dates`,
    `profiles_with_active_trial`, `profiles_non_free_plan`,
    `profiles_unknown_plan`, `profiles_non_inactive_status`,
    `profiles_with_subscription`;
  - tenancy: `organizations`, `users_without_owner_membership`;
  - Phase 3 objects: the B2-A and B2-B function-present flags and
    `auth_users_triggers`.

**`tests/schema/profile-backfill-scripts.test.ts`**: 19 tests.

### Production read-only counts

> **Superseded (2026-09-17):** the founder ran the counts: 7 users, 7
> profiles, 0 without a profile. See "Batch 2-C — closed".

**NOT RUN.** Production is not reachable through MCP by design, and this
session has no other production path. The founder runs
`scripts/sql/b2c-production-profile-counts.sql` in the production SQL
Editor and pastes the one result row back. No production write is
considered until then.

On TEST the same script ran as a syntax and behaviour check: 3 users, 1
unconfirmed, 1 profile, 2 without a profile, 0 orphans, 0 trial dates,
0 non-free, 0 organizations, 3 without an owner membership, B2-A and
B2-B present, 2 triggers.

### TEST verification (`akhkukajdgayqwhedeoo`, `supabase-test` MCP)

**Adversarial dry run** of the exact script text inside `EXECUTE`. It
ended with a deliberate `RAISE`, so everything rolled back.

- **Setup** added three synthetic confirmed users:
  - two whose profiles were removed (so 4 accounts were missing a
    profile, including the 2 real ones);
  - one with a paying profile: `pro` / `active`, Stripe ids and trial
    dates.
  - All three carried hostile metadata (`plan: enterprise`,
    `trial_active: true`), and an orphan profile (`starter` / `active`,
    no user) was added.

| Case | Result |
|---|---|
| Run 1 | OK; 0 accounts without a profile; the paying and orphan profiles byte-identical; 1 profile per backfilled user; backfilled rows `free` / `inactive` with no Stripe ids or trial dates; 0 `enterprise` profiles (metadata ignored); the real users backfilled without a trial |
| Run 2 | OK, profile count unchanged (idempotent) |
| Manual duplicate insert | `23505 unique_violation` |
| Self-check B3 (a variant that writes trial dates) | aborted "1 new profile(s) are not restricted free without a trial"; its insert rolled back |
| Self-check B2 (a variant that updates `pro` → `business`) | aborted "an existing profile would change"; the paying profile unchanged |
| Self-check B1 (a variant that inserts nothing) | aborted "1 account(s) still have no profile" |

**Real TEST backfill** (committed):

- **Run start:** 2026-09-17T11:23:10.338322.
- **After:**

  | Measure | Value |
  |---|---|
  | Users / profiles | 3 / 3 |
  | Users without a profile | **0** |
  | Orphan profiles | 0 |
  | Profiles with trial dates | **0** |
  | Created by the backfill | 2, all restricted free with no trial |
  | Pre-existing profile hash | `fc5ec74aa245c74fe1be8e0bffdce6f9`, unchanged |
  | Duplicate ids | 0 |

- **Second real run:** no error; still 3 profiles, 0 without a profile,
  0 trial dates; all-profiles hash `50914c968bfb91f6e745c4b0024ab1c6`.

### Mutation testing (`scratchpad/mutate-b2c.mjs`)

**17 of 17 caught** at 348 MB free. The scripts were restored by hash
and the leaked migration file was removed.

**Backfill script (C01–C11):**

| # | Mutation |
|---|---|
| C01 | insert writes trial dates |
| C02 | insert writes a paid plan |
| C03 | not-exists guard removed |
| C04 | `on conflict` removed |
| C05 | existing profiles updated |
| C06 | B1 abort removed |
| C07 | B2 abort removed |
| C08 | B3 stops rejecting trial dates |
| C09 | exception handler swallows a failed check |
| C10 | backfill filtered by metadata |
| C11 | snapshot taken after the insert |

**Counts script, and a leak into migrations (C12–C17):**

| # | Mutation |
|---|---|
| C12 | transaction not read-only |
| C13 | `commit` instead of `rollback` |
| C14 | the script writes |
| C15 | returns email addresses |
| C16 | `users_without_profile` dropped |
| C17 | the backfill copied into `supabase/migrations` |

### Repository verification (300 MB gate, reading logged before each step)

| Check | Result |
|---|---|
| New test file | **PASS**: 19 of 19 |
| `npx tsc --noEmit` | **PASS**: exit 0, 0 `error TS` (gate 373 MB) |
| ESLint on the new test | **PASS**: exit 0 (gate 834 MB) |
| `npm run test:lowmem` | **PASS**: 2,027 tests, 385 suites, 2,021 pass, 0 fail, 6 todo (gate 902 MB; 670 MB at the end) |

Test-count delta: +19 from 2,008 (the B2-B final run), which is the new
test file.

### Residual, recorded

- **Production:** counts NOT RUN (founder action); backfill NOT APPLIED.
  It needs the counts, B2-A applied first, and explicit approval.
  > **Superseded (2026-09-17):** counts done; backfill not needed on
  > production (0 without a profile). B2-C closed PASS.
- **Signup race:** a profile created by the B2-A trigger during a
  production run whose user also confirms before the run finishes would
  fail B3 and abort the backfill (fail-safe). Re-run it.
- **Organizations:** TEST still has 0 organizations and 3 users without
  an owner membership. That is B2-D provisioning, not the backfill.

## Batch 2-C — closed (founder decision 2026-09-17)

**B2-C = PASS.** The production read-only counts were run by the founder
with `scripts/sql/b2c-production-profile-counts.sql`. That script is now
SHA-256 `78ABEBF8…702E`: it was reformatted to one line per select item
after a copy-paste syntax error, with semantics unchanged and re-checked
on TEST.

| Count | Production |
|---|---|
| `auth_users` | 7 |
| `unconfirmed_users` | 2 |
| `profiles` | 7 |
| `users_without_profile` | **0** |
| `orphan_profiles` | 0 |
| Profiles with trial dates / active trial / non-free / unknown plan / non-inactive / subscription | 0 each |
| `organizations` | 1 |
| `users_without_owner_membership` | 6 |
| B2-A functions present, B2-B function present | false, false |
| `auth_users_triggers` | **1** |

- **No production backfill needed:** 7 of 7 users already have a profile.
  The script is kept for environments that need it.
- **The unexpected trigger** (`auth_users_triggers = 1`) was diagnosed
  read-only; see B2-A2 below.
- **Separate tenancy finding T-B2-1:** 6 of 7 production users have no
  active owner membership. This is fail-closed (workspace creation is
  refused) and is left for B2-D. It is not fixed by any backfill.

## Batch 2-A2 — One profile provisioning authority (founder-authorized 2026-09-17)

### Production diagnosis (founder, read-only, Q1–Q5)

- **Q1:** trigger `on_auth_user_created`, AFTER INSERT ON `auth.users`,
  executes `public.handle_new_user()`. It sorts before the planned
  `syraven_provision_profile`.
- **Q2/Q3:** `handle_new_user()` is SECURITY DEFINER with
  `search_path ''`, owned by `postgres`. Its body is
  `insert into public.profiles (id, plan, subscription_status) values
  (new.id, 'free', 'inactive') on conflict (id) do nothing`. It reads no
  metadata and no trial, and touches no tenancy tables. EXECUTE is held
  by `anon`, `authenticated` and `service_role`.
- **Q4:** 7 of 7 profiles were created within 5 s of their user, 0 later.
  The trial columns exist. There is 1 trigger on `profiles`.
  `supabase_auth_admin` can INSERT into `profiles`.
- **Q5:** 1 organization. Its owner exists, is confirmed and holds an
  active owner membership. There is 1 membership and 1 workspace in that
  organization; `created_via` is absent; plan and status are
  `free` / `active`.

### Assessment

- **Drift:** production provisions profiles outside the repository. P1-B2-3
  ("nothing creates profiles") holds on TEST and in the repository, not
  on production.
- **Duplicate authority, not breakage:** B2-A's insert trigger would have
  been a second authority. Both functions use `on conflict`, so
  coexistence would not have broken signups.
- **The trial still needs B2-A:** production has no mechanism that
  starts a trial.

### Founder decisions

- **D9:** fix forward. 20260917120000 is not edited; its SHA-256 is still
  `44C91FD3…8FE9`.
- **D8:** the 2 unconfirmed production users receive the 14-day trial
  when they confirm (D3a).
- **D10:** revoke client EXECUTE on `handle_new_user()` (`public`,
  `anon`, `authenticated`), keeping `service_role`, but only after the
  TEST proof.
- **B2-B production:** not approved.
- **`supabase_auth_admin` INSERT on `profiles`:** deferred to Batch 4.

### What changed

**`supabase/migrations/20260918120000_syraven_single_profile_authority.sql`**
(SHA-256 `EA5CCA30…5662`), seven statements:

1. A guard that aborts if an existing `handle_new_user()` differs from
   production's body (whitespace and case normalized).
2. `create or replace function public.handle_new_user()`: production's
   definition, byte-for-byte in the body.
3. `revoke all … from public, anon, authenticated`.
4. `drop trigger if exists on_auth_user_created`.
5. `create trigger on_auth_user_created after insert … for each row`.
6. `drop trigger if exists syraven_provision_profile`.
7. `drop function if exists public.provision_profile_for_new_user()`.

**`tests/schema/single-profile-authority-migration.test.ts`**: 20 tests,
including the state after replaying every migration in filename order:

- the final `auth.users` triggers are exactly `on_auth_user_created` and
  `syraven_start_trial_on_email_confirmation`;
- exactly one final trigger inserts into `public.profiles`;
- the trial function only updates;
- `provision_profile_for_new_user()` no longer exists.

### TEST verification (`akhkukajdgayqwhedeoo`, `supabase-test` MCP)

**Before applying:**

- Triggers: `syraven_provision_profile` (5) and the trial trigger (17).
- `handle_new_user` absent.
- `supabase_auth_admin` INSERT on `profiles`: **false**. This differs from
  production (true).
- `postgres` cannot `SET ROLE supabase_auth_admin` (MEMBER and SET both
  false).
- 3 users, 3 profiles, hash `50914c96…`.

**Applied** the seven statements verbatim.

**Catalog after applying:**

| Object | Evidence |
|---|---|
| `on_auth_user_created` | type 5, enabled `O` |
| `syraven_start_trial_on_email_confirmation` | type 17, enabled `O` |
| `handle_new_user` | `prosecdef` true, `search_path=""`, owner `postgres`, ACL exactly `{postgres=X, service_role=X}`, 0 PUBLIC grants; body equals production's |
| EXECUTE on `handle_new_user` | `anon` false, `authenticated` false, `supabase_auth_admin` false, `service_role` true |
| `provision_profile_for_new_user` | absent |
| Profiles | hash `50914c96…`, unchanged |

**Behaviour** (one `DO` block ending in a deliberate `RAISE`, so it
rolled back; all held):

| Case | Result |
|---|---|
| A: unconfirmed insert with hostile metadata | exactly 1 profile, `free` / `inactive`, no trial |
| B: confirmation | trial started, exactly 14 days, still 1 profile |
| C: unconfirm then reconfirm | a sentinel trial is unchanged |
| E: profile already existed | insert succeeds, 1 row, existing `pro` plan kept |
| G: user inserted already confirmed | 1 profile, no trial |
| Guard with production's body | passes |
| Guard with a drifted body (`plan business`) | aborts "differs from the audited production definition"; after rollback the function body is production's again |
| Final triggers | `on_auth_user_created`, `syraven_start_trial_on_email_confirmation` |

**D10 proof: can the trigger fire for a role without EXECUTE?**

- **Setup,** in one rolled-back transaction on TEST:
  - throwaway source and sink tables;
  - a SECURITY DEFINER trigger function with `search_path ''`, revoked
    from `public`, `anon` and `authenticated`;
  - an AFTER INSERT trigger on the source table.
- **Result:**
  - `authenticated` has EXECUTE: **false**;
  - an insert **as `authenticated`** made the trigger fire: sink rows =
    **1**;
  - control: calling the function directly as `authenticated` gives
    `42501` permission denied.
- **Conclusion:** on this server, EXECUTE on a trigger function is not
  checked when the trigger fires. Revoking client EXECUTE cannot stop a
  signup's trigger.
- **Residue:** none. The probe tables and function are gone; 3 users, 3
  profiles, hash unchanged.

**D10 real Supabase Auth signup proof (TEST, 2026-09-17): PASS, proofs
1–7.**

- **Precondition** (`GET /auth/v1/settings`, anon key): `disable_signup`
  false and `mailer_autoconfirm` false, so a real signup sends a
  confirmation email. The founder supplied an address they control.
  The address, password and tokens were never printed or logged.
- **Strict setup:** on TEST, `supabase_auth_admin` holds neither EXECUTE
  on `handle_new_user()` nor INSERT on `public.profiles`.
- **Signup:** `scratchpad/d10-real-signup.mjs` refuses the production
  ref. It sent `POST /auth/v1/signup` with the anon key, a random
  never-printed password and hostile metadata (`plan: enterprise`,
  `subscription_status: active`, `trial_active: true`,
  `trial_started_at: 2020-01-01`, `trial_ends_at: 2099-01-01`). Response:
  status 200, user id `a2f24728-…-d04dbcc9a708`, no session, not confirmed.

| # | Proof | Evidence | Result |
|---|---|---|---|
| 1 | A real signup creates exactly one profile | 1 `auth.users` row, **1 profile**, created within 5 s of the user | **PASS** |
| 2 | The profile is `free` / `inactive` | `plan` free, `subscription_status` inactive, no Stripe ids, no trial | **PASS** |
| 3 | Hostile metadata cannot change the plan | the hostile keys are stored on the user; the profile is still free with no trial | **PASS** |
| 4 | Revoked EXECUTE does not break the GoTrue path | profile created while `supabase_auth_admin` has EXECUTE false and profiles INSERT false; no session; 0 memberships | **PASS** |
| 5 | Confirmation starts exactly one 14-day trial | after the founder clicked the link once: `email_confirmed_at` set; 1 trial; `trial_started_at` `2026-09-17T13:27:56.687288Z`, 0.066 s after confirmation (server clock); `trial_ends_at` `2026-10-01T13:27:56.687288Z`, exactly `14 days`; not the metadata dates; still `free` / `inactive` | **PASS** |
| 6 | Reconfirmation does not reset the trial | one rolled-back transaction: (6a) a confirmed-to-confirmed write left the trial unchanged, 1 profile; (6b) unconfirm then reconfirm (the trigger fires) left it unchanged, exactly 1 trial. After rollback the trial is still exactly the proof 5 values and the original confirmation timestamp is kept | **PASS** |
| 7 | Cleanup leaves no residue | one self-verifying transaction deleted `auth.refresh_tokens` (text user id, no foreign key), `public.profiles` (no foreign key) and `auth.users`. Identities and sessions cascade. See the table below | **PASS** |

**Proof 7 residue check:**

| Location | Before cleanup | After cleanup |
|---|---|---|
| `auth.users` | 1 | 0 |
| `public.profiles` | 1 | 0 |
| `auth.identities` | 1 | 0 |
| `auth.sessions` | 1 | 0 |
| `auth.refresh_tokens` | 1 | 0 |
| `auth.one_time_tokens`, `auth.mfa_factors`, `auth.flow_state`, `auth.audit_log_entries` (by actor id) | 0 | 0 |
| Organization memberships, organizations, workspaces, app audit logs | 0 | 0 |
| TEST totals: users / profiles | — | 3 / 3 |
| TEST profiles hash | — | `50914c968bfb91f6e745c4b0024ab1c6`, the pre-test value |
| Users without a profile / orphan profiles / organizations / memberships / workspaces | — | 0 each |
| Triggers on `auth.users` | — | unchanged |
| `supabase_auth_admin` EXECUTE on `handle_new_user()` | — | still false |

The single `auth.sessions` row was created by Supabase Auth when the
confirmation link was followed; there was no sign-in.

**Proof 6 limit:** a second click of the real link was not exercised. A
confirmed-to-confirmed write (6a) covers it.

### Mutation testing (`scratchpad/mutate-b2a2.mjs`)

**16 of 16 caught** at 378 MB free. Files were restored by hash and the
extra migration was removed.

| # | Mutation |
|---|---|
| S01 | guard abort removed |
| S02 | guard compares a different body |
| S03 | guard swallows its own abort |
| S04 | body starts a trial |
| S05 | body writes a paid plan |
| S06 | SECURITY INVOKER |
| S07 | `search_path = public` |
| S08 | revoke from `public` only |
| S09 | grant to `anon` |
| S10 | `service_role` also revoked |
| S11 | BEFORE INSERT |
| S12 | duplicate trigger not retired |
| S13 | duplicate function not retired |
| S14 | trial trigger dropped |
| S15 | B2-A migration edited |
| S16 | a later migration re-creates the duplicate |

S15 was caught by the effective-state checks, not by the D9 substring
test: renaming the trigger to `…_x` still contains the checked
substring.

### Repository verification (300 MB gate, reading logged before each step)

| Check | Result |
|---|---|
| New test file | **PASS**: 20 of 20 |
| Related schema tests | **PASS**: 229 of 229 |
| `npx tsc --noEmit` | **PASS**: exit 0 (gate 387 MB) |
| ESLint on the new test | **PASS**: exit 0 (gate 536 MB) |
| `npm run test:lowmem` | **PASS**: 2,051 tests, 390 suites, 2,045 pass, 0 fail, 6 todo (gate 847 MB) |

Test-count delta: +24 from 2,027, which is 20 new tests plus 4
`migration-integrity` checks for the new file.

### Residual, recorded

- **Real GoTrue signup proof:** PASS on TEST (proofs 1–7 above). D10's
  TEST condition is met. Applying the revoke on production still needs
  explicit approval.
- **Unidentified `profiles` trigger on production:** run PQ-1 before
  production. The trial trigger updates `profiles`.
- **Production state before applying:** run PQ-2 (exact
  `handle_new_user` ACL for rollback, and whether the guard will match)
  and PQ-3 (source of `supabase_auth_admin`'s INSERT, for Batch 4).
- **Production application:** NOT DONE. 20260917120000 and 20260918120000
  go together in one transaction, only with explicit approval.
  > **Superseded (2026-09-17):** PQ-1, PQ-2 and PQ-3 PASS; the founder
  > applied both in one transaction (third attempt); verification PASS.
  > See "Batch 2-A + 2-A2 — Production application".
- **B2-B:** not applied to production (not approved).
- **T-B2-1:** B2-D.

### Status: B2-A2 PASS (founder-accepted 2026-09-17)

| Item | Status |
|---|---|
| D10 | **PASS**: the PostgreSQL fire-time rule is proven, and the real Supabase Auth signup proofs 1–7 pass on TEST |
| D9 (fix forward) and D8 (allow) | approved, implemented; `20260917120000` is unchanged |
| B2-C | PASS, closed |
| Production | completely untouched: no connection, write or migration from this session. Every production fact above came from founder-run read-only queries |
| Production migration | none approved. `20260917120000` + `20260918120000` need PQ-1, PQ-2, PQ-3 and explicit approval |
| B2-B production | NOT APPROVED |
| `syraven-audit.zip` | untouched |

**Final verification, state unchanged since the full run:**

| File | SHA-256 |
|---|---|
| `20260917120000` | `44C91FD3…8FE9` |
| `20260917130000` | `DBD0DEC2…9F47` |
| `20260918120000` | `EA5CCA30…5662` |
| `single-profile-authority-migration.test.ts` | `31BDB30A…21FA` |
| `b2c-profile-backfill.sql` | `46308AE9…1F5D` |
| `b2c-production-profile-counts.sql` | `78ABEBF8…702E` |

The `tsc`, lint and full-suite results above (2,051 tests, 0 fail) apply
to this code and test state. Only this evidence file changed afterwards,
and its readers were re-run.

## Batch 2-A + 2-A2 — Production application (founder-approved and founder-executed, 2026-09-17)

**Status: B2-A production application PASS. B2-A2 production application
PASS.**

**Executed by:** the founder, in the production SQL Editor
(`wpmbumtpcuahyqmdeqgf`), as **one transaction**:

- preflight;
- the statements of `20260917120000` (B2-A);
- the statements of `20260918120000` (B2-A2);
- postflight;
- `commit`.

The migration statements are byte-identical to the files (SHA-256
`44C91FD3…8FE9` and `EA5CCA30…5662`); only the header comments were left
out. This session never connected to production: no MCP, no `.env.local`.

### Attempts

| # | Result | Cause | Effect |
|---|---|---|---|
| 1 | **FAILED** before commit: `42725 operator is not unique: text \|\| "char"` | a postflight expression concatenated `pg_trigger.tgenabled` (type `"char"`) without a cast | transaction aborted; nothing committed |
| 2 | **FAILED** before commit: `POSTFLIGHT FAILED: handle_new_user() definition or EXECUTE grants are not as audited` | see below | transaction aborted; nothing committed |
| 3 | **COMMITTED** | corrected script | read-only verification PASS (below) |

**Fix for attempt 1:** `tgenabled::text` and `tgtype::text`.

**Why attempt 2 failed.** The check required `service_role` EXECUTE, which
is impossible on production:

- production's `handle_new_user()` had `proacl = NULL` (PQ-2). Its
  EXECUTE for `anon`, `authenticated` and `service_role` came only through
  PUBLIC, and the migration's revoke from `public` removed all three;
- on TEST the function was created by the migration, so Supabase's default
  privileges gave `service_role` a direct grant. The check had encoded
  that TEST-only fact;
- the PUBLIC check was also unsafe: `aclexplode(NULL)` returns no rows,
  so a NULL permission list (PUBLIC can execute) read as "no PUBLIC grant".

**Correction:** founder decision **D10 = Option A**: no EXECUTE for
`service_role` on production. The postflight now:

- checks each security condition with its own message;
- detects PUBLIC with `coalesce(proacl, acldefault('f', proowner))`;
- requires `service_role` to have **no** EXECUTE;
- requires the effective permission list to be exactly
  `{postgres=X/postgres}`.

**Transcript note.** After the corrected script was shared, the founder
reported "Success. No rows returned" and believed only the postflight had
run. A postflight alone cannot succeed on an unmigrated database: it
raises on the trigger set and the grants, and needs the preflight's
temporary baseline table. The read-only verification below shows the
full transaction had committed.

### Production read-only verification after commit (founder, `read_only = on`)

| Check | Result |
|---|---|
| `auth_users_triggers` | `on_auth_user_created:O:5,syraven_start_trial_on_email_confirmation:O:17` |
| `trial_function_present` | true |
| `duplicate_function_present` (`provision_profile_for_new_user`) | false |
| `b2b_present` (`provision_personal_account`) | **false** |
| `handle_new_user_effective_acl` | `{postgres=X/postgres}` |
| `anon_exec` / `authenticated_exec` / `service_role_exec` | false / false / false |
| `auth_users` / `profiles` | 7 / 7 |
| `users_without_profile` | 0 |
| `profiles_with_trial_dates` | 0 (changes only when an unconfirmed user confirms; D8 allows the trial) |

### Environment difference, recorded

The EXECUTE grants on `handle_new_user()` differ by environment:

| Environment | Permission list | Source |
|---|---|---|
| Production | `{postgres=X/postgres}` | D10 Option A, founder decision |
| TEST | `{postgres=X/postgres, service_role=X/postgres}` | the function was created there under default privileges |

The migration file is unchanged, and neither environment is client-callable. The trigger works
without EXECUTE, proven by the TEST PostgreSQL proof and the real
Supabase Auth signup proofs 1–7. Aligning TEST (revoking `service_role`
there) is **not done** and would be a separate TEST-only decision.

### Still not done

- B2-B (`provision_personal_account`) on production: **not approved, not
  applied**.
- B2-D (register/login/workspaces flow): not started.
- `supabase_auth_admin` INSERT on `profiles`: Batch 4.
- T-B2-1 (6 production users without an owner membership): B2-D.
- Migration history (`supabase_migrations.schema_migrations`): not
  recorded on production.
- `syraven-audit.zip`: untouched.

## Batch 2-B — Production read-only preflight (founder-run, 2026-09-17)

**Scope:** read-only only. Nothing was applied, provisioned or changed.
The founder ran the preflight query from the B2-B preflight plan in the
production SQL Editor and reported the result as a summary; the full
result row was not pasted.

| Area | Result (founder-reported) |
|---|---|
| `provision_personal_account()` on production | **absent** |
| Runtime prerequisites (`auth.uid()`, `gen_random_uuid`, `hashtextextended`, `pg_advisory_xact_lock`, `auth.users.email_confirmed_at`) | **PASS** |
| Schema: function columns present, no unwritten NOT NULL column | **PASS** |
| Grants, RLS, FORCE RLS and ownership prerequisites | **PASS** |
| **Tenancy baseline** | **NOT READY** for B2-B application |

**Why the tenancy baseline is NOT READY:**

- 6 users lack a Batch 1-owned organization;
- 4 of them are confirmed users;
- 1 `personal-*` organization exists.

**Founder decision:** do **not** apply B2-B to production, do **not**
provision any user, do **not** start B2-D. Next step: a read-only T-B2-1
investigation.

**Not recorded** (the full row was not pasted):

- the exact constraint, trigger and default-ACL strings;
- the `start_trial_on_email_confirmation()` ACL.

The last one stays an open item.

## T-B2-1 — Read-only investigation and founder decision (2026-09-17)

**Scope:** read-only only. No write, provisioning, migration or
application code change.

The founder ran Q-T1, Q-T2 and Q-T3 in the production SQL Editor (each
in a read-only transaction that is rolled back) and accepted the
investigation as **PASS**. Users are identified only by `user_rank`, a
number ordered by account creation time; no id, email or metadata value
was used.

| Query | Result (founder-reported) |
|---|---|
| Q-T1: per user | **PASS**. **4 confirmed users, ranks 1, 2, 5 and 7, have no Batch 1-owned organization.** Of the 6 users without one, the other 2 are unconfirmed |
| Q-T2: the single organization | **PASS**. It belongs to **rank 6** and **satisfies the Batch 1 ownership rule** |
| Q-T3: global conflict checks | **PASS**. **Every tenancy conflict count is 0**: no orphan orgs, no owner-role members that don't own the org, no non-active owner memberships, no user with several owned orgs, no org without a workspace, no dangling users or owners. **The B2-B slug format (`personal-` + 16 hex) is unused** |

**Assessment:**

- The existing `personal-*` organization is rank 6's organization, the one
  user who already owns one.
- It does not conflict with B2-B's lookup or repeat calls: for rank 6,
  B2-B would return that organization and write nothing.
- The slug formats cannot collide. `/api/workspaces` uses `personal-` + 6
  base36; B2-B uses `personal-` + 16 hex.
- T-B2-1 is a missing-provisioning state, not a corrupted one.

### Founder decision

| Item | Decision |
|---|---|
| T-B2-1 handling | **Login-time provisioning via B2-D.** A user without a Batch 1-owned organization is provisioned through `provision_personal_account()` on their next signed-in request (login and `/api/workspaces`) |
| One-time provisioning of existing production users | **Not approved** |
| B2-B production application (`20260917130000`) | **Not approved yet** |
| B2-D implementation | **Not started** (it needs its own instruction). **Superseded:** B2-D1 implemented on repository/TEST — see "Batch 2-D1" |
| Production writes | **None** |

**Rationale:**

- Login-time provisioning keeps a single authority (`provision_personal_account()`,
  which is atomic, safe to repeat and refuses unconfirmed users) for new
  and existing users.
- It needs no founder-run data operation on production.
- It provisions only users who actually sign in, and only once their
  email is confirmed. The 2 unconfirmed users are covered when they
  confirm.

**Order this implies:** B2-D wiring (repository and TEST) → B2-B
production application together with or before the B2-D deploy (the app
calls the function) → B2-D deploy. Each step needs its own founder
approval.

**Still open:**

- The Q-T1 structural cause for ranks 1, 2, 5 and 7 (how those accounts
  were created) is not recorded here beyond the founder-reported PASS.
- The production `start_trial_on_email_confirmation()` ACL is not
  measured.

## Batch 2-D1 — Personal-account provisioning in the application (founder-authorized 2026-09-17)

**Scope:** repository and TEST only. No production write, no B2-B
production application, no production Auth change, no T-B2-1
provisioning, no deploy, no push, no commit. B2-D2 (register/confirm) is
deferred until after B2-F.

### Founder decisions applied

| Decision | Ruling |
|---|---|
| D-B2D-1 | Login provisioning failure → sign-out (local scope) + 403 (refused) / 503 (anything else). Strict fail-closed |
| D-B2D-2 | Existing sessions provision through `POST /api/account/provision`. `GET /api/workspaces` never provisions |
| D-B2D-3 | Only B2-D1 now; B2-D2 register/confirm after B2-F |

D-B2D-1, D-B2D-2 and D-B2D-3 were **APPROVED** by the founder (2026-09-17).

**Production Auth "Confirm email" = ON** — verified read-only by the
founder (2026-09-17); **no Auth setting was changed**. Consequences for
B2-D1:

- GoTrue refuses sign-in for an unconfirmed address, so login answers 401
  with the shared credential message before provisioning is reached. The
  403 path stays as the fail-closed answer for a `42501` from the
  function itself (unconfirmed at the database, no identity, or no
  EXECUTE).
- The 2 unconfirmed production users (T-B2-1) cannot sign in at all until
  they confirm; on their first sign-in after confirming they are
  provisioned. No one-time provisioning is needed for them.
- `provision_personal_account()` keeps its own
  `email_confirmed_at` check: the Auth setting is a GoTrue configuration,
  not a database guarantee, and PostgREST can be called directly.

### What changed (uncommitted)

| File | Change |
|---|---|
| `lib/tenancy/personalAccountResult.ts` (new) | Pure classifier `interpretProvisioning(data, error)`: success only for the exact key set `created, organization_id, workspace_id` with uuid ids and a boolean `created`; error `42501` → `FORBIDDEN`; everything else → `UNAVAILABLE` |
| `lib/tenancy/personalAccount.ts` (new, `server-only`) | `ensurePersonalAccount(client)`: the **only** application caller of `rpc("provision_personal_account")`, with no arguments; exceptions → `UNAVAILABLE`; logs reason/code only |
| `app/api/account/provision/route.ts` (new) | `POST` only, `withAuth`; reads nothing from the request; 200 `{ success, created }` / 403 / 503; `Cache-Control: private, no-store`; returns no ids |
| `app/api/auth/login/route.ts` | After a successful sign-in, provisions on the same (now authenticated) client. On failure: `signOut({ scope: "local" })` (a sign-out error is logged, never hides the failure) and 403 / 503. Success is returned only after provisioning succeeds |
| `app/api/workspaces/route.ts` | `resolveOrganizationId` delegates to `ensurePersonalAccount`. The route's own membership lookup, organisation/membership inserts and compensating delete are removed (second authority gone). `GET` is unchanged and read-only |
| `app/context/WorkspaceContext.tsx` | When the list loads empty, calls `POST /api/account/provision` once per mount (ref guard, no body), throws on failure without reloading, reloads the list only on success |
| `types/database.ts` | `provision_personal_account: { Args: Record<PropertyKey, never>; Returns: Json }` |

### Tests

- New `tests/security/personal-account-provisioning.test.ts`: **43/43
  PASS**. Classifier unit tests (success, 42501, 17 malformed/hostile
  shapes), single-caller and no-argument guards, `server-only` and no
  service role, login ordering / local sign-out / 403-503 / single
  success, provision route shape and middleware non-public, `GET`
  read-only, provider once-per-mount and failure handling.
- Pinned tests of the removed route resolver were **deliberately
  rewritten**, keeping their security intent (the rule now lives in SQL):
  `tests/schema/personal-account-provisioning-migration.test.ts` (1),
  `tests/security/membership-fortress.test.ts` (sections C and E),
  `tests/security/workspaces-route.test.ts` (resolver, provisioning and
  rollback describes). Affected files: **163/163 PASS**. One
  `prefer-template` lint fix in `workspaces-route.test.ts` (pre-existing
  line, no behaviour change).

### TEST live verification (`akhkukajdgayqwhedeoo`; `scratchpad/b2d1-live.mjs` over PostgREST, classified by the repository's `interpretProvisioning`)

| Check | Result |
|---|---|
| Sequential calls, user A | `created` true → false, same organisation and workspace ids |
| **Concurrency: two parallel PostgREST calls**, user B | `created` [false, true] — exactly one creator, same ids |
| Burst of 5 parallel calls after provisioning | all `created: false`, same ids |
| Tenant separation | A and B receive distinct organisations |
| Anonymous call | 401 / `42501` → `FORBIDDEN` |
| Hostile argument body | 404 / `PGRST202` → `UNAVAILABLE` (no overload accepts an id) |
| Database after the run | 2 orgs, 2 memberships, 2 workspaces, 2 `account.provisioned` audit rows; each confirmed user exactly one; no duplicates; 0 advisory locks held |
| Unconfirmed real TEST user (rolled-back SQL) | `42501` "A confirmed email address is required…", 0 organisations |
| Cleanup | provisioned rows and audit rows deleted; baseline restored: 3 users, 3 profiles (hash `50914c968bfb91f6e745c4b0024ab1c6` unchanged), 0 orgs / memberships / workspaces / audit rows, 0 locks |

### Mutation testing (`scratchpad/mutate-b2d1.mjs`, gate 324 MB)

**21/21 CAUGHT** (D01–D21: argument passed, exception → success,
extra/missing keys, uuid skipped, error ignored, login ignores failure /
no sign-out / global sign-out / success on 503 / service role, route reads
body / returns org id / exports GET / becomes public, GET provisions,
route inserts an organisation, provider flag removed / reloads on failure
/ sends identity, second RPC caller, caller passes an id). Baseline fail
0; final fail 0; all 7 files restored by SHA-256.

### Repository verification (300 MB gate, reading logged before each step)

| Step | Gate (MB) | Result |
|---|---|---|
| `npx tsc --noEmit` | 323 | **PASS**, exit 0, 0 errors |
| `npx eslint` on the 11 B2-D1 files | 485, then 315 | 10 files clean. **1 error, pre-existing:** `react-hooks/set-state-in-effect` in `app/context/WorkspaceContext.tsx` (the active-workspace effect, line 765). The HEAD version fails identically (line 712, gate 801 MB). Not introduced and not changed by B2-D1 |
| `npm run test:lowmem` | 847 | **PASS**, exit 0: 2,093 tests, 396 suites, 2,087 pass, 0 fail, 0 cancelled, 6 todo |

### NOT RUN / BLOCKED

- **Route-level HTTP probe** (the three route handlers against TEST
  through a running Next server): **NOT RUN** — memory. **Superseded:**
  run and PASS 40/40 — see "Batch 2-D1 — Route-level verification". The database
  function and the repository classifier were exercised live; the route
  handlers themselves are verified by static guards and mutations only.
- **Browser E2E** (login → dashboard → provisioning): **BLOCKED / NOT
  RUN** — the production build does not fit in machine memory (same
  limitation as Phase 2).

### Deploy dependency (recorded, not approved)

The application now calls `provision_personal_account()`, which does
**not exist on production**. Deploying B2-D1 before B2-B is applied to
production would make every login fail closed with 503 (signed out) and
every workspace creation fail with 503. B2-B production must be applied
before, or together with, any deploy containing B2-D1. Both need their
own founder approval.

### Residual, recorded

- The pre-existing `set-state-in-effect` lint error above.
- Production Auth "Confirm email" is **ON** (founder-verified read-only,
  2026-09-17, nothing changed): unconfirmed users are refused at sign-in
  by GoTrue (401), so they never reach provisioning.
- B2-D2 (register/confirm flow), B2-E, B2-F: not started.

### Status: B2-D1 PARTIAL (repository and TEST) — awaiting founder decision

Everything that ran passed. It is PARTIAL only because the route-level
HTTP probe is NOT RUN and browser E2E is BLOCKED.

The founder accepted B2-D1 as PARTIAL (2026-09-17) and ordered the
route-level check; it has since PASSED (below). B2-D1 remains PARTIAL only
for browser E2E.

## Batch 2-D1 — Route-level verification (founder-ordered 2026-09-17)

**Scope:** the B2-D1 route handlers through a running Next.js server
against TEST. No production, no browser, no code change, no commit.

### Harness (scratchpad; nothing in the repository changed)

- **Secret-free scratch copy** of the working tree (`scratchpad/b`):
  - 328 files, 0 hash mismatches.
  - 0 `.env*` files, no `supabase/.temp`.
  - `syraven-audit.zip` excluded by name and never read.
  - The 8 B2-D1 / auth-boundary files are hash-identical to the
    repository.
- **`next dev` (16.3.4, Turbopack) on `127.0.0.1:3100`**, started by
  `rl-start-next.mjs`:
  - Every secret-named variable is removed.
  - Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set.
  - There is no service-role key in the server, so every database call is
    the caller's own under RLS.
- **Supabase proxy** (`rl-proxy.mjs`, `127.0.0.1:54399`):
  - The server's Supabase URL points at it, and it forwards to TEST.
  - It refuses to start for any upstream other than
    `akhkukajdgayqwhedeoo`.
  - It records each server request as method + path + query **keys**
    only (no bodies, headers, tokens or ids).
- **Fault injection**, only on
  `POST /rest/v1/rpc/provision_personal_account`, switched per check:

  | Mode | Injected response |
  |---|---|
  | `forbidden` | 403 / `42501`, the shape TEST returns for an unconfirmed user |
  | `internal` | 500 / `XX000` |
  | `missing` | 404 / `PGRST202` |
  | `malformed` | 200 with an extra key |
  | `nonuuid` | 200 with a non-uuid id |
  | `reset` | connection destroyed |

  **No DDL, ACL, `auth.users` or data change was used to create a
  failure.**
- **Probe:** `rl-probe.mjs`. It prints statuses, booleans and upstream
  paths only.

### Results — 40/40 PASS (second run)

| # | Check | Result |
|---|---|---|
| R01 | `POST /api/account/provision` unauthenticated | 401, no upstream call |
| R02 | `GET` / `POST /api/workspaces` unauthenticated | 401 / 401, no upstream call |
| R03 | provision with a forged bearer | 401, only `GET /auth/v1/user`, no RPC |
| R04 | `GET /api/account/provision` | 405, no RPC |
| R05 | `GET /api/workspaces`, user without an organisation | 200 `[]`; upstream only `GET /auth/v1/user` + `GET /rest/v1/workspaces`; **no RPC, no write** |
| R06 | provision with hostile body (`organization_id`, `user_id`, `owner_id`) and `?user_id=` | 200 `{created: true, success}` (exact keys), `Cache-Control: private, no-store`; upstream exactly `GET /auth/v1/user` + one RPC; no direct organisation writes |
| R07 | provision again | 200 `created: false` |
| R08 | `GET /api/workspaces` after provisioning | 1 workspace, no RPC, no write |
| R09 | **two parallel provision requests through the server** (user A) | both 200, `created` [false, true] |
| R10 | login, wrong password | 401; upstream only the token grant; **provisioning never called** |
| R11 | login success | 200 `{success: true}` only; session cookie set; upstream: token grant **then** one RPC; no logout |
| R12 | provision with the login cookie session | 200 `created: false` |
| R13 | `GET /api/workspaces` (cookie) | 1 workspace, read-only, organisation ≠ B's |
| R14 | `POST /api/workspaces` with **B's `organization_id`**, forged `created_by` / `owner_id` in the body | 201 in **A's own organisation** (not B's); upstream: auth, one RPC, one `POST /rest/v1/workspaces`; **no `organizations` / `organization_members` call, no DELETE** |
| R15 | login with provisioning `forbidden` | **403** "Confirm your email address before signing in."; upstream token → RPC → `POST /auth/v1/logout?scope`; auth cookie cleared; the returned cookie jar → 401 |
| R16 | the earlier R11 session after R15's sign-out | still valid (403, not 401): the sign-out was local, not global |
| R17a–c | `forbidden`: provision / `POST /api/workspaces` / `GET /api/workspaces` | 403 / 403 with no workspace insert / 200 without an RPC |
| R18, R20, R22, R24, R26 | login with `internal`, `missing`, `malformed`, `nonuuid`, `reset` | each **503** "Account setup is temporarily unavailable.", local logout, cookie cleared, jar → 401 |
| R19, R21, R23, R25, R27 (a–c) | the same five modes: provision / `POST /api/workspaces` / `GET /api/workspaces` | 503 / 503 with no workspace insert / 200 without an RPC |
| R28 | injection off: login, then `GET /api/workspaces` | 200; 2 workspaces (personal + R14), all in A's organisation |

**Database after the run** (read-only SQL, before cleanup):

- 2 organisations, 2 active owner memberships, 3 workspaces.
- 2 `account.provisioned` audit rows: R09 created one account, not two.
- 0 users with several memberships.
- 0 organisations without an owner membership.
- 0 workspaces outside their creator's organisation.
- 0 organisations for unconfirmed users.
- 0 advisory locks.
- Function ACL `{postgres=X/postgres,authenticated=X/postgres}` and
  source md5 `fe797dd8…52b8` unchanged.

### First attempt (recorded, not hidden)

1. **Incomplete scratch `node_modules`.** `next/dist/compiled/webpack`
   held 2 of 28 files, the same defect seen in Phase 2, and the server
   exited with `MODULE_NOT_FOUND`. Repaired by `robocopy /MIR` of
   `node_modules` into the scratch copy only (exit 1 = files copied). The
   directory counts then matched.
2. **Server exit during the first probe run.**
   - R01–R08 PASS, then the Next dev process exited silently at R09
     (`ECONNRESET`).
   - There was no application error and no crash event; free memory was
     162–206 MB on a 3.9 GB machine. Probable cause: memory pressure (not
     proven).
   - R09's requests never reached the proxy.
   - The state R06 wrote (1 organisation, 1 membership, 1 workspace,
     1 audit row) was verified and cleaned to baseline.
   - The whole probe was then run again, unchanged, after the 300 MB gate
     (server start 300 MB, probe start 397 MB): 40/40 PASS, server alive
     afterwards.

### Cleanup

- Only the server and proxy started for this check were stopped; ports
  3100 and 54399 are closed.
- TEST restored to baseline: 3 users, 3 profiles (profile md5
  `5baf2912…148f`, identical to the pre-run baseline), 0 organisations /
  memberships / workspaces / audit rows, 0 advisory locks. Function ACL
  and source unchanged.
- Repository working tree unchanged: 26 entries, HEAD `6f60179`.

### Status

- Route-level check: **PASS** (40/40).
- B2-D1 stays **PARTIAL** (founder-accepted) only because browser E2E is
  BLOCKED / NOT RUN.

## Batch 2-B — Production application (founder-approved and founder-executed, 2026-09-17)

**Scope:** the migration `20260917130000_syraven_personal_account_provisioning.sql`
only. No row was created or changed, no user provisioned, no Auth setting
touched, no deploy, no push. Every production step was run by the founder
in the SQL Editor; this session has no production connection.

### What was applied

One `create or replace function`, one `revoke`, one `grant`, inside a
single transaction that ended with an in-transaction verification block.
The function creates no rows of its own; the application does not call it
until B2-D1 is deployed.

### Precheck (founder-run, read-only, PASS)

A single statement, validated against TEST before it was handed over.
Every STOP condition was checked and none triggered:

| Check | Required | Result |
|---|---|---|
| `provision_personal_account()` already present | false | **absent** |
| Runtime: `auth.uid()`, `gen_random_uuid`, `hashtextextended`, `pg_advisory_xact_lock`, `auth.users.email_confirmed_at` | all present | **PASS** |
| `postgres` may read `auth.users` | true | **PASS** |
| Table owner / FORCE RLS on the four tables | `postgres` / false | **PASS** |
| INSERT trigger on the four tables | none | **none** |
| `workspaces` unique index | `(organization_id, slug)`, not a global `(slug)` | **PASS** |
| NOT NULL column without default that the function does not write | none | **none** |
| B2-B slug format (`personal-` + 16 hex) already in use | 0 | **0** |

### Application

Run as one transaction. The verification block would have raised — and
rolled the whole transaction back — on a wrong `search_path`, a
non-definer function, arguments, a wrong return type, a body that differs
from the TEST-verified source, an unexpected ACL, or executable-by-`anon`
/ `service_role`. It committed, and reported the CRLF notice described
below.

### Postcheck (founder-run, read-only, PASS)

| Property | Production value |
|---|---|
| Function present | **yes** |
| Owner | `postgres` |
| SECURITY DEFINER | **true** |
| `search_path` | **empty** (`search_path=""`) |
| ACL | `{postgres=X/postgres,authenticated=X/postgres}` |
| `authenticated` EXECUTE | **true** |
| `anon` EXECUTE | **false** |
| `service_role` EXECUTE | **false** |
| Tenancy baseline | **unchanged**: users 7, confirmed users 5, organizations 1, memberships 1, workspaces 1, audit rows 89 |

### Body equivalence: production stores CRLF, the repository stores LF

The live body hashes to `a63ac26462dea250612970ab387541de`, not to the
canonical `fe797dd80cdd833004b849cb836852b8`. It is the **CRLF variant of
the same bytes**, predicted from the source *before* the migration was
run, which is why the verification block compares the LF-normalised hash
and only raises a notice for CRLF.

| Form | Bytes | md5 |
|---|---|---|
| Migration body, LF (canonical, repository) | 2,586 | `fe797dd80cdd833004b849cb836852b8` |
| The same body with every LF → CRLF | 2,682 | `a63ac26462dea250612970ab387541de` |
| Live production body (founder-reported) | — | `a63ac26462dea250612970ab387541de` |

- The delta is 96 bytes and the body has exactly 96 newlines: one CR per
  line, nothing else. Any other difference would change the hash.
- The comparison is a local, read-only computation on the migration file
  plus the reported hashes. No production access was used.
- **Behaviour is identical.** The body has 23 single-quoted literals and
  none spans a line, so no CR can enter a string (error messages, `'owner'`,
  `'active'`, the slug prefix, the audit action and the advisory-lock key
  are unchanged), there is no nested dollar-quoting, and CR is whitespace
  to the SQL and PL/pgSQL lexers.
- **Consequence to remember:** a future `md5(prosrc)` check on production
  must compare against `a63ac264…41de`, or normalise CRLF → LF first. The
  normalising form is the one to keep. Re-applying the migration to
  "correct" the line endings would be a pointless production write and is
  not planned.

### What this does and does not prove

- Proven on production: identity, privileges, definer, `search_path` and
  that the body is the TEST-verified one.
- **Not re-proved on production:** idempotency, the advisory-lock
  serialisation, the email-confirmation refusal and the Batch 1 ownership
  rule. They need calls that write, and no live provisioning proof was
  run. They are proved on TEST (sequential, two parallel calls, a 5-call
  burst, unconfirmed refusal, 40/40 route-level) and carried over by the
  body equality above.

### Expected side effect, recorded

Since the grant is live, any **authenticated** production user can call
the RPC directly through PostgREST before B2-D1 is deployed. This is by
design and fail-closed: it provisions only the caller's own account, and
only with a confirmed email address. The 2 unconfirmed users cannot use
it at all.

### Status

- B2-B: **PASS** on repository, TEST and production.
- T-B2-1 is not resolved by this: no user was provisioned. Those users are
  provisioned on their next sign-in once B2-D1 is deployed.
- The B2-D1 deploy is no longer blocked by the database. It is still
  **not approved**, and any push deploys every unpushed commit.

## B2-D1 — Production deployment (founder-approved and founder-instructed, 2026-09-18)

**Scope:** the deployment only. No production write, no provisioning call,
no Auth change, no migration. The production verification of the result is
**NOT RECORDED** below — see "Verification status".

### Pre-deploy gate (this session, 2026-09-18)

| Check | Result |
|---|---|
| HEAD / branch | `7b3e612` on `main` |
| Staged / unstaged / HEAD vs working tree | 0 / 0 / 0 |
| Untracked | only `syraven-audit.zip` (untracked, never opened, unchanged) |
| Full suite at HEAD | **PASS** — 2,093 tests, 2,087 pass, 0 fail, 6 todo, exit 0 (gate 388 MB) |
| Secret scan over `origin/main..HEAD` | 0 hits across 39,282 added lines |
| Forbidden paths in the range | 0 (`.env*`, `.pem`, `.key`, `.zip`, storageState) |
| Tracked `.env*` / `.zip` files at HEAD | 0 / 0 |
| Case-colliding or non-ASCII filenames at HEAD | none (the one non-ASCII path is deleted by this range) |
| API routes removed vs the deployed tree | **none**; 7 added, including `account/provision` |
| New environment variables required | **none** — the same names the deployed tree already read |
| B2-D1 database dependency | satisfied: `provision_personal_account()` applied to production 2026-09-17 |

**Scope warning recorded before the push:** the deploy carried **88
commits** (`fd73f2b..7b3e612`) — the whole of Phases 1, 2 and 3, not only
B2-D1. Cherry-picking B2-D1 alone was assessed as not viable: it depends on
the Phase 1/2 tree. The founder approved the deployment on that basis.

### Preview deployment

A temporary branch `preview/b2d1-7b3e612` was pushed first, at the same
commit (`7b3e6121aecf1f1ad3ced84c8523b2b55efddb94`, confirmed by
`git ls-remote`). Its Vercel build status and URL are **NOT RECORDED**:
this session has no Vercel access and `gh` is not installed, and no result
was reported back to it.

### Production deployment

| Item | Value |
|---|---|
| Command | `git push origin main` (run on the founder's explicit instruction) |
| Output | `fd73f2b..7b3e612  main -> main` (fast-forward, no force) |
| Pushed SHA | `7b3e6121aecf1f1ad3ced84c8523b2b55efddb94` |
| Repository | `github.com/canalikaraca62-oss/nova-ai` |
| Commits shipped | 88 (`fd73f2b..7b3e612`) |
| Deployment mechanism | Vercel Git integration; `main` deploys production |
| Vercel build status / URL | **NOT RECORDED** — not reported to this session |

### Post-deploy production verification (founder-run read-only, founder-reported, 2026-09-18)

**PASS.** The read-only statement was run in the production SQL Editor and
its result reported. No write, no RPC call, no provisioning was performed;
the output carries no id, email, slug value or metadata content.

| Counts | Baseline (pre-deploy, B2-B postcheck) | After the smoke test |
|---|---|---|
| users | 7 | 7 |
| confirmed users | 5 | 5 |
| organizations | 1 | **2** |
| memberships | 1 | **2** |
| workspaces | 1 | **2** |
| audit rows | 89 | **90** |

| Provisioning events | Value |
|---|---|
| total `account.provisioned` | **1** |
| distinct users | **1** |
| in the last 24 h | **1** |
| minutes since the latest | **27** |
| all written by the function (`metadata.source`) | **true** |

| Correlation | Value |
|---|---|
| the audit row's user owns the organisation it names | **true** |
| that user holds an active owner membership there | **true** |
| the workspace named by the row belongs to that organisation | **true** |
| organisations carrying the B2-B slug format (`personal-` + 16 hex) | **1** |

| Tenancy integrity | Value |
|---|---|
| users with several owned organisations | **0** |
| organisations without an owner membership | **0** |
| organisations for unconfirmed users | **0** |
| organisations without a workspace | **0** |
| duplicate provisioning rows per user | **0** |
| users without a Batch 1-owned organisation | **5** (was 6) |
| advisory locks held | **0** |

**This correlates the successful production smoke test with exactly one
new provisioning event.** Organisations, memberships, workspaces and audit
rows each rose by exactly one against a baseline taken before any B2-D1
code was live; there is exactly one `account.provisioned` row, for one
user, written by the function, 27 minutes before the check; and
`users_without_owned_org` fell from 6 to 5 — the same single user. The
B2-B slug count of 1 confirms the organisation was created by
`provision_personal_account()`, not by the old application path (the
pre-existing organisation uses the route's 6-character suffix, and the
T-B2-1 investigation recorded the 16-hex format as unused).

**What this proves on production, with real data:** identity binding
(the row's user is the organisation's owner and its active owner member),
atomicity (organisation, membership, workspace and audit row all appear
together), single authority (the audit metadata names the function), and
no duplication under a real sign-in (one row, one organisation, no
lingering advisory lock).

**Unchanged and therefore not exercised here:** users and confirmed users
stayed at 7 and 5, so no registration or confirmation path was involved.
The remaining 5 users without an organisation are provisioned on their own
next sign-in, once confirmed; no user was provisioned by hand.

**Still NOT RECORDED:** the Vercel build status and the preview URL. The
smoke test succeeding establishes that the deployment is live and serving
this tree; the build log itself was not reported to this session.

### Status

- Deployment: **done**, SHA above.
- Post-deployment production verification: **PASS** (founder-run read-only,
  founder-reported) — see the section above.
- T-B2-1: **6 → 5**. One user was provisioned by their own sign-in through
  the deployed path; the remaining 5 are provisioned on their next sign-in
  once confirmed. No user was provisioned by hand.
