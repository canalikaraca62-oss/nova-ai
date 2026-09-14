# SYRAVEN — Engineering Control Plane

The single index of how SYRAVEN is engineered: which files hold state,
which tools may act, how work is verified and how a session recovers.
It exists so that **repository truth, not chat memory, drives the work.**

```text
FOUNDER
  ↓
NORTH STAR            ARCHITECTURE_NORTH_STAR.md · docs/architecture/ADR-*.md
  ↓
PHASE                 docs/engineering/PHASE_STATE.md  (founder-issued, never self-started)
  ↓
CLAUDE CODE           CLAUDE.md · AGENTS.md · RECOVERY_PROTOCOL.md
  ↓
TOOLS
  ├── Terminal        RESOURCE_POLICY.md (one heavy process at a time)
  ├── Git             GIT_PROTOCOL.md
  ├── Playwright      Playwright Test (E2E) · playwright-test agents
  ├── MCP             MCP_AUDIT.md (playwright, playwright-test — nothing else)
  └── Tests           VERIFICATION_COMMANDS.md · SECURITY_TEST_MATRIX.md
  ↓
REAL APPLICATION      the test Supabase project only, for anything automated (E2E_SAFETY.md)
  ↓
VERIFICATION          VERIFICATION_STATE.md · BROWSER_EVIDENCE.md · VISUAL_QA.md
  ↓
EVIDENCE              commands, exit codes, counts, trace paths — never adjectives
  ↓
FOUNDER REVIEW
  ↓
NEXT PHASE            only on explicit instruction
```

## Index

| Concern | File | What it answers |
|---|---|---|
| Project rules | `CLAUDE.md`, `AGENTS.md` | Identity, principles, never-list, coding and phase protocol |
| Project state | `PROJECT_STATE.md` | Commit, working tree, active phase, blockers, pending approvals |
| Phase state | `PHASE_STATE.md` | Current phase, status, evidence, unresolved items, next allowed action |
| Verification state | `VERIFICATION_STATE.md` | Last typecheck, lint, tests, mutation, build, E2E — or `NOT RUN` |
| Recovery | `RECOVERY_PROTOCOL.md` | How a fresh session rebuilds context |
| Commands | `VERIFICATION_COMMANDS.md` | Every real command, its cost and limits |
| E2E safety | `E2E_SAFETY.md` | Why automated browsers cannot reach production |
| Browser evidence | `BROWSER_EVIDENCE.md` | What evidence a journey needs; where artifacts live |
| Visual QA | `VISUAL_QA.md` | Critical pages, viewports, baseline policy |
| Security tests | `SECURITY_TEST_MATRIX.md` | Boundary × positive / negative / bypass / regression |
| MCP | `MCP_AUDIT.md` | Every MCP server, its authority, and why |
| Git | `GIT_PROTOCOL.md` | Commits, separation, forbidden operations |
| Resources | `RESOURCE_POLICY.md` | Memory-aware execution order |
| Failures | `FAILURE_RECOVERY.md` | Interruptions, OOM, crashes, conflicts |
| Architecture | `../../ARCHITECTURE_NORTH_STAR.md` | Truth map, boundaries, invariants |

The control plane is itself guarded: `tests/security/engineering-control-plane.test.ts`
fails if the MCP configuration widens, if the Playwright agents lose their
scope rules, or if the E2E production guard disappears.

## Browser tooling — two layers, no overlap

| Layer | Tool | Use |
|---|---|---|
| Deterministic regression | Playwright Test (`npm run test:e2e`) | The suite of record. Its results are evidence. |
| Agent-assisted test authoring | `playwright-test` MCP + planner / generator / healer agents | Plans in `specs/`, tests in `tests/e2e/`, fixes to tests only |
| Exploration and debugging | `playwright` MCP | Look at the running local build: snapshots, console, network, screenshots |
| Human debugging | `npx playwright show-trace`, `test --ui`, `npx playwright cli` | Already bundled in `@playwright/test` 1.63 — nothing to install |

Exploration output is never evidence by itself: a finding becomes
evidence when a test in `tests/e2e/` reproduces it.

## Session hygiene

- **One writer.** One Claude session writes to this repository at a time.
  Parallel sessions may read and review, never write.
- **Reviewers are read-only.** Use read-only agents for review and
  exploration; the primary session applies changes.
- **Agents are auditable.** Anything a subagent (including the Playwright
  healer and generator) writes is reviewed with `git diff` before it is kept.
- **No blind destruction.** Look before deleting; never run `git reset --hard`,
  `git clean`, force-push or history rewrites without explicit instruction.
- **Checkpoint before risk.** Before a risky operation (mutation runs,
  mass edits, dependency changes), confirm `git status` is understood and
  the state files are current.
- **Inspect after autonomy.** After any autonomous stretch, run `git status`
  and `git diff --stat` and account for every file.
- **State in files.** Long-running work records its position in
  `PHASE_STATE.md` / `VERIFICATION_STATE.md`, so an interruption loses
  nothing that matters.
