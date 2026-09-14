/**
 * SYRAVEN — search the Brain by meaning
 * app/api/knowledge/semantic/route.ts
 *
 * POST { query, limit? } -> the caller's records closest in meaning.
 *
 * The query is embedded by the real provider and ranked by the
 * database (match_knowledge_chunks, SECURITY INVOKER, on the caller's
 * client). Nothing here scores anything: every similarity returned is
 * the number the database computed, or null when ranking was
 * unavailable -- and then `degraded` says so.
 *
 * When no provider is configured the answer is 503, not an empty list.
 * "Nothing matched" and "nothing was searched" must not look alike.
 *
 * WHAT A RESULT IS
 *
 * One entry per RECORD, carrying its best-matching passage. A result is
 * only returned while the record still exists and is the caller's: a
 * passage whose record has since been deleted is dropped here even if
 * its index removal failed, so a deletion is never contradicted by
 * search.
 */

import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { embedText } from "@/lib/search/embedding";
import { createOpenAiEmbeddingClient } from "@/lib/search/openaiEmbedding";
import { retrieveSemantic, SEMANTIC_LIMITS } from "@/lib/search/semantic";
import { checkRateLimit, recordRateLimitEvent } from "@/lib/usage/meter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_KEY = "embedding:query";
const MAX_QUERY_LENGTH = 500;
const DEFAULT_LIMIT = 8;
const EXCERPT_LENGTH = 280;

function errorResponse(
  code: string,
  message: string,
  status: number,
  retryAfterSeconds?: number,
) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    {
      status,
      ...(retryAfterSeconds !== undefined
        ? { headers: { "Retry-After": String(retryAfterSeconds) } }
        : {}),
    },
  );
}

function clampLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), SEMANTIC_LIMITS.maxLimit);
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();

  return flat.length > EXCERPT_LENGTH
    ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : flat;
}

export const POST = withAuth(async (request, session) => {
  const body = (await request.json().catch(() => null)) as {
    query?: unknown;
    limit?: unknown;
  } | null;

  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (query.length === 0 || query.length > MAX_QUERY_LENGTH) {
    return errorResponse(
      "INVALID_QUERY",
      `Ask in 1 to ${MAX_QUERY_LENGTH} characters.`,
      400,
    );
  }

  const limit = clampLimit(body?.limit);

  const rate = await checkRateLimit(session.supabase, session.userId, RATE_KEY);

  if (!rate.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      "Too many searches by meaning. Please wait a minute.",
      429,
      rate.retryAfterSeconds,
    );
  }

  const client = createOpenAiEmbeddingClient();

  if (client === null) {
    return errorResponse(
      "SEMANTIC_UNAVAILABLE",
      "Search by meaning is not configured on this deployment.",
      503,
    );
  }

  /* Recorded before the paid call, so an aborted request still counts. */
  await recordRateLimitEvent(session.supabase, session.userId, RATE_KEY);

  const embedded = await embedText(client, query);

  if (!embedded.ok) {
    return errorResponse("PROVIDER_FAILED", embedded.error.clientMessage, 502);
  }

  const outcome = await retrieveSemantic(session, {
    embedding: embedded.embedding,
    limit,
    knowledgeBaseId: null,
  });

  if (!outcome.ok) {
    return errorResponse(
      "RETRIEVAL_UNAVAILABLE",
      "Search by meaning is temporarily unavailable.",
      503,
    );
  }

  const { chunks, degraded, scopedDocuments } = outcome.results;

  if (chunks.length === 0) {
    return NextResponse.json({
      success: true,
      data: { results: [], degraded, scopedDocuments },
    });
  }

  /* Passage -> document -> record, each hop on the caller's client. */
  const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))];

  const documents = await session.supabase
    .from("ai_knowledge_documents")
    .select("id, external_id")
    .in("id", documentIds);

  if (documents.error) {
    console.error("SYRAVEN SEMANTIC SEARCH: document resolution failed.", {
      userId: session.userId,
      error: documents.error.message,
    });

    return errorResponse(
      "RETRIEVAL_UNAVAILABLE",
      "Search by meaning is temporarily unavailable.",
      503,
    );
  }

  const recordByDocument = new Map<string, string>();

  for (const row of documents.data ?? []) {
    if (typeof row.external_id === "string") {
      recordByDocument.set(row.id, row.external_id);
    }
  }

  const recordIds = [...new Set(recordByDocument.values())];

  const records =
    recordIds.length === 0
      ? { data: [] as { id: string; title: string }[], error: null }
      : await session.supabase
          .from("knowledge")
          .select("id, title")
          .in("id", recordIds)
          .eq("user_id", session.userId);

  if (records.error) {
    console.error("SYRAVEN SEMANTIC SEARCH: record resolution failed.", {
      userId: session.userId,
      error: records.error.message,
    });

    return errorResponse(
      "RETRIEVAL_UNAVAILABLE",
      "Search by meaning is temporarily unavailable.",
      503,
    );
  }

  const titleByRecord = new Map(
    (records.data ?? []).map((row) => [row.id, row.title] as const),
  );

  /*
   * Chunks arrive best-first from the ranking RPC, so the first passage
   * seen for a record is its best one.
   */
  const seen = new Set<string>();
  const results: {
    knowledgeId: string;
    title: string;
    excerpt: string;
    similarity: number | null;
  }[] = [];

  for (const chunk of chunks) {
    const knowledgeId = recordByDocument.get(chunk.documentId);
    if (knowledgeId === undefined || seen.has(knowledgeId)) continue;

    const title = titleByRecord.get(knowledgeId);
    if (title === undefined) continue;

    seen.add(knowledgeId);
    results.push({
      knowledgeId,
      title,
      excerpt: excerpt(chunk.content),
      similarity: chunk.similarity,
    });
  }

  return NextResponse.json({
    success: true,
    data: { results, degraded, scopedDocuments },
  });
});
