// lib/ai/billing/config.ts

export type BillingCurrency = "EUR" | "USD";

export type BillingInterval =
  | "monthly"
  | "yearly"
  | "one_time";

export type BillingPlanId =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

export type UsageMetric =
  | "requests"
  | "input_tokens"
  | "output_tokens"
  | "ai_calls"
  | "agents"
  | "storage_gb"
  | "api_calls"
  | "web_searches"
  | "team_members";

export interface PlanLimits {
  requestsPerMonth: number;
  inputTokensPerMonth: number;
  outputTokensPerMonth: number;
  aiCallsPerMonth: number;
  agentsPerWorkspace: number;
  storageGb: number;
  apiCallsPerMonth: number;
  webSearchesPerMonth: number;
  teamMembers: number;
}

export interface BillingPlan {
  id: BillingPlanId;

  name: string;

  description: string;

  currency: BillingCurrency;

  priceMonthly: number;

  priceYearly: number;

  interval: BillingInterval;

  popular?: boolean;

  enterprise?: boolean;

  limits: PlanLimits;

  features: string[];
}

export interface UsagePrice {
  metric: UsageMetric;

  unit: string;

  pricePerUnit: number;

  currency: BillingCurrency;

  enabled: boolean;
}

export interface BillingConfiguration {
  currency: BillingCurrency;

  defaultPlan: BillingPlanId;

  trialDays: number;

  gracePeriodDays: number;

  plans: Record<BillingPlanId, BillingPlan>;

  usagePricing: Record<UsageMetric, UsagePrice>;
}

/**
 * Central billing configuration.
 *
 * All monetary values are represented in major currency units.
 * Example:
 * 29 = €29.00
 *
 * Usage limits use -1 to represent unlimited access.
 */
export const billingConfig: BillingConfiguration = {
  currency: "EUR",

  defaultPlan: "free",

  trialDays: 14,

  gracePeriodDays: 7,

  plans: {
    free: {
      id: "free",

      name: "Free",

      description:
        "Entry-level access for individuals exploring the AI platform.",

      currency: "EUR",

      priceMonthly: 0,

      priceYearly: 0,

      interval: "monthly",

      limits: {
        requestsPerMonth: 100,
        inputTokensPerMonth: 100_000,
        outputTokensPerMonth: 100_000,
        aiCallsPerMonth: 100,
        agentsPerWorkspace: 3,
        storageGb: 1,
        apiCallsPerMonth: 0,
        webSearchesPerMonth: 20,
        teamMembers: 1,
      },

      features: [
        "Core AI chat",
        "Basic agent access",
        "Limited web research",
        "Personal workspace",
      ],
    },

    starter: {
      id: "starter",

      name: "Starter",

      description:
        "For professionals who need more AI capacity and automation.",

      currency: "EUR",

      priceMonthly: 29,

      priceYearly: 290,

      interval: "monthly",

      limits: {
        requestsPerMonth: 2_000,
        inputTokensPerMonth: 2_000_000,
        outputTokensPerMonth: 2_000_000,
        aiCallsPerMonth: 2_000,
        agentsPerWorkspace: 10,
        storageGb: 10,
        apiCallsPerMonth: 5_000,
        webSearchesPerMonth: 500,
        teamMembers: 1,
      },

      features: [
        "Advanced AI models",
        "Multi-agent workflows",
        "Research capabilities",
        "Automation tools",
        "API access",
      ],
    },

    pro: {
      id: "pro",

      name: "Pro",

      description:
        "High-capacity AI infrastructure for power users and teams.",

      currency: "EUR",

      priceMonthly: 99,

      priceYearly: 990,

      interval: "monthly",

      popular: true,

      limits: {
        requestsPerMonth: 10_000,
        inputTokensPerMonth: 20_000_000,
        outputTokensPerMonth: 20_000_000,
        aiCallsPerMonth: 10_000,
        agentsPerWorkspace: 50,
        storageGb: 100,
        apiCallsPerMonth: 100_000,
        webSearchesPerMonth: 5_000,
        teamMembers: 10,
      },

      features: [
        "Priority AI processing",
        "Advanced agent orchestration",
        "Data analysis",
        "Business intelligence",
        "Advanced automation",
        "Priority API access",
        "Team collaboration",
      ],
    },

    business: {
      id: "business",

      name: "Business",

      description:
        "Scalable AI infrastructure for organizations and growing companies.",

      currency: "EUR",

      priceMonthly: 499,

      priceYearly: 4_990,

      interval: "monthly",

      limits: {
        requestsPerMonth: 100_000,
        inputTokensPerMonth: 200_000_000,
        outputTokensPerMonth: 200_000_000,
        aiCallsPerMonth: 100_000,
        agentsPerWorkspace: 250,
        storageGb: 1_000,
        apiCallsPerMonth: 1_000_000,
        webSearchesPerMonth: 50_000,
        teamMembers: 100,
      },

      features: [
        "High-scale AI infrastructure",
        "Enterprise agent workflows",
        "Advanced analytics",
        "Business automation",
        "Dedicated API capacity",
        "Priority support",
        "Organization management",
      ],
    },

    enterprise: {
      id: "enterprise",

      name: "Enterprise",

      description:
        "Custom global AI infrastructure for large-scale organizations.",

      currency: "EUR",

      priceMonthly: 0,

      priceYearly: 0,

      interval: "monthly",

      enterprise: true,

      limits: {
        requestsPerMonth: -1,
        inputTokensPerMonth: -1,
        outputTokensPerMonth: -1,
        aiCallsPerMonth: -1,
        agentsPerWorkspace: -1,
        storageGb: -1,
        apiCallsPerMonth: -1,
        webSearchesPerMonth: -1,
        teamMembers: -1,
      },

      features: [
        "Custom AI infrastructure",
        "Dedicated deployment options",
        "Unlimited agent orchestration",
        "Custom model routing",
        "Advanced security",
        "Enterprise governance",
        "Custom API capacity",
        "Service-level agreements",
        "Dedicated technical support",
      ],
    },
  },

  usagePricing: {
    requests: {
      metric: "requests",
      unit: "request",
      pricePerUnit: 0.001,
      currency: "EUR",
      enabled: true,
    },

    input_tokens: {
      metric: "input_tokens",
      unit: "1K tokens",
      pricePerUnit: 0.002,
      currency: "EUR",
      enabled: true,
    },

    output_tokens: {
      metric: "output_tokens",
      unit: "1K tokens",
      pricePerUnit: 0.006,
      currency: "EUR",
      enabled: true,
    },

    ai_calls: {
      metric: "ai_calls",
      unit: "AI call",
      pricePerUnit: 0.01,
      currency: "EUR",
      enabled: true,
    },

    agents: {
      metric: "agents",
      unit: "agent",
      pricePerUnit: 0,
      currency: "EUR",
      enabled: false,
    },

    storage_gb: {
      metric: "storage_gb",
      unit: "GB",
      pricePerUnit: 0.1,
      currency: "EUR",
      enabled: true,
    },

    api_calls: {
      metric: "api_calls",
      unit: "API call",
      pricePerUnit: 0.0005,
      currency: "EUR",
      enabled: true,
    },

    web_searches: {
      metric: "web_searches",
      unit: "search",
      pricePerUnit: 0.01,
      currency: "EUR",
      enabled: true,
    },

    team_members: {
      metric: "team_members",
      unit: "member",
      pricePerUnit: 10,
      currency: "EUR",
      enabled: true,
    },
  },
};

/**
 * Returns a billing plan safely.
 */
export function getBillingPlan(
  planId: BillingPlanId,
): BillingPlan {
  return billingConfig.plans[planId];
}

/**
 * Returns every available billing plan.
 */
export function getBillingPlans(): BillingPlan[] {
  return Object.values(billingConfig.plans);
}

/**
 * Checks whether a limit is unlimited.
 */
export function isUnlimited(value: number): boolean {
  return value === -1;
}

/**
 * Checks whether a usage value is inside the configured limit.
 */
export function isWithinLimit(
  usage: number,
  limit: number,
): boolean {
  if (isUnlimited(limit)) {
    return true;
  }

  return usage <= limit;
}

/**
 * Calculates percentage usage.
 */
export function calculateUsagePercentage(
  usage: number,
  limit: number,
): number {
  if (isUnlimited(limit)) {
    return 0;
  }

  if (limit <= 0) {
    return 100;
  }

  return Math.min(
    100,
    Math.max(0, (usage / limit) * 100),
  );
}

/**
 * Formats a billing price for display.
 */
export function formatBillingPrice(
  amount: number,
  currency: BillingCurrency = billingConfig.currency,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculates yearly savings compared with monthly billing.
 */
export function calculateYearlySavings(
  plan: BillingPlan,
): number {
  const monthlyAnnualCost = plan.priceMonthly * 12;

  return Math.max(
    0,
    monthlyAnnualCost - plan.priceYearly,
  );
}

/**
 * Checks whether a plan is an enterprise plan.
 */
export function isEnterprisePlan(
  planId: BillingPlanId,
): boolean {
  return billingConfig.plans[planId].enterprise === true;
}

export default billingConfig;