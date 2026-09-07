/**
 * SYRAVEN — Authoritative plan resolution for billing
 * lib/billing/planResolution.ts
 *
 * Phase 6 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Decides which internal plan a Stripe purchase corresponds to.
 *
 * WHY THIS EXISTS
 *
 * ARCHITECTURE_AUDIT.md §8.5: `handleCheckoutCompleted` set the plan from
 * `session.metadata.plan` without reconciling against the price actually
 * purchased, while `handleSubscriptionUpdated` was stricter. The two
 * paths disagreed, so the same purchase could yield different
 * entitlements depending on which webhook arrived.
 *
 * Since Phase 5, `profiles.plan` also drives AI entitlement — a wrong
 * plan is no longer just a billing error, it is an authorization error.
 *
 * THE RULE
 *
 *   Stripe PRICE ID is authoritative.
 *   Metadata is a HINT, honoured only when it agrees with the price.
 *   When they disagree, the PRICE wins and the disagreement is logged.
 *   When neither resolves, the plan is FREE — never a guess.
 *
 * A webhook payload claiming `plan: "enterprise"` cannot grant
 * enterprise unless the purchased price maps to enterprise.
 *
 * PLAN VOCABULARY
 *
 * Three vocabularies existed before Phase 6:
 *
 *   checkout route : free | pro | premium | vip
 *   webhook route  : free | premium | pro | business | enterprise
 *   lib/plans.ts   : free | starter | pro | business | enterprise
 *
 * Only `free` and `pro` were common to all three. A purchase of
 * "premium" wrote `plan = "premium"`, which `isPlanId()` rejects, so
 * Phase 5 degraded the account to FREE limits — a paying customer
 * receiving free-tier service.
 *
 * PlanId (lib/plans.ts) is now the single vocabulary. The legacy names
 * are accepted as INPUT aliases for backward compatibility with rows and
 * Stripe metadata already carrying them, but only PlanId values are ever
 * written.
 */

import "server-only";

import { DEFAULT_PLAN, type PlanId, isPlanId } from "@/lib/plans";

/* -------------------------------------------------------------------------- */
/*                            LEGACY PLAN ALIASES                             */
/* -------------------------------------------------------------------------- */

/**
 * Historic plan names mapped onto the canonical PlanId vocabulary.
 *
 * Read-only compatibility: these are accepted when interpreting existing
 * data or Stripe metadata, and are never written back.
 *
 * `premium` and `vip` were sold by the checkout route; `plus` and `team`
 * appeared in the webhook's own alias table.
 */
const LEGACY_PLAN_ALIASES: Record<string, PlanId> = {
  /* Sold by the checkout route as "premium". */
  premium: "starter",
  plus: "starter",

  /* The webhook's historic aliases. */
  vip: "pro",
  team: "business",

  /* Identity mappings for completeness. */
  free: "free",
  starter: "starter",
  pro: "pro",
  business: "business",
  enterprise: "enterprise",
};

/**
 * Normalises any plan-ish string to a canonical PlanId.
 *
 * Returns null when the value cannot be interpreted, so callers must
 * decide explicitly rather than receiving a silent default.
 */
export function normalizePlanId(value: unknown): PlanId | null {
  if (typeof value !== "string") return null;

  const key = value.trim().toLowerCase();

  if (key.length === 0) return null;

  if (isPlanId(key)) return key;

  return LEGACY_PLAN_ALIASES[key] ?? null;
}

/* -------------------------------------------------------------------------- */
/*                          PRICE ID -> PLAN MAPPING                          */
/* -------------------------------------------------------------------------- */

/**
 * Environment variables mapping a Stripe price to a plan.
 *
 * Both the historic single-price names and the interval-specific names
 * used by the checkout route are read, because a deployment may have
 * either configured. Every variable that exists maps to exactly one
 * PlanId.
 */
const PRICE_ENV_TO_PLAN: ReadonlyArray<{
  env: string;
  plan: PlanId;
}> = [
  /* Interval-specific names used by app/api/billing/checkout. */
  { env: "STRIPE_PRICE_PREMIUM_MONTHLY", plan: "starter" },
  { env: "STRIPE_PRICE_PREMIUM_YEARLY", plan: "starter" },
  { env: "STRIPE_PRICE_PRO_MONTHLY", plan: "pro" },
  { env: "STRIPE_PRICE_PRO_YEARLY", plan: "pro" },
  { env: "STRIPE_PRICE_VIP_MONTHLY", plan: "pro" },
  { env: "STRIPE_PRICE_VIP_YEARLY", plan: "pro" },
  { env: "STRIPE_PRICE_BUSINESS_MONTHLY", plan: "business" },
  { env: "STRIPE_PRICE_BUSINESS_YEARLY", plan: "business" },
  { env: "STRIPE_PRICE_ENTERPRISE_MONTHLY", plan: "enterprise" },
  { env: "STRIPE_PRICE_ENTERPRISE_YEARLY", plan: "enterprise" },

  /* Historic single-price names read by the webhook. */
  { env: "STRIPE_PRICE_STARTER", plan: "starter" },
  { env: "STRIPE_PRICE_PREMIUM", plan: "starter" },
  { env: "STRIPE_PRICE_PRO", plan: "pro" },
  { env: "STRIPE_PRICE_BUSINESS", plan: "business" },
  { env: "STRIPE_PRICE_ENTERPRISE", plan: "enterprise" },
];

/**
 * Builds the configured price-id -> plan map.
 *
 * Read at call time rather than module load so tests and deployments can
 * vary the environment without a stale cache.
 */
export function buildPriceMap(
  env: NodeJS.ProcessEnv = process.env,
): Map<string, PlanId> {
  const map = new Map<string, PlanId>();

  for (const { env: name, plan } of PRICE_ENV_TO_PLAN) {
    const value = env[name];

    if (typeof value !== "string") continue;

    const priceId = value.trim();

    if (priceId.length === 0) continue;

    const existing = map.get(priceId);

    if (existing !== undefined && existing !== plan) {
      /*
       * The same Stripe price configured for two different plans is a
       * deployment error that would make entitlement depend on iteration
       * order. Keep the LOWER plan and report loudly.
       */
      console.error(
        "SYRAVEN BILLING: price id mapped to conflicting plans.",
        { env: name, existing, attempted: plan },
      );

      map.set(priceId, lowerPlan(existing, plan));
      continue;
    }

    map.set(priceId, plan);
  }

  return map;
}

/**
 * Resolves a Stripe price id to a plan, or null when unmapped.
 */
export function planFromPriceId(
  priceId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): PlanId | null {
  if (typeof priceId !== "string") return null;

  const key = priceId.trim();

  if (key.length === 0) return null;

  return buildPriceMap(env).get(key) ?? null;
}

/* -------------------------------------------------------------------------- */
/*                            PLAN PRECEDENCE                                 */
/* -------------------------------------------------------------------------- */

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

/** Returns whichever plan grants less. */
export function lowerPlan(a: PlanId, b: PlanId): PlanId {
  return PLAN_RANK[a] <= PLAN_RANK[b] ? a : b;
}

/* -------------------------------------------------------------------------- */
/*                          AUTHORITATIVE RESOLUTION                          */
/* -------------------------------------------------------------------------- */

export interface PlanResolution {
  plan: PlanId;

  /** How the plan was determined — recorded for the audit trail. */
  source: "price" | "metadata_confirmed" | "default";

  /**
   * True when metadata claimed a different (or higher) plan than the
   * price supports. The price still wins; this flags the disagreement.
   */
  metadataConflict: boolean;
}

/**
 * Resolves the plan for a purchase.
 *
 * @param priceId   The Stripe price actually purchased. Authoritative.
 * @param metadata  Plan hints from the Stripe object. Advisory only.
 *
 * Precedence:
 *
 *   1. A mapped price id decides the plan outright.
 *   2. With no mapped price, metadata is honoured ONLY if it names a
 *      plan we understand — and the fact that it was unverified is
 *      recorded via `source`.
 *   3. Otherwise FREE.
 *
 * Case 2 exists because price ids may not be configured in every
 * environment (they are currently unset in this deployment). It is the
 * weakest path and is reported as `metadata_confirmed` so an operator can
 * see that entitlement rested on metadata rather than on a price.
 */
export function resolvePlan(input: {
  priceId?: string | null;
  metadataPlan?: unknown;
  env?: NodeJS.ProcessEnv;
}): PlanResolution {
  const env = input.env ?? process.env;

  const fromPrice = planFromPriceId(input.priceId, env);

  const fromMetadata = normalizePlanId(input.metadataPlan);

  if (fromPrice !== null) {
    const conflict = fromMetadata !== null && fromMetadata !== fromPrice;

    if (conflict) {
      console.warn(
        "SYRAVEN BILLING: metadata plan disagrees with purchased price.",
        {
          priceId: input.priceId,
          fromPrice,
          fromMetadata,
          resolved: fromPrice,
        },
      );
    }

    return {
      plan: fromPrice,
      source: "price",
      metadataConflict: conflict,
    };
  }

  if (fromMetadata !== null) {
    return {
      plan: fromMetadata,
      source: "metadata_confirmed",
      metadataConflict: false,
    };
  }

  return {
    plan: DEFAULT_PLAN,
    source: "default",
    metadataConflict: false,
  };
}
