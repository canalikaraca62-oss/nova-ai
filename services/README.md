# `services/` — status and decision

**Last reviewed:** 2026-09-04 (Phase 4)
**Status:** ⚠️ **Not wired into any request path. Deferred, not deleted.**

---

## What this directory actually contains

33 files, ~37,000 lines. IMPLEMENTATION_PLAN.md Phase 4 describes it as the
service layer that routes should delegate to. It is not one.

**Every file is an in-memory `Map` store. Zero of the 33 import Supabase.**

```
files                     33
total lines           36,977
files touching Supabase    0
imported by application    1   (services/action-types — types + type guards)
```

`services/search.ts` (1,919 lines) appears in the application exactly once,
inside a **comment** at `app/api/search/route.ts:270`.

## Why nothing here was reconnected

Phase 4's plan says to route business logic through this layer. Doing so
would have caused two regressions:

1. **Loss of persistence.** These modules store state in `Map` instances.
   Wiring one into a route would replace working database access with data
   that vanishes on restart and is not shared between instances.

2. **Loss of RLS enforcement.** Phase 4 made the caller's RLS-enforced
   Supabase client the default data path. A `Map` has no policies, no
   tenant isolation, and no audit trail. Routing reads through it would
   silently discard the guarantees Phases 2–4 established.

The plan anticipates this outcome:

> *"treating any service that cannot be validated as a **deletion
> candidate** rather than reconnecting it blindly"*

These cannot be validated as a data layer, because they are not one.

## Why they were not deleted either

Deleting ~37,000 lines is a large, irreversible change that no current
requirement forces. The import graph was verified per protocol §33 — only
`action-types` is referenced — so deletion would be *safe*, but "safe" is
not the same as "warranted".

The modules encode real domain thinking (usage aggregation, billing
entitlements, search ranking, integration adapters) that a future
persistence layer could draw on. Discarding that during a data-access
phase would trade a documented liability for an undocumented loss.

**The decision is therefore: defer, with the status recorded here and
enforced by a test** (`tests/security/data-access.test.ts`) that fails if a
route ever imports a service lacking database access.

## What would have to happen to use any of this

A service becomes reconnectable when it:

1. accepts a Supabase client as a parameter — never creates its own, and
   never reaches for `supabaseAdmin`;
2. performs real queries against the tables in `supabase/migrations`;
3. carries no ambient state that survives a request;
4. leaves ownership filtering to the caller, or applies it from a verified
   session id;
5. has tests covering cross-tenant denial.

Until then, route logic stays in the route handlers, where the
authentication boundary (`lib/api/withAuth.ts`), tenant guards
(`lib/api/tenantGuard.ts`) and RLS client selection (`lib/data/client.ts`)
already apply.

## Recommendation

| Option | Assessment |
|---|---|
| **Delete** | Safe (import graph verified) but discards domain work for no current need |
| **Rewrite into a real persistence layer** | Justified only when a second consumer needs the same logic. Today every domain has exactly one caller: its route |
| **Defer** ✅ | Chosen. Zero risk, zero cost, status recorded and test-enforced |

Revisit when a domain gains a second consumer — a background worker, a
scheduled job, or a second route — since that is the point at which
duplicated logic starts to cost more than the abstraction.
