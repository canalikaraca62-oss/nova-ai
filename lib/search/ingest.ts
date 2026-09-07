/**
 * SYRAVEN — Authorization-scoped embedding ingestion
 * lib/search/ingest.ts
 *
 * Phase 10 Step 10.4 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY. Read `lib/search/semantic.ts` first.
 *
 * WHY INGESTION IS A DIFFERENT RISK FROM RETRIEVAL
 *
 * Retrieval leaks data to the CALLER. Ingestion leaks data to a THIRD
 * PARTY. If the authorization chain is lost here, document content is
 * not merely shown to the wrong user — it is transmitted out of the
 * system to a provider, where it is beyond recall. A retrieval bug can
 * be fixed; an exfiltration cannot be undone.
 *
 * That asymmetry drives the order of operations in `ingestChunk`:
 * authorization is proven BEFORE content is read, and content is read
 * only from rows the proof covers. The provider is never handed text
 * that has not passed through that gate (requirements 6, 7, F).
 *
 * THE AUTHORIZATION CHAIN
 *
 * `ai_knowledge_chunks` has no tenant column. Ownership is reachable
 * only through three foreign keys, exactly as in retrieval:
 *
 *   chunk -> document -> source -> knowledge_base.owner_id = auth.uid()
 *
 * `resolveAuthorizedDocuments` in semantic.ts already walks that chain
 * forwards into an allowlist. Ingestion REUSES it rather than
 * reimplementing it, so the two paths cannot drift apart — a fix to one
 * is a fix to both.
 *
 * DATA ACCESS
 *
 * Every read and write uses the caller's RLS-scoped `session.supabase`.
 * There is no service-role path in this file and there must never be
 * one (requirement 5). RLS on `ai_knowledge_chunks` is `FOR ALL` with
 * both USING and WITH CHECK, so a scoped UPDATE is covered by the same
 * policy that covers a SELECT — no migration is required to write.
 *
 * WHAT THIS MODULE DOES NOT DO
 *
 * It does not run bulk jobs, does not backfill, and does not schedule
 * anything (requirements 13, 14, 19). It embeds ONE chunk per call, for
 * a caller who has proven they own it. Batch orchestration is a
 * deliberate non-goal: a loop over this function is the caller's to
 * write, with their own rate limiting and cost ceiling.
 */

import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";
import {
  embedText,
  verifyEnvironmentDimensions,
  type EmbeddingClient,
} from "./embedding";
import { isWithinContentCeiling } from "./ingestPolicy";
import { resolveAuthorizedDocuments } from "./semantic";
import { serializeEmbedding } from "./vector";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type IngestFailureKind =
  /** The chunk does not exist, or the caller may not reach it. */
  | "NOT_AUTHORIZED"
  /** Deployment contradicts the schema; see verifyEnvironmentDimensions. */
  | "MISCONFIGURED"
  /** The chunk's own content is unusable. */
  | "INVALID_CONTENT"
  /** The provider failed. Nothing was written. */
  | "PROVIDER_FAILED"
  /** The write itself failed. */
  | "WRITE_FAILED";

export interface IngestFailure {
  readonly kind: IngestFailureKind;
  readonly clientMessage: string;
}

export type IngestOutcome =
  | { ok: true; status: "embedded"; chunkId: string }
  /** A valid embedding already existed and was left alone. */
  | { ok: true; status: "skipped_existing"; chunkId: string }
  | { ok: false; failure: IngestFailure };

/**
 * `NOT_AUTHORIZED` deliberately carries the same message whether the
 * chunk is missing or merely someone else's.
 *
 * Distinguishing them would turn ingestion into an existence oracle: a
 * caller could enumerate chunk ids and learn which exist in other
 * tenants from the difference in replies.
 */
const NOT_AUTHORIZED: IngestFailure = {
  kind: "NOT_AUTHORIZED",
  clientMessage: "The requested content is unavailable.",
};

/* -------------------------------------------------------------------------- */
/*                              CLIENT SHAPE                                  */
/* -------------------------------------------------------------------------- */

interface IngestQueryBuilder {
  select(columns: string): IngestQueryBuilder;
  update(values: Record<string, unknown>): IngestQueryBuilder;
  eq(column: string, value: string): IngestQueryBuilder;
  in(column: string, values: readonly string[]): IngestQueryBuilder;
  is(column: string, value: null): IngestQueryBuilder;
  limit(count: number): IngestQueryBuilder;
  maybeSingle(): Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
  then<TResult>(
    onfulfilled: (value: {
      data: unknown[] | null;
      error: { message: string } | null;
    }) => TResult,
  ): Promise<TResult>;
}

interface IngestCapableClient {
  from(table: string): IngestQueryBuilder;
}

function ingestTable(
  session: AuthenticatedSession,
  table: string,
): IngestQueryBuilder {
  return (session.supabase as unknown as IngestCapableClient).from(table);
}

/* -------------------------------------------------------------------------- */
/*                                 INGESTION                                  */
/* -------------------------------------------------------------------------- */

/**
 * Embeds a single chunk the caller owns.
 *
 * ORDER OF OPERATIONS IS THE SECURITY PROPERTY:
 *
 *   1. Verify the environment matches the schema.
 *   2. Resolve the caller's authorized documents — an allowlist.
 *   3. Read the chunk CONSTRAINED to that allowlist. A chunk outside it
 *      is indistinguishable from one that does not exist.
 *   4. Skip if a valid embedding already exists.
 *   5. Send content to the provider — only now, and only content that
 *      step 3 proved the caller owns.
 *   6. Write back, constrained by the SAME allowlist.
 *
 * Step 3 before step 5 is the whole point: content cannot reach the
 * provider unless a scoped query already returned it. There is no path
 * that reads a chunk by id alone.
 *
 * Step 6 re-applies the constraint rather than trusting step 3, because
 * an UPDATE keyed only on `id` would be an IDOR if the allowlist logic
 * above were ever refactored incorrectly. Belt and braces, plus RLS.
 *
 * `force` re-embeds a chunk that already has a vector. It is off by
 * default so ordinary calls cannot spend money re-doing settled work
 * (requirements I, J).
 */
export async function ingestChunk(
  session: AuthenticatedSession,
  client: EmbeddingClient,
  input: { chunkId: string; force?: boolean },
): Promise<IngestOutcome> {
  /* 1 — deployment sanity. Fails closed, before any spend. */
  const environment = verifyEnvironmentDimensions();

  if (!environment.ok) {
    console.error("SYRAVEN INGEST: refusing to embed.", {
      reason: environment.reason,
    });

    return {
      ok: false,
      failure: {
        kind: "MISCONFIGURED",
        clientMessage: "Embedding is not correctly configured.",
      },
    };
  }

  if (typeof input.chunkId !== "string" || input.chunkId.length === 0) {
    return { ok: false, failure: NOT_AUTHORIZED };
  }

  /* 2 — the allowlist, via the shared retrieval-side resolver. */
  const authorized = await resolveAuthorizedDocuments(session, null);

  if (!authorized.ok) {
    return {
      ok: false,
      failure: {
        kind: "WRITE_FAILED",
        clientMessage: "Embedding is temporarily unavailable.",
      },
    };
  }

  /*
   * An empty allowlist means NOTHING, never "no filter". Returning
   * early keeps `.in([])` from being emitted as an absent constraint —
   * the same hazard guarded in semantic.ts.
   */
  if (authorized.documentIds.length === 0) {
    return { ok: false, failure: NOT_AUTHORIZED };
  }

  /*
   * 3 — read the chunk, CONSTRAINED. The id alone is never sufficient.
   *
   * `embedding` is selected only to test for presence; it is never
   * returned to a caller and never logged (requirements 9, 10).
   */
  const chunkResult = await ingestTable(session, "ai_knowledge_chunks")
    .select("id, knowledge_document_id, content, embedding")
    .eq("id", input.chunkId)
    .in("knowledge_document_id", authorized.documentIds)
    .maybeSingle();

  if (chunkResult.error) {
    console.error("SYRAVEN INGEST: chunk read failed.", {
      userId: session.userId,
      error: chunkResult.error.message,
    });

    return {
      ok: false,
      failure: {
        kind: "WRITE_FAILED",
        clientMessage: "Embedding is temporarily unavailable.",
      },
    };
  }

  const chunk = chunkResult.data;

  /* Missing and unauthorized are the same answer, deliberately. */
  if (chunk === null) return { ok: false, failure: NOT_AUTHORIZED };

  /*
   * 4 — do not redo settled work.
   *
   * A non-null embedding is left alone unless `force` is set. This
   * bounds cost and, more importantly, means a retry storm cannot
   * rewrite a corpus.
   */
  if (chunk.embedding !== null && chunk.embedding !== undefined && input.force !== true) {
    return { ok: true, status: "skipped_existing", chunkId: input.chunkId };
  }

  const content = typeof chunk.content === "string" ? chunk.content : "";

  /*
   * COST CEILING (Phase 12 follow-up).
   *
   * Checked HERE, immediately before the provider call, rather than only
   * in the route. Embedding price scales with token count, and a chunk
   * far above normal size is more often a chunking bug than real
   * content. Enforcing it at this level means the ceiling holds for any
   * caller of ingestChunk, including a future batch runner that forgets
   * to pre-filter.
   *
   * `isWithinContentCeiling` also covers the empty/whitespace case, so
   * this single check replaces the previous emptiness test.
   */
  if (!isWithinContentCeiling(content)) {
    return {
      ok: false,
      failure: {
        kind: "INVALID_CONTENT",
        clientMessage: "This content cannot be indexed.",
      },
    };
  }

  /*
   * 5 — the provider call.
   *
   * `content` came from a query constrained by the allowlist, so this
   * is the only text that can reach a third party. Note that no branch
   * above this point reads content without that constraint.
   */
  const embedded = await embedText(client, content);

  if (!embedded.ok) {
    /*
     * PARTIAL-STATE PROTECTION. The provider failed, so NOTHING is
     * written. The chunk keeps whatever it had — no null-out, no
     * placeholder, no half-written vector. A later retry sees exactly
     * the state it saw before.
     */
    return {
      ok: false,
      failure: {
        kind: "PROVIDER_FAILED",
        clientMessage: embedded.error.clientMessage,
      },
    };
  }

  /*
   * 6 — write back, re-applying the SAME constraint.
   *
   * Model provenance goes in `metadata`, which already exists. Recording
   * which model produced a vector is what makes a future model change
   * detectable rather than silent — without it, vectors from different
   * models become indistinguishable and mutually incomparable.
   */
  const existingMetadata =
    typeof chunk.metadata === "object" && chunk.metadata !== null
      ? (chunk.metadata as Record<string, unknown>)
      : {};

  const updateResult = await ingestTable(session, "ai_knowledge_chunks")
    .update({
      embedding: serializeEmbedding(embedded.embedding),
      metadata: {
        ...existingMetadata,
        embedding_model: embedded.modelId,
        embedded_at: new Date().toISOString(),
      },
    })
    .eq("id", input.chunkId)
    .in("knowledge_document_id", authorized.documentIds)
    .select("id")
    .maybeSingle();

  if (updateResult.error) {
    console.error("SYRAVEN INGEST: embedding write failed.", {
      userId: session.userId,
      error: updateResult.error.message,
    });

    return {
      ok: false,
      failure: {
        kind: "WRITE_FAILED",
        clientMessage: "The embedding could not be saved.",
      },
    };
  }

  /*
   * No row updated means the constraint rejected it between read and
   * write. Reported as unauthorized, not as success.
   */
  if (updateResult.data === null) {
    return { ok: false, failure: NOT_AUTHORIZED };
  }

  return { ok: true, status: "embedded", chunkId: input.chunkId };
}

/* -------------------------------------------------------------------------- */
/*                            PENDING WORK LOOKUP                             */
/* -------------------------------------------------------------------------- */

/**
 * Lists the caller's chunks that have no embedding yet.
 *
 * A read-only planning primitive: it tells an operator how much work
 * exists WITHOUT doing any of it and without spending anything. It is
 * scoped by the same allowlist, so it cannot report on another tenant's
 * backlog — a count is itself information about a corpus.
 *
 * `content` is deliberately NOT selected. The caller is choosing what to
 * embed, not reading documents, and returning bodies here would widen
 * the blast radius of a mistake for no benefit.
 */
export async function listPendingChunks(
  session: AuthenticatedSession,
  options: { limit: number },
): Promise<{ ok: true; chunkIds: string[] } | { ok: false }> {
  const authorized = await resolveAuthorizedDocuments(session, null);

  if (!authorized.ok) return { ok: false };

  if (authorized.documentIds.length === 0) {
    return { ok: true, chunkIds: [] };
  }

  const bounded = Math.min(Math.max(Math.trunc(options.limit), 1), 100);

  const result = await ingestTable(session, "ai_knowledge_chunks")
    .select("id")
    .in("knowledge_document_id", authorized.documentIds)
    .is("embedding", null)
    .limit(bounded);

  if (result.error) {
    console.error("SYRAVEN INGEST: pending lookup failed.", {
      userId: session.userId,
      error: result.error.message,
    });
    return { ok: false };
  }

  const chunkIds: string[] = [];

  for (const row of result.data ?? []) {
    if (typeof row !== "object" || row === null) continue;

    const id = (row as Record<string, unknown>).id;
    if (typeof id === "string" && id.length > 0) chunkIds.push(id);
  }

  return { ok: true, chunkIds };
}
