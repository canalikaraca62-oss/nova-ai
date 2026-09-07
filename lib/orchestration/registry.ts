/**
 * SYRAVEN — Agent and tool registry
 * lib/orchestration/registry.ts
 *
 * Phase 9 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * The server-side definition of which agents exist, which tools they may
 * call, and what each tool is permitted to do.
 *
 * WHY THIS EXISTS
 *
 * ARCHITECTURE_AUDIT.md §14: `/api/agents/execute` is a single stateless
 * LLM call. It has no tools, no planning, no permission model, and it
 * never consults `lib/agents/registry.ts` — the agent definitions that
 * do exist are decorative.
 *
 * Worse, `/api/action` decided whether an action needed confirmation
 * from a CLIENT-SUPPLIED field:
 *
 *     confirmableAction.requiresConfirmation === true
 *
 * A caller omitting that field had every action classified as safe. Risk
 * was, in effect, self-declared.
 *
 * THE RULE
 *
 *     The model proposes. The server authorizes.
 *
 * An agent may only call tools listed in ITS OWN definition here. A tool
 * not in this file does not exist. Risk level is a property of the tool
 * as registered, never of the request.
 */

import "server-only";

import type { PlanId } from "@/lib/plans";

/* -------------------------------------------------------------------------- */
/*                                RISK LEVELS                                 */
/* -------------------------------------------------------------------------- */

/**
 * What an action can do if it goes wrong.
 *
 *   low    — reads and drafts. Reversible by ignoring the output.
 *   medium — changes workspace state. Reversible by the user.
 *   high   — leaves the system, spends money, or destroys data.
 *            NOT reversible by the user afterwards.
 */
export const RISK_LEVELS = ["low", "medium", "high"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Risk levels that ALWAYS require explicit human approval.
 *
 * High-risk actions are irreversible from the user's perspective —
 * an email cannot be unsent, a payment cannot be un-charged, a deleted
 * record may be gone. Autonomy is not granted here by default.
 */
export function requiresHumanApproval(risk: RiskLevel): boolean {
  return RISK_RANK[risk] >= RISK_RANK.high;
}

/* -------------------------------------------------------------------------- */
/*                                   TOOLS                                    */
/* -------------------------------------------------------------------------- */

/**
 * A field a tool accepts.
 *
 * Deliberately a small vocabulary. Model-generated JSON is validated
 * against this before any privileged operation sees it — passing raw
 * model output into a query or a fetch is the failure mode this
 * prevents.
 */
export interface ToolField {
  readonly type: "string" | "number" | "boolean" | "uuid";
  readonly required: boolean;
  readonly maxLength?: number;
}

export interface ToolDefinition {
  readonly id: string;

  readonly description: string;

  readonly risk: RiskLevel;

  /**
   * Accepted input fields. Any field NOT listed here is rejected —
   * unknown keys are refused rather than ignored, so a model cannot
   * smuggle an extra argument past validation.
   */
  readonly schema: Readonly<Record<string, ToolField>>;

  /**
   * Whether the tool operates on a tenant-scoped resource. When true,
   * the executor must prove workspace/project access before running it.
   */
  readonly tenantScoped: boolean;

  /** Lowest plan permitted to use this tool. */
  readonly minimumPlan: PlanId;
}

/**
 * Every tool an agent may call.
 *
 * Adding an entry grants real capability. Each is deliberately narrow:
 * there is no "run SQL", no "fetch URL", no "execute code". A tool that
 * takes a free-form target is a tool that can be pointed anywhere.
 */
export const TOOL_REGISTRY: Readonly<Record<string, ToolDefinition>> = {
  /* ---------------------------------------------------------------- */
  /* LOW — read-only, reversible by ignoring the result                */
  /* ---------------------------------------------------------------- */

  "knowledge.search": {
    id: "knowledge.search",
    description:
      "Search the caller's authorized knowledge for relevant material.",
    risk: "low",
    schema: {
      query: { type: "string", required: true, maxLength: 500 },
    },
    tenantScoped: true,
    minimumPlan: "free",
  },

  "task.list": {
    id: "task.list",
    description: "List tasks the caller owns.",
    risk: "low",
    schema: {
      projectId: { type: "uuid", required: false },
    },
    tenantScoped: true,
    minimumPlan: "free",
  },

  /* ---------------------------------------------------------------- */
  /* MEDIUM — changes workspace state, reversible by the user          */
  /* ---------------------------------------------------------------- */

  "task.create": {
    id: "task.create",
    description: "Create a task in a project the caller can reach.",
    risk: "medium",
    schema: {
      title: { type: "string", required: true, maxLength: 500 },
      description: { type: "string", required: false, maxLength: 5_000 },
      projectId: { type: "uuid", required: false },
    },
    tenantScoped: true,
    minimumPlan: "free",
  },

  "knowledge.create": {
    id: "knowledge.create",
    description: "Store a note in the caller's knowledge base.",
    risk: "medium",
    schema: {
      title: { type: "string", required: true, maxLength: 500 },
      content: { type: "string", required: true, maxLength: 20_000 },
      projectId: { type: "uuid", required: false },
    },
    tenantScoped: true,
    minimumPlan: "free",
  },

  /* ---------------------------------------------------------------- */
  /* HIGH — irreversible. Always requires human approval.              */
  /* ---------------------------------------------------------------- */

  "task.delete": {
    id: "task.delete",
    description: "Permanently delete a task.",
    risk: "high",
    schema: {
      taskId: { type: "uuid", required: true },
    },
    tenantScoped: true,
    minimumPlan: "free",
  },

  "knowledge.delete": {
    id: "knowledge.delete",
    description: "Permanently delete a knowledge record.",
    risk: "high",
    schema: {
      knowledgeId: { type: "uuid", required: true },
    },
    tenantScoped: true,
    minimumPlan: "free",
  },
};

export function getTool(id: unknown): ToolDefinition | null {
  if (typeof id !== "string") return null;
  return TOOL_REGISTRY[id.trim()] ?? null;
}

/* -------------------------------------------------------------------------- */
/*                                  AGENTS                                    */
/* -------------------------------------------------------------------------- */

export interface OrchestrationAgent {
  readonly id: string;

  readonly name: string;

  readonly purpose: string;

  /**
   * Tools this agent may call. An agent cannot call a tool absent from
   * this list even if the tool exists in TOOL_REGISTRY — capability is
   * granted per agent, not globally.
   */
  readonly allowedTools: readonly string[];

  readonly minimumPlan: PlanId;

  /**
   * Highest risk this agent may propose. An agent capped at "medium"
   * cannot request a high-risk tool even with approval — the cap is a
   * second, independent bound on blast radius.
   */
  readonly maxRisk: RiskLevel;

  /** Hard ceiling on tool calls in one execution. */
  readonly maxToolCalls: number;

  /** Hard ceiling on planning/decomposition depth. */
  readonly maxDepth: number;
}

/**
 * Agents available for orchestration.
 *
 * Intentionally few. `lib/agents/` holds 13 persona definitions with no
 * execution semantics; registering all of them here would grant
 * capability to definitions that were never designed with a permission
 * model. These three are declared with explicit limits instead.
 */
export const AGENT_REGISTRY: Readonly<
  Record<string, OrchestrationAgent>
> = {
  researcher: {
    id: "researcher",
    name: "Research Agent",
    purpose:
      "Finds and summarises information from authorized knowledge.",
    allowedTools: ["knowledge.search", "task.list"],
    minimumPlan: "free",
    /* Read-only by construction: it holds no write tool at all. */
    maxRisk: "low",
    maxToolCalls: 5,
    maxDepth: 2,
  },

  organizer: {
    id: "organizer",
    name: "Work Organizer",
    purpose: "Creates and organises tasks and notes.",
    allowedTools: [
      "knowledge.search",
      "task.list",
      "task.create",
      "knowledge.create",
    ],
    minimumPlan: "free",
    /*
     * Capped at medium: it can create, but cannot delete. Destructive
     * cleanup is deliberately not granted to an automated organiser.
     */
    maxRisk: "medium",
    maxToolCalls: 8,
    maxDepth: 2,
  },

  curator: {
    id: "curator",
    name: "Knowledge Curator",
    purpose:
      "Maintains the knowledge base, including removing stale records.",
    allowedTools: [
      "knowledge.search",
      "knowledge.create",
      "knowledge.delete",
    ],
    minimumPlan: "pro",
    /*
     * The only agent permitted high risk, and every high-risk call it
     * makes still requires explicit human approval.
     */
    maxRisk: "high",
    maxToolCalls: 6,
    maxDepth: 2,
  },
};

export function getAgent(id: unknown): OrchestrationAgent | null {
  if (typeof id !== "string") return null;
  return AGENT_REGISTRY[id.trim()] ?? null;
}

/* -------------------------------------------------------------------------- */
/*                           CAPABILITY RESOLUTION                            */
/* -------------------------------------------------------------------------- */

export type CapabilityDecision =
  | { allowed: true; tool: ToolDefinition; agent: OrchestrationAgent }
  | {
      allowed: false;
      reason:
        | "UNKNOWN_AGENT"
        | "UNKNOWN_TOOL"
        | "TOOL_NOT_GRANTED"
        | "RISK_EXCEEDS_AGENT"
        | "PLAN_NOT_PERMITTED";
    };

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

/**
 * Decides whether an agent may call a tool for this caller.
 *
 * Every check is a separate refusal reason so a denial is diagnosable
 * without leaking which agents or tools exist.
 */
export function resolveCapability(input: {
  agentId: unknown;
  toolId: unknown;
  plan: PlanId;
}): CapabilityDecision {
  const agent = getAgent(input.agentId);

  if (!agent) {
    /* Unknown agents fail closed — never a default agent. */
    return { allowed: false, reason: "UNKNOWN_AGENT" };
  }

  const tool = getTool(input.toolId);

  if (!tool) {
    /*
     * A model that hallucinates a tool name gets nothing. This is the
     * control that stops "invent an arbitrary tool" from working.
     */
    return { allowed: false, reason: "UNKNOWN_TOOL" };
  }

  if (!agent.allowedTools.includes(tool.id)) {
    return { allowed: false, reason: "TOOL_NOT_GRANTED" };
  }

  if (RISK_RANK[tool.risk] > RISK_RANK[agent.maxRisk]) {
    return { allowed: false, reason: "RISK_EXCEEDS_AGENT" };
  }

  const requiredPlan =
    PLAN_RANK[tool.minimumPlan] >= PLAN_RANK[agent.minimumPlan]
      ? tool.minimumPlan
      : agent.minimumPlan;

  if (PLAN_RANK[input.plan] < PLAN_RANK[requiredPlan]) {
    return { allowed: false, reason: "PLAN_NOT_PERMITTED" };
  }

  return { allowed: true, tool, agent };
}
