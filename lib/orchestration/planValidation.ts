/**
 * SYRAVEN — Plan and tool-argument validation
 * lib/orchestration/planValidation.ts
 *
 * Phase 9 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Turns a model-generated plan into a set of steps the server has agreed
 * to run — or refuses it.
 *
 * THE PRINCIPLE
 *
 *     The model proposes. The server authorizes.
 *
 * A plan is UNTRUSTED INPUT that happens to have been produced by our
 * own model. It gets the same scrutiny as a request body: unknown tools
 * refused, unknown fields refused, ids shape-checked, strings bounded,
 * step count capped.
 *
 * WHY UNKNOWN FIELDS ARE REFUSED RATHER THAN IGNORED
 *
 * Ignoring an unexpected key means a model (or an injected instruction
 * inside a retrieved document) can add arguments that a future version
 * of a tool might start honouring. Refusing keeps the contract closed.
 */

import "server-only";

import { isUuid } from "@/lib/auth/authorization";
import {
  type OrchestrationAgent,
  type RiskLevel,
  type ToolDefinition,
  resolveCapability,
  requiresHumanApproval,
} from "./registry";
import type { PlanId } from "@/lib/plans";

/* -------------------------------------------------------------------------- */
/*                              EXECUTION LIMITS                              */
/* -------------------------------------------------------------------------- */

/**
 * Absolute ceilings, independent of any agent's own limits.
 *
 * The effective limit is the LOWER of these and the agent's, so a
 * mistake in one registry entry cannot lift the global bound.
 */
export const EXECUTION_LIMITS = {
  /** Steps in a single plan. */
  maxSteps: 10,

  /** Planning/decomposition depth. Prevents recursive agent explosion. */
  maxDepth: 3,

  /** Tool invocations across one execution. */
  maxToolCalls: 10,

  /** Retries for a single failing step. */
  maxRetriesPerStep: 1,

  /** Wall-clock ceiling for one execution. */
  maxExecutionMs: 120_000,

  /** Characters accepted in a single tool string argument. */
  maxArgumentChars: 20_000,
} as const;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface ValidatedStep {
  readonly index: number;
  readonly tool: ToolDefinition;
  readonly args: Readonly<Record<string, string | number | boolean>>;
  readonly risk: RiskLevel;
  readonly needsApproval: boolean;
}

export interface ValidatedPlan {
  readonly agent: OrchestrationAgent;
  readonly steps: readonly ValidatedStep[];
  /** True when ANY step requires human approval. */
  readonly needsApproval: boolean;
  readonly highestRisk: RiskLevel;
}

export type PlanValidation =
  | { ok: true; plan: ValidatedPlan }
  | {
      ok: false;
      reason: string;
      /** Step index that failed, when applicable. */
      stepIndex?: number;
    };

/* -------------------------------------------------------------------------- */
/*                           ARGUMENT VALIDATION                              */
/* -------------------------------------------------------------------------- */

export type ArgumentValidation =
  | { ok: true; args: Record<string, string | number | boolean> }
  | { ok: false; reason: string };

/**
 * Validates model-generated arguments against a tool's schema.
 *
 * Rejects, rather than coerces:
 *   - unknown fields
 *   - missing required fields
 *   - wrong types
 *   - malformed uuids
 *   - oversized strings
 *
 * Coercion would be the dangerous choice here: silently turning `"true"`
 * into `true`, or a malformed id into a lookup, hides a model error at
 * exactly the point where precision matters.
 */
export function validateToolArguments(
  tool: ToolDefinition,
  rawArgs: unknown,
): ArgumentValidation {
  if (
    rawArgs === null ||
    typeof rawArgs !== "object" ||
    Array.isArray(rawArgs)
  ) {
    return { ok: false, reason: "ARGS_NOT_OBJECT" };
  }

  const provided = rawArgs as Record<string, unknown>;

  /* Unknown fields are refused, never ignored. */
  for (const key of Object.keys(provided)) {
    if (!(key in tool.schema)) {
      return { ok: false, reason: `UNKNOWN_FIELD:${key}` };
    }
  }

  const validated: Record<string, string | number | boolean> = {};

  for (const [name, field] of Object.entries(tool.schema)) {
    const value = provided[name];

    if (value === undefined || value === null) {
      if (field.required) {
        return { ok: false, reason: `MISSING_FIELD:${name}` };
      }
      continue;
    }

    switch (field.type) {
      case "uuid": {
        if (!isUuid(value)) {
          return { ok: false, reason: `INVALID_UUID:${name}` };
        }
        validated[name] = value;
        break;
      }

      case "string": {
        if (typeof value !== "string") {
          return { ok: false, reason: `INVALID_TYPE:${name}` };
        }

        const max = Math.min(
          field.maxLength ?? EXECUTION_LIMITS.maxArgumentChars,
          EXECUTION_LIMITS.maxArgumentChars,
        );

        if (value.length > max) {
          /*
           * Refused rather than truncated: silently shortening a
           * deletion target or a message body changes what the user
           * approved.
           */
          return { ok: false, reason: `TOO_LONG:${name}` };
        }

        validated[name] = value;
        break;
      }

      case "number": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return { ok: false, reason: `INVALID_TYPE:${name}` };
        }
        validated[name] = value;
        break;
      }

      case "boolean": {
        if (typeof value !== "boolean") {
          return { ok: false, reason: `INVALID_TYPE:${name}` };
        }
        validated[name] = value;
        break;
      }
    }
  }

  return { ok: true, args: validated };
}

/* -------------------------------------------------------------------------- */
/*                             PLAN VALIDATION                                */
/* -------------------------------------------------------------------------- */

interface ProposedStep {
  tool?: unknown;
  args?: unknown;
}

/**
 * Validates a whole proposed plan.
 *
 * Every step must resolve to a tool the AGENT holds, within the agent's
 * risk cap, permitted for the caller's PLAN, with schema-valid
 * arguments. One bad step refuses the entire plan — partially executing
 * a plan whose later steps are invalid leaves the workspace in a state
 * nobody asked for.
 */
export function validatePlan(input: {
  agentId: unknown;
  steps: unknown;
  plan: PlanId;
}): PlanValidation {
  if (!Array.isArray(input.steps)) {
    return { ok: false, reason: "STEPS_NOT_ARRAY" };
  }

  if (input.steps.length === 0) {
    return { ok: false, reason: "EMPTY_PLAN" };
  }

  if (input.steps.length > EXECUTION_LIMITS.maxSteps) {
    /*
     * Bounds unbounded task generation — a model asked to "do
     * everything" must not be able to emit a thousand steps.
     */
    return { ok: false, reason: "TOO_MANY_STEPS" };
  }

  const validated: ValidatedStep[] = [];

  let agent: OrchestrationAgent | null = null;
  let highest: RiskLevel = "low";
  let needsApproval = false;

  for (let index = 0; index < input.steps.length; index += 1) {
    const step = input.steps[index] as ProposedStep;

    if (step === null || typeof step !== "object") {
      return { ok: false, reason: "STEP_NOT_OBJECT", stepIndex: index };
    }

    const capability = resolveCapability({
      agentId: input.agentId,
      toolId: step.tool,
      plan: input.plan,
    });

    if (!capability.allowed) {
      return {
        ok: false,
        reason: capability.reason,
        stepIndex: index,
      };
    }

    agent = capability.agent;

    /* The agent's own tool-call cap, bounded by the global ceiling. */
    const toolCallCap = Math.min(
      capability.agent.maxToolCalls,
      EXECUTION_LIMITS.maxToolCalls,
    );

    if (validated.length >= toolCallCap) {
      return { ok: false, reason: "TOOL_CALL_LIMIT", stepIndex: index };
    }

    const args = validateToolArguments(capability.tool, step.args);

    if (!args.ok) {
      return { ok: false, reason: args.reason, stepIndex: index };
    }

    const risk = capability.tool.risk;

    if (rank(risk) > rank(highest)) highest = risk;

    const stepNeedsApproval = requiresHumanApproval(risk);

    if (stepNeedsApproval) needsApproval = true;

    validated.push({
      index,
      tool: capability.tool,
      args: args.args,
      risk,
      needsApproval: stepNeedsApproval,
    });
  }

  if (agent === null) {
    return { ok: false, reason: "UNKNOWN_AGENT" };
  }

  return {
    ok: true,
    plan: {
      agent,
      steps: validated,
      needsApproval,
      highestRisk: highest,
    },
  };
}

function rank(risk: RiskLevel): number {
  return risk === "high" ? 2 : risk === "medium" ? 1 : 0;
}
