import "server-only";

import type { PlanId } from "@/lib/plans";

import {
  APPROVED_MODELS,
  providerApiKey,
  selectModel,
  type ModelCapability,
  type ModelDefinition,
  type ModelTier,
} from "./registry";

/*
  SYRAVEN — model routing

  WHAT THIS DECIDES

  Which model to PROPOSE for a piece of work. Nothing more.

  WHAT IT DELIBERATELY DOES NOT DECIDE

  Whether the caller may have it. selectModel() remains the single
  authority on entitlement, capability and existence, exactly as the
  registry header states: a model is usable only if it appears in
  APPROVED_MODELS, and an unrecognised name is refused rather than
  substituted. Routing sits ABOVE that boundary and every recommendation
  it makes is passed back through selectModel before it can be used.

  Putting the choice here rather than inside selectModel is the whole
  point. A router that could also authorise would be a second path to a
  model a plan excludes, and the failover suite already proves how
  easily a second path becomes a side door.

  THE DIMENSIONS, AND WHICH ONES ARE REAL

    capability   real. From the registry; a transcription model cannot
                 serve a chat request.

    context      real. contextWindow is a published model specification.
                 A long conversation can exceed it while asking for a
                 short answer, which no token clamp would catch.

    complexity   real, but a judgement. Expressed as a tier preference,
                 deliberately coarse (fast / balanced / powerful).

    cost         PARTIAL. There is no per-token price table in this
                 deployment, and lib/billing/config.ts prices SYRAVEN's
                 own credits, not provider spend. Cost is therefore
                 approximated by tier: a "fast" model is cheaper than a
                 "powerful" one. That ordering is true; a currency
                 figure would be invented.

    latency      PARTIAL, same reasoning. Tier stands in for speed. No
                 request duration is recorded anywhere in this codebase.

    reliability  NOT AVAILABLE. `usage` records model and tokens but
                 neither duration nor failure kind, so there is nothing
                 to compute a success rate from. Routing does not claim
                 a reliability score. What it CAN do is refuse to
                 recommend a provider this deployment has no key for --
                 which is a fact, not an estimate.

  The last point is the important one. GROQ_API_KEY is not configured
  here, so every Groq model is unreachable today. Recommending one would
  produce a confident suggestion for a call that cannot be made.
*/

/** How much thinking the work needs. */
export type TaskComplexity = "simple" | "standard" | "complex";

/** What the caller would rather have when models are otherwise equal. */
export type RoutingPreference = "speed" | "quality" | "balanced";

export interface RoutingRequest {
  readonly capability: ModelCapability;
  readonly plan: PlanId;
  readonly complexity?: TaskComplexity;
  readonly preference?: RoutingPreference;
  /** Approximate prompt size in tokens, when the caller can estimate it. */
  readonly estimatedPromptTokens?: number;
  /** Completion budget the caller intends to request. */
  readonly maxTokens?: number;
}

export interface RoutingDecision {
  readonly model: ModelDefinition;
  /** Why this model, in terms a log reader can check. */
  readonly reason: string;
  /** Every candidate considered, best first, with why each was ranked. */
  readonly considered: readonly RoutingCandidate[];
}

export interface RoutingCandidate {
  readonly modelId: string;
  readonly provider: string;
  readonly tier: ModelTier;
  readonly score: number;
  /** Set when the model was excluded outright. */
  readonly rejected?: string;
}

/** Tier ordering, cheapest and quickest first. */
const TIER_RANK: Record<ModelTier, number> = {
  fast: 0,
  balanced: 1,
  powerful: 2,
};

/** The tier each complexity level wants. */
const COMPLEXITY_TARGET: Record<TaskComplexity, ModelTier> = {
  simple: "fast",
  standard: "balanced",
  complex: "powerful",
};

/**
 * Shifts the target tier by preference.
 *
 * "speed" steps down, "quality" steps up, and both clamp at the ends.
 * Preference adjusts the complexity judgement rather than overriding it,
 * so asking for speed on complex work lands on balanced, not fast.
 */
function targetTier(
  complexity: TaskComplexity,
  preference: RoutingPreference,
): ModelTier {
  const base = TIER_RANK[COMPLEXITY_TARGET[complexity]];

  const shifted =
    preference === "speed"
      ? base - 1
      : preference === "quality"
        ? base + 1
        : base;

  const clamped = Math.max(0, Math.min(2, shifted));

  return (["fast", "balanced", "powerful"] as const)[clamped] ?? "balanced";
}

/**
 * Total context the request needs: prompt plus intended completion.
 *
 * A model whose window cannot hold both is excluded outright rather than
 * ranked low. Sending it would fail at the provider for a reason the
 * caller cannot act on.
 */
function requiredContext(request: RoutingRequest): number {
  return (request.estimatedPromptTokens ?? 0) + (request.maxTokens ?? 0);
}

/**
 * Ranks the approved models for one request.
 *
 * Every candidate is re-validated with selectModel, so a model the
 * caller's plan excludes can never be recommended -- the same rule
 * failover follows, for the same reason.
 */
export function routeCandidates(
  request: RoutingRequest,
): readonly RoutingCandidate[] {
  const wanted = targetTier(
    request.complexity ?? "standard",
    request.preference ?? "balanced",
  );

  const needed = requiredContext(request);

  const candidates: RoutingCandidate[] = [];

  for (const model of Object.values(APPROVED_MODELS)) {
    if (model.capability !== request.capability) continue;

    const base: Omit<RoutingCandidate, "score" | "rejected"> = {
      modelId: model.id,
      provider: model.provider,
      tier: model.tier,
    };

    /* Entitlement, capability and existence -- the one authority. */
    if (!selectModel(model.id, request.capability, request.plan).ok) {
      candidates.push({ ...base, score: -1, rejected: "PLAN_NOT_PERMITTED" });
      continue;
    }

    /*
      A provider with no key in this deployment cannot serve, so it is
      not a candidate. This is why Groq models are absent here today.
    */
    if (providerApiKey(model.provider) === null) {
      candidates.push({ ...base, score: -1, rejected: "NOT_CONFIGURED" });
      continue;
    }

    if (needed > 0 && model.contextWindow > 0 && needed > model.contextWindow) {
      candidates.push({ ...base, score: -1, rejected: "CONTEXT_TOO_SMALL" });
      continue;
    }

    /*
      Distance from the wanted tier, inverted so nearer scores higher.
      Ties break toward the cheaper tier: given equal distance, the
      smaller model is the better default.
    */
    const distance = Math.abs(TIER_RANK[model.tier] - TIER_RANK[wanted]);

    const score = 100 - distance * 10 - TIER_RANK[model.tier];

    candidates.push({ ...base, score });
  }

  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.modelId.localeCompare(b.modelId);
  });
}

/**
 * Recommends a model, or explains why none fits.
 *
 * The returned model is guaranteed to have passed selectModel for this
 * caller. Callers still pass it back through the policy layer -- this
 * function does not authorise anything, it proposes.
 */
export function recommendModel(
  request: RoutingRequest,
): RoutingDecision | null {
  const considered = routeCandidates(request);

  const best = considered.find((candidate) => candidate.score >= 0);

  if (!best) return null;

  const selection = selectModel(
    best.modelId,
    request.capability,
    request.plan,
  );

  /*
    Defensive, and not redundant. routeCandidates already filtered on
    selectModel; re-resolving here means the ModelDefinition handed to
    the caller comes from the authority rather than from this module's
    own copy, so the two can never drift.
  */
  if (!selection.ok) return null;

  const wanted = targetTier(
    request.complexity ?? "standard",
    request.preference ?? "balanced",
  );

  return {
    model: selection.model,
    reason:
      `${best.modelId} (${best.tier}) for ${request.complexity ?? "standard"} ` +
      `work wanting ${wanted}; ${considered.length} candidate(s) considered`,
    considered,
  };
}
