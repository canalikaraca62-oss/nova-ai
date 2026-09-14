# ADR-002 — A plan runs only when fully authorized, and completes only when fully done

- **Status:** Accepted (Phase 1, 2026-09-13)
- **Extends:** ADR-001 §7 (approval is first-class) and §8 (verification is first-class)
- **Code:** `lib/orchestration/runSettlement.ts`, `lib/orchestration/orchestrator.ts`
- **Checked by:** `tests/security/run-settlement.test.ts` (behaviour, shipped code);
  `tests/security/architecture-invariants.test.ts` invariants 5 and 15 (wiring)

## Context

The step loop treated approval per step. When a high-risk step had no
valid grant it was marked `awaiting_approval` and the loop continued:

- steps **after** it ran, although the step before them never did;
- if anything had run, the run settled `executing → validating →
  completed`, because the state machine has no `executing →
  awaiting_approval` edge and the settle code only asked for approval
  from `planning`;
- the route therefore answered `success: true, "Finished."` and never
  recorded the approval request.

Reachable today: the `curator` agent holds `knowledge.create` (medium)
and `knowledge.delete` (high). The plan `[create, delete]` wrote the note,
dropped the delete silently and reported success. Separately, a step
stopped by the execution budget left the run `completed` with work undone.

## Decision

1. **All-or-nothing authorization.** Before any step runs, every
   high-risk step in the validated plan must hold a verified grant
   (`approvalGate`). Otherwise nothing runs; the whole plan waits, listing
   each tool once. This is the same rule `validatePlan()` already applies
   to a plan's shape: a plan is accepted whole or not at all.
2. **Grants are still spent one at a time, before their step,** by
   compare-and-set (unchanged). A grant that became invalid between the
   gate and its step (expiry during earlier steps) fails the run closed;
   the loop never passes over a step it did not run.
3. **Completion only through settlement.** `settleRun` is the only path
   to `completed`, and requires at least one step and every step
   completed. A failed step settles `STEP_FAILED`; anything else undone
   (a budget stop, a step not run) settles `PLAN_INCOMPLETE`.

The rules live in a module with no runtime imports so the suite
exercises the shipped functions, not a mirror.

## Consequences

- Positive: no run reports work it did not do; no step runs out of plan
  order; an approval request is always raised when a plan needs one.
- Changed behaviour: in a mixed plan the low-risk steps no longer run
  before approval — the user approves first, then the whole plan runs.
- Not solved here (needs persisted plans and runs — a migration):
  - An approval binds **tool + goal + scope**, not the step's arguments.
    The re-run after approval re-plans; the model may choose different
    arguments for the approved tool. No high-risk tool has an executor
    today (`TOOL_NOT_IMPLEMENTED`), so this is latent.
  - Low/medium-risk steps are still not de-duplicated across concurrent
    identical requests (invariant I-7 stays PARTIAL).
  - `tests/security/agent-execution.test.ts` keeps a hand-written mirror
    of the orchestrator that still encodes the old behaviour. It tests a
    copy, not the product; the behavioural guarantee is in
    `run-settlement.test.ts`.
