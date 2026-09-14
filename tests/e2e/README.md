# SYRAVEN — End-to-end tests

Playwright, Chromium only. These are the only tests that exercise a real
browser; everything under `tests/security/` and `tests/schema/` is
source inspection or fake-client based.

## Running

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI, for debugging a failure
```

The config builds the app and serves it with `next start` on port 3100
(override with `E2E_PORT`). The **production** build is used
deliberately: `next dev` tolerates hydration mismatches with a console
warning, which is one of the defects this suite exists to catch.

A cold build takes a few minutes. That is the build, not a hang.

## Test account

Authenticated specs read credentials from the environment:

```bash
E2E_TEST_EMAIL=...
E2E_TEST_PASSWORD=...
```

Put them in `.env.e2e.local` (gitignored), next to the test project's
`NEXT_PUBLIC_SUPABASE_*` values — **not** `.env.local`, which is the
development configuration and points at production. `playwright.config.ts`
loads only an allowlisted set of keys from that file. **Nothing is
hardcoded and no credential is committed.** See
`docs/engineering/E2E_SAFETY.md`.

When the variables are absent, `authenticated.spec.ts` **skips** rather
than fails. A missing credential is an environment gap, not a product
defect, and a suite that goes red for unconfigured tooling trains people
to ignore red. `public-pages.spec.ts` needs no credentials and always
runs.

### Safety rules for the account

1. **Use a non-production Supabase project.** These tests sign in as a
   real user against whatever `NEXT_PUBLIC_SUPABASE_URL` points at.
2. **Provision the account out of band** — through the app's own
   registration, or the Supabase dashboard. The suite deliberately does
   **not** create users: registration writes an `auth.users` row and
   provisions an organization, and a cleanup bug would then delete real
   data.
3. **The suite writes only rows it created, and deletes them back.**
   Most specs navigate and read. `seeded-journey.spec.ts` additionally
   creates a project and a task through the product's own authorized
   routes, asserts they reach the pages that list them, and removes them
   in teardown. It never sends chat messages or triggers agent runs —
   those would spend money on every run.

   Four things make that safe:

   - `playwright.config.ts` **refuses to start** against the production
     project, so seeded rows cannot land there.
   - Writes go through the API as an ordinary signed-in user. There is
     no service-role key in the E2E environment, so RLS applies exactly
     as it does in production.
   - `DELETE` scopes by `id` **and** `user_id` server-side, so teardown
     cannot reach a row it did not create.
   - Every seeded row carries a per-run tag (`e2e-<id>`) in its name,
     and teardown **asserts** each deletion. Anything a crash leaves
     behind is identifiable by that tag rather than anonymous.

### The build under test decides the database

`NEXT_PUBLIC_SUPABASE_URL` is **inlined when the app is built**, not read
when it starts. Exporting the E2E environment into `next start` changes
nothing about a build that was made from `.env.local` — that server talks
to production.

- Let Playwright build: its `webServer` runs `npm run build` with
  `.env.e2e.local` exported, so the build targets the test project.
- Do not leave a server running on the E2E port from a normal
  `npm run build`. `reuseExistingServer` will drive it.
- `tests/e2e/buildTarget.ts` runs automatically before every worker and
  **refuses to start** if `.next/server` contains the production project
  ref. It reads files on disk only; no request is made.

This is not a hypothetical: a run once reused a production build and sent
every sign-in to the live project (401, no session, nothing written).

## What these tests cover

Things only a browser can verify:

- uncaught runtime errors and hydration failures (`pageerror`)
- console errors and failed same-origin API requests
- real horizontal overflow at desktop (1440×900) and mobile (Pixel 7)
- computed text/background colours on payment buttons
- keyboard reachability of the sign-in form
- that links resolve, from a rendered DOM rather than a grep

## What they deliberately do not cover

- **Semantic search** — wired (`/api/knowledge/index`, `/api/knowledge/semantic`)
  but every call spends on the embedding provider, so no spec drives it.
- **AI/chat flows** — every run would spend money.
- **Edit flows** — `PATCH` is not exercised yet.
- **Anything outside projects and tasks** — create/delete is seeded for
  those two only. Other write paths remain unverified by a browser.
- **Cross-browser** — Chromium only. Firefox and WebKit triple download
  and CI time, and the defects above are not engine-specific. Worth
  adding once the suite is green in CI.
- **WCAG contrast ratios** — the checks here catch the catastrophic case
  (text colour identical to its background), not full ratio measurement.

## Relationship to the other suites

`tests/security/api-reference-integrity.test.ts` proves every live
`fetch("/api/…")` targets a route that exists. That check is static and
runs in milliseconds; these tests then confirm the routes behave. Keep
both — the static test catches the whole class instantly, and this one
catches what static analysis cannot see.
