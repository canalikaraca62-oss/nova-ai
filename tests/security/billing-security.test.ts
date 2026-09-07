/**
 * SYRAVEN — Billing security tests
 *
 * Phase 6 (see IMPLEMENTATION_PLAN.md).
 *
 * Two audit findings drive this suite:
 *
 *   §8.4 — the webhook stored no event id, so Stripe's at-least-once
 *          delivery re-applied billing side effects.
 *   §8.5 — the checkout path set the plan from session metadata without
 *          reconciling against the price actually purchased.
 *
 * Since Phase 5 both are AUTHORIZATION issues: profiles.plan decides what
 * AI work an account may consume, so a replayed or metadata-forged event
 * escalates entitlement, not merely billing.
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

/* -------------------------------------------------------------------------- */
/*                        MIRRORED PLAN RESOLUTION                            */
/* -------------------------------------------------------------------------- */

/*
 * lib/billing/planResolution.ts imports "server-only". The logic is
 * pure, so it is mirrored here and held to the source by the invariant
 * suites below.
 */

type PlanId = "free" | "starter" | "pro" | "business" | "enterprise";

const LEGACY_ALIASES: Record<string, PlanId> = {
  premium: "starter",
  plus: "starter",
  vip: "pro",
  team: "business",
  free: "free",
  starter: "starter",
  pro: "pro",
  business: "business",
  enterprise: "enterprise",
};

function isPlanId(v: unknown): v is PlanId {
  return (
    v === "free" ||
    v === "starter" ||
    v === "pro" ||
    v === "business" ||
    v === "enterprise"
  );
}

function normalizePlanId(value: unknown): PlanId | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (key.length === 0) return null;
  if (isPlanId(key)) return key;
  return LEGACY_ALIASES[key] ?? null;
}

function resolvePlan(input: {
  priceId?: string | null;
  metadataPlan?: unknown;
  priceMap?: Record<string, PlanId>;
}): { plan: PlanId; source: string; metadataConflict: boolean } {
  const map = input.priceMap ?? {};

  const fromPrice =
    typeof input.priceId === "string" && input.priceId.trim()
      ? (map[input.priceId.trim()] ?? null)
      : null;

  const fromMetadata = normalizePlanId(input.metadataPlan);

  if (fromPrice !== null) {
    return {
      plan: fromPrice,
      source: "price",
      metadataConflict:
        fromMetadata !== null && fromMetadata !== fromPrice,
    };
  }

  if (fromMetadata !== null) {
    return {
      plan: fromMetadata,
      source: "metadata_confirmed",
      metadataConflict: false,
    };
  }

  return { plan: "free", source: "default", metadataConflict: false };
}

/* -------------------------------------------------------------------------- */
/*                  METADATA MUST NOT OVERRIDE THE PRICE                      */
/* -------------------------------------------------------------------------- */

void describe("Plan resolution: the purchased price is authoritative", () => {
  const PRICE_MAP: Record<string, PlanId> = {
    price_starter_monthly: "starter",
    price_pro_monthly: "pro",
    price_business_monthly: "business",
  };

  void test("a forged metadata plan cannot escalate above the price", () => {
    const result = resolvePlan({
      priceId: "price_starter_monthly",
      metadataPlan: "enterprise",
      priceMap: PRICE_MAP,
    });

    assert.equal(
      result.plan,
      "starter",
      "A payload claiming enterprise while buying the starter price must " +
        "resolve to starter. This is ARCHITECTURE_AUDIT.md §8.5, and " +
        "since Phase 5 it is an entitlement escalation.",
    );

    assert.equal(result.source, "price");
    assert.equal(
      result.metadataConflict,
      true,
      "The disagreement must be flagged for the audit trail.",
    );
  });

  void test("metadata agreeing with the price is not flagged", () => {
    const result = resolvePlan({
      priceId: "price_pro_monthly",
      metadataPlan: "pro",
      priceMap: PRICE_MAP,
    });

    assert.equal(result.plan, "pro");
    assert.equal(result.metadataConflict, false);
  });

  void test("metadata cannot DOWNGRADE below the purchased price either", () => {
    /*
     * The price wins in both directions. A customer who paid for
     * business must not be dropped to free by a stale metadata value.
     */
    const result = resolvePlan({
      priceId: "price_business_monthly",
      metadataPlan: "free",
      priceMap: PRICE_MAP,
    });

    assert.equal(result.plan, "business");
  });

  void test("an unmapped price falls back to metadata, and says so", () => {
    const result = resolvePlan({
      priceId: "price_unknown",
      metadataPlan: "pro",
      priceMap: PRICE_MAP,
    });

    assert.equal(result.plan, "pro");
    assert.equal(
      result.source,
      "metadata_confirmed",
      "The weaker path must be identifiable, so an operator can see that " +
        "entitlement rested on metadata rather than on a price.",
    );
  });

  void test("no price and no usable metadata resolves to free", () => {
    for (const metadata of [
      null,
      undefined,
      "",
      "   ",
      "godmode",
      "unlimited",
      42,
      {},
      [],
    ]) {
      const result = resolvePlan({
        priceId: null,
        metadataPlan: metadata,
        priceMap: PRICE_MAP,
      });

      assert.equal(
        result.plan,
        "free",
        `${JSON.stringify(metadata)} must not grant a paid plan.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        PLAN VOCABULARY CONSISTENCY                         */
/* -------------------------------------------------------------------------- */

void describe("Plan vocabulary is canonical end to end", () => {
  void test("legacy names map onto real PlanId values", () => {
    assert.equal(normalizePlanId("premium"), "starter");
    assert.equal(normalizePlanId("plus"), "starter");
    assert.equal(normalizePlanId("vip"), "pro");
    assert.equal(normalizePlanId("team"), "business");
  });

  void test("every resolvable plan is a valid PlanId", () => {
    for (const input of [
      "premium",
      "plus",
      "vip",
      "team",
      "free",
      "starter",
      "pro",
      "business",
      "enterprise",
      "PREMIUM",
      "  Pro  ",
    ]) {
      const resolved = normalizePlanId(input);

      assert.ok(
        resolved !== null && isPlanId(resolved),
        `${input} resolved to ${resolved}, which isPlanId() would reject. ` +
          `Phase 5 would then degrade the account to free limits.`,
      );
    }
  });

  void test("the webhook no longer writes a non-PlanId value", () => {
    /*
     * The webhook previously declared its own union containing
     * "premium". Writing it produced a profiles.plan value that
     * isPlanId() rejects, so a PAYING customer silently received
     * free-tier AI limits.
     */
    const code = stripComments(
      read("app", "api", "billing", "webhook", "route.ts"),
    );

    assert.doesNotMatch(
      code,
      /return\s+"premium"/,
      'The webhook must not write "premium"; it is not a PlanId.',
    );

    assert.match(
      code,
      /type SyravenPlan = PlanId/,
      "The webhook must use the canonical PlanId vocabulary.",
    );
  });

  void test("unknown values never resolve to a paid plan", () => {
    for (const input of ["ultra", "godmode", "admin", "", "  "]) {
      assert.equal(normalizePlanId(input), null);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                    IDEMPOTENCY / REPLAY  (§8.4, protocol §24)              */
/* -------------------------------------------------------------------------- */

void describe("Webhook idempotency", () => {
  const source = read("lib", "billing", "idempotency.ts");
  const code = stripComments(source);

  void test("the event id is claimed by INSERT, not check-then-act", () => {
    /*
     * A SELECT-then-INSERT races: two concurrent deliveries of the same
     * event would both see "not processed" and both proceed. The UNIQUE
     * constraint must be what enforces exclusion.
     */
    assert.match(
      code,
      /\.from\("billing_webhook_events"\)\s*\n?\s*\.insert\(/,
      "The claim must be an insert whose unique violation signals a " +
        "duplicate.",
    );

    assert.doesNotMatch(
      code,
      /\.select\([\s\S]{0,120}?stripe_event_id[\s\S]{0,120}?maybeSingle/,
      "A check-then-act claim is racy and must not be used.",
    );
  });

  void test("only a unique violation counts as already-processed", () => {
    assert.match(
      code,
      /UNIQUE_VIOLATION = "23505"/,
      "The duplicate signal must be the specific SQLSTATE.",
    );

    assert.match(
      code,
      /error\.code === UNIQUE_VIOLATION[\s\S]{0,400}?ALREADY_PROCESSED/,
    );
  });

  void test("a database failure is NOT treated as a duplicate", () => {
    /*
     * Treating an outage as "already processed" would silently DROP a
     * real billing event — the customer pays and never gets the plan.
     */
    assert.match(
      code,
      /CLAIM_FAILED/,
      "A non-unique-violation error must produce CLAIM_FAILED so Stripe " +
        "retries.",
    );
  });

  void test("the claim is written before the side effect", () => {
    const routeCode = stripComments(
      read("app", "api", "billing", "webhook", "route.ts"),
    );

    const claimIndex = routeCode.search(/await claimEvent\(/);
    const switchIndex = routeCode.search(/switch \(event\.type\)/);

    assert.ok(claimIndex !== -1, "the webhook must claim the event");
    assert.ok(
      claimIndex < switchIndex,
      "The event must be claimed BEFORE dispatch, otherwise a duplicate " +
        "can apply the side effect before the claim lands.",
    );
  });

  void test("a duplicate delivery is acknowledged without reprocessing", () => {
    const routeCode = stripComments(
      read("app", "api", "billing", "webhook", "route.ts"),
    );

    assert.match(
      routeCode,
      /ALREADY_PROCESSED[\s\S]{0,300}?duplicate: true/,
      "A replayed event must return success without repeating the " +
        "billing update (protocol §24).",
    );
  });

  void test("a claim failure returns an error so Stripe retries", () => {
    const routeCode = stripComments(
      read("app", "api", "billing", "webhook", "route.ts"),
    );

    assert.match(
      routeCode,
      /errorResponse\(\s*\n?\s*"Billing event could not be recorded\.",\s*\n?\s*503/,
    );
  });

  void test("a handler failure is recorded and rethrown", () => {
    const routeCode = stripComments(
      read("app", "api", "billing", "webhook", "route.ts"),
    );

    assert.match(
      routeCode,
      /status: "failed"[\s\S]{0,200}?throw handlerError/,
      "A failed side effect must be recorded before the error propagates.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       SIGNATURE VERIFICATION                               */
/* -------------------------------------------------------------------------- */

void describe("Webhook authenticity", () => {
  const code = stripComments(
    read("app", "api", "billing", "webhook", "route.ts"),
  );

  void test("the signature is verified before any processing", () => {
    const verifyIndex = code.search(/constructEvent\(/);
    const claimIndex = code.search(/await claimEvent\(/);

    assert.ok(verifyIndex !== -1, "signature verification must exist");
    assert.ok(
      verifyIndex < claimIndex,
      "An unverified payload must never reach the idempotency store or a " +
        "handler.",
    );
  });

  void test("the raw body is used for verification", () => {
    assert.match(
      code,
      /await request\.text\(\)/,
      "Signature verification requires the raw body; parsing first breaks " +
        "it.",
    );

    const textIndex = code.search(/await request\.text\(\)/);
    const jsonIndex = code.search(/await request\.json\(\)/);

    assert.ok(
      jsonIndex === -1 || textIndex < jsonIndex,
      "request.json() must not precede the raw-body read.",
    );
  });

  void test("a missing signature is rejected", () => {
    assert.match(code, /Missing Stripe signature[\s\S]{0,80}?400/);
  });

  void test("an invalid signature is rejected", () => {
    assert.match(code, /Invalid webhook signature[\s\S]{0,80}?400/);
  });

  void test("an unconfigured Stripe fails closed", () => {
    /*
     * With no secret the route must not process events. It returns 200
     * so Stripe stops retrying against an environment that will never
     * accept them, but performs NO side effect.
     */
    assert.match(
      code,
      /!stripe \|\|\s*\n?\s*!webhookSecret[\s\S]{0,400}?configured: false/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      SUBSCRIPTION STATE TRANSITIONS                        */
/* -------------------------------------------------------------------------- */

void describe("Subscription lifecycle is handled", () => {
  const code = stripComments(
    read("app", "api", "billing", "webhook", "route.ts"),
  );

  for (const event of [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
  ]) {
    void test(`${event} is handled`, () => {
      assert.match(
        code,
        new RegExp(`case "${event.replace(/\./g, "\\.")}"`),
      );
    });
  }

  void test("cancellation downgrades to free and clears the subscription", () => {
    assert.match(
      code,
      /plan: "free",\s*\n?\s*status: "canceled",\s*\n?\s*customerId,\s*\n?\s*subscriptionId: null,/,
      "A deleted subscription must drop the plan to free and null the " +
        "subscription id, so a later event cannot resurrect entitlement.",
    );
  });

  void test("a failed payment marks past_due without changing the plan", () => {
    assert.match(
      code,
      /status: "past_due"/,
      "A failed payment sets past_due. Phase 5 then refuses paid limits " +
        "for that status, so entitlement drops without the plan record " +
        "being rewritten.",
    );
  });

  void test("past_due does not entitle paid limits", () => {
    /*
     * The link between billing state and entitlement: a lapsed
     * subscription must not keep paid AI limits.
     */
    const entitlements = stripComments(
      read("lib", "usage", "entitlements.ts"),
    );

    const block = entitlements.match(
      /const ENTITLED_STATUSES = new Set\(\[([\s\S]*?)\]\)/,
    );

    assert.ok(block, "ENTITLED_STATUSES not found");

    assert.doesNotMatch(
      block[1] ?? "",
      /past_due|unpaid|canceled|incomplete/,
      "Only active and trialing may entitle paid limits.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    CHECKOUT / PORTAL AUTHORIZATION                         */
/* -------------------------------------------------------------------------- */

void describe("Checkout and portal authorization", () => {
  for (const route of ["checkout", "portal"]) {
    const code = stripComments(
      read("app", "api", "billing", route, "route.ts"),
    );

    void test(`${route} requires a verified session`, () => {
      assert.match(
        code,
        /export const POST = withAuth\(/,
        `${route} must run behind the shared authentication boundary.`,
      );
    });

    void test(`${route} takes its user id from the session`, () => {
      assert.match(code, /session\.userId/);

      assert.doesNotMatch(
        code,
        /body\.userId|searchParams\.get\("userId"\)/,
        `${route} must not accept a caller-supplied user id — that would ` +
          `let one account start checkout or open a billing portal for ` +
          `another.`,
      );
    });
  }

  void test("checkout maps plan to price server-side", () => {
    const code = stripComments(
      read("app", "api", "billing", "checkout", "route.ts"),
    );

    assert.match(
      code,
      /const priceId = getPriceId\(/,
      "The price must be derived server-side from the requested plan; a " +
        "client-supplied price id would let a caller buy a cheap price " +
        "while claiming an expensive plan.",
    );

    assert.doesNotMatch(
      code,
      /body\.priceId|body\.price_id/,
      "A client-supplied price id must never be used.",
    );
  });

  void test("checkout refuses an unconfigured price rather than guessing", () => {
    const code = stripComments(
      read("app", "api", "billing", "checkout", "route.ts"),
    );

    assert.match(
      code,
      /if \(!priceId\)/,
      "A missing price configuration must fail closed.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    lib/billing/planResolution INVARIANTS                   */
/* -------------------------------------------------------------------------- */

void describe("lib/billing/planResolution.ts invariants", () => {
  const source = read("lib", "billing", "planResolution.ts");
  const code = stripComments(source);

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("the price branch is checked before metadata", () => {
    const priceIndex = code.search(/if \(fromPrice !== null\)/);
    const metaIndex = code.search(/if \(fromMetadata !== null\)/);

    assert.ok(priceIndex !== -1 && metaIndex !== -1);
    assert.ok(
      priceIndex < metaIndex,
      "Price must take precedence over metadata.",
    );
  });

  void test("the default is the free plan", () => {
    assert.match(
      code,
      /plan: DEFAULT_PLAN,\s*\n?\s*source: "default"/,
      "An unresolvable purchase must not guess at a paid plan.",
    );
  });

  void test("a conflicting price configuration keeps the lower plan", () => {
    assert.match(
      code,
      /lowerPlan\(existing, plan\)/,
      "One Stripe price mapped to two plans must resolve downward, not " +
        "upward, and must be reported.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     MIGRATION / TYPE AGREEMENT                             */
/* -------------------------------------------------------------------------- */

void describe("billing_webhook_events migration and types agree", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260904130000_syraven_billing_idempotency.sql",
  );

  const types = read("types", "billing-webhook-events.ts");

  void test("the idempotency key is UNIQUE", () => {
    assert.match(
      migration,
      /stripe_event_id\s+text not null unique/i,
      "Without the unique constraint there is no idempotency at all.",
    );
  });

  void test("RLS is enabled and deny-all", () => {
    assert.match(
      migration,
      /alter table public\.billing_webhook_events enable row level security/i,
    );

    assert.doesNotMatch(
      migration,
      /create policy/i,
      "This table is written only by the webhook handler. A client-facing " +
        "policy would expose other customers' billing events, or let a " +
        "caller forge an 'already processed' row to suppress an update.",
    );
  });

  void test("every column in the migration is declared in the types", () => {
    const columns = [
      "stripe_event_id",
      "event_type",
      "received_at",
      "processed_at",
      "status",
      "user_id",
      "stripe_customer_id",
      "resolved_plan",
      "plan_source",
      "error_message",
    ];

    for (const column of columns) {
      assert.match(
        migration,
        new RegExp(`\\b${column}\\b`),
        `${column} missing from the migration.`,
      );

      assert.match(
        types,
        new RegExp(`\\b${column}\\b`),
        `${column} missing from types/billing-webhook-events.ts — the ` +
          `hand-written type must mirror the migration exactly.`,
      );
    }
  });

  void test("the migration is additive", () => {
    const sql = migration
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");

    for (const pattern of [
      /\bdrop\s+table\b/i,
      /\btruncate\b/i,
      /\bdelete\s+from\b/i,
    ]) {
      assert.doesNotMatch(sql, pattern);
    }
  });
});
