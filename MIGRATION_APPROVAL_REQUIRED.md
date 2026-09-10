# Migration awaiting approval

**One migration is written, tested, and NOT applied.**

```
supabase/migrations/20260909120000_syraven_integration_connections.sql
```

Nothing has been run against any database. This file is the request.

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

## To apply

```bash
supabase db push
```

Review the file first. Nothing in this repository will apply it
automatically.
