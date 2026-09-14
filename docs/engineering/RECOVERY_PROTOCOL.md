# SYRAVEN — Context Recovery Protocol

A fresh Claude session knows nothing reliable about this project except
what the repository says. Previous chat context — including a summary of
it — is **not authoritative**. The repository state and the evidence files
are.

## Recovery order

Do these in order before any change:

1. **`git status`** — what is modified, untracked, staged. Unexpected
   changes are a stop signal: account for them first (an interrupted
   mutation run can leave a mutant behind — compare against the file's
   intent before assuming anything).
2. **Current commit** — `git log --oneline -5`; note HEAD.
3. **`CLAUDE.md`** (and `AGENTS.md`, which it imports).
4. **`docs/engineering/PROJECT_STATE.md`** — does its HEAD and working-tree
   description match steps 1–2? If not, it is stale: update it before work.
5. **`docs/engineering/PHASE_STATE.md`** — the active phase, its status,
   and the **next allowed action**. Do nothing the file does not allow.
6. **`ARCHITECTURE_NORTH_STAR.md`** — the parts relevant to the task.
7. **Relevant ADRs** — `docs/architecture/ADR-*.md`.
8. **`docs/engineering/VERIFICATION_STATE.md`** — what was last proven, on
   which tree. Treat any result from a different tree as unverified.
9. **The current phase instructions** from the founder, in this session.

## Environment checks after recovery

Run once, cheaply, before heavy work (`RESOURCE_POLICY.md`):

```bash
git status --short
powershell -NoProfile -Command "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)"   # free MB
powershell -NoProfile -Command "Get-Process node,chrome,msedge,headless_shell -ErrorAction SilentlyContinue | Measure-Object | Select -Expand Count"
powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count"
```

- Orphaned `node` / browser processes from a previous session: stop only
  those this project started (see `FAILURE_RECOVERY.md`).
- A server listening on 3100 may be a **production-inlined** build; do not
  reuse it for E2E until `E2E_SAFETY.md` → "check the build target" passes.

## Rules

- Never resume a phase because a summary says it was "in progress". Resume
  only what `PHASE_STATE.md` and the founder's current instruction allow.
- Never report a result from memory. Re-run it, or cite the row in
  `VERIFICATION_STATE.md` with its tree.
- If the state files and the repository disagree, the repository wins;
  correct the files and say so in the report.
