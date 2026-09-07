/**
 * SYRAVEN — Vector/embedding contract
 * lib/search/vector.ts
 *
 * Phase 10 Step 10.3 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY (shape enforcement).
 *
 * This module defines what an embedding IS in this system, and nothing
 * else. It generates no embeddings and calls no provider — Step 10.3 is
 * explicitly a no-cost step. See `EMBEDDING_MODEL_CONTRACT` for the
 * dimension the schema already commits us to.
 *
 * WHY DIMENSION IS A SECURITY CONCERN, NOT JUST A TYPE CONCERN
 *
 * `pgvector` rejects a comparison between vectors of differing
 * dimension with a runtime error. That error surfaces from the database
 * through the retrieval path, and a raw database error is exactly the
 * kind of message that leaks column names and internal structure. By
 * validating dimension BEFORE the query is built, a malformed vector is
 * refused in application code with a generic reason, and the database is
 * never asked a question it will fail.
 *
 * A second reason: an all-zero or non-finite vector produces undefined
 * ordering under cosine distance. Ordering that is not meaningful is
 * still ordering the caller can observe, so it is refused rather than
 * silently ranked.
 */

import "server-only";

/* -------------------------------------------------------------------------- */
/*                             DIMENSION CONTRACT                             */
/* -------------------------------------------------------------------------- */

/**
 * The embedding dimension the CURRENT schema declares.
 *
 * Source of truth, verified 2026-09-05 against
 * `supabase/migrations/20260901154640_syraven_ai_core.sql`:
 *
 *   line 461 — public.ai_memories.embedding        vector(1536)
 *   line 699 — public.ai_knowledge_chunks.embedding vector(1536)
 *
 * Both embedding-bearing tables agree on 1536. This constant is NOT a
 * preference or a default — changing it without a corresponding
 * migration makes every retrieval fail at the database, so it is pinned
 * here and asserted by the security tests.
 */
export const EMBEDDING_DIMENSIONS = 1536 as const;

/**
 * Documentary note on where 1536 came from, and what it constrains.
 *
 * 1536 is the native width of OpenAI's `text-embedding-3-small` and of
 * the legacy `text-embedding-ada-002`. The schema was written around
 * that family. This is recorded so that whoever implements Step 10.4
 * knows the choice is already made by the column type: a model with a
 * different native width must either be reduced to 1536 (supported by
 * `text-embedding-3-*` via the `dimensions` parameter) or the column
 * must be migrated.
 *
 * NOTHING IN STEP 10.3 CALLS A PROVIDER. This constant is documentation
 * of a schema fact, not configuration of a client.
 */
export const EMBEDDING_MODEL_CONTRACT = {
  dimensions: EMBEDDING_DIMENSIONS,
  /** Distance operator the retrieval contract assumes. */
  distance: "cosine",
  /**
   * Whether vectors are expected pre-normalised. Cosine distance is
   * scale-invariant, so this is informational for 10.4's writer.
   */
  normalized: true,
} as const;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

/**
 * A validated embedding.
 *
 * The brand exists so that an arbitrary `number[]` cannot be passed into
 * retrieval. The only way to obtain this type is `validateEmbedding`,
 * which means the dimension and finiteness checks cannot be bypassed by
 * a caller that simply asserts a type.
 */
export type EmbeddingVector = readonly number[] & {
  readonly __brand: "EmbeddingVector";
};

export type EmbeddingValidation =
  | { ok: true; embedding: EmbeddingVector }
  | { ok: false; reason: string };

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

/**
 * Validates an embedding against the schema's contract.
 *
 * Rejects, in order:
 *
 *   - non-arrays
 *   - wrong dimension (would be a pgvector runtime error)
 *   - non-finite components (NaN/Infinity produce undefined ordering)
 *   - the zero vector (cosine distance is undefined against it)
 *
 * The reasons are safe to log but are NOT intended for the caller
 * verbatim; the retrieval layer maps them to a generic failure.
 */
export function validateEmbedding(input: unknown): EmbeddingValidation {
  if (!Array.isArray(input)) {
    return { ok: false, reason: "Embedding must be an array of numbers." };
  }

  if (input.length !== EMBEDDING_DIMENSIONS) {
    /*
     * Dimension is reported because it is a fixed, public property of
     * the schema — it discloses nothing about any tenant's data.
     */
    return {
      ok: false,
      reason: `Embedding must have exactly ${EMBEDDING_DIMENSIONS} dimensions.`,
    };
  }

  let sumOfSquares = 0;

  for (const component of input) {
    if (typeof component !== "number" || !Number.isFinite(component)) {
      return {
        ok: false,
        reason: "Embedding components must be finite numbers.",
      };
    }

    sumOfSquares += component * component;
  }

  if (sumOfSquares === 0) {
    return {
      ok: false,
      reason: "Embedding must not be the zero vector.",
    };
  }

  return { ok: true, embedding: input as unknown as EmbeddingVector };
}

/* -------------------------------------------------------------------------- */
/*                               SERIALISATION                                */
/* -------------------------------------------------------------------------- */

/**
 * Serialises a validated embedding to pgvector's literal form.
 *
 * Takes `EmbeddingVector` rather than `number[]` so this cannot be
 * reached with unvalidated input. Every component is already known
 * finite, so the output can contain only digits, `.`, `-`, `e`, `,` and
 * the enclosing brackets — there is no path by which caller-supplied
 * text reaches this string.
 */
export function serializeEmbedding(embedding: EmbeddingVector): string {
  return `[${embedding.join(",")}]`;
}
