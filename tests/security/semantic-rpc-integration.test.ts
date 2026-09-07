/**
 * SYRAVEN — Semantic RPC integration tests
 *
 * Step 2 of the production-readiness sequence.
 *
 * `match_knowledge_chunks` is SECURITY INVOKER, so RLS filters candidate
 * rows inside the database and ranking happens only over rows the caller
 * may read. The application keeps `resolveAuthorizedDocuments()` as a
 * SECOND, independent layer on top of that.
 *
 * These tests exercise the integration's behaviour with a recording fake
 * client — what is sent to the RPC, what is done with what comes back,
 * and what `degraded` reports in each case.
 *
 * No database and no provider are touched. Cost: $0.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const SEMANTIC_SRC = read("lib", "search", "semantic.ts");
const SEMANTIC_CODE = stripComments(SEMANTIC_SRC);

const EMBEDDING_DIMENSIONS = 1536;

function validEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.02);
}

/* -------------------------------------------------------------------------- */
/*                          MIRRORED RPC INTEGRATION                          */
/* -------------------------------------------------------------------------- */

/*
 * lib/search/* is server-only. The RPC branch is mirrored with the same
 * order of operations; SOURCE INVARIANTS below hold the real file to it.
 */

interface RecordedRpc {
  name: string;
  args: Record<string, unknown>;
}

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  distance: number | null;
  similarity: number | null;
}

function createClient(behaviour: {
  rows?: Record<string, unknown>[];
  rpcError?: string;
}) {
  const calls: RecordedRpc[] = [];

  return {
    calls,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve(
        behaviour.rpcError
          ? { data: null, error: { message: behaviour.rpcError } }
          : { data: behaviour.rows ?? [], error: null },
      );
    },
  };
}

/** Mirror of retrieveSemantic's RPC branch. */
async function retrieveRanked(
  client: ReturnType<typeof createClient>,
  authorizedDocumentIds: string[],
  request: { limit: number; knowledgeBaseId: string | null },
): Promise<{
  chunks: Chunk[];
  degraded: boolean;
  scopedDocuments: number;
  droppedOutsideAllowlist: number;
}> {
  if (authorizedDocumentIds.length === 0) {
    return {
      chunks: [],
      degraded: true,
      scopedDocuments: 0,
      droppedOutsideAllowlist: 0,
    };
  }

  const ranked = await client.rpc("match_knowledge_chunks", {
    query_embedding: `[${validEmbedding().join(",")}]`,
    match_threshold: 0.5,
    match_count: request.limit,
    knowledge_base: request.knowledgeBaseId,
  });

  if (ranked.error) {
    /* Degraded fallback — not a failed request. */
    return {
      chunks: [],
      degraded: true,
      scopedDocuments: authorizedDocumentIds.length,
      droppedOutsideAllowlist: 0,
    };
  }

  const allowed = new Set(authorizedDocumentIds);
  const chunks: Chunk[] = [];
  let dropped = 0;

  for (const row of (ranked.data ?? []) as Record<string, unknown>[]) {
    const documentId = String(row.knowledge_document_id ?? "");

    if (!allowed.has(documentId)) {
      dropped += 1;
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
      chunkIndex: typeof row.chunk_index === "number" ? row.chunk_index : 0,
      distance: similarity === null ? null : 1 - similarity,
      similarity,
    });
  }

  return {
    chunks,
    degraded: false,
    scopedDocuments: authorizedDocumentIds.length,
    droppedOutsideAllowlist: dropped,
  };
}

function row(
  id: string,
  documentId: string,
  similarity: number,
  content = "chunk text",
) {
  return {
    id,
    knowledge_document_id: documentId,
    content,
    chunk_index: 0,
    similarity,
  };
}

/* -------------------------------------------------------------------------- */
/*                            THE RPC IS CALLED                               */
/* -------------------------------------------------------------------------- */

void describe("The ranking RPC is invoked correctly", () => {
  void test("calls match_knowledge_chunks", async () => {
    const client = createClient({ rows: [row("c1", "doc-a", 0.9)] });

    await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0]?.name, "match_knowledge_chunks");
  });

  void test("sends a 1536-dimension embedding literal", async () => {
    const client = createClient({ rows: [] });

    await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    const literal = String(client.calls[0]?.args.query_embedding);

    assert.ok(literal.startsWith("[") && literal.endsWith("]"));
    assert.equal(
      literal.slice(1, -1).split(",").length,
      EMBEDDING_DIMENSIONS,
      "The embedding literal must carry exactly 1536 components.",
    );
  });

  void test("passes the bounded limit as match_count", async () => {
    const client = createClient({ rows: [] });

    await retrieveRanked(client, ["doc-a"], {
      limit: 7,
      knowledgeBaseId: null,
    });

    assert.equal(client.calls[0]?.args.match_count, 7);
  });

  void test("passes a threshold inside [0,1]", async () => {
    const client = createClient({ rows: [] });

    await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    const threshold = Number(client.calls[0]?.args.match_threshold);

    assert.ok(threshold >= 0 && threshold <= 1, `threshold=${threshold}`);
  });

  void test("forwards the knowledge base narrowing", async () => {
    const client = createClient({ rows: [] });

    await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: "kb-a",
    });

    assert.equal(client.calls[0]?.args.knowledge_base, "kb-a");
  });

  void test("is not called when the allowlist is empty", async () => {
    const client = createClient({ rows: [row("c1", "doc-a", 0.9)] });

    const result = await retrieveRanked(client, [], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(
      client.calls.length,
      0,
      "A caller authorized for nothing must not reach the RPC.",
    );
    assert.equal(result.chunks.length, 0);
    assert.equal(result.degraded, true);
  });
});

/* -------------------------------------------------------------------------- */
/*                    INDEPENDENT AUTHORIZATION LAYER                         */
/* -------------------------------------------------------------------------- */

void describe("The allowlist filters RPC results independently", () => {
  void test("returns rows inside the allowlist", async () => {
    const client = createClient({
      rows: [row("c1", "doc-a", 0.95), row("c2", "doc-a", 0.80)],
    });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks.length, 2);
    assert.equal(result.droppedOutsideAllowlist, 0);
  });

  void test("drops a row outside the allowlist", async () => {
    /*
     * Simulates RLS and the allowlist disagreeing — an RLS regression,
     * or a mistaken SECURITY DEFINER conversion. The application layer
     * must still refuse the row.
     */
    const client = createClient({
      rows: [row("c1", "doc-a", 0.95), row("c2", "doc-OTHER", 0.99, "LEAK")],
    });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks.length, 1);
    assert.equal(result.droppedOutsideAllowlist, 1);

    assert.ok(
      !result.chunks.some((c) => c.content === "LEAK"),
      "CROSS-TENANT LEAK: a row outside the allowlist was returned.",
    );
  });

  void test("drops the higher-ranked foreign row, not the lower one", async () => {
    /*
     * The foreign row here is the MOST similar. If the filter were
     * applied before ranking, or skipped, the leak would be the single
     * most relevant result — the worst case for vector search.
     */
    const client = createClient({
      rows: [row("c2", "doc-OTHER", 0.99, "MOST RELEVANT LEAK"), row("c1", "doc-a", 0.5)],
    });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.deepEqual(result.chunks.map((c) => c.id), ["c1"]);
  });

  void test("a caller owning nothing gets nothing even if rows return", async () => {
    const client = createClient({ rows: [row("c1", "doc-a", 0.99)] });

    const result = await retrieveRanked(client, [], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks.length, 0);
  });
});

/* -------------------------------------------------------------------------- */
/*                          SIMILARITY AND DISTANCE                           */
/* -------------------------------------------------------------------------- */

void describe("Relevance values come from the database", () => {
  void test("similarity is passed through unchanged", async () => {
    const client = createClient({ rows: [row("c1", "doc-a", 0.875)] });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks[0]?.similarity, 0.875);
  });

  void test("distance is the exact complement of similarity", async () => {
    const client = createClient({ rows: [row("c1", "doc-a", 0.25)] });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks[0]?.distance, 0.75);
  });

  void test("a missing similarity yields null, never a fabricated number", async () => {
    const client = createClient({
      rows: [{ id: "c1", knowledge_document_id: "doc-a", content: "x", chunk_index: 0 }],
    });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks[0]?.similarity, null);
    assert.equal(
      result.chunks[0]?.distance,
      null,
      "A fabricated distance would present arbitrary ordering as relevance.",
    );
  });

  void test("a non-finite similarity is rejected", async () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const client = createClient({ rows: [row("c1", "doc-a", bad)] });

      const result = await retrieveRanked(client, ["doc-a"], {
        limit: 10,
        knowledgeBaseId: null,
      });

      assert.equal(result.chunks[0]?.similarity, null);
      assert.equal(result.chunks[0]?.distance, null);
    }
  });

  void test("no embedding vector is ever returned", async () => {
    const client = createClient({
      rows: [
        {
          ...row("c1", "doc-a", 0.9),
          /* Even if the RPC leaked one, the mapper must not carry it. */
          embedding: validEmbedding(),
        },
      ],
    });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.ok(
      !Object.hasOwn(result.chunks[0] ?? {}, "embedding"),
      "An embedding vector reached the caller.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          DEGRADED IS HONEST                                */
/* -------------------------------------------------------------------------- */

void describe("degraded reflects what actually happened", () => {
  void test("false only when the RPC succeeded", async () => {
    const client = createClient({ rows: [row("c1", "doc-a", 0.9)] });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.degraded, false);
  });

  void test("true when the RPC errors", async () => {
    const client = createClient({ rpcError: "function does not exist" });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(
      result.degraded,
      true,
      "A failed RPC must never be reported as ranked.",
    );
  });

  void test("an RPC failure does not fail the request", async () => {
    const client = createClient({ rpcError: "timeout" });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    /* Falls back rather than erroring the caller. */
    assert.equal(result.scopedDocuments, 1);
  });

  void test("true for an empty allowlist", async () => {
    const client = createClient({ rows: [] });

    const result = await retrieveRanked(client, [], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.degraded, true);
  });

  void test("false with zero ranked results is still ranked", async () => {
    /*
     * A successful RPC that matched nothing is NOT degraded: ranking
     * happened and legitimately found nothing above the threshold.
     */
    const client = createClient({ rows: [] });

    const result = await retrieveRanked(client, ["doc-a"], {
      limit: 10,
      knowledgeBaseId: null,
    });

    assert.equal(result.chunks.length, 0);
    assert.equal(result.degraded, false);
  });
});

/* -------------------------------------------------------------------------- */
/*                             SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

void describe("SOURCE INVARIANTS — lib/search/semantic.ts", () => {
  void test("the RPC runs on the caller's client", () => {
    const helper = SEMANTIC_CODE.slice(
      SEMANTIC_CODE.indexOf("function semanticRpc"),
      SEMANTIC_CODE.indexOf("VALIDATION"),
    );

    assert.match(helper, /session\s*\.\s*supabase/);
    assert.ok(
      !/supabaseAdmin|service_role|SUPABASE_SERVICE_ROLE/.test(SEMANTIC_CODE),
      "CRITICAL: service role must never serve user-scoped retrieval.",
    );
  });

  void test("the contract reports the capability as available", () => {
    assert.match(SEMANTIC_CODE, /rpcName:\s*["'`]match_knowledge_chunks["'`]/);
    assert.match(SEMANTIC_CODE, /rpcSecurity:\s*["'`]INVOKER["'`]/);
    assert.match(SEMANTIC_CODE, /available:\s*true/);
  });

  void test("the allowlist filter is applied to RPC rows", () => {
    assert.match(
      SEMANTIC_CODE,
      /new\s+Set\s*\(\s*authorized\.documentIds\s*\)/,
      "The independent authorization layer is missing.",
    );
    assert.match(SEMANTIC_CODE, /allowed\.has\s*\(\s*documentId\s*\)/);
  });

  void test("the empty-allowlist short circuit survives", () => {
    assert.match(SEMANTIC_CODE, /documentIds\s*\.\s*length\s*===\s*0/);
  });

  void test("degraded is not derived from the availability flag alone", () => {
    /*
     * The regression this prevents: `degraded: !RETRIEVAL_CONTRACT.available`
     * would report a FAILED RPC as ranked, because the capability exists
     * even when the call did not work.
     */
    assert.ok(
      !/degraded:\s*!RETRIEVAL_CONTRACT\.available/.test(SEMANTIC_CODE),
      "degraded must reflect the call outcome, not the capability flag.",
    );
  });

  void test("no application-side sorting of chunks", () => {
    assert.ok(
      !/\bchunks\s*\.\s*sort\s*\(|\brows\s*\.\s*sort\s*\(|rankedRows\s*\.\s*sort\s*\(/.test(
        SEMANTIC_CODE,
      ),
      "CRITICAL: ranking must happen in the database, not in Node.",
    );
  });

  void test("the degraded query still excludes the embedding column", () => {
    const select = SEMANTIC_CODE.match(
      /\.\s*select\s*\(\s*["'`]id,\s*knowledge_document_id[^"'`]*["'`]\s*\)/,
    );

    assert.ok(select);
    assert.ok(!select[0].includes("embedding"));
  });

  void test("keyword search is untouched", () => {
    const query = read("lib", "search", "query.ts");
    assert.match(query, /export\s+async\s+function\s+search\s*\(/);
    assert.ok(!/match_knowledge_chunks/.test(query));
  });
});
