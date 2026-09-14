# SYRAVEN — Verification Commands

Only commands that exist and have been run are listed. Costs are for this
machine (~3.9 GB RAM); see `RESOURCE_POLICY.md` for ordering.

## Typecheck

- **Purpose:** the whole project compiles under strict TypeScript.
- **Command:** `NODE_OPTIONS="--max-old-space-size=1536" npx tsc --noEmit -p tsconfig.json`
  (`npm run type-check` is the same without the heap cap).
- **Expected:** exit 0, no output.
- **Cost:** high — ~1–1.5 GB; 2–10 min depending on paging.
- **Limitations:** stale `.next/types` after deleting a route can produce
  false errors — remove `.next` (it will need a rebuild for E2E).

## Lint

- **Purpose:** ESLint rules on changed files.
- **Command:** `NODE_OPTIONS="--max-old-space-size=768" npx eslint <file> <file> …`
- **Expected:** exit 0.
- **Cost:** low for a file list.
- **Limitations:** `npm run lint` (`eslint .`) lints the whole repo — heavy;
  not run so far. Lint what changed.

## Unit, security, schema and invariant tests

| Command | Purpose | Expected | Cost |
|---|---|---|---|
| `npm run test:lowmem` | Full node suite, 2 files at a time | `ℹ fail 0` (todos allowed and must be read) | medium, ~80 s |
| `npm test` | Same, default concurrency (CPU−1) | same | can exhaust RAM here — prefer `test:lowmem` |
| `npm run test:security` | `tests/security/*.test.ts` only | `fail 0` | medium |
| `npm run test:invariants` | North Star invariants + control-plane guard | `fail 0`; todos = recorded BLOCKED/PARTIAL | low, seconds |
| `node --test <file>` | One suite | `fail 0` | low |

- **Limitations:** almost all suites inspect source or use fake clients —
  they prove shape and logic, not live database behaviour. A `todo` is a
  recorded gap, not a pass.

## Mutation testing

- **Purpose:** prove a guard can fail — re-create the defect, the named
  test must fail, the file must be restored byte-for-byte.
- **Command:** none in the repository. Mutation runs are one-off scripts
  in the session scratchpad (they are tied to a specific tree; e.g. the
  Phase 1 script restores files from `HEAD`, which only reproduces the old
  defects while the fixes are uncommitted).
- **Protocol:** green baseline first → one mutant at a time → match the
  expected failing **test name**, not just a non-zero exit → restore and
  verify restoration → report `killed/total` and every survivor.
- **Cost:** low–medium (one small suite per mutant).
- **Limitations:** an interrupted run can leave a mutant in a file — the
  recovery protocol's first step (`git status` / `git diff`) catches it.

## Production build

- **Purpose:** Next.js compiles every route and page.
- **Command:** `NODE_OPTIONS="--max-old-space-size=1600" npm run build`
- **Expected:** exit 0 and `.next/BUILD_ID` present (check the file, not only the exit code).
- **Cost:** very high — 10–15+ min here; run alone.
- **Limitations:** `NEXT_PUBLIC_*` values are **inlined at build time**. A
  build from `.env.local` targets **production** and makes `.next` unusable
  for E2E until rebuilt under the E2E environment (`E2E_SAFETY.md`).

## End-to-end (Playwright Test)

- **Purpose:** the browser suite of record.
- **Command:** `npm run test:e2e` (all), or
  `npx playwright test <spec> --project=chromium-desktop --workers=1`.
- **Expected:** all tests pass; seeded rows deleted (teardown asserts it).
- **Cost:** very high — a production build (webServer, 300 s budget) plus
  Chromium.
- **Limitations:** cold Supabase auth can take ~9 s; under memory pressure
  server-side auth calls fail (`AuthRetryableFetchError` status 0). A skip
  is not a pass.
- **Cheap config check (no browser, no build):** `npx playwright test --list`
  loads the config — the production guard runs — and lists the suite.

## Control-plane checks

| Check | Command | Expected |
|---|---|---|
| MCP servers registered | `claude mcp list` | `playwright`, `playwright-test` listed |
| Playwright + CLI present | `npx playwright --version`; `npx playwright cli --help` | `1.63.0`; usage text |
| E2E target is not production | `npx playwright test --list` | lists tests; no guard error |
| Built app is not production | `node -e` importing `tests/e2e/buildTarget.ts` → `assertBuildIsNotProduction()` | no throw |
| Control-plane guard | `node --test tests/security/engineering-control-plane.test.ts` | `fail 0` |
| No secrets tracked | `git grep -lE "sk-(proj-\|live-)?[A-Za-z0-9]{24,}\|sk_live_\|whsec_" -- . ":!package-lock.json"` | no output |
