/**
 * SYRAVEN — Embedding ingestion mutation tests
 *
 * Phase 10 Step 10.4 (see IMPLEMENTATION_PLAN.md).
 *
 * `embedding-ingest.test.ts` asserts that correct code behaves
 * correctly. These assert the complement: that each control is
 * LOAD-BEARING. Every test below removes exactly one control and proves
 * the result is harmful. A mutant that stays safe would mean the control
 * it removed was decorative and the suite could not detect its loss.
 *
 * Ingestion mutations are graded by a harsher standard than retrieval
 * ones. A retrieval mutant leaks to a user; an ingestion mutant
 * TRANSMITS content to a third party. So the assertions here check the
 * provider's recorded input, not just the returned value.
 *
 *   N1  drop the authorization filter    — "RLS covers the write"
 *   N2  read the chunk by id alone       — "the id came from our own UI"
 *   N3  skip output dimension validation — "the provider is consistent"
 *   N4  embed before authorizing         — "fetch the text first, it's faster"
 *   N5  overwrite existing embeddings    — "just re-embed everything"
 *   N6  write on provider failure        — "store a placeholder and retry"
 *
 * All embeddings are local fakes. Cost: $0.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

/* -------------------------------------------------------------------------- */
/*                                  FIXTURE                                   */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

const EMBEDDING_DIMENSIONS = 1536;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_C = "33333333-3333-3333-3333-333333333333";

function fakeEmbedding(seed = 0.02, size = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length: size }, () => seed);
}

function fixture(): Record<string, Row[]> {
  return {
    ai_knowledge_bases: [
      { id: "kb-a", owner_id: TENANT_A },
      { id: "kb-b", owner_id: "22222222-2222-2222-2222-222222222222" },
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
      },
      {
        id: "chunk-a-done",
        knowledge_document_id: "doc-a",
        content: "TENANT A ALREADY INDEXED",
        embedding: "[0.5,0.5]",
      },
      {
        id: "chunk-b",
        knowledge_document_id: "doc-b",
        content: "TENANT B CONFIDENTIAL",
        embedding: null,
      },
    ],
  };
}

interface Controls {
  /** N1 */ authorizationFilter: boolean;
  /** N2 */ constrainedRead: boolean;
  /** N3 */ validateOutputDimensions: boolean;
  /** N4 */ authorizeBeforeEmbedding: boolean;
  /** N5 */ protectExistingEmbedding: boolean;
  /** N6 */ noWriteOnFailure: boolean;
}

const ALL_CONTROLS: Controls = {
  authorizationFilter: true,
  constrainedRead: true,
  validateOutputDimensions: true,
  authorizeBeforeEmbedding: true,
  protectExistingEmbedding: true,
  noWriteOnFailure: true,
};

function createProvider(behaviour: { returns?: number[]; throws?: Error } = {}) {
  const seen: string[] = [];

  return {
    seen,
    get calls() {
      return seen.length;
    },
    modelId: "fake-model",
    async embed(input: { text: string }): Promise<readonly number[]> {
      seen.push(input.text);
      if (behaviour.throws) throw behaviour.throws;
      return behaviour.returns ?? fakeEmbedding();
    },
  };
}

/**
 * The ingestion pipeline, parameterised by which controls are enabled.
 * With every control on, this mirrors lib/search/ingest.ts.
 */
async function ingest(
  data: Record<string, Row[]>,
  userId: string,
  provider: ReturnType<typeof createProvider>,
  input: { chunkId: string; force?: boolean },
  controls: Controls,
): Promise<{ ok: boolean; kind?: string; status?: string }> {
  /* N1 — the ownership filter on the chain's first hop. */
  const baseIds = (data.ai_knowledge_bases ?? [])
    .filter((r) => (controls.authorizationFilter ? r.owner_id === userId : true))
    .map((r) => String(r.id));

  const sourceIds = (data.ai_knowledge_sources ?? [])
    .filter((r) => baseIds.includes(String(r.knowledge_base_id)))
    .map((r) => String(r.id));

  const documentIds = (data.ai_knowledge_documents ?? [])
    .filter((r) => sourceIds.includes(String(r.knowledge_source_id)))
    .map((r) => String(r.id));

  const allChunks = data.ai_knowledge_chunks ?? [];

  /* N4 — embedding before authorization is resolved. */
  if (!controls.authorizeBeforeEmbedding) {
    const unscoped = allChunks.find((r) => r.id === input.chunkId);

    if (unscoped) {
      /* The content leaves the process before any ownership check. */
      await provider.embed({ text: String(unscoped.content) });
    }
  }

  if (controls.authorizeBeforeEmbedding && documentIds.length === 0) {
    return { ok: false, kind: "NOT_AUTHORIZED" };
  }

  /* N2 — the read constraint. */
  const chunk =
    allChunks.find((r) =>
      controls.constrainedRead
        ? r.id === input.chunkId &&
          documentIds.includes(String(r.knowledge_document_id))
        : r.id === input.chunkId,
    ) ?? null;

  if (chunk === null) return { ok: false, kind: "NOT_AUTHORIZED" };

  /* N5 — existing-embedding protection. */
  if (
    controls.protectExistingEmbedding &&
    chunk.embedding !== null &&
    input.force !== true
  ) {
    return { ok: true, status: "skipped_existing" };
  }

  let raw: readonly number[];

  try {
    raw = await provider.embed({ text: String(chunk.content) });
  } catch {
    /* N6 — writing on the failure path. */
    if (!controls.noWriteOnFailure) {
      chunk.embedding = "[]";
      return { ok: false, kind: "PROVIDER_FAILED" };
    }
    return { ok: false, kind: "PROVIDER_FAILED" };
  }

  /* N3 — output dimension validation. */
  if (controls.validateOutputDimensions) {
    const valid =
      Array.isArray(raw) &&
      raw.length === EMBEDDING_DIMENSIONS &&
      raw.every((c) => typeof c === "number" && Number.isFinite(c)) &&
      raw.some((c) => c !== 0);

    if (!valid) return { ok: false, kind: "PROVIDER_FAILED" };
  }

  chunk.embedding = `[${(raw as number[]).join(",")}]`;

  return { ok: true, status: "embedded" };
}

function chunkOf(data: Record<string, Row[]>, id: string): Row | undefined {
  return data.ai_knowledge_chunks?.find((c) => c.id === id);
}

/* -------------------------------------------------------------------------- */
/*                                 BASELINE                                   */
/* -------------------------------------------------------------------------- */

void describe("BASELINE — all controls enabled", () => {
  void test("an owned chunk is embedded", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a" },
      ALL_CONTROLS,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(provider.seen, ["TENANT A CONFIDENTIAL"]);
  });

  void test("a foreign chunk is refused and never transmitted", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-b" },
      ALL_CONTROLS,
    );

    assert.equal(result.ok, false);
    assert.equal(provider.calls, 0);
  });
});

/* -------------------------------------------------------------------------- */
/*                    N1 — AUTHORIZATION FILTER REMOVED                       */
/* -------------------------------------------------------------------------- */

void describe("N1 — removing the ownership filter exfiltrates", () => {
  void test("mutant embeds another tenant's chunk", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-b" },
      { ...ALL_CONTROLS, authorizationFilter: false },
    );

    assert.equal(
      result.ok,
      true,
      "N1 did not leak — the ownership filter is not load-bearing.",
    );

    assert.ok(
      provider.seen.includes("TENANT B CONFIDENTIAL"),
      "N1 did not transmit foreign content; the mutation is undetectable.",
    );
  });

  void test("the control prevents exactly that", async () => {
    const data = fixture();
    const provider = createProvider();

    await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-b" },
      ALL_CONTROLS,
    );

    assert.ok(!provider.seen.includes("TENANT B CONFIDENTIAL"));
  });
});

/* -------------------------------------------------------------------------- */
/*                      N2 — CONSTRAINED READ REMOVED                         */
/* -------------------------------------------------------------------------- */

void describe("N2 — reading by id alone exfiltrates", () => {
  void test("mutant reads and embeds a chunk outside the allowlist", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-b" },
      { ...ALL_CONTROLS, constrainedRead: false },
    );

    assert.equal(
      result.ok,
      true,
      "N2 did not leak — the read constraint is not load-bearing.",
    );

    assert.ok(
      provider.seen.includes("TENANT B CONFIDENTIAL"),
      "N2 should have transmitted an unauthorized chunk.",
    );
  });

  void test("the control makes the id insufficient on its own", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-b" },
      ALL_CONTROLS,
    );

    assert.equal(result.kind, "NOT_AUTHORIZED");
  });
});

/* -------------------------------------------------------------------------- */
/*                   N3 — OUTPUT DIMENSION VALIDATION REMOVED                 */
/* -------------------------------------------------------------------------- */

void describe("N3 — skipping output validation corrupts the corpus", () => {
  void test("mutant writes a 3072-dimension vector", async () => {
    const data = fixture();
    const provider = createProvider({ returns: fakeEmbedding(0.01, 3072) });

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a" },
      { ...ALL_CONTROLS, validateOutputDimensions: false },
    );

    assert.equal(
      result.ok,
      true,
      "N3 did not accept a bad vector; validation is not load-bearing.",
    );

    /*
     * This is the .env.local mismatch made real: text-embedding-3-large
     * emits 3072 while the schema stores 1536.
     */
    assert.notEqual(
      chunkOf(data, "chunk-a")?.embedding,
      null,
      "N3 should have written an unusable vector.",
    );
  });

  void test("the control rejects it and writes nothing", async () => {
    const data = fixture();
    const provider = createProvider({ returns: fakeEmbedding(0.01, 3072) });

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a" },
      ALL_CONTROLS,
    );

    assert.equal(result.ok, false);
    assert.equal(chunkOf(data, "chunk-a")?.embedding, null);
  });
});

/* -------------------------------------------------------------------------- */
/*                 N4 — EMBEDDING BEFORE AUTHORIZATION                        */
/* -------------------------------------------------------------------------- */

void describe("N4 — embedding before authorizing exfiltrates silently", () => {
  void test("mutant transmits content it then refuses to write", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_C,
      provider,
      { chunkId: "chunk-a" },
      { ...ALL_CONTROLS, authorizeBeforeEmbedding: false },
    );

    /*
     * The most instructive mutant in the suite. The RESULT looks safe —
     * the caller is refused. But the content has already left the
     * process. A test that only checked the return value would pass
     * against a live exfiltration bug.
     */
    assert.equal(result.ok, false, "The mutant still refuses the caller.");

    assert.ok(
      provider.calls > 0,
      "N4 did not transmit; ordering is not load-bearing.",
    );

    assert.ok(
      provider.seen.includes("TENANT A CONFIDENTIAL"),
      "EXFILTRATION not demonstrated by N4.",
    );
  });

  void test("the control transmits nothing for an unauthorized caller", async () => {
    const data = fixture();
    const provider = createProvider();

    await ingest(
      data,
      TENANT_C,
      provider,
      { chunkId: "chunk-a" },
      ALL_CONTROLS,
    );

    assert.equal(
      provider.calls,
      0,
      "Content reached the provider for a caller authorized for nothing.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                  N5 — EXISTING-EMBEDDING PROTECTION REMOVED                */
/* -------------------------------------------------------------------------- */

void describe("N5 — removing skip-existing wastes money and rewrites", () => {
  void test("mutant re-embeds an already-indexed chunk", async () => {
    const data = fixture();
    const provider = createProvider();

    await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a-done" },
      { ...ALL_CONTROLS, protectExistingEmbedding: false },
    );

    assert.equal(
      provider.calls,
      1,
      "N5 did not re-embed; the guard is not load-bearing.",
    );

    assert.notEqual(
      chunkOf(data, "chunk-a-done")?.embedding,
      "[0.5,0.5]",
      "N5 should have overwritten the existing vector.",
    );
  });

  void test("the control preserves the vector and spends nothing", async () => {
    const data = fixture();
    const provider = createProvider();

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a-done" },
      ALL_CONTROLS,
    );

    assert.equal(result.status, "skipped_existing");
    assert.equal(provider.calls, 0);
    assert.equal(chunkOf(data, "chunk-a-done")?.embedding, "[0.5,0.5]");
  });
});

/* -------------------------------------------------------------------------- */
/*                    N6 — WRITE ON PROVIDER FAILURE                          */
/* -------------------------------------------------------------------------- */

void describe("N6 — writing on failure creates invalid state", () => {
  void test("mutant leaves a placeholder behind", async () => {
    const data = fixture();
    const provider = createProvider({ throws: new Error("provider down") });

    const result = await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a" },
      { ...ALL_CONTROLS, noWriteOnFailure: false },
    );

    assert.equal(result.ok, false);

    assert.notEqual(
      chunkOf(data, "chunk-a")?.embedding,
      null,
      "N6 did not write on failure; the guard is not load-bearing.",
    );
  });

  void test("the control leaves the row untouched", async () => {
    const data = fixture();
    const provider = createProvider({ throws: new Error("provider down") });

    await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a" },
      ALL_CONTROLS,
    );

    assert.equal(
      chunkOf(data, "chunk-a")?.embedding,
      null,
      "PARTIAL STATE: a failed call left an embedding behind.",
    );
  });

  void test("a forced re-embed that fails preserves the old vector", async () => {
    const data = fixture();
    const provider = createProvider({ throws: new Error("down") });

    await ingest(
      data,
      TENANT_A,
      provider,
      { chunkId: "chunk-a-done", force: true },
      ALL_CONTROLS,
    );

    assert.equal(
      chunkOf(data, "chunk-a-done")?.embedding,
      "[0.5,0.5]",
      "A failed forced re-embed destroyed a valid vector.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        COST CONTROL IS LOAD-BEARING                        */
/* -------------------------------------------------------------------------- */

void describe("Injection is what keeps the suite free", () => {
  void test("no test can reach a real provider", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    /*
     * embedText takes its client as a parameter, so a test that forgot
     * to pass a fake would fail to compile rather than silently billing.
     */
    const code = readFileSync(
      join(process.cwd(), "lib", "search", "embedding.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    assert.ok(
      !/\bfetch\s*\(/.test(code),
      "COST: a live fetch exists in the embedding module.",
    );

    assert.match(
      code,
      /client\s*:\s*EmbeddingClient/,
      "The provider seam must be a required parameter.",
    );
  });
});
