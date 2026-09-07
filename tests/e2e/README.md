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

Put them in `.env.local` (gitignored). **Nothing is hardcoded and no
credential is committed.**

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
3. **The suite writes nothing.** Specs navigate, assert what renders,
   and read. They do not create projects, send chat messages, or trigger
   agent runs — the last would also spend money on every run.

## What these tests cover

Things only a browser can verify:

- uncaught runtime errors and hydration failures (`pageerror`)
- console errors and failed same-origin API requests
- real horizontal overflow at desktop (1440×900) and mobile (Pixel 7)
- computed text/background colours on payment buttons
- keyboard reachability of the sign-in form
- that links resolve, from a rendered DOM rather than a grep

## What they deliberately do not cover

- **Semantic search** — not wired to any route (Step 5).
- **AI/chat flows** — every run would spend money.
- **Create/edit/delete flows** — would leave data behind.
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
