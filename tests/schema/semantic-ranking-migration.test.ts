/**
 * SYRAVEN — Semantic ranking migration tests
 *
 * Phase 10.3 blocker resolution.
 *
 * `ai_knowledge_chunks` has no tenant column. Its only authorization
 * boundary is an RLS policy that resolves ownership through three
 * foreign keys and terminates in `auth.uid()`. A similarity function
 * over that table is therefore the single most dangerous object in the
 * schema: if it runs with the wrong privileges, it returns the rows most
 * semantically similar to the caller's question, drawn from every tenant
 * in the system.
 *
 * These tests assert the properties that keep it safe. They are static
 * assertions over the migration SQL — the object does not exist in any
 * database yet, so behavioural verification against a live schema is
 * listed in the report's verification plan and is NOT claimed here.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260906140000_syraven_semantic_ranking.sql",
);

/** Strips SQL comments so assertions test statements, not prose. */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

const RAW = existsSync(MIGRATION) ? readFileSync(MIGRATION, "utf8") : "";
const SQL = stripSqlComments(RAW);

/* -------------------------------------------------------------------------- */
/*                              THE CRITICAL ONE                              */
/* -------------------------------------------------------------------------- */

void describe("match_knowledge_chunks is SECURITY INVOKER", () => {
  void test("the migration exists", () => {
    assert.ok(RAW.length > 0, `Migration not found at ${MIGRATION}`);
  });

  void test("declares security invoker explicitly", () => {
    assert.match(
      SQL,
      /\bsecurity\s+invoker\b/i,
      "The function must state SECURITY INVOKER so RLS is enforced as the caller.",
    );
  });

  void test("NEVER declares security definer", () => {
    /*
     * The single most important assertion in this file. SECURITY DEFINER
     * would switch auth.uid() to the function owner and disable the only
     * authorization boundary this table has, turning a similarity search
     * into a full-corpus disclosure primitive.
     *
     * SCOPED TO THE DECLARATION, not the whole file. The phrase
     * legitimately appears twice in prose — once explaining why it is
     * forbidden, and once inside the COMMENT ON string that warns future
     * maintainers against it. Only the volatility/security clause of the
     * CREATE FUNCTION statement decides how the function actually runs,
     * so that is what is inspected.
     */
    const declaration = SQL.slice(
      SQL.indexOf("returns table"),
      SQL.indexOf("as $$"),
    );

    assert.ok(
      declaration.length > 0,
      "Could not isolate the function declaration.",
    );

    assert.ok(
      !/\bsecurity\s+definer\b/i.test(declaration),
      "CRITICAL: SECURITY DEFINER would bypass RLS on ai_knowledge_chunks.",
    );

    assert.match(
      declaration,
      /\bsecurity\s+invoker\b/i,
      "The declaration must state SECURITY INVOKER.",
    );
  });

  void test("pins search_path", () => {
    assert.match(
      SQL,
      /set\s+search_path\s*=\s*public/i,
      "An unpinned search_path lets a caller redirect name resolution.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          NO IDENTITY PARAMETERS                            */
/* -------------------------------------------------------------------------- */

void describe("The function accepts no forgeable identity", () => {
  const signature = SQL.slice(
    SQL.indexOf("create or replace function"),
    SQL.indexOf("returns table"),
  );

  void test("takes exactly the four approved parameters", () => {
    for (const param of [
      "query_embedding",
      "match_threshold",
      "match_count",
      "knowledge_base",
    ]) {
      assert.ok(
        signature.includes(param),
        `Approved parameter ${param} is missing.`,
      );
    }
  });

  void test("accepts no user, tenant, or organization id", () => {
    /*
     * Identity must come only from auth.uid() inside the RLS policies.
     * A user_id parameter would be caller-supplied and therefore
     * forgeable — the IDOR class this architecture exists to prevent.
     *
     * `knowledge_base` is permitted: it NARROWS within the RLS-authorized
     * set and cannot widen it.
     */
    assert.ok(
      !/\b(user_id|p_user|owner_id|tenant_id|organization_id|auth_uid)\b/i.test(
        signature,
      ),
      "CRITICAL: the function takes a caller-supplied identity parameter.",
    );
  });

  void test("does not read identity from a settable variable", () => {
    assert.ok(
      !/current_setting\s*\(/i.test(SQL),
      "Identity must come from auth.uid(), not a session variable a caller can set.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            BOUNDED PARAMETERS                              */
/* -------------------------------------------------------------------------- */

void describe("Parameters are bounded in SQL", () => {
  void test("match_count is clamped to 1..50", () => {
    assert.match(
      SQL.replace(/\s+/g, " "),
      /limit\s+least\s*\(\s*greatest\s*\(\s*match_count\s*,\s*1\s*\)\s*,\s*50\s*\)/i,
      "match_count must be clamped server-side; a caller must not request 10000 rows.",
    );
  });

  void test("match_threshold is clamped to 0..1", () => {
    assert.match(
      SQL.replace(/\s+/g, " "),
      /least\s*\(\s*greatest\s*\(\s*match_threshold\s*,\s*0\.0\s*\)\s*,\s*1\.0\s*\)/i,
      "match_threshold must be clamped to the cosine similarity domain.",
    );
  });

  void test("the clamps are in SQL, not left to the application", () => {
    /*
     * A bound enforced only in TypeScript holds only for callers that go
     * through TypeScript. These must hold for any caller of the RPC.
     */
    const body = SQL.slice(SQL.indexOf("as $$"));

    assert.ok(body.includes("least("), "Clamping must live in the function body.");
    assert.ok(body.includes("greatest("));
  });
});

/* -------------------------------------------------------------------------- */
/*                         EMBEDDINGS NEVER RETURNED                          */
/* -------------------------------------------------------------------------- */

void describe("Raw vectors are never returned", () => {
  const returns = SQL.slice(
    SQL.indexOf("returns table"),
    SQL.indexOf("language sql"),
  );

  void test("the return type omits the embedding column", () => {
    assert.ok(
      !/\bembedding\b/.test(returns),
      "Returning raw vectors lets a caller reconstruct corpus geometry.",
    );
  });

  void test("the return type exposes only the approved columns", () => {
    for (const column of [
      "id",
      "knowledge_document_id",
      "content",
      "chunk_index",
      "similarity",
    ]) {
      assert.ok(returns.includes(column), `Return column ${column} is missing.`);
    }
  });

  void test("similarity is a scalar, not the vector itself", () => {
    assert.match(
      SQL.replace(/\s+/g, " "),
      /1\s*-\s*\(\s*c\.embedding\s*<=>\s*query_embedding\s*\)\s+as\s+similarity/i,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         DIMENSION AND OPERATOR                             */
/* -------------------------------------------------------------------------- */

void describe("The migration matches the application contract", () => {
  const SEMANTIC = readFileSync(
    join(process.cwd(), "lib", "search", "semantic.ts"),
    "utf8",
  );
  const VECTOR = readFileSync(
    join(process.cwd(), "lib", "search", "vector.ts"),
    "utf8",
  );

  void test("the function name matches RETRIEVAL_CONTRACT.rpcName", () => {
    assert.match(SEMANTIC, /rpcName\s*:\s*["'`]match_knowledge_chunks["'`]/);
    assert.match(SQL, /function\s+public\.match_knowledge_chunks/i);
  });

  void test("the security mode matches RETRIEVAL_CONTRACT.rpcSecurity", () => {
    assert.match(SEMANTIC, /rpcSecurity\s*:\s*["'`]INVOKER["'`]/);
    assert.match(SQL, /security\s+invoker/i);
  });

  void test("the distance operator matches the declared contract", () => {
    assert.match(SEMANTIC, /distanceOperator\s*:\s*["'`]<=>["'`]/);
    assert.ok(SQL.includes("<=>"));
  });

  void test("the vector dimension is 1536 everywhere", () => {
    assert.match(VECTOR, /EMBEDDING_DIMENSIONS\s*=\s*1536/);
    assert.match(SQL, /vector\(1536\)/);
  });

  void test("the index opclass matches the query operator", () => {
    /*
     * `<=>` is cosine distance. An index built with a different opclass
     * (l2_ops, ip_ops) would simply never be used by this query — a
     * silent performance cliff rather than an error.
     */
    assert.match(SQL, /using\s+hnsw\s*\(\s*embedding\s+vector_cosine_ops\s*\)/i);
    assert.match(VECTOR, /distance\s*:\s*["'`]cosine["'`]/);
  });
});

/* -------------------------------------------------------------------------- */
/*                                 THE INDEX                                  */
/* -------------------------------------------------------------------------- */

void describe("The ANN index is HNSW and safely built", () => {
  void test("uses HNSW, not IVFFlat", () => {
    assert.match(SQL, /using\s+hnsw/i);
    assert.ok(
      !/using\s+ivfflat/i.test(SQL),
      "IVFFlat cannot be built usefully on an empty table.",
    );
  });

  void test("is idempotent", () => {
    assert.match(SQL, /create\s+index\s+if\s+not\s+exists/i);
  });

  void test("does not use CONCURRENTLY", () => {
    /*
     * CREATE INDEX CONCURRENTLY cannot run inside a transaction block,
     * which would break the migration's atomicity. On an empty table a
     * plain build is instantaneous, so CONCURRENTLY buys nothing.
     */
    assert.ok(
      !/concurrently/i.test(SQL),
      "CONCURRENTLY would break the migration transaction.",
    );
  });

  void test("does not hard-code ef_search", () => {
    /*
     * ef_search trades query cost for recall and must be tuned against
     * real data. Fixing it while the table is empty would be a guess
     * baked into the schema.
     */
    assert.ok(!/ef_search/i.test(stripSqlComments(RAW).toLowerCase()));
  });
});

/* -------------------------------------------------------------------------- */
/*                          RLS IS LEFT UNTOUCHED                             */
/* -------------------------------------------------------------------------- */

void describe("Existing RLS is preserved", () => {
  void test("creates, alters or drops no policy", () => {
    for (const forbidden of [
      /create\s+policy/i,
      /alter\s+policy/i,
      /drop\s+policy/i,
    ]) {
      assert.ok(
        !forbidden.test(SQL),
        `This migration must not touch RLS policies (matched ${forbidden}).`,
      );
    }
  });

  void test("does not disable row level security", () => {
    assert.ok(
      !/disable\s+row\s+level\s+security/i.test(SQL),
      "CRITICAL: RLS must remain enabled on ai_knowledge_chunks.",
    );
  });

  void test("alters no table", () => {
    assert.ok(
      !/alter\s+table/i.test(SQL),
      "This migration is additive: one index and one function.",
    );
  });

  void test("grants execute to authenticated and revokes it from anon", () => {
    assert.match(SQL, /grant\s+execute[\s\S]*?to\s+authenticated/i);
    assert.match(SQL, /revoke\s+execute[\s\S]*?from\s+anon/i);
  });
});
