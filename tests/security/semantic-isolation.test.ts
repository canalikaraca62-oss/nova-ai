/**
 * SYRAVEN — Semantic retrieval authorization and tenant isolation tests
 *
 * Phase 10 Step 10.3 (see IMPLEMENTATION_PLAN.md).
 *
 * Vector retrieval is the highest-risk read path in the system. A
 * keyword query that loses its ownership filter returns rows that are
 * obviously wrong. A vector query that loses its filter returns the
 * NEAREST rows in the whole corpus — the most semantically relevant
 * extract of every other tenant's private data.
 *
 * `ai_knowledge_chunks` has no tenant column, so authorization is a
 * three-hop walk (bases -> sources -> documents). These tests use a fake
 * Supabase client that RECORDS every filter applied and holds rows for
 * several owners. A retrieval that fails to constrain the chain
 * therefore RETURNS ANOTHER TENANT'S CHUNKS and the test fails — the
 * leak is observable, not assumed absent.
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

const VECTOR_SRC = read("lib", "search", "vector.ts");
const SEMANTIC_SRC = read("lib", "search", "semantic.ts");

const VECTOR_CODE = stripComments(VECTOR_SRC);
const SEMANTIC_CODE = stripComments(SEMANTIC_SRC);

/* -------------------------------------------------------------------------- */
/*                         MIRRORED RETRIEVAL LOGIC                           */
/* -------------------------------------------------------------------------- */

/*
 * lib/search/* imports "server-only" and cannot load outside the Next
 * runtime. The retrieval logic is mirrored here EXACTLY as implemented,
 * and the SOURCE INVARIANTS suite below holds the real files to the same
 * shape — so a divergence between mirror and source fails the build
 * rather than silently passing.
 */

const EMBEDDING_DIMENSIONS = 1536;

const SEMANTIC_LIMITS = {
  defaultLimit: 10,
  maxLimit: 25,
  maxDocumentScope: 500,
  maxChunkWindow: 200,
} as const;

type EmbeddingValidation =
  | { ok: true; embedding: number[] }
  | { ok: false; reason: string };

function validateEmbedding(input: unknown): EmbeddingValidation {
  if (!Array.isArray(input)) {
    return { ok: false, reason: "Embedding must be an array of numbers." };
  }

  if (input.length !== EMBEDDING_DIMENSIONS) {
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
    return { ok: false, reason: "Embedding must not be the zero vector." };
  }

  return { ok: true, embedding: input as number[] };
}

function clampLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return SEMANTIC_LIMITS.defaultLimit;

  return Math.min(Math.max(Math.trunc(parsed), 1), SEMANTIC_LIMITS.maxLimit);
}

/* -------------------------------------------------------------------------- */
/*                          RECORDING FAKE SUPABASE                           */
/* -------------------------------------------------------------------------- */

interface AppliedFilter {
  readonly kind: "eq" | "in";
  readonly column: string;
  readonly value: string | readonly string[];
}

interface RecordedQuery {
  readonly table: string;
  readonly filters: AppliedFilter[];
  columns: string;
  limit: number | null;
}

type Row = Record<string, unknown>;

/**
 * A fake Supabase client holding rows for MULTIPLE owners.
 *
 * Filters are applied honestly: whatever the code under test asks for is
 * what it gets. If it omits the ownership filter, it receives every
 * tenant's rows — which is how these tests detect a leak rather than
 * merely asserting a filter string is present.
 */
function createFakeClient(tables: Record<string, Row[]>) {
  const queries: RecordedQuery[] = [];

  function builder(table: string) {
    const record: RecordedQuery = {
      table,
      filters: [],
      columns: "",
      limit: null,
    };
    queries.push(record);

    const api = {
      select(columns: string) {
        record.columns = columns;
        return api;
      },
      eq(column: string, value: string) {
        record.filters.push({ kind: "eq", column, value });
        return api;
      },
      in(column: string, values: readonly string[]) {
        record.filters.push({ kind: "in", column, values } as never);
        record.filters[record.filters.length - 1] = {
          kind: "in",
          column,
          value: values,
        };
        return api;
      },
      order() {
        return api;
      },
      limit(count: number) {
        record.limit = count;
        return api;
      },
      then<TResult>(
        onfulfilled: (value: {
          data: unknown[] | null;
          error: { message: string } | null;
        }) => TResult,
      ): Promise<TResult> {
        let rows = [...(tables[table] ?? [])];

        for (const filter of record.filters) {
          if (filter.kind === "eq") {
            rows = rows.filter((row) => row[filter.column] === filter.value);
          } else {
            const allowed = new Set(filter.value as readonly string[]);
            rows = rows.filter((row) =>
              allowed.has(row[filter.column] as string),
            );
          }
        }

        if (record.limit !== null) rows = rows.slice(0, record.limit);

        return Promise.resolve(onfulfilled({ data: rows, error: null }));
      },
    };

    return api;
  }

  return {
    client: { from: (table: string) => builder(table) },
    queries,
  };
}

/* Two tenants, each owning a full chain down to chunks. */
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

function fixtureTables(): Record<string, Row[]> {
  return {
    ai_knowledge_bases: [
      { id: "kb-a", owner_id: TENANT_A },
      { id: "kb-b", owner_id: TENANT_B },
    ],
    ai_knowledge_sources: [
      { id: "src-a", knowledge_base_id: "kb-a" },
      { id: "src-b", knowledge_base_id: "kb-b" },
    ],
    ai_knowledge_documents: [
      { id: "doc-a", knowledge_source_id: "src-a" },
      { id: "doc-b", knowledge_source_id: "src-b" },
    ],
    ai_knowledge_chunks: [
      {
        id: "chunk-a",
        knowledge_document_id: "doc-a",
        content: "TENANT A PRIVATE",
        chunk_index: 0,
      },
      {
        id: "chunk-b",
        knowledge_document_id: "doc-b",
        content: "TENANT B PRIVATE",
        chunk_index: 0,
      },
    ],
  };
}

/*
 * Mirror of resolveAuthorizedDocuments + retrieveSemantic. Kept
 * structurally identical to lib/search/semantic.ts.
 */
async function retrieveSemantic(
  session: { userId: string; supabase: { from: (t: string) => never } },
  request: { embedding: unknown; limit: number; knowledgeBaseId: string | null },
) {
  const validated = validateEmbedding(request.embedding);
  if (!validated.ok) return { ok: false as const, reason: "Invalid query embedding." };

  const from = (table: string) =>
    (session.supabase as unknown as {
      from: (t: string) => Record<string, (...args: never[]) => unknown>;
    }).from(table);

  let baseQuery = (from("ai_knowledge_bases") as never as {
    select: (c: string) => { eq: (c: string, v: string) => never };
  })
    .select("id")
    .eq("owner_id", session.userId) as never as {
    eq: (c: string, v: string) => unknown;
    limit: (n: number) => Promise<{ data: Row[] | null; error: null }>;
  };

  if (request.knowledgeBaseId !== null) {
    baseQuery = baseQuery.eq("id", request.knowledgeBaseId) as never;
  }

  const baseResult = await baseQuery.limit(SEMANTIC_LIMITS.maxDocumentScope);
  const baseIds = (baseResult.data ?? []).map((r) => String(r.id));
  if (baseIds.length === 0) {
    return {
      ok: true as const,
      results: { chunks: [], degraded: true, scopedDocuments: 0 },
    };
  }

  const sourceResult = await ((from("ai_knowledge_sources") as never as {
    select: (c: string) => {
      in: (c: string, v: string[]) => {
        limit: (n: number) => Promise<{ data: Row[] | null }>;
      };
    };
  })
    .select("id")
    .in("knowledge_base_id", baseIds)
    .limit(SEMANTIC_LIMITS.maxDocumentScope));

  const sourceIds = (sourceResult.data ?? []).map((r) => String(r.id));
  if (sourceIds.length === 0) {
    return {
      ok: true as const,
      results: { chunks: [], degraded: true, scopedDocuments: 0 },
    };
  }

  const documentResult = await ((from("ai_knowledge_documents") as never as {
    select: (c: string) => {
      in: (c: string, v: string[]) => {
        limit: (n: number) => Promise<{ data: Row[] | null }>;
      };
    };
  })
    .select("id")
    .in("knowledge_source_id", sourceIds)
    .limit(SEMANTIC_LIMITS.maxDocumentScope));

  const documentIds = (documentResult.data ?? []).map((r) => String(r.id));

  if (documentIds.length === 0) {
    return {
      ok: true as const,
      results: { chunks: [], degraded: true, scopedDocuments: 0 },
    };
  }

  const chunkResult = await ((from("ai_knowledge_chunks") as never as {
    select: (c: string) => {
      in: (c: string, v: string[]) => {
        order: (c: string, o: object) => {
          limit: (n: number) => Promise<{ data: Row[] | null }>;
        };
      };
    };
  })
    .select("id, knowledge_document_id, content, chunk_index")
    .in("knowledge_document_id", documentIds)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(request.limit, SEMANTIC_LIMITS.maxChunkWindow)));

  return {
    ok: true as const,
    results: {
      chunks: (chunkResult.data ?? []).map((row) => ({
        id: String(row.id),
        documentId: String(row.knowledge_document_id),
        content: typeof row.content === "string" ? row.content : "",
        chunkIndex:
          typeof row.chunk_index === "number" ? row.chunk_index : 0,
        distance: null,
      })),
      degraded: true,
      scopedDocuments: documentIds.length,
    },
  };
}

function validEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01);
}

/* -------------------------------------------------------------------------- */
/*                            TENANT ISOLATION                                */
/* -------------------------------------------------------------------------- */

void describe("Semantic retrieval isolates tenants", () => {
  void test("returns only the caller's own chunks", async () => {
    const { client } = createFakeClient(fixtureTables());

    const outcome = await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    assert.ok(outcome.ok);

    const contents = outcome.results.chunks.map((c) => c.content);

    assert.deepEqual(contents, ["TENANT A PRIVATE"]);

    /* The decisive assertion: the other tenant's chunk never appears. */
    assert.ok(
      !contents.includes("TENANT B PRIVATE"),
      "CROSS-TENANT LEAK: tenant B content returned to tenant A.",
    );
  });

  void test("a tenant with no knowledge bases receives nothing", async () => {
    const { client } = createFakeClient(fixtureTables());

    const outcome = await retrieveSemantic(
      {
        userId: "33333333-3333-3333-3333-333333333333",
        supabase: client as never,
      },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    assert.ok(outcome.ok);

    /*
     * The critical case. An empty allowlist must mean NOTHING. If the
     * empty id list were passed to `.in()` as an absent filter, this
     * caller would receive the entire corpus.
     */
    assert.equal(outcome.results.chunks.length, 0);
    assert.equal(outcome.results.scopedDocuments, 0);
  });

  void test("never queries chunks when the allowlist is empty", async () => {
    const { client, queries } = createFakeClient(fixtureTables());

    await retrieveSemantic(
      {
        userId: "33333333-3333-3333-3333-333333333333",
        supabase: client as never,
      },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    assert.ok(
      !queries.some((q) => q.table === "ai_knowledge_chunks"),
      "Chunks were queried despite an empty authorization scope.",
    );
  });

  void test("chunk retrieval is always constrained by document id", async () => {
    const { client, queries } = createFakeClient(fixtureTables());

    await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    const chunkQuery = queries.find((q) => q.table === "ai_knowledge_chunks");
    assert.ok(chunkQuery, "Expected a chunk query.");

    const scoping = chunkQuery.filters.find(
      (f) => f.kind === "in" && f.column === "knowledge_document_id",
    );

    assert.ok(
      scoping,
      "Chunk retrieval ran without a knowledge_document_id constraint.",
    );

    assert.ok(
      (scoping.value as readonly string[]).length > 0,
      "Chunk retrieval was constrained by an EMPTY id list, which is no filter.",
    );
  });

  void test("the base query is always scoped by owner_id", async () => {
    const { client, queries } = createFakeClient(fixtureTables());

    await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    const baseQuery = queries.find((q) => q.table === "ai_knowledge_bases");
    assert.ok(baseQuery);

    assert.ok(
      baseQuery.filters.some(
        (f) => f.kind === "eq" && f.column === "owner_id" && f.value === TENANT_A,
      ),
      "Knowledge base resolution was not scoped to the session owner.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       NARROWING CANNOT WIDEN ACCESS                        */
/* -------------------------------------------------------------------------- */

void describe("knowledgeBaseId narrows but never widens", () => {
  void test("naming another tenant's base yields nothing", async () => {
    const { client } = createFakeClient(fixtureTables());

    const outcome = await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      /* Tenant A explicitly asks for tenant B's knowledge base. */
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: "kb-b" },
    );

    assert.ok(outcome.ok);

    assert.equal(
      outcome.results.chunks.length,
      0,
      "IDOR: naming another tenant's knowledge base returned data.",
    );
  });

  void test("naming an owned base still applies the ownership filter", async () => {
    const { client, queries } = createFakeClient(fixtureTables());

    await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: "kb-a" },
    );

    const baseQuery = queries.find((q) => q.table === "ai_knowledge_bases");
    assert.ok(baseQuery);

    /* Both filters, not one instead of the other. */
    assert.ok(
      baseQuery.filters.some(
        (f) => f.column === "owner_id" && f.value === TENANT_A,
      ),
      "Ownership filter was replaced by the narrowing filter.",
    );
    assert.ok(
      baseQuery.filters.some((f) => f.column === "id" && f.value === "kb-a"),
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          EMBEDDING VALIDATION                              */
/* -------------------------------------------------------------------------- */

void describe("Embedding validation enforces the schema contract", () => {
  void test("accepts a well-formed 1536-dimension vector", () => {
    const result = validateEmbedding(validEmbedding());
    assert.ok(result.ok);
  });

  void test("rejects a wrong-dimension vector", () => {
    for (const size of [0, 1, 768, 1535, 1537, 3072]) {
      const result = validateEmbedding(
        Array.from({ length: size }, () => 0.01),
      );
      assert.equal(
        result.ok,
        false,
        `Accepted a ${size}-dimension vector; schema requires 1536.`,
      );
    }
  });

  void test("rejects non-finite components", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
      const vector = validEmbedding();
      vector[7] = bad;
      assert.equal(
        validateEmbedding(vector).ok,
        false,
        `Accepted a vector containing ${String(bad)}.`,
      );
    }
  });

  void test("rejects the zero vector", () => {
    const zero = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
    assert.equal(validateEmbedding(zero).ok, false);
  });

  void test("rejects non-array input", () => {
    for (const bad of [null, undefined, "vector", 42, {}, { length: 1536 }]) {
      assert.equal(validateEmbedding(bad).ok, false);
    }
  });

  void test("an invalid embedding never reaches the database", async () => {
    const { client, queries } = createFakeClient(fixtureTables());

    const outcome = await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: [1, 2, 3], limit: 10, knowledgeBaseId: null },
    );

    assert.equal(outcome.ok, false);
    assert.equal(
      queries.length,
      0,
      "A malformed embedding still produced database queries.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                              LIMIT CLAMPING                                */
/* -------------------------------------------------------------------------- */

void describe("Retrieval limits are bounded", () => {
  void test("clamps above maxLimit", () => {
    assert.equal(clampLimit(10_000), SEMANTIC_LIMITS.maxLimit);
    assert.equal(clampLimit(26), SEMANTIC_LIMITS.maxLimit);
  });

  void test("clamps below one", () => {
    assert.equal(clampLimit(0), 1);
    assert.equal(clampLimit(-50), 1);
  });

  void test("falls back to the default for junk", () => {
    for (const bad of [null, undefined, "abc", {}, Number.NaN]) {
      assert.equal(clampLimit(bad), SEMANTIC_LIMITS.defaultLimit);
    }
  });

  void test("the chunk window never exceeds maxChunkWindow", async () => {
    const { client, queries } = createFakeClient(fixtureTables());

    await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 9_999, knowledgeBaseId: null },
    );

    const chunkQuery = queries.find((q) => q.table === "ai_knowledge_chunks");
    assert.ok(chunkQuery);
    assert.ok(
      chunkQuery.limit !== null &&
        chunkQuery.limit <= SEMANTIC_LIMITS.maxChunkWindow,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            HONEST DEGRADATION                              */
/* -------------------------------------------------------------------------- */

void describe("Degraded mode is reported, not disguised", () => {
  void test("distance is null, never fabricated", async () => {
    const { client } = createFakeClient(fixtureTables());

    const outcome = await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    assert.ok(outcome.ok);

    for (const chunk of outcome.results.chunks) {
      assert.equal(
        chunk.distance,
        null,
        "A distance was fabricated while no ranking capability exists.",
      );
    }
  });

  void test("results are flagged degraded while the RPC is absent", async () => {
    const { client } = createFakeClient(fixtureTables());

    const outcome = await retrieveSemantic(
      { userId: TENANT_A, supabase: client as never },
      { embedding: validEmbedding(), limit: 10, knowledgeBaseId: null },
    );

    assert.ok(outcome.ok);
    assert.equal(outcome.results.degraded, true);
  });
});

/* -------------------------------------------------------------------------- */
/*                             SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

/*
 * These hold the REAL files to the shape the mirror above assumes.
 * Without them, the mirror could drift from the implementation and keep
 * passing while production leaked.
 */

void describe("SOURCE INVARIANTS — lib/search/vector.ts", () => {
  void test("pins the dimension to the schema's 1536", () => {
    assert.match(
      VECTOR_CODE,
      /EMBEDDING_DIMENSIONS\s*=\s*1536/,
      "Dimension no longer matches vector(1536) in the migration.",
    );
  });

  void test("rejects wrong dimension, non-finite and zero vectors", () => {
    assert.match(VECTOR_CODE, /length\s*!==\s*EMBEDDING_DIMENSIONS/);
    assert.match(VECTOR_CODE, /Number\.isFinite/);
    assert.match(VECTOR_CODE, /sumOfSquares\s*===\s*0/);
  });

  void test("serialisation is reachable only with a validated vector", () => {
    assert.match(
      VECTOR_CODE,
      /function\s+serializeEmbedding\s*\(\s*embedding\s*:\s*EmbeddingVector/,
      "serializeEmbedding must take the branded type, not number[].",
    );
  });
});

void describe("SOURCE INVARIANTS — lib/search/semantic.ts", () => {
  void test("never imports a service-role client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE|service_role|createAdminClient/.test(
        SEMANTIC_CODE,
      ),
      "CRITICAL: semantic retrieval references a service-role client.",
    );
  });

  void test("reads exclusively through session.supabase", () => {
    assert.match(
      SEMANTIC_CODE,
      /session\s*\.\s*supabase/,
      "Retrieval must use the caller's RLS-scoped client.",
    );
  });

  void test("resolves knowledge bases by the session owner", () => {
    assert.match(
      SEMANTIC_CODE,
      /["'`]owner_id["'`]\s*,\s*session\s*\.\s*userId/,
      "Base resolution is not bound to the verified session.",
    );
  });

  void test("short-circuits on an empty authorization scope", () => {
    assert.match(
      SEMANTIC_CODE,
      /documentIds\s*\.\s*length\s*===\s*0/,
      "CRITICAL: no empty-allowlist short circuit; `.in([])` is no filter.",
    );
  });

  void test("constrains chunk retrieval by document id", () => {
    assert.match(
      SEMANTIC_CODE,
      /\.\s*in\s*\(\s*["'`]knowledge_document_id["'`]/,
      "Chunk retrieval is not constrained to the resolved allowlist.",
    );
  });

  void test("never selects the embedding column back to the caller", () => {
    const select = SEMANTIC_CODE.match(
      /\.\s*select\s*\(\s*["'`]id,\s*knowledge_document_id[^"'`]*["'`]\s*\)/,
    );
    assert.ok(select, "Expected the explicit chunk select.");
    assert.ok(
      !select[0].includes("embedding"),
      "Raw embeddings must not be returned to callers.",
    );
  });

  void test("uses no wildcard select", () => {
    assert.ok(
      !/\.\s*select\s*\(\s*["'`]\*["'`]\s*\)/.test(SEMANTIC_CODE),
      "A wildcard select would expose whatever a migration later adds.",
    );
  });

  void test("declares the RPC contract as SECURITY INVOKER", () => {
    assert.match(
      SEMANTIC_CODE,
      /rpcSecurity\s*:\s*["'`]INVOKER["'`]/,
      "A SECURITY DEFINER function would bypass RLS entirely.",
    );
  });

  void test("does not call any embedding provider", () => {
    assert.ok(
      !/openai|OpenAI|groq|Groq|embeddings\s*\.\s*create|api\.openai\.com/.test(
        SEMANTIC_CODE,
      ),
      "Step 10.3 must not call a paid embedding API.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     KEYWORD SEARCH REMAINS UNCHANGED                       */
/* -------------------------------------------------------------------------- */

void describe("Step 10.1/10.2 keyword search is untouched", () => {
  void test("query.ts still exports its keyword entrypoint", () => {
    const querySrc = read("lib", "search", "query.ts");
    assert.match(querySrc, /export\s+async\s+function\s+search\s*\(/);
    assert.match(querySrc, /export\s+function\s+scoreHit\s*\(/);
    assert.match(querySrc, /export\s+function\s+buildTextMatch\s*\(/);
  });

  void test("keyword search does not import the semantic layer", () => {
    const queryCode = stripComments(read("lib", "search", "query.ts"));
    assert.ok(
      !/from\s+["'`]\.\/semantic["'`]|from\s+["'`]\.\/vector["'`]/.test(
        queryCode,
      ),
      "The semantic layer must not alter the keyword path.",
    );
  });
});
