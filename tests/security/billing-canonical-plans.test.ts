/**
 * SYRAVEN — one canonical billing vocabulary
 *
 * WHY THIS FILE EXISTS
 *
 * Billing spoke three incompatible vocabularies at once:
 *
 *   lib/plans.ts (canonical)  free | starter | pro | business | enterprise
 *   checkout route            free | pro | premium | vip
 *   /billing page             free | premium | pro | business | enterprise
 *
 * "premium" meant `starter` and "vip" was a SECOND alias for `pro`, so
 * two different Stripe prices granted the same plan. A €19 price
 * attached to STRIPE_PRICE_PRO_MONTHLY would have sold the €49 tier for
 * €19 -- a silent revenue leak with no error anywhere.
 *
 * Three further defects were found while normalising:
 *
 *   - /billing sent "month"/"year"; the route accepted only
 *     "monthly"/"yearly", so EVERY upgrade click returned 400
 *     INVALID_INTERVAL. Checkout was unreachable from the UI.
 *   - /billing displayed Business at €99/€990 against €199/€1990 in
 *     lib/plans.ts.
 *   - The webhook carried a DUPLICATE price map reading only the four
 *     single-price variables. Any interval-specific price -- which is
 *     what checkout actually subscribes with -- fell through to "free",
 *     resolving a paying customer to the free tier.
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

/** Strips comments so prose about a defect cannot satisfy a test for it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

const CHECKOUT = stripComments(read("app", "api", "billing", "checkout", "route.ts"));
const WEBHOOK = stripComments(read("app", "api", "billing", "webhook", "route.ts"));
const RESOLUTION = stripComments(read("lib", "billing", "planResolution.ts"));
const BILLING_PAGE = stripComments(read("app", "billing", "page.tsx"));
const PLANS = read("lib", "plans.ts");

/** The canonical paid plans a customer can self-serve. */
const SELLABLE = ["starter", "pro", "business"] as const;

/** Canonical prices, read from lib/plans.ts — the source of truth. */
function priceOf(plan: string): { monthly: number; yearly: number } {
  const at = PLANS.indexOf(`id: "${plan}",`);

  assert.ok(at > 0, `plan ${plan} not found in lib/plans.ts`);

  const block = PLANS.slice(at, at + 1200);
  const m = block.match(/monthlyPrice:\s*(\d+)/);
  const y = block.match(/yearlyPrice:\s*(\d+)/);

  assert.ok(m && y, `prices for ${plan} not found`);

  return { monthly: Number(m![1]), yearly: Number(y![1]) };
}

/* -------------------------------------------------------------------------- */
/*                        ONE VOCABULARY, EVERYWHERE                          */
/* -------------------------------------------------------------------------- */

void describe("The legacy premium/vip vocabulary is retired", () => {
  void test("checkout sells only canonical plans", () => {
    const m = CHECKOUT.match(/type BillingPlan =([^;]*);/);

    assert.ok(m, "BillingPlan union not found.");

    const names = [...(m[1] ?? "").matchAll(/"([a-z]+)"/g)].map((x) => x[1]);

    assert.deepEqual(
      names.sort(),
      ["business", "free", "pro", "starter"],
      "CRITICAL: checkout must speak the canonical vocabulary.",
    );
  });

  void test("checkout accepts no legacy plan name", () => {
    for (const legacy of ["premium", "vip", "plus", "team"]) {
      assert.ok(
        !new RegExp(`"${legacy}"`).test(CHECKOUT),
        `CRITICAL: checkout still accepts "${legacy}".`,
      );
    }
  });

  void test("the billing page uses canonical plan ids", () => {
    const m = BILLING_PAGE.match(/type SyravenPlan =([\s\S]{0,200}?);/);

    assert.ok(m, "SyravenPlan union not found.");

    const names = [...(m[1] ?? "").matchAll(/"([a-z]+)"/g)].map((x) => x[1]);

    assert.deepEqual(
      names.sort(),
      ["business", "enterprise", "free", "pro", "starter"],
      "The billing UI must not invent its own plan names.",
    );
  });

  void test("legacy aliases survive for READING existing data", () => {
    /*
     * Deleting these would silently demote a paying customer whose
     * Stripe metadata still says "premium" or "vip". They are read-only
     * compatibility and must never be written back.
     */
    assert.match(RESOLUTION, /premium:\s*"starter"/);
    assert.match(RESOLUTION, /vip:\s*"pro"/);
  });
});

/* -------------------------------------------------------------------------- */
/*                          PRICE ENV VAR MAPPING                             */
/* -------------------------------------------------------------------------- */

void describe("Stripe price variables are canonical", () => {
  void test("checkout reads exactly the six sellable variables", () => {
    const vars = [...CHECKOUT.matchAll(/STRIPE_PRICE_[A-Z_]+/g)].map((m) => m[0]);

    assert.deepEqual(
      [...new Set(vars)].sort(),
      [
        "STRIPE_PRICE_BUSINESS_MONTHLY",
        "STRIPE_PRICE_BUSINESS_YEARLY",
        "STRIPE_PRICE_PRO_MONTHLY",
        "STRIPE_PRICE_PRO_YEARLY",
        "STRIPE_PRICE_STARTER_MONTHLY",
        "STRIPE_PRICE_STARTER_YEARLY",
      ],
      "Checkout must read exactly the canonical six.",
    );
  });

  void test("no PREMIUM or VIP price variable is read anywhere", () => {
    for (const source of [CHECKOUT, WEBHOOK, RESOLUTION]) {
      for (const dead of ["STRIPE_PRICE_PREMIUM", "STRIPE_PRICE_VIP"]) {
        assert.ok(
          !new RegExp(`process\\.env\\.${dead}`).test(source),
          `CRITICAL: ${dead} is still read; it maps to the wrong tier.`,
        );
      }
    }
  });

  void test("every checkout variable resolves back to the same plan", () => {
    /*
     * The round trip that matters: a price sold as X must be resolved as
     * X by the webhook, or the customer is charged for one plan and
     * granted another.
     */
    for (const plan of SELLABLE) {
      for (const interval of ["MONTHLY", "YEARLY"]) {
        const env = `STRIPE_PRICE_${plan.toUpperCase()}_${interval}`;

        const entry = RESOLUTION.match(
          new RegExp(`\\{\\s*env:\\s*"${env}",\\s*plan:\\s*"([a-z]+)"\\s*\\}`),
        );

        assert.ok(entry, `${env} has no webhook mapping.`);

        assert.equal(
          entry![1],
          plan,
          `CRITICAL: ${env} is sold as ${plan} but resolves as ${entry![1]}.`,
        );
      }
    }
  });

  void test("no price variable maps to two different plans", () => {
    const pairs = [...RESOLUTION.matchAll(/env:\s*"(STRIPE_PRICE_[A-Z_]+)",\s*plan:\s*"([a-z]+)"/g)];
    const seen = new Map<string, string>();

    for (const [, env, plan] of pairs) {
      const prior = seen.get(env!);

      assert.ok(
        prior === undefined || prior === plan,
        `${env} maps to both ${prior} and ${plan}.`,
      );

      seen.set(env!, plan!);
    }

    assert.ok(seen.size > 0, "Expected a price map to inspect.");
  });
});

/* -------------------------------------------------------------------------- */
/*                          PLANS x INTERVALS                                 */
/* -------------------------------------------------------------------------- */

void describe("All three plans are sellable on both intervals", () => {
  for (const plan of SELLABLE) {
    for (const interval of ["monthly", "yearly"] as const) {
      void test(`${plan} / ${interval} has a price source`, () => {
        const env = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;

        assert.ok(
          CHECKOUT.includes(env),
          `${plan} cannot be sold ${interval}: ${env} is not read.`,
        );
      });
    }
  }

  void test("enterprise is NOT self-servable", () => {
    /* Enterprise is quoted, not bought with a card. */
    assert.ok(
      !/enterprise:\s*\{/.test(CHECKOUT),
      "Enterprise must not have a checkout price entry.",
    );
  });

  void test("free resolves to no price", () => {
    assert.match(
      CHECKOUT,
      /if\s*\(\s*plan === "free"\s*\)\s*\{\s*\n?\s*return null;/,
      "The free plan must never produce a Stripe price.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                              INTERVALS                                     */
/* -------------------------------------------------------------------------- */

void describe("Interval handling is consistent end to end", () => {
  void test("the billing page sends the canonical interval", () => {
    assert.match(
      BILLING_PAGE,
      /yearly \? "yearly" : "monthly"/,
      'CRITICAL: sending "year"/"month" returns 400 INVALID_INTERVAL and ' +
        "makes checkout unreachable from the UI.",
    );

    assert.ok(
      !/yearly \? "year" : "month"/.test(BILLING_PAGE),
      "The short interval spelling must not be sent.",
    );
  });

  void test("the page's interval type matches the route", () => {
    assert.match(BILLING_PAGE, /type BillingInterval =\s*"monthly" \| "yearly"/);
  });

  void test("the route canonicalises both spellings", () => {
    for (const accepted of ["monthly", "month", "yearly", "year"]) {
      assert.ok(
        new RegExp(`case "${accepted}":`).test(CHECKOUT),
        `The route should tolerate "${accepted}".`,
      );
    }
  });

  void test("an unknown interval is refused", () => {
    assert.match(
      CHECKOUT,
      /default:\s*\n?\s*return null;/,
      "An unrecognised interval must not fall back to a default.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          DISPLAYED PRICING                                 */
/* -------------------------------------------------------------------------- */

void describe("Displayed prices match lib/plans.ts", () => {
  for (const plan of SELLABLE) {
    void test(`${plan} is displayed at its canonical price`, () => {
      const { monthly, yearly } = priceOf(plan);

      const at = BILLING_PAGE.indexOf(`id: "${plan}",`);

      assert.ok(at > 0, `${plan} not rendered on /billing.`);

      const block = BILLING_PAGE.slice(at, at + 700);

      assert.match(
        block,
        new RegExp(`monthlyPrice: "€${monthly}"`),
        `${plan} monthly price disagrees with lib/plans.ts (€${monthly}).`,
      );

      assert.match(
        block,
        new RegExp(`yearlyPrice: "€${yearly}"`),
        `${plan} yearly price disagrees with lib/plans.ts (€${yearly}).`,
      );
    });
  }

  void test("starter is €19 and pro is €49 — they are not the same tier", () => {
    /*
     * The confusion that started all of this: a €19 product named "PRO".
     */
    assert.equal(priceOf("starter").monthly, 19);
    assert.equal(priceOf("pro").monthly, 49);
    assert.equal(priceOf("business").monthly, 199);
  });
});

/* -------------------------------------------------------------------------- */
/*                          SECURITY PROPERTIES                               */
/* -------------------------------------------------------------------------- */

void describe("Normalisation preserved every security property", () => {
  void test("checkout still requires a session", () => {
    assert.match(CHECKOUT, /export const POST = withAuth\(/);
  });

  void test("the price id is server-derived, never client-supplied", () => {
    /*
     * The whole point of the map. Accepting a price id from the body
     * would let a caller pay the starter price for the business plan.
     */
    for (const forbidden of ["body.priceId", "body.price_id", "body.price", "body.amount"]) {
      assert.ok(
        !CHECKOUT.includes(forbidden),
        `CRITICAL: checkout reads ${forbidden} from the request.`,
      );
    }

    assert.match(
      CHECKOUT,
      /priceMap\[plan\]\[interval\]/,
      "The price must be looked up by (plan, interval) on the server.",
    );
  });

  void test("an unconfigured price fails closed", () => {
    assert.match(
      CHECKOUT,
      /\|\|\s*null;/,
      "A missing price must produce null, not a silent fallback price.",
    );
  });

  void test("the webhook still verifies its signature", () => {
    assert.match(WEBHOOK, /constructEvent/);
    assert.match(WEBHOOK, /STRIPE_WEBHOOK_SECRET/);
  });

  void test("the webhook resolves prices through the canonical map", () => {
    /*
     * It used to carry a duplicate map reading only the single-price
     * variables, so an interval-specific price -- what checkout actually
     * subscribes with -- resolved to "free".
     */
    assert.match(
      WEBHOOK,
      /planFromPriceId\(priceId\)/,
      "CRITICAL: a second price map drifts from the one checkout uses.",
    );
  });

  void test("an unknown price grants nothing", () => {
    assert.match(
      WEBHOOK,
      /resolved \?\? "free"/,
      "An unrecognised price must not grant a paid plan.",
    );
  });
});
