/**
 * SYRAVEN — Semantic retrieval mutation tests
 *
 * Phase 10 Step 10.3 (see IMPLEMENTATION_PLAN.md).
 *
 * WHAT A MUTATION TEST IS FOR
 *
 * `semantic-isolation.test.ts` asserts that correct code behaves
 * correctly. That is necessary but not sufficient: a test suite can pass
 * against code whose security controls have been silently removed, if no
 * test actually depends on them.
 *
 * These tests take the opposite direction. Each one MUTATES the
 * retrieval logic — removing exactly one control — and asserts that the
 * mutant LEAKS. If a mutant still behaves safely, the control it removed
 * was decorative, and the assertion here fails to tell us so.
 *
 * Each mutation below corresponds to a plausible refactoring mistake,
 * not an invented one:
 *
 *   M1  drop the owner_id filter          — "RLS already covers this"
 *   M2  drop the document-id constraint   — "the join handles it"
 *   M3  remove the empty-scope short circuit — "`.in([])` is harmless"
 *   M4  rank a shared corpus in Node      — "just sort the results"
 *   M5  skip embedding validation         — "the caller sends valid data"
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

/* -------------------------------------------------------------------------- */
/*                                  FIXTURE                                   */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const TENANT_C = "33333333-3333-3333-3333-333333333333";

const EMBEDDING_DIMENSIONS = 1536;

function tables(): Record<string, Row[]> {
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
        content: "TENANT B SECRET",
        chunk_index: 0,
      },
    ],
  };
}

/**
 * Minimal honest query engine. Applies exactly the filters it is given —
 * so omitting a filter genuinely widens the result set, which is what
 * makes a mutation observable.
 */
function query(
  data: Record<string, Row[]>,
  table: string,
  filters: { column: string; value: string | string[] }[],
): Row[] {
  let rows = [...(data[table] ?? [])];

  for (const filter of filters) {
    if (Array.isArray(filter.value)) {
      const allowed = new Set(filter.value);
      rows = rows.filter((row) => allowed.has(row[filter.column] as string));
    } else {
      rows = rows.filter((row) => row[filter.column] === filter.value);
    }
  }

  return rows;
}

interface Controls {
  /** M1 */ ownerFilter: boolean;
  /** M2 */ documentConstraint: boolean;
  /** M3 */ emptyScopeShortCircuit: boolean;
  /** M5 */ validateEmbedding: boolean;
}

const ALL_CONTROLS: Controls = {
  ownerFilter: true,
  documentConstraint: true,
  emptyScopeShortCircuit: true,
  validateEmbedding: true,
};

/**
 * The retrieval pipeline, parameterised by which controls are enabled.
 *
 * With every control on, this mirrors lib/search/semantic.ts. Turning
 * one off produces the mutant.
 */
function retrieve(
  userId: string,
  embedding: unknown,
  controls: Controls,
): { chunks: Row[]; rejected: boolean; queriedChunks: boolean } {
  const data = tables();

  /* M5 — embedding validation. */
  if (controls.validateEmbedding) {
    const valid =
      Array.isArray(embedding) &&
      embedding.length === EMBEDDING_DIMENSIONS &&
      embedding.every((c) => typeof c === "number" && Number.isFinite(c)) &&
      embedding.some((c) => c !== 0);

    if (!valid) return { chunks: [], rejected: true, queriedChunks: false };
  }

  /* HOP 1 — bases. M1 removes the ownership filter. */
  const baseFilters = controls.ownerFilter
    ? [{ column: "owner_id", value: userId }]
    : [];

  const baseIds = query(data, "ai_knowledge_bases", baseFilters).map((r) =>
    String(r.id),
  );

  /* M3 — the empty-scope short circuit. */
  if (controls.emptyScopeShortCircuit && baseIds.length === 0) {
    return { chunks: [], rejected: false, queriedChunks: false };
  }

  const sourceIds = query(data, "ai_knowledge_sources", [
    { column: "knowledge_base_id", value: baseIds },
  ]).map((r) => String(r.id));

  const documentIds = query(data, "ai_knowledge_documents", [
    { column: "knowledge_source_id", value: sourceIds },
  ]).map((r) => String(r.id));

  if (controls.emptyScopeShortCircuit && documentIds.length === 0) {
    return { chunks: [], rejected: false, queriedChunks: false };
  }

  /*
   * HOP 4 — chunks. M2 removes the constraint entirely.
   *
   * Note the M3 pathology: without the short circuit, an EMPTY
   * documentIds list is still passed as a filter. An empty `IN ()` in
   * PostgREST matches nothing, but the realistic refactor is to omit an
   * empty filter as a no-op — modelled here, because that is the
   * variant that leaks.
   */
  const chunkFilters =
    controls.documentConstraint && documentIds.length > 0
      ? [{ column: "knowledge_document_id", value: documentIds }]
      : [];

  return {
    chunks: query(data, "ai_knowledge_chunks", chunkFilters),
    rejected: false,
    queriedChunks: true,
  };
}

function contents(rows: Row[]): string[] {
  return rows.map((r) => String(r.content));
}

function validEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.02);
}

/* -------------------------------------------------------------------------- */
/*                              BASELINE                                      */
/* -------------------------------------------------------------------------- */

void describe("BASELINE — all controls enabled", () => {
  void test("tenant A sees only tenant A", () => {
    const result = retrieve(TENANT_A, validEmbedding(), ALL_CONTROLS);
    assert.deepEqual(contents(result.chunks), ["TENANT A PRIVATE"]);
  });

  void test("a tenant owning nothing sees nothing", () => {
    const result = retrieve(TENANT_C, validEmbedding(), ALL_CONTROLS);
    assert.deepEqual(contents(result.chunks), []);
    assert.equal(result.queriedChunks, false);
  });
});

/* -------------------------------------------------------------------------- */
/*                        M1 — OWNERSHIP FILTER REMOVED                       */
/* -------------------------------------------------------------------------- */

void describe("M1 — removing the owner_id filter leaks", () => {
  void test("mutant returns another tenant's chunks", () => {
    const mutant = retrieve(TENANT_A, validEmbedding(), {
      ...ALL_CONTROLS,
      ownerFilter: false,
    });

    /*
     * The mutation must be DETECTABLE. If this assertion fails, the
     * owner_id filter was doing nothing and the isolation test that
     * "passes" is passing for the wrong reason.
     */
    assert.ok(
      contents(mutant.chunks).includes("TENANT B SECRET"),
      "M1 did not leak — the ownership filter is not load-bearing, " +
        "so the isolation suite cannot detect its removal.",
    );
  });

  void test("the control prevents exactly that leak", () => {
    const guarded = retrieve(TENANT_A, validEmbedding(), ALL_CONTROLS);
    assert.ok(!contents(guarded.chunks).includes("TENANT B SECRET"));
  });
});

/* -------------------------------------------------------------------------- */
/*                     M2 — DOCUMENT CONSTRAINT REMOVED                       */
/* -------------------------------------------------------------------------- */

void describe("M2 — removing the document-id constraint leaks", () => {
  void test("mutant returns the entire chunk corpus", () => {
    const mutant = retrieve(TENANT_A, validEmbedding(), {
      ...ALL_CONTROLS,
      documentConstraint: false,
    });

    assert.equal(
      mutant.chunks.length,
      2,
      "M2 did not widen the result set; the constraint is not load-bearing.",
    );

    assert.ok(
      contents(mutant.chunks).includes("TENANT B SECRET"),
      "M2 did not leak — chunk scoping is decorative.",
    );
  });

  void test("the control confines retrieval to owned documents", () => {
    const guarded = retrieve(TENANT_A, validEmbedding(), ALL_CONTROLS);
    assert.equal(guarded.chunks.length, 1);
  });
});

/* -------------------------------------------------------------------------- */
/*                    M3 — EMPTY-SCOPE SHORT CIRCUIT REMOVED                  */
/* -------------------------------------------------------------------------- */

void describe("M3 — removing the empty-scope short circuit leaks", () => {
  void test("a tenant owning nothing receives the whole corpus", () => {
    const mutant = retrieve(TENANT_C, validEmbedding(), {
      ...ALL_CONTROLS,
      emptyScopeShortCircuit: false,
    });

    /*
     * This is the subtlest of the five and the reason the short circuit
     * is written explicitly rather than left implicit: a caller
     * authorized for NOTHING is the one most catastrophically exposed
     * when an empty filter degrades to no filter.
     */
    assert.ok(
      mutant.chunks.length > 0,
      "M3 did not leak — the empty-allowlist guard is not load-bearing.",
    );

    assert.ok(
      contents(mutant.chunks).includes("TENANT A PRIVATE") &&
        contents(mutant.chunks).includes("TENANT B SECRET"),
      "M3 leaked partially; expected the full corpus.",
    );
  });

  void test("the control returns empty instead of unfiltered", () => {
    const guarded = retrieve(TENANT_C, validEmbedding(), ALL_CONTROLS);
    assert.equal(guarded.chunks.length, 0);
    assert.equal(guarded.queriedChunks, false);
  });
});

/* -------------------------------------------------------------------------- */
/*                    M4 — CROSS-TENANT RANKING IN NODE                       */
/* -------------------------------------------------------------------------- */

void describe("M4 — ranking a shared corpus leaks through ORDER", () => {
  /**
   * The tempting "fix" for absent database ranking: fetch chunks, score
   * them in application code, return the caller's own. Every RETURNED
   * row is authorized — which is exactly why this looks safe and is not.
   */
  function rankThenFilter(userId: string): {
    returned: string[];
    observedForeignRows: number;
  } {
    const data = tables();

    /* Broad retrieval — no authorization applied. */
    const corpus = data.ai_knowledge_chunks ?? [];

    /* Rank across every tenant. */
    const ranked = [...corpus].sort((a, b) =>
      String(a.content).localeCompare(String(b.content)),
    );

    /* Post-filter to the caller's documents. */
    const ownedDocs = new Set(
      userId === TENANT_A ? ["doc-a"] : userId === TENANT_B ? ["doc-b"] : [],
    );

    const returned = ranked.filter((row) =>
      ownedDocs.has(row.knowledge_document_id as string),
    );

    return {
      returned: contents(returned),
      observedForeignRows: ranked.length - returned.length,
    };
  }

  void test("post-filtering still reads foreign rows", () => {
    const result = rankThenFilter(TENANT_A);

    /* The output looks clean... */
    assert.deepEqual(result.returned, ["TENANT A PRIVATE"]);

    /* ...but foreign rows were fetched and ranked to produce it. */
    assert.ok(
      result.observedForeignRows > 0,
      "M4 did not demonstrate the post-filtering hazard.",
    );
  });

  void test("the implementation refuses this shape", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const code = readFileSync(
      join(process.cwd(), "lib", "search", "semantic.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    /*
     * No sort over retrieved chunks. Ordering is delegated to the
     * database within an already-authorized set, or reported degraded.
     */
    assert.ok(
      !/\bchunks\s*\.\s*sort\s*\(|\brows\s*\.\s*sort\s*\(/.test(code),
      "CRITICAL: chunks are ranked in application code.",
    );

    /*
     * Distance is never synthesised from anything but the database's own
     * value.
     *
     * UPDATED for the RPC integration. Until the RPC went live, the only
     * legitimate assignment was `null` — no ranking existed, so any
     * number was necessarily invented. Now `match_knowledge_chunks`
     * returns a real cosine `similarity`, and `distance` is its exact
     * complement.
     *
     * The rule is therefore NOT relaxed to "any expression". It is
     * narrowed to the two legitimate forms:
     *
     *   null                                   — no ranking happened
     *   similarity === null ? null : 1 - …     — derived from the RPC
     *
     * Anything else — a literal, a local computation, a corpus
     * statistic — still fails. Checks ASSIGNMENTS, not the
     * `readonly distance: number | null` type declaration.
     */
    const assignments = code.match(/^\s*distance\s*:\s*(.+?),?\s*$/gm) ?? [];

    assert.ok(
      assignments.length > 0,
      "Expected at least one distance assignment to inspect.",
    );

    for (const assignment of assignments) {
      assert.match(
        assignment,
        /distance\s*:\s*(null|number\s*\|\s*null|similarity\s*===\s*null\s*\?\s*null\s*:\s*1\s*-\s*similarity)\s*,?\s*$/,
        `CRITICAL: a distance is computed or fabricated outside the database:\n${assignment}`,
      );
    }

    /*
     * The complement to the above: `similarity` itself must come
     * straight from the RPC row, never be computed locally.
     */
    const similarityAssignments =
      code.match(/^\s*similarity\s*:\s*(.+?),?\s*$/gm) ?? [];

    for (const assignment of similarityAssignments) {
      assert.match(
        assignment,
        /similarity\s*:\s*(null|similarity)\s*,?\s*$/,
        `CRITICAL: similarity is computed locally rather than read from the RPC:\n${assignment}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                    M5 — EMBEDDING VALIDATION REMOVED                       */
/* -------------------------------------------------------------------------- */

void describe("M5 — skipping embedding validation reaches the database", () => {
  void test("mutant accepts a malformed vector and queries anyway", () => {
    const mutant = retrieve(TENANT_A, [1, 2, 3], {
      ...ALL_CONTROLS,
      validateEmbedding: false,
    });

    assert.equal(
      mutant.rejected,
      false,
      "M5 did not bypass validation; the control is not load-bearing.",
    );

    assert.equal(
      mutant.queriedChunks,
      true,
      "M5 should have reached the database with a malformed vector.",
    );
  });

  void test("the control rejects before any query runs", () => {
    const guarded = retrieve(TENANT_A, [1, 2, 3], ALL_CONTROLS);
    assert.equal(guarded.rejected, true);
    assert.equal(guarded.queriedChunks, false);
  });

  void test("a wrong-dimension vector is refused", () => {
    for (const size of [768, 1535, 1537, 3072]) {
      const guarded = retrieve(
        TENANT_A,
        Array.from({ length: size }, () => 0.02),
        ALL_CONTROLS,
      );
      assert.equal(
        guarded.rejected,
        true,
        `A ${size}-dimension vector was not refused.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                     NO-COST GUARANTEE FOR STEP 10.3                        */
/* -------------------------------------------------------------------------- */

void describe("Step 10.3 incurs no provider cost", () => {
  void test("no embedding provider is referenced in lib/search", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    for (const file of ["vector.ts", "semantic.ts", "query.ts", "types.ts"]) {
      const code = readFileSync(
        join(process.cwd(), "lib", "search", file),
        "utf8",
      ).replace(/\/\*[\s\S]*?\*\//g, "");

      assert.ok(
        !/require\(\s*["'`]openai|from\s+["'`]openai["'`]|embeddings\s*\.\s*create|api\.openai\.com|api\.groq\.com/.test(
          code,
        ),
        `${file} references an embedding provider; 10.3 must cost nothing.`,
      );
    }
  });
});
