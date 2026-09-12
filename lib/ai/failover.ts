import "server-only";

import type { PlanId } from "@/lib/plans";

import {
  APPROVED_MODELS,
  providerApiKey,
  selectModel,
  type ModelCapability,
  type ModelDefinition,
} from "./registry";

import {
  chatCompletion,
  type AiError,
  type AiErrorKind,
  type ChatCompletionResult,
  type ChatMessage,
} from "./provider";

/*
  SYRAVEN — provider failover

  WHAT THIS IS FOR

  Two providers serve chat models here: OpenAI and Groq. When one is
  rate-limited, timing out, erroring, or simply not configured in this
  deployment, a request that could have been answered by the other was
  failing instead.

  WHAT IT IS NOT

  It is not a retry. lib/ai/provider.ts already retries ONCE inside a
  single provider, bounded deliberately because a completion that
  reached the model may be billed even when the response never arrived.
  This sits strictly above that: by the time a candidate fails here, it
  has already had its retry.

  WHEN IT DOES NOT FAIL OVER

  Only the provider's own failures are worth a second opinion:

    RATE_LIMITED    the provider is busy; another may not be
    TIMEOUT         this provider did not answer in time
    PROVIDER_ERROR  a 5xx or a transport failure
    AUTHENTICATION  OUR credentials for this provider are bad
    NOT_CONFIGURED  no key for this provider in this deployment

  INVALID_REQUEST and EMPTY_RESPONSE are NOT retried elsewhere. A
  malformed request is malformed at every provider, and trying the
  second one would spend money to receive the same refusal. An empty
  response is a model that answered with nothing, which is an answer.

  WHAT IT MUST NOT DO

  Failover cannot become a way around the plan and capability checks.
  Every candidate goes through selectModel() with the caller's real
  plan, so a free-tier caller whose primary fails cannot be handed a
  model their plan does not include. It also re-clamps maxTokens to
  each candidate's own ceiling: gpt-4o-mini allows 16k while
  llama-3.1-8b-instant allows 8k, and carrying the primary's budget
  across would send an over-limit request that fails for a new reason.

  And the result reports the model that ACTUALLY answered. modelId
  flows into usage metering, so a run billed against the primary while
  the fallback did the work would be a false record.
*/

/** Failures worth asking a different provider about. */
const FAILOVER_WORTHY: ReadonlySet<AiErrorKind> = new Set([
  "RATE_LIMITED",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "AUTHENTICATION",
  "NOT_CONFIGURED",
]);

export function isFailoverWorthy(error: AiError): boolean {
  return FAILOVER_WORTHY.has(error.kind);
}

export interface FailoverAttempt {
  readonly modelId: string;
  readonly provider: string;
  readonly errorKind: AiErrorKind;
}

export type FailoverResult =
  | (Extract<ChatCompletionResult, { ok: true }> & {
      /** Providers tried and failed before this one answered. */
      readonly attempts: readonly FailoverAttempt[];
    })
  | {
      ok: false;
      error: AiError;
      readonly attempts: readonly FailoverAttempt[];
    };

/**
 * Orders the candidates for one capability.
 *
 * The requested (or default) model first, then every other approved
 * model of the same capability on a DIFFERENT provider. Same-provider
 * alternatives are excluded on purpose: if OpenAI is rate-limiting or
 * unreachable, a second OpenAI model is the same outage.
 *
 * Deterministic, so a given request always tries providers in the same
 * order and a failure is reproducible.
 */
export function failoverCandidates(
  primary: ModelDefinition,
  capability: ModelCapability,
  plan: PlanId,
): readonly ModelDefinition[] {
  const alternatives = Object.values(APPROVED_MODELS)
    .filter(
      (model) =>
        model.capability === capability &&
        model.provider !== primary.provider &&
        model.id !== primary.id,
    )
    /*
      Re-checked against the caller's real plan. Failover is not a
      side door around the entitlement that selectModel enforces.
    */
    .filter((model) => selectModel(model.id, capability, plan).ok)
    .sort((a, b) => a.id.localeCompare(b.id));

  return [primary, ...alternatives];
}

/**
 * Requests a completion, trying another provider when this one fails.
 *
 * @param plan The caller's REAL entitlement, from the database. Every
 *             candidate is re-validated against it.
 */
export async function chatCompletionWithFailover(input: {
  model: ModelDefinition;
  capability: ModelCapability;
  plan: PlanId;
  messages: readonly ChatMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<FailoverResult> {
  const candidates = failoverCandidates(
    input.model,
    input.capability,
    input.plan,
  );

  const attempts: FailoverAttempt[] = [];

  let lastError: AiError | null = null;

  for (const candidate of candidates) {
    /*
      An unconfigured provider is skipped without a network call. It
      still counts as an attempt, so the caller can see that a
      provider was considered and why it could not serve.
    */
    if (providerApiKey(candidate.provider) === null) {
      attempts.push({
        modelId: candidate.id,
        provider: candidate.provider,
        errorKind: "NOT_CONFIGURED",
      });

      lastError = {
        kind: "NOT_CONFIGURED",
        clientMessage: "The AI service is not configured.",
        status: 503,
      };

      continue;
    }

    const result = await chatCompletion({
      model: candidate,
      messages: input.messages,
      /*
        Re-clamped per candidate. Carrying the primary's ceiling to a
        model with a smaller one sends an over-limit request.
      */
      maxTokens: Math.min(input.maxTokens, candidate.maxOutputTokens),
      temperature: input.temperature,
    });

    if (result.ok) {
      /*
        modelId comes from the result, so it names whichever model
        actually answered -- not the one originally selected. Usage
        metering reads this, and billing the primary for the
        fallback's work would be a false record.
      */
      return { ...result, attempts };
    }

    attempts.push({
      modelId: candidate.id,
      provider: candidate.provider,
      errorKind: result.error.kind,
    });

    lastError = result.error;

    if (!isFailoverWorthy(result.error)) {
      /*
        A malformed request is malformed everywhere, and an empty
        response is an answer. Stop rather than spend on a second
        provider to be refused identically.
      */
      break;
    }
  }

  return {
    ok: false,
    error:
      lastError ?? {
        kind: "PROVIDER_ERROR",
        clientMessage: "The AI service could not complete this request.",
        status: 502,
      },
    attempts,
  };
}
