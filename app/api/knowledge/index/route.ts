/**
 * SYRAVEN — index a Brain record for search by meaning
 * app/api/knowledge/index/route.ts
 *
 * GET   which of the caller's records are indexed. Free: no provider.
 * POST  { knowledgeId } -- index one record the caller owns. Paid.
 *
 * ORDER IN POST IS THE COST CONTROL
 *
 *   1. Validate the id shape -- nothing else is read from the body.
 *   2. Burst rate limit (embedding:ingest), before any other work.
 *   3. Refuse with 503 when no provider is configured, BEFORE anything
 *      is written. A deployment without a key must not accumulate
 *      passages that can never be embedded, and must say so rather than
 *      appear to index.
 *   4. Record the rate event, then hand over to the bridge, which proves
 *      ownership, applies the spend gate and embeds through ingestChunk.
 *
 * Identity comes from the verified session only. The body names a
 * record; whether the caller may index it is decided by the bridge's
 * user-scoped read, not by anything the caller sends.
 */

import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { INGEST_LIMITS } from "@/lib/search/ingestPolicy";
import {
  indexKnowledgeRecord,
  listIndexState,
} from "@/lib/search/knowledgeBridge";
import {
  createOpenAiEmbeddingClient,
  isEmbeddingConfigured,
} from "@/lib/search/openaiEmbedding";
import { checkRateLimit, recordRateLimitEvent } from "@/lib/usage/meter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export const GET = withAuth(async (_request, session) => {
  const state = await listIndexState(session);

  if (!state.ok) {
    return errorResponse(
      "INDEX_STATE_UNAVAILABLE",
      "Index status could not be loaded.",
      503,
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      /* Whether indexing can run here at all -- not a claim it has. */
      available: isEmbeddingConfigured(),
      records: state.records,
    },
  });
});

export const POST = withAuth(async (request, session) => {
  /* 1 */
  const body = (await request.json().catch(() => null)) as {
    knowledgeId?: unknown;
  } | null;

  const knowledgeId =
    typeof body?.knowledgeId === "string" ? body.knowledgeId.trim() : "";

  if (!UUID.test(knowledgeId)) {
    return errorResponse("INVALID_REQUEST", "A knowledge id is required.", 400);
  }

  /* 2 */
  const limit = await checkRateLimit(
    session.supabase,
    session.userId,
    INGEST_LIMITS.rateLimitKey,
  );

  if (!limit.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      "Too many indexing requests. Please wait a minute.",
      429,
      limit.retryAfterSeconds,
    );
  }

  /* 3 */
  const client = createOpenAiEmbeddingClient();

  if (client === null) {
    return errorResponse(
      "SEMANTIC_UNAVAILABLE",
      "Search by meaning is not configured on this deployment.",
      503,
    );
  }

  /* 4 */
  await recordRateLimitEvent(
    session.supabase,
    session.userId,
    INGEST_LIMITS.rateLimitKey,
  );

  const outcome = await indexKnowledgeRecord(session, client, knowledgeId);

  if (!outcome.ok) {
    return errorResponse(
      outcome.failure.kind,
      outcome.failure.clientMessage,
      outcome.failure.status,
      outcome.failure.retryAfterSeconds,
    );
  }

  return NextResponse.json({ success: true, data: outcome.progress });
});
