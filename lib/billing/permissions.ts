// lib/ai/billing/permissions.ts

import {
  type BillingPlan,
  type BillingPlanId,
  getBillingPlan,
  isEnterprisePlan,
  isUnlimited,
} from "./config";

/**
 * Platform permissions controlled by subscription plans.
 */
export type BillingPermission =
  | "ai.chat"
  | "ai.advanced_models"
  | "ai.priority_processing"
  | "agents.basic"
  | "agents.advanced"
  | "agents.custom"
  | "agents.orchestration"
  | "automation.basic"
  | "automation.advanced"
  | "automation.enterprise"
  | "research.basic"
  | "research.advanced"
  | "research.web"
  | "research.deep"
  | "data.analysis"
  | "data.advanced_analytics"
  | "data.forecasting"
  | "business.intelligence"
  | "business.reporting"
  | "business.strategy"
  | "api.access"
  | "api.advanced"
  | "api.enterprise"
  | "storage.basic"
  | "storage.advanced"
  | "team.collaboration"
  | "team.management"
  | "organization.management"
  | "security.standard"
  | "security.advanced"
  | "security.enterprise"
  | "models.standard"
  | "models.advanced"
  | "models.custom"
  | "support.standard"
  | "support.priority"
  | "support.dedicated"
  | "governance.audit"
  | "governance.enterprise"
  | "billing.usage_based";

/**
 * Resource limits that can be checked at runtime.
 */
export type BillingResource =
  | "requests"
  | "input_tokens"
  | "output_tokens"
  | "ai_calls"
  | "agents"
  | "storage_gb"
  | "api_calls"
  | "web_searches"
  | "team_members";

/**
 * Permission configuration for each subscription plan.
 */
export interface PlanPermissionConfig {
  planId: BillingPlanId;

  permissions: readonly BillingPermission[];
}

/**
 * Central plan permission matrix.
 *
 * Permissions are cumulative as plans increase in capability.
 */
export const planPermissions: Record<
  BillingPlanId,
  PlanPermissionConfig
> = {
  free: {
    planId: "free",

    permissions: [
      "ai.chat",
      "agents.basic",
      "automation.basic",
      "research.basic",
      "research.web",
      "storage.basic",
      "security.standard",
      "models.standard",
      "support.standard",
    ],
  },

  starter: {
    planId: "starter",

    permissions: [
      "ai.chat",
      "ai.advanced_models",
      "agents.basic",
      "agents.advanced",
      "automation.basic",
      "automation.advanced",
      "research.basic",
      "research.advanced",
      "research.web",
      "data.analysis",
      "business.reporting",
      "api.access",
      "storage.basic",
      "storage.advanced",
      "security.standard",
      "models.standard",
      "models.advanced",
      "support.standard",
    ],
  },

  pro: {
    planId: "pro",

    permissions: [
      "ai.chat",
      "ai.advanced_models",
      "ai.priority_processing",
      "agents.basic",
      "agents.advanced",
      "agents.custom",
      "agents.orchestration",
      "automation.basic",
      "automation.advanced",
      "research.basic",
      "research.advanced",
      "research.web",
      "research.deep",
      "data.analysis",
      "data.advanced_analytics",
      "data.forecasting",
      "business.intelligence",
      "business.reporting",
      "business.strategy",
      "api.access",
      "api.advanced",
      "storage.basic",
      "storage.advanced",
      "team.collaboration",
      "security.standard",
      "security.advanced",
      "models.standard",
      "models.advanced",
      "support.standard",
      "support.priority",
      "billing.usage_based",
    ],
  },

  business: {
    planId: "business",

    permissions: [
      "ai.chat",
      "ai.advanced_models",
      "ai.priority_processing",
      "agents.basic",
      "agents.advanced",
      "agents.custom",
      "agents.orchestration",
      "automation.basic",
      "automation.advanced",
      "automation.enterprise",
      "research.basic",
      "research.advanced",
      "research.web",
      "research.deep",
      "data.analysis",
      "data.advanced_analytics",
      "data.forecasting",
      "business.intelligence",
      "business.reporting",
      "business.strategy",
      "api.access",
      "api.advanced",
      "storage.basic",
      "storage.advanced",
      "team.collaboration",
      "team.management",
      "organization.management",
      "security.standard",
      "security.advanced",
      "models.standard",
      "models.advanced",
      "support.standard",
      "support.priority",
      "governance.audit",
      "billing.usage_based",
    ],
  },

  enterprise: {
    planId: "enterprise",

    permissions: [
      "ai.chat",
      "ai.advanced_models",
      "ai.priority_processing",
      "agents.basic",
      "agents.advanced",
      "agents.custom",
      "agents.orchestration",
      "automation.basic",
      "automation.advanced",
      "automation.enterprise",
      "research.basic",
      "research.advanced",
      "research.web",
      "research.deep",
      "data.analysis",
      "data.advanced_analytics",
      "data.forecasting",
      "business.intelligence",
      "business.reporting",
      "business.strategy",
      "api.access",
      "api.advanced",
      "api.enterprise",
      "storage.basic",
      "storage.advanced",
      "team.collaboration",
      "team.management",
      "organization.management",
      "security.standard",
      "security.advanced",
      "security.enterprise",
      "models.standard",
      "models.advanced",
      "models.custom",
      "support.standard",
      "support.priority",
      "support.dedicated",
      "governance.audit",
      "governance.enterprise",
      "billing.usage_based",
    ],
  },
};

/**
 * Maps runtime resource names to the corresponding plan limits.
 */
const resourceLimitGetters: Record<
  BillingResource,
  (plan: BillingPlan) => number
> = {
  requests: (plan) => plan.limits.requestsPerMonth,

  input_tokens: (plan) => plan.limits.inputTokensPerMonth,

  output_tokens: (plan) => plan.limits.outputTokensPerMonth,

  ai_calls: (plan) => plan.limits.aiCallsPerMonth,

  agents: (plan) => plan.limits.agentsPerWorkspace,

  storage_gb: (plan) => plan.limits.storageGb,

  api_calls: (plan) => plan.limits.apiCallsPerMonth,

  web_searches: (plan) => plan.limits.webSearchesPerMonth,

  team_members: (plan) => plan.limits.teamMembers,
};

/**
 * Returns all permissions available for a plan.
 */
export function getPlanPermissions(
  planId: BillingPlanId,
): readonly BillingPermission[] {
  return planPermissions[planId].permissions;
}

/**
 * Checks whether a subscription plan has a permission.
 */
export function hasPermission(
  planId: BillingPlanId,
  permission: BillingPermission,
): boolean {
  return planPermissions[planId].permissions.includes(permission);
}

/**
 * Checks whether a subscription plan has every required permission.
 */
export function hasAllPermissions(
  planId: BillingPlanId,
  permissions: readonly BillingPermission[],
): boolean {
  return permissions.every((permission) =>
    hasPermission(planId, permission),
  );
}

/**
 * Checks whether a subscription plan has at least one required permission.
 */
export function hasAnyPermission(
  planId: BillingPlanId,
  permissions: readonly BillingPermission[],
): boolean {
  return permissions.some((permission) =>
    hasPermission(planId, permission),
  );
}

/**
 * Returns the configured limit for a resource.
 */
export function getResourceLimit(
  planId: BillingPlanId,
  resource: BillingResource,
): number {
  const plan = getBillingPlan(planId);

  return resourceLimitGetters[resource](plan);
}

/**
 * Checks whether a plan has unlimited access to a resource.
 */
export function hasUnlimitedResource(
  planId: BillingPlanId,
  resource: BillingResource,
): boolean {
  return isUnlimited(
    getResourceLimit(planId, resource),
  );
}

/**
 * Checks whether a requested usage amount is allowed.
 *
 * Example:
 * canUseResource("pro", "ai_calls", 500)
 */
export function canUseResource(
  planId: BillingPlanId,
  resource: BillingResource,
  usage: number,
): boolean {
  if (usage < 0) {
    return false;
  }

  const limit = getResourceLimit(planId, resource);

  if (isUnlimited(limit)) {
    return true;
  }

  return usage <= limit;
}

/**
 * Checks whether additional usage can be consumed.
 *
 * Example:
 * currentUsage = 900
 * requestedUsage = 200
 * limit = 1000
 *
 * Result: false
 */
export function canConsumeResource(
  planId: BillingPlanId,
  resource: BillingResource,
  currentUsage: number,
  requestedUsage = 1,
): boolean {
  if (currentUsage < 0 || requestedUsage < 0) {
    return false;
  }

  const limit = getResourceLimit(planId, resource);

  if (isUnlimited(limit)) {
    return true;
  }

  return currentUsage + requestedUsage <= limit;
}

/**
 * Returns remaining available resource capacity.
 *
 * Returns -1 for unlimited resources.
 */
export function getRemainingResource(
  planId: BillingPlanId,
  resource: BillingResource,
  currentUsage: number,
): number {
  const limit = getResourceLimit(planId, resource);

  if (isUnlimited(limit)) {
    return -1;
  }

  return Math.max(0, limit - Math.max(0, currentUsage));
}

/**
 * Calculates usage percentage.
 *
 * Returns 0 for unlimited resources.
 */
export function getResourceUsagePercentage(
  planId: BillingPlanId,
  resource: BillingResource,
  currentUsage: number,
): number {
  const limit = getResourceLimit(planId, resource);

  if (isUnlimited(limit)) {
    return 0;
  }

  if (limit <= 0) {
    return currentUsage > 0 ? 100 : 0;
  }

  const percentage = (currentUsage / limit) * 100;

  return Math.min(
    100,
    Math.max(0, percentage),
  );
}

/**
 * Returns whether a plan is enterprise-level.
 */
export function hasEnterpriseAccess(
  planId: BillingPlanId,
): boolean {
  return isEnterprisePlan(planId);
}

/**
 * Returns a structured permission check result.
 */
export interface PermissionCheckResult {
  allowed: boolean;

  planId: BillingPlanId;

  permission: BillingPermission;

  reason?: string;
}

/**
 * Checks permission and returns a structured result.
 */
export function checkPermission(
  planId: BillingPlanId,
  permission: BillingPermission,
): PermissionCheckResult {
  const allowed = hasPermission(planId, permission);

  return {
    allowed,
    planId,
    permission,

    ...(allowed
      ? {}
      : {
          reason: `Permission "${permission}" is not available on the "${planId}" plan.`,
        }),
  };
}

/**
 * Returns all permissions required for enterprise-only features.
 */
export const enterprisePermissions: readonly BillingPermission[] = [
  "automation.enterprise",
  "api.enterprise",
  "security.enterprise",
  "models.custom",
  "support.dedicated",
  "governance.enterprise",
];

/**
 * Checks whether a permission is enterprise-only.
 */
export function isEnterprisePermission(
  permission: BillingPermission,
): boolean {
  return enterprisePermissions.includes(permission);
}

export default planPermissions;