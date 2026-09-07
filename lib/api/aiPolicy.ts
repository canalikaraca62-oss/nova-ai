/**
 * SYRAVEN — AI request policy for routes
 * lib/api/aiPolicy.ts
 *
 * Phase 7 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY / COST BOUNDARY.
 *
 * Turns a caller's request into a provider request that is safe to bill
 * for. One call decides model, token ceiling and temperature, all
 * server-authoritative.
 *
 * WHAT IT ENFORCES
 *
 *   model       — must be in the approved registry AND permitted for the
 *                 caller's plan. An unknown name is REFUSED, never
 *                 silently replaced with a default.
 *   maxTokens   — the LOWER of the plan ceiling (Phase 5) and the
 *                 model's own ceiling.
 *   temperature — clamped to a sane range; a caller cannot pass NaN or
 *                 an out-of-range value through to the provider.
 *
 * RELATIONSHIP TO PHASE 5
 *
 * This does NOT replace usage enforcement. `enforceUsage()` still decides
 * whether the caller may act at all; this decides what the resulting
 * provider call is allowed to look like. Routes call both:
 *
 *     const guard  = await enforceUsage(session, "ai:chat", "chatMessage");
 *     if (guard.denied) return guard.response;
 *
 *     const policy = resolveAiPolicy({ ... , entitlement: guard.entitlement });
 *     if (!policy.ok) return policy.response;
 */

import "server-only";

import { NextResponse } from "next/server";

import {
  type Entitlement,
  clampMaxTokens,
} from "@/lib/usage/entitlements";
import {
  type ModelCapability,
  type ModelDefinition,
  selectModel,
} from "@/lib/ai/registry";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface ResolvedAiPolicy {
  readonly model: ModelDefinition;
  readonly maxTokens: number;
  readonly temperature: number;
}

export type AiPolicyOutcome =
  | { ok: true; policy: ResolvedAiPolicy }
  | { ok: false; response: NextResponse };

/* -------------------------------------------------------------------------- */
/*                              TEMPERATURE                                   */
/* -------------------------------------------------------------------------- */

const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;

/**
 * Clamps a requested temperature.
 *
 * Temperature is not a billing lever, so a caller may set it — but a
 * non-finite or out-of-range value must never reach the provider, where
 * it would produce an opaque 400.
 */
export function clampTemperature(
  requested: unknown,
  fallback: number,
): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return fallback;
  }

  return Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, requested));
}

/* -------------------------------------------------------------------------- */
/*                             DENIAL RESPONSES                               */
/* -------------------------------------------------------------------------- */

function denial(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                              POLICY RESOLUTION                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the server-authoritative parameters for one AI call.
 *
 * @param requestedModel  Caller-supplied model name, or null. Validated
 *                        against the approved registry; never trusted.
 * @param requestedTokens Caller-supplied token budget, or null. Clamped
 *                        by plan AND by the model's own ceiling.
 * @param entitlement     From enforceUsage(), resolved from the database.
 */
export function resolveAiPolicy(input: {
  capability: ModelCapability;
  entitlement: Entitlement;
  requestedModel?: unknown;
  requestedTokens?: unknown;
  requestedTemperature?: unknown;
  defaultTemperature?: number;
}): AiPolicyOutcome {
  const selection = selectModel(
    input.requestedModel,
    input.capability,
    input.entitlement.effectivePlan,
  );

  if (!selection.ok) {
    switch (selection.reason) {
      case "UNKNOWN_MODEL":
        return {
          ok: false,
          response: denial(
            400,
            "UNKNOWN_MODEL",
            "The requested model is not available.",
          ),
        };

      case "WRONG_CAPABILITY":
        return {
          ok: false,
          response: denial(
            400,
            "UNSUPPORTED_MODEL",
            "The requested model cannot be used for this operation.",
          ),
        };

      case "PLAN_NOT_PERMITTED":
        /*
         * 403, not 400: the request is well-formed, the caller's plan
         * simply does not include this model.
         */
        return {
          ok: false,
          response: denial(
            403,
            "MODEL_NOT_IN_PLAN",
            "Your plan does not include the requested model.",
          ),
        };

      case "MISCONFIGURED_DEFAULT":
        /*
         * A server-side registry error. Fail closed rather than pick an
         * arbitrary model and bill for it.
         */
        return {
          ok: false,
          response: denial(
            503,
            "AI_MISCONFIGURED",
            "The AI service is not correctly configured.",
          ),
        };
    }
  }

  const model = selection.model;

  /*
   * The effective ceiling is the LOWER of what the plan permits and what
   * the model supports. Taking either alone would let one bound be
   * escaped by changing the other.
   */
  const planCeiling = clampMaxTokens(
    input.entitlement,
    input.requestedTokens,
  );

  const maxTokens = Math.min(planCeiling, model.maxOutputTokens);

  return {
    ok: true,
    policy: {
      model,
      maxTokens,
      temperature: clampTemperature(
        input.requestedTemperature,
        input.defaultTemperature ?? 0.7,
      ),
    },
  };
}
