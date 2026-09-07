/**
 * SYRAVEN — Embedding ingestion authorization and provider-input tests
 *
 * Phase 10 Step 10.4 (see IMPLEMENTATION_PLAN.md).
 *
 * Ingestion is a HIGHER risk than retrieval, and the difference is the
 * direction of the leak. A retrieval bug shows data to the wrong user
 * inside the system. An ingestion bug TRANSMITS document content to a
 * third-party provider, where it cannot be recalled.
 *
 * These tests therefore do not only assert that unauthorized ingestion
 * "fails". They record every payload handed to a fake provider and
 * assert that unauthorized content NEVER APPEARS IN IT. A control that
 * rejected the write but had already sent the text would pass a naive
 * test and fail these.
 *
 * NO PAID CALLS. Every embedding here is a deterministic fake produced
 * locally. Step 10.4 cost is $0.
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

const EMBEDDING_SRC = read("lib", "search", "embedding.ts");
const INGEST_SRC = read("lib", "search", "ingest.ts");

const EMBEDDING_CODE = stripComments(EMBEDDING_SRC);
const INGEST_CODE = stripComments(INGEST_SRC);

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

const EMBEDDING_DIMENSIONS = 1536;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const TENANT_C = "33333333-3333-3333-3333-333333333333";

/** A deterministic, valid fake vector. Never a provider call. */
function fakeEmbedding(seed = 0.02): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed);
}

/* -------------------------------------------------------------------------- */
/*                          RECORDING FAKE PROVIDER                           */
/* -------------------------------------------------------------------------- */

/**
 * An embedding client that RECORDS everything it is asked to embed.
 *
 * `seen` is the evidence for the central claim of this suite: that no
 * unauthorized content reaches a provider.
 */
function createFakeProvider(
  behaviour: {
    modelId?: string;
    returns?: readonly number[];
    throws?: Error;
    failTimes?: number;
  } = {},
) {
  const seen: string[] = [];
  let calls = 0;

  const client = {
    modelId: behaviour.modelId ?? "fake-embedding-model",
    async embed(input: { text: string; dimensions: number }) {
      calls += 1;
      seen.push(input.text);

      if (behaviour.throws && calls <= (behaviour.failTimes ?? Infinity)) {
        throw behaviour.throws;
      }

      return behaviour.returns ?? fakeEmbedding();
    },
  };

  return {
    client,
    seen,
    get calls() {
      return calls;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                        MIRRORED INGESTION PIPELINE                         */
/* -------------------------------------------------------------------------- */

/*
 * lib/search/* imports "server-only" and cannot load under node --test.
 * The pipeline is mirrored here with the SAME order of operations, and
 * the SOURCE INVARIANTS suite holds the real file to that shape.
 */

type Row = Record<string, unknown>;

function fixture(): Record<string, Row[]> {
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
        content: "TENANT A CONFIDENTIAL",
        embedding: null,
        metadata: {},
      },
      {
        id: "chunk-a-done",
        knowledge_document_id: "doc-a",
        content: "TENANT A ALREADY INDEXED",
        embedding: "[0.5,0.5]",
        metadata: { embedding_model: "prior-model" },
      },
      {
        id: "chunk-b",
        knowledge_document_id: "doc-b",
        content: "TENANT B CONFIDENTIAL",
        embedding: null,
        metadata: {},
      },
    ],
  };
}

function validateEmbedding(input: unknown): boolean {
  return (
    Array.isArray(input) &&
    input.length === EMBEDDING_DIMENSIONS &&
    input.every((c) => typeof c === "number" && Number.isFinite(c)) &&
    input.some((c) => c !== 0)
  );
}

interface IngestResult {
  ok: boolean;
  status?: string;
  kind?: string;
}

/** Mirror of ingestChunk. Order of operations matches ingest.ts. */
async function ingestChunk(
  data: Record<string, Row[]>,
  userId: string,
  provider: { client: { modelId: string; embed(i: { text: string; dimensions: number }): Promise<readonly number[]> } },
  input: { chunkId: string; force?: boolean },
): Promise<IngestResult> {
  /* 2 — allowlist via the ownership chain. */
  const baseIds = (data.ai_knowledge_bases ?? [])
    .filter((r) => r.owner_id === userId)
    .map((r) => String(r.id));

  const sourceIds = (data.ai_knowledge_sources ?? [])
    .filter((r) => baseIds.includes(String(r.knowledge_base_id)))
    .map((r) => String(r.id));

  const documentIds = (data.ai_knowledge_documents ?? [])
    .filter((r) => sourceIds.includes(String(r.knowledge_source_id)))
    .map((r) => String(r.id));

  if (documentIds.length === 0) return { ok: false, kind: "NOT_AUTHORIZED" };

  /* 3 — constrained read. Id alone is never sufficient. */
  const chunk =
    (data.ai_knowledge_chunks ?? []).find(
      (r) =>
        r.id === input.chunkId &&
        documentIds.includes(String(r.knowledge_document_id)),
    ) ?? null;

  if (chunk === null) return { ok: false, kind: "NOT_AUTHORIZED" };

  /* 4 — never redo settled work. */
  if (chunk.embedding !== null && chunk.embedding !== undefined && input.force !== true) {
    return { ok: true, status: "skipped_existing" };
  }

  const content = typeof chunk.content === "string" ? chunk.content : "";
  if (content.trim().length === 0) {
    return { ok: false, kind: "INVALID_CONTENT" };
  }

  /* 5 — provider call, with one retry. */
  let raw: readonly number[] | null = null;
  let attempt = 0;

  for (;;) {
    try {
      raw = await provider.client.embed({
        text: content,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      break;
    } catch {
      if (attempt >= 1) return { ok: false, kind: "PROVIDER_FAILED" };
      attempt += 1;
    }
  }

  /* Output validation BEFORE any write. */
  if (!validateEmbedding(raw)) {
    return { ok: false, kind: "PROVIDER_FAILED" };
  }

  /* 6 — write back, constrained again. */
  chunk.embedding = `[${(raw as number[]).join(",")}]`;
  chunk.metadata = {
    ...(typeof chunk.metadata === "object" && chunk.metadata !== null
      ? (chunk.metadata as Record<string, unknown>)
      : {}),
    embedding_model: provider.client.modelId,
    embedded_at: new Date().toISOString(),
  };

  return { ok: true, status: "embedded" };
}

/* -------------------------------------------------------------------------- */
/*                      UNAUTHORIZED CONTENT NEVER SENT                       */
/* -------------------------------------------------------------------------- */

void describe("Unauthorized documents never reach the provider", () => {
  void test("a cross-tenant chunk is refused", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    /* Tenant A tries to embed tenant B's chunk. */
    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-b",
    });

    assert.equal(result.ok, false);
    assert.equal(result.kind, "NOT_AUTHORIZED");
  });

  void test("cross-tenant content is NEVER transmitted", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    await ingestChunk(data, TENANT_A, provider, { chunkId: "chunk-b" });

    /*
     * The decisive assertion of this file. Refusing the write is not
     * enough — the text must never have left the process.
     */
    assert.equal(
      provider.calls,
      0,
      "EXFILTRATION: the provider was called for an unauthorized chunk.",
    );

    assert.ok(
      !provider.seen.some((t) => t.includes("TENANT B")),
      "EXFILTRATION: another tenant's content was sent to the provider.",
    );
  });

  void test("a tenant owning nothing cannot embed anything", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    for (const chunkId of ["chunk-a", "chunk-b", "chunk-a-done"]) {
      const result = await ingestChunk(data, TENANT_C, provider, { chunkId });
      assert.equal(result.ok, false);
    }

    assert.equal(
      provider.calls,
      0,
      "EXFILTRATION: provider called for a caller authorized for nothing.",
    );
  });

  void test("an unknown chunk id is refused without a provider call", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "00000000-0000-0000-0000-000000000000",
    });

    assert.equal(result.ok, false);
    assert.equal(provider.calls, 0);
  });

  void test("missing and unauthorized are indistinguishable", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    const missing = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "does-not-exist",
    });
    const foreign = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-b",
    });

    /*
     * Differing replies would make ingestion an existence oracle for
     * other tenants' chunk ids.
     */
    assert.equal(missing.kind, foreign.kind);
  });

  void test("an authorized chunk IS embedded, and only its own content sent", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a",
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, "embedded");

    assert.deepEqual(provider.seen, ["TENANT A CONFIDENTIAL"]);
  });
});

/* -------------------------------------------------------------------------- */
/*                          DIMENSION VALIDATION                              */
/* -------------------------------------------------------------------------- */

void describe("Provider output dimensions are validated before any write", () => {
  void test("a valid 1536-dimension vector is accepted", async () => {
    const data = fixture();
    const provider = createFakeProvider({ returns: fakeEmbedding() });

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a",
    });

    assert.equal(result.ok, true);
  });

  void test("a wrong-dimension vector is rejected and not written", async () => {
    for (const size of [768, 1535, 1537, 3072]) {
      const data = fixture();
      const provider = createFakeProvider({
        returns: Array.from({ length: size }, () => 0.02),
      });

      const result = await ingestChunk(data, TENANT_A, provider, {
        chunkId: "chunk-a",
      });

      assert.equal(
        result.ok,
        false,
        `A ${size}-dimension vector was accepted; schema stores 1536.`,
      );

      const chunk = data.ai_knowledge_chunks?.find((c) => c.id === "chunk-a");
      assert.equal(
        chunk?.embedding,
        null,
        `A ${size}-dimension vector was written to the database.`,
      );
    }
  });

  void test("3072 is rejected — the live .env.local mismatch", async () => {
    /*
     * .env.local names text-embedding-3-large (3072 native) while the
     * schema is vector(1536). This is the exact regression this control
     * exists to catch.
     */
    const data = fixture();
    const provider = createFakeProvider({
      returns: Array.from({ length: 3072 }, () => 0.01),
    });

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a",
    });

    assert.equal(result.ok, false);
  });

  void test("non-finite components are rejected", async () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
      const vector = fakeEmbedding();
      vector[10] = bad;

      const data = fixture();
      const provider = createFakeProvider({ returns: vector });

      const result = await ingestChunk(data, TENANT_A, provider, {
        chunkId: "chunk-a",
      });

      assert.equal(
        result.ok,
        false,
        `A vector containing ${String(bad)} was accepted.`,
      );
    }
  });

  void test("the zero vector is rejected", async () => {
    const data = fixture();
    const provider = createFakeProvider({
      returns: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0),
    });

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a",
    });

    assert.equal(result.ok, false);
  });
});

/* -------------------------------------------------------------------------- */
/*                       EXISTING EMBEDDINGS PROTECTED                        */
/* -------------------------------------------------------------------------- */

void describe("Existing valid embeddings are not overwritten", () => {
  void test("a chunk with an embedding is skipped", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a-done",
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, "skipped_existing");
  });

  void test("skipping costs nothing — no provider call", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    await ingestChunk(data, TENANT_A, provider, { chunkId: "chunk-a-done" });

    assert.equal(
      provider.calls,
      0,
      "Money was spent re-embedding an already-indexed chunk.",
    );
  });

  void test("the prior embedding is left byte-identical", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    await ingestChunk(data, TENANT_A, provider, { chunkId: "chunk-a-done" });

    const chunk = data.ai_knowledge_chunks?.find((c) => c.id === "chunk-a-done");
    assert.equal(chunk?.embedding, "[0.5,0.5]");
    assert.deepEqual(chunk?.metadata, { embedding_model: "prior-model" });
  });

  void test("force re-embeds deliberately", async () => {
    const data = fixture();
    const provider = createFakeProvider();

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a-done",
      force: true,
    });

    assert.equal(result.status, "embedded");
    assert.equal(provider.calls, 1);
  });
});

/* -------------------------------------------------------------------------- */
/*                        PROVIDER FAILURE IS ATOMIC                          */
/* -------------------------------------------------------------------------- */

void describe("Provider failure leaves no partial state", () => {
  void test("a persistent failure writes nothing", async () => {
    const data = fixture();
    const provider = createFakeProvider({
      throws: new Error("provider down"),
    });

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a",
    });

    assert.equal(result.ok, false);
    assert.equal(result.kind, "PROVIDER_FAILED");

    const chunk = data.ai_knowledge_chunks?.find((c) => c.id === "chunk-a");

    /*
     * Still null — not a placeholder, not a zero vector, not a
     * half-written value. A retry sees exactly the prior state.
     */
    assert.equal(
      chunk?.embedding,
      null,
      "PARTIAL STATE: a failed provider call left an embedding behind.",
    );
    assert.deepEqual(chunk?.metadata, {});
  });

  void test("a transient failure is retried once and succeeds", async () => {
    const data = fixture();
    const provider = createFakeProvider({
      throws: new Error("transient"),
      failTimes: 1,
    });

    const result = await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a",
    });

    assert.equal(result.ok, true);
    assert.equal(provider.calls, 2);
  });

  void test("an existing embedding survives a provider failure", async () => {
    const data = fixture();
    const provider = createFakeProvider({ throws: new Error("down") });

    await ingestChunk(data, TENANT_A, provider, {
      chunkId: "chunk-a-done",
      force: true,
    });

    const chunk = data.ai_knowledge_chunks?.find((c) => c.id === "chunk-a-done");
    assert.equal(
      chunk?.embedding,
      "[0.5,0.5]",
      "A failed forced re-embed destroyed a valid existing vector.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                             SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

void describe("SOURCE INVARIANTS — lib/search/embedding.ts", () => {
  void test("is server-only", () => {
    assert.match(EMBEDDING_CODE, /import\s+["'`]server-only["'`]/);
  });

  void test("makes no provider call of its own", () => {
    /*
     * The whole no-cost guarantee. There is no fetch, no SDK import and
     * no endpoint literal in this module — a caller must inject a client.
     */
    assert.ok(
      !/\bfetch\s*\(|from\s+["'`]openai["'`]|api\.openai\.com|api\.groq\.com/.test(
        EMBEDDING_CODE,
      ),
      "COST: embedding.ts contains a live provider call path.",
    );
  });

  void test("takes the client as a parameter", () => {
    assert.match(
      EMBEDDING_CODE,
      /export\s+async\s+function\s+embedText\s*\(\s*\n?\s*client\s*:\s*EmbeddingClient/,
      "The provider must be injected, never ambient.",
    );
  });

  void test("validates provider output before returning it", () => {
    assert.match(EMBEDDING_CODE, /validateEmbedding\s*\(\s*raw/);
  });

  void test("applies a server-owned timeout", () => {
    assert.match(EMBEDDING_CODE, /AbortSignal\s*\.\s*timeout/);
    assert.ok(
      !/signal\s*:\s*request\s*\.\s*signal/.test(EMBEDDING_CODE),
      "A caller-controlled signal would remove the server-side bound.",
    );
  });

  void test("bounds retries", () => {
    assert.match(EMBEDDING_CODE, /maxRetries\s*:\s*1\b/);
  });

  void test("never logs input text or vectors", () => {
    const logs = EMBEDDING_CODE.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    for (const log of logs) {
      assert.ok(
        !/\btext\b|\binput\.text\b|\bembedding\b(?!s)|\braw\b(?!\s*\))/.test(
          log.replace(/receivedLength[\s\S]*?,/, ""),
        ),
        `A log statement may include content or a vector:\n${log}`,
      );
    }
  });

  void test("refuses an environment that contradicts the schema", () => {
    assert.match(
      EMBEDDING_CODE,
      /parsed\s*!==\s*EMBEDDING_DIMENSIONS/,
      "KNOWLEDGE_EMBEDDING_DIMENSIONS must not silently override the schema.",
    );
  });
});

void describe("SOURCE INVARIANTS — lib/search/ingest.ts", () => {
  void test("never references a service-role client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE|service_role|createAdminClient/.test(
        INGEST_CODE,
      ),
      "CRITICAL: ingestion references a service-role client.",
    );
  });

  void test("reads and writes through session.supabase", () => {
    assert.match(INGEST_CODE, /session\s*\.\s*supabase/);
  });

  void test("resolves authorization before reading the chunk", () => {
    const resolveAt = INGEST_CODE.indexOf("resolveAuthorizedDocuments");
    const readAt = INGEST_CODE.indexOf("ai_knowledge_chunks");

    assert.ok(resolveAt > -1 && readAt > -1);
    assert.ok(
      resolveAt < readAt,
      "CRITICAL: the chunk is read before authorization is resolved.",
    );
  });

  void test("calls the provider only after the constrained read", () => {
    const readAt = INGEST_CODE.indexOf("ai_knowledge_chunks");
    const embedAt = INGEST_CODE.indexOf("embedText(");

    assert.ok(readAt > -1 && embedAt > -1);
    assert.ok(
      readAt < embedAt,
      "CRITICAL: content may reach the provider before authorization.",
    );
  });

  void test("constrains both the read and the write by document id", () => {
    const constraints = INGEST_CODE.match(
      /\.\s*in\s*\(\s*["'`]knowledge_document_id["'`]/g,
    );

    assert.ok(
      constraints && constraints.length >= 2,
      "Both the read and the write must carry the allowlist constraint.",
    );
  });

  void test("short-circuits on an empty allowlist", () => {
    assert.match(
      INGEST_CODE,
      /documentIds\s*\.\s*length\s*===\s*0/,
      "CRITICAL: `.in([])` is no filter.",
    );
  });

  void test("skips chunks that already have an embedding", () => {
    assert.match(INGEST_CODE, /skipped_existing/);
    assert.match(INGEST_CODE, /chunk\s*\.\s*embedding\s*!==\s*null/);
  });

  void test("writes nothing when the provider fails", () => {
    const failureBlock = INGEST_CODE.slice(
      INGEST_CODE.indexOf("if (!embedded.ok)"),
      INGEST_CODE.indexOf("PROVIDER_FAILED") + 200,
    );

    assert.ok(
      !/\.\s*update\s*\(/.test(failureBlock),
      "PARTIAL STATE: a write occurs on the provider-failure path.",
    );
  });

  void test("never returns an embedding to the caller", () => {
    /*
     * `embedding` is selected to test for presence only. No outcome
     * type carries a vector (requirement 9).
     */
    assert.ok(
      !/embedding\s*:\s*(embedded|validated|raw)/.test(
        INGEST_CODE.slice(INGEST_CODE.indexOf("IngestOutcome")),
      ),
      "An embedding vector is exposed through the outcome type.",
    );
  });

  void test("never logs content or vectors", () => {
    const logs = INGEST_CODE.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    assert.ok(logs.length > 0, "Expected log statements to inspect.");

    for (const log of logs) {
      /*
       * Inspect the VALUES logged, not the human-readable label. A
       * message such as "embedding write failed." names the operation
       * and discloses nothing; what matters is the payload object.
       */
      const payload = log.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');

      assert.ok(
        !/\bcontent\b|\bchunk\s*\.\s*content\b|\bembedding\b(?!_)|\bserializeEmbedding\b/.test(
          payload,
        ),
        `A log statement may include content or a vector:\n${log}`,
      );
    }
  });

  void test("does not run bulk or scheduled work", () => {
    assert.ok(
      !/setInterval|setTimeout\s*\(\s*\w+\s*,\s*\d{4,}|cron|backfill/i.test(
        INGEST_CODE,
      ),
      "Step 10.4 must not schedule or bulk-run ingestion.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    NO PAID CALLS ANYWHERE IN lib/search                    */
/* -------------------------------------------------------------------------- */

void describe("Step 10.4 incurs no provider cost", () => {
  void test("only the dedicated client module performs a network call", () => {
    /*
     * `openaiEmbedding.ts` is EXCLUDED deliberately: it is the approved
     * client and must contain a fetch. Every other module in lib/search
     * must not, so there is exactly ONE place in the search subsystem
     * that can spend money, and it is the one under the tightest review.
     */
    for (const file of [
      "vector.ts",
      "semantic.ts",
      "embedding.ts",
      "ingest.ts",
      "query.ts",
      "types.ts",
    ]) {
      const code = stripComments(read("lib", "search", file));

      assert.ok(
        !/\bfetch\s*\(|from\s+["'`]openai["'`]|require\(\s*["'`]openai|api\.openai\.com|api\.groq\.com/.test(
          code,
        ),
        `${file} contains a live provider call path; only openaiEmbedding.ts may.`,
      );
    }
  });

  void test("the client is never constructed by default", () => {
    /*
     * The cost guarantee for this step. The client exists but nothing
     * builds it: no route, no job, no module-scope singleton. A grep
     * across the app must find only its own definition.
     */
    const callers: string[] = [];

    for (const file of [
      "vector.ts",
      "semantic.ts",
      "embedding.ts",
      "ingest.ts",
      "query.ts",
      "types.ts",
    ]) {
      const code = stripComments(read("lib", "search", file));
      if (/createOpenAiEmbeddingClient\s*\(/.test(code)) callers.push(file);
    }

    assert.deepEqual(
      callers,
      [],
      `The approved client is constructed by: ${callers.join(", ")}. ` +
        "Nothing may build it automatically in this step.",
    );
  });

  void test("the model decision is documented, not enacted", () => {
    /* Candidates are listed for approval; none is selected by default. */
    assert.match(EMBEDDING_CODE, /OPENAI_EMBEDDING_CANDIDATES/);

    assert.ok(
      !/const\s+DEFAULT_EMBEDDING_MODEL\s*=/.test(EMBEDDING_CODE),
      "A default model would enact an unapproved provider choice.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                   10.1–10.3 REMAIN UNCHANGED IN BEHAVIOUR                  */
/* -------------------------------------------------------------------------- */

void describe("Earlier steps are not weakened", () => {
  void test("keyword search still exports its entrypoints", () => {
    const query = read("lib", "search", "query.ts");
    assert.match(query, /export\s+async\s+function\s+search\s*\(/);
    assert.match(query, /export\s+function\s+scoreHit\s*\(/);
  });

  void test("semantic retrieval keeps its controls", () => {
    const semantic = stripComments(read("lib", "search", "semantic.ts"));

    assert.ok(
      !/supabaseAdmin|service_role/.test(semantic),
      "10.3's no-service-role guarantee was weakened.",
    );
    assert.match(semantic, /documentIds\s*\.\s*length\s*===\s*0/);
    assert.match(semantic, /rpcSecurity\s*:\s*["'`]INVOKER["'`]/);
  });

  void test("the shared resolver is exported, not duplicated", () => {
    const semantic = read("lib", "search", "semantic.ts");

    assert.match(
      semantic,
      /export\s+async\s+function\s+resolveAuthorizedDocuments/,
      "Ingestion must reuse the retrieval-side resolver.",
    );

    assert.match(
      INGEST_CODE,
      /import\s*\{[^}]*resolveAuthorizedDocuments[^}]*\}\s*from\s*["'`]\.\/semantic["'`]/,
      "A duplicated chain would let the two paths drift apart.",
    );
  });

  void test("the dimension contract is unchanged at 1536", () => {
    const vector = read("lib", "search", "vector.ts");
    assert.match(vector, /EMBEDDING_DIMENSIONS\s*=\s*1536/);
  });
});
