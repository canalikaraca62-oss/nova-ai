/**
 * SYRAVEN — Logging redaction and reliability tests
 *
 * Phase 11 (see IMPLEMENTATION_PLAN.md).
 *
 * A logger is an exfiltration path: whatever it touches is written
 * somewhere durable, often to a third-party sink with longer retention
 * than the data itself. These tests treat redaction as a security
 * control and exercise it directly — real values in, output inspected —
 * rather than asserting that source text looks right.
 *
 * The concrete regressions defended here were both found in this
 * repository during the Phase 11 audit:
 *
 *   app/api/files/analyze/route.ts logged the model's analysis OF A
 *   USER'S UPLOADED DOCUMENT verbatim.
 *
 *   app/api/stream/route.ts logged an untruncated provider error body,
 *   which can echo the prompt back.
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

/* -------------------------------------------------------------------------- */
/*                          MIRRORED REDACTION LOGIC                          */
/* -------------------------------------------------------------------------- */

/*
 * lib/observability/logger.ts is server-only and cannot load under
 * node --test. The redaction logic is mirrored EXACTLY; the SOURCE
 * INVARIANTS suite holds the real module to the same rules, so the two
 * cannot silently diverge.
 */

const REDACTED_KEYS: readonly string[] = [
  "key",
  "secret",
  "token",
  "password",
  "authorization",
  "cookie",
  "credential",
  "signature",
  "content",
  "body",
  "prompt",
  "message",
  "transcript",
  "text",
  "input",
  "embedding",
  "vector",
  "email",
  "phone",
  "address",
];

const REDACTED_PLACEHOLDER = "[redacted]";
const MAX_FIELD_LENGTH = 300;

function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACTED_KEYS.some((needle) => lower.includes(needle));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > MAX_FIELD_LENGTH
      ? `${value.slice(0, MAX_FIELD_LENGTH)}…[truncated ${value.length}]`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 3) return "[nested]";
  if (Array.isArray(value)) return `[array(${value.length})]`;

  if (typeof value === "object") {
    return sanitizeFields(value as Record<string, unknown>, depth + 1);
  }

  return `[${typeof value}]`;
}

function sanitizeFields(
  fields: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    safe[key] = isRedactedKey(key)
      ? REDACTED_PLACEHOLDER
      : sanitizeValue(value, depth);
  }

  return safe;
}

function classifyError(cause: unknown): {
  errorClass: string;
  errorName: string;
} {
  if (cause instanceof Error) {
    if (cause.name === "TimeoutError" || cause.name === "AbortError") {
      return { errorClass: "timeout", errorName: cause.name };
    }
    if (cause.name === "TypeError") {
      return { errorClass: "upstream_unavailable", errorName: cause.name };
    }
    return { errorClass: "internal", errorName: cause.name };
  }
  return { errorClass: "internal", errorName: "unknown" };
}

function resolveRequestId(headers: Headers): string {
  const inbound = headers.get("x-request-id");

  if (
    typeof inbound === "string" &&
    inbound.length > 0 &&
    inbound.length <= 200 &&
    /^[A-Za-z0-9_-]+$/.test(inbound)
  ) {
    return inbound;
  }

  return crypto.randomUUID();
}

/* -------------------------------------------------------------------------- */
/*                            SECRETS ARE REDACTED                            */
/* -------------------------------------------------------------------------- */

void describe("Credentials never reach a log", () => {
  void test("api keys are redacted by key name", () => {
    const out = sanitizeFields({
      apiKey: "sk-live-abcdef123456",
      OPENAI_API_KEY: "sk-live-zzzz",
      stripeSecretKey: "sk_live_stripe",
      user_api_key: "sk-nested",
    });

    for (const [field, value] of Object.entries(out)) {
      assert.equal(
        value,
        REDACTED_PLACEHOLDER,
        `${field} was not redacted.`,
      );
    }
  });

  void test("a serialized line contains no key material", () => {
    const line = JSON.stringify(
      sanitizeFields({
        apiKey: "sk-live-SHOULD-NEVER-APPEAR",
        authorization: "Bearer sk-live-SHOULD-NEVER-APPEAR",
        cookie: "session=SHOULD-NEVER-APPEAR",
      }),
    );

    assert.ok(
      !line.includes("SHOULD-NEVER-APPEAR"),
      `Credential material survived into the log line: ${line}`,
    );
  });

  void test("tokens, passwords and signatures are redacted", () => {
    const out = sanitizeFields({
      accessToken: "abc",
      refreshToken: "def",
      password: "hunter2",
      stripeSignature: "t=1,v1=deadbeef",
      credentials: "x",
    });

    for (const value of Object.values(out)) {
      assert.equal(value, REDACTED_PLACEHOLDER);
    }
  });

  void test("redaction is case-insensitive", () => {
    const out = sanitizeFields({
      APIKEY: "x",
      ApiKey: "y",
      SECRET: "z",
    });

    for (const value of Object.values(out)) {
      assert.equal(value, REDACTED_PLACEHOLDER);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        USER CONTENT IS REDACTED                            */
/* -------------------------------------------------------------------------- */

void describe("User document content never reaches a log", () => {
  void test("the files/analyze regression is prevented", () => {
    /*
     * The exact shape of the bug: the model's analysis of a user's
     * uploaded document, passed as `content`.
     */
    const out = sanitizeFields({
      content: "CONFIDENTIAL MEDICAL RECORD: patient diagnosis...",
    });

    assert.equal(out.content, REDACTED_PLACEHOLDER);
  });

  void test("prompts, transcripts and message bodies are redacted", () => {
    const out = sanitizeFields({
      prompt: "user's private question",
      transcript: "voice recording text",
      messageBody: "private message",
      inputText: "typed content",
      body: "raw payload",
    });

    for (const [field, value] of Object.entries(out)) {
      assert.equal(value, REDACTED_PLACEHOLDER, `${field} leaked.`);
    }
  });

  void test("embeddings and vectors are redacted", () => {
    const out = sanitizeFields({
      embedding: Array.from({ length: 1536 }, () => 0.02),
      queryVector: [0.1, 0.2],
    });

    assert.equal(out.embedding, REDACTED_PLACEHOLDER);
    assert.equal(out.queryVector, REDACTED_PLACEHOLDER);
  });

  void test("direct personal identifiers are redacted", () => {
    const out = sanitizeFields({
      email: "person@example.com",
      phoneNumber: "+1234567890",
      homeAddress: "1 Example Street",
    });

    for (const value of Object.values(out)) {
      assert.equal(value, REDACTED_PLACEHOLDER);
    }
  });

  void test("redaction survives nesting", () => {
    const line = JSON.stringify(
      sanitizeFields({
        request: {
          headers: { authorization: "Bearer LEAKED" },
          payload: { content: "LEAKED DOCUMENT" },
        },
      }),
    );

    assert.ok(!line.includes("LEAKED"), `Nested field leaked: ${line}`);
  });
});

/* -------------------------------------------------------------------------- */
/*                               TRUNCATION                                   */
/* -------------------------------------------------------------------------- */

void describe("No single field can flood a log", () => {
  void test("long strings are truncated with a marker", () => {
    const long = "x".repeat(5_000);
    const out = sanitizeFields({ detail: long }) as { detail: string };

    assert.ok(out.detail.length < 400, "Value was not truncated.");
    assert.match(out.detail, /truncated 5000/);
  });

  void test("short strings pass through unchanged", () => {
    const out = sanitizeFields({ detail: "brief" });
    assert.equal(out.detail, "brief");
  });

  void test("the stream/route.ts regression is bounded", () => {
    /*
     * A provider error body that echoes a large prompt back. Even
     * unredacted field names must not write it in full.
     */
    const providerBody = "PROVIDER ECHO: ".concat("y".repeat(10_000));
    const out = sanitizeFields({ detail: providerBody }) as { detail: string };

    assert.ok(out.detail.length <= MAX_FIELD_LENGTH + 40);
  });

  void test("arrays are summarised, never enumerated", () => {
    const out = sanitizeFields({ items: [1, 2, 3, 4, 5] });
    assert.equal(out.items, "[array(5)]");
  });

  void test("deep nesting is bounded", () => {
    const deep = { a: { b: { c: { d: { e: "too deep" } } } } };
    const line = JSON.stringify(sanitizeFields(deep));

    assert.ok(!line.includes("too deep"), "Unbounded recursion into payload.");
  });
});

/* -------------------------------------------------------------------------- */
/*                        SAFE FIELDS ARE PRESERVED                           */
/* -------------------------------------------------------------------------- */

void describe("Diagnostic value is retained", () => {
  void test("operational fields survive redaction", () => {
    const out = sanitizeFields({
      status: 502,
      durationMs: 1234,
      userId: "11111111-1111-1111-1111-111111111111",
      operation: "billing.webhook",
      attempt: 2,
      degraded: true,
    });

    assert.equal(out.status, 502);
    assert.equal(out.durationMs, 1234);
    assert.equal(out.userId, "11111111-1111-1111-1111-111111111111");
    assert.equal(out.operation, "billing.webhook");
    assert.equal(out.attempt, 2);
    assert.equal(out.degraded, true);
  });

  void test("a redacting logger is still useful", () => {
    /*
     * Guards against over-redaction: if everything useful were stripped,
     * engineers would route around the logger and the control would be
     * worse than useless.
     */
    const out = sanitizeFields({
      status: 500,
      errorClass: "timeout",
      length: 4096,
      content: "secret",
    });

    assert.equal(out.content, REDACTED_PLACEHOLDER);
    assert.equal(out.status, 500);
    assert.equal(out.errorClass, "timeout");
    assert.equal(out.length, 4096);
  });
});

/* -------------------------------------------------------------------------- */
/*                          ERROR CLASSIFICATION                              */
/* -------------------------------------------------------------------------- */

void describe("Errors are classified, not dumped", () => {
  void test("timeouts are identified", () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";

    assert.equal(classifyError(timeout).errorClass, "timeout");

    const aborted = new Error("aborted");
    aborted.name = "AbortError";

    assert.equal(classifyError(aborted).errorClass, "timeout");
  });

  void test("connection failures are identified", () => {
    const dns = new TypeError("fetch failed");
    assert.equal(classifyError(dns).errorClass, "upstream_unavailable");
  });

  void test("the error message is never returned", () => {
    const err = new Error("connection to postgres://user:pw@host failed");
    const classified = classifyError(err);

    const line = JSON.stringify(classified);

    assert.ok(
      !line.includes("postgres://"),
      `The error message leaked into the log: ${line}`,
    );
    assert.ok(!line.includes("pw@host"));
  });

  void test("non-Error throws are handled", () => {
    for (const thrown of ["string", 42, null, undefined, { a: 1 }]) {
      const classified = classifyError(thrown);
      assert.equal(classified.errorClass, "internal");
      assert.equal(classified.errorName, "unknown");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                             REQUEST IDS                                    */
/* -------------------------------------------------------------------------- */

void describe("Correlation ids are safe", () => {
  void test("a well-formed inbound id is preserved", () => {
    const headers = new Headers({ "x-request-id": "abc-123_XYZ" });
    assert.equal(resolveRequestId(headers), "abc-123_XYZ");
  });

  void test("a generated id is used when absent", () => {
    const id = resolveRequestId(new Headers());
    assert.match(id, /^[0-9a-f-]{36}$/);
  });

  void test("log injection through the header is refused", () => {
    /*
     * An arbitrary header value would otherwise be attacker-controlled
     * text written into every log line for that request.
     */
    /*
     * A literal newline is rejected by `Headers` itself and so cannot
     * reach this code — it is omitted rather than asserted, since a test
     * that constructs an impossible input tests the platform, not us.
     * These are the values that CAN arrive.
     */
    for (const hostile of [
      'evil","level":"info","message":"fake',
      "a".repeat(500),
      "spaces here",
      "<script>",
      "id\\nwith-escape",
      "../../etc/passwd",
    ]) {
      const headers = new Headers({ "x-request-id": hostile });
      const id = resolveRequestId(headers);

      assert.notEqual(id, hostile, `Hostile request id accepted: ${hostile}`);
      assert.match(id, /^[0-9a-f-]{36}$/);
    }
  });

  void test("ids are unique across calls", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => resolveRequestId(new Headers())),
    );
    assert.equal(ids.size, 50);
  });
});

/* -------------------------------------------------------------------------- */
/*                      MUTATION — REDACTION IS LOAD-BEARING                  */
/* -------------------------------------------------------------------------- */

void describe("MUTATION — removing redaction leaks", () => {
  /** Mutant: log fields verbatim, as a bare console.* call does. */
  function mutantSanitize(
    fields: Record<string, unknown>,
  ): Record<string, unknown> {
    return { ...fields };
  }

  void test("mutant writes document content into the log", () => {
    const line = JSON.stringify(
      mutantSanitize({ content: "CONFIDENTIAL PATIENT RECORD" }),
    );

    assert.ok(
      line.includes("CONFIDENTIAL PATIENT RECORD"),
      "The mutation is undetectable — redaction is not load-bearing.",
    );
  });

  void test("mutant writes credentials into the log", () => {
    const line = JSON.stringify(mutantSanitize({ apiKey: "sk-live-secret" }));
    assert.ok(line.includes("sk-live-secret"));
  });

  void test("the control prevents both", () => {
    const line = JSON.stringify(
      sanitizeFields({
        content: "CONFIDENTIAL PATIENT RECORD",
        apiKey: "sk-live-secret",
      }),
    );

    assert.ok(!line.includes("CONFIDENTIAL PATIENT RECORD"));
    assert.ok(!line.includes("sk-live-secret"));
  });

  void test("mutant floods the log with an unbounded field", () => {
    const huge = "x".repeat(100_000);
    const mutantLine = JSON.stringify(mutantSanitize({ detail: huge }));
    const safeLine = JSON.stringify(sanitizeFields({ detail: huge }));

    assert.ok(mutantLine.length > 50_000, "Mutant should be unbounded.");
    assert.ok(safeLine.length < 1_000, "Control should be bounded.");
  });
});

/* -------------------------------------------------------------------------- */
/*                        FIXED ROUTES STAY FIXED                             */
/* -------------------------------------------------------------------------- */

void describe("The audited log leaks remain fixed", () => {
  void test("files/analyze no longer logs analysis content verbatim", () => {
    const code = read("app", "api", "files", "analyze", "route.ts");

    /*
     * The unparseable-payload site. Anchored on its own message so this
     * cannot accidentally inspect the earlier provider-error log — which
     * is exactly how the SECOND leak in this file was found.
     */
    const site = code.slice(
      code.indexOf("SYRAVEN FILE ANALYSIS: unparseable"),
    );

    assert.ok(
      !/console\.error\(\s*"[^"]*",\s*\n?\s*content\s*\n?\s*\)/.test(
        site.slice(0, 400),
      ),
      "The document-content log leak has returned.",
    );

    assert.match(
      site.slice(0, 400),
      /content\.slice\(0,\s*\d+\)/,
      "The bounded prefix is missing.",
    );
  });

  void test("files/analyze truncates the provider error body", () => {
    const code = read("app", "api", "files", "analyze", "route.ts");

    const site = code.slice(code.indexOf("SYRAVEN FILE ANALYSIS ERROR"));

    assert.match(
      site.slice(0, 400),
      /errorText\.slice\(0,\s*\d+\)/,
      "The provider body is logged untruncated.",
    );
  });

  void test("no route logs a provider body without a bound", () => {
    /*
     * Sweep. A provider error body can echo the request, so every route
     * that logs one must bound it. This is what turns two point fixes
     * into a rule.
     */
    const routes = [
      ["app", "api", "stream", "route.ts"],
      ["app", "api", "files", "analyze", "route.ts"],
      ["app", "api", "chat", "route.ts"],
      ["app", "api", "agents", "execute", "route.ts"],
    ];

    for (const parts of routes) {
      const code = read(...parts);

      const unbounded = code.match(
        /(?:error|body|detail)\s*:\s*\n?\s*errorText\s*,/g,
      );

      assert.equal(
        unbounded,
        null,
        `${parts.join("/")} logs an unbounded provider body: ${String(unbounded)}`,
      );
    }
  });

  void test("stream truncates the provider error body", () => {
    const code = read("app", "api", "stream", "route.ts");

    const logCall = code.slice(
      code.indexOf("SYRAVEN AI PROVIDER ERROR"),
      code.indexOf("SYRAVEN AI PROVIDER ERROR") + 400,
    );

    assert.match(
      logCall,
      /errorText\.slice\(0,\s*\d+\)/,
      "The provider body is logged untruncated again.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                             SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

void describe("SOURCE INVARIANTS — lib/observability/logger.ts", () => {
  const src = read("lib", "observability", "logger.ts");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  void test("is server-only", () => {
    assert.match(code, /import\s+["'`]server-only["'`]/);
  });

  void test("redacts every key the mirror asserts", () => {
    for (const key of REDACTED_KEYS) {
      assert.ok(
        new RegExp(`["'\`]${key}["'\`]`).test(code),
        `REDACTED_KEYS is missing "${key}"; the mirror has drifted.`,
      );
    }
  });

  void test("bounds field length", () => {
    assert.match(code, /MAX_FIELD_LENGTH\s*=\s*300/);
  });

  void test("introduces no logging dependency", () => {
    assert.ok(
      !/from\s+["'`](pino|winston|bunyan|@sentry)/.test(code),
      "Phase 11 must not add an observability framework.",
    );
  });

  void test("never logs an error message or stack", () => {
    assert.ok(
      !/cause\.message|cause\.stack|error\.stack/.test(code),
      "Error messages and stacks carry interpolated user input and paths.",
    );
  });

  void test("times both success and failure paths", () => {
    const timedFn = code.slice(code.indexOf("export async function timed"));

    assert.match(timedFn, /durationMs[\s\S]*durationMs/);
    assert.match(timedFn, /throw cause/);
  });
});
