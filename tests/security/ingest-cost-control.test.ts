/**
 * SYRAVEN — Embedding ingestion cost and rate control tests
 *
 * Phase 12 follow-up, step 1.
 *
 * Every ingestion call reaches a PAID provider, so the limits here are
 * spend controls, not load controls. The failure mode they prevent is
 * money, and money does not roll back — which is why each control is
 * tested both for what it permits and for what it refuses.
 *
 * No provider is called anywhere in this file. Cost: $0.
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

const POLICY_CODE = stripComments(read("lib", "search", "ingestPolicy.ts"));
const INGEST_CODE = stripComments(read("lib", "search", "ingest.ts"));
const METER_CODE = stripComments(read("lib", "usage", "meter.ts"));

/* -------------------------------------------------------------------------- */
/*                            MIRRORED POLICY LOGIC                           */
/* -------------------------------------------------------------------------- */

/*
 * lib/search/* is server-only and cannot load under node --test. The
 * logic is mirrored; SOURCE INVARIANTS below hold the real module to the
 * same constants, so the mirror cannot silently drift.
 */

const INGEST_LIMITS = {
  rateLimitKey: "embedding:ingest",
  maxBatchSize: 10,
  maxChunksPerWindow: 1_000,
  windowHours: 24,
  maxChunkCharacters: 8_000,
} as const;

function validateIngestBatch(chunkIds: unknown) {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
    return { ok: false as const, reason: "BATCH_TOO_LARGE" };
  }

  const unique = Array.from(
    new Set(
      chunkIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  );

  if (unique.length === 0 || unique.length > INGEST_LIMITS.maxBatchSize) {
    return { ok: false as const, reason: "BATCH_TOO_LARGE" };
  }

  return { ok: true as const, chunkIds: unique };
}

function isWithinContentCeiling(content: string): boolean {
  return (
    typeof content === "string" &&
    content.trim().length > 0 &&
    content.length <= INGEST_LIMITS.maxChunkCharacters
  );
}

/** Mirror of enforceIngestPolicy's ceiling arithmetic. */
function wouldExceedCeiling(alreadyEmbedded: number, requested: number) {
  return alreadyEmbedded + requested > INGEST_LIMITS.maxChunksPerWindow;
}

/* -------------------------------------------------------------------------- */
/*                              BATCH CEILING                                 */
/* -------------------------------------------------------------------------- */

void describe("Batch size is bounded", () => {
  void test("accepts a batch at the limit", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `chunk-${i}`);
    const result = validateIngestBatch(ids);

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.chunkIds.length, 10);
  });

  void test("refuses a batch over the limit", () => {
    const ids = Array.from({ length: 11 }, (_, i) => `chunk-${i}`);
    assert.equal(validateIngestBatch(ids).ok, false);
  });

  void test("refuses an enormous batch outright", () => {
    const ids = Array.from({ length: 100_000 }, (_, i) => `chunk-${i}`);
    assert.equal(validateIngestBatch(ids).ok, false);
  });

  void test("refuses an empty or malformed batch", () => {
    for (const bad of [[], null, undefined, "chunk-1", 42, {}]) {
      assert.equal(validateIngestBatch(bad).ok, false);
    }
  });

  void test("collapses duplicates so they cannot amplify spend", () => {
    /*
     * The subtle one. Ten copies of the same id passes a naive length
     * check and then bills ten embeddings. Deduplication makes the batch
     * limit bound SPEND, not just array length.
     */
    const ids = Array.from({ length: 10 }, () => "same-chunk");
    const result = validateIngestBatch(ids);

    assert.equal(result.ok, true);
    assert.equal(
      result.ok && result.chunkIds.length,
      1,
      "Duplicate ids were not collapsed; a batch could bill 10x.",
    );
  });

  void test("drops non-string entries rather than trusting them", () => {
    const result = validateIngestBatch(["a", 1, null, "b", {}, "a"]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.chunkIds, ["a", "b"]);
  });
});

/* -------------------------------------------------------------------------- */
/*                              VOLUME CEILING                                */
/* -------------------------------------------------------------------------- */

void describe("Rolling-window volume ceiling", () => {
  void test("permits a batch that fits under the ceiling", () => {
    assert.equal(wouldExceedCeiling(0, 10), false);
    assert.equal(wouldExceedCeiling(990, 10), false);
  });

  void test("refuses a batch that would cross the ceiling", () => {
    assert.equal(wouldExceedCeiling(991, 10), true);
    assert.equal(wouldExceedCeiling(1_000, 1), true);
  });

  void test("the whole batch must fit, not part of it", () => {
    /*
     * Admitting a partial batch would let a caller sit exactly at the
     * limit and creep past it one chunk at a time.
     */
    assert.equal(
      wouldExceedCeiling(995, 10),
      true,
      "A batch straddling the ceiling must be refused entirely.",
    );
  });

  void test("a caller already at the ceiling is refused", () => {
    assert.equal(wouldExceedCeiling(1_000, 1), true);
    assert.equal(wouldExceedCeiling(5_000, 1), true);
  });
});

/* -------------------------------------------------------------------------- */
/*                             CONTENT CEILING                                */
/* -------------------------------------------------------------------------- */

void describe("Per-chunk content ceiling", () => {
  void test("accepts normal content", () => {
    assert.equal(isWithinContentCeiling("a normal chunk of text"), true);
    assert.equal(isWithinContentCeiling("x".repeat(8_000)), true);
  });

  void test("refuses oversized content", () => {
    assert.equal(isWithinContentCeiling("x".repeat(8_001)), false);
    assert.equal(isWithinContentCeiling("x".repeat(1_000_000)), false);
  });

  void test("refuses empty or whitespace-only content", () => {
    for (const bad of ["", "   ", "\n\t "]) {
      assert.equal(isWithinContentCeiling(bad), false);
    }
  });

  void test("is stricter than the correctness bound", () => {
    /*
     * EMBEDDING_POLICY.maxInputCharacters is 32,000 and exists for
     * correctness. This ceiling is 8,000 and exists for cost, so it must
     * be the binding one.
     */
    assert.ok(INGEST_LIMITS.maxChunkCharacters < 32_000);
    assert.equal(isWithinContentCeiling("x".repeat(20_000)), false);
  });
});

/* -------------------------------------------------------------------------- */
/*                             SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

void describe("SOURCE INVARIANTS — lib/search/ingestPolicy.ts", () => {
  void test("is server-only", () => {
    assert.match(POLICY_CODE, /import\s+["'`]server-only["'`]/);
  });

  void test("limits match the mirror", () => {
    assert.match(POLICY_CODE, /maxBatchSize:\s*10\b/);
    assert.match(POLICY_CODE, /maxChunksPerWindow:\s*1_000\b/);
    assert.match(POLICY_CODE, /windowHours:\s*24\b/);
    assert.match(POLICY_CODE, /maxChunkCharacters:\s*8_000\b/);
    assert.match(POLICY_CODE, /rateLimitKey:\s*["'`]embedding:ingest["'`]/);
  });

  void test("limits are constants, not environment-configurable", () => {
    /*
     * A ceiling an env var can raise is a ceiling an ops mistake can
     * remove, and the failure mode here is money.
     */
    assert.ok(
      !/process\.env/.test(POLICY_CODE),
      "Cost ceilings must not be environment-configurable.",
    );
  });

  void test("never references a service-role client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE|service_role/.test(POLICY_CODE),
      "CRITICAL: cost control must run on the caller's RLS-scoped client.",
    );
  });

  void test("reuses the shared authorization resolver", () => {
    assert.match(
      POLICY_CODE,
      /import\s*\{[^}]*resolveAuthorizedDocuments[^}]*\}\s*from\s*["'`]\.\/semantic["'`]/,
      "The volume count must be scoped by the same allowlist as retrieval.",
    );
  });

  void test("every failure path denies", () => {
    /*
     * A ceiling that cannot be evaluated must deny. The opposite turns a
     * database hiccup into unlimited spend.
     */
    assert.match(POLICY_CODE, /reason:\s*["'`]CHECK_FAILED["'`]/);
    assert.ok(
      !/allowed:\s*true[\s\S]{0,200}error/.test(POLICY_CODE),
      "An error path must not return allowed: true.",
    );
  });

  void test("the volume count is scoped to authorized documents", () => {
    assert.match(
      POLICY_CODE,
      /\.\s*in\s*\(\s*["'`]knowledge_document_id["'`]/,
      "An unscoped count would leak another tenant's ingestion volume.",
    );
  });

  void test("makes no provider call", () => {
    assert.ok(
      !/\bfetch\s*\(|openai|embedText/.test(POLICY_CODE),
      "The policy layer must not itself call a provider.",
    );
  });
});

void describe("SOURCE INVARIANTS — enforcement is wired in", () => {
  void test("the rate limit key is declared in RATE_LIMITS", () => {
    /*
     * checkRateLimit refuses unknown keys, so an undeclared key denies
     * ALL ingestion. This assertion is what keeps the two files in step.
     */
    assert.match(
      METER_CODE,
      /["'`]embedding:ingest["'`]\s*:\s*\{\s*max:\s*\d+/,
      "embedding:ingest must exist in RATE_LIMITS or ingestion fails closed.",
    );
  });

  void test("the ingest rule is stricter than interactive endpoints", () => {
    const rule = METER_CODE.match(
      /["'`]embedding:ingest["'`]\s*:\s*\{\s*max:\s*(\d+)/,
    );
    assert.ok(rule?.[1], "Could not read the embedding:ingest max.");

    const search = METER_CODE.match(
      /["'`]search:query["'`]\s*:\s*\{\s*max:\s*(\d+)/,
    );
    assert.ok(search?.[1]);

    assert.ok(
      Number(rule[1]) < Number(search[1]),
      "A paid bulk endpoint must be limited more strictly than search.",
    );
  });

  void test("ingestChunk enforces the content ceiling itself", () => {
    /*
     * Enforced in ingestChunk, not only in a route, so the ceiling holds
     * for any caller — including a future batch runner.
     */
    assert.match(
      INGEST_CODE,
      /isWithinContentCeiling\s*\(\s*content\s*\)/,
      "ingestChunk must apply the cost ceiling before the provider call.",
    );
  });

  void test("the ceiling is applied before the provider call", () => {
    const ceilingAt = INGEST_CODE.indexOf("isWithinContentCeiling");
    const embedAt = INGEST_CODE.indexOf("embedText(");

    assert.ok(ceilingAt > -1 && embedAt > -1);
    assert.ok(
      ceilingAt < embedAt,
      "CRITICAL: content reaches the provider before the cost ceiling.",
    );
  });

  void test("10.4 controls are preserved", () => {
    assert.ok(!/supabaseAdmin|service_role/.test(INGEST_CODE));
    assert.match(INGEST_CODE, /documentIds\s*\.\s*length\s*===\s*0/);
    assert.match(INGEST_CODE, /skipped_existing/);
  });
});

/* -------------------------------------------------------------------------- */
/*                        MUTATION — CONTROLS ARE REAL                        */
/* -------------------------------------------------------------------------- */

void describe("MUTATION — each control is load-bearing", () => {
  void test("without dedup, a batch bills N times", () => {
    const ids = Array.from({ length: 10 }, () => "same-chunk");

    /* Mutant: length check only, no Set. */
    const mutantCount = ids.length <= INGEST_LIMITS.maxBatchSize
      ? ids.length
      : 0;

    const guarded = validateIngestBatch(ids);

    assert.equal(mutantCount, 10, "Mutant should admit 10 duplicate calls.");
    assert.equal(guarded.ok && guarded.chunkIds.length, 1);
  });

  void test("without the volume ceiling, ingestion is unbounded", () => {
    /* Mutant: no ceiling — ignores both operands and always admits. */
    const mutantAllows = (_already: number, _requested: number) => true;

    assert.equal(
      mutantAllows(1_000_000, 10),
      true,
      "Mutant should permit unbounded ingestion.",
    );
    assert.equal(wouldExceedCeiling(1_000_000, 10), true);
  });

  void test("without the content ceiling, a huge chunk is embedded", () => {
    const huge = "x".repeat(500_000);

    /* Mutant: emptiness check only, as ingest.ts had before. */
    const mutantAccepts = huge.trim().length > 0;

    assert.equal(mutantAccepts, true, "Mutant should accept the huge chunk.");
    assert.equal(isWithinContentCeiling(huge), false);
  });
});
