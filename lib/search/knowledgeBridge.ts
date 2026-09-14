/**
 * SYRAVEN — the bridge from Brain records to the semantic index
 * lib/search/knowledgeBridge.ts
 *
 * The Brain's records live in public.knowledge. Semantic retrieval reads
 * public.ai_knowledge_chunks, reached through
 *
 *   ai_knowledge_bases (owner_id) -> ai_knowledge_sources
 *     -> ai_knowledge_documents -> ai_knowledge_chunks
 *
 * and until this module nothing wrote that chain, so "search by meaning"
 * had nothing to search. This file writes it -- one base per user, one
 * source per record, one document per version of the record's text --
 * and hands the passages to the EXISTING ingestion path.
 *
 * WHAT IT DOES NOT DO ITSELF
 *
 * It never calls a provider and never writes a vector. Embedding goes
 * through `ingestChunk`, which re-proves ownership, applies the content
 * ceiling and validates the vector; spend is gated by
 * `enforceIngestPolicy` first. A second, looser path to the provider here
 * would be the easiest way to undo both.
 *
 * AUTHORIZATION
 *
 * Every query runs on `session.supabase`, the caller's RLS client. The
 * record is read with an explicit `user_id` filter before anything is
 * written, so a caller cannot index someone else's record by naming its
 * id; the ai_knowledge_* policies then scope every write to bases the
 * caller owns. No service role, anywhere.
 */

import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";

import type { EmbeddingClient } from "./embedding";
import { ingestChunk } from "./ingest";
import { enforceIngestPolicy, INGEST_LIMITS } from "./ingestPolicy";
import {
  BRAIN_BASE_SLUG,
  CHUNK_POLICY,
  chunkText,
  contentHash,
  indexableText,
} from "./knowledgeIndex";

/* -------------------------------------------------------------------------- */
/*                                  OUTCOMES                                  */
/* -------------------------------------------------------------------------- */

export type IndexFailureKind =
  | "NOT_FOUND"
  | "EMPTY"
  | "TOO_LARGE"
  | "DENIED"
  | "UNAVAILABLE";

export interface IndexFailure {
  readonly kind: IndexFailureKind;
  readonly clientMessage: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;
}

export interface IndexProgress {
  readonly knowledgeId: string;
  /** "indexed" only when no passage of the record is left without a vector. */
  readonly state: "indexed" | "partial";
  readonly chunks: number;
  /** Passages embedded by THIS call. Zero for an unchanged record. */
  readonly embeddedNow: number;
  /** Passages still without a vector; null if it could not be counted. */
  readonly remaining: number | null;
  /** Passages attempted by this call that were refused or failed. */
  readonly failed: number;
}

export type IndexOutcome =
  | { ok: true; progress: IndexProgress }
  | { ok: false; failure: IndexFailure };

export type IndexStatus = "indexed" | "partial" | "failed";

const UNAVAILABLE: IndexFailure = {
  kind: "UNAVAILABLE",
  clientMessage: "Indexing is temporarily unavailable.",
  status: 503,
};

const NOT_FOUND: IndexFailure = {
  kind: "NOT_FOUND",
  clientMessage: "Knowledge record not found.",
  status: 404,
};

function logFailure(
  session: AuthenticatedSession,
  step: string,
  message: string,
): void {
  console.error(`SYRAVEN BRAIN INDEX: ${step} failed.`, {
    userId: session.userId,
    error: message,
  });
}

/* -------------------------------------------------------------------------- */
/*                                 THE CHAIN                                  */
/* -------------------------------------------------------------------------- */

/** The caller's Brain base, created on first use. */
async function ensureBrainBase(
  session: AuthenticatedSession,
): Promise<string | null> {
  const db = session.supabase;

  const existing = await db
    .from("ai_knowledge_bases")
    .select("id")
    .eq("owner_id", session.userId)
    .eq("slug", BRAIN_BASE_SLUG)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    logFailure(session, "base lookup", existing.error.message);
    return null;
  }

  if (existing.data) return existing.data.id;

  const created = await db
    .from("ai_knowledge_bases")
    .insert({
      /* From the verified session, never from the request. */
      owner_id: session.userId,
      name: "Brain",
      slug: BRAIN_BASE_SLUG,
      description: "Search-by-meaning index of the records saved in the Brain.",
    })
    .select("id")
    .single();

  if (created.error) {
    logFailure(session, "base creation", created.error.message);
    return null;
  }

  return created.data.id;
}

/** The source standing for one knowledge record, created on first use. */
async function ensureSource(
  session: AuthenticatedSession,
  baseId: string,
  knowledgeId: string,
  title: string,
): Promise<string | null> {
  const db = session.supabase;

  const existing = await db
    .from("ai_knowledge_sources")
    .select("id")
    .eq("knowledge_base_id", baseId)
    .eq("source_type", "manual")
    .eq("external_id", knowledgeId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    logFailure(session, "source lookup", existing.error.message);
    return null;
  }

  if (existing.data) return existing.data.id;

  const created = await db
    .from("ai_knowledge_sources")
    .insert({
      knowledge_base_id: baseId,
      source_type: "manual",
      name: title.slice(0, 200),
      external_id: knowledgeId,
      status: "processing",
    })
    .select("id")
    .single();

  if (created.error) {
    logFailure(session, "source creation", created.error.message);
    return null;
  }

  return created.data.id;
}

/**
 * The document for the record's CURRENT text.
 *
 * Unchanged text (same hash, one document) is reused as it is, vectors
 * and all -- which is what makes re-indexing an unedited record free.
 * Anything else is rebuilt: the old documents are deleted (their chunks
 * cascade) so a search can never return a passage the record no longer
 * contains.
 *
 * If the passages cannot be written, the new document is removed again.
 * A document without its passages would match the hash on the next call
 * and be reused empty, and the record would look indexed while nothing
 * about it could be found.
 */
async function ensureDocument(
  session: AuthenticatedSession,
  sourceId: string,
  knowledgeId: string,
  title: string,
  hash: string,
  chunks: readonly string[],
): Promise<string | null> {
  const db = session.supabase;

  const existing = await db
    .from("ai_knowledge_documents")
    .select("id, content_hash")
    .eq("knowledge_source_id", sourceId);

  if (existing.error) {
    logFailure(session, "document lookup", existing.error.message);
    return null;
  }

  const rows = existing.data ?? [];
  const current = rows.find((row) => row.content_hash === hash);

  if (current && rows.length === 1) return current.id;

  if (rows.length > 0) {
    const cleared = await db
      .from("ai_knowledge_documents")
      .delete()
      .eq("knowledge_source_id", sourceId);

    if (cleared.error) {
      logFailure(session, "stale document removal", cleared.error.message);
      return null;
    }
  }

  const created = await db
    .from("ai_knowledge_documents")
    .insert({
      knowledge_source_id: sourceId,
      external_id: knowledgeId,
      title: title.slice(0, 500),
      /*
       * The text itself is not copied here. It already lives in
       * public.knowledge and, split, in the chunks; a third copy would
       * be one more place a deletion has to reach.
       */
      content: null,
      content_hash: hash,
      mime_type: "text/plain",
      status: "processing",
    })
    .select("id")
    .single();

  if (created.error) {
    logFailure(session, "document creation", created.error.message);
    return null;
  }

  const documentId = created.data.id;

  const inserted = await db.from("ai_knowledge_chunks").insert(
    chunks.map((content, index) => ({
      knowledge_document_id: documentId,
      chunk_index: index,
      content,
    })),
  );

  if (inserted.error) {
    logFailure(session, "passage write", inserted.error.message);

    const rollback = await db
      .from("ai_knowledge_documents")
      .delete()
      .eq("id", documentId);

    if (rollback.error) {
      logFailure(session, "empty document rollback", rollback.error.message);
    }

    return null;
  }

  return documentId;
}

/**
 * Records the outcome on the document and source rows.
 *
 * A summary for listing, not the truth: the truth is which chunks hold a
 * vector, and that is what `state` was computed from. A failure to write
 * the summary is logged and does not undo the embedding already paid for.
 */
async function recordState(
  session: AuthenticatedSession,
  documentId: string,
  sourceId: string,
  state: "indexed" | "partial",
  nothingSucceeded: boolean,
): Promise<void> {
  const db = session.supabase;
  const now = new Date().toISOString();

  const documentStatus =
    state === "indexed" ? "indexed" : nothingSucceeded ? "failed" : "processing";

  const sourceStatus =
    state === "indexed" ? "ready" : nothingSucceeded ? "failed" : "processing";

  const document = await db
    .from("ai_knowledge_documents")
    .update({ status: documentStatus, updated_at: now })
    .eq("id", documentId);

  if (document.error) {
    logFailure(session, "document status", document.error.message);
  }

  const source = await db
    .from("ai_knowledge_sources")
    .update({
      status: sourceStatus,
      updated_at: now,
      ...(state === "indexed" ? { last_synced_at: now } : {}),
    })
    .eq("id", sourceId);

  if (source.error) {
    logFailure(session, "source status", source.error.message);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  INDEXING                                  */
/* -------------------------------------------------------------------------- */

/**
 * Indexes one Brain record the caller owns.
 *
 * ORDER IS THE CONTROL:
 *
 *   1. Read the record CONSTRAINED to the caller. Nothing is written for
 *      a record the caller cannot read.
 *   2. Plan the passages. Empty or oversized text is refused before any
 *      write.
 *   3. Write the chain (base, source, document, passages) -- reusing it
 *      untouched when the text is unchanged.
 *   4. Pass the spend gate for the passages still without a vector.
 *   5. Embed them through ingestChunk, at most one batch per call.
 *   6. Count what is still missing, and report exactly that.
 *
 * A record longer than one batch is indexed across several calls; each
 * reports how many passages remain, rather than claiming a finished
 * index it does not have.
 *
 * The burst rate limit is the ROUTE's job, before this is called, as it
 * is for every other paid endpoint.
 */
export async function indexKnowledgeRecord(
  session: AuthenticatedSession,
  client: EmbeddingClient,
  knowledgeId: string,
): Promise<IndexOutcome> {
  const db = session.supabase;

  /* 1 */
  const record = await db
    .from("knowledge")
    .select("id, title, description, content")
    .eq("id", knowledgeId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (record.error) {
    logFailure(session, "record read", record.error.message);
    return { ok: false, failure: UNAVAILABLE };
  }

  if (!record.data) return { ok: false, failure: NOT_FOUND };

  /* 2 */
  const text = indexableText(record.data);
  const plan = chunkText(text);

  if (!plan.ok) {
    return {
      ok: false,
      failure:
        plan.reason === "EMPTY"
          ? {
              kind: "EMPTY",
              clientMessage: "This record has no text to index.",
              status: 422,
            }
          : {
              kind: "TOO_LARGE",
              clientMessage:
                `This record is too long to index: more than ` +
                `${CHUNK_POLICY.maxChunksPerRecord} passages.`,
              status: 413,
            },
    };
  }

  /* 3 */
  const baseId = await ensureBrainBase(session);
  if (baseId === null) return { ok: false, failure: UNAVAILABLE };

  const sourceId = await ensureSource(
    session,
    baseId,
    knowledgeId,
    record.data.title,
  );
  if (sourceId === null) return { ok: false, failure: UNAVAILABLE };

  const documentId = await ensureDocument(
    session,
    sourceId,
    knowledgeId,
    record.data.title,
    contentHash(text),
    plan.chunks,
  );
  if (documentId === null) return { ok: false, failure: UNAVAILABLE };

  const pending = await db
    .from("ai_knowledge_chunks")
    .select("id")
    .eq("knowledge_document_id", documentId)
    .is("embedding", null)
    .order("chunk_index", { ascending: true })
    .limit(INGEST_LIMITS.maxBatchSize);

  if (pending.error) {
    logFailure(session, "pending passage lookup", pending.error.message);
    return { ok: false, failure: UNAVAILABLE };
  }

  const pendingIds = (pending.data ?? []).map((row) => row.id);

  let embeddedNow = 0;
  let failed = 0;

  if (pendingIds.length > 0) {
    /* 4 */
    const policy = await enforceIngestPolicy(session, pendingIds.length);

    if (!policy.allowed) {
      return {
        ok: false,
        failure: {
          kind: "DENIED",
          clientMessage: policy.denial.clientMessage,
          status: policy.denial.status,
          ...(policy.denial.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: policy.denial.retryAfterSeconds }
            : {}),
        },
      };
    }

    /* 5 */
    for (const chunkId of pendingIds) {
      const outcome = await ingestChunk(session, client, { chunkId });

      if (!outcome.ok) failed += 1;
      else if (outcome.status === "embedded") embeddedNow += 1;
    }
  }

  /* 6 */
  const missing = await db
    .from("ai_knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("knowledge_document_id", documentId)
    .is("embedding", null);

  if (missing.error) {
    logFailure(session, "remaining passage count", missing.error.message);
  }

  const remaining = missing.error ? null : (missing.count ?? 0);
  const state = remaining === 0 ? "indexed" : "partial";

  await recordState(
    session,
    documentId,
    sourceId,
    state,
    failed > 0 && embeddedNow === 0,
  );

  return {
    ok: true,
    progress: {
      knowledgeId,
      state,
      chunks: plan.chunks.length,
      embeddedNow,
      remaining,
      failed,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  REMOVAL                                   */
/* -------------------------------------------------------------------------- */

/**
 * Removes a record from the semantic index.
 *
 * Called when the record is deleted, and when its text changes. Deleting
 * the source cascades to its documents and passages, so nothing of the
 * old text stays searchable.
 *
 * Scoped to bases the caller owns, on top of RLS. `removed: 0` is a
 * normal answer -- most records were never indexed.
 */
export async function removeKnowledgeIndex(
  session: AuthenticatedSession,
  knowledgeId: string,
): Promise<{ ok: true; removed: number } | { ok: false }> {
  const db = session.supabase;

  const bases = await db
    .from("ai_knowledge_bases")
    .select("id")
    .eq("owner_id", session.userId);

  if (bases.error) {
    logFailure(session, "base lookup for removal", bases.error.message);
    return { ok: false };
  }

  const baseIds = (bases.data ?? []).map((row) => row.id);

  /* No bases means nothing was ever indexed. Never an unscoped delete. */
  if (baseIds.length === 0) return { ok: true, removed: 0 };

  const removed = await db
    .from("ai_knowledge_sources")
    .delete()
    .eq("source_type", "manual")
    .eq("external_id", knowledgeId)
    .in("knowledge_base_id", baseIds)
    .select("id");

  if (removed.error) {
    logFailure(session, "index removal", removed.error.message);
    return { ok: false };
  }

  return { ok: true, removed: removed.data?.length ?? 0 };
}

/* -------------------------------------------------------------------------- */
/*                                   STATUS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which of the caller's records are in the index, and how completely.
 *
 * Read-only and free: no provider, no counting of anyone else's rows.
 * A record absent from the answer has never been indexed.
 */
export async function listIndexState(
  session: AuthenticatedSession,
): Promise<
  | { ok: true; records: { knowledgeId: string; status: IndexStatus; lastSyncedAt: string | null }[] }
  | { ok: false }
> {
  const db = session.supabase;

  const bases = await db
    .from("ai_knowledge_bases")
    .select("id")
    .eq("owner_id", session.userId)
    .eq("slug", BRAIN_BASE_SLUG);

  if (bases.error) {
    logFailure(session, "base lookup for status", bases.error.message);
    return { ok: false };
  }

  const baseIds = (bases.data ?? []).map((row) => row.id);

  if (baseIds.length === 0) return { ok: true, records: [] };

  const sources = await db
    .from("ai_knowledge_sources")
    .select("external_id, status, last_synced_at")
    .in("knowledge_base_id", baseIds)
    .eq("source_type", "manual")
    .limit(500);

  if (sources.error) {
    logFailure(session, "source status lookup", sources.error.message);
    return { ok: false };
  }

  const records: { knowledgeId: string; status: IndexStatus; lastSyncedAt: string | null }[] = [];

  for (const row of sources.data ?? []) {
    if (typeof row.external_id !== "string" || row.external_id.length === 0) {
      continue;
    }

    records.push({
      knowledgeId: row.external_id,
      status:
        row.status === "ready"
          ? "indexed"
          : row.status === "failed"
            ? "failed"
            : "partial",
      lastSyncedAt: row.last_synced_at,
    });
  }

  return { ok: true, records };
}
