/**
 * SYRAVEN
 * lib/plans.ts
 *
 * Central subscription plan definitions and billing helpers.
 */

import type { Permission } from "./permissions";

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

export type PlanId =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

export type BillingInterval = "month" | "year";

export type PlanStatus = "active" | "archived" | "coming_soon";

export interface PlanPrice {
  monthly: number;
  yearly: number;
  currency: "EUR";
}

export interface PlanLimits {
  aiRequestsPerMonth: number;
  agentsPerWorkspace: number;
  activeAutomations: number;
  projects: number;
  teamMembers: number;
  storageGb: number;
  apiRequestsPerMonth: number;
  maxFileUploadMb: number;
  maxConcurrentTasks: number;
}

export interface PlanFeatures {
  aiAccess: boolean;
  advancedModels: boolean;
  customAgents: boolean;
  agentAutomation: boolean;
  workflowBuilder: boolean;
  priorityQueue: boolean;
  apiAccess: boolean;
  teamCollaboration: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  auditLogs: boolean;
  sso: boolean;
  dedicatedSupport: boolean;
  customIntegrations: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  status: PlanStatus;
  price: PlanPrice;
  limits: PlanLimits;
  features: PlanFeatures;
  highlighted?: boolean;
  badge?: string;
  permissions: readonly Permission[];
}

/* -------------------------------------------------------------------------- */
/*                              PLAN DEFINITIONS                              */
/* -------------------------------------------------------------------------- */

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    description:
      "Explore the SYRAVEN AI platform and core intelligent tools.",
    status: "active",

    price: {
      monthly: 0,
      yearly: 0,
      currency: "EUR",
    },

    limits: {
      aiRequestsPerMonth: 100,
      agentsPerWorkspace: 2,
      activeAutomations: 1,
      projects: 3,
      teamMembers: 1,
      storageGb: 1,
      apiRequestsPerMonth: 0,
      maxFileUploadMb: 10,
      maxConcurrentTasks: 1,
    },

    features: {
      aiAccess: true,
      advancedModels: false,
      customAgents: false,
      agentAutomation: false,
      workflowBuilder: false,
      priorityQueue: false,
      apiAccess: false,
      teamCollaboration: false,
      advancedAnalytics: false,
      customBranding: false,
      auditLogs: false,
      sso: false,
      dedicatedSupport: false,
      customIntegrations: false,
    },

    permissions: [
      "dashboard.view",
      "projects.view",
      "projects.create",
      "ai.use",
      "agents.view",
      "tasks.view",
      "research.view",
      "research.create",
      "writing.view",
      "writing.create",
      "presentations.view",
      "presentations.create",
    ],
  },

  starter: {
    id: "starter",
    name: "Starter",
    description:
      "For individuals building serious AI-powered workflows.",
    status: "active",

    price: {
      monthly: 19,
      yearly: 190,
      currency: "EUR",
    },

    limits: {
      aiRequestsPerMonth: 2_000,
      agentsPerWorkspace: 5,
      activeAutomations: 5,
      projects: 25,
      teamMembers: 1,
      storageGb: 10,
      apiRequestsPerMonth: 10_000,
      maxFileUploadMb: 25,
      maxConcurrentTasks: 3,
    },

    features: {
      aiAccess: true,
      advancedModels: true,
      customAgents: true,
      agentAutomation: true,
      workflowBuilder: true,
      priorityQueue: false,
      apiAccess: true,
      teamCollaboration: false,
      advancedAnalytics: false,
      customBranding: false,
      auditLogs: false,
      sso: false,
      dedicatedSupport: false,
      customIntegrations: false,
    },

    permissions: [
      "dashboard.view",
      "projects.view",
      "projects.create",
      "projects.update",
      "ai.use",
      "ai.models.view",
      "agents.view",
      "agents.create",
      "agents.execute",
      "tasks.view",
      "tasks.create",
      "tasks.execute",
      "workflows.view",
      "workflows.create",
      "workflows.execute",
      "files.view",
      "files.upload",
      "research.view",
      "research.create",
      "research.execute",
      "coding.view",
      "coding.create",
      "coding.execute",
      "design.view",
      "design.create",
      "design.execute",
      "writing.view",
      "writing.create",
      "writing.execute",
      "presentations.view",
      "presentations.create",
      "presentations.update",
      "presentations.export",
      "websites.view",
      "websites.create",
    ],
  },

  pro: {
    id: "pro",
    name: "Pro",
    description:
      "Advanced AI infrastructure for professionals and power users.",
    status: "active",

    highlighted: true,
    badge: "Most Popular",

    price: {
      monthly: 49,
      yearly: 490,
      currency: "EUR",
    },

    limits: {
      aiRequestsPerMonth: 10_000,
      agentsPerWorkspace: 20,
      activeAutomations: 25,
      projects: 100,
      teamMembers: 5,
      storageGb: 100,
      apiRequestsPerMonth: 100_000,
      maxFileUploadMb: 50,
      maxConcurrentTasks: 10,
    },

    features: {
      aiAccess: true,
      advancedModels: true,
      customAgents: true,
      agentAutomation: true,
      workflowBuilder: true,
      priorityQueue: true,
      apiAccess: true,
      teamCollaboration: true,
      advancedAnalytics: true,
      customBranding: false,
      auditLogs: true,
      sso: false,
      dedicatedSupport: false,
      customIntegrations: false,
    },

    permissions: [
      "dashboard.view",

      "projects.view",
      "projects.create",
      "projects.update",
      "projects.delete",

      "ai.use",
      "ai.models.view",

      "agents.view",
      "agents.create",
      "agents.update",
      "agents.execute",

      "tasks.view",
      "tasks.create",
      "tasks.update",
      "tasks.execute",

      "workflows.view",
      "workflows.create",
      "workflows.update",
      "workflows.execute",

      "files.view",
      "files.upload",
      "files.update",

      "data.view",
      "data.create",
      "data.export",

      "research.view",
      "research.create",
      "research.execute",

      "coding.view",
      "coding.create",
      "coding.execute",

      "design.view",
      "design.create",
      "design.execute",

      "writing.view",
      "writing.create",
      "writing.execute",

      "presentations.view",
      "presentations.create",
      "presentations.update",
      "presentations.export",

      "websites.view",
      "websites.create",
      "websites.update",
      "websites.publish",

      "analytics.view",
      "analytics.export",

      "settings.view",
      "settings.update",
    ],
  },

  business: {
    id: "business",
    name: "Business",
    description:
      "Collaborative AI infrastructure for high-performing teams.",
    status: "active",

    price: {
      monthly: 199,
      yearly: 1_990,
      currency: "EUR",
    },

    limits: {
      aiRequestsPerMonth: 50_000,
      agentsPerWorkspace: 100,
      activeAutomations: 100,
      projects: 1_000,
      teamMembers: 25,
      storageGb: 1_000,
      apiRequestsPerMonth: 1_000_000,
      maxFileUploadMb: 100,
      maxConcurrentTasks: 50,
    },

    features: {
      aiAccess: true,
      advancedModels: true,
      customAgents: true,
      agentAutomation: true,
      workflowBuilder: true,
      priorityQueue: true,
      apiAccess: true,
      teamCollaboration: true,
      advancedAnalytics: true,
      customBranding: true,
      auditLogs: true,
      sso: false,
      dedicatedSupport: true,
      customIntegrations: true,
    },

    permissions: [
      "dashboard.view",

      "projects.view",
      "projects.create",
      "projects.update",
      "projects.delete",

      "ai.use",
      "ai.models.view",

      "agents.view",
      "agents.create",
      "agents.update",
      "agents.delete",
      "agents.execute",

      "tasks.view",
      "tasks.create",
      "tasks.update",
      "tasks.delete",
      "tasks.execute",

      "workflows.view",
      "workflows.create",
      "workflows.update",
      "workflows.delete",
      "workflows.execute",

      "files.view",
      "files.upload",
      "files.update",
      "files.delete",

      "data.view",
      "data.create",
      "data.update",
      "data.delete",
      "data.export",

      "research.view",
      "research.create",
      "research.execute",

      "coding.view",
      "coding.create",
      "coding.execute",

      "design.view",
      "design.create",
      "design.execute",

      "writing.view",
      "writing.create",
      "writing.execute",

      "presentations.view",
      "presentations.create",
      "presentations.update",
      "presentations.delete",
      "presentations.export",

      "websites.view",
      "websites.create",
      "websites.update",
      "websites.delete",
      "websites.publish",

      "analytics.view",
      "analytics.export",

      "billing.view",

      "team.view",
      "team.invite",
      "team.update",

      "organization.view",

      "settings.view",
      "settings.update",

      "security.view",
      "audit.view",
    ],
  },

  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description:
      "Custom AI infrastructure for global organizations.",
    status: "active",

    badge: "Custom",

    price: {
      monthly: 0,
      yearly: 0,
      currency: "EUR",
    },

    limits: {
      aiRequestsPerMonth: -1,
      agentsPerWorkspace: -1,
      activeAutomations: -1,
      projects: -1,
      teamMembers: -1,
      storageGb: -1,
      apiRequestsPerMonth: -1,
      maxFileUploadMb: 500,
      maxConcurrentTasks: -1,
    },

    features: {
      aiAccess: true,
      advancedModels: true,
      customAgents: true,
      agentAutomation: true,
      workflowBuilder: true,
      priorityQueue: true,
      apiAccess: true,
      teamCollaboration: true,
      advancedAnalytics: true,
      customBranding: true,
      auditLogs: true,
      sso: true,
      dedicatedSupport: true,
      customIntegrations: true,
    },

    permissions: [
      "dashboard.view",

      "projects.view",
      "projects.create",
      "projects.update",
      "projects.delete",

      "ai.use",
      "ai.models.view",
      "ai.models.manage",

      "agents.view",
      "agents.create",
      "agents.update",
      "agents.delete",
      "agents.execute",
      "agents.manage",

      "tasks.view",
      "tasks.create",
      "tasks.update",
      "tasks.delete",
      "tasks.execute",
      "tasks.manage",

      "workflows.view",
      "workflows.create",
      "workflows.update",
      "workflows.delete",
      "workflows.execute",

      "files.view",
      "files.upload",
      "files.update",
      "files.delete",

      "data.view",
      "data.create",
      "data.update",
      "data.delete",
      "data.export",

      "research.view",
      "research.create",
      "research.execute",

      "coding.view",
      "coding.create",
      "coding.execute",

      "design.view",
      "design.create",
      "design.execute",

      "writing.view",
      "writing.create",
      "writing.execute",

      "presentations.view",
      "presentations.create",
      "presentations.update",
      "presentations.delete",
      "presentations.export",

      "websites.view",
      "websites.create",
      "websites.update",
      "websites.delete",
      "websites.publish",

      "analytics.view",
      "analytics.export",

      "billing.view",
      "billing.manage",

      "team.view",
      "team.invite",
      "team.update",
      "team.remove",

      "organization.view",
      "organization.update",

      "settings.view",
      "settings.update",

      "security.view",
      "security.manage",
      "audit.view",

      "admin.view",
    ],
  },
} as const;

/* -------------------------------------------------------------------------- */
/*                              PLAN ORDER                                    */
/* -------------------------------------------------------------------------- */

export const PLAN_ORDER: readonly PlanId[] = [
  "free",
  "starter",
  "pro",
  "business",
  "enterprise",
];

/* -------------------------------------------------------------------------- */
/*                              PLAN HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId];
}

export function isValidPlanId(
  value: string,
): value is PlanId {
  return value in PLANS;
}

export function getPlanPrice(
  planId: PlanId,
  interval: BillingInterval = "month",
): number {
  const plan = getPlan(planId);

  return interval === "year"
    ? plan.price.yearly
    : plan.price.monthly;
}

export function getYearlyMonthlyEquivalent(
  planId: PlanId,
): number {
  const yearlyPrice = getPlanPrice(planId, "year");

  if (yearlyPrice === 0) {
    return 0;
  }

  return yearlyPrice / 12;
}

export function getYearlySavings(
  planId: PlanId,
): number {
  const monthlyPrice = getPlanPrice(
    planId,
    "month",
  );

  const yearlyPrice = getPlanPrice(
    planId,
    "year",
  );

  if (
    monthlyPrice === 0 ||
    yearlyPrice === 0
  ) {
    return 0;
  }

  return monthlyPrice * 12 - yearlyPrice;
}

export function hasPlanPermission(
  planId: PlanId,
  permission: Permission,
): boolean {
  return PLANS[planId].permissions.includes(
    permission,
  );
}

export function isUnlimited(
  value: number,
): boolean {
  return value === -1;
}

export function canUseLimit(
  currentUsage: number,
  limit: number,
): boolean {
  if (isUnlimited(limit)) {
    return true;
  }

  return currentUsage < limit;
}

/* -------------------------------------------------------------------------- */
/*                          PLAN COMPARISON                                   */
/* -------------------------------------------------------------------------- */

export function comparePlans(
  currentPlan: PlanId,
  targetPlan: PlanId,
): number {
  const currentIndex =
    PLAN_ORDER.indexOf(currentPlan);

  const targetIndex =
    PLAN_ORDER.indexOf(targetPlan);

  return targetIndex - currentIndex;
}

export function isUpgrade(
  currentPlan: PlanId,
  targetPlan: PlanId,
): boolean {
  return comparePlans(
    currentPlan,
    targetPlan,
  ) > 0;
}

export function isDowngrade(
  currentPlan: PlanId,
  targetPlan: PlanId,
): boolean {
  return comparePlans(
    currentPlan,
    targetPlan,
  ) < 0;
}

/* -------------------------------------------------------------------------- */
/*                          ACTIVE PLANS                                      */
/* -------------------------------------------------------------------------- */

export function getActivePlans(): Plan[] {
  return PLAN_ORDER.map(
    (planId) => PLANS[planId],
  ).filter(
    (plan) => plan.status === "active",
  );
}

/* -------------------------------------------------------------------------- */
/*                          DEFAULT EXPORT                                    */
/* -------------------------------------------------------------------------- */

const plans = {
  PLANS,
  PLAN_ORDER,

  getPlan,
  isValidPlanId,

  getPlanPrice,
  getYearlyMonthlyEquivalent,
  getYearlySavings,

  hasPlanPermission,

  isUnlimited,
  canUseLimit,

  comparePlans,
  isUpgrade,
  isDowngrade,

  getActivePlans,
};

export default plans;