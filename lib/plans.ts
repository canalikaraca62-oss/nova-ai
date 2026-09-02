// lib/plans.ts

/**
 * NOVA Pricing & Plan System
 *
 * Architecture:
 *
 * 1. Every new user starts with the Free plan.
 * 2. New users receive a 14-day Full Access Trial.
 * 3. During the trial, the user temporarily gets full-access limits.
 * 4. When the trial expires, the user automatically returns to
 *    the normal limited Free plan.
 * 5. There is NO automatic payment after the trial.
 * 6. Paid plans are Starter, Pro, Business and Enterprise.
 */

export type PlanId =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

export type BillingInterval = "monthly" | "yearly";

export type PlanCategory =
  | "core"
  | "intelligence"
  | "productivity"
  | "automation"
  | "business"
  | "enterprise"
  | "support";

export type PlanBadge =
  | "Free"
  | "Trial"
  | "Popular"
  | "Business"
  | "Custom";

export interface PlanLimits {
  messagesPerDay: number;
  messagesPerMonth: number;

  advancedMessagesPerMonth: number;

  fileUploadsPerDay: number;
  fileUploadsPerMonth: number;
  maxFileUploadMb: number;

  projects: number;
  tasksPerMonth: number;
  automations: number;

  agents: number;
  agentRunsPerMonth: number;

  memoryItems: number;

  voiceMinutesPerMonth: number;
  visionRequestsPerMonth: number;

  deepResearchPerMonth: number;

  teamMembers: number;

  apiRequestsPerMonth: number;

  storageGb: number;
}

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  category: PlanCategory;
  included: boolean;
}

export interface Plan {
  id: PlanId;

  name: string;
  description: string;

  monthlyPrice: number;
  yearlyPrice: number;

  currency: "EUR";

  badge?: PlanBadge;
  highlighted?: boolean;

  /**
   * Free plan itself is NOT a trial.
   */
  isTrial: boolean;

  /**
   * Trial duration for this plan.
   * Only the temporary trial configuration uses 14 days.
   */
  trialDays: number;

  /**
   * Whether this plan requires payment.
   */
  requiresPaidPlanAfterTrial: boolean;

  limits: PlanLimits;

  features: PlanFeature[];

  audience: string;

  cta: string;
}

const UNLIMITED = -1;

const EUR = "EUR" as const;

/**
 * ============================================================
 * FREE PLAN
 * ============================================================
 *
 * This is the permanent limited plan.
 *
 * IMPORTANT:
 * The user does NOT lose access after the 14-day trial.
 * They simply return to these limits.
 */

const FREE: Plan = {
  id: "free",

  name: "Free",

  description:
    "A limited permanent plan for trying NOVA after the full-access trial.",

  monthlyPrice: 0,
  yearlyPrice: 0,

  currency: EUR,

  badge: "Free",
  highlighted: false,

  isTrial: false,
  trialDays: 0,

  requiresPaidPlanAfterTrial: false,

  audience: "Users who want to keep using NOVA for free",

  cta: "Stay on Free",

  limits: {
    /**
     * Basic chat
     */
    messagesPerDay: 20,
    messagesPerMonth: 500,

    /**
     * Advanced AI usage
     */
    advancedMessagesPerMonth: 25,

    /**
     * Files
     */
    fileUploadsPerDay: 3,
    fileUploadsPerMonth: 50,
    maxFileUploadMb: 10,

    /**
     * Productivity
     */
    projects: 2,
    tasksPerMonth: 50,
    automations: 1,

    /**
     * Agents
     */
    agents: 1,
    agentRunsPerMonth: 10,

    /**
     * Memory
     */
    memoryItems: 100,

    /**
     * Voice / Vision
     */
    voiceMinutesPerMonth: 30,
    visionRequestsPerMonth: 20,

    /**
     * Research
     */
    deepResearchPerMonth: 2,

    /**
     * Account
     */
    teamMembers: 1,

    /**
     * API
     */
    apiRequestsPerMonth: 100,

    /**
     * Storage
     */
    storageGb: 1,
  },

  features: [
    {
      id: "chat",
      name: "Basic Chat",
      category: "core",
      included: true,
    },
    {
      id: "memory",
      name: "Basic Memory",
      category: "core",
      included: true,
    },
    {
      id: "voice",
      name: "Limited Voice",
      category: "core",
      included: true,
    },
    {
      id: "file-analysis",
      name: "Limited File Analysis",
      category: "core",
      included: true,
    },
    {
      id: "vision",
      name: "Limited Vision",
      category: "intelligence",
      included: true,
    },
    {
      id: "deep-research",
      name: "Limited Deep Research",
      category: "intelligence",
      included: true,
    },
    {
      id: "projects",
      name: "Limited Projects",
      category: "productivity",
      included: true,
    },
    {
      id: "tasks",
      name: "Limited Tasks",
      category: "productivity",
      included: true,
    },
    {
      id: "automations",
      name: "1 Automation",
      category: "automation",
      included: true,
    },
    {
      id: "agents",
      name: "1 AI Agent",
      category: "automation",
      included: true,
    },
    {
      id: "api",
      name: "Limited API Access",
      category: "business",
      included: true,
    },
    {
      id: "priority-support",
      name: "Priority Support",
      category: "support",
      included: false,
    },
  ],
};

/**
 * ============================================================
 * STARTER
 * ============================================================
 */

const STARTER: Plan = {
  id: "starter",

  name: "Starter",

  description:
    "For individuals who want NOVA as their everyday AI workspace.",

  monthlyPrice: 19,
  yearlyPrice: 190,

  currency: EUR,

  isTrial: false,
  trialDays: 0,
  requiresPaidPlanAfterTrial: false,

  audience: "Individual users",

  cta: "Choose Starter",

  limits: {
    messagesPerDay: 100,
    messagesPerMonth: 3000,

    advancedMessagesPerMonth: 500,

    fileUploadsPerDay: 10,
    fileUploadsPerMonth: 300,
    maxFileUploadMb: 50,

    projects: 10,
    tasksPerMonth: 500,
    automations: 10,

    agents: 3,
    agentRunsPerMonth: 200,

    memoryItems: 5000,

    voiceMinutesPerMonth: 300,
    visionRequestsPerMonth: 200,

    deepResearchPerMonth: 20,

    teamMembers: 1,

    apiRequestsPerMonth: 5000,

    storageGb: 25,
  },

  features: [
    {
      id: "chat",
      name: "Advanced Chat",
      category: "core",
      included: true,
    },
    {
      id: "memory",
      name: "Long-Term Memory",
      category: "core",
      included: true,
    },
    {
      id: "voice",
      name: "Voice",
      category: "core",
      included: true,
    },
    {
      id: "file-analysis",
      name: "File Analysis",
      category: "core",
      included: true,
    },
    {
      id: "vision",
      name: "Vision",
      category: "intelligence",
      included: true,
    },
    {
      id: "deep-research",
      name: "Deep Research",
      category: "intelligence",
      included: true,
    },
    {
      id: "projects",
      name: "Projects",
      category: "productivity",
      included: true,
    },
    {
      id: "tasks",
      name: "Tasks",
      category: "productivity",
      included: true,
    },
    {
      id: "automations",
      name: "Automations",
      category: "automation",
      included: true,
    },
    {
      id: "agents",
      name: "AI Agents",
      category: "automation",
      included: true,
    },
    {
      id: "api",
      name: "API Access",
      category: "business",
      included: true,
    },
  ],
};

/**
 * ============================================================
 * PRO
 * ============================================================
 */

const PRO: Plan = {
  id: "pro",

  name: "Pro",

  description:
    "For professionals who need serious AI power, research and automation.",

  monthlyPrice: 49,
  yearlyPrice: 490,

  currency: EUR,

  badge: "Popular",
  highlighted: true,

  isTrial: false,
  trialDays: 0,
  requiresPaidPlanAfterTrial: false,

  audience: "Professionals and power users",

  cta: "Choose Pro",

  limits: {
    messagesPerDay: UNLIMITED,
    messagesPerMonth: UNLIMITED,

    advancedMessagesPerMonth: 5000,

    fileUploadsPerDay: 50,
    fileUploadsPerMonth: 1500,
    maxFileUploadMb: 250,

    projects: UNLIMITED,
    tasksPerMonth: 5000,
    automations: 50,

    agents: 15,
    agentRunsPerMonth: 2000,

    memoryItems: UNLIMITED,

    voiceMinutesPerMonth: 2000,
    visionRequestsPerMonth: 2000,

    deepResearchPerMonth: 100,

    teamMembers: 3,

    apiRequestsPerMonth: 50000,

    storageGb: 100,
  },

  features: [
    {
      id: "chat",
      name: "Advanced Chat",
      category: "core",
      included: true,
    },
    {
      id: "memory",
      name: "Advanced Long-Term Memory",
      category: "core",
      included: true,
    },
    {
      id: "voice",
      name: "Advanced Voice",
      category: "core",
      included: true,
    },
    {
      id: "file-analysis",
      name: "Advanced File Analysis",
      category: "core",
      included: true,
    },
    {
      id: "vision",
      name: "Advanced Vision",
      category: "intelligence",
      included: true,
    },
    {
      id: "deep-research",
      name: "Deep Research",
      category: "intelligence",
      included: true,
    },
    {
      id: "projects",
      name: "Unlimited Projects",
      category: "productivity",
      included: true,
    },
    {
      id: "tasks",
      name: "Advanced Tasks",
      category: "productivity",
      included: true,
    },
    {
      id: "automations",
      name: "Advanced Automations",
      category: "automation",
      included: true,
    },
    {
      id: "agents",
      name: "Advanced AI Agents",
      category: "automation",
      included: true,
    },
    {
      id: "api",
      name: "Developer API",
      category: "business",
      included: true,
    },
  ],
};

/**
 * ============================================================
 * BUSINESS
 * ============================================================
 */

const BUSINESS: Plan = {
  id: "business",

  name: "Business",

  description:
    "For teams building AI-powered workflows across their organization.",

  monthlyPrice: 199,
  yearlyPrice: 1990,

  currency: EUR,

  badge: "Business",
  highlighted: false,

  isTrial: false,
  trialDays: 0,
  requiresPaidPlanAfterTrial: false,

  audience: "Small and medium-sized teams",

  cta: "Choose Business",

  limits: {
    messagesPerDay: UNLIMITED,
    messagesPerMonth: UNLIMITED,

    advancedMessagesPerMonth: UNLIMITED,

    fileUploadsPerDay: UNLIMITED,
    fileUploadsPerMonth: UNLIMITED,
    maxFileUploadMb: 500,

    projects: UNLIMITED,
    tasksPerMonth: UNLIMITED,
    automations: UNLIMITED,

    agents: UNLIMITED,
    agentRunsPerMonth: UNLIMITED,

    memoryItems: UNLIMITED,

    voiceMinutesPerMonth: UNLIMITED,
    visionRequestsPerMonth: UNLIMITED,

    deepResearchPerMonth: UNLIMITED,

    teamMembers: 15,

    apiRequestsPerMonth: UNLIMITED,

    storageGb: 500,
  },

  features: [
    {
      id: "chat",
      name: "Unlimited Advanced Chat",
      category: "core",
      included: true,
    },
    {
      id: "memory",
      name: "Team Memory",
      category: "core",
      included: true,
    },
    {
      id: "voice",
      name: "Advanced Voice",
      category: "core",
      included: true,
    },
    {
      id: "file-analysis",
      name: "Large File Analysis",
      category: "core",
      included: true,
    },
    {
      id: "vision",
      name: "Advanced Vision",
      category: "intelligence",
      included: true,
    },
    {
      id: "deep-research",
      name: "Unlimited Deep Research",
      category: "intelligence",
      included: true,
    },
    {
      id: "projects",
      name: "Unlimited Projects",
      category: "productivity",
      included: true,
    },
    {
      id: "tasks",
      name: "Team Tasks",
      category: "productivity",
      included: true,
    },
    {
      id: "automations",
      name: "Unlimited Automations",
      category: "automation",
      included: true,
    },
    {
      id: "agents",
      name: "Unlimited AI Agents",
      category: "automation",
      included: true,
    },
    {
      id: "team",
      name: "Team Workspace",
      category: "business",
      included: true,
    },
    {
      id: "api",
      name: "Unlimited API Access",
      category: "business",
      included: true,
    },
    {
      id: "priority-support",
      name: "Priority Support",
      category: "support",
      included: true,
    },
  ],
};

/**
 * ============================================================
 * ENTERPRISE
 * ============================================================
 */

const ENTERPRISE: Plan = {
  id: "enterprise",

  name: "Enterprise",

  description:
    "Customized NOVA for organizations requiring advanced security, scale and support.",

  monthlyPrice: 0,
  yearlyPrice: 0,

  currency: EUR,

  badge: "Custom",
  highlighted: false,

  isTrial: false,
  trialDays: 0,
  requiresPaidPlanAfterTrial: false,

  audience: "Large organizations",

  cta: "Contact Sales",

  limits: {
    messagesPerDay: UNLIMITED,
    messagesPerMonth: UNLIMITED,

    advancedMessagesPerMonth: UNLIMITED,

    fileUploadsPerDay: UNLIMITED,
    fileUploadsPerMonth: UNLIMITED,
    maxFileUploadMb: UNLIMITED,

    projects: UNLIMITED,
    tasksPerMonth: UNLIMITED,
    automations: UNLIMITED,

    agents: UNLIMITED,
    agentRunsPerMonth: UNLIMITED,

    memoryItems: UNLIMITED,

    voiceMinutesPerMonth: UNLIMITED,
    visionRequestsPerMonth: UNLIMITED,

    deepResearchPerMonth: UNLIMITED,

    teamMembers: UNLIMITED,

    apiRequestsPerMonth: UNLIMITED,

    storageGb: UNLIMITED,
  },

  features: [
    {
      id: "chat",
      name: "Enterprise AI",
      category: "core",
      included: true,
    },
    {
      id: "memory",
      name: "Enterprise Memory",
      category: "core",
      included: true,
    },
    {
      id: "voice",
      name: "Enterprise Voice",
      category: "core",
      included: true,
    },
    {
      id: "file-analysis",
      name: "Enterprise File Intelligence",
      category: "core",
      included: true,
    },
    {
      id: "vision",
      name: "Advanced Vision",
      category: "intelligence",
      included: true,
    },
    {
      id: "deep-research",
      name: "Enterprise Research",
      category: "intelligence",
      included: true,
    },
    {
      id: "projects",
      name: "Unlimited Projects",
      category: "productivity",
      included: true,
    },
    {
      id: "tasks",
      name: "Enterprise Tasks",
      category: "productivity",
      included: true,
    },
    {
      id: "automations",
      name: "Enterprise Automation",
      category: "automation",
      included: true,
    },
    {
      id: "agents",
      name: "Enterprise AI Agents",
      category: "automation",
      included: true,
    },
    {
      id: "team",
      name: "Unlimited Team Members",
      category: "business",
      included: true,
    },
    {
      id: "api",
      name: "Enterprise API",
      category: "business",
      included: true,
    },
    {
      id: "security",
      name: "Advanced Security",
      category: "enterprise",
      included: true,
    },
    {
      id: "sso",
      name: "SSO / SAML",
      category: "enterprise",
      included: true,
    },
    {
      id: "audit",
      name: "Audit & Compliance Controls",
      category: "enterprise",
      included: true,
    },
    {
      id: "dedicated-support",
      name: "Dedicated Support",
      category: "support",
      included: true,
    },
  ],
};

/**
 * ============================================================
 * PLAN REGISTRY
 * ============================================================
 */

export const PLANS: Record<PlanId, Plan> = {
  free: FREE,
  starter: STARTER,
  pro: PRO,
  business: BUSINESS,
  enterprise: ENTERPRISE,
};

export const PLAN_ORDER: PlanId[] = [
  "free",
  "starter",
  "pro",
  "business",
  "enterprise",
];

export const PAID_PLAN_ORDER: PlanId[] = [
  "starter",
  "pro",
  "business",
  "enterprise",
];

/**
 * The permanent default account plan.
 */
export const DEFAULT_PLAN: PlanId = "free";

/**
 * Recommended paid plan.
 */
export const DEFAULT_PAID_PLAN: PlanId = "starter";

/**
 * ============================================================
 * TRIAL CONFIGURATION
 * ============================================================
 *
 * Trial is NOT a separate permanent plan.
 *
 * It temporarily upgrades the Free account to full access.
 */

export const TRIAL_CONFIG = {
  enabled: true,

  durationDays: 14,

  fullAccess: true,

  autoConvertToPaid: false,

  permanentFreeTier: true,

  /**
   * After trial expiration:
   *
   * full-access trial -> limited Free
   */
  expiredPlan: "free" as PlanId,
};

/**
 * Alias for compatibility with existing code.
 */
export const TRIAL_DURATION_DAYS =
  TRIAL_CONFIG.durationDays;

export const TRIAL_PLAN_ID: PlanId = "free";

/**
 * ============================================================
 * PLAN HELPERS
 * ============================================================
 */

export function getPricingPlans(): Plan[] {
  return PLAN_ORDER.map((id) => PLANS[id]);
}

export function getCheckoutPlans(): Plan[] {
  return PAID_PLAN_ORDER.map((id) => PLANS[id]);
}

export function getActivePlans(): Plan[] {
  return PLAN_ORDER.map((id) => PLANS[id]);
}

export function getPublicPricingPlans(): Plan[] {
  return getPricingPlans();
}

export function getTrialPlan(): Plan {
  return PLANS.free;
}

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId];
}

export function isPlanId(
  value: unknown,
): value is PlanId {
  return (
    value === "free" ||
    value === "starter" ||
    value === "pro" ||
    value === "business" ||
    value === "enterprise"
  );
}

export function isPaidPlan(
  planId: PlanId,
): boolean {
  return planId !== "free";
}

export function isTrialPlan(
  planId: PlanId,
): boolean {
  return planId === "free";
}

export function getPlanPrice(
  planId: PlanId,
  interval: BillingInterval,
): number {
  const plan = PLANS[planId];

  if (planId === "enterprise") {
    return 0;
  }

  return interval === "yearly"
    ? plan.yearlyPrice
    : plan.monthlyPrice;
}

export function getYearlyMonthlyEquivalent(
  planId: PlanId,
): number {
  const plan = PLANS[planId];

  if (plan.yearlyPrice <= 0) {
    return 0;
  }

  return plan.yearlyPrice / 12;
}

export function getYearlySavings(
  planId: PlanId,
): number {
  const plan = PLANS[planId];

  if (
    plan.monthlyPrice <= 0 ||
    plan.yearlyPrice <= 0
  ) {
    return 0;
  }

  return (
    plan.monthlyPrice * 12 -
    plan.yearlyPrice
  );
}

export function getYearlySavingsPercentage(
  planId: PlanId,
): number {
  const plan = PLANS[planId];

  const monthlyAnnualCost =
    plan.monthlyPrice * 12;

  if (
    monthlyAnnualCost <= 0 ||
    plan.yearlyPrice <= 0
  ) {
    return 0;
  }

  return Math.round(
    ((monthlyAnnualCost -
      plan.yearlyPrice) /
      monthlyAnnualCost) *
      100,
  );
}

export function getPlanLimit<
  K extends keyof PlanLimits,
>(
  planId: PlanId,
  limit: K,
): number {
  return PLANS[planId].limits[limit];
}

export function isWithinLimit(
  planId: PlanId,
  limit: keyof PlanLimits,
  currentUsage: number,
): boolean {
  const maximum =
    getPlanLimit(planId, limit);

  if (maximum === UNLIMITED) {
    return true;
  }

  return currentUsage < maximum;
}

export function hasFeature(
  planId: PlanId,
  featureId: string,
): boolean {
  return PLANS[planId].features.some(
    (feature) =>
      feature.id === featureId &&
      feature.included,
  );
}

export function getIncludedFeatures(
  planId: PlanId,
): PlanFeature[] {
  return PLANS[planId].features.filter(
    (feature) => feature.included,
  );
}

export function getFeaturesByCategory(
  planId: PlanId,
): Record<PlanCategory, PlanFeature[]> {
  const result: Record<
    PlanCategory,
    PlanFeature[]
  > = {
    core: [],
    intelligence: [],
    productivity: [],
    automation: [],
    business: [],
    enterprise: [],
    support: [],
  };

  for (const feature of getIncludedFeatures(
    planId,
  )) {
    result[feature.category].push(feature);
  }

  return result;
}

/**
 * ============================================================
 * TRIAL DATE HELPERS
 * ============================================================
 */

export function getTrialEndDate(
  startDate: Date,
): Date {
  const endDate = new Date(startDate);

  endDate.setDate(
    endDate.getDate() +
      TRIAL_CONFIG.durationDays,
  );

  return endDate;
}

export function isTrialExpired(
  trialStartedAt: Date | string,
  now: Date = new Date(),
): boolean {
  const start =
    trialStartedAt instanceof Date
      ? trialStartedAt
      : new Date(trialStartedAt);

  if (Number.isNaN(start.getTime())) {
    return true;
  }

  const endDate = getTrialEndDate(start);

  return (
    now.getTime() >= endDate.getTime()
  );
}

export function hasActiveTrial(
  trialStartedAt:
    | Date
    | string
    | null
    | undefined,
  now: Date = new Date(),
): boolean {
  if (!trialStartedAt) {
    return false;
  }

  return !isTrialExpired(
    trialStartedAt,
    now,
  );
}

export function getTrialDaysRemaining(
  trialStartedAt: Date | string,
  now: Date = new Date(),
): number {
  const start =
    trialStartedAt instanceof Date
      ? trialStartedAt
      : new Date(trialStartedAt);

  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const endDate = getTrialEndDate(start);

  const difference =
    endDate.getTime() -
    now.getTime();

  if (difference <= 0) {
    return 0;
  }

  return Math.ceil(
    difference /
      (1000 * 60 * 60 * 24),
  );
}

/**
 * ============================================================
 * EFFECTIVE PLAN
 * ============================================================
 *
 * This is the important part.
 *
 * Database plan:
 *   free
 *
 * Active trial:
 *   effective access = full-access trial
 *
 * Expired trial:
 *   effective access = free limits
 *
 * Paid:
 *   effective access = paid plan
 */

export function getEffectivePlanId(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): PlanId {
  if (isPaidPlan(planId)) {
    return planId;
  }

  if (
    trialStartedAt &&
    hasActiveTrial(
      trialStartedAt,
      now,
    )
  ) {
    /**
     * The database still stores "free".
     * Trial access is handled separately.
     */
    return "free";
  }

  return "free";
}

/**
 * Determine whether the account currently
 * has temporary full-access trial privileges.
 */
export function hasFullTrialAccess(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): boolean {
  if (planId !== "free") {
    return false;
  }

  if (!TRIAL_CONFIG.enabled) {
    return false;
  }

  if (!trialStartedAt) {
    return false;
  }

  return hasActiveTrial(
    trialStartedAt,
    now,
  );
}

/**
 * Get the limits that should actually be used
 * by the application right now.
 *
 * During the 14-day trial the user temporarily
 * receives the full trial limits.
 */
export function getEffectiveLimits(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): PlanLimits {
  if (
    hasFullTrialAccess(
      planId,
      trialStartedAt,
      now,
    )
  ) {
    return getTrialLimits();
  }

  return PLANS[planId].limits;
}

/**
 * ============================================================
 * FULL ACCESS TRIAL LIMITS
 * ============================================================
 *
 * Trial limits are deliberately separate from the
 * permanent Free plan.
 */

export function getTrialLimits(): PlanLimits {
  return {
    messagesPerDay: UNLIMITED,
    messagesPerMonth: UNLIMITED,

    advancedMessagesPerMonth: UNLIMITED,

    fileUploadsPerDay: UNLIMITED,
    fileUploadsPerMonth: UNLIMITED,
    maxFileUploadMb: 500,

    projects: UNLIMITED,
    tasksPerMonth: UNLIMITED,
    automations: UNLIMITED,

    agents: UNLIMITED,
    agentRunsPerMonth: UNLIMITED,

    memoryItems: UNLIMITED,

    voiceMinutesPerMonth: UNLIMITED,
    visionRequestsPerMonth: UNLIMITED,

    deepResearchPerMonth: UNLIMITED,

    teamMembers: 1,

    apiRequestsPerMonth: UNLIMITED,

    storageGb: 10,
  };
}

/**
 * ============================================================
 * ACCESS STATE
 * ============================================================
 */

export type AccountAccessState =
  | "trial"
  | "free"
  | "paid";

export function getAccountAccessState(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): AccountAccessState {
  if (isPaidPlan(planId)) {
    return "paid";
  }

  if (
    hasFullTrialAccess(
      planId,
      trialStartedAt,
      now,
    )
  ) {
    return "trial";
  }

  return "free";
}

/**
 * Whether the user should see the trial banner.
 */
export function shouldShowTrialBanner(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): boolean {
  return getAccountAccessState(
    planId,
    trialStartedAt,
    now,
  ) === "trial";
}

/**
 * Whether the user is currently on the
 * permanent limited Free plan.
 */
export function isPermanentFreeUser(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): boolean {
  return (
    getAccountAccessState(
      planId,
      trialStartedAt,
      now,
    ) === "free"
  );
}

/**
 * Whether the user should be encouraged
 * to upgrade.
 */
export function shouldShowUpgrade(
  planId: PlanId,
  trialStartedAt?:
    | Date
    | string
    | null,
  now: Date = new Date(),
): boolean {
  return (
    isPermanentFreeUser(
      planId,
      trialStartedAt,
      now,
    ) ||
    hasFullTrialAccess(
      planId,
      trialStartedAt,
      now,
    )
  );
}

/**
 * ============================================================
 * FORMATTING
 * ============================================================
 */

export function formatPlanLimit(
  value: number,
): string {
  if (value === UNLIMITED) {
    return "Unlimited";
  }

  return value.toLocaleString(
    "en-US",
  );
}

export function formatStorageLimit(
  value: number,
): string {
  if (value === UNLIMITED) {
    return "Unlimited";
  }

  return `${value} GB`;
}

export function formatPlanPrice(
  planId: PlanId,
  interval: BillingInterval,
): string {
  if (planId === "enterprise") {
    return "Custom";
  }

  if (planId === "free") {
    return "€0";
  }

  const price = getPlanPrice(
    planId,
    interval,
  );

  return `€${price.toLocaleString(
    "en-US",
  )}`;
}

/**
 * Recommended paid plan.
 */
export const RECOMMENDED_PLAN: PlanId =
  "pro";