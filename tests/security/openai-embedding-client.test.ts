/**
 * SYRAVEN — Approved OpenAI embedding client tests
 *
 * Phase 10 Step 10.4 (gated portion — see IMPLEMENTATION_PLAN.md).
 *
 * The approved configuration is:
 *
 *     Provider:   OpenAI
 *     Model:      text-embedding-3-small
 *     Dimensions: 1536
 *
 * These tests defend that pin. The specific regression they exist to
 * prevent is real and was found in this repository: `.env.local`
 * previously declared `text-embedding-3-large` (3072 native) against a
 * `vector(1536)` schema. Wiring the environment straight through would
 * have produced vectors the column cannot store — or, if a future
 * 1536-wide model were named instead, vectors from an unrelated vector
 * space that no error would ever surface.
 *
 * NO REAL API CALL IS MADE ANYWHERE IN THIS FILE. `fetch` is replaced
 * with a recording stub for every test that exercises the transport,
 * and the stub is restored afterwards. Cost: $0.
 *
 * Run: npm test
 */

import { test, describe, afterEach } from "node:test";
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

const CLIENT_SRC = read("lib", "search", "openaiEmbedding.ts");
const CLIENT_CODE = stripComments(CLIENT_SRC);

const APPROVED_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/* -------------------------------------------------------------------------- */
/*                            RECORDING FETCH STUB                            */
/* -------------------------------------------------------------------------- */

interface RecordedRequest {
  url: string;
  body: Record<string, unknown>;
  authorization: string | null;
}

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

/**
 * Replaces `fetch` with a stub that RECORDS the request and returns a
 * canned response. Nothing leaves the process.
 */
function stubFetch(
  response: { status?: number; vector?: unknown } = {},
): RecordedRequest[] {
  const recorded: RecordedRequest[] = [];

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;

    recorded.push({
      url: String(url),
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      authorization: headers.Authorization ?? null,
    });

    const status = response.status ?? 200;

    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return {
          data: [
            {
              embedding:
                response.vector ??
                Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.02),
            },
          ],
        };
      },
      async text() {
        return "provider detail body";
      },
    };
  }) as unknown as typeof fetch;

  return recorded;
}

/* -------------------------------------------------------------------------- */
/*                          MIRRORED CLIENT LOGIC                             */
/* -------------------------------------------------------------------------- */

/*
 * lib/search/* is server-only and cannot load under node --test. The
 * client's decision logic is mirrored here; SOURCE INVARIANTS below hold
 * the real module to the same shape.
 */

const REFUSED_MODELS: Record<string, string> = {
  "text-embedding-3-large":
    "Emits 3072 dimensions; the schema stores 1536. Not approved.",
  "text-embedding-ada-002":
    "Legacy model, cannot reduce dimensions. Not approved.",
};

function assertApprovedModelEnv(
  env: Record<string, string | undefined>,
): { ok: true } | { ok: false; reason: string } {
  const declared = env.OPENAI_EMBEDDING_MODEL;

  if (typeof declared !== "string" || declared.trim().length === 0) {
    return { ok: true };
  }

  const model = declared.trim();
  if (model === APPROVED_MODEL) return { ok: true };

  return {
    ok: false,
    reason:
      REFUSED_MODELS[model] ??
      `OPENAI_EMBEDDING_MODEL=${model} is not the approved model.`,
  };
}

function createClient(env: Record<string, string | undefined>) {
  if (!assertApprovedModelEnv(env).ok) return null;

  const key = env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  return {
    modelId: APPROVED_MODEL,
    async embed(input: { text: string; signal?: AbortSignal }) {
      const response = await (globalThis.fetch as unknown as (
        u: string,
        i: RequestInit,
      ) => Promise<{
        ok: boolean;
        status: number;
        json(): Promise<{ data?: { embedding?: unknown }[] }>;
        text(): Promise<string>;
      }>)("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: APPROVED_MODEL,
          input: input.text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
        signal: input.signal,
      });

      if (!response.ok) throw new Error(`status ${response.status}`);

      const payload = await response.json();
      const vector = payload.data?.[0]?.embedding;

      return Array.isArray(vector) ? vector : [];
    },
  };
}

const VALID_ENV = {
  OPENAI_API_KEY: "sk-test-not-a-real-key",
  OPENAI_EMBEDDING_MODEL: APPROVED_MODEL,
};

/* -------------------------------------------------------------------------- */
/*                            APPROVED MODEL PIN                              */
/* -------------------------------------------------------------------------- */

void describe("The approved model is pinned", () => {
  void test("requests are sent with text-embedding-3-small", async () => {
    const recorded = stubFetch();
    const client = createClient(VALID_ENV);

    assert.ok(client);
    await client.embed({ text: "hello" });

    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]?.body.model, APPROVED_MODEL);
  });

  void test("requests pin dimensions to 1536", async () => {
    const recorded = stubFetch();
    const client = createClient(VALID_ENV);

    assert.ok(client);
    await client.embed({ text: "hello" });

    assert.equal(
      recorded[0]?.body.dimensions,
      EMBEDDING_DIMENSIONS,
      "The request must pin dimensions to what the schema stores.",
    );
  });

  void test("text-embedding-3-large is never requested", async () => {
    const recorded = stubFetch();
    const client = createClient(VALID_ENV);

    assert.ok(client);
    await client.embed({ text: "hello" });

    assert.notEqual(recorded[0]?.body.model, "text-embedding-3-large");
    assert.notEqual(recorded[0]?.body.dimensions, 3072);
  });

  void test("the model id reported matches the approved model", () => {
    const client = createClient(VALID_ENV);
    assert.equal(client?.modelId, APPROVED_MODEL);
  });
});

/* -------------------------------------------------------------------------- */
/*                       ENVIRONMENT DISAGREEMENT FAILS                       */
/* -------------------------------------------------------------------------- */

void describe("A contradicting environment fails closed", () => {
  void test("text-embedding-3-large is refused", () => {
    const result = assertApprovedModelEnv({
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
    });

    assert.equal(result.ok, false);
  });

  void test("no client is built for a refused model", () => {
    const client = createClient({
      ...VALID_ENV,
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
    });

    assert.equal(
      client,
      null,
      "A client was built for an unapproved model; it could spend money.",
    );
  });

  void test("an unknown model is refused rather than substituted", () => {
    const result = assertApprovedModelEnv({
      OPENAI_EMBEDDING_MODEL: "some-future-model",
    });

    /*
     * Refusing rather than falling back matters: a silent substitution
     * would let a typo change the vector space of the whole corpus.
     */
    assert.equal(result.ok, false);
  });

  void test("an unset model is accepted — the constant is authority", () => {
    assert.equal(assertApprovedModelEnv({}).ok, true);
  });

  void test("no client is built without an API key", () => {
    const client = createClient({ OPENAI_EMBEDDING_MODEL: APPROVED_MODEL });
    assert.equal(client, null);
  });

  void test("a refused model beats a present API key", () => {
    /*
     * Ordering check: the model is validated BEFORE the key is read, so
     * a correctly-configured key cannot rescue a wrong model.
     */
    const client = createClient({
      OPENAI_API_KEY: "sk-test-not-a-real-key",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
    });

    assert.equal(client, null);
  });
});

/* -------------------------------------------------------------------------- */
/*                              SECRET HANDLING                               */
/* -------------------------------------------------------------------------- */

void describe("Credentials are never disclosed", () => {
  void test("the key is sent only as a bearer header", async () => {
    const recorded = stubFetch();
    const client = createClient(VALID_ENV);

    assert.ok(client);
    await client.embed({ text: "hello" });

    const request = recorded[0];
    assert.ok(request);

    assert.match(request.authorization ?? "", /^Bearer /);

    /* Never in the URL, where it would reach logs and referrers. */
    assert.ok(!request.url.includes("sk-"));

    /* Never in the body. */
    assert.ok(!JSON.stringify(request.body).includes("sk-"));
  });

  void test("the source never logs the key", () => {
    const logs = CLIENT_CODE.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    for (const log of logs) {
      assert.ok(
        !/apiKey|API_KEY|Authorization|Bearer/.test(log),
        `A log statement may disclose credentials:\n${log}`,
      );
    }
  });

  void test("the source never logs input text or the vector", () => {
    const logs = CLIENT_CODE.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    for (const log of logs) {
      const payload = log.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');

      assert.ok(
        !/\binput\.text\b|\bvector\b|\bembedding\b(?!s)/.test(payload),
        `A log statement may disclose content or a vector:\n${log}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                            TRANSPORT BEHAVIOUR                             */
/* -------------------------------------------------------------------------- */

void describe("Transport behaviour", () => {
  void test("a provider error throws rather than returning junk", async () => {
    stubFetch({ status: 500 });
    const client = createClient(VALID_ENV);

    assert.ok(client);

    await assert.rejects(
      async () => client.embed({ text: "hello" }),
      "A failing provider must throw, not return an empty vector.",
    );
  });

  void test("a malformed payload yields an empty array, not a crash", async () => {
    stubFetch({ vector: "not-an-array" });
    const client = createClient(VALID_ENV);

    assert.ok(client);

    const result = await client.embed({ text: "hello" });

    /*
     * Returned unvalidated by design — `embedText` rejects it on
     * dimension. The client's job is transport, not validation.
     */
    assert.deepEqual(result, []);
  });

  void test("only the caller's text is transmitted", async () => {
    const recorded = stubFetch();
    const client = createClient(VALID_ENV);

    assert.ok(client);
    await client.embed({ text: "ONLY THIS" });

    assert.equal(recorded[0]?.body.input, "ONLY THIS");
  });
});

/* -------------------------------------------------------------------------- */
/*                             SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

void describe("SOURCE INVARIANTS — lib/search/openaiEmbedding.ts", () => {
  void test("is server-only", () => {
    assert.match(CLIENT_CODE, /import\s+["'`]server-only["'`]/);
  });

  void test("pins the approved model as a constant", () => {
    assert.match(
      CLIENT_CODE,
      /APPROVED_EMBEDDING_MODEL\s*=\s*["'`]text-embedding-3-small["'`]/,
      "The approved model must be compiled in, not configured.",
    );
  });

  void test("never reads the model from the environment into a request", () => {
    /*
     * The environment is checked for AGREEMENT only. The request body
     * must use the constant, never `env.OPENAI_EMBEDDING_MODEL`.
     */
    const body = CLIENT_CODE.slice(
      CLIENT_CODE.indexOf("body: JSON.stringify"),
      CLIENT_CODE.indexOf("signal:"),
    );

    assert.match(body, /model\s*:\s*APPROVED_EMBEDDING_MODEL/);

    assert.ok(
      !/env\s*\.\s*OPENAI_EMBEDDING_MODEL/.test(body),
      "CRITICAL: the request model is taken from the environment.",
    );
  });

  void test("sends 1536 dimensions explicitly", () => {
    assert.match(CLIENT_CODE, /dimensions\s*:\s*EMBEDDING_DIMENSIONS/);
  });

  void test("never mentions 3072 or the large model as a usable value", () => {
    const body = CLIENT_CODE.slice(CLIENT_CODE.indexOf("async embed"));

    assert.ok(
      !/3072/.test(body),
      "3072 appears in the request path.",
    );
    assert.ok(
      !/["'`]text-embedding-3-large["'`]/.test(body),
      "The refused model appears in the request path.",
    );
  });

  void test("refuses the large model by name", () => {
    assert.match(
      CLIENT_CODE,
      /["'`]text-embedding-3-large["'`]\s*:/,
      "The previously-configured wrong model must be explicitly refused.",
    );
  });

  void test("uses the server-owned signal, never a caller's", () => {
    assert.match(CLIENT_CODE, /signal\s*:\s*input\.signal/);

    assert.ok(
      !/signal\s*:\s*request\s*\.\s*signal|AbortSignal\.timeout/.test(
        CLIENT_CODE,
      ),
      "The timeout belongs to embedText; the client must not create its own.",
    );
  });

  void test("returns the vector unvalidated, leaving validation to embedText", () => {
    assert.ok(
      !/validateEmbedding/.test(CLIENT_CODE),
      "Duplicating validation here invites the two copies to drift.",
    );
  });

  void test("does not construct itself at module scope", () => {
    /*
     * No singleton, no top-level instantiation. Cost requires a
     * deliberate call.
     */
    assert.ok(
      !/^const\s+\w+\s*=\s*createOpenAiEmbeddingClient\s*\(/m.test(CLIENT_CODE),
      "COST: a module-scope client would be constructed on import.",
    );
  });

  void test("truncates the provider body before logging it", () => {
    assert.match(
      CLIENT_CODE,
      /detail\.slice\(0,\s*\d+\)/,
      "The provider body can echo the request and must be truncated.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                MUTATION — THE MODEL PIN IS LOAD-BEARING                    */
/* -------------------------------------------------------------------------- */

void describe("MUTATION — removing the model pin corrupts the corpus", () => {
  /** Mutant: read the model from the environment, as would be natural. */
  function mutantClient(env: Record<string, string | undefined>) {
    const key = env.OPENAI_API_KEY?.trim();
    if (!key) return null;

    /* No agreement check. The environment wins. */
    const model = env.OPENAI_EMBEDDING_MODEL ?? APPROVED_MODEL;

    return {
      modelId: model,
      async embed(input: { text: string }) {
        const response = await (globalThis.fetch as unknown as (
          u: string,
          i: RequestInit,
        ) => Promise<{ ok: boolean; json(): Promise<unknown> }>)(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model, input: input.text }),
          },
        );

        await response.json();
        return [];
      },
    };
  }

  void test("mutant sends the wrong model when the env says so", async () => {
    const recorded = stubFetch();

    const client = mutantClient({
      OPENAI_API_KEY: "sk-test-not-a-real-key",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
    });

    assert.ok(client, "The mutant built a client, as expected.");
    await client.embed({ text: "hello" });

    assert.equal(
      recorded[0]?.body.model,
      "text-embedding-3-large",
      "The mutation is undetectable — the pin is not load-bearing.",
    );
  });

  void test("the control refuses to build that client at all", () => {
    const client = createClient({
      OPENAI_API_KEY: "sk-test-not-a-real-key",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
    });

    assert.equal(client, null);
  });

  void test("mutant omits the dimensions pin", async () => {
    const recorded = stubFetch();

    const client = mutantClient({
      OPENAI_API_KEY: "sk-test-not-a-real-key",
      OPENAI_EMBEDDING_MODEL: APPROVED_MODEL,
    });

    assert.ok(client);
    await client.embed({ text: "hello" });

    assert.equal(
      recorded[0]?.body.dimensions,
      undefined,
      "The mutant should omit dimensions, leaving native width to chance.",
    );
  });

  void test("the control always pins dimensions", async () => {
    const recorded = stubFetch();
    const client = createClient(VALID_ENV);

    assert.ok(client);
    await client.embed({ text: "hello" });

    assert.equal(recorded[0]?.body.dimensions, EMBEDDING_DIMENSIONS);
  });
});

/* -------------------------------------------------------------------------- */
/*                        ENVIRONMENT FILE CORRECTION                         */
/* -------------------------------------------------------------------------- */

void describe("The latent .env.local mismatch is corrected", () => {
  void test("no committed file advertises 3072 dimensions", () => {
    /*
     * `.env.local` is gitignored, so it is not asserted here — a test
     * cannot depend on an untracked file. What IS asserted is that no
     * source module treats 3072 as a valid dimension.
     */
    for (const file of [
      "vector.ts",
      "embedding.ts",
      "ingest.ts",
      "openaiEmbedding.ts",
    ]) {
      const code = stripComments(read("lib", "search", file));

      const assignments =
        code.match(/(?:dimensions|DIMENSIONS)\s*[:=]\s*3072/g) ?? [];

      assert.deepEqual(
        assignments,
        [],
        `${file} treats 3072 as a usable dimension.`,
      );
    }
  });

  void test("the schema contract remains 1536 everywhere", () => {
    assert.match(
      stripComments(read("lib", "search", "vector.ts")),
      /EMBEDDING_DIMENSIONS\s*=\s*1536/,
    );
  });

  void test("the environment guard still refuses a contradiction", () => {
    assert.match(
      stripComments(read("lib", "search", "embedding.ts")),
      /parsed\s*!==\s*EMBEDDING_DIMENSIONS/,
    );
  });
});
