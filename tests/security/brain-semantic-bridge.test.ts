/**
 * SYRAVEN — the Brain is searchable by meaning, and only by what it holds
 * tests/security/brain-semantic-bridge.test.ts
 *
 * SECURITY / COST / PRODUCT-INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * Records live in public.knowledge; semantic retrieval reads
 * ai_knowledge_chunks. The bridge between them decides what text leaves
 * for a paid provider, whose rows are written, and what a search can
 * return. Each of those can fail in a way that looks like success:
 *
 *   - a passage that is not what the user wrote (summarised, truncated,
 *     or silently dropped past some length);
 *   - a second path to the provider that skips the spend gate and the
 *     ownership re-check ingestChunk already applies;
 *   - an index that outlives the record, so a deleted note still
 *     answers a search;
 *   - a similarity the page or route computed rather than the database,
 *     or a 200 with no results when no provider exists at all.
 *
 * The chunking rules are executed directly (knowledgeIndex.ts is pure).
 * The bridge and routes import server-only modules, so they are checked
 * at source, against comment-stripped code, in the order that matters.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CHUNK_POLICY,
  chunkText,
  contentHash,
  indexableText,
  normaliseText,
} from "../../lib/search/knowledgeIndex.ts";

const ROOT = process.cwd();

function raw(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

/** Executable code only: JSX, block and line comments removed. */
function code(...parts: string[]): string {
  return raw(...parts)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** The source between two markers; fails loudly if either is missing. */
function between(source: string, start: string, end: string | null): string {
  const from = source.indexOf(start);
  assert.ok(from !== -1, `marker not found: ${start}`);

  if (end === null) return source.slice(from);

  const to = source.indexOf(end, from + start.length);
  assert.ok(to !== -1, `marker not found: ${end}`);

  return source.slice(from, to);
}

function ordered(source: string, first: string, second: string, why: string): void {
  const a = source.indexOf(first);
  const b = source.indexOf(second);

  assert.ok(a !== -1, `${first} not found`);
  assert.ok(b !== -1, `${second} not found`);
  assert.ok(a < b, why);
}

/* -------------------------------------------------------------------------- */
/*                     PASSAGES ARE WHAT THE USER WROTE                        */
/* -------------------------------------------------------------------------- */

const SENTENCES = Array.from(
  { length: 200 },
  (_, index) => `Decision ${index} was recorded with its reason.`,
);

const LONG_TEXT = SENTENCES.join(" ");

void describe("A record becomes passages of what the user wrote", () => {
  void test("empty text is refused rather than indexed as nothing", () => {
    assert.deepEqual(chunkText("  \n\n\t "), { ok: false, reason: "EMPTY" });
  });

  void test("short text is one passage, verbatim", () => {
    assert.deepEqual(chunkText("Annual plans only, decided in March."), {
      ok: true,
      chunks: ["Annual plans only, decided in March."],
    });
  });

  void test("long text is split, and every passage is within the bound", () => {
    const plan = chunkText(LONG_TEXT);

    assert.ok(plan.ok);
    assert.ok(plan.chunks.length > 1, "8,000+ characters must not be one passage.");

    for (const chunk of plan.chunks) {
      assert.ok(
        chunk.length <= CHUNK_POLICY.targetCharacters,
        `A passage of ${chunk.length} characters exceeds the bound.`,
      );
    }
  });

  void test("nothing the user wrote is left out of the index", () => {
    const plan = chunkText(LONG_TEXT);
    assert.ok(plan.ok);

    for (const sentence of SENTENCES) {
      assert.ok(
        plan.chunks.some((chunk) => chunk.includes(sentence)),
        `"${sentence}" is in no passage whole -- it cannot be found by meaning.`,
      );
    }
  });

  void test("adjacent passages overlap, so a boundary cuts nothing in two", () => {
    const plan = chunkText(LONG_TEXT);
    assert.ok(plan.ok);

    for (let index = 1; index < plan.chunks.length; index += 1) {
      const head = plan.chunks[index]!.slice(0, 40);

      assert.ok(
        plan.chunks[index - 1]!.includes(head),
        `Passage ${index} does not begin inside passage ${index - 1}.`,
      );
    }
  });

  void test("text with no break point still terminates within the bound", () => {
    const unbroken = "x".repeat(5_000);
    const plan = chunkText(unbroken);

    assert.ok(plan.ok);
    assert.ok(plan.chunks.every((chunk) => chunk.length <= CHUNK_POLICY.targetCharacters));
    assert.ok(plan.chunks.join("").length >= unbroken.length);
  });

  void test("a record too long to index is refused whole, never cut short", () => {
    const tooLong = Array.from(
      { length: CHUNK_POLICY.maxChunksPerRecord * 40 },
      (_, index) => `Entry ${index} carries enough words to fill passages.`,
    ).join(" ");

    assert.deepEqual(chunkText(tooLong), { ok: false, reason: "TOO_LARGE" });
  });

  void test("passage size fits under the ingestion cost ceiling", () => {
    /*
     * ingestChunk refuses anything longer than maxChunkCharacters. A
     * larger target would produce passages that are written and then
     * refused forever -- a record that never finishes indexing.
     */
    const ceiling = raw("lib", "search", "ingestPolicy.ts").match(
      /maxChunkCharacters:\s*([\d_]+)/,
    );

    assert.ok(ceiling?.[1], "Could not read maxChunkCharacters.");
    assert.ok(CHUNK_POLICY.targetCharacters <= Number(ceiling[1].replace(/_/g, "")));
  });

  void test("title, description and content are indexed, in that order", () => {
    assert.equal(
      indexableText({ title: "Pricing", description: "Why", content: "Annual only." }),
      "Pricing\n\nWhy\n\nAnnual only.",
    );

    assert.equal(
      indexableText({ title: "Pricing", description: null, content: "Annual only." }),
      "Pricing\n\nAnnual only.",
    );
  });

  void test("the fingerprint changes when the text does, and only then", () => {
    const text = "Annual plans only.";

    assert.equal(contentHash(text), contentHash(text));
    assert.notEqual(contentHash(text), contentHash(`${text}!`));
    assert.match(contentHash(text), /^[0-9a-f]{64}$/);
  });

  void test("line endings alone do not make a record look edited", () => {
    assert.equal(normaliseText("a\r\nb\rc"), "a\nb\nc");
  });
});

/* -------------------------------------------------------------------------- */
/*                  THE BRIDGE REUSES THE CONTROLS IN FRONT OF IT              */
/* -------------------------------------------------------------------------- */

void describe("The bridge goes through ingestion's controls, never around them", () => {
  const BRIDGE = code("lib", "search", "knowledgeBridge.ts");
  const INDEXING = between(
    BRIDGE,
    "export async function indexKnowledgeRecord",
    "export async function removeKnowledgeIndex",
  );
  const REMOVAL = between(
    BRIDGE,
    "export async function removeKnowledgeIndex",
    "export async function listIndexState",
  );

  void test("it is server-only and never uses the service role", () => {
    assert.match(raw("lib", "search", "knowledgeBridge.ts"), /^import "server-only";/m);
    assert.ok(!/supabaseAdmin|service_role|SERVICE_ROLE/.test(BRIDGE));
  });

  void test("the record is read as the caller's before anything is written", () => {
    ordered(
      INDEXING,
      '.eq("user_id", session.userId)',
      "ensureBrainBase(session)",
      "Writing the chain before proving ownership lets a caller index someone else's record by id.",
    );
  });

  void test("the spend gate is passed before any passage is embedded", () => {
    ordered(
      INDEXING,
      "enforceIngestPolicy(",
      "ingestChunk(",
      "Embedding before the volume ceiling is checked is unbounded spend.",
    );
  });

  void test("vectors reach the database only through ingestChunk", () => {
    assert.ok(
      !/embedText\(|\.embed\(|createOpenAiEmbeddingClient/.test(BRIDGE),
      "A second path to the provider would skip ingestChunk's ownership re-check and cost ceiling.",
    );
  });

  void test("one call embeds at most one ingestion batch", () => {
    assert.match(INDEXING, /\.limit\(INGEST_LIMITS\.maxBatchSize\)/);
  });

  void test("unchanged text is reused; changed text is rebuilt from scratch", () => {
    assert.match(BRIDGE, /row\.content_hash === hash/);
    assert.match(
      BRIDGE,
      /\.from\("ai_knowledge_documents"\)\s*\.delete\(\)\s*\.eq\("knowledge_source_id", sourceId\)/,
      "Stale passages must be deleted, or a search returns text the record no longer has.",
    );
  });

  void test("a document whose passages failed to write is rolled back", () => {
    assert.match(
      BRIDGE,
      /if \(inserted\.error\)[\s\S]{0,400}?\.delete\(\)\s*\.eq\("id", documentId\)/,
      "An empty document would match the hash next time and be reused with nothing in it.",
    );
  });

  void test("'indexed' means no passage is left without a vector", () => {
    assert.match(INDEXING, /const state = remaining === 0 \? "indexed" : "partial";/);
  });

  void test("removal is scoped to the caller's bases and never unscoped", () => {
    assert.match(REMOVAL, /\.eq\("owner_id", session\.userId\)/);
    assert.match(REMOVAL, /if \(baseIds\.length === 0\) return \{ ok: true, removed: 0 \};/);
    assert.match(REMOVAL, /\.in\("knowledge_base_id", baseIds\)/);
  });
});

/* -------------------------------------------------------------------------- */
/*                THE ROUTES CHARGE, REFUSE AND REPORT HONESTLY                */
/* -------------------------------------------------------------------------- */

void describe("The routes charge, refuse and report honestly", () => {
  const INDEX = code("app", "api", "knowledge", "index", "route.ts");
  const SEMANTIC = code("app", "api", "knowledge", "semantic", "route.ts");
  const INDEX_POST = between(INDEX, "export const POST", null);

  void test("both are behind withAuth", () => {
    assert.match(INDEX, /export const GET = withAuth\(/);
    assert.match(INDEX, /export const POST = withAuth\(/);
    assert.match(SEMANTIC, /export const POST = withAuth\(/);
  });

  void test("indexing is rate limited on the ingest key before a client is built", () => {
    assert.match(INDEX_POST, /checkRateLimit\(\s*session\.supabase,\s*session\.userId,\s*INGEST_LIMITS\.rateLimitKey,?\s*\)/);
    ordered(INDEX_POST, "checkRateLimit(", "createOpenAiEmbeddingClient()", "The burst limit must come first.");
  });

  void test("without a provider, indexing is a 503 before anything is written", () => {
    ordered(
      INDEX_POST,
      "if (client === null)",
      "indexKnowledgeRecord(",
      "Passages written on a deployment with no provider can never be embedded.",
    );
    assert.match(INDEX_POST, /if \(client === null\) \{[\s\S]{0,200}?503/);
  });

  void test("search by meaning is rate limited on its own paid key", () => {
    assert.match(SEMANTIC, /const RATE_KEY = "embedding:query";/);
    ordered(SEMANTIC, "checkRateLimit(", "embedText(", "The paid call must not precede the limit.");
  });

  void test("an unconfigured provider is a 503, never an empty result", () => {
    assert.match(SEMANTIC, /if \(client === null\) \{[\s\S]{0,200}?503/);
    ordered(SEMANTIC, "if (client === null)", "retrieveSemantic(", "No provider must not look like no matches.");
  });

  void test("similarity is the database's number, passed through untouched", () => {
    assert.match(SEMANTIC, /similarity: chunk\.similarity,/);
    assert.ok(!/Math\.random|similarity:\s*1\b|cosine|dotProduct/.test(SEMANTIC));
  });

  void test("only records that still exist and are the caller's are returned", () => {
    assert.match(
      SEMANTIC,
      /\.from\("knowledge"\)\s*\.select\("id, title"\)\s*\.in\("id", recordIds\)\s*\.eq\("user_id", session\.userId\)/,
    );
    assert.match(SEMANTIC, /if \(title === undefined\) continue;/);
  });

  void test("identity is never read from the request body", () => {
    assert.ok(!/body\??\.(userId|user_id|ownerId|owner_id)/.test(INDEX + SEMANTIC));
  });

  void test("the query key is declared, and stricter than keyword search", () => {
    const meter = code("lib", "usage", "meter.ts");
    const query = meter.match(/"embedding:query":\s*\{\s*max:\s*(\d+)/);
    const search = meter.match(/"search:query":\s*\{\s*max:\s*(\d+)/);

    assert.ok(query?.[1], "embedding:query must be in RATE_LIMITS or every search is refused.");
    assert.ok(search?.[1]);
    assert.ok(Number(query[1]) < Number(search[1]));
  });
});

/* -------------------------------------------------------------------------- */
/*              DELETING OR EDITING A RECORD NEVER LEAVES IT SEARCHABLE        */
/* -------------------------------------------------------------------------- */

void describe("A deleted or edited record does not answer with old text", () => {
  const ROUTE = code("app", "api", "knowledge", "route.ts");
  const PATCH = between(ROUTE, "export const PATCH", "export const DELETE");
  const DELETE = between(ROUTE, "export const DELETE", null);

  void test("delete removes the index first, and keeps the record if it cannot", () => {
    ordered(
      DELETE,
      "removeKnowledgeIndex(session, id)",
      ".delete()",
      "Deleting the record first can leave its passages searchable.",
    );
    assert.match(DELETE, /if \(!unindexed\.ok\) \{[\s\S]{0,120}?500/);
  });

  void test("changing the text clears the index, and says so if it could not", () => {
    assert.match(PATCH, /"content" in updateData/);
    assert.match(PATCH, /"title" in updateData/);
    ordered(PATCH, ".update(updateData)", "removeKnowledgeIndex(session, id)", "Clear after the edit is saved.");
    assert.match(PATCH, /indexCleared \? \{\} : \{ indexStale: true \}/);
  });
});

/* -------------------------------------------------------------------------- */
/*                   THE PAGE SHOWS ONLY WHAT THE INDEX HOLDS                  */
/* -------------------------------------------------------------------------- */

void describe("The page claims only what the index reports", () => {
  const PAGE = code("app", "knowledge", "page.tsx");

  void test("it asks through the semantic route and reads real index state", () => {
    assert.match(PAGE, /fetch\("\/api\/knowledge\/semantic"/);
    assert.match(PAGE, /fetch\("\/api\/knowledge\/index"/);
  });

  void test("a match figure appears only when the server supplied one", () => {
    assert.match(PAGE, /typeof result\.similarity === "number"/);
    assert.ok(!/Math\.random/.test(PAGE));
  });

  void test("a record is marked searchable only from the server's answer", () => {
    assert.match(PAGE, /progress\.state === "indexed"/);
    assert.ok(
      !/\[knowledgeId\]: "indexed"/.test(PAGE),
      "Marking a card indexed on click claims work the server has not confirmed.",
    );
  });

  void test("an unconfigured deployment is told so", () => {
    assert.match(PAGE, /not configured on this deployment/);
  });

  void test("no button is nested inside a link", () => {
    for (const match of PAGE.matchAll(/<Link[\s\S]*?<\/Link>/g)) {
      assert.ok(!/<button/.test(match[0]), "A button inside a link is invalid and unreachable by keyboard.");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                   THE SIMILARITY FLOOR IS SET FROM MEASUREMENT              */
/* -------------------------------------------------------------------------- */

void describe("The similarity floor is set from measurement", () => {
  void test("it admits a measured match and refuses a measured non-match", () => {
    /*
     * Measured 2026-09-13 on the test project, text-embedding-3-small:
     * "what did we decide about billing?" scored 0.542 against a passage
     * on annual-only pricing and 0.217 against an unrelated hiring plan.
     * A floor above the first hides the right answer; a floor below the
     * second returns noise as if it were relevant.
     */
    const floor = code("lib", "search", "semantic.ts").match(
      /defaultThreshold:\s*([\d.]+)/,
    );

    assert.ok(floor?.[1], "Could not read defaultThreshold.");

    const value = Number(floor[1]);

    assert.ok(value > 0.217 && value < 0.542, `floor=${value}`);
  });
});
