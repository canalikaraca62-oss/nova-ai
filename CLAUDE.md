# SYRAVEN - CLAUDE CODE PROJECT INSTRUCTIONS

## Project Identity

Syraven is a long-lived, enterprise-grade AI workspace platform.

The system is designed for scalable collaboration, AI-assisted knowledge,
projects, tasks, files, messaging, search, notifications, usage tracking,
authentication, workspace isolation, and secure backend operations.

This repository must be treated as production infrastructure.

Prioritize:

1. Correctness
2. Security
3. Type safety
4. Maintainability
5. Scalability
6. Clear architecture
7. Explicit authorization boundaries

Do not optimize for the smallest possible code change if that change creates
technical debt or weakens the architecture.

---

# PRIMARY RULES

Before making changes, read:

@AGENTS.md

`AGENTS.md` is the primary engineering and security rule set for this repository.

All instructions in `AGENTS.md` must be followed.

Do not create code that conflicts with:

- TypeScript strictness rules
- Security rules
- Authentication rules
- Authorization rules
- Workspace isolation
- Supabase boundaries
- API route architecture
- Error handling requirements

---

# PROJECT ARCHITECTURE

The project uses a layered architecture.

Primary areas include:

```text
app/
lib/
services/
types/
components/
```

`components/`, `context/` and `hooks/` live under `app/`, not the
repository root (see the corrected structure in `AGENTS.md`).

---

# SYRAVEN — AI WORK OPERATING SYSTEM

SYRAVEN is an AI Work Operating System. Its promise: **give SYRAVEN the
goal; it runs the work.** Every feature belongs to one stage of one loop:

```text
GOAL → CONTEXT → BRAIN → PLAN → AGENTS → WORK GRAPH → ACTION ENGINE
     → APPROVAL → EXECUTION → VERIFICATION → OUTCOME → MEMORY → AUTOPILOT
```

Surrounded by Identity, Tenancy, Security, AI, Billing, Connectors, Search,
Notifications, Observability and UX. The architecture, its current truth
map and its sixteen invariants are in `ARCHITECTURE_NORTH_STAR.md`;
decisions are in `docs/architecture/ADR-*.md`.

## Engineering principles

```text
REALITY       > APPEARANCE
EVIDENCE      > CLAIMS
SECURITY      > CONVENIENCE
CORRECTNESS   > SPEED
ARCHITECTURE  > PATCHES
REAL DATA     > FABRICATED DATA
VERIFICATION  > ASSUMPTION
```

## Never

- fabricate success, data, activity, usage, progress or AI output
- claim a feature works without evidence (a command, its exit code, counts)
- trust client-supplied identity, roles, tenant ids, plans, prices or approval flags
- bypass tenant boundaries, RLS, or the tenant guards
- bypass the Action Engine (`executeTool` has exactly one caller: the orchestrator)
- bypass approval, or spend an approval after the step it authorizes
- create a second execution engine (Autopilot uses the same substrate)
- apply a production migration without explicit founder approval in the conversation
- change production secrets, deploy, or authorize external OAuth without approval
- silently swallow failures, disable a test, or weaken an invariant to go green

## Coding protocol

```text
INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → ADVERSARIAL REVIEW
        → VERIFY → REPORT → STOP
```

- Inspect the code and `git status` before changing anything.
- Adversarial review means trying to break the change: bypass, replay,
  duplicate execution, cross-tenant read, fake success. Mutation-test new
  guards (re-create the defect; the guard must fail).
- Report evidence, not adjectives. PASS / PARTIAL / BLOCKED / FAIL only.

## Phase protocol

- Work proceeds in founder-issued phases. **Never start another phase
  automatically.** Wait for the explicit instruction (e.g. "CONTINUE TO
  PHASE 2").
- Every phase ends with: **STATUS · EVIDENCE · DOD · BLOCKERS · NEXT PHASE · STOP**.
- Update `docs/engineering/PHASE_STATE.md` and `VERIFICATION_STATE.md`
  when a phase or verification changes state. Never write a result that
  did not run — write `NOT RUN`.

## Current state

- **PHASE 1 — North Star Architecture: PASS** (founder-accepted; gate re-run
  2026-09-14). Migrations `20260913120000` / `20260913130000` are applied
  and verified on TEST and — by the founder — on PRODUCTION; I-2, I-6
  and I-12 PASS. The production `next build` of the Phase 1 tree
  PASSED in a secret-free scratch copy (2026-09-14). Every Phase 1 DoD
  item is verified and the founder accepted PASS. Not closed by this
  PASS, and documented as such: I-7 and I-15 PARTIAL, I-14 BLOCKED.
- **PHASE 2 — Repository and Architecture Purification: PASS** —
  documented environment limitations accepted (founder, 2026-09-15). It
  was accepted on the final gate re-run on `cd24c57`, with the evidence
  reconciled in `a72be3f`; everything is committed locally and never
  pushed.
  - Accepted limitations: the production build of the Phase 2 tree is
    BLOCKED by machine memory, so browser/E2E and visual QA are BLOCKED
    / NOT RUN.
  - Documented follow-ups, kept:
    - FG-02: no sign-out control.
    - FG-03: unused `signOut()` export.
    - The remaining duplicate authorities.
    - The deliberate search vs AI-retrieval status distinction.
    - The pre-existing lint error in `app/settings/page.tsx`.

  See `docs/engineering/PHASE_STATE.md`.
- **PHASE 3 — Security Fortress: IN PROGRESS.** Started on the
  founder's instruction.
  - **Closed PASS:** Batch 1, B2-A, B2-A2 and B2-C.
  - **On production (founder-applied):** Batch 1 (as the founder reported),
    B2-A and B2-A2.
  - **B2-B:** PASS on repository, TEST and **production** (founder-applied
    2026-09-17, postcheck PASS).
  - **B2-D1** (application provisioning): PARTIAL (founder-accepted) on
    repository and TEST; route-level check PASS, browser E2E BLOCKED.
    **Deployed to production 2026-09-18** (`7b3e612`); post-deploy
    read-only verification PASS — one `account.provisioned` event
    correlated with the smoke test, tenancy integrity all 0. The Vercel
    build log is NOT RECORDED here.
  - **B2-D2** (registration through confirmed signup): READY FOR
    FOUNDER ACCEPTANCE on repository and TEST, not PASS; D15/D16 NOT
    VERIFIED / RESOURCE BLOCKED; uncommitted.
  - **Not started:** B2-E onwards. Every batch and every TEST or
    production application needs its own explicit instruction.
  - **Current state:** `docs/engineering/SECURITY_EVIDENCE.md` ("Current
    state") and `docs/engineering/PHASE_STATE.md` ("Phase 3 — progress").
- **Vercel Git integration is connected:** any push or PR deploys. Never
  push, open a PR or merge without explicit founder approval.
- For client writes the database is the boundary of record (ADR-003): a
  signed-in user can call PostgREST directly, so an invariant about
  client writes needs a database-level check, not only a route check.
- The working tree holds uncommitted work from more than one effort;
  see `docs/engineering/PROJECT_STATE.md` before committing anything.

## Engineering control plane

Start every session with `docs/engineering/RECOVERY_PROTOCOL.md`. The
index of the whole environment is `docs/engineering/CONTROL_PLANE.md`.

- **Resources are limited** (`docs/engineering/RESOURCE_POLICY.md`): run
  heavy processes (tsc, build, full tests, browsers) one at a time; never
  recurse through `node_modules`; kill only processes you started.
- **E2E never targets production** (`docs/engineering/E2E_SAFETY.md`). If
  that cannot be guaranteed, E2E is BLOCKED — never weaken the guard.
- **Browser tools**: Playwright MCP (`playwright`, exploration) and
  `playwright-test` (planner/generator/healer agents). The healer may edit
  only tests; application defects return to the normal workflow.
- **Git** (`docs/engineering/GIT_PROTOCOL.md`): small, verified, phase-separated
  commits; never force-push, rewrite history, or commit secrets or browser state.
