/**
 * SYRAVEN — When a plan may run, and what its run settles as
 * lib/orchestration/runSettlement.ts
 *
 * Phase 1 — North Star (ARCHITECTURE_NORTH_STAR.md §9).
 *
 * PURE. No runtime imports and no "server-only" marker: the orchestrator
 * calls these functions, and tests/security/run-settlement.test.ts
 * exercises the same functions -- not a copy of them (see tsconfig.json,
 * `allowImportingTsExtensions`).
 *
 * Both decisions live here because each was wrong once.
 *
 * 1. THE APPROVAL GATE
 *
 *    The step loop used to mark an unapproved high-risk step
 *    `awaiting_approval` and carry on. Steps after it executed although
 *    the step before them never ran, and a run that had executed anything
 *    at all settled as `completed` -- so the route answered "Finished."
 *    and never recorded the approval request. A plan like
 *    [knowledge.create, knowledge.delete] wrote the note, silently
 *    dropped the delete, and reported success.
 *
 *    A plan now runs only when every high-risk step in it already holds a
 *    valid grant. Otherwise nothing runs and the whole plan waits -- the
 *    same all-or-nothing rule `validatePlan()` applies to a plan's shape.
 *
 * 2. SETTLEMENT
 *
 *    A run is `completed` only when every step completed. A step stopped
 *    by the execution budget used to leave the run `completed` with work
 *    undone.
 */

export type StepStatus =
  | "completed"
  | "failed"
  | "awaiting_approval"
  | "skipped";

/* -------------------------------------------------------------------------- */
/*                               APPROVAL GATE                                */
/* -------------------------------------------------------------------------- */

export interface GateStep {
  readonly toolId: string;
  /** From the tool registry's risk -- never from the plan or the request. */
  readonly requiresApproval: boolean;
  /** A server-held grant was verified for this step. */
  readonly approved: boolean;
}

export type ApprovalGate =
  | { readonly open: true }
  | {
      readonly open: false;
      /** Tools that need a decision, once each, in plan order. */
      readonly awaiting: readonly string[];
    };

/**
 * Decides whether a validated plan may start executing.
 *
 * Open only when no step needs an approval it does not hold. The tool
 * ids are de-duplicated because approvals are recorded per tool and
 * execution key: two steps of one tool wait on one decision.
 */
export function approvalGate(steps: readonly GateStep[]): ApprovalGate {
  const awaiting: string[] = [];

  for (const step of steps) {
    if (!step.requiresApproval || step.approved) continue;

    if (!awaiting.includes(step.toolId)) awaiting.push(step.toolId);
  }

  return awaiting.length === 0 ? { open: true } : { open: false, awaiting };
}

/* -------------------------------------------------------------------------- */
/*                                 SETTLEMENT                                 */
/* -------------------------------------------------------------------------- */

export type Settlement =
  | { readonly state: "completed"; readonly error: null }
  | {
      readonly state: "failed";
      /**
       * STEP_FAILED     a step ran, or tried to, and did not succeed.
       * PLAN_INCOMPLETE no step failed, but not every step ran.
       */
      readonly error: "STEP_FAILED" | "PLAN_INCOMPLETE";
    };

/**
 * Settles a run from the status of each step it recorded.
 *
 * `completed` requires at least one step and every step completed.
 * Anything else is a failure: a run that did part of its plan did not do
 * the plan, and reporting it as done would claim work that never
 * happened.
 */
export function settleRun(statuses: readonly StepStatus[]): Settlement {
  if (statuses.includes("failed")) {
    return { state: "failed", error: "STEP_FAILED" };
  }

  if (
    statuses.length === 0 ||
    !statuses.every((status) => status === "completed")
  ) {
    return { state: "failed", error: "PLAN_INCOMPLETE" };
  }

  return { state: "completed", error: null };
}
