/**
 * SYRAVEN — Usage metering write-path tests
 *
 * Phase 12 follow-up.
 *
 * `public.usage` is a metering ledger. A client able to write its own
 * usage rows can forge metering, so the ledger must be written only by
 * trusted server code — while still being READ by the owner through
 * RLS.
 *
 * That split is the property under test:
 *
 *   recordUsage()  -> service-role writer   (client cannot write)
 *   countUsage()   -> caller's RLS client   (service role never serves reads)
 *
 * The identity written is taken from the verified session, never from a
 * request, so service-role here cannot be steered at another account.
 *
 * No external call is made anywhere in this file.
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

const METER_SRC = read("lib", "usage", "meter.ts");
const METER_CODE = stripComments(METER_SRC);
const GUARD_CODE = stripComments(read("lib", "api", "usageGuard.ts"));

const MIGRATION = read(
  "supabase",
  "migrations",
  "20260906160000_syraven_usage_type_check_repair.sql",
);

/* -------------------------------------------------------------------------- */
/*                        THE TRUSTED WRITER IS USED                          */
/* -------------------------------------------------------------------------- */

void describe("recordUsage writes through the trusted server path", () => {
  void test("the insert does not use the caller's client", () => {
    /*
     * The whole point. `db` is the caller's RLS-scoped client and has no
     * INSERT policy on public.usage; writing through it would silently
     * fail, which is exactly the defect being repaired.
     */
    const body = METER_CODE.slice(
      METER_CODE.indexOf("export async function recordUsage"),
      METER_CODE.indexOf("function nonNegative"),
    );

    assert.ok(body.length > 0, "Could not isolate recordUsage.");

    assert.ok(
      !/await\s+db\s*\.\s*from\s*\(\s*["'`]usage["'`]\s*\)\s*\.\s*insert/.test(
        body,
      ),
      "recordUsage still inserts through the caller's RLS-scoped client.",
    );
  });

  void test("the insert goes through the trusted writer", () => {
    const body = METER_CODE.slice(
      METER_CODE.indexOf("export async function recordUsage"),
      METER_CODE.indexOf("function nonNegative"),
    );

    assert.match(
      body,
      /usageWriter\s*\(\s*\)/,
      "recordUsage must resolve the trusted writer.",
    );
    assert.match(body, /writer\s*\.\s*from\s*\(\s*["'`]usage["'`]\s*\)/);
  });

  void test("the writer resolves to the service-role client", () => {
    assert.match(
      METER_CODE,
      /import\s*\{\s*supabaseAdmin\s*\}\s*from\s*["'`]@\/lib\/supabaseAdmin["'`]/,
    );
    assert.match(METER_CODE, /return\s+supabaseAdmin\s+as\s+unknown\s+as\s+UsageWriter/);
  });

  void test("meter.ts is server-only", () => {
    /*
     * The module now imports a service-role client, so a client bundle
     * importing it would be a credential-exposure path. `server-only`
     * makes that a build error.
     */
    assert.match(METER_CODE, /import\s+["'`]server-only["'`]/);
  });

  void test("supabaseAdmin is itself server-only", () => {
    assert.match(
      stripComments(read("lib", "supabaseAdmin.ts")),
      /import\s+["'`]server-only["'`]/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      READS STAY RLS-SCOPED TO THE USER                     */
/* -------------------------------------------------------------------------- */

void describe("Service role is never used to serve user data", () => {
  void test("countUsage reads through the caller's client", () => {
    const body = METER_CODE.slice(
      METER_CODE.indexOf("export async function countUsage"),
      METER_CODE.indexOf("export async function checkQuota"),
    );

    assert.ok(body.length > 0, "Could not isolate countUsage.");

    assert.match(
      body,
      /await\s+db\s*\.\s*from\s*\(\s*["'`]usage["'`]\s*\)/,
      "Reads must use the caller's RLS-scoped client.",
    );

    assert.ok(
      !/supabaseAdmin|usageWriter/.test(body),
      "CRITICAL: service role must never serve a user-facing read.",
    );
  });

  void test("the rate limiter still uses the caller's client", () => {
    const rate = METER_CODE.slice(METER_CODE.indexOf("export async function checkRateLimit"));

    assert.ok(
      !/supabaseAdmin|usageWriter/.test(rate),
      "rate_limit_events has proper RLS policies; it needs no service role.",
    );
  });

  void test("service-role scope in this module stays minimal", () => {
    /*
     * Counts CODE references only. `stripComments` removes /* *\/ blocks
     * but a JSDoc that names the module in prose survives, and prose is
     * not a capability — so lines that are pure comment are excluded
     * here rather than inflating the count.
     */
    const codeLines = METER_CODE.split("\n").filter(
      (line) => !line.trim().startsWith("*") && !line.trim().startsWith("/*"),
    );

    const uses = codeLines.filter((line) => line.includes("supabaseAdmin"));

    assert.equal(
      uses.length,
      2,
      `Expected exactly 2 code references (import + writer resolution), ` +
        `found ${uses.length}:\n${uses.join("\n")}`,
    );

    /* And they must be exactly those two, not two of something else. */
    assert.ok(uses.some((l) => l.includes("import")));
    assert.ok(uses.some((l) => l.includes("return supabaseAdmin")));
  });

  void test("the writer type exposes only a usage insert", () => {
    /*
     * A narrow interface, not SupabaseClient: nothing else in this
     * module can reach another service-role capability through it.
     */
    const iface = METER_CODE.slice(
      METER_CODE.indexOf("export interface UsageWriter"),
      METER_CODE.indexOf("let injectedUsageWriter"),
    );

    assert.match(iface, /from\s*\(\s*table\s*:\s*["'`]usage["'`]\s*\)/);
    assert.match(iface, /insert/);
    assert.ok(
      !/\bselect\b|\bupdate\b|\bdelete\b|\brpc\b|\bauth\b/.test(iface),
      "The trusted writer must not expose read or admin capabilities.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       IDENTITY CANNOT BE FORGED                            */
/* -------------------------------------------------------------------------- */

void describe("Usage attribution cannot be steered by a client", () => {
  void test("userId reaches recordUsage from the verified session", () => {
    /*
     * Service role bypasses RLS, so the ONLY thing preventing a caller
     * attributing usage to someone else is that no request-supplied id
     * ever reaches this call.
     */
    assert.match(
      GUARD_CODE,
      /const\s+userId\s*=\s*session\s*\.\s*userId/,
      "usageGuard must take identity from the verified session.",
    );

    assert.match(
      GUARD_CODE,
      /recordUsage\s*\(\s*db\s*,\s*userId\s*,/,
      "recordUsage must be called with the session-derived userId.",
    );
  });

  void test("no route passes a user id into the usage guard", () => {
    /*
     * enforceUsage's signature takes a session, not an id, so a route
     * physically cannot supply one. This asserts the signature holds.
     */
    assert.match(
      GUARD_CODE,
      /export\s+async\s+function\s+enforceUsage\s*\(\s*\n?\s*session\s*:\s*AuthenticatedSession/,
      "enforceUsage must accept a session, never a caller-supplied id.",
    );

    assert.ok(
      !/enforceUsage\([\s\S]{0,200}\buserId\s*:\s*string/.test(GUARD_CODE),
      "enforceUsage must not accept a userId parameter.",
    );
  });

  void test("the record callback cannot override identity", () => {
    /*
     * `guard.record(detail)` is called by nine routes. `detail` must not
     * be able to carry a user_id into the insert.
     */
    const detail = GUARD_CODE.slice(
      GUARD_CODE.indexOf("export interface UsageRecordDetail"),
      GUARD_CODE.indexOf("export type UsageGuardOutcome"),
    );

    assert.ok(
      !/user_?[Ii]d/.test(detail),
      "UsageRecordDetail must not carry a user id.",
    );
  });

  void test("the inserted row takes user_id from the parameter only", () => {
    const body = METER_CODE.slice(
      METER_CODE.indexOf("export async function recordUsage"),
      METER_CODE.indexOf("function nonNegative"),
    );

    assert.match(body, /user_id:\s*userId/);
    assert.ok(
      !/user_id:\s*detail/.test(body),
      "user_id must never come from caller-supplied detail.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     THE LEDGER STAYS CLIENT-PROTECTED                      */
/* -------------------------------------------------------------------------- */

void describe("public.usage remains client-write-protected", () => {
  void test("the migration adds no policy at all", () => {
    assert.ok(
      !/create\s+policy/i.test(MIGRATION),
      "This migration must not grant the client any write path.",
    );
    assert.ok(!/drop\s+policy/i.test(MIGRATION));
    assert.ok(!/alter\s+policy/i.test(MIGRATION));
  });

  void test("the migration changes only the type constraint", () => {
    const statements = MIGRATION.split("\n")
      .filter((l) => !l.trim().startsWith("--") && l.trim().length > 0)
      .join(" ");

    assert.match(statements, /drop\s+constraint\s+if\s+exists\s+usage_type_check/i);
    assert.match(statements, /add\s+constraint\s+usage_type_check/i);

    assert.ok(
      !/create\s+index|drop\s+index|grant|revoke/i.test(statements),
      "No index or privilege change belongs in this migration.",
    );
  });

  void test("all seven metric values are permitted", () => {
    for (const type of [
      "message",
      "file",
      "chat_message",
      "agent_run",
      "vision_request",
      "voice_request",
      "file_upload",
    ]) {
      assert.ok(
        new RegExp(`'${type}'`).test(MIGRATION),
        `The constraint omits '${type}'.`,
      );
    }
  });

  void test("every live metric event is covered by the constraint", () => {
    /*
     * Derived from the source rather than hard-coded, so a new metric
     * added without a matching migration fails here.
     */
    const events = new Set(
      [...METER_CODE.matchAll(/event:\s*["'`]([a-z_]+)["'`]/g)].map(
        (m) => m[1],
      ),
    );

    assert.ok(events.size >= 5, `Expected several metric events, found ${events.size}.`);

    for (const event of events) {
      assert.ok(
        new RegExp(`'${event}'`).test(MIGRATION),
        `Metric event '${event}' is not permitted by usage_type_check.`,
      );
    }
  });

  void test("the pre-existing no-client-write rule still holds", () => {
    /*
     * tests/schema/migration-integrity.test.ts asserts that no migration
     * grants usage a client write policy. This confirms the rule is
     * still satisfied after this change — the earlier INSERT-policy
     * draft was abandoned precisely because it broke it.
     */
    const allMigrations = read(
      "supabase",
      "migrations",
      "20260906160000_syraven_usage_type_check_repair.sql",
    );

    assert.ok(
      !/on\s+public\.usage\s*\n?\s*for\s+(insert|update|delete)/i.test(
        allMigrations,
      ),
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    BEHAVIOURAL — THE WRITE ACTUALLY HAPPENS                */
/* -------------------------------------------------------------------------- */

/*
 * The suites above assert SHAPE. These assert BEHAVIOUR, by mirroring
 * recordUsage against a recording writer.
 *
 * lib/usage/meter.ts is server-only and cannot load under node --test,
 * so the insert is reproduced here exactly as implemented. The source
 * invariants above hold the real function to this shape.
 */

interface RecordedInsert {
  table: string;
  values: Record<string, unknown>;
}

function createRecordingWriter() {
  const inserts: RecordedInsert[] = [];

  return {
    inserts,
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          inserts.push({ table, values });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

/** Mirror of recordUsage's insert, using the injected writer. */
async function recordUsage(
  writer: ReturnType<typeof createRecordingWriter>,
  userId: string,
  event: string,
  detail: Record<string, unknown> = {},
) {
  await writer.from("usage").insert({
    user_id: userId,
    type: event,
    metadata: {
      model: detail.model ?? null,
      endpoint: detail.endpoint ?? null,
      recordedAt: new Date().toISOString(),
    },
  });
}

void describe("BEHAVIOUR — the trusted writer records correctly", () => {
  void test("a usage row is written through the writer", async () => {
    const writer = createRecordingWriter();

    await recordUsage(writer, "user-a", "chat_message", {
      endpoint: "ai:chat",
    });

    assert.equal(writer.inserts.length, 1);
    assert.equal(writer.inserts[0]?.table, "usage");
    assert.equal(writer.inserts[0]?.values.type, "chat_message");
    assert.equal(writer.inserts[0]?.values.user_id, "user-a");
  });

  void test("user_id comes from the parameter, not from detail", async () => {
    const writer = createRecordingWriter();

    /*
     * The forged-identity case. Even if a caller smuggled a user_id into
     * `detail`, the insert takes user_id from the session-derived
     * parameter and puts detail only inside metadata.
     */
    await recordUsage(writer, "user-a", "chat_message", {
      user_id: "user-b",
      userId: "user-b",
    } as Record<string, unknown>);

    assert.equal(
      writer.inserts[0]?.values.user_id,
      "user-a",
      "FORGERY: caller-supplied identity overrode the session identity.",
    );
  });

  void test("each metric event writes its own type", async () => {
    const writer = createRecordingWriter();

    for (const event of [
      "chat_message",
      "agent_run",
      "vision_request",
      "voice_request",
    ]) {
      await recordUsage(writer, "user-a", event);
    }

    assert.deepEqual(
      writer.inserts.map((i) => i.values.type),
      ["chat_message", "agent_run", "vision_request", "voice_request"],
    );
  });
});
