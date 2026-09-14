/**
 * SYRAVEN — the approval gate and run settlement, exercised for real
 * tests/security/run-settlement.test.ts
 *
 * lib/orchestration/runSettlement.ts is pure and carries no server-only
 * marker, so this suite imports the SHIPPED functions. A mirror of the
 * rule (tests/security/agent-execution.test.ts keeps one of the whole
 * orchestrator) keeps passing while the real code breaks; this cannot.
 *
 * The defect these pin (Phase 1, North Star §9): the step loop marked an
 * unapproved high-risk step `awaiting_approval` and carried on, so a plan
 * [knowledge.create, knowledge.delete] wrote the note, never asked for
 * the delete's approval, and answered "Finished." with success: true.
 * The orchestrator's wiring to these functions is pinned in
 * architecture-invariants.test.ts (invariants 5 and 15).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  approvalGate,
  settleRun,
  type GateStep,
} from "../../lib/orchestration/runSettlement.ts";

const low = (toolId: string): GateStep => ({
  toolId,
  requiresApproval: false,
  approved: false,
});

const high = (toolId: string, approved: boolean): GateStep => ({
  toolId,
  requiresApproval: true,
  approved,
});

void describe("The approval gate", () => {
  void test("a plan with no high-risk step is open", () => {
    assert.deepEqual(
      approvalGate([low("knowledge.search"), low("knowledge.create")]),
      { open: true },
    );
  });

  void test("a high-risk step holding a verified grant does not block", () => {
    assert.deepEqual(
      approvalGate([low("knowledge.create"), high("knowledge.delete", true)]),
      { open: true },
    );
  });

  void test("an unapproved step closes the whole plan, even when a low-risk step comes first", () => {
    /* The reported defect: the create ran and the run said "Finished." */
    assert.deepEqual(
      approvalGate([low("knowledge.create"), high("knowledge.delete", false)]),
      { open: false, awaiting: ["knowledge.delete"] },
    );
  });

  void test("an unapproved step closes the whole plan when steps follow it", () => {
    /* Steps after it used to run although the step before them never did. */
    assert.deepEqual(
      approvalGate([high("knowledge.delete", false), low("knowledge.create")]),
      { open: false, awaiting: ["knowledge.delete"] },
    );
  });

  void test("every missing grant is listed once, in plan order", () => {
    assert.deepEqual(
      approvalGate([
        high("knowledge.delete", false),
        low("knowledge.search"),
        high("gmail.send", true),
        high("calendar.create", false),
        high("knowledge.delete", false),
      ]),
      { open: false, awaiting: ["knowledge.delete", "calendar.create"] },
    );
  });

  void test("an approval flag on a step that needs none changes nothing", () => {
    assert.deepEqual(
      approvalGate([{ toolId: "task.list", requiresApproval: false, approved: true }]),
      { open: true },
    );
  });
});

void describe("Run settlement", () => {
  void test("a run is completed only when every step completed", () => {
    assert.deepEqual(settleRun(["completed", "completed"]), {
      state: "completed",
      error: null,
    });
  });

  void test("a failed step fails the run", () => {
    assert.deepEqual(settleRun(["completed", "failed"]), {
      state: "failed",
      error: "STEP_FAILED",
    });
  });

  void test("a budget stop is not a finished run, whether or not anything ran", () => {
    for (const statuses of [["completed", "skipped"], ["skipped"]] as const) {
      assert.deepEqual(settleRun(statuses), {
        state: "failed",
        error: "PLAN_INCOMPLETE",
      });
    }
  });

  void test("a step still awaiting approval never settles as completed", () => {
    assert.deepEqual(settleRun(["completed", "awaiting_approval"]), {
      state: "failed",
      error: "PLAN_INCOMPLETE",
    });
  });

  void test("a run that recorded no step did no work", () => {
    assert.deepEqual(settleRun([]), {
      state: "failed",
      error: "PLAN_INCOMPLETE",
    });
  });

  void test("a failure is reported as a failure, not as incompleteness", () => {
    assert.deepEqual(settleRun(["skipped", "failed"]), {
      state: "failed",
      error: "STEP_FAILED",
    });
  });
});

void describe("The rule stays exercisable", () => {
  void test("the module has no runtime import and no server-only marker", () => {
    /*
     * One runtime import of a server-only module and this suite could
     * not load the real functions -- the pressure that produced mirrors.
     */
    const source = readFileSync(
      join(process.cwd(), "lib", "orchestration", "runSettlement.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    assert.ok(!/^\s*import\s+(?!type\b)/m.test(source), "runSettlement.ts must stay import-free.");
    assert.ok(!/server-only/.test(source), "runSettlement.ts must not be server-only.");
  });
});
