# SYRAVEN — E2E Safety

**Invariant: automated browsers never silently target production.** If
that cannot be guaranteed for a run, the run is BLOCKED. The guards are
never weakened to make a run pass.

## The two projects

| | Supabase ref | Where configured | Used by |
|---|---|---|---|
| Production | `wpmbumtpcuahyqmdeqgf` | `.env.local` (development config) | `npm run dev`, the live product |
| Test | `akhkukajdgayqwhedeoo` | `.env.e2e.local` (gitignored) | Playwright, the agents' test server, exploration |

## Layers of protection

1. **Allowlisted E2E environment.** `playwright.config.ts` loads only
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `E2E_TEST_EMAIL`,
   `E2E_TEST_PASSWORD` from `.env.e2e.local`. No service-role key exists in
   the E2E environment, so every write is an ordinary user's write under RLS.
2. **Fail-closed config guard.** At config load — before any browser — the
   config resolves the Supabase URL the way `next start` would and throws
   if the ref is production **or cannot be determined**
   (`e2e-production-guard.test.ts`).
3. **Build-time inlining is handled.** `NEXT_PUBLIC_*` are compiled into
   the build. The webServer's `npm run build` inherits the exported E2E
   values, so a Playwright-made build targets the test project.
4. **Build-target guard.** `tests/e2e/buildTarget.ts` runs as an automatic
   worker fixture and refuses to start if `.next/server` contains the
   production ref — catching a reused production build
   (`e2e-build-target.test.ts`). This happened once: a reused production
   build sent every sign-in to the live project (401s, nothing written).
5. **Tagged, asserted seeding.** Seeded rows carry `e2e-<id>`; teardown
   deletes each by id and **asserts** the deletion. DELETE routes scope by
   `id` and `user_id` server-side.
6. **No users created, no paid calls.** The suite signs in as an
   out-of-band test account; it never registers users, sends chat, runs
   agents or touches billing.
7. **Agents inherit the guards.** The `playwright-test` MCP server is
   started with `-c playwright.config.ts`, so its runs pass through layers
   1–4.

## Exploration (Playwright MCP) — procedure, not a guarantee

The `playwright` MCP browser can navigate anywhere; the config guards do
not apply to it. Rules:

- Explore only `http://127.0.0.1:3100` served from a build that passed the
  build-target check below.
- The server blocks requests to the production Supabase origin
  (`--blocked-origins`). Playwright documents this as **not a security
  boundary** (redirects are not covered) — it is defense in depth.
- Never sign in to the production site from an automated browser.

## Check the build target

```bash
node --input-type=module -e "import('./tests/e2e/buildTarget.ts').then(m => { m.assertBuildIsNotProduction(); console.log('build target: not production'); })"
```

A throw means `.next` was built from `.env.local` (production). Rebuild
under the E2E environment before any browser run.

## Known gaps

- `tests/e2e/fixtures.ts` header comment still says credentials live in
  `.env.local`; the README and this file are correct (`.env.e2e.local`).
  Comment-only; recorded for the next test-touching change.
- A server started by hand is only protected by the build-target guard
  when Playwright Test drives it; the MCP exploration browser relies on
  the procedure above.
- E2E **execution** is currently unreliable on this machine (memory), even
  though its **safety** holds. Unreliable is reported as BLOCKED, never as
  a pass.
