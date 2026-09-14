# ADR-003 — For client writes, the database is the boundary of record

- **Status:** Accepted (Phase 1, 2026-09-13)
- **Extends:** ADR-001 §6 (AI is never authoritative) — the same reasoning
  applied to the client
- **Migrations:** `20260913120000_syraven_profiles_billing_lockdown.sql`,
  `20260913130000_syraven_tenant_write_boundaries.sql` (both **NOT APPLIED**)
- **Checked by:** `tests/security/architecture-invariants.test.ts`
  invariants 2, 6 and 12 (replay the migrations in order; assert the
  final policy and privilege state)

## Context

`20260906120000` grants `select, insert, update, delete` on every public
table to `authenticated`. Every signed-in user holds the public anon key
and their own session token, so they can call PostgREST directly and
skip every route in `app/api`. For that caller, **RLS policies and
column privileges are the only boundary.**

Phase 1's invariants were written against application code — "only the
Stripe webhook writes a plan", "every route proves the tenant". They
held in code. The Phase 1 adversarial review replayed the migrations and
found the database did not enforce them:

| Invariant | Held in code | Database allowed |
|---|---|---|
| I-12 billing is server-authoritative | yes | a user sets their own `profiles.plan` / `subscription_status` / `trial_ends_at` |
| I-2 client cannot define tenant truth | yes | a `messages` row in another user's conversation; a project in another organization |
| I-6 approval cannot be forged or replayed | yes (replay) | an approval rewritten after the fact, or born with a 2099 expiry |

## Decision

1. **Every server-authoritative column must be unwritable by
   `authenticated` at the privilege or policy layer**, not only absent
   from route code. Server-only state (billing, metering, audit, job
   claims) is written with the service role from allowlisted code.
2. **Where a client must write, grant only the columns it writes** and
   pin the rest (the `agent_approvals` pattern: column grants equal to
   what `approvalStore.ts` writes; `created_at` is the database clock).
3. **Every ownership path named on a row must hold** (`AND`), never any
   one of them (`OR`).
4. **An invariant that concerns client writes is only PASS with a
   database-level check**, which replays the migrations in order and
   asserts the final state. A code-only check is recorded PARTIAL.
5. **Repository state is not production state.** A migration that closes
   a hole is PARTIAL until the founder approves and it is applied; the
   drifted tables (`20260901165000`) may carry untracked policies that a
   `pg_policies` read of production must confirm.

## Consequences

- Two migrations are written and await approval; until then the holes
  are open in production and invariants 2, 6 and 12 are recorded PARTIAL.
- Known holes not closed by this phase (documented in the North Star
  state-machine audit): `jobs` insert (must be server-only before any
  runner exists), organization admin → owner escalation, `api_keys`,
  `ai_budgets` and `ai_agent_executions` writes (no reader today).
- New tables follow rule 1 from their first migration.
