/**
 * SYRAVEN — Usage, entitlement and rate-limit enforcement tests
 *
 * Phase 5 (see IMPLEMENTATION_PLAN.md).
 *
 * ARCHITECTURE_AUDIT.md §17: lib/plans.ts defines every plan limit and
 * was imported only by the pricing page — limits were advertised to
 * users and never enforced. Combined with §8.2, AI spend was unbounded.
 *
 * These tests hold the enforcement line. They cover, per the phase brief:
 * unauthorized usage, cross-tenant usage, rate-limit bypass, concurrent
 * usage, spoofed plan/usage values, Ultra Pass expiration, and boundary
 * conditions.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* -------------------------------------------------------------------------- */
/*                          MIRRORED PURE LOGIC                               */
/* -------------------------------------------------------------------------- */

/*
 * lib/usage/* import "server-only", which does not load outside a Next.js
 * server runtime. The decision logic is pure, so it is mirrored here and
 * kept honest by the source-invariant suites at the bottom.
 */

const UNLIMITED = -1;

type TrialState = "none" | "active" | "expired";
type PlanId = "free" | "starter" | "pro" | "business" | "enterprise";

const TRIAL_EFFECTIVE_PLAN: PlanId = "business";
const DEFAULT_PLAN: PlanId = "free";

const ENTITLED_STATUSES = new Set(["active", "trialing"]);

function evaluateTrial(
  trialEndsAt: string | null,
  now: Date,
): TrialState {
  if (typeof trialEndsAt !== "string" || trialEndsAt.length === 0) {
    return "none";
  }

  const endsAt = Date.parse(trialEndsAt);
  if (!Number.isFinite(endsAt)) return "none";

  return now.getTime() < endsAt ? "active" : "expired";
}

function resolveEffectivePlan(input: {
  billedPlan: PlanId;
  subscriptionStatus: string;
  trial: TrialState;
}): PlanId {
  const { billedPlan, subscriptionStatus, trial } = input;

  if (trial === "active") return TRIAL_EFFECTIVE_PLAN;
  if (billedPlan === DEFAULT_PLAN) return DEFAULT_PLAN;
  if (!ENTITLED_STATUSES.has(subscriptionStatus)) return DEFAULT_PLAN;

  return billedPlan;
}

function withinLimit(maximum: number, used: number): boolean {
  if (maximum === UNLIMITED) return true;
  if (maximum <= 0) return false;
  return used < maximum;
}

const PLAN_MAX_TOKENS: Record<PlanId, number> = {
  free: 2_000,
  starter: 4_000,
  pro: 8_000,
  business: 16_000,
  enterprise: 32_000,
};

function clampMaxTokens(plan: PlanId, requested: unknown): number {
  const ceiling = PLAN_MAX_TOKENS[plan];
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return ceiling;
  }
  const floored = Math.floor(requested);
  if (floored < 1) return ceiling;
  return Math.min(floored, ceiling);
}

function windowStart(window: "day" | "month", now: Date): Date {
  if (window === "day") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/* -------------------------------------------------------------------------- */
/*                      ULTRA PASS / TRIAL EXPIRATION                         */
/* -------------------------------------------------------------------------- */

void describe("14-day Ultra Pass trial", () => {
  const NOW = new Date("2026-09-04T12:00:00Z");

  void test("an active trial grants full-access limits", () => {
    const trial = evaluateTrial("2026-09-10T12:00:00Z", NOW);

    assert.equal(trial, "active");
    assert.equal(
      resolveEffectivePlan({
        billedPlan: "free",
        subscriptionStatus: "inactive",
        trial,
      }),
      TRIAL_EFFECTIVE_PLAN,
      "During the trial the user gets full-access limits, per the " +
        "lib/plans.ts header.",
    );
  });

  void test("an expired trial falls back to free, not to trial limits", () => {
    const trial = evaluateTrial("2026-09-01T12:00:00Z", NOW);

    assert.equal(trial, "expired");
    assert.equal(
      resolveEffectivePlan({
        billedPlan: "free",
        subscriptionStatus: "inactive",
        trial,
      }),
      "free",
      "TRIAL_CONFIG.autoConvertToPaid is false: an expired trial returns " +
        "to the limited free tier and is never charged.",
    );
  });

  void test("expiry is evaluated at the exact boundary", () => {
    const endsAt = "2026-09-04T12:00:00Z";

    assert.equal(
      evaluateTrial(endsAt, new Date("2026-09-04T11:59:59Z")),
      "active",
      "One second before expiry the trial is still active.",
    );

    assert.equal(
      evaluateTrial(endsAt, new Date(endsAt)),
      "expired",
      "At the instant of expiry the trial has ended — the comparison is " +
        "strict, so the boundary does not grant a free extra moment.",
    );
  });

  void test("a missing or malformed trial timestamp grants nothing", () => {
    for (const value of [null, "", "not-a-date", "∞"]) {
      assert.equal(
        evaluateTrial(value as string | null, NOW),
        "none",
        `${JSON.stringify(value)} must not read as an active trial.`,
      );
    }
  });

  void test("a far-future trial date cannot be supplied by the client", () => {
    /*
     * This is a source-level guarantee, asserted in the invariants suite:
     * trial_ends_at is read from public.profiles. The pure function
     * trusts its input precisely because the caller cannot reach it.
     */
    assert.equal(
      evaluateTrial("2099-01-01T00:00:00Z", NOW),
      "active",
      "The function itself is time-based; safety comes from the value " +
        "originating in the database.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        SPOOFED PLAN / SUBSCRIPTION                         */
/* -------------------------------------------------------------------------- */

void describe("Plan cannot be escalated by state the client controls", () => {
  void test("a paid plan without an active subscription gets free limits", () => {
    for (const status of [
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
      "unknown",
      "",
    ]) {
      assert.equal(
        resolveEffectivePlan({
          billedPlan: "enterprise",
          subscriptionStatus: status,
          trial: "none",
        }),
        "free",
        `subscription_status=${status} must not entitle enterprise limits.`,
      );
    }
  });

  void test("only active and trialing subscriptions entitle", () => {
    for (const status of ["active", "trialing"]) {
      assert.equal(
        resolveEffectivePlan({
          billedPlan: "pro",
          subscriptionStatus: status,
          trial: "none",
        }),
        "pro",
      );
    }
  });

  void test("an unknown plan value degrades rather than widening access", () => {
    /*
     * resolveEntitlement() runs isPlanId() before this point, so a
     * profile row containing "enterprise-unlimited" resolves to the
     * default plan. Asserted at source level in the invariants suite.
     */
    assert.equal(
      resolveEffectivePlan({
        billedPlan: DEFAULT_PLAN,
        subscriptionStatus: "active",
        trial: "none",
      }),
      "free",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                           BOUNDARY CONDITIONS                              */
/* -------------------------------------------------------------------------- */

void describe("Quota boundary conditions", () => {
  void test("a limit of N permits exactly N operations", () => {
    assert.equal(withinLimit(20, 0), true, "first operation");
    assert.equal(withinLimit(20, 19), true, "twentieth operation");
    assert.equal(
      withinLimit(20, 20),
      false,
      "the twenty-first must be refused — off-by-one here is a free extra " +
        "unit of paid work per user per window.",
    );
    assert.equal(withinLimit(20, 21), false, "beyond the limit");
  });

  void test("UNLIMITED never blocks", () => {
    assert.equal(withinLimit(UNLIMITED, 0), true);
    assert.equal(withinLimit(UNLIMITED, 10_000_000), true);
  });

  void test("a zero or negative limit denies outright", () => {
    assert.equal(withinLimit(0, 0), false);
    assert.equal(
      withinLimit(-5, 0),
      false,
      "Only the -1 sentinel means unlimited; other negatives must deny.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        TOKEN CEILING CLAMPING                              */
/* -------------------------------------------------------------------------- */

void describe("Per-request token budget is clamped by plan", () => {
  void test("a free caller cannot request a paid-tier budget", () => {
    assert.equal(
      clampMaxTokens("free", 32_768),
      2_000,
      "Before Phase 5 any caller could request 16,000+ tokens per message.",
    );
  });

  void test("each plan has a distinct ceiling", () => {
    assert.equal(clampMaxTokens("free", 999_999), 2_000);
    assert.equal(clampMaxTokens("starter", 999_999), 4_000);
    assert.equal(clampMaxTokens("pro", 999_999), 8_000);
    assert.equal(clampMaxTokens("business", 999_999), 16_000);
    assert.equal(clampMaxTokens("enterprise", 999_999), 32_000);
  });

  void test("a request below the ceiling is honoured", () => {
    assert.equal(clampMaxTokens("pro", 500), 500);
  });

  void test("hostile values fall back to the ceiling, never above it", () => {
    for (const value of [
      -1,
      0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "99999",
      null,
      undefined,
      {},
    ]) {
      const result = clampMaxTokens("free", value);

      assert.ok(
        result > 0 && result <= 2_000,
        `${JSON.stringify(value)} produced ${result}, outside the free ceiling.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          WINDOW CORRECTNESS                                */
/* -------------------------------------------------------------------------- */

void describe("Usage windows", () => {
  void test("windows are UTC, so limits do not vary by region", () => {
    const now = new Date("2026-09-04T23:30:00Z");

    assert.equal(
      windowStart("day", now).toISOString(),
      "2026-09-04T00:00:00.000Z",
    );

    assert.equal(
      windowStart("month", now).toISOString(),
      "2026-09-01T00:00:00.000Z",
    );
  });

  void test("a caller near midnight does not get two daily allowances", () => {
    const before = new Date("2026-09-04T23:59:59Z");
    const after = new Date("2026-09-05T00:00:01Z");

    assert.notEqual(
      windowStart("day", before).toISOString(),
      windowStart("day", after).toISOString(),
      "The window must roll exactly once at the UTC boundary.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     ROUTE COVERAGE (STRUCTURAL)                            */
/* -------------------------------------------------------------------------- */

const API_DIR = join(process.cwd(), "app", "api");

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

void describe("Every AI-spending route enforces and records usage", () => {
  /**
   * Routes that call a paid provider. Each must check limits BEFORE the
   * call and record consumption AFTER, or the limits never bind.
   */
  const METERED_ROUTES = [
    "app/api/chat/route.ts",
    "app/api/agents/execute/route.ts",
    "app/api/stream/route.ts",
    "app/api/files/analyze/route.ts",
    "app/api/voice/speak/route.ts",
    "app/api/voice/transcribe/route.ts",
    "app/api/canvas/route.ts",
  ];

  for (const id of METERED_ROUTES) {
    const code = stripComments(readFileSync(join(process.cwd(), id), "utf8"));

    void test(`${id} enforces usage before doing work`, () => {
      assert.match(
        code,
        /enforceUsage\s*\(/,
        `${id} spends money without checking the caller's plan limits.`,
      );

      assert.match(
        code,
        /guard\.denied[\s\S]{0,80}?return guard\.response/,
        `${id} calls enforceUsage but does not return its denial, so the ` +
          `check has no effect.`,
      );
    });

    void test(`${id} records what it consumed`, () => {
      assert.match(
        code,
        /guard\.record\s*\(/,
        `${id} never records usage, so checkQuota always counts zero and ` +
          `the limit never binds.`,
      );
    });
  }

  void test("no metered route trusts a client-supplied plan or usage", () => {
    for (const id of METERED_ROUTES) {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      for (const pattern of [
        /\bbody\s*\.\s*plan\b/,
        /\bbody\s*\.\s*usage\b/,
        /\bbody\s*\.\s*entitlement\b/,
        /\bbody\s*\.\s*tokensUsed\b/,
        /\bbody\s*\.\s*userId\b/,
      ]) {
        assert.doesNotMatch(
          code,
          pattern,
          `${id} reads ${pattern} from the request. Plan, identity and ` +
            `consumption must come from the database and the provider.`,
        );
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                    ALTERNATE-ROUTE BYPASS COVERAGE                         */
/* -------------------------------------------------------------------------- */

void describe("No unmetered path to a paid provider", () => {
  void test("every route calling an AI provider is metered", () => {
    /**
     * Guards the specific bypass named in the brief: a caller at their
     * limit switching to a different endpoint that reaches the same
     * providers.
     */
    const routeFiles: string[] = [];

    (function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "route.ts") routeFiles.push(full);
      }
    })(API_DIR);

    const unmetered: string[] = [];

    for (const file of routeFiles) {
      const code = stripComments(readFileSync(file, "utf8"));

      const callsProvider =
        /api\.openai\.com|api\.groq\.com|chat\/completions|audio\/(speech|transcriptions)/.test(
          code,
        );

      if (!callsProvider) continue;

      if (!/enforceUsage\s*\(/.test(code)) {
        unmetered.push(
          file.replace(process.cwd(), "").replace(/\\/g, "/"),
        );
      }
    }

    assert.deepEqual(
      unmetered,
      [],
      `These routes reach a paid AI provider without usage enforcement, ` +
        `so a caller at their limit could use them instead:\n${unmetered.join("\n")}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      SOURCE INVARIANTS — ENTITLEMENTS                      */
/* -------------------------------------------------------------------------- */

void describe("lib/usage/entitlements.ts invariants", () => {
  const source = read("lib", "usage", "entitlements.ts");

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("the plan is read from the database, not the request", () => {
    assert.match(
      source,
      /\.from\("profiles"\)[\s\S]{0,200}?\.eq\("id",\s*userId\)/,
      "Entitlement must be resolved from public.profiles keyed on the " +
        "verified session id.",
    );
  });

  void test("a lookup failure denies rather than granting", () => {
    const errorBranch = source.slice(
      source.indexOf("if (error) {"),
      source.indexOf("if (!data) {"),
    );

    assert.match(errorBranch, /ok:\s*false/);
    assert.doesNotMatch(
      errorBranch,
      /ok:\s*true/,
      "An error path must never resolve to a granted entitlement.",
    );
  });

  void test("an unrecognised plan degrades to the default", () => {
    assert.match(
      source,
      /isPlanId\(record\.plan\)\s*\n?\s*\?\s*record\.plan\s*\n?\s*:\s*DEFAULT_PLAN/,
    );
  });

  void test("the subscription-status gate is actually applied", () => {
    /*
     * The behavioural tests above exercise a mirror of this logic, so they
     * cannot see the real gate being removed. This asserts the source
     * itself still consults ENTITLED_STATUSES before honouring a paid
     * plan — deleting that check would let a canceled subscription keep
     * enterprise limits.
     */
    const code = stripComments(source);

    assert.match(
      code,
      /if \(!ENTITLED_STATUSES\.has\(subscriptionStatus\)\)\s*\{[\s\S]{0,120}?return DEFAULT_PLAN;/,
      "resolveEffectivePlan must fall back to the default plan when the " +
        "subscription is not in an entitled state.",
    );
  });

  void test("the entitled-status set stays minimal", () => {
    const code = stripComments(source);

    const block = code.match(
      /const ENTITLED_STATUSES = new Set\(\[([\s\S]*?)\]\)/,
    );

    assert.ok(block, "ENTITLED_STATUSES not found.");

    const statuses = (block[1]?.match(/"([a-z_]+)"/g) ?? []).map((s) =>
      s.replace(/"/g, ""),
    );

    assert.deepEqual(
      statuses.sort(),
      ["active", "trialing"],
      "Only active and trialing may entitle a paid plan. Adding a status " +
        "here (past_due, unpaid…) grants paid limits to lapsed accounts.",
    );
  });

  void test("the UNLIMITED sentinel matches lib/plans.ts", () => {
    const plans = read("lib", "plans.ts");

    assert.match(
      plans,
      /const UNLIMITED = -1/,
      "lib/plans.ts must keep using -1 as the unlimited sentinel; the " +
        "mirror in entitlements.ts depends on it.",
    );

    assert.match(source, /export const UNLIMITED = -1/);
  });

  void test("the trial's effective plan is an explicit constant", () => {
    const plans = read("lib", "plans.ts");

    assert.match(
      plans,
      /export const TRIAL_EFFECTIVE_PLAN: PlanId = "business"/,
      "Which limits a full-access trial grants must be stated, not " +
        "inferred — TRIAL_PLAN_ID is 'free', whose limits are restricted.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        SOURCE INVARIANTS — METER                           */
/* -------------------------------------------------------------------------- */

void describe("lib/usage/meter.ts invariants", () => {
  const source = read("lib", "usage", "meter.ts");

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("counting is durable, not in-process", () => {
    assert.match(
      source,
      /\.from\("usage"\)/,
      "Quota counts must come from the shared database. An in-memory " +
        "counter is per-instance and lost on restart, so it is not a " +
        "security control.",
    );

    assert.match(
      source,
      /\.from\("rate_limit_events"\)/,
      "Rate limiting must also be durable and shared.",
    );

    assert.doesNotMatch(
      source,
      /new Map\s*\(|new Set\s*\(/,
      "No in-process state may back these counters.",
    );
  });

  void test("quota checks fail closed", () => {
    assert.match(
      source,
      /used === null[\s\S]{0,200}?allowed:\s*false/,
      "If usage cannot be counted the operation must be refused. An " +
        "attacker who can induce a database error must not gain " +
        "unlimited access.",
    );
  });

  void test("rate limiting fails closed", () => {
    assert.match(
      source,
      /if \(error\)[\s\S]{0,400}?allowed:\s*false/,
      "A rate-limit count failure must deny, not allow.",
    );
  });

  void test("rate limiting is keyed on the verified user, not an IP", () => {
    assert.match(source, /\.eq\("user_id",\s*userId\)/);

    assert.doesNotMatch(
      source,
      /x-forwarded-for|X-Forwarded-For|request\.ip/,
      "An IP is shared by many legitimate users and trivially rotated by " +
        "an attacker.",
    );
  });

  void test("recorded token counts cannot be negative", () => {
    assert.match(
      source,
      /function nonNegative[\s\S]{0,300}?value < 0 \? 0/,
      "A negative token count would drag a total downwards and mask real " +
        "consumption.",
    );
  });

  void test("an unknown rate-limit key denies rather than passing through", () => {
    /*
     * Assert on the code rather than the prose: the branch carries a long
     * explanatory comment, so a character-window regex over the raw source
     * would be measuring comment length rather than behaviour.
     */
    const code = stripComments(source);

    assert.match(
      code,
      /if \(!rule\)\s*\{[\s\S]{0,300}?allowed:\s*false/,
      "An endpoint with no declared rule must not be silently unlimited.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    SOURCE INVARIANTS — USAGE GUARD                         */
/* -------------------------------------------------------------------------- */

void describe("lib/api/usageGuard.ts invariants", () => {
  const source = read("lib", "api", "usageGuard.ts");

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("identity comes from the session, never from the request", () => {
    assert.match(source, /const userId = session\.userId/);

    assert.doesNotMatch(
      source,
      /request\.(json|nextUrl|headers)/,
      "The guard must not read identity or plan hints from the request.",
    );
  });

  void test("the rate-limit event is recorded before the work", () => {
    /*
     * Concurrency and abort safety: a caller that disconnects mid-request
     * must still have consumed burst allowance, otherwise the limit is
     * bypassable by aborting.
     */
    const recordIndex = source.search(/await recordRateLimitEvent\(/);
    const returnIndex = source.search(/denied: false,/);

    assert.ok(recordIndex !== -1, "the guard must record the attempt");
    assert.ok(
      recordIndex < returnIndex,
      "recordRateLimitEvent must run before the guard hands control back.",
    );
  });

  void test("quota denial reports 429 and entitlement failure 503", () => {
    assert.match(source, /QUOTA_EXCEEDED/);
    assert.match(source, /429/);
    assert.match(source, /503/);
  });

  void test("a missing profile denies rather than assuming a plan", () => {
    assert.match(
      source,
      /PROFILE_NOT_FOUND[\s\S]{0,400}?denial\(\s*\n?\s*403/,
      "A session with no profile has an unknown entitlement and must not " +
        "be served paid-tier work.",
    );
  });

  void test("denials are never cached", () => {
    assert.match(source, /"Cache-Control":\s*"private,\s*no-store"/);
  });
});
