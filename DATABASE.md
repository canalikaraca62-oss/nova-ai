# SYRAVEN — DATABASE

**Last updated:** 2026-09-04 (Phase 2)
**Scope:** schema, migrations, RLS model, and known divergences.

This document records what the database **actually is**, not what it should
be. Where something could not be verified, it says so.

---

## 1. Migration set

| # | File | Purpose |
|---|---|---|
| 1 | `20260901154222_syraven_enterprise_core.sql` | Organizations, workspaces, projects, API keys, audit logs, jobs, workflows, webhooks, feature flags (18 tables) |
| 2 | `20260901154640_syraven_ai_core.sql` | AI agents, conversations, memories, knowledge bases, executions, budgets (25 tables) |
| 3 | **`20260901165000_syraven_baseline_drifted_tables.sql`** | **Phase 2** — the 13 tables that existed only in the hosted project |
| 4 | `20260901165535_syraven_missing_app_tables.sql` | Teams, knowledge, notifications, tasks, usage_events (5 tables) |
| 5 | **`20260904120000_syraven_function_hardening_and_grants.sql`** | **Phase 2** — restores `search_path` on `handle_updated_at()`; revokes stray `anon` grant on `messages` |
| 6 | **`20260904122000_syraven_rls_coverage.sql`** | **Phase 2** — RLS on 17 tables, 42 owner-scoped policies |
| 7 | **`20260904123000_syraven_policy_idempotency_repair.sql`** | **Phase 2** — records and diagnoses migration 1's unguarded policies |

Total: **61 tables**, matching the live database exactly.

### 1.1 Ordering is load-bearing

`20260901165000` (the Phase 2 baseline) **must** sort before
`20260901165535`. That migration creates `public.tasks` with:

```sql
agent_id uuid references public.agents(id) on delete set null
```

…but **no migration ever created `public.agents`** — it was one of the
drifted tables. Migration 4 therefore fails on a fresh database with
`relation "public.agents" does not exist`.

It only ever succeeded against the hosted project because `agents` had
already been created there by hand.

> **The migration set was never reproducible.** The failure was invisible
> precisely because nobody could rebuild the database. Phase 2's baseline
> is timestamped `165000` specifically to close this.

Because the baseline is inserted *before* an already-applied migration,
pushing requires:

```bash
npx supabase db push --linked --include-all
```

---

## 2. Schema drift (resolved)

ARCHITECTURE_AUDIT.md §9.1 recorded 61 live tables against 48 in
migrations. The 13 untracked tables, now baselined:

| Table | Used by application code | Notes |
|---|---|---|
| `profiles` | ✅ `billing/webhook`, `usage` | **All billing state**: `plan`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, trial dates |
| `usage` | ✅ `api/usage` | All metering |
| `agents` | ✅ `api/agents`, `api/tasks` | Legacy agents; distinct from `ai_agents` |
| `user_settings` | — | Per-user preferences |
| `agent_conversations` | — | |
| `agent_messages` | — | |
| `agent_tasks` | — | |
| `agent_runs` | — | Token/cost accounting |
| `chats` | — | Legacy chat container |
| `conversations` | — | Newer chat container |
| `messages` | — | Largest live table (296 kB) |
| `files` | — | `storage_path` is UNIQUE |
| `memories` | — | |

Only 3 of 13 are referenced by current code; the rest are legacy but are
captured so the database is reproducible.

### 2.1 How the baseline was reconstructed

Docker was unavailable, so `supabase db dump` and `supabase db reset`
could not run. Definitions were reconstructed from two **read-only**
sources against the live database:

1. **PostgREST OpenAPI** (`GET /rest/v1/`, `Accept: application/openapi+json`)
   — column names, types, nullability, defaults, primary keys, and
   foreign keys within `public`.
2. **`supabase inspect db index-stats --linked`** — real index names and
   their column lists (this works without Docker).

Every one of the 13 tables was then **verified column-for-column**
against the live schema: 13/13 tables, 0 discrepancies in column
presence or nullability.

### 2.2 Unverified schema elements

These could not be read through any available interface and are
therefore **not asserted** in the baseline. They are the main residual
risk in this phase.

| Element | Status | Consequence |
|---|---|---|
| FKs into `auth.users` | **UNVERIFIED** | `user_id` columns are declared `uuid` with no FK. If production has `references auth.users(id) on delete cascade`, a rebuilt database will not cascade user deletions. |
| `CHECK` constraints | **UNVERIFIED** | e.g. `status`/`role`/`plan` may be constrained in production; a rebuilt database would accept values production rejects. |
| Triggers | **UNVERIFIED** | `updated_at` may not auto-update on the drifted tables in a rebuilt database. |
| RLS enabled state (pre-Phase 2) | **UNVERIFIED** | Migration 6 enables RLS explicitly, so the end state is known even though the prior state is not. |
| Policy bodies (pre-Phase 2) | **UNVERIFIED** | Same. |

**Deliberately conservative:** adding an unverified FK or CHECK would
make a fresh database *stricter* than production and could reject writes
production accepts. Omitting is the safer error.

**To close these gaps:** follow `supabase/SCHEMA_DUMP_INSTRUCTIONS.md`,
then reconcile in a follow-up migration.

---

## 3. RLS model

### 3.1 Present reality

Application routes use `supabaseAdmin` (service role), which **bypasses
RLS entirely** (ARCHITECTURE_AUDIT.md §8.6). Today, safety rests on the
explicit `user_id` filters added in Phase 1.

RLS is therefore **defence in depth** right now. It becomes the primary
control in **Phase 3**, when routes move to a user-scoped client.

### 3.2 Policy pattern

Owner-scoped, following the convention set by migration 4:

```sql
create policy "<table>_<action>_own"
on public.<table>
for <action>
to authenticated
using (auth.uid() = user_id);
```

### 3.3 Coverage after Phase 2

| Category | Tables | Policy shape |
|---|---|---|
| Full owner control | `agents`, `agent_conversations`, `agent_tasks`, `chats`, `conversations`, `user_settings`, `memories`, `teams` | select / insert / update / delete |
| Owner read + write, no delete | `profiles` | select + update (billing state must not be client-deletable) |
| **Read-only to owner** | `usage`, `usage_events`, `agent_runs` | select only |
| Ownership via parent | `agent_messages` (→ conversation), `agent_runs` (→ agent), `messages` (→ conversation / chat / own `user_id`) | `exists (...)` |
| Insert + read, no update | `files` | select / insert / delete |

**Metering is deliberately read-only.** A client that could write its own
`usage` or `usage_events` rows could forge consumption and defeat the
limits Phase 5 will enforce. Those rows are written only by server code
through the service role.

### 3.4 Deliberate deny-all tables

RLS enabled, **no policies**, by design (ARCHITECTURE_AUDIT.md §8.7).
Each is infrastructure touched only by trusted server code:

| Table | Why deny-all |
|---|---|
| `feature_flags` | Deployment configuration |
| `organization_feature_flags` | Deployment configuration |
| `rate_limit_events` | Abuse telemetry — a readable/writable limit log defeats rate limiting |
| `webhook_deliveries` | Delivery log containing provider payloads |
| `workflow_steps` | Engine internals |
| `organization_invites` | **Deferred, not decided.** An invitee reading their own invite is a plausible need, but the correct predicate depends on the membership model Phase 3 defines. Widening it now means guessing. |

This absence is a **decision**, not an oversight.

### 3.5 Nullable owner columns

`teams.owner_id`, `chats.user_id`, and `messages.user_id` are nullable.
`auth.uid() = owner_id` evaluates to NULL (not true) for an ownerless
row, so such rows are invisible to every non-service caller. That is the
safe default.

---

## 4. Known issues

### 4.1 Fixed in Phase 2

**`handle_updated_at()` lost its `search_path` guard.**
Defined in both migration 1 (with `set search_path = public`) and
migration 4 (**without**). The later definition wins, silently
downgrading all **14 triggers** that use it. A trigger function with a
mutable `search_path` can be redirected by a caller-controlled
`search_path`. Migration 5 restores the hardened definition, and
`tests/schema/migration-integrity.test.ts` asserts the winning
definition always sets `search_path`.

**`public.messages` granted `SELECT` to `anon`.**
Verified live: an anonymous caller got HTTP 200 from
`/rest/v1/messages`, while every other table returned 401 (error
`42501`). **Not an active breach** — 0 rows were returned and writes were
denied — but it was the sole table inconsistent with the rest. Migration
5 revokes it. `authenticated` and `service_role` are untouched.

### 4.2 Open

**Migration 1's 29 policies are not idempotent.**
It uses bare `create policy` with no `drop policy if exists`; PostgreSQL
has no `create policy if not exists`. Re-applying it fails with `policy
"..." already exists`.

*Not fixed by editing* — migration 1 is already applied, and changing it
would desync migration history. Mitigations:

- a fresh `db reset` applies each migration once, so the gap does not bite;
- the failure only occurs when re-running an applied migration, which the CLI does not do;
- **all new migrations must guard policies**, enforced by `tests/schema/migration-integrity.test.ts`.

**`SUPABASE_DB_URL` is wrong.**
It points at `db.<ref>.supabase.co`, which no longer resolves
(`ENOTFOUND`) — Supabase moved projects to pooler hostnames. Any tooling
depending on it fails. The correct string is in **Dashboard → Project
Settings → Database**. Unrelated to the migrations, but it blocks local
tooling.

**Duplicate domain models.** `agents` vs `ai_agents`, `chats` vs
`conversations`, `usage` vs `usage_events`, `memories` vs `ai_memories`
all coexist. Both halves are preserved — consolidation is a product
decision, not a Phase 2 one.

---

## 5. Reproducibility status

| Property | Before Phase 2 | After Phase 2 |
|---|---|---|
| Tables in migrations | 48 of 61 | **61 of 61** |
| Fresh `db reset` succeeds | ❌ fails on `tasks → agents` | ✅ ordering fixed |
| Billing state (`profiles`) versioned | ❌ | ✅ |
| Metering (`usage`) versioned | ❌ | ✅ |
| Deliberate RLS decision per table | ❌ 8 gaps | ✅ all recorded |
| Drift detectable in CI | ❌ no tests | ✅ 56 tests |

### 5.1 Not yet verified

The plan's acceptance test — `supabase db reset` on a fresh instance,
diffed against production — **has not been run**, because it requires
Docker. What *was* done instead:

- every baseline column verified against the live schema (13/13, 0 discrepancies);
- 42 policies verified to reference only columns that exist;
- FK ordering verified across all 7 migrations;
- 56 automated tests covering non-destructiveness, idempotency, ordering, RLS coverage, and function hardening.

That is strong evidence, **not proof of byte-identical reproduction**.
The remaining step needs Docker or a schema dump.

---

## 6. Applying these migrations

**Not yet applied.** The files are in the repository; the live database
is unchanged.

```bash
# preview
npx supabase db push --linked --dry-run --include-all

# apply
npx supabase db push --linked --include-all
```

`--include-all` is required because the baseline is intentionally
timestamped before an already-applied migration (§1.1).

**Before applying to any environment with real data:** take a backup.
All migrations are additive and were validated against a database where
every table held **0 rows**; behaviour with populated tables (especially
enabling RLS) should be reviewed against that environment first.
