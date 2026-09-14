# SYRAVEN — Resource Policy

## The machine, as measured

- ~3.9 GB physical RAM; the page file often holds ~3.5–3.7 GB.
- Free memory observed between **56 MB and ~670 MB**, depending on what
  else is open (browser, editor, Claude).
- Observed consequences: a production build took 15+ minutes and was
  killed once; E2E sign-ins failed with `AuthRetryableFetchError`
  (status 0) while paging; three background commands were killed
  together for low memory; recursive searches through `node_modules`
  timed out.

Correctness is never reduced to fit the machine. **Order** is.

## Rules

1. **One heavy process at a time.** Heavy = `tsc`, `next build`, the full
   test suite, Playwright with a browser, `eslint .`. Never run two
   together, and never alongside a background job.
2. **Measure first.** Check free memory before a heavy step
   (`RECOVERY_PROTOCOL.md`). Below ~300 MB, close what can be closed or
   wait; do not start a build.
3. **Cap heaps:** `tsc` 1536 MB, `next build` 1600 MB, `eslint` 768 MB,
   `next start` 512 MB.
4. **Tests:** `npm run test:lowmem` (2 files at a time), not `npm test`.
5. **Lint what changed**, not the whole repository.
6. **Build only when needed** — for E2E or a release check — and never as
   a side effect. Remember a build decides the database target
   (`E2E_SAFETY.md`).
7. **E2E:** `workers: 1` (config), one spec file at a time when memory is
   tight, stop the server afterwards.
8. **No recursive search through `node_modules` or `.next`.** Scope greps
   to `app/`, `lib/`, `tests/`, `supabase/`.
9. **No background commands for heavy work** when memory is critical; a
   background job that is later killed leaves no evidence.

## Recommended order for a full verification

```text
git status → free memory → typecheck → lint (changed files)
→ test:lowmem → mutation (if guards changed) → build (if needed)
→ build-target check → E2E (one spec) → stop server → state files
```

## Cleaning up processes

Stop only processes this project started:

```bash
# list node processes with their command lines, then stop the ones that are ours
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select ProcessId, CommandLine"
```

- A background Bash task: stop it by its task id (Claude Code `TaskStop`).
- Orphaned `grep`/`node` from a killed task: stop by PID after confirming
  the command line is ours.
- Browsers from Playwright: closing the test run or the MCP session
  closes them; confirm with the process list.

## Recovering from OOM

1. Stop the failed job; confirm no orphan processes remain.
2. `git status` — a killed mutation run may have left a mutant.
3. Re-measure memory.
4. Re-run the **one** step that failed, alone. Do not retry in a loop.
5. If it fails again for memory, record the check as **BLOCKED (memory)**
   in `VERIFICATION_STATE.md` with the exact error — never as passed.
