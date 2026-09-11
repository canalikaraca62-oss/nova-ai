/**
 * SYRAVEN — an approval is granted by a person, once
 * tests/security/approval-lifecycle.test.ts
 *
 * SECURITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * approval-fails-closed.test.ts guards the refusal: with no record, a
 * high-risk step does not run, and no field in the request body can
 * change that. This suite guards the other half — the path that now
 * exists for a person to actually grant one — because a control that
 * can be granted has failure modes a control that always refuses does
 * not.
 *
 * Three of them matter:
 *
 *   1. The grant must come from the user it was requested for, and the
 *      decision must be recorded as theirs. Not from the body.
 *
 *   2. A grant must be SPENT when used. verifyApproval() accepts any
 *      approved, unexpired record, and the same goal derives the same
 *      execution key — so an approval left at 'approved' after its step
 *      has run authorizes that step again on the next refresh.
 *
 *   3. The sentence shown above the Approve button must come from the
 *      server's tool registry, never from the model's plan or the
 *      request. Otherwise a goal could describe the action it wants
 *      permission for in whatever words make it likeliest to be
 *      allowed.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/**
 * Strips commentary.
 *
 * These files explain the control at length and name the very things
 * forbidden below, so a substring check against commented source would
 * match the explanation rather than the code.
 */
function executable(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*"))
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const STORE = executable(
  read("lib", "orchestration", "approvalStore.ts"),
);

const DECIDE_ROUTE = executable(
  read("app", "api", "agents", "approvals", "route.ts"),
);

const RUN_ROUTE = executable(
  read("app", "api", "agents", "run", "route.ts"),
);

const ORCHESTRATOR = executable(
  read("lib", "orchestration", "orchestrator.ts"),
);

/* -------------------------------------------------------------------------- */
/*                      THE DECIDER IS THE SESSION USER                       */
/* -------------------------------------------------------------------------- */

void describe("A decision belongs to the person who made it", () => {
  void test("the decider comes from the session, never the body", () => {
    assert.match(
      STORE,
      /decided_by_user_id:\s*session\.userId/,
      "Who decided must be the verified caller.",
    );

    for (const field of [
      "decidedBy",
      "decided_by_user_id",
      "requestedFor",
      "userId",
    ]) {
      const fromBody = new RegExp(
        `body(?:\\s*\\??\\.|\\[["'])\\s*${field}\\b`,
        "i",
      );

      assert.ok(
        !fromBody.test(DECIDE_ROUTE),
        `The decide route reads "${field}" from the request body.`,
      );
    }
  });

  void test("only the caller's own pending rows can be decided", () => {
    /*
     * Both filters matter. Without the ownership filter a caller could
     * decide somebody else's approval if RLS were ever relaxed; without
     * the pending filter, a second decision would overwrite the first.
     */
    assert.match(
      STORE,
      /\.eq\("requested_for_user_id",\s*session\.userId\)/,
      "A decision must be scoped to the caller's own approvals.",
    );

    assert.match(
      STORE,
      /\.eq\("status",\s*"pending"\)/,
      "Only a pending approval can be decided; the first answer stands.",
    );
  });

  void test("only approved or rejected may be chosen by a person", () => {
    /*
     * pending, expired and used are reached by the system: expiry is
     * the clock, and 'used' is the orchestrator spending a grant.
     * Accepting them here would let a caller mark their own approval
     * used, or revive an expired one.
     */
    assert.match(
      DECIDE_ROUTE,
      /decision !== "approved" && decision !== "rejected"/,
      "A decision must be exactly approved or rejected.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        A GRANT IS SPENT WHEN USED                          */
/* -------------------------------------------------------------------------- */

void describe("An approval authorizes one execution", () => {
  void test("the store can mark an approval used", () => {
    assert.match(
      STORE,
      /status:\s*"used"/,
      "Without a used state a grant stays live after it is spent.",
    );
  });

  void test("the run route actually consumes what was used", () => {
    /*
     * Defining consumeApproval is not enough — an unused function
     * leaves the replay open. This asserts the call site.
     */
    assert.match(
      RUN_ROUTE,
      /consumeApproval\(/,
      "A grant that is never consumed authorizes the next refresh too.",
    );
  });

  void test("the orchestrator reports what it spent", () => {
    assert.match(
      ORCHESTRATOR,
      /consumedApprovals\.push\(/,
      "The orchestrator must report which grants were actually used.",
    );

    /*
     * Recorded AFTER the tool runs. A step stopped by the budget, or
     * one that throws before executing, has spent nothing — burning
     * the grant there would make the user re-approve work that never
     * happened.
     */
    const executeIndex = ORCHESTRATOR.indexOf(
      "const outcome = await executeTool",
    );

    const pushIndex = ORCHESTRATOR.indexOf("consumedApprovals.push(");

    assert.ok(
      executeIndex !== -1 && pushIndex > executeIndex,
      "A grant is spent only once the step it authorized has run.",
    );
  });

  void test("live approvals exclude terminal rows", () => {
    /*
     * A rejected or already-used row must never be loaded as a live
     * grant. The partial unique index permits one live row per action,
     * so filtering to the non-terminal states is what makes the lookup
     * unambiguous.
     */
    assert.match(
      STORE,
      /\.in\("status",\s*\["pending",\s*"approved"\]\)/,
      "Only pending and approved rows are live approvals.",
    );
  });

  void test("an elapsed expiry is treated as expired on read", () => {
    /*
     * Nothing rewrites a row at the moment its clock passes, so a
     * stored 'approved' with an expires_at in the past would otherwise
     * come back as a usable grant.
     */
    assert.match(
      STORE,
      /expiresAt <= now\s*\n?\s*\?\s*"expired"/,
      "A lapsed approval must not read back as approved.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                   WHAT THE USER IS ASKED IS THE SERVER'S                   */
/* -------------------------------------------------------------------------- */

void describe("The effect shown is the server's own description", () => {
  void test("the run route takes the effect from the registry", () => {
    assert.match(
      RUN_ROUTE,
      /getTool\(toolId\)\?\.description/,
      "The sentence above Approve must come from the tool registry.",
    );
  });

  void test("it is not taken from the plan or the request", () => {
    for (const forbidden of [
      /body\s*\??\.\s*effect\b/i,
      /step\.args\s*\.\s*effect/i,
      /plan\s*\??\.\s*effect/i,
    ]) {
      assert.ok(
        !forbidden.test(RUN_ROUTE),
        `The effect text is taken from ${String(forbidden)}, which the ` +
          `caller controls.`,
      );
    }
  });

  void test("a request is written as pending with no decider", () => {
    /*
     * The insert policy accepts nothing else, and this mirrors it in
     * code so the intent is visible without reading the migration.
     */
    assert.match(
      STORE,
      /status:\s*"pending" as const/,
      "An approval is born pending; it cannot be inserted granted.",
    );
  });
});
