# Migrations awaiting approval

**Status 2026-09-14:** the two Phase 1 migrations (1, 2) are **applied
and verified on TEST and PRODUCTION** by the founder, through the SQL
Editor. Migration history: not recorded on TEST, not reported on
PRODUCTION. Migrations 3 and 4 are **not applied** anywhere and still
need explicit approval. Because the history may lack 1 and 2, a
`db push` would re-run them and apply 3 and 4 unapproved — see "To
apply" below.

| Order | Migration | Closes / adds | Urgency |
|---|---|---|---|
| 1 | `20260913120000_syraven_profiles_billing_lockdown.sql` | A signed-in user can set their own `plan`, `subscription_status` and `trial_ends_at` through PostgREST (`profiles_update_own` + the blanket DML grant) and receive paid-plan limits | **APPLIED — TEST + PRODUCTION (founder, 2026-09-14)** |
| 2 | `20260913130000_syraven_tenant_write_boundaries.sql` | `messages` insert into another user's conversation; `projects` planted in another organization; `agent_approvals` rows rewritable (expiry past the TTL, tool, effect, scope) | **APPLIED — TEST + PRODUCTION (founder, 2026-09-14)** |
| 3 | `20260909120000_syraven_integration_connections.sql` | Connector connection table (section below) | Needed before any connector |
| 4 | `20260910120000_syraven_jobs_lease_policy.sql` | Cancel-own-jobs policy, column-level update grant on `jobs` | Needed before any job runner |

Each Phase 1 file states its hole, its fix, its **expected production
effect** and its rollback in its header. Neither was executed against a
database: no local Postgres exists on the machine that wrote them.

**Before applying 1:** compare `profiles.plan` with the Stripe
subscription of record for every non-free row — the migration closes the
hole; it does not detect rows already edited through it.

**Before any job runner exists (not fixed by 4):** `jobs` INSERT is
open to `authenticated` with a client-chosen `priority`, `status` and
`payload`, and `claimNextJob` claims across tenants by priority using
the service role. A runner must not ship until job creation is
server-only (ARCHITECTURE_NORTH_STAR.md §9).

**Known repository defect, not fixed here:**
`20260908120000_syraven_canvases.sql` calls `public.set_updated_at()`,
which no migration defines (`handle_updated_at` exists). Production
evidently has the function; a database built from these migrations
alone would fail at that file. Changing an applied migration is not
safe; the fix is a new migration, when the test project is next rebuilt.

---

## 3. `20260909120000_syraven_integration_connections.sql`

---

## Why it is needed

`services/integrations/` holds roughly 5,850 lines of real API clients —
Gmail, Google Calendar, GitHub, Slack, Notion — that call the genuine
REST endpoints of those services. Nothing imported them. No route, no
orchestration tool, no UI, and nowhere to keep a credential.

So the product's central promise stopped at its own boundary. The
orchestrator had six tools, all internal (knowledge and task CRUD), and
could not send an email because it had no way to ask whether the user
had connected an account.

The missing piece was never the HTTP calls. It was a table.

## What it creates

One table, `public.integration_connections`, recording that a user has
connected an account with a provider, what that connection is permitted
to do, and whether it is still usable.

## What it deliberately does NOT store

**No credentials.** There is no `access_token` column and no
`refresh_token` column.

A refresh token is a long-lived bearer credential for somebody's real
mailbox. Postgres RLS protects a row from other *tenants*; it does not
protect it from a SQL injection in any route that reaches the table,
from a database backup, from a support engineer with read access, or
from a logged query plan. A table that is safe against the tenant next
door is not the same as a table that is safe to put mail credentials in.

`credential_ref` holds an **opaque pointer** into a secret store. The
pointer is useless alone: it names a location that requires separate
authentication to read. Choosing that store is a deployment decision,
not a schema one, so this migration does not presume it.

**This means applying the migration does not by itself enable any
connector.** A secret store and the OAuth flow that writes into it are
still required. What the migration unlocks is the ability to record and
check connection state.

## Safety

| Property | Status |
|---|---|
| Additive | One `CREATE TABLE` plus its policies, indexes and grants |
| Idempotent | `create table if not exists`, `drop policy if exists` |
| Destructive statements | None — no `DROP`, `TRUNCATE`, `ALTER COLUMN` |
| Existing tables touched | None |
| Backfill required | None. An empty table means "nobody has connected anything", which is the truthful state |
| Reversible | `drop table public.integration_connections;` |
| RLS | Enabled **before** any policy exists, so there is no window in which the table is readable by `anon` |
| Policies | Owner-scoped on all four verbs (`auth.uid() = user_id`) |
| Anon grants | Explicitly revoked |

`workspace_id` exists for scoping but appears in **no policy predicate**.
Being a member of a workspace must not grant use of another member's
mailbox. Shared, organisation-level connections are a real product need
and a genuinely harder consent question; they are deliberately out of
scope rather than smuggled in as a side effect.

The `UNIQUE (user_id, provider, external_account_id)` constraint lets one
person connect two different Gmail accounts while preventing duplicate
rows for the same one — which would make "is this connected?" ambiguous
and revocation unreliable.

## How it was verified without applying it

`tests/security/connector-capabilities.test.ts` (35 tests) asserts
against the migration source and the capability layer that reads it:

- no token, secret or key column is declared — verified by adding a
  `refresh_token` column and watching the test fail
- an opaque `credential_ref` is present instead
- RLS is enabled and all four verbs are owner-scoped
- delete exists, so a user can always withdraw access to their own
  mailbox
- no policy grants access via workspace membership
- `anon` is granted nothing
- the migration is additive and idempotent

`tests/schema/migration-integrity.test.ts` covers it under the existing
repository-wide invariants (additive, idempotent, foreign keys declared
after their targets, policies re-appliable).

## Current behaviour without it

Correct and honest. The table does not exist, so every connection lookup
fails, which reads as "nothing is connected" rather than crashing an
agent run. A goal like *"email Ahmet that the meeting moved"* plans a
real send and then resolves to:

> Connect Gmail to do this.

That is the intended state — materially better than the model inventing
a step while the interface implies the mail went out.

## To apply — applies to every migration in this file

**Never run `supabase db push` from this checkout.** The Supabase CLI
here is linked to the **production** project
(`supabase/.temp/project-ref` = `wpmbumtpcuahyqmdeqgf`), and `db push`
applies *every* local migration missing from the target's history — today
all four migrations in the table at the top, not the one you approved.

Apply one approved file at a time, to the **test** project
(`akhkukajdgayqwhedeoo`) before production:

1. Get explicit founder approval for that one file, and for the target.
2. Open the target project's SQL editor in the Supabase dashboard and
   confirm the project ref in the URL before running anything.
3. Paste that single file and run it.
4. Record it in that project's migration history so a later push cannot
   re-run it: `supabase migration repair --status applied <version>`,
   pointed explicitly at the verified target (see
   `supabase migration repair --help` for the target option). Never rely
   on the default link without checking which project it names.
5. Run the read-only checks for that migration (Phase 1 Step 1 report),
   e.g. `select has_table_privilege('authenticated', 'public.profiles', 'UPDATE');`
   must return `false` after `20260913120000`.

Nothing in this repository applies a migration automatically.
