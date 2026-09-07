/**
 * SYRAVEN — Semantic (vector) retrieval
 * lib/search/semantic.ts
 *
 * Phase 10 Step 10.3 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY. Read `lib/search/query.ts` first — the two failure
 * modes described there (post-filtering, cross-tenant ranking) apply
 * with MORE force here, for a reason specific to vectors.
 *
 * WHY VECTOR SEARCH IS MORE DANGEROUS THAN KEYWORD SEARCH
 *
 * A keyword query that forgets its ownership filter returns rows the
 * caller can see are wrong. A vector query that forgets it returns the
 * NEAREST rows in the entire corpus — which is to say, the rows most
 * semantically similar to what the caller asked about, drawn from every
 * tenant in the system. The failure mode is not "wrong results", it is
 * "the most relevant possible extract of other tenants' private data".
 *
 * Worse, the leak survives filtering. If similarity is computed over a
 * shared corpus and unauthorized rows are dropped afterwards, the caller
 * still learns, from the gaps and the ordering of what remains, that
 * more-similar content exists elsewhere. That is requirement #6 and #7:
 * never retrieve broadly and post-filter, and never let ranking span
 * tenants.
 *
 * THE AUTHORIZATION MODEL THIS FILE ENFORCES
 *
 * `ai_knowledge_chunks` has NO tenant column. Not `organization_id`, not
 * `workspace_id`, not `user_id`. Ownership is reachable only by walking
 * three foreign keys:
 *
 *   ai_knowledge_chunks.knowledge_document_id
 *     -> ai_knowledge_documents.knowledge_source_id
 *       -> ai_knowledge_sources.knowledge_base_id
 *         -> ai_knowledge_bases.owner_id = auth.uid()
 *
 * The database RLS policy ("Users manage own knowledge chunks",
 * migration 20260901154640 line 1433) expresses exactly this chain as an
 * EXISTS clause. This module RE-EXPRESSES the same chain explicitly, as
 * a resolved allowlist of document ids, and constrains every retrieval
 * to it.
 *
 * That duplication is deliberate. RLS is the backstop; the explicit
 * chain is the control. Two independent layers must both fail before a
 * chunk crosses a tenant boundary, and the mutation tests treat removal
 * of the explicit layer as critical precisely because RLS alone would
 * then be the only thing standing between a caller and the corpus.
 *
 * DATA ACCESS
 *
 * Every query runs on the CALLER'S RLS-scoped client
 * (`session.supabase`). There is no service-role path in this file and
 * there must never be one. A `SECURITY DEFINER` RPC would likewise
 * bypass RLS and is rejected by the same reasoning — see
 * `RETRIEVAL_CONTRACT` below.
 *
 * WHAT THIS STEP DOES NOT DO
 *
 * It generates no embeddings and calls no provider (requirements #9,
 * #10). The query embedding is an INPUT. Ordering by true vector
 * distance additionally requires database support the current schema
 * does not provide — see `RETRIEVAL_CONTRACT` for the precise gap and
 * why no migration was created in this step.
 */

import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";
import {
  EMBEDDING_DIMENSIONS,
  serializeEmbedding,
  validateEmbedding,
  type EmbeddingVector,
} from "./vector";

/* -------------------------------------------------------------------------- */
/*                            RETRIEVAL CONTRACT                              */
/* -------------------------------------------------------------------------- */

/**
 * The database capability this module requires, and does not yet have.
 *
 * PostgREST cannot express `ORDER BY embedding <=> $1`. The `<=>`
 * operator has no REST filter form, so true k-nearest-neighbour ordering
 * must run inside Postgres — as a function.
 *
 * That function MUST be `SECURITY INVOKER` (the default). A
 * `SECURITY DEFINER` function runs as its owner, which switches
 * `auth.uid()` and disables the RLS policy that is this table's entire
 * authorization model. A `SECURITY DEFINER` similarity function over
 * `ai_knowledge_chunks` would be a full-corpus disclosure primitive, and
 * must never be created.
 *
 * The current schema provides NEITHER the function NOR a vector index
 * (`ai_knowledge_chunks` carries only `idx_ai_knowledge_chunks_document`,
 * a b-tree on the foreign key). Per requirement #12 the migration was
 * NOT created; the gap is reported instead.
 *
 * Until that function exists, `retrieveSemantic` runs in a degraded but
 * SAFE mode: it resolves the authorization chain, constrains retrieval
 * to the caller's own documents, and reports that distance ordering is
 * unavailable. It never falls back to fetching a broad corpus and
 * ranking in application code — that fallback is the exact violation
 * this file exists to prevent.
 */
export const RETRIEVAL_CONTRACT = {
  /** The RPC, live since migration 20260906140000. */
  rpcName: "match_knowledge_chunks",
  /** Required security mode. DEFINER would bypass RLS. */
  rpcSecurity: "INVOKER",
  /** Distance operator the RPC uses. */
  distanceOperator: "<=>",
  /**
   * Whether the capability exists in the schema.
   *
   * TRUE since 20260906140000 created the SECURITY INVOKER function and
   * its HNSW index, verified in production as prosecdef = false with
   * search_path pinned.
   *
   * This flag says the capability EXISTS. It does not by itself set
   * `degraded` on a result: that is decided per call, from whether the
   * RPC actually succeeded. A live capability that errors at request
   * time still yields a degraded response.
   */
  available: true,
  dimensions: EMBEDDING_DIMENSIONS,
  /** Default cosine-similarity floor. Clamped to [0,1] by the function. */
  defaultThreshold: 0.5,
} as const;

/* -------------------------------------------------------------------------- */
/*                                   LIMITS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Bounds on a semantic retrieval.
 *
 * `maxDocumentScope` bounds the resolved allowlist. It is a safety
 * bound, not a correctness one: without it, a caller owning very many
 * documents would produce an unbounded `IN (...)` list. Retrieval is
 * capped rather than widened — exceeding it narrows what is searched,
 * never broadens it.
 */
export const SEMANTIC_LIMITS = {
  defaultLimit: 10,
  maxLimit: 25,
  /** Maximum authorized documents folded into a single retrieval. */
  maxDocumentScope: 500,
  /**
   * Maximum chunks the database may return for one retrieval.
   *
   * Applied on top of the authorization filter, so this bounds work,
   * not visibility.
   */
  maxChunkWindow: 200,
} as const;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface SemanticRequest {
  /**
   * The query embedding. An INPUT — this module does not produce it.
   *
   * Typed as `unknown` so it passes through `validateEmbedding` rather
   * than being trusted at the boundary.
   */
  readonly embedding: unknown;
  readonly limit: number;
  /**
   * Optional NARROWING to a single knowledge base. Never widening: the
   * caller's own bases are resolved independently and are the ceiling,
   * so an unowned id yields an empty scope rather than access.
   */
  readonly knowledgeBaseId: string | null;
}

export interface SemanticChunk {
  readonly id: string;
  readonly documentId: string;
  readonly content: string;
  readonly chunkIndex: number;
  /**
   * Cosine DISTANCE, derived from the RPC's similarity as `1 -
   * similarity`. `null` in degraded mode.
   *
   * Deliberately nullable rather than defaulted to 0: a fabricated
   * distance would present arbitrary ordering as if it were relevance.
   * Lower is closer.
   */
  readonly distance: number | null;

  /**
   * Cosine SIMILARITY exactly as the database computed it, in [0,1].
   * `null` in degraded mode. Higher is closer.
   *
   * Carried alongside `distance` rather than instead of it because the
   * two are the natural units for different callers — a UI shows a
   * relevance percentage, a threshold check reads a distance — and
   * deriving one from the other at each call site invites a sign error.
   * Both come from the same database value; neither is computed from
   * corpus statistics.
   */
  readonly similarity: number | null;
}

export interface SemanticResults {
  readonly chunks: readonly SemanticChunk[];
  /**
   * True when results are NOT distance-ordered, because the database
   * capability in `RETRIEVAL_CONTRACT` is absent.
   *
   * Surfaced so a caller cannot mistake insertion order for relevance.
   */
  readonly degraded: boolean;
  /** Number of authorized documents the retrieval was scoped to. */
  readonly scopedDocuments: number;
}

export type SemanticOutcome =
  | { ok: true; results: SemanticResults }
  | { ok: false; reason: string };

/* -------------------------------------------------------------------------- */
/*                              CLIENT SHAPE                                  */
/* -------------------------------------------------------------------------- */

/*
 * Structural shape of the query builder actually used here. The
 * generated Supabase types do not model `ai_knowledge_chunks` joins in a
 * form this file can use directly, and the alternative — `any` — would
 * disable the checking that keeps the filters honest.
 */
interface SemanticQueryBuilder {
  select(columns: string): SemanticQueryBuilder;
  eq(column: string, value: string): SemanticQueryBuilder;
  in(column: string, values: readonly string[]): SemanticQueryBuilder;
  order(column: string, options: { ascending: boolean }): SemanticQueryBuilder;
  limit(count: number): SemanticQueryBuilder;
  then<TResult>(
    onfulfilled: (value: {
      data: unknown[] | null;
      error: { message: string } | null;
    }) => TResult,
  ): Promise<TResult>;
}

interface SemanticCapableClient {
  from(table: string): SemanticQueryBuilder;
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
}

function semanticTable(
  session: AuthenticatedSession,
  table: string,
): SemanticQueryBuilder {
  return (session.supabase as unknown as SemanticCapableClient).from(table);
}

/**
 * Invokes the similarity RPC on the CALLER'S client.
 *
 * `session.supabase` carries the caller's JWT, so PostgREST assumes
 * their database role and the SECURITY INVOKER function evaluates
 * `auth.uid()` as them. Passing a service-role client here would
 * silently disable the RLS policy that is `ai_knowledge_chunks`'s entire
 * authorization boundary — which is why this helper takes a session and
 * not a client.
 */
function semanticRpc(
  session: AuthenticatedSession,
  args: Record<string, unknown>,
): PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}> {
  return (session.supabase as unknown as SemanticCapableClient).rpc(
    RETRIEVAL_CONTRACT.rpcName,
    args,
  );
}

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

function clampLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return SEMANTIC_LIMITS.defaultLimit;

  return Math.min(
    Math.max(Math.trunc(parsed), 1),
    SEMANTIC_LIMITS.maxLimit,
  );
}

/**
 * Validates a semantic request.
 *
 * Identity is NOT part of this type and cannot be supplied by a caller —
 * it comes from the verified session at execution time, exactly as in
 * `SearchRequest`.
 */
export function validateSemanticRequest(input: {
  embedding?: unknown;
  limit?: unknown;
  knowledgeBaseId?: unknown;
}):
  | { ok: true; request: SemanticRequest; embedding: EmbeddingVector }
  | { ok: false; reason: string } {
  const validated = validateEmbedding(input.embedding);

  if (!validated.ok) return { ok: false, reason: validated.reason };

  const knowledgeBaseId =
    typeof input.knowledgeBaseId === "string" &&
    input.knowledgeBaseId.length > 0
      ? input.knowledgeBaseId
      : null;

  return {
    ok: true,
    embedding: validated.embedding,
    request: {
      embedding: validated.embedding,
      limit: clampLimit(input.limit),
      knowledgeBaseId,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                          AUTHORIZATION RESOLUTION                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the documents this caller may read, by walking the ownership
 * chain forwards.
 *
 * bases (owner_id = caller) -> sources -> documents
 *
 * Walking FORWARDS from the owner is what makes this an allowlist. The
 * alternative — reading chunks and checking ownership afterwards — is
 * post-filtering, and would mean unauthorized rows had already been
 * fetched and ranked.
 *
 * Each hop is constrained by the ids proven in the previous hop, so a
 * failure at any level yields an empty scope rather than a wider one.
 * An empty scope produces zero results; it never degrades to "no
 * filter".
 *
 * EXPORTED for `lib/search/ingest.ts` (Step 10.4). Retrieval and
 * ingestion must agree on who owns what; sharing this function means a
 * correction to the chain applies to both, and neither can drift into a
 * weaker rule of its own.
 */
export async function resolveAuthorizedDocuments(
  session: AuthenticatedSession,
  knowledgeBaseId: string | null,
): Promise<{ ok: true; documentIds: string[] } | { ok: false }> {
  /* HOP 1 — knowledge bases owned by the caller. */
  let baseQuery = semanticTable(session, "ai_knowledge_bases")
    .select("id")
    .eq("owner_id", session.userId);

  /*
   * Optional narrowing. Applied ALONGSIDE the ownership filter, never
   * instead of it, so naming another tenant's base yields an empty
   * result rather than that base.
   */
  if (knowledgeBaseId !== null) {
    baseQuery = baseQuery.eq("id", knowledgeBaseId);
  }

  const baseResult = await baseQuery.limit(SEMANTIC_LIMITS.maxDocumentScope);

  if (baseResult.error) {
    console.error("SYRAVEN SEMANTIC: knowledge base resolution failed.", {
      userId: session.userId,
      error: baseResult.error.message,
    });
    return { ok: false };
  }

  const baseIds = extractIds(baseResult.data);
  if (baseIds.length === 0) return { ok: true, documentIds: [] };

  /* HOP 2 — sources belonging to those bases. */
  const sourceResult = await semanticTable(session, "ai_knowledge_sources")
    .select("id")
    .in("knowledge_base_id", baseIds)
    .limit(SEMANTIC_LIMITS.maxDocumentScope);

  if (sourceResult.error) {
    console.error("SYRAVEN SEMANTIC: knowledge source resolution failed.", {
      userId: session.userId,
      error: sourceResult.error.message,
    });
    return { ok: false };
  }

  const sourceIds = extractIds(sourceResult.data);
  if (sourceIds.length === 0) return { ok: true, documentIds: [] };

  /* HOP 3 — documents belonging to those sources. */
  const documentResult = await semanticTable(session, "ai_knowledge_documents")
    .select("id")
    .in("knowledge_source_id", sourceIds)
    .limit(SEMANTIC_LIMITS.maxDocumentScope);

  if (documentResult.error) {
    console.error("SYRAVEN SEMANTIC: document resolution failed.", {
      userId: session.userId,
      error: documentResult.error.message,
    });
    return { ok: false };
  }

  return { ok: true, documentIds: extractIds(documentResult.data) };
}

function extractIds(rows: unknown[] | null): string[] {
  if (!rows) return [];

  const ids: string[] = [];

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;

    const id = (row as Record<string, unknown>).id;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }

  return ids;
}

/* -------------------------------------------------------------------------- */
/*                                 RETRIEVAL                                  */
/* -------------------------------------------------------------------------- */

/**
 * Retrieves chunks semantically, scoped to the caller's authorization.
 *
 * ORDER OF OPERATIONS IS THE SECURITY PROPERTY:
 *
 *   1. Validate the embedding (dimension/finiteness).
 *   2. Resolve the caller's authorized documents — an allowlist.
 *   3. If that allowlist is empty, return empty. Never unfiltered.
 *   4. Constrain retrieval to the allowlist, in the database.
 *
 * Step 3 is the one most easily lost in refactoring: an empty `IN ()`
 * list must mean "nothing", and is short-circuited here so it cannot be
 * emitted as an absent filter instead.
 *
 * The embedding is validated and serialised even in degraded mode. That
 * is intentional — it keeps the validation path exercised and identical
 * to the one the RPC will use, so enabling the RPC in 10.4 does not
 * introduce a newly-untested branch.
 */
export async function retrieveSemantic(
  session: AuthenticatedSession,
  request: SemanticRequest,
): Promise<SemanticOutcome> {
  const validated = validateEmbedding(request.embedding);

  if (!validated.ok) {
    return { ok: false, reason: "Invalid query embedding." };
  }

  /*
   * pgvector literal form, e.g. "[0.1,0.2,…]". Every component is
   * already known finite, so this string cannot carry caller-supplied
   * text into the query.
   */
  const embeddingLiteral = serializeEmbedding(validated.embedding);

  const authorized = await resolveAuthorizedDocuments(
    session,
    request.knowledgeBaseId,
  );

  if (!authorized.ok) {
    return { ok: false, reason: "Retrieval unavailable." };
  }

  /*
   * NO AUTHORIZED DOCUMENTS -> NO RESULTS.
   *
   * Returning early is not an optimisation. An empty id list passed to
   * `.in()` is an empty filter, and an empty filter is no filter — the
   * retrieval would match the whole corpus.
   */
  if (authorized.documentIds.length === 0) {
    return {
      ok: true,
      results: {
        chunks: [],
        /*
         * No ranking took place — the RPC was never called — so this is
         * not a ranked result. An empty set is unambiguous either way,
         * but claiming `degraded: false` here would mean "ranked" when
         * nothing was ranked.
         */
        degraded: true,
        scopedDocuments: 0,
      },
    };
  }

  const window = Math.min(request.limit, SEMANTIC_LIMITS.maxChunkWindow);

  /* ---------------------------------------------------------------- */
  /* RANKED PATH — the SECURITY INVOKER RPC                            */
  /*                                                                   */
  /* Runs on the caller's client, so RLS filters candidate rows inside  */
  /* the database and ranking happens only over authorized rows. There  */
  /* is no shared corpus to rank across.                               */
  /* ---------------------------------------------------------------- */

  if (RETRIEVAL_CONTRACT.available) {
    const ranked = await semanticRpc(session, {
      query_embedding: embeddingLiteral,
      match_threshold: RETRIEVAL_CONTRACT.defaultThreshold,
      match_count: window,
      knowledge_base: request.knowledgeBaseId,
    });

    if (!ranked.error) {
      const rankedRows = (ranked.data ?? []) as Record<string, unknown>[];

      /*
       * INDEPENDENT AUTHORIZATION LAYER.
       *
       * RLS already constrained these rows, and the RPC is SECURITY
       * INVOKER so that constraint genuinely applied. This filter is a
       * SECOND, independent check against the allowlist resolved above.
       *
       * It is not redundancy for its own sake: RLS lives in the
       * database and this lives in the application, so a policy
       * regression, a mistaken SECURITY DEFINER conversion, or a
       * privilege change cannot silently widen retrieval without also
       * defeating this filter. Both layers must fail before a chunk
       * crosses a tenant boundary.
       *
       * Note this is NOT post-filtering of a broad corpus: the rows were
       * already authorization-scoped when they were produced. Nothing
       * unauthorized was fetched, and nothing was ranked across tenants.
       */
      const allowed = new Set(authorized.documentIds);

      const chunks: SemanticChunk[] = [];

      for (const row of rankedRows) {
        const documentId = String(row.knowledge_document_id ?? "");

        if (!allowed.has(documentId)) {
          /*
           * Reaching here means RLS and the allowlist disagree, which is
           * a security-relevant inconsistency rather than a normal
           * empty result. Logged without content, and the row is
           * dropped.
           */
          console.error("SYRAVEN SEMANTIC: RPC row outside allowlist.", {
            userId: session.userId,
          });
          continue;
        }

        const similarity =
          typeof row.similarity === "number" && Number.isFinite(row.similarity)
            ? row.similarity
            : null;

        chunks.push({
          id: String(row.id),
          documentId,
          content: typeof row.content === "string" ? row.content : "",
          chunkIndex:
            typeof row.chunk_index === "number" ? row.chunk_index : 0,
          /* Both derived from the database's value; neither invented. */
          distance: similarity === null ? null : 1 - similarity,
          similarity,
        });
      }

      return {
        ok: true,
        results: {
          chunks,
          /* Only here, and only because the RPC actually succeeded. */
          degraded: false,
          scopedDocuments: authorized.documentIds.length,
        },
      };
    }

    /*
     * The RPC failed. Fall through to the degraded path rather than
     * failing the request: the caller still gets their own authorized
     * chunks, honestly labelled as unranked.
     */
    console.error("SYRAVEN SEMANTIC: ranking RPC failed; degrading.", {
      userId: session.userId,
      error: ranked.error.message,
    });
  }

  /* ---------------------------------------------------------------- */
  /* DEGRADED PATH                                                     */
  /*                                                                   */
  /* Reached when the capability is absent OR the RPC errored.         */
  /*                                                                   */
  /* Constrained to the resolved allowlist BEFORE the database         */
  /* produces a row. Combined with RLS on the same table, ownership is  */
  /* enforced twice and independently.                                 */
  /*                                                                   */
  /* Columns are explicit and exclude `embedding`: returning raw        */
  /* vectors would let a caller reconstruct corpus geometry, and they   */
  /* are useless to a UI.                                              */
  /* ---------------------------------------------------------------- */

  const chunkResult = await semanticTable(session, "ai_knowledge_chunks")
    .select("id, knowledge_document_id, content, chunk_index")
    .in("knowledge_document_id", authorized.documentIds)
    /*
     * DEGRADED ORDERING.
     *
     * Not relevance. `<=>` cannot be expressed through PostgREST, so
     * until the RPC in RETRIEVAL_CONTRACT exists this is a stable,
     * arbitrary order over an ALREADY-AUTHORIZED set. It is reported as
     * `degraded: true` so it is never mistaken for ranking.
     *
     * The alternative — fetching the corpus and ranking in Node — is
     * refused: it is precisely the post-filtering this module forbids.
     */
    .order("chunk_index", { ascending: true })
    .limit(window);

  if (chunkResult.error) {
    console.error("SYRAVEN SEMANTIC: chunk retrieval failed.", {
      userId: session.userId,
      error: chunkResult.error.message,
    });
    return { ok: false, reason: "Retrieval unavailable." };
  }

  const rows = (chunkResult.data ?? []) as Record<string, unknown>[];

  const chunks: SemanticChunk[] = rows.map((row) => ({
    id: String(row.id),
    documentId: String(row.knowledge_document_id),
    content: typeof row.content === "string" ? row.content : "",
    chunkIndex:
      typeof row.chunk_index === "number" ? row.chunk_index : 0,
    /* Never fabricated. No ranking happened, so no relevance is claimed. */
    distance: null,
    similarity: null,
  }));

  return {
    ok: true,
    results: {
      chunks,
      /*
       * ALWAYS true on this path. Not `!RETRIEVAL_CONTRACT.available`:
       * this branch is now reachable with the capability present but
       * failing, and reporting those results as ranked would be a lie
       * about relevance the caller cannot detect.
       */
      degraded: true,
      scopedDocuments: authorized.documentIds.length,
    },
  };
}
