/**
 * SYRAVEN — a high-risk step cannot approve itself
 * tests/security/approval-fails-closed.test.ts
 *
 * SECURITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * The orchestrator stops a high-risk tool call at `awaiting_approval`
 * and asks for a server-held approval record. There is no store for
 * those records yet, so `loadApprovals()` returns an empty map and
 * every high-risk step stops. Nothing proceeds.
 *
 * That is the correct failing direction, and it is fragile in a
 * specific way: the obvious way to "fix" the dead end is to let the
 * caller say it has been approved — a flag in the request body, an
 * `approved: true` in the plan, a client-supplied approval id. Any of
 * those would hand the decision to the party the control exists to
 * constrain, and the product would still appear to work.
 *
 * This suite exists so that the next person to make approvals work has
 * to do it with a real store, and cannot accidentally do it by
 * trusting the request.
 *
 * WHAT IT DOES NOT ASSERT
 *
 * That approvals function. They do not: there is no approve endpoint
 * and no UI that grants one. A workflow needing a high-risk tool is
 * currently a dead end, which is a product gap, not a security hole.
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
 * Strips comments.
 *
 * The files below explain this control at length and name the very
 * things forbidden here, so a substring check against commented source
 * would match the explanation rather than the code.
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

const RUN_ROUTE = executable(
  read("app", "api", "agents", "run", "route.ts"),
);

const EXECUTION = executable(
  read("lib", "orchestration", "execution.ts"),
);

const REGISTRY = executable(
  read("lib", "orchestration", "registry.ts"),
);

/* -------------------------------------------------------------------------- */
/*                        APPROVAL COMES FROM THE SERVER                      */
/* -------------------------------------------------------------------------- */

void describe("An approval is never taken from the caller", () => {
  void test("the run route reads no approval field from the body", () => {
    /*
     * The request body is the attacker-controlled surface. If any of
     * these names is read from it, the control is decorative.
     */
    for (const field of [
      "approved",
      "isApproved",
      "approval",
      "approvalId",
      "requiresConfirmation",
      "skipApproval",
      "autoApprove",
    ]) {
      const readFromBody = new RegExp(
        `body(?:\\s*\\??\\.|\\[["'])\\s*${field}\\b`,
        "i",
      );

      assert.ok(
        !readFromBody.test(RUN_ROUTE),
        `The run route reads "${field}" from the request body. An ` +
          `approval supplied by the caller approves nothing.`,
      );
    }
  });

  void test("loadApprovals takes no argument from the request", () => {
    /*
     * Signature, not body: a store-backed implementation will take a
     * session and an execution key. What it must never take is the
     * parsed request, because that is how a caller-supplied record
     * would arrive.
     */
    const signature = /async function loadApprovals\(([^)]*)\)/.exec(
      RUN_ROUTE,
    );

    assert.ok(
      signature,
      "loadApprovals must exist — it is the approval boundary.",
    );

    const parameters = signature?.[1] ?? "";

    assert.ok(
      !/\brequest\b|\bbody\b|\bpayload\b/i.test(parameters),
      `loadApprovals accepts "${parameters.trim()}". An approval that ` +
        `arrives with the request is not an approval.`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          THE VERIFIER STAYS STRICT                         */
/* -------------------------------------------------------------------------- */

void describe("A record is checked, not merely present", () => {
  void test("verifyApproval exists and is exported", () => {
    assert.match(
      EXECUTION,
      /export function verifyApproval|export const verifyApproval/,
      "The verifier is the only thing standing between a record and " +
        "an execution.",
    );
  });

  void test("it checks who, what, where and when", () => {
    /*
     * A record that is merely present proves nothing. Each of these is
     * a real branch in verifyApproval, and each closes a distinct
     * replay: a colleague's approval, a stale one, one issued for a
     * gentler tool, or one issued in another tenant.
     */
    for (const [name, pattern] of [
      ["the requesting user", /record\.requestedForUserId !== attempt\.actingUserId/],
      ["that a human actually decided", /record\.decidedByUserId ===\s*(?:null|undefined)/],
      ["the tool", /record\.toolId !== attempt\.toolId/],
      ["the tenant scope", /record\.workspaceId !== attempt\.workspaceId/],
    ] as const) {
      assert.match(
        EXECUTION,
        pattern,
        `verifyApproval must check ${name}.`,
      );
    }
  });

  void test("expiry is compared against now, not merely stored", () => {
    /*
     * The real comparison reads `now >= record.expiresAt`, so a regex
     * anchored on expiresAt-then-operator misses it. Anchor on the
     * comparison itself.
     */
    assert.match(
      EXECUTION,
      /now\s*>=\s*record\.expiresAt/,
      "An expiry that is never compared is a field, not a control.",
    );
  });

  void test("an approval nobody decided is not permission", () => {
    /*
     * A row can read state="approved" while decidedByUserId is null --
     * malformed data, or a partial write. That must deny rather than
     * pass, and it is checked before the user comparison so a null
     * decider cannot coincidentally match a null acting user.
     */
    assert.match(
      EXECUTION,
      /record\.decidedByUserId !== attempt\.actingUserId/,
      "The approver must be the verified caller, not merely present.",
    );
  });

  void test("absence of a record denies", () => {
    assert.match(
      EXECUTION,
      /record === null \|\| record\.state !== "approved"/,
      "A missing record must read as denial, never as permission.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        RISK IS DECIDED ON THE SERVER                       */
/* -------------------------------------------------------------------------- */

void describe("Risk is the server's judgement", () => {
  void test("requiresHumanApproval is defined in the registry", () => {
    assert.match(
      REGISTRY,
      /requiresHumanApproval/,
      "Whether a tool needs a human must be decided where the tool is " +
        "defined, not where it is called.",
    );
  });

  void test("the registry does not read risk from a caller", () => {
    assert.ok(
      !/body\s*\??\.\s*risk\b/i.test(REGISTRY),
      "A caller that can name its own risk level can name it low.",
    );
  });
});
