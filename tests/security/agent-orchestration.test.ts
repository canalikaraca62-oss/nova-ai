/**
 * SYRAVEN — Agent orchestration security tests
 *
 * Phase 9 (see IMPLEMENTATION_PLAN.md).
 *
 * ARCHITECTURE_AUDIT.md §14: agent execution was a single stateless LLM
 * call — no tools, no permission model, no approval, no state. The agent
 * definitions in lib/agents/ were never consulted by it.
 *
 * And `/api/action` decided whether an action needed confirmation from a
 * CLIENT-SUPPLIED field, so risk was self-declared.
 *
 * The principle these tests hold: THE MODEL PROPOSES, THE SERVER
 * AUTHORIZES.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* -------------------------------------------------------------------------- */
/*                          MIRRORED CAPABILITY LOGIC                         */
/* -------------------------------------------------------------------------- */

/*
 * lib/orchestration/* imports "server-only". The decision logic is pure,
 * so it is mirrored here and held to the source by the invariant suites.
 */

type PlanId = "free" | "starter" | "pro" | "business" | "enterprise";
type RiskLevel = "low" | "medium" | "high";

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

interface Tool {
  id: string;
  risk: RiskLevel;
  minimumPlan: PlanId;
  schema: Record<
    string,
    { type: "string" | "number" | "boolean" | "uuid"; required: boolean; maxLength?: number }
  >;
}

interface Agent {
  id: string;
  allowedTools: string[];
  minimumPlan: PlanId;
  maxRisk: RiskLevel;
  maxToolCalls: number;
  maxDepth: number;
}

const TOOLS: Record<string, Tool> = {
  "knowledge.search": {
    id: "knowledge.search",
    risk: "low",
    minimumPlan: "free",
    schema: { query: { type: "string", required: true, maxLength: 500 } },
  },
  "task.create": {
    id: "task.create",
    risk: "medium",
    minimumPlan: "free",
    schema: {
      title: { type: "string", required: true, maxLength: 500 },
      projectId: { type: "uuid", required: false },
    },
  },
  "knowledge.delete": {
    id: "knowledge.delete",
    risk: "high",
    minimumPlan: "free",
    schema: { knowledgeId: { type: "uuid", required: true } },
  },
};

const AGENTS: Record<string, Agent> = {
  researcher: {
    id: "researcher",
    allowedTools: ["knowledge.search"],
    minimumPlan: "free",
    maxRisk: "low",
    maxToolCalls: 5,
    maxDepth: 2,
  },
  organizer: {
    id: "organizer",
    allowedTools: ["knowledge.search", "task.create"],
    minimumPlan: "free",
    maxRisk: "medium",
    maxToolCalls: 8,
    maxDepth: 2,
  },
  curator: {
    id: "curator",
    allowedTools: ["knowledge.search", "knowledge.delete"],
    minimumPlan: "pro",
    maxRisk: "high",
    maxToolCalls: 6,
    maxDepth: 2,
  },
};

type Decision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "UNKNOWN_AGENT"
        | "UNKNOWN_TOOL"
        | "TOOL_NOT_GRANTED"
        | "RISK_EXCEEDS_AGENT"
        | "PLAN_NOT_PERMITTED";
    };

function resolveCapability(agentId: unknown, toolId: unknown, plan: PlanId): Decision {
  const agent = typeof agentId === "string" ? AGENTS[agentId.trim()] : undefined;
  if (!agent) return { allowed: false, reason: "UNKNOWN_AGENT" };

  const tool = typeof toolId === "string" ? TOOLS[toolId.trim()] : undefined;
  if (!tool) return { allowed: false, reason: "UNKNOWN_TOOL" };

  if (!agent.allowedTools.includes(tool.id)) {
    return { allowed: false, reason: "TOOL_NOT_GRANTED" };
  }

  if (RISK_RANK[tool.risk] > RISK_RANK[agent.maxRisk]) {
    return { allowed: false, reason: "RISK_EXCEEDS_AGENT" };
  }

  const required =
    PLAN_RANK[tool.minimumPlan] >= PLAN_RANK[agent.minimumPlan]
      ? tool.minimumPlan
      : agent.minimumPlan;

  if (PLAN_RANK[plan] < PLAN_RANK[required]) {
    return { allowed: false, reason: "PLAN_NOT_PERMITTED" };
  }

  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/*                          UNKNOWN AGENTS AND TOOLS                          */
/* -------------------------------------------------------------------------- */

void describe("Unknown agents and tools fail closed", () => {
  void test("an unknown agent is refused, never defaulted", () => {
    for (const id of ["superagent", "", "  ", "admin", null, 42, {}]) {
      const d = resolveCapability(id, "knowledge.search", "enterprise");

      assert.equal(d.allowed, false, `${JSON.stringify(id)} must be refused`);
    }
  });

  void test("a hallucinated tool name grants nothing", () => {
    /*
     * The core "model invents a tool" attack. A model emitting
     * `shell.exec` must get a refusal, not an attempt.
     */
    for (const tool of [
      "shell.exec",
      "http.fetch",
      "db.query",
      "knowledge.search ",
      "../knowledge.search",
      "",
    ]) {
      const d = resolveCapability("researcher", tool, "enterprise");

      if (tool === "knowledge.search ") {
        /* Trimmed, so this one legitimately resolves. */
        assert.equal(d.allowed, true);
        continue;
      }

      assert.equal(
        d.allowed,
        false,
        `${JSON.stringify(tool)} must not resolve to a real tool`,
      );
    }
  });

  void test("a tool the agent does not hold is refused", () => {
    const d = resolveCapability("researcher", "task.create", "enterprise");

    assert.equal(d.allowed, false);
    assert.equal(
      d.allowed === false && d.reason,
      "TOOL_NOT_GRANTED",
      "Capability is granted per agent, not globally.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          RISK AND PLAN CEILINGS                            */
/* -------------------------------------------------------------------------- */

void describe("Risk and plan ceilings bound blast radius", () => {
  void test("an agent cannot exceed its own risk cap", () => {
    /*
     * `organizer` holds no delete tool, but even if it did, its
     * maxRisk of "medium" is an independent second bound.
     */
    const agent = AGENTS["organizer"];
    assert.ok(agent);

    const withDelete: Agent = {
      ...agent,
      allowedTools: [...agent.allowedTools, "knowledge.delete"],
    };

    const risk = TOOLS["knowledge.delete"]?.risk ?? "high";

    assert.ok(
      RISK_RANK[risk] > RISK_RANK[withDelete.maxRisk],
      "A high-risk tool must exceed a medium-capped agent even when " +
        "granted, so the cap is a real second bound.",
    );
  });

  void test("a free-tier caller cannot use a pro-gated agent", () => {
    const d = resolveCapability("curator", "knowledge.search", "free");

    assert.equal(d.allowed, false);
    assert.equal(d.allowed === false && d.reason, "PLAN_NOT_PERMITTED");
  });

  void test("the higher of agent and tool plan requirements applies", () => {
    assert.equal(
      resolveCapability("curator", "knowledge.search", "pro").allowed,
      true,
      "pro meets the curator's own minimum",
    );

    assert.equal(
      resolveCapability("curator", "knowledge.search", "starter").allowed,
      false,
      "starter does not, even though the tool itself is free-tier",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        HUMAN-IN-THE-LOOP / APPROVAL                        */
/* -------------------------------------------------------------------------- */

interface ApprovalRecord {
  requestedForUserId: string;
  toolId: string;
  workspaceId: string | null;
  projectId: string | null;
  state: "pending" | "approved" | "rejected" | "expired" | "used";
  decidedByUserId?: string | null;
  expiresAt: number;
}

function verifyApproval(
  record: ApprovalRecord | null,
  attempt: {
    actingUserId: string;
    toolId: string;
    workspaceId: string | null;
    projectId: string | null;
    now: number;
  },
): { valid: boolean; reason?: string } {
  if (record === null || record.state !== "approved") {
    return { valid: false, reason: "NOT_APPROVED" };
  }
  if (
    record.decidedByUserId === null ||
    record.decidedByUserId === undefined
  ) {
    return { valid: false, reason: "NOT_APPROVED" };
  }
  if (record.requestedForUserId !== attempt.actingUserId) {
    return { valid: false, reason: "WRONG_USER" };
  }
  if (record.decidedByUserId !== attempt.actingUserId) {
    return { valid: false, reason: "WRONG_USER" };
  }
  if (attempt.now >= record.expiresAt) {
    return { valid: false, reason: "EXPIRED" };
  }
  if (record.toolId !== attempt.toolId) {
    return { valid: false, reason: "TOOL_MISMATCH" };
  }
  if (
    record.workspaceId !== attempt.workspaceId ||
    record.projectId !== attempt.projectId
  ) {
    return { valid: false, reason: "SCOPE_MISMATCH" };
  }
  return { valid: true };
}

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const WS = "33333333-3333-4333-8333-333333333333";

const NOW = 1_000_000;

function approved(over: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    requestedForUserId: ALICE,
    toolId: "knowledge.delete",
    workspaceId: WS,
    projectId: null,
    state: "approved",
    decidedByUserId: ALICE,
    expiresAt: NOW + 60_000,
    ...over,
  };
}

const attempt = {
  actingUserId: ALICE,
  toolId: "knowledge.delete",
  workspaceId: WS,
  projectId: null as string | null,
  now: NOW,
};

void describe("Approval is server-side and non-forgeable", () => {
  void test("a missing approval is a denial", () => {
    /*
     * The control that makes a client-supplied `approved: true`
     * worthless: absence of a SERVER record denies.
     */
    assert.equal(verifyApproval(null, attempt).valid, false);
  });

  void test("a pending approval does not authorize", () => {
    assert.equal(
      verifyApproval(approved({ state: "pending" }), attempt).valid,
      false,
    );
  });

  void test("a rejected approval does not authorize", () => {
    assert.equal(
      verifyApproval(approved({ state: "rejected" }), attempt).valid,
      false,
    );
  });

  void test("a valid approval authorizes", () => {
    assert.equal(verifyApproval(approved(), attempt).valid, true);
  });

  void test("another user's approval does not authorize this caller", () => {
    const r = verifyApproval(approved(), { ...attempt, actingUserId: BOB });

    assert.equal(r.valid, false);
    assert.equal(r.reason, "WRONG_USER");
  });

  void test("an approval nobody decided does not authorize", () => {
    assert.equal(
      verifyApproval(approved({ decidedByUserId: null }), attempt).valid,
      false,
    );
  });

  void test("an expired approval does not authorize", () => {
    const r = verifyApproval(approved(), {
      ...attempt,
      now: NOW + 3_600_000,
    });

    assert.equal(r.valid, false);
    assert.equal(r.reason, "EXPIRED");
  });

  void test("an approval for one tool does not authorize another", () => {
    const r = verifyApproval(approved(), {
      ...attempt,
      toolId: "task.delete",
    });

    assert.equal(r.valid, false);
    assert.equal(r.reason, "TOOL_MISMATCH");
  });

  void test("an approval does not carry across tenants", () => {
    const r = verifyApproval(approved(), {
      ...attempt,
      workspaceId: "99999999-9999-4999-8999-999999999999",
    });

    assert.equal(r.valid, false);
    assert.equal(
      r.reason,
      "SCOPE_MISMATCH",
      "An approval issued in one workspace must not authorize an action " +
        "in a different tenant.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         EXECUTION STATE MACHINE                            */
/* -------------------------------------------------------------------------- */

type State =
  | "queued"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

const TRANSITIONS: Record<State, State[]> = {
  queued: ["planning", "cancelled", "failed"],
  planning: ["awaiting_approval", "executing", "failed", "cancelled"],
  awaiting_approval: ["executing", "cancelled", "expired", "failed"],
  executing: ["validating", "failed", "cancelled"],
  validating: ["completed", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

function canTransition(from: State, to: State): boolean {
  return TRANSITIONS[from].includes(to);
}

void describe("Execution state machine prevents re-execution", () => {
  void test("terminal states accept no transitions", () => {
    for (const terminal of [
      "completed",
      "failed",
      "cancelled",
      "expired",
    ] as State[]) {
      assert.equal(
        TRANSITIONS[terminal].length,
        0,
        `${terminal} must be terminal`,
      );
    }
  });

  void test("a completed execution cannot re-enter executing", () => {
    /*
     * This is what stops a browser refresh, a network retry, or a
     * duplicate delivery from running the work twice.
     */
    assert.equal(canTransition("completed", "executing"), false);
    assert.equal(canTransition("failed", "executing"), false);
    assert.equal(canTransition("cancelled", "executing"), false);
  });

  void test("approval cannot be skipped once required", () => {
    assert.equal(
      canTransition("awaiting_approval", "completed"),
      false,
      "An execution awaiting approval must not jump straight to done.",
    );

    assert.equal(canTransition("awaiting_approval", "executing"), true);
  });

  void test("the happy path is reachable", () => {
    assert.ok(canTransition("queued", "planning"));
    assert.ok(canTransition("planning", "executing"));
    assert.ok(canTransition("executing", "validating"));
    assert.ok(canTransition("validating", "completed"));
  });

  void test("every state has a failure path except terminals", () => {
    for (const [state, next] of Object.entries(TRANSITIONS)) {
      if (next.length === 0) continue;

      assert.ok(
        next.includes("failed") || next.includes("cancelled"),
        `${state} must be escapable on failure, or executions stall.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          ARGUMENT VALIDATION                               */
/* -------------------------------------------------------------------------- */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateArgs(
  tool: Tool,
  raw: unknown,
): { ok: boolean; reason?: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "ARGS_NOT_OBJECT" };
  }

  const provided = raw as Record<string, unknown>;

  for (const key of Object.keys(provided)) {
    if (!(key in tool.schema)) {
      return { ok: false, reason: `UNKNOWN_FIELD:${key}` };
    }
  }

  for (const [name, field] of Object.entries(tool.schema)) {
    const value = provided[name];

    if (value === undefined || value === null) {
      if (field.required) return { ok: false, reason: `MISSING:${name}` };
      continue;
    }

    if (field.type === "uuid") {
      if (typeof value !== "string" || !UUID_RE.test(value)) {
        return { ok: false, reason: `INVALID_UUID:${name}` };
      }
    } else if (field.type === "string") {
      if (typeof value !== "string") {
        return { ok: false, reason: `INVALID_TYPE:${name}` };
      }
      if (field.maxLength && value.length > field.maxLength) {
        return { ok: false, reason: `TOO_LONG:${name}` };
      }
    }
  }

  return { ok: true };
}

void describe("Tool arguments are strictly validated", () => {
  const deleteTool = TOOLS["knowledge.delete"];
  const searchTool = TOOLS["knowledge.search"];

  void test("unknown fields are REFUSED, not ignored", () => {
    assert.ok(deleteTool);

    const r = validateArgs(deleteTool, {
      knowledgeId: "11111111-1111-4111-8111-111111111111",
      __proto__: "x",
      isAdmin: true,
    });

    assert.equal(
      r.ok,
      false,
      "Ignoring extra keys lets a model smuggle arguments a future tool " +
        "version might honour.",
    );
  });

  void test("a malformed uuid is refused", () => {
    assert.ok(deleteTool);

    for (const bad of ["", "all", "*", "1; DROP TABLE", "../etc", 42, null]) {
      const r = validateArgs(deleteTool, { knowledgeId: bad });
      assert.equal(r.ok, false, `${JSON.stringify(bad)} must be refused`);
    }
  });

  void test("a missing required field is refused", () => {
    assert.ok(deleteTool);
    assert.equal(validateArgs(deleteTool, {}).ok, false);
  });

  void test("an oversized string is REFUSED, not truncated", () => {
    assert.ok(searchTool);

    const r = validateArgs(searchTool, { query: "x".repeat(10_000) });

    assert.equal(
      r.ok,
      false,
      "Truncating changes what the user approved; refusing does not.",
    );
  });

  void test("non-object arguments are refused", () => {
    assert.ok(searchTool);

    for (const bad of [null, "query", 42, [], true]) {
      assert.equal(validateArgs(searchTool, bad).ok, false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          EXECUTION BUDGET LIMITS                           */
/* -------------------------------------------------------------------------- */

const GLOBAL = { maxToolCalls: 10, maxDepth: 3, maxExecutionMs: 120_000 };

function checkBudget(
  used: number,
  depth: number,
  startedAt: number,
  agentTools: number,
  agentDepth: number,
  now: number,
): { ok: boolean; reason?: string } {
  if (used >= Math.min(agentTools, GLOBAL.maxToolCalls)) {
    return { ok: false, reason: "TOOL_CALL_LIMIT" };
  }
  if (depth >= Math.min(agentDepth, GLOBAL.maxDepth)) {
    return { ok: false, reason: "DEPTH_LIMIT" };
  }
  if (now - startedAt >= GLOBAL.maxExecutionMs) {
    return { ok: false, reason: "TIME_LIMIT" };
  }
  return { ok: true };
}

void describe("Execution is bounded", () => {
  void test("tool calls are capped", () => {
    assert.equal(checkBudget(5, 0, 0, 5, 2, 0).ok, false);
    assert.equal(checkBudget(4, 0, 0, 5, 2, 0).ok, true);
  });

  void test("the LOWER of agent and global cap applies", () => {
    /* An agent claiming 999 calls is still bound by the global 10. */
    assert.equal(
      checkBudget(10, 0, 0, 999, 2, 0).ok,
      false,
      "A mistake in one registry entry must not lift the global bound.",
    );
  });

  void test("depth is capped, bounding recursive agent spawning", () => {
    assert.equal(checkBudget(0, 2, 0, 5, 2, 0).ok, false);
    assert.equal(checkBudget(0, 3, 0, 5, 99, 0).ok, false);
  });

  void test("an abandoned execution times out", () => {
    const r = checkBudget(0, 0, 0, 5, 2, GLOBAL.maxExecutionMs + 1);

    assert.equal(r.ok, false);
    assert.equal(r.reason, "TIME_LIMIT");
  });
});

/* -------------------------------------------------------------------------- */
/*                              SOURCE INVARIANTS                             */
/* -------------------------------------------------------------------------- */

void describe("lib/orchestration/registry.ts invariants", () => {
  const source = read("lib", "orchestration", "registry.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("unknown agents and tools return null", () => {
    assert.match(code, /return AGENT_REGISTRY\[id\.trim\(\)\] \?\? null/);
    assert.match(code, /return TOOL_REGISTRY\[id\.trim\(\)\] \?\? null/);
  });

  void test("high risk always requires approval", () => {
    assert.match(
      code,
      /RISK_RANK\[risk\] >= RISK_RANK\.high/,
      "requiresHumanApproval must gate on the high tier.",
    );
  });

  void test("capability resolution refuses each failure mode", () => {
    for (const reason of [
      "UNKNOWN_AGENT",
      "UNKNOWN_TOOL",
      "TOOL_NOT_GRANTED",
      "RISK_EXCEEDS_AGENT",
      "PLAN_NOT_PERMITTED",
    ]) {
      assert.match(code, new RegExp(`reason: "${reason}"`));
    }
  });

  void test("the per-agent tool grant is actually enforced", () => {
    /*
     * The behavioural tests above exercise a mirror, so they cannot see
     * this check being deleted. Removing it would let ANY agent call ANY
     * registered tool — a research agent could delete knowledge.
     */
    assert.match(
      code,
      /if \(!agent\.allowedTools\.includes\(tool\.id\)\)\s*\{[\s\S]{0,120}?TOOL_NOT_GRANTED/,
      "resolveCapability must refuse a tool the agent does not hold.",
    );
  });

  void test("the agent risk cap is actually enforced", () => {
    /*
     * Second independent bound: even a granted tool must not exceed the
     * agent's maxRisk. Deleting this check would let a medium-capped
     * agent perform high-risk, irreversible actions.
     */
    assert.match(
      code,
      /if \(RISK_RANK\[tool\.risk\] > RISK_RANK\[agent\.maxRisk\]\)\s*\{[\s\S]{0,120}?RISK_EXCEEDS_AGENT/,
      "resolveCapability must refuse a tool riskier than the agent's cap.",
    );
  });

  void test("the plan gate is actually enforced", () => {
    assert.match(
      code,
      /if \(PLAN_RANK\[input\.plan\] < PLAN_RANK\[requiredPlan\]\)\s*\{[\s\S]{0,120}?PLAN_NOT_PERMITTED/,
    );
  });

  void test("the required plan is the HIGHER of agent and tool", () => {
    /*
     * Taking the lower would let a free-tier caller reach a pro agent by
     * choosing one of its free-tier tools.
     */
    assert.match(
      code,
      /PLAN_RANK\[tool\.minimumPlan\] >= PLAN_RANK\[agent\.minimumPlan\]\s*\n?\s*\?\s*tool\.minimumPlan\s*\n?\s*:\s*agent\.minimumPlan/,
    );
  });

  void test("no tool grants open-ended execution", () => {
    /*
     * A tool taking a free-form URL, query or command is a tool that can
     * be pointed anywhere. None may exist.
     */
    for (const forbidden of [
      "shell",
      "exec",
      "eval",
      "http.fetch",
      "sql",
      "db.query",
    ]) {
      assert.doesNotMatch(
        code,
        new RegExp(`id: "${forbidden}`),
        `A "${forbidden}" tool would be arbitrary code or network access.`,
      );
    }
  });
});

void describe("lib/orchestration/planValidation.ts invariants", () => {
  const source = read("lib", "orchestration", "planValidation.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("unknown fields are refused", () => {
    assert.match(
      code,
      /if \(!\(key in tool\.schema\)\)\s*\{[\s\S]{0,120}?UNKNOWN_FIELD/,
    );
  });

  void test("the step count is capped", () => {
    assert.match(
      code,
      /input\.steps\.length > EXECUTION_LIMITS\.maxSteps[\s\S]{0,120}?TOO_MANY_STEPS/,
      "Unbounded task generation must be refused.",
    );
  });

  void test("capability is resolved per step", () => {
    assert.match(
      code,
      /resolveCapability\(\{[\s\S]{0,200}?agentId: input\.agentId/,
      "Every step must be authorized, not just the first.",
    );
  });

  void test("one invalid step refuses the whole plan", () => {
    assert.match(
      code,
      /if \(!capability\.allowed\)\s*\{\s*\n\s*return \{/,
      "Partial execution of a plan whose later steps are invalid leaves " +
        "the workspace in a state nobody asked for.",
    );
  });
});

void describe("lib/orchestration/execution.ts invariants", () => {
  const source = read("lib", "orchestration", "execution.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("a missing approval denies", () => {
    assert.match(
      code,
      /record === null \|\| record\.state !== "approved"[\s\S]{0,140}?NOT_APPROVED/,
    );
  });

  void test("the approver must be the acting user", () => {
    assert.match(code, /record\.requestedForUserId !== attempt\.actingUserId/);
    assert.match(code, /record\.decidedByUserId !== attempt\.actingUserId/);
  });

  void test("approvals expire", () => {
    assert.match(code, /now >= record\.expiresAt[\s\S]{0,80}?EXPIRED/);
    assert.match(source, /APPROVAL_TTL_MS/);
  });

  void test("the idempotency key is bound to the verified user", () => {
    assert.match(
      code,
      /const material = \[\s*\n?\s*input\.userId,/,
      "The user id must be first in the key material so a crafted goal " +
        "cannot collide with another tenant's key.",
    );
  });

  void test("terminal states cannot transition", () => {
    assert.match(code, /completed: \[\]/);
    assert.match(code, /failed: \[\]/);
    assert.match(code, /cancelled: \[\]/);
  });
});

/* -------------------------------------------------------------------------- */
/*                   /api/action RISK IS SERVER-SIDE                          */
/* -------------------------------------------------------------------------- */

void describe("/api/action classifies risk server-side", () => {
  const code = stripComments(read("app", "api", "action", "route.ts"));

  void test("risk comes from the tool registry", () => {
    assert.match(
      code,
      /getTool\(action\.type\)/,
      "Risk must be looked up server-side, not read from the request.",
    );
  });

  void test("an unknown action type is NOT treated as safe", () => {
    assert.match(
      code,
      /if \(tool === null\)\s*\{\s*\n\s*return false;/,
      "Treating an unrecognised action as harmless is how an " +
        "unregistered privileged operation slips through.",
    );
  });

  void test("a client cannot LOWER the confirmation requirement", () => {
    /*
     * The client flag may still raise caution, but the server check runs
     * first and returns true independently.
     */
    assert.match(
      code,
      /requiresHumanApproval\(tool\.risk\)\s*\)\s*\{\s*\n\s*return true;/,
      "The server's high-risk determination must short-circuit before " +
        "the client flag is consulted.",
    );
  });

  void test("high-risk actions are never auto-safe", () => {
    assert.match(
      code,
      /if \(requiresHumanApproval\(tool\.risk\)\)\s*\{\s*\n\s*return false;/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        PHASE 1-8 REGRESSION                                */
/* -------------------------------------------------------------------------- */

void describe("Phase 1-8 guarantees still hold", () => {
  void test("orchestration modules never use the service-role client", () => {
    for (const file of ["registry.ts", "planValidation.ts", "execution.ts"]) {
      const code = stripComments(read("lib", "orchestration", file));

      assert.doesNotMatch(
        code,
        /supabaseAdmin/,
        `lib/orchestration/${file} must not bypass RLS.`,
      );
    }
  });

  void test("orchestration never takes identity from a request", () => {
    for (const file of ["registry.ts", "planValidation.ts", "execution.ts"]) {
      const code = stripComments(read("lib", "orchestration", file));

      assert.doesNotMatch(
        code,
        /body\.(userId|workspaceId|ownerId|tenantId)/,
        `lib/orchestration/${file} must derive identity from the session.`,
      );
    }
  });

  void test("the action route still enforces auth and usage", () => {
    const code = stripComments(read("app", "api", "action", "route.ts"));

    assert.match(code, /withAuth\(/);
    assert.match(code, /enforceUsage\(/);
  });
});
