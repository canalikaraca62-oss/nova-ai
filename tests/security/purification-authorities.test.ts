/**
 * SYRAVEN — one authority per responsibility (Phase 2, batch P2-F)
 *
 * Each block pins a duplicate that drifted into wrong behaviour and was
 * consolidated onto its canonical owner. The evidence for every row is in
 * docs/engineering/PURIFICATION_EVIDENCE.md (P2-F01 … P2-F06).
 *
 * These are source checks: each defect is re-creatable by a one-line
 * edit, and each assertion was mutation-tested against that edit.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

/** Removes block comments and whole-line `//` comments, keeping URLs. */
function code(...parts: string[]): string {
  return read(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* -------------------------------------------------------------------------- */
/*                         P2-F02 / F03 — billing routes                      */
/* -------------------------------------------------------------------------- */

void describe("P2-F02: the portal finds the customer on the caller's profile", () => {
  const PORTAL = code("app", "api", "billing", "portal", "route.ts");

  void test("it reads profiles through the caller's RLS client", () => {
    assert.match(
      PORTAL,
      /session\.supabase\s*\.from\("profiles"\)\s*\.select\("stripe_customer_id"\)\s*\.eq\("id",\s*session\.userId\)/,
      "The customer id lives on the caller's own profile row.",
    );
  });

  void test("it does not read a subscriptions table", () => {
    assert.ok(
      !/from\("subscriptions"\)/.test(PORTAL),
      "CRITICAL: public.subscriptions does not exist; every portal call 500s.",
    );
  });
});

void describe("P2-F02 / F03: billing routes build no client of their own", () => {
  for (const route of ["portal", "checkout"]) {
    const source = code("app", "api", "billing", route, "route.ts");

    void test(`${route} creates no Supabase client`, () => {
      assert.ok(
        !/\bcreateClient\b/.test(source),
        `${route} builds its own client again instead of using the session's.`,
      );
    });

    void test(`${route} does not forward Stripe's error message`, () => {
      assert.ok(
        !/(?:stripeData|portalData)\?\.error\?\.message/.test(source),
        `${route} returns Stripe's own message to the client again.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                   P2-F04 — /billing/success speaks lib/plans               */
/* -------------------------------------------------------------------------- */

void describe("P2-F04: the purchase confirmation uses the canonical plans", () => {
  const PAGE = code("app", "billing", "success", "page.tsx");

  void test("plan names and features come from lib/plans", () => {
    assert.match(PAGE, /from "@\/lib\/plans"/);
    assert.match(PAGE, /isPlanId\(/, "The plan must be validated, not guessed.");
  });

  void test("no private plan vocabulary survives", () => {
    assert.ok(
      !/type Plan\s*=|"premium"|"vip"|"plus"/.test(PAGE),
      "A private vocabulary without `starter` showed Starter buyers as Free.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*          P2-F06 — /api/usage reports what enforcement actually counts      */
/* -------------------------------------------------------------------------- */

void describe("P2-F06: /api/usage reports through entitlements and the meter", () => {
  const USAGE = code("app", "api", "usage", "route.ts");

  void test("plan and limits come from the entitlement module", () => {
    assert.match(USAGE, /resolveEntitlement\(\s*session\.supabase,\s*session\.userId/);
    assert.match(USAGE, /limitFor\(/);
  });

  void test("consumption comes from the meter", () => {
    assert.match(USAGE, /countUsage\(\s*session\.supabase,\s*session\.userId/);
  });

  void test("no private plan table or plan normaliser survives", () => {
    assert.ok(
      !/PLAN_LIMITS|normalizePlan|SyravenPlan/.test(USAGE),
      "A private limit table reported limits no request is checked against.",
    );
  });

  void test("an unreadable count is a failure, never a zero", () => {
    assert.match(
      USAGE,
      /counts\.some\(\(count\) => count === null\)[\s\S]{0,120}?errorResponse/,
      "Reporting 0 on a failed count tells the caller they have their whole allowance.",
    );
  });

  void test("the meter's count is scoped to the caller", () => {
    /*
     * The ownership filter moved from the route into countUsage. The
     * meter has a second user_id filter (the rate limiter), so this
     * checks countUsage's own query rather than the file.
     */
    const meter = code("lib", "usage", "meter.ts");
    const start = meter.indexOf("export async function countUsage");
    const body = meter.slice(start, meter.indexOf("\n}", start));

    assert.ok(start > 0, "countUsage moved; re-point this check.");
    assert.match(
      body,
      /\.eq\("user_id",\s*userId\)/,
      "CRITICAL: countUsage would count every tenant's usage.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                 P2-F05 / F01 — types and client error handling             */
/* -------------------------------------------------------------------------- */

void describe("P2-F05: the action route owns its request contract", () => {
  void test("services/action-types.ts is gone and not imported", () => {
    assert.ok(!existsSync(join(ROOT, "services", "action-types.ts")));
    assert.ok(
      !/services\/action-types/.test(code("app", "api", "action", "route.ts")),
    );
  });
});

void describe("P2-F01: chat shows the boundary's error message", () => {
  void test("an object error is read by its message", () => {
    const CHAT = code("app", "chat", "page.tsx");

    assert.match(
      CHAT,
      /typeof data\.error === "string"\s*\?\s*data\.error\s*:\s*data\.error\?\.message/,
      'withAuth, usageGuard and aiPolicy answer { code, message }; ' +
        'throwing it as a string shows "[object Object]".',
    );
  });
});

/* -------------------------------------------------------------------------- */
/*        P2-F08 — /api/chat pairs model and provider through the registry    */
/* -------------------------------------------------------------------------- */

void describe("P2-F08: /api/chat takes model and provider from the registry", () => {
  const CHAT_ROUTE = code("app", "api", "chat", "route.ts");

  void test("the client cannot choose the provider", () => {
    assert.ok(
      !/body\.provider\b/.test(CHAT_ROUTE),
      "A client-chosen vendor can contradict the registry model's provider.",
    );
  });

  void test("no model comes from the environment", () => {
    assert.ok(
      !/OPENAI_MODEL|GROQ_MODEL|DEFAULT_(?:OPENAI|GROQ)_MODEL/.test(CHAT_ROUTE),
      "An env model name reaches the provider without a registry or plan check.",
    );
  });

  void test("endpoints and keys come from the registry", () => {
    assert.ok(
      !/api\.openai\.com|api\.groq\.com/.test(CHAT_ROUTE),
      "A hardcoded vendor URL is a second copy of PROVIDER_ENDPOINTS.",
    );
    assert.match(CHAT_ROUTE, /PROVIDER_ENDPOINTS\[\s*\w+\.provider\s*\]\.baseUrl/);
    assert.match(CHAT_ROUTE, /providerApiKey\(\s*\w+\.provider\s*\)/);
  });

  void test("candidates are the plan-aware failover candidates", () => {
    assert.match(
      CHAT_ROUTE,
      /failoverCandidates\(\s*policy\.policy\.model,\s*"chat",\s*guard\.entitlement\.effectivePlan\s*\)/,
      "CRITICAL: a fallback not re-validated against the caller's plan is a side door around it.",
    );
    assert.ok(
      !/function getProvider\b|function getFallbackProvider\b/.test(CHAT_ROUTE),
      "The route-local provider pickers are back.",
    );
  });

  void test("a failed call moves on only when failover is worth it", () => {
    assert.match(
      CHAT_ROUTE,
      /isFailoverWorthy\(\s*normalizeHttpError\(\s*response\.status\s*\)\s*\)/,
      "An unconditional fallback buys a second paid refusal of an invalid request.",
    );
  });

  void test("each candidate keeps its own token ceiling", () => {
    assert.match(
      CHAT_ROUTE,
      /Math\.min\(\s*maxTokens,\s*\w+\.maxOutputTokens\s*\)/,
      "Carrying the primary's ceiling to a smaller model sends an over-limit request.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*          P2-F09 — voice routes answer provider failures canonically        */
/* -------------------------------------------------------------------------- */

void describe("P2-F09: /api/voice/transcribe maps provider failures", () => {
  const TRANSCRIBE = code("app", "api", "voice", "transcribe", "route.ts");

  void test("the client gets only the canonical message and status", () => {
    assert.match(TRANSCRIBE, /normalizeHttpError\(\s*response\.status\s*\)/);
    assert.match(
      TRANSCRIBE,
      /createErrorResponse\(\s*failure\.clientMessage,\s*failure\.status\b/,
      "CRITICAL: the provider's own text or status reaches the client again.",
    );
  });

  void test("no response is built from the provider's message or status", () => {
    assert.ok(
      !/getOpenAIErrorMessage|safeStatus|createErrorResponse\(\s*(?:message|providerMessage)\b/.test(
        TRANSCRIBE,
      ),
      "Provider text or a passed-through provider status is back in the response.",
    );
  });

  void test("the provider message is logged only capped", () => {
    assert.match(TRANSCRIBE, /payload\.error\.message\.trim\(\)\.slice\(0,\s*300\)/);
  });
});

void describe("P2-F09: /api/voice/speak maps provider failures", () => {
  const SPEAK = code("app", "api", "voice", "speak", "route.ts");
  const start = SPEAK.indexOf('"TTS_REQUEST_FAILED"');
  const reply = SPEAK.slice(start, start + 600);

  void test("the client gets only the canonical message and status", () => {
    assert.ok(start > 0, "The TTS failure response moved; re-point this check.");
    assert.match(SPEAK, /normalizeHttpError\(\s*response\.status\s*\)/);
    assert.match(reply, /message:\s*failure\.clientMessage/);
    assert.match(reply, /},\s*failure\.status\s*\)/);
  });

  void test("no provider message, type or status is in the response", () => {
    assert.ok(
      !/providerMessage|providerType|response\.status/.test(reply),
      "CRITICAL: provider detail reaches the client again.",
    );
  });

  void test("the provider message is logged only capped", () => {
    assert.match(SPEAK, /providerMessage\.slice\(0,\s*300\)/);
  });
});

/* -------------------------------------------------------------------------- */
/*              P2-G — retired routes answer 410 and do nothing               */
/* -------------------------------------------------------------------------- */

/**
 * Routes retired in place. Each keeps its path, so an external client gets
 * an honest 410 instead of a 404, and does nothing else. Adding a route
 * here is a decision recorded in PURIFICATION_EVIDENCE.md.
 */
const RETIRED_ROUTES: Record<string, string> = {
  "app/api/tasks/execute/route.ts": "/api/tasks/execute",
  "app/api/stream/route.ts": "/api/stream",
  "app/api/agents/execute/route.ts": "/api/agents/execute",
  "app/api/action/route.ts": "/api/action",
  "app/api/knowledge/search/route.ts": "/api/knowledge/search",
  "app/api/files/upload/route.ts": "/api/files/upload",
  "app/api/files/analyze/route.ts": "/api/files/analyze",
};

/** Every .ts/.tsx file beneath a directory. */
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        found.push(...sourceFiles(full));
      }
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

void describe("P2-G: retired routes answer 410 and do nothing", () => {
  const callerFiles = [
    ...sourceFiles(join(ROOT, "app")),
    ...sourceFiles(join(ROOT, "lib")),
    ...sourceFiles(join(ROOT, "tests", "e2e")),
  ];

  for (const [file, path] of Object.entries(RETIRED_ROUTES)) {
    const source = code(...file.split("/"));

    void test(`${path} requires a session and answers 410`, () => {
      assert.match(
        source,
        /export\s+const\s+POST\s*=\s*withAuth\s*\(/,
        `${path} must stay behind the session requirement.`,
      );
      assert.match(source, /status:\s*410\b/, `${path} must answer 410 Gone.`);
    });

    void test(`${path} reads, writes and spends nothing`, () => {
      assert.ok(
        !/\bfetch\s*\(|\.from\(|\.rpc\(|enforceUsage\(|guard\.record\(|process\.env|supabaseAdmin|chatCompletion|api\.openai\.com|api\.groq\.com/.test(
          source,
        ),
        `CRITICAL: the retired ${path} is doing work again.`,
      );
    });

    void test(`nothing in the product calls ${path}`, () => {
      const literal = new RegExp(
        `["'\`]${path.replace(/\//g, "\\/")}(?:["'\`?/]|$)`,
      );

      const callers = callerFiles
        .filter((candidate) => relative(candidate) !== file)
        .filter((candidate) =>
          literal.test(
            readFileSync(candidate, "utf8")
              .replace(/\/\*[\s\S]*?\*\//g, "")
              .replace(/^\s*\/\/.*$/gm, ""),
          ),
        )
        .map(relative);

      assert.deepEqual(
        callers,
        [],
        `${path} is retired; point these at its replacement instead.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*       P2-G07 — voice routes take model, key and endpoint from the registry */
/* -------------------------------------------------------------------------- */

void describe("P2-G07: voice routes take model, key and endpoint from the registry", () => {
  const TRANSCRIBE = code("app", "api", "voice", "transcribe", "route.ts");
  const SPEAK = code("app", "api", "voice", "speak", "route.ts");

  for (const [name, source] of [
    ["transcribe", TRANSCRIBE],
    ["speak", SPEAK],
  ] as const) {
    void test(`${name} reads no environment variable directly`, () => {
      assert.ok(
        !/process\.env/.test(source),
        `${name} reads a key or a model name from the environment again.`,
      );
    });

    void test(`${name} takes its endpoint and key from the registry`, () => {
      assert.ok(
        !/api\.openai\.com|api\.groq\.com/.test(source),
        `${name} hardcodes a vendor URL again.`,
      );
      assert.match(source, /PROVIDER_ENDPOINTS\[\s*\w+\.model\.provider\s*\]\.baseUrl/);
      assert.match(source, /providerApiKey\(\s*\w+\.model\.provider\s*\)/);
    });
  }

  void test("transcribe resolves its model through the registry, plan-aware", () => {
    assert.match(
      TRANSCRIBE,
      /selectModel\(\s*requestedModel,\s*"transcription",\s*guard\.entitlement\.effectivePlan\s*\)/,
      "CRITICAL: the transcription model is not checked against the caller's plan.",
    );
    assert.ok(
      !/ALLOWED_MODELS|getRequestedModel|gpt-4o-transcribe/.test(TRANSCRIBE),
      "A private model list -- or a model the registry does not approve -- is back.",
    );
  });

  void test("speak resolves its model through the registry, plan-aware", () => {
    assert.match(
      SPEAK,
      /selectModel\(\s*requestedModel,\s*"speech",\s*guard\.entitlement\.effectivePlan\s*\)/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*          P2-G08 — /api/agents stores only a registry-approved model        */
/* -------------------------------------------------------------------------- */

void describe("P2-G08: /api/agents stores only a registry-approved model", () => {
  const AGENTS = code("app", "api", "agents", "route.ts");

  void test("no model comes from the environment or a hardcoded default", () => {
    assert.ok(
      !/process\.env/.test(AGENTS),
      "An env-named model can reach the agents table again.",
    );
    assert.ok(
      !/"(?:llama-[\w.-]+|gpt-[\w.-]+)"/.test(AGENTS),
      "A hardcoded model id is a second copy of the registry's default.",
    );
  });

  void test("a named model is validated against the registry and the caller's plan", () => {
    assert.match(AGENTS, /resolveEntitlement\(\s*session\.supabase,\s*session\.userId\s*\)/);
    assert.match(
      AGENTS,
      /selectModel\(\s*requestedModel,\s*"chat",\s*entitlement\.entitlement\.effectivePlan\s*\)/,
      "CRITICAL: a stored model is not checked against the caller's plan.",
    );
    assert.match(
      AGENTS,
      /if \(!selection\.ok\)\s*\{\s*return errorResponse\(/,
      "A refused model must be refused, not stored.",
    );
  });

  void test("only the registry's choice is stored as the model", () => {
    assert.match(AGENTS, /\bmodel\s*=\s*selection\.model\.id\b/);
    assert.ok(
      !/\bmodel\s*=\s*requestedModel\b/.test(AGENTS),
      "The client's raw value is stored as the model again.",
    );
  });

  void test("a UI preference label is kept as a preference, not a model", () => {
    assert.match(AGENTS, /modelPreference\s*=\s*requestedModel/);
    assert.match(AGENTS, /configuration:\s*\{[\s\S]{0,200}?modelPreference/);
  });
});

/* -------------------------------------------------------------------------- */
/*        P2-P — every kept page is reachable; retired pages stay gone        */
/* -------------------------------------------------------------------------- */

void describe("P2-P: orphan pages are linked or retired", () => {
  const productFiles = [
    ...sourceFiles(join(ROOT, "app")),
    ...sourceFiles(join(ROOT, "lib")),
  ];

  function stripped(file: string): string {
    return readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
  }

  function filesMatching(files: string[], pattern: RegExp): string[] {
    return files.filter((file) => pattern.test(stripped(file))).map(relative);
  }

  void test("P2-P01: /chat/[id] is retired and no chat page keeps conversations in the browser", () => {
    assert.ok(
      !existsSync(join(ROOT, "app", "chat", "[id]", "page.tsx")),
      "/chat/[id] is back. It kept conversations in localStorage and " +
        "presented them as saved; a conversation page needs server storage.",
    );
    assert.deepEqual(
      filesMatching(sourceFiles(join(ROOT, "app", "chat")), /\b(?:localStorage|sessionStorage)\b/),
      [],
      "A chat surface stores conversations in web storage again.",
    );
  });

  void test("P2-P01: nothing links to a /chat/<id> page", () => {
    assert.deepEqual(
      filesMatching(productFiles, /["'`]\/chat\/(?:\$\{|[\w-])/),
      [],
      "A link points at the retired /chat/<id> page.",
    );
  });

  void test("P2-P02: /teams links to each team's page, and that page exists", () => {
    assert.ok(existsSync(join(ROOT, "app", "teams", "[id]", "page.tsx")));
    assert.match(
      code("app", "teams", "page.tsx"),
      /<Link\s+href=\{`\/teams\/\$\{encodeURIComponent\(selectedTeam\.id\)\}`\}/,
      "/teams/[id] is unreachable again: /teams no longer links to it.",
    );
  });

  void test("P2-P03: /privacy/activity is retired and nothing links to it", () => {
    assert.ok(
      !existsSync(join(ROOT, "app", "privacy", "activity", "page.tsx")),
      "/privacy/activity is back without an audit-log backend.",
    );
    assert.deepEqual(
      filesMatching(productFiles, /["'`]\/privacy\/activity(?:["'`?#/]|$)/),
      [],
      "A link points at the retired /privacy/activity page.",
    );
  });
});
