/**
 * SYRAVEN — AI provider abstraction and policy tests
 *
 * Phase 7 (see IMPLEMENTATION_PLAN.md).
 *
 * Phase 5 clamped how MANY tokens a caller could request. Nothing
 * clamped WHICH model spent them: four routes passed `body.model`
 * straight to the provider, so a free-tier caller could name any model
 * the provider accepted and pay free-tier prices for it.
 *
 * These tests hold the model/token/provider policy line, and re-assert
 * that the Phase 1–6 guarantees still stand.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* -------------------------------------------------------------------------- */
/*                        MIRRORED SELECTION LOGIC                            */
/* -------------------------------------------------------------------------- */

/*
 * lib/ai/registry.ts imports "server-only". The selection logic is pure,
 * so it is mirrored here and held to the source by the invariant suites.
 */

type PlanId = "free" | "starter" | "pro" | "business" | "enterprise";
type Capability = "chat" | "vision" | "transcription" | "speech";

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

interface Model {
  id: string;
  capability: Capability;
  maxOutputTokens: number;
  minimumPlan: PlanId;
}

const MODELS: Record<string, Model> = {
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    capability: "chat",
    maxOutputTokens: 16_000,
    minimumPlan: "free",
  },
  "premium-model": {
    id: "premium-model",
    capability: "chat",
    maxOutputTokens: 32_000,
    minimumPlan: "business",
  },
  "whisper-1": {
    id: "whisper-1",
    capability: "transcription",
    maxOutputTokens: 0,
    minimumPlan: "free",
  },
};

type Selection =
  | { ok: true; model: Model }
  | {
      ok: false;
      reason:
        | "UNKNOWN_MODEL"
        | "WRONG_CAPABILITY"
        | "PLAN_NOT_PERMITTED"
        | "MISCONFIGURED_DEFAULT";
    };

function selectModel(
  requested: unknown,
  capability: Capability,
  plan: PlanId,
): Selection {
  const name =
    typeof requested === "string" && requested.trim().length > 0
      ? requested.trim()
      : null;

  if (name === null) {
    const fallback = MODELS["gpt-4o-mini"];
    return fallback
      ? { ok: true, model: fallback }
      : { ok: false, reason: "MISCONFIGURED_DEFAULT" };
  }

  const model = MODELS[name];
  if (!model) return { ok: false, reason: "UNKNOWN_MODEL" };
  if (model.capability !== capability) {
    return { ok: false, reason: "WRONG_CAPABILITY" };
  }
  if (PLAN_RANK[plan] < PLAN_RANK[model.minimumPlan]) {
    return { ok: false, reason: "PLAN_NOT_PERMITTED" };
  }

  return { ok: true, model };
}

/* -------------------------------------------------------------------------- */
/*                          MODEL SELECTION SAFETY                            */
/* -------------------------------------------------------------------------- */

void describe("Model selection is server-authoritative", () => {
  void test("an unknown model is REFUSED, not silently substituted", () => {
    const result = selectModel("gpt-9-ultra", "chat", "enterprise");

    assert.equal(result.ok, false);
    assert.equal(
      result.ok === false && result.reason,
      "UNKNOWN_MODEL",
      "Substituting a default would bill the caller for a model they did " +
        "not request, and would hide typos in production.",
    );
  });

  void test("a caller cannot select a model above their plan", () => {
    const result = selectModel("premium-model", "chat", "free");

    assert.equal(result.ok, false);
    assert.equal(
      result.ok === false && result.reason,
      "PLAN_NOT_PERMITTED",
      "This is the gap Phase 7 closes: Phase 5 clamped token COUNT but " +
        "not model CHOICE.",
    );
  });

  void test("a permitted plan may select the model", () => {
    for (const plan of ["business", "enterprise"] as PlanId[]) {
      const result = selectModel("premium-model", "chat", plan);
      assert.equal(result.ok, true, `${plan} should be permitted`);
    }
  });

  void test("a model cannot be used for the wrong capability", () => {
    const result = selectModel("whisper-1", "chat", "enterprise");

    assert.equal(result.ok, false);
    assert.equal(
      result.ok === false && result.reason,
      "WRONG_CAPABILITY",
      "A transcription model must not be billed as a chat completion.",
    );
  });

  void test("no request falls back to the server default", () => {
    for (const value of [null, undefined, "", "   "]) {
      const result = selectModel(value, "chat", "free");
      assert.equal(result.ok, true);
      assert.equal(result.ok === true && result.model.id, "gpt-4o-mini");
    }
  });

  void test("hostile model values are refused", () => {
    for (const value of [
      "../../etc/passwd",
      "gpt-4o-mini; DROP TABLE",
      { id: "gpt-4o-mini" },
      42,
      true,
      ["gpt-4o-mini"],
    ]) {
      const result = selectModel(value, "chat", "enterprise");

      const acceptable =
        result.ok === false ||
        (result.ok === true && result.model.id === "gpt-4o-mini");

      assert.ok(
        acceptable,
        `${JSON.stringify(value)} must not reach the provider unvalidated.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                       TOKEN CEILING COMPOSITION                            */
/* -------------------------------------------------------------------------- */

void describe("Token ceilings compose plan AND model limits", () => {
  const PLAN_TOKENS: Record<PlanId, number> = {
    free: 2_000,
    starter: 4_000,
    pro: 8_000,
    business: 16_000,
    enterprise: 32_000,
  };

  function effectiveCeiling(plan: PlanId, model: Model): number {
    return Math.min(PLAN_TOKENS[plan], model.maxOutputTokens);
  }

  void test("the lower of the two bounds wins", () => {
    const cheap = MODELS["gpt-4o-mini"];
    assert.ok(cheap);

    assert.equal(
      effectiveCeiling("enterprise", cheap),
      16_000,
      "An enterprise plan cannot exceed the model's own ceiling.",
    );

    assert.equal(
      effectiveCeiling("free", cheap),
      2_000,
      "A free plan is bounded by the plan, not the model.",
    );
  });

  void test("neither bound alone can be escaped by changing the other", () => {
    const big = MODELS["premium-model"];
    assert.ok(big);

    assert.equal(
      effectiveCeiling("free", big),
      2_000,
      "Selecting a high-ceiling model must not lift the plan ceiling.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       ROUTE COVERAGE (STRUCTURAL)                          */
/* -------------------------------------------------------------------------- */

const API_DIR = join(process.cwd(), "app", "api");

function findRoutes(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findRoutes(full));
    else if (entry.name === "route.ts") found.push(full);
  }
  return found;
}

void describe("Routes accepting a model validate it", () => {
  /**
   * Routes that take a caller-supplied model. Each must resolve it
   * through the registry rather than forwarding the raw string.
   */
  const MODEL_ACCEPTING = [
    "app/api/chat/route.ts",
    "app/api/agents/execute/route.ts",
    "app/api/stream/route.ts",
    "app/api/files/analyze/route.ts",
    "app/api/voice/speak/route.ts",
  ];

  for (const id of MODEL_ACCEPTING) {
    const code = stripComments(readFileSync(join(process.cwd(), id), "utf8"));

    void test(`${id} resolves the model server-side`, () => {
      const validated =
        /resolveAiPolicy\s*\(/.test(code) || /selectModel\s*\(/.test(code);

      assert.ok(
        validated,
        `${id} must validate the requested model against the approved ` +
          `registry before calling a provider.`,
      );
    });

    void test(`${id} returns the policy denial`, () => {
      const returnsDenial =
        /!policy\.ok[\s\S]{0,120}?return policy\.response/.test(code) ||
        /!\w+Model\.ok[\s\S]{0,300}?return/.test(code);

      assert.ok(
        returnsDenial,
        `${id} validates the model but does not return the denial, so the ` +
          `check has no effect.`,
      );
    });
  }

  void test("no route forwards a raw client model to a provider", () => {
    const offenders: string[] = [];

    for (const file of findRoutes(API_DIR)) {
      const code = stripComments(readFileSync(file, "utf8"));

      /* A provider call whose model comes straight from the body. */
      if (/model:\s*body\.model\b/.test(code)) {
        offenders.push(file.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `These routes send a client-supplied model identifier to a paid ` +
        `provider without validation:\n${offenders.join("\n")}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     PROVIDER ADAPTER INVARIANTS                            */
/* -------------------------------------------------------------------------- */

void describe("lib/ai/provider.ts invariants", () => {
  const source = read("lib", "ai", "provider.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("the timeout is server-owned, not the caller's signal", () => {
    assert.match(
      code,
      /signal:\s*AbortSignal\.timeout\(AI_REQUEST_POLICY\.timeoutMs\)/,
      "Passing the caller's AbortSignal would let a client hold a paid " +
        "provider connection open indefinitely.",
    );

    assert.doesNotMatch(
      code,
      /signal:\s*request\.signal/,
      "The adapter must not accept a caller-controlled abort signal.",
    );
  });

  void test("retries are bounded", () => {
    assert.match(
      code,
      /maxRetries:\s*1/,
      "An unbounded retry against a paid provider multiplies cost during " +
        "an outage.",
    );
  });

  void test("only transient statuses are retried", () => {
    assert.match(code, /retryableStatuses:\s*\[429,\s*500,\s*502,\s*503,\s*504\]/);

    assert.doesNotMatch(
      code,
      /retryableStatuses:[^\]]*\b40[013]\b/,
      "A 400/401/403 is deterministic; retrying wastes a paid call.",
    );
  });

  void test("provider error bodies are not forwarded to clients", () => {
    /*
     * A provider body can contain organisation ids, quota details, and
     * echoes of the request. It is logged server-side only.
     */
    assert.match(
      code,
      /console\.error\([\s\S]{0,200}?detail:/,
      "The provider detail must be logged, not returned.",
    );

    assert.doesNotMatch(
      code,
      /clientMessage:\s*detail/,
      "The provider's own message must never become the client message.",
    );
  });

  void test("a provider auth failure is not reported as a client 401", () => {
    assert.match(
      code,
      /status === 401 \|\| status === 403[\s\S]{0,300}?status:\s*503/,
      "A rejected API key is a server misconfiguration. Returning 401 " +
        "would wrongly imply the caller's session is invalid.",
    );
  });

  void test("missing token counts are null, never zero", () => {
    assert.match(
      code,
      /function numberOrNull[\s\S]{0,200}?return null/,
      "Reporting 0 for an unmeasured token count is a false measurement; " +
        "null says 'not measured'.",
    );
  });

  void test("an unconfigured provider fails closed", () => {
    assert.match(code, /apiKey === null[\s\S]{0,120}?NOT_CONFIGURED_ERROR/);
  });
});

/* -------------------------------------------------------------------------- */
/*                      REGISTRY / POLICY INVARIANTS                          */
/* -------------------------------------------------------------------------- */

void describe("lib/ai/registry.ts invariants", () => {
  const source = read("lib", "ai", "registry.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("an unknown model returns UNKNOWN_MODEL rather than a default", () => {
    assert.match(
      code,
      /if \(!model\)\s*\{[\s\S]{0,160}?reason:\s*"UNKNOWN_MODEL"/,
    );
  });

  void test("the plan gate is actually applied in the source", () => {
    /*
     * The behavioural tests above exercise a mirror of this logic, so
     * they cannot see the real gate being deleted. This asserts the
     * source still compares the caller's plan against the model's
     * minimum — removing it would let a free-tier caller name any
     * approved model, which is the exact gap Phase 7 closes.
     */
    assert.match(
      code,
      /if \(PLAN_RANK\[plan\] < PLAN_RANK\[model\.minimumPlan\]\)\s*\{[\s\S]{0,140}?PLAN_NOT_PERMITTED/,
      "selectModel must refuse a model whose minimumPlan exceeds the " +
        "caller's effective plan.",
    );
  });

  void test("the plan ranking stays ordered", () => {
    /*
     * An out-of-order rank would silently invert the gate — e.g. free
     * ranking above business would grant every restricted model.
     */
    const block = code.match(
      /const PLAN_RANK: Record<PlanId, number> = \{([\s\S]*?)\}/,
    );

    assert.ok(block, "PLAN_RANK not found");

    const ranks = [...(block[1] ?? "").matchAll(/(\w+):\s*(\d+)/g)].map(
      (m) => [m[1], Number(m[2])] as const,
    );

    const expected = [
      ["free", 0],
      ["starter", 1],
      ["pro", 2],
      ["business", 3],
      ["enterprise", 4],
    ] as const;

    for (const [plan, rank] of expected) {
      const found = ranks.find(([p]) => p === plan);

      assert.ok(found, `${plan} missing from PLAN_RANK`);
      assert.equal(
        found[1],
        rank,
        `${plan} must rank ${rank}; a reordering inverts the model gate.`,
      );
    }
  });

  void test("a missing default fails closed", () => {
    assert.match(
      code,
      /if \(!fallback\)[\s\S]{0,400}?MISCONFIGURED_DEFAULT/,
      "A registry misconfiguration must not select an arbitrary model.",
    );
  });

  void test("base URLs are constants, not caller input", () => {
    assert.match(code, /baseUrl:\s*"https:\/\/api\.openai\.com\/v1"/);
    assert.doesNotMatch(
      code,
      /baseUrl:\s*(body|request|params)/,
      "A caller-supplied base URL would let requests — and the API key — " +
        "be redirected to an attacker's host.",
    );
  });

  void test("the api key is read from the environment only", () => {
    assert.match(code, /env\[PROVIDER_ENDPOINTS\[provider\]\.apiKeyEnv\]/);
  });
});

void describe("lib/api/aiPolicy.ts invariants", () => {
  const source = read("lib", "api", "aiPolicy.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("the token ceiling is the minimum of plan and model", () => {
    assert.match(
      code,
      /Math\.min\(planCeiling,\s*model\.maxOutputTokens\)/,
      "Taking either bound alone would let one be escaped by changing the " +
        "other.",
    );
  });

  void test("it reuses the Phase 5 plan clamp rather than reimplementing it", () => {
    assert.match(
      code,
      /clampMaxTokens\(/,
      "Duplicating the plan ceiling would let the two drift apart.",
    );
  });

  void test("a plan-forbidden model returns 403, not 400", () => {
    assert.match(
      code,
      /PLAN_NOT_PERMITTED[\s\S]{0,300}?403/,
      "The request is well-formed; the plan simply does not include it.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    PHASE 1-6 REGRESSION RE-ASSERTION                       */
/* -------------------------------------------------------------------------- */

void describe("Phase 1-6 guarantees still hold", () => {
  const routes = findRoutes(API_DIR);

  void test("no route re-implements authentication", () => {
    const offenders = routes.filter((f) =>
      /\bfunction\s+getAuthenticatedUser\s*\(/.test(
        stripComments(readFileSync(f, "utf8")),
      ),
    );

    assert.deepEqual(offenders, []);
  });

  void test("no route derives identity from client input", () => {
    const offenders = routes.filter((f) => {
      const code = stripComments(readFileSync(f, "utf8"));
      return (
        /searchParams\s*\.\s*get\(\s*["'`]userId["'`]\s*\)/.test(code) ||
        /\bbody\s*\.\s*userId\b/.test(code)
      );
    });

    assert.deepEqual(offenders, []);
  });

  void test("every AI-spending route still enforces usage", () => {
    const unmetered: string[] = [];

    for (const file of routes) {
      const code = stripComments(readFileSync(file, "utf8"));

      const callsProvider =
        /api\.openai\.com|api\.groq\.com|chat\/completions|audio\/(speech|transcriptions)/.test(
          code,
        );

      if (callsProvider && !/enforceUsage\s*\(/.test(code)) {
        unmetered.push(file.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }

    assert.deepEqual(
      unmetered,
      [],
      `Phase 5 enforcement regressed on:\n${unmetered.join("\n")}`,
    );
  });

  void test("the AI policy layer did not bypass usage enforcement", () => {
    /*
     * The policy must run AFTER the usage guard: resolving a model for a
     * caller who is over quota would waste work and, worse, could be
     * mistaken for permission to proceed.
     */
    for (const id of [
      "app/api/chat/route.ts",
      "app/api/files/analyze/route.ts",
      "app/api/stream/route.ts",
      "app/api/agents/execute/route.ts",
    ]) {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      const guardIndex = code.indexOf("enforceUsage(");
      const policyIndex = code.indexOf("resolveAiPolicy({");

      assert.ok(guardIndex !== -1, `${id} lost its usage guard`);
      assert.ok(policyIndex !== -1, `${id} lost its AI policy`);
      assert.ok(
        guardIndex < policyIndex,
        `${id}: usage enforcement must precede AI policy resolution.`,
      );
    }
  });

  void test("billing idempotency and plan resolution are intact", () => {
    const webhook = stripComments(
      read("app", "api", "billing", "webhook", "route.ts"),
    );

    assert.match(webhook, /claimEvent\(/, "webhook idempotency regressed");
    assert.match(webhook, /resolvePlan\(/, "plan resolution regressed");
  });
});
