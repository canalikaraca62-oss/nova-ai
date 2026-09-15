# SYRAVEN — Phase State

**Last updated:** 2026-09-15, Phase 2 status recorded as IN PROGRESS
(Phase 1 accepted as PASS by the founder 2026-09-14).

## Current phase

**PHASE 1 — NORTH STAR ARCHITECTURE**

| Field | Value |
|---|---|
| Status | **PASS** — accepted by the founder 2026-09-14, on the evidence in `VERIFICATION_STATE.md` |
| Passes | First pass 2026-09-13; second pass 2026-09-13; steps 1–7 (migration readiness, TEST verification, remaining gaps) 2026-09-13/14; final gate (step 8) 2026-09-14: PARTIAL; production migrations applied and verified by the founder 2026-09-14; production `projects` boundary verified by the founder 2026-09-14; production build of the Phase 1 tree passed in a secret-free scratch copy 2026-09-14; **founder acceptance 2026-09-14: PASS** |
| Next allowed action | Phase 1 is closed. Phase 2 is IN PROGRESS (see Phase history); each Phase 2 batch proceeds only on the founder's instruction, and Phase 3 starts only on its own. Applying any migration, pushing, and committing each need an explicit instruction (the Vercel Git integration deploys any push). |

## Objective

Establish SYRAVEN as one work loop with one authority per concept, map
the code as it is onto that target, and protect it with tests.

## Completed, with evidence

| Item | Evidence |
|---|---|
| Truth map, boundaries, loop, source-of-truth matrix, dependency model, state-machine audit, event and error models, diagrams, scorecard | `ARCHITECTURE_NORTH_STAR.md` (second pass: corrections marked **[corrected]**) |
| ADRs | `ADR-001-north-star.md`, `ADR-002-approval-gate-and-settlement.md`, `ADR-003-database-is-the-write-boundary.md` |
| First pass fixes | Approval claimed before execution; `/api/agents/execute` on the adapter; `/api/tasks/execute` 410; `/api/action` no fake "Done."; refused plan not `completed` |
| Pass 2 — orchestrator FAKE fixed | A mixed plan ran past an unapproved high-risk step and said "Finished." without requesting approval; budget stops settled `completed`. `approvalGate` + `settleRun` (`lib/orchestration/runSettlement.ts`), behaviour tested on shipped code (`run-settlement.test.ts`) |
| Pass 2 — approval request recording fixed | `requestApprovals` upserted on a partial unique index and discarded the error; now plain insert, 23505 = already requested, route answers 503 when unrecorded |
| Pass 2 — FAKE removed | `/api/canvas` fabricated `success: true` templates; Studio hub hardcoded "recent projects" and all-"Ready" tools |
| Database write boundaries | `20260913120000` (client-writable `profiles.plan`) and `20260913130000` (`messages` / `projects` cross-tenant writes, `agent_approvals` rewrites): written, hardened (`messages` INSERT revoke), applied to TEST and PRODUCTION by the founder through the SQL Editor, verified on both |
| Migration safety | Unsafe `db push` instructions removed (`MIGRATION_APPROVAL_REQUIRED.md`, `DATABASE.md`) |
| Security headers | `next.config.ts` `headers()`; `security-headers.test.ts` loads the real config |
| AI policy | `/api/canvas` on the registry and the adapter; no route imports a provider SDK |
| Latent DB holes held in code | Guards: no code reads `api_keys` / `ai_budgets` / `ai_agent_executions`; no route trusts an organization role; `todo`s name the migrations that close them |
| Verification | `test:lowmem` 1817: 1810 pass, 0 fail, 7 todo; typecheck exit 0; lint exit 0 on the 33 changed `.ts/.tsx` files; mutation 20/20, 3/3, 10/10 killed; production `next build` exit 0 (`BUILD_ID` `R3WTT03LAIpTqm5j4I0tf`) in a secret-free scratch copy |

## Invariant status at PASS

Twelve of sixteen invariants PASS. The table below lists the ones this
PASS does **not** close. They are documented limitations — the Phase 1
DoD requires invariants to be "tested or explicitly documented as
blocked" — and each stays a `todo` in `architecture-invariants.test.ts`.

| Invariant | Meaning | Status | What closes it |
|---|---|---|---|
| I-7 | Execution cannot be duplicated | PARTIAL | A persisted run / action record (Action Engine, migration): low/medium-risk steps are not de-duplicated across concurrent identical requests |
| I-14 | Durable jobs survive request and browser lifetime | BLOCKED | A scheduler, delegated identity for jobs, and server-only job creation; the queue has no caller |
| I-15 | Execution is not a verified outcome | PARTIAL | An outcome store; a run records step results only |

Also not closed by this PASS: database write boundaries that need
migrations (`jobs` insert, organization ownership/roles, `api_keys` /
`ai_budgets` / `ai_agent_executions`), held in code by guards; binding an
approval to exact arguments (Action Engine).

## Unresolved items (follow-ups, not Phase 1 blockers)

- Migration history: not recorded on TEST, not reported on PRODUCTION.
  Never `db push` from this checkout — it would re-run both Phase 1 files
  and apply the unapproved `20260909120000` / `20260910120000`.
- Reconcile `profiles.plan` with Stripe for rows possibly edited before
  the lockdown; report production `messages` UPDATE/DELETE policies.
- Two agent concepts; five AI routes with their own transport
  (`chat`, `files/analyze`, `stream`, `voice/transcribe`, `voice/speak`);
  two keyword search endpoints plus list filters.
- CSP has no `script-src`/`style-src` (inline-code audit + browser run).
- Next 16 deprecates the `middleware` file convention (use `proxy`).
- `20260908120000` calls an undefined `set_updated_at()`.
- `agent-execution.test.ts` keeps an orchestrator mirror encoding the old
  approval behaviour.
- Browser / E2E verification of the Phase 1 tree (not a DoD item).
- The migration files' headers still read "WRITTEN, NOT APPLIED".

## Phase history

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — North Star Architecture | PASS (founder-accepted 2026-09-14) | This file |
| Phase 2 — Repository and Architecture Purification | IN PROGRESS | Started 2026-09-14 on the founder's instruction; stopped as PARTIAL and resumed by the founder the same day, to be completed before Phase 3. P2-A … P2-G committed locally (16 commits after `3314baa`, never pushed); preflight follow-up P2-P committed 2026-09-15 (`f566757`); P2-H (documentation consistency) implemented and verified 2026-09-15, uncommitted; the Phase 2 final gate remains. Evidence: `PURIFICATION_EVIDENCE.md`, `PURIFICATION_SCORECARD.md` |
| Phase 3 | NOT STARTED | Starts only on the founder's instruction |
