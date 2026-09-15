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
import { existsSync, readFileSync } from "node:fs";
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
