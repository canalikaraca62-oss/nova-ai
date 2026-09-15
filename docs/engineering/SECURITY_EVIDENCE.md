# SYRAVEN — Security Evidence (Phase 3)

Every Phase 3 change has a record here **before** it is made. Findings
and severities come from the Phase 3 preflight (2026-09-15, HEAD
`187e5fd`); they are not re-rated here.

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
- **TEST probe: PENDING.** It needs the migration on TEST and a second TEST
  user.
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

**Status: NOT APPLIED to TEST or production.** The TEST order is:
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
