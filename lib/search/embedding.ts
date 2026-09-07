/**
 * SYRAVEN — Embedding provider abstraction
 * lib/search/embedding.ts
 *
 * Phase 10 Step 10.4 (see IMPLEMENTATION_PLAN.md).
 *
 * COST BOUNDARY. This module is the only place that may turn text into
 * a vector, and therefore the only place that can spend money on
 * embeddings.
 *
 * NOTHING HERE CALLS A PROVIDER BY DEFAULT.
 *
 * `embedText` takes an `EmbeddingClient` as an argument. There is no
 * ambient default, no module-scope singleton, and no lazily-constructed
 * HTTP client. A caller that does not supply a client cannot make a
 * paid call — which is what keeps Step 10.4 at zero cost and keeps every
 * test honest without needing to stub `fetch`.
 *
 * A real HTTP client is NOT included in this step. Rule 17 of the 10.4
 * brief requires the provider/model decision and its cost to be reported
 * and approved BEFORE any paid call is made, and that approval has not
 * been given. `OPENAI_EMBEDDING_CANDIDATES` documents the options for
 * that decision; see the audit report.
 *
 * THE DIMENSION TRAP THIS MODULE EXISTS TO PREVENT
 *
 * `.env.local` currently declares:
 *
 *     OPENAI_EMBEDDING_MODEL=text-embedding-3-large
 *     KNOWLEDGE_EMBEDDING_DIMENSIONS=3072
 *
 * The schema declares `vector(1536)`. Nothing reads those variables
 * today, so the mismatch is latent — but wiring them in naively would
 * produce 3072-wide vectors that every INSERT rejects, or worse, a
 * silent dimension change that makes stored vectors mutually
 * incomparable.
 *
 * This module therefore treats the SCHEMA as the authority and the
 * environment as a suggestion that must prove itself. An environment
 * asking for a dimension the schema cannot store is refused loudly
 * rather than honoured (requirement 12).
 */

import "server-only";

import {
  EMBEDDING_DIMENSIONS,
  validateEmbedding,
  type EmbeddingVector,
} from "./vector";

/* -------------------------------------------------------------------------- */
/*                              MODEL CANDIDATES                              */
/* -------------------------------------------------------------------------- */

/**
 * Embedding models that COULD serve this schema, for the pending
 * provider decision. Listing one here does not approve it and does not
 * make it reachable — `embedText` never selects a model on its own.
 *
 * `nativeDimensions` is what the model emits by default.
 * `supportsDimensionReduction` records whether the provider can be asked
 * for a narrower vector (OpenAI's `dimensions` parameter, supported by
 * the `text-embedding-3-*` family and NOT by `ada-002`).
 *
 * Cost figures are list prices per 1M input tokens as published by
 * OpenAI; they are recorded for the approval decision and are not used
 * in any computation.
 */
export const OPENAI_EMBEDDING_CANDIDATES = {
  "text-embedding-3-small": {
    nativeDimensions: 1536,
    supportsDimensionReduction: true,
    usdPerMillionInputTokens: 0.02,
    /** Matches the schema natively — no reduction required. */
    matchesSchemaNatively: true,
  },
  "text-embedding-3-large": {
    nativeDimensions: 3072,
    supportsDimensionReduction: true,
    usdPerMillionInputTokens: 0.13,
    /**
     * This is the model named in `.env.local`. It does NOT match the
     * schema natively: it must be requested with `dimensions: 1536`, or
     * the column must be migrated to `vector(3072)`.
     */
    matchesSchemaNatively: false,
  },
  "text-embedding-ada-002": {
    nativeDimensions: 1536,
    supportsDimensionReduction: false,
    usdPerMillionInputTokens: 0.1,
    matchesSchemaNatively: true,
  },
} as const;

export type EmbeddingModelId = keyof typeof OPENAI_EMBEDDING_CANDIDATES;

/**
 * Whether a candidate model can serve the CURRENT schema, and how.
 *
 * Returns the explicit `dimensions` value that must be sent to the
 * provider, so a caller cannot forget it for a model whose native width
 * is wrong.
 */
export function resolveModelForSchema(model: EmbeddingModelId):
  | { ok: true; requestDimensions: number; requiresReduction: boolean }
  | { ok: false; reason: string } {
  /*
   * Widened from the literal types in the table above. Without this the
   * compiler narrows to `never` after the first comparison — every
   * candidate's dimensions are literal types, so it can prove the second
   * branch unreachable for some members and collapses the union.
   */
  const candidate: {
    nativeDimensions: number;
    supportsDimensionReduction: boolean;
  } = OPENAI_EMBEDDING_CANDIDATES[model];

  if (candidate.nativeDimensions === EMBEDDING_DIMENSIONS) {
    return {
      ok: true,
      requestDimensions: EMBEDDING_DIMENSIONS,
      requiresReduction: false,
    };
  }

  if (!candidate.supportsDimensionReduction) {
    return {
      ok: false,
      reason:
        `${model} emits ${candidate.nativeDimensions} dimensions and cannot ` +
        `be reduced; the schema stores ${EMBEDDING_DIMENSIONS}.`,
    };
  }

  return {
    ok: true,
    /* Must be sent explicitly, or the provider returns native width. */
    requestDimensions: EMBEDDING_DIMENSIONS,
    requiresReduction: true,
  };
}

/* -------------------------------------------------------------------------- */
/*                            ENVIRONMENT GUARD                               */
/* -------------------------------------------------------------------------- */

/**
 * Refuses an environment that contradicts the schema.
 *
 * Called by ingestion before any provider work. A mismatch is a
 * DEPLOYMENT error, not a caller error, so it fails closed and loudly
 * rather than silently reinterpreting the dimension (requirement 12).
 */
export function verifyEnvironmentDimensions(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; reason: string } {
  const declared = env.KNOWLEDGE_EMBEDDING_DIMENSIONS;

  /* Unset is fine — the schema constant is the authority. */
  if (typeof declared !== "string" || declared.trim().length === 0) {
    return { ok: true };
  }

  const parsed = Number.parseInt(declared.trim(), 10);

  if (!Number.isFinite(parsed)) {
    return {
      ok: false,
      reason: "KNOWLEDGE_EMBEDDING_DIMENSIONS is not a number.",
    };
  }

  if (parsed !== EMBEDDING_DIMENSIONS) {
    return {
      ok: false,
      reason:
        `KNOWLEDGE_EMBEDDING_DIMENSIONS=${parsed} contradicts the schema's ` +
        `vector(${EMBEDDING_DIMENSIONS}). Refusing to embed: stored vectors ` +
        `would be mutually incomparable.`,
    };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                                  ERRORS                                    */
/* -------------------------------------------------------------------------- */

export type EmbeddingErrorKind =
  | "NOT_CONFIGURED"
  | "INVALID_INPUT"
  | "DIMENSION_MISMATCH"
  | "PROVIDER_ERROR"
  | "TIMEOUT";

export interface EmbeddingError {
  readonly kind: EmbeddingErrorKind;
  /**
   * Safe to surface. Carries no provider internals, no key material and
   * no document content (requirement 10).
   */
  readonly clientMessage: string;
}

/* -------------------------------------------------------------------------- */
/*                                  POLICY                                    */
/* -------------------------------------------------------------------------- */

/**
 * Server-owned request policy. Mirrors `AI_REQUEST_POLICY` in
 * lib/ai/provider.ts; embeddings are cheaper and faster than
 * completions, so the timeout is tighter.
 */
export const EMBEDDING_POLICY = {
  timeoutMs: 30_000,
  /**
   * ONE retry. Bounded for the same reason as the chat adapter: an
   * aggressive retry against a paid provider multiplies cost during an
   * outage, and a request that reached the model may be billed even if
   * the response never arrived.
   */
  maxRetries: 1,
  retryDelayMs: 500,
  /** Longest text accepted for a single embedding call. */
  maxInputCharacters: 32_000,
} as const;

/* -------------------------------------------------------------------------- */
/*                              CLIENT CONTRACT                               */
/* -------------------------------------------------------------------------- */

/**
 * The injectable provider seam (requirement L).
 *
 * Implementations return a raw number array. Everything about
 * authorization, dimension checking and retry lives OUTSIDE the client,
 * so a test double is a one-line function and cannot accidentally skip a
 * control by being simpler than the real thing.
 */
export interface EmbeddingClient {
  readonly modelId: string;
  embed(input: {
    text: string;
    dimensions: number;
    signal: AbortSignal;
  }): Promise<readonly number[]>;
}

export type EmbeddingResult =
  | { ok: true; embedding: EmbeddingVector; modelId: string }
  | { ok: false; error: EmbeddingError };

/* -------------------------------------------------------------------------- */
/*                               INPUT GUARDS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Validates text before it leaves the process.
 *
 * This is the last checkpoint before content reaches a third party, so
 * it is deliberately strict: empty or whitespace-only text is a bug
 * worth surfacing, not something to spend money embedding.
 */
export function validateEmbeddingInput(
  text: unknown,
): { ok: true; text: string } | { ok: false; reason: string } {
  if (typeof text !== "string") {
    return { ok: false, reason: "Embedding input must be a string." };
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "Embedding input must not be empty." };
  }

  if (text.length > EMBEDDING_POLICY.maxInputCharacters) {
    return {
      ok: false,
      reason: `Embedding input exceeds ${EMBEDDING_POLICY.maxInputCharacters} characters.`,
    };
  }

  return { ok: true, text };
}

/* -------------------------------------------------------------------------- */
/*                                 EXECUTION                                  */
/* -------------------------------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Produces one embedding through an injected client.
 *
 * ORDER OF OPERATIONS IS THE CONTROL:
 *
 *   1. Validate input   — nothing malformed is ever sent, or paid for.
 *   2. Call the client  — bounded by timeout and a single retry.
 *   3. Validate output  — dimension and finiteness, BEFORE any caller
 *                         can persist it.
 *
 * Step 3 is what stops a provider (or a mock, or a model swapped in
 * `.env.local`) from writing a vector the schema cannot store or that
 * ranks meaninglessly. It runs on the provider's OUTPUT, so it holds
 * regardless of which model produced it.
 *
 * NOTE: this function never logs `text` or the returned vector
 * (requirement 10). Failures are described by kind alone.
 */
export async function embedText(
  client: EmbeddingClient,
  text: string,
): Promise<EmbeddingResult> {
  const input = validateEmbeddingInput(text);

  if (!input.ok) {
    return {
      ok: false,
      error: { kind: "INVALID_INPUT", clientMessage: input.reason },
    };
  }

  let attempt = 0;

  for (;;) {
    try {
      const raw = await client.embed({
        text: input.text,
        dimensions: EMBEDDING_DIMENSIONS,
        /* SERVER-owned timeout; never a caller's signal. */
        signal: AbortSignal.timeout(EMBEDDING_POLICY.timeoutMs),
      });

      /*
       * OUTPUT VALIDATION. A provider that returns the wrong width — the
       * `text-embedding-3-large` case above being the live risk — is
       * rejected here rather than at the database, where the error would
       * carry column names.
       */
      const validated = validateEmbedding(raw as unknown);

      if (!validated.ok) {
        console.error("SYRAVEN EMBEDDING: provider returned an invalid vector.", {
          modelId: client.modelId,
          /* Length only. Never the vector itself. */
          receivedLength: Array.isArray(raw) ? raw.length : null,
          expected: EMBEDDING_DIMENSIONS,
        });

        return {
          ok: false,
          error: {
            kind: "DIMENSION_MISMATCH",
            clientMessage: "The embedding service returned an unusable result.",
          },
        };
      }

      return { ok: true, embedding: validated.embedding, modelId: client.modelId };
    } catch (cause) {
      const isTimeout =
        cause instanceof Error &&
        (cause.name === "TimeoutError" || cause.name === "AbortError");

      if (isTimeout || attempt >= EMBEDDING_POLICY.maxRetries) {
        console.error("SYRAVEN EMBEDDING: provider call failed.", {
          modelId: client.modelId,
          name: cause instanceof Error ? cause.name : "unknown",
        });

        return {
          ok: false,
          error: isTimeout
            ? {
                kind: "TIMEOUT",
                clientMessage: "The embedding service timed out.",
              }
            : {
                kind: "PROVIDER_ERROR",
                clientMessage: "The embedding service is unavailable.",
              },
        };
      }
    }

    attempt += 1;

    await sleep(EMBEDDING_POLICY.retryDelayMs);
  }
}
