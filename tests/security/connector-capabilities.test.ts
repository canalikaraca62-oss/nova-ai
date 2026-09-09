/**
 * SYRAVEN — Connector capability boundary
 * tests/security/connector-capabilities.test.ts
 *
 * SECURITY REGRESSION SUITE.
 *
 * WHAT IS BEING PROTECTED
 *
 * A connector capability is the point where SYRAVEN stops acting inside
 * its own database and starts acting in the world — sending somebody's
 * mail, moving somebody's meeting, posting to somebody's channel. Two
 * properties have to hold absolutely:
 *
 *   1. It fails CLOSED. No connection, an inactive one, an expired
 *      credential, or a scope that was never granted all mean the
 *      action does not happen.
 *
 *   2. Anything a third party can see requires a human to approve that
 *      specific act. A connector must not be able to lower that bar for
 *      itself.
 *
 * The migration that stores connections is NOT applied, so nothing can
 * be connected yet and every capability currently resolves to
 * NOT_CONNECTED. That is the honest state, and these tests pin the
 * behaviour now so the guarantees are already in place when it is.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONNECTOR_CAPABILITIES,
  type ConnectionSnapshot,
  capabilitiesForProvider,
  getCapability,
  requiresApproval,
  resolveAvailability,
} from "../../lib/integrations/capabilities.ts";

/* -------------------------------------------------------------------------- */
/*                                  FIXTURES                                  */
/* -------------------------------------------------------------------------- */

const NOW = new Date("2026-09-09T12:00:00.000Z");

/**
 * Strips comments so a note DESCRIBING a rule is never mistaken for the
 * code that implements it.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** An otherwise-valid Gmail connection, adjusted per test. */
function gmailConnection(
  overrides: Partial<ConnectionSnapshot> = {},
): ConnectionSnapshot {
  return {
    id: "conn-1",
    provider: "gmail",
    status: "active",
    expiresAt: null,
    grantedScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*                                FAIL CLOSED                                 */
/* -------------------------------------------------------------------------- */

void describe("A capability is unavailable unless everything is right", () => {
  void test("no connection means not connected", () => {
    const result = resolveAvailability(
      "gmail.send.message",
      null,
      NOW,
    );

    assert.equal(result.available, false);
    assert.equal(
      result.available === false ? result.reason : null,
      "NOT_CONNECTED",
    );
  });

  void test("a connection for another provider does not count", () => {
    /*
     * The guard is not "has the user connected anything": a Slack
     * connection must never satisfy a Gmail capability.
     */
    const result = resolveAvailability(
      "gmail.send.message",
      gmailConnection({ provider: "slack" }),
      NOW,
    );

    assert.equal(result.available, false);
    assert.equal(
      result.available === false ? result.reason : null,
      "NOT_CONNECTED",
    );
  });

  void test("every non-active status fails closed", () => {
    for (const status of [
      "inactive",
      "expired",
      "revoked",
      "error",
      "pending",
      /* An unrecognised value must not fall through as permissive. */
      "something-new",
    ]) {
      const result = resolveAvailability(
        "gmail.send.message",
        gmailConnection({ status }),
        NOW,
      );

      assert.equal(
        result.available,
        false,
        `status "${status}" must not permit a side effect.`,
      );
    }
  });

  void test("an expired credential fails closed", () => {
    const result = resolveAvailability(
      "gmail.send.message",
      gmailConnection({
        expiresAt: "2026-09-09T11:59:59.000Z",
      }),
      NOW,
    );

    assert.equal(result.available, false);
    assert.equal(
      result.available === false ? result.reason : null,
      "CREDENTIAL_EXPIRED",
    );
  });

  void test("an unparseable expiry is treated as expired", () => {
    /*
     * The alternative is trusting a timestamp that could not be read,
     * which is how a permanently-valid credential gets invented.
     */
    const result = resolveAvailability(
      "gmail.send.message",
      gmailConnection({ expiresAt: "not a date" }),
      NOW,
    );

    assert.equal(result.available, false);
    assert.equal(
      result.available === false ? result.reason : null,
      "CREDENTIAL_EXPIRED",
    );
  });

  void test("a scope that was never granted fails closed", () => {
    /*
     * Connecting an account is not consent to everything the product
     * might want from it. A user who granted read must not have mail
     * sent on their behalf.
     */
    const result = resolveAvailability(
      "gmail.send.message",
      gmailConnection({
        grantedScopes: [
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
      }),
      NOW,
    );

    assert.equal(result.available, false);
    assert.equal(
      result.available === false ? result.reason : null,
      "SCOPE_NOT_GRANTED",
    );
  });

  void test("an unknown capability is refused, not defaulted", () => {
    for (const candidate of [
      "gmail.delete.everything",
      "",
      null,
      undefined,
      42,
      { id: "gmail.send.message" },
    ]) {
      const result = resolveAvailability(
        candidate,
        gmailConnection(),
        NOW,
      );

      assert.equal(
        result.available,
        false,
        `${String(candidate)} must not resolve to a real capability.`,
      );
    }
  });

  void test("a fully valid connection is available", () => {
    /*
     * The positive case matters: a suite that only proves things are
     * refused would also pass if nothing ever worked.
     */
    const result = resolveAvailability(
      "gmail.send.message",
      gmailConnection({
        expiresAt: "2026-09-09T13:00:00.000Z",
      }),
      NOW,
    );

    assert.equal(result.available, true);
    assert.equal(
      result.available === true ? result.connectionId : null,
      "conn-1",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                              APPROVAL BOUNDARY                             */
/* -------------------------------------------------------------------------- */

void describe("Outward-facing capabilities require approval", () => {
  /**
   * Capabilities a third party observes the moment they run. Each must
   * be high risk, and therefore gated on a human.
   */
  const OUTWARD = [
    "gmail.send.message",
    "calendar.create.event",
    "calendar.modify.event",
    "calendar.cancel.event",
    "github.comment.issue",
    "slack.send.message",
  ] as const;

  for (const id of OUTWARD) {
    void test(`${id} needs a human`, () => {
      const capability = getCapability(id);

      assert.ok(capability, `${id} is not registered.`);

      assert.equal(
        capability.risk,
        "high",
        `${id} reaches another person, so it cannot be below high risk.`,
      );

      assert.equal(
        requiresApproval(capability.risk),
        true,
        `${id} must not run without approval.`,
      );
    });
  }

  void test("reads do not demand approval", () => {
    /*
     * If everything required approval, approval would stop meaning
     * anything and users would click through it.
     */
    const read = getCapability("gmail.read.messages");

    assert.ok(read);
    assert.equal(read.risk, "low");
    assert.equal(requiresApproval(read.risk), false);
  });

  void test("a draft is not treated as a send", () => {
    /*
     * A draft lands in the user's own mailbox and nobody else sees it.
     * Conflating the two would make the send boundary meaningless.
     */
    const draft = getCapability("gmail.draft.message");
    const send = getCapability("gmail.send.message");

    assert.ok(draft && send);
    assert.equal(draft.risk, "medium");
    assert.equal(send.risk, "high");
  });

  void test("every registered capability declares a known risk", () => {
    for (const id of CONNECTOR_CAPABILITIES) {
      const capability = getCapability(id);

      assert.ok(capability, `${id} is listed but not defined.`);

      assert.ok(
        ["low", "medium", "high"].includes(capability.risk),
        `${id} has an unrecognised risk level.`,
      );

      assert.ok(
        capability.requiredScopes.length > 0,
        `${id} declares no scope, so nothing constrains what it may do.`,
      );
    }
  });

  void test("providers expose the capabilities they declare", () => {
    const gmail = capabilitiesForProvider("gmail");

    assert.equal(gmail.length, 3);

    assert.ok(
      gmail.every((capability) => capability.provider === "gmail"),
      "capabilitiesForProvider returned another provider's capability.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                             NO CREDENTIAL LEAK                             */
/* -------------------------------------------------------------------------- */

void describe("Availability decisions cannot leak a credential", () => {
  void test("the snapshot type carries no token", () => {
    /*
     * Enforced on the source rather than at runtime: the point is that
     * a token can never be passed in, so no message built from a
     * snapshot can accidentally contain one.
     */
    const source = readFileSync(
      join(process.cwd(), "lib", "integrations", "capabilities.ts"),
      "utf8",
    );

    const snapshot = source.slice(
      source.indexOf("export interface ConnectionSnapshot"),
      source.indexOf("export function resolveAvailability"),
    );

    assert.ok(snapshot.length > 0, "ConnectionSnapshot is missing.");

    for (const forbidden of [
      "accessToken",
      "refreshToken",
      "apiKey",
      "credential_ref",
      "credentialRef",
    ]) {
      assert.ok(
        !snapshot.includes(forbidden),
        `ConnectionSnapshot exposes ${forbidden} to the availability ` +
          `check, which has no need of it.`,
      );
    }
  });

  void test("no unavailable message names a scope", () => {
    /*
     * Scope strings are provider jargon, and naming them invites a user
     * to go hunting for a way to grant one by hand.
     */
    const result = resolveAvailability(
      "gmail.send.message",
      gmailConnection({ grantedScopes: [] }),
      NOW,
    );

    assert.equal(result.available, false);

    if (result.available === false) {
      assert.ok(
        !result.message.includes("googleapis.com"),
        "A user-facing message must not contain a raw provider scope.",
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                                 MIGRATION                                  */
/* -------------------------------------------------------------------------- */

void describe("The connection table keeps secrets out", () => {
  const MIGRATION = readFileSync(
    join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260909120000_syraven_integration_connections.sql",
    ),
    "utf8",
  );

  const code = MIGRATION.split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  void test("it stores no token column", () => {
    /*
     * A refresh token is a long-lived bearer credential for a real
     * mailbox. RLS protects a row from another tenant; it does not
     * protect it from an injection, a backup, or a logged query plan.
     */
    /*
      Matched as a COLUMN DECLARATION, not as a substring.

      A bare `includes` was too blunt in both directions: it fired on the
      auth_type CHECK list, whose legitimate value 'personal_access_token'
      contains "access_token", while a column named `token` would have
      slipped past a list of specific names. The shape being forbidden is
      an identifier at the start of a line followed by a type — which is
      what a column is.
    */
    const columnPattern =
      /^\s*(access_token|refresh_token|api_key|client_secret|token|secret)\s+(text|varchar|jsonb|bytea)/im;

    const match = columnPattern.exec(code);

    assert.equal(
      match,
      null,
      `The migration declares a ${match?.[1] ?? ""} column. A refresh ` +
        `token is a bearer credential for somebody's real mailbox; RLS ` +
        `protects a row from another tenant, not from an injection, a ` +
        `backup, or a logged query plan. Credentials belong in a secret ` +
        `store, and this table keeps only an opaque pointer.`,
    );
  });

  void test("it keeps an opaque pointer instead", () => {
    assert.match(
      code,
      /credential_ref\s+text/,
      "There must be a pointer into a secret store.",
    );
  });

  void test("row level security is enabled", () => {
    assert.match(
      code,
      /alter table public\.integration_connections\s*\n?\s*enable row level security/,
    );
  });

  void test("every verb is owner scoped", () => {
    for (const verb of ["select", "insert", "update", "delete"]) {
      assert.match(
        code,
        new RegExp(`integration_connections_${verb}_own`),
        `${verb} has no owner-scoped policy.`,
      );
    }
  });

  void test("a user can always disconnect", () => {
    /*
     * Without delete, a user cannot withdraw access to their own
     * mailbox — which would make connecting one irreversible.
     */
    assert.match(code, /for delete\s*\n\s*to authenticated/);
  });

  void test("workspace membership grants nothing", () => {
    /*
     * Sharing a workspace must not share a mailbox. workspace_id exists
     * for scoping but must not appear in a policy predicate.
     */
    const policies = code.slice(code.indexOf("create policy"));

    assert.ok(
      !/using\s*\([^)]*workspace_id/.test(policies),
      "A policy grants access via workspace membership.",
    );
  });

  void test("anon is granted nothing", () => {
    assert.match(
      code,
      /revoke all on public\.integration_connections from anon/,
    );
  });

  void test("it is additive and idempotent", () => {
    assert.match(code, /create table if not exists/);

    assert.ok(
      !/drop table|truncate|alter column|drop column/i.test(code),
      "The migration is not additive.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            THE ORCHESTRATION GATE                          */
/* -------------------------------------------------------------------------- */

void describe("Connector tools are gated in the orchestrator", () => {
  const REGISTRY = readFileSync(
    join(process.cwd(), "lib", "orchestration", "registry.ts"),
    "utf8",
  );

  const TOOLS = readFileSync(
    join(process.cwd(), "lib", "orchestration", "tools.ts"),
    "utf8",
  );

  const registryCode = stripComments(REGISTRY);
  const toolsCode = stripComments(TOOLS);

  void test("every connector tool is high risk", () => {
    /*
     * Risk is what drives requiresHumanApproval() in the orchestrator.
     * A connector tool registered below high would execute without a
     * human ever seeing it — the single worst regression available here.
     */
    for (const tool of ["gmail.send", "calendar.create"]) {
      const start = registryCode.indexOf(`"${tool}": {`);

      assert.ok(start > 0, `${tool} is not registered.`);

      /*
        Bounded to the tool's OWN definition.

        A fixed-width window was the first attempt and it was wrong: 600
        characters from "gmail.send" ran past its closing brace into
        "calendar.create", so the regex matched the NEXT tool's risk. The
        test passed with gmail.send downgraded to medium — it was
        asserting against its neighbour. Verified by making exactly that
        change and watching it stay green.

        The definition ends at its own closing "\n  }," which is the
        first one at this nesting depth.
      */
      const rest = registryCode.slice(start);

      const end = rest.indexOf("\n  },");

      assert.ok(end > 0, `${tool}'s definition is not delimited.`);

      const definition = rest.slice(0, end);

      assert.match(
        definition,
        /risk:\s*"high"/,
        `${tool} reaches a third party, so it cannot be below high risk.`,
      );
    }
  });

  void test("a connector tool is not tenant scoped", () => {
    /*
     * A mailbox belongs to a person, not a workspace. Marking these
     * tenantScoped would invite the reading that membership of a
     * workspace confers use of a colleague's account.
     */
    const rest = registryCode.slice(
      registryCode.indexOf('"gmail.send": {'),
    );

    /* Bounded to its own definition — see the note on risk above. */
    const definition = rest.slice(0, rest.indexOf("\n  },"));

    assert.match(definition, /tenantScoped:\s*false/);
  });

  void test("the capability gate runs before the executor", () => {
    /*
     * Ordering is the whole guarantee. If the executor were reached
     * first, an implemented connector would send the mail and only then
     * discover that no account was connected.
     */
    const gate = toolsCode.indexOf("capabilityForTool(tool.id)");
    const dispatch = toolsCode.indexOf("EXECUTORS[tool.id]");

    assert.ok(gate > 0, "executeTool does not consult the capability map.");
    assert.ok(dispatch > 0, "executeTool no longer dispatches.");

    assert.ok(
      gate < dispatch,
      "The connection check must precede dispatch, or the side effect " +
        "happens before anyone asks whether it may.",
    );
  });

  void test("an unconnected account refuses distinctly", () => {
    assert.match(
      toolsCode,
      /INTEGRATION_NOT_CONNECTED/,
      "A missing connection must be reported as its own outcome, not " +
        "folded into a generic failure.",
    );
  });

  void test("a tool mapped to no capability is refused", () => {
    /*
     * A mapping onto a capability that does not exist is a wiring
     * mistake. Running the tool anyway would perform an outward-facing
     * action whose permission was never checked.
     */
    const gate = toolsCode.slice(
      toolsCode.indexOf("capabilityForTool(tool.id)"),
      toolsCode.indexOf("EXECUTORS[tool.id]"),
    );

    assert.match(
      gate,
      /if\s*\(!definition\)/,
      "An unknown capability mapping must fail closed.",
    );
  });

  void test("every mapped capability exists", () => {
    /*
     * The live check behind the source assertion above: each tool's
     * capability id must resolve, or the gate refuses every call to it.
     */
    for (const capabilityId of [
      "gmail.send.message",
      "calendar.create.event",
    ]) {
      const capability = getCapability(capabilityId);

      assert.ok(
        capability,
        `${capabilityId} is mapped from a tool but not defined.`,
      );

      assert.equal(
        capability.risk,
        "high",
        `${capabilityId} is reachable from a tool, so it must be high.`,
      );
    }
  });

  void test("nothing is connected today, so connectors refuse", () => {
    /*
     * The migration is written but NOT applied, so no connection row can
     * exist. This pins the honest present state: a plan may propose a
     * send, and it resolves to "Connect Gmail to do this" rather than to
     * a claim that mail went out.
     */
    const result = resolveAvailability("gmail.send.message", null);

    assert.equal(result.available, false);

    if (result.available === false) {
      assert.match(
        result.message,
        /Connect Gmail/,
        "The refusal must name the account to connect.",
      );
    }
  });
});
