/**
 * SYRAVEN — OpenAI embedding client
 * lib/search/openaiEmbedding.ts
 *
 * Phase 10 Step 10.4 (gated portion — see IMPLEMENTATION_PLAN.md).
 *
 * COST BOUNDARY. This is the only module in the repository that can
 * make a paid embedding call.
 *
 * APPROVED CONFIGURATION
 *
 * The provider and model here were explicitly approved for
 * implementation:
 *
 *     Provider:   OpenAI
 *     Model:      text-embedding-3-small
 *     Dimensions: 1536
 *
 * That approval covers WRITING this client. It does not authorise
 * running it against production data, and nothing in this step does.
 *
 * WHY THE MODEL IS A CONSTANT AND NOT CONFIGURATION
 *
 * `OPENAI_EMBEDDING_MODEL` exists in the environment, and reading it
 * here would be the obvious implementation. It is deliberately NOT read.
 *
 * An environment variable is a runtime input: a deploy could point it at
 * `text-embedding-3-large` and every subsequent vector would be 3072
 * wide, or — worse, because it fails silently — at another 1536-wide
 * model whose vector space is unrelated to the one already stored.
 * Vectors from two different models are not comparable, so a mixed
 * corpus degrades ranking in a way no error surfaces.
 *
 * The approved model is therefore compiled in, and the environment is
 * checked only to confirm it AGREES (`assertApprovedModelEnv`). A
 * disagreement fails closed rather than being honoured.
 *
 * WHAT THIS MODULE DOES NOT DO
 *
 * It is not constructed anywhere. No route, job or default calls
 * `createOpenAiEmbeddingClient`. It is reachable only by a caller that
 * explicitly builds it and passes it to `embedText` — which is what
 * keeps this step's cost at zero while the code is nonetheless
 * production-ready.
 */

import "server-only";

import { PROVIDER_ENDPOINTS, providerApiKey } from "@/lib/ai/registry";

import { EMBEDDING_POLICY, type EmbeddingClient } from "./embedding";
import { EMBEDDING_DIMENSIONS } from "./vector";

/* -------------------------------------------------------------------------- */
/*                            APPROVED PARAMETERS                             */
/* -------------------------------------------------------------------------- */

/**
 * The approved model id. A constant, never configuration.
 *
 * `text-embedding-3-small` is 1536-wide natively, which is exactly what
 * `ai_knowledge_chunks.embedding vector(1536)` stores — so no dimension
 * reduction is required and there is no reduction parameter to forget.
 */
export const APPROVED_EMBEDDING_MODEL = "text-embedding-3-small" as const;

/**
 * Models explicitly refused, with the reason.
 *
 * `text-embedding-3-large` is named because it was the value previously
 * sitting in `.env.local`, and is the mistake most likely to recur.
 */
export const REFUSED_EMBEDDING_MODELS: Readonly<Record<string, string>> = {
  "text-embedding-3-large":
    "Emits 3072 dimensions; the schema stores 1536. Not approved.",
  "text-embedding-ada-002":
    "Legacy model, cannot reduce dimensions. Not approved.",
};

/* -------------------------------------------------------------------------- */
/*                            ENVIRONMENT AGREEMENT                           */
/* -------------------------------------------------------------------------- */

/**
 * Confirms the environment agrees with the approved model.
 *
 * Unset is acceptable — the constant above is the authority. A value
 * that CONTRADICTS the approved model is a deployment error and fails
 * closed, because honouring it would silently change the vector space
 * of everything embedded thereafter.
 *
 * Note this returns a reason string for logging; the reason names the
 * model only, never a key or any secret.
 */
export function assertApprovedModelEnv(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; reason: string } {
  const declared = env.OPENAI_EMBEDDING_MODEL;

  if (typeof declared !== "string" || declared.trim().length === 0) {
    return { ok: true };
  }

  const model = declared.trim();

  if (model === APPROVED_EMBEDDING_MODEL) return { ok: true };

  const refusal = REFUSED_EMBEDDING_MODELS[model];

  return {
    ok: false,
    reason:
      refusal ??
      `OPENAI_EMBEDDING_MODEL=${model} is not the approved model ` +
        `(${APPROVED_EMBEDDING_MODEL}). Refusing to embed.`,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Thrown for a provider-side failure.
 *
 * `embedText` catches this and maps it to a normalised `EmbeddingError`,
 * so a caller never sees provider internals. The message carries a
 * status and nothing else — never a response body, which can echo the
 * request, and never key material.
 */
export class EmbeddingProviderError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Embedding provider returned status ${status}.`);
    this.name = "EmbeddingProviderError";
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/*                                   CLIENT                                   */
/* -------------------------------------------------------------------------- */

interface OpenAiEmbeddingResponse {
  data?: ReadonlyArray<{ embedding?: unknown }>;
}

/**
 * Builds the approved OpenAI embedding client.
 *
 * Returns `null` when unconfigured, so a missing key is a normal,
 * handled condition rather than a thrown error at import time — and so
 * a deployment without a key simply cannot embed, instead of failing
 * mid-request.
 *
 * CALLING THIS FUNCTION DOES NOT SPEND ANYTHING. It constructs an object.
 * Cost is incurred only when `embed` is invoked, which happens only
 * inside `embedText`, which is itself only reachable from `ingestChunk`
 * after authorization has been proven.
 *
 * The returned client is intentionally thin: it performs one HTTP call
 * and extracts one array. Timeout, retry, dimension validation and all
 * authorization live outside it, so a test double is a one-line function
 * and cannot skip a control by being simpler than the real client.
 */
export function createOpenAiEmbeddingClient(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingClient | null {
  const agreement = assertApprovedModelEnv(env);

  if (!agreement.ok) {
    console.error("SYRAVEN EMBEDDING: refusing to construct client.", {
      reason: agreement.reason,
    });
    return null;
  }

  const apiKey = providerApiKey("openai", env);

  if (apiKey === null) return null;

  const endpoint = PROVIDER_ENDPOINTS.openai;

  return {
    modelId: APPROVED_EMBEDDING_MODEL,

    async embed(input): Promise<readonly number[]> {
      const response = await fetch(`${endpoint.baseUrl}/embeddings`, {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: APPROVED_EMBEDDING_MODEL,
          input: input.text,
          /*
           * Sent explicitly even though it matches the model's native
           * width. If the model constant is ever changed to one that is
           * wider by default, this keeps the request pinned to what the
           * schema can store rather than silently widening.
           */
          dimensions: EMBEDDING_DIMENSIONS,
        }),

        /*
         * The SERVER's signal, created by `embedText`. A caller's own
         * signal is never used: it would let a client hold a paid
         * provider connection open indefinitely.
         */
        signal: input.signal,
      });

      if (!response.ok) {
        /*
         * The body is read for the server-side log only. It can contain
         * organisation ids, quota details and echoes of the request, so
         * it is truncated and never returned to a caller.
         */
        const detail = await response.text().catch(() => "");

        console.error("SYRAVEN EMBEDDING: provider error.", {
          status: response.status,
          model: APPROVED_EMBEDDING_MODEL,
          detail: detail.slice(0, 300),
        });

        throw new EmbeddingProviderError(response.status);
      }

      const payload = (await response.json()) as OpenAiEmbeddingResponse;

      const vector = payload.data?.[0]?.embedding;

      /*
       * Returned unvalidated BY DESIGN. `embedText` validates dimension
       * and finiteness on whatever comes back. Checking here as well
       * would duplicate the control and invite the two copies to drift;
       * checking ONLY here would let a future client skip it.
       */
      return (Array.isArray(vector) ? vector : []) as readonly number[];
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                              POLICY RE-EXPORT                              */
/* -------------------------------------------------------------------------- */

/**
 * The timeout this client is subject to, for callers that need to
 * reason about wall-clock budget. Owned by `embedding.ts`; re-exported
 * so a caller does not have to import two modules to learn one fact.
 */
export const OPENAI_EMBEDDING_TIMEOUT_MS = EMBEDDING_POLICY.timeoutMs;
