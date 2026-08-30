/**
 * SYRAVEN Billing Service
 *
 * Enterprise-grade billing, subscriptions, usage tracking,
 * entitlements and feature access management.
 *
 * NOTE:
 * This implementation is intentionally provider-agnostic.
 * Persistence and payment-provider synchronization can be
 * added behind this service without changing consumers.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type BillingInterval = "month" | "year";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  | "incomplete"
  | "incomplete_expired";

export type UsageMetric =
  | "requests"
  | "tokens"
  | "input_tokens"
  | "output_tokens"
  | "ai_generations"
  | "agent_executions"
  | "document_reads"
  | "storage_bytes"
  | "api_calls"
  | "custom";

export type PlanId = string;

export interface BillingPlan {
  id: PlanId;
  name: string;
  description?: string;

  active: boolean;

  priceMonthly: number;
  priceYearly?: number;

  currency: string;

  /**
   * -1 means unlimited.
   */
  limits: Record<string, number>;

  features: string[];

  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;

  userId: string;

  planId: PlanId;

  status: SubscriptionStatus;

  interval: BillingInterval;

  currentPeriodStart: Date;

  currentPeriodEnd: Date;

  cancelAtPeriodEnd: boolean;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface UsageRecord {
  id: string;

  userId: string;

  metric: UsageMetric | string;

  quantity: number;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  userId: string;

  metric: string;

  used: number;

  /**
   * null = metric is not limited by the plan.
   * -1 = unlimited.
   */
  limit: number | null;

  /**
   * null = unlimited or no explicit limit.
   */
  remaining: number | null;

  /**
   * null = unlimited or no explicit limit.
   */
  percentage: number | null;

  periodStart: Date;

  periodEnd: Date;
}

export interface BillingCustomer {
  userId: string;

  customerId?: string;

  email?: string;

  name?: string;

  metadata?: Record<string, unknown>;
}

export interface BillingPermission {
  allowed: boolean;

  reason?: string;

  limit?: number;

  used?: number;

  /**
   * Undefined means unlimited or no numeric limit exists.
   */
  remaining?: number;
}

export interface CreateSubscriptionInput {
  userId: string;

  planId: PlanId;

  interval?: BillingInterval;

  metadata?: Record<string, unknown>;
}

export interface UpdateSubscriptionInput {
  planId?: PlanId;

  status?: SubscriptionStatus;

  interval?: BillingInterval;

  cancelAtPeriodEnd?: boolean;

  metadata?: Record<string, unknown>;
}

export interface RecordUsageInput {
  userId: string;

  metric: UsageMetric | string;

  quantity?: number;

  timestamp?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT PLANS                                 */
/* -------------------------------------------------------------------------- */

export const FREE_PLAN: BillingPlan = {
  id: "free",

  name: "Free",

  description: "Starter access for individuals.",

  active: true,

  priceMonthly: 0,

  priceYearly: 0,

  currency: "EUR",

  limits: {
    requests: 100,
    tokens: 100_000,
    input_tokens: 100_000,
    output_tokens: 50_000,
    ai_generations: 50,
    agent_executions: 25,
    document_reads: 10,
    storage_bytes: 100 * 1024 * 1024,
    api_calls: 100,
  },

  features: [
    "basic_ai",
    "basic_agents",
    "document_reader",
  ],
};

export const PRO_PLAN: BillingPlan = {
  id: "pro",

  name: "Pro",

  description: "Professional AI workspace.",

  active: true,

  priceMonthly: 49,

  priceYearly: 490,

  currency: "EUR",

  limits: {
    requests: 10_000,
    tokens: 10_000_000,
    input_tokens: 10_000_000,
    output_tokens: 5_000_000,
    ai_generations: 5_000,
    agent_executions: 2_500,
    document_reads: 1_000,
    storage_bytes: 10 * 1024 * 1024 * 1024,
    api_calls: 10_000,
  },

  features: [
    "advanced_ai",
    "all_agents",
    "document_reader",
    "integrations",
    "priority_processing",
    "api_access",
  ],
};

export const ENTERPRISE_PLAN: BillingPlan = {
  id: "enterprise",

  name: "Enterprise",

  description: "Enterprise-scale AI infrastructure.",

  active: true,

  priceMonthly: 0,

  priceYearly: 0,

  currency: "EUR",

  limits: {
    requests: -1,
    tokens: -1,
    input_tokens: -1,
    output_tokens: -1,
    ai_generations: -1,
    agent_executions: -1,
    document_reads: -1,
    storage_bytes: -1,
    api_calls: -1,
  },

  features: [
    "advanced_ai",
    "all_agents",
    "document_reader",
    "integrations",
    "priority_processing",
    "api_access",
    "enterprise_security",
    "audit_logs",
    "custom_limits",
    "dedicated_support",
  ],
};

/* -------------------------------------------------------------------------- */
/*                              BILLING SERVICE                               */
/* -------------------------------------------------------------------------- */

class BillingService {
  private readonly plans = new Map<PlanId, BillingPlan>();

  private readonly subscriptions = new Map<string, Subscription>();

  private readonly usageRecords = new Map<string, UsageRecord[]>();

  private readonly customers = new Map<string, BillingCustomer>();

  constructor() {
    this.registerPlan(FREE_PLAN);
    this.registerPlan(PRO_PLAN);
    this.registerPlan(ENTERPRISE_PLAN);
  }

  /* ------------------------------------------------------------------------ */
  /*                              VALIDATION                                  */
  /* ------------------------------------------------------------------------ */

  private assertNonEmptyString(
    value: string,
    field: string
  ): void {
    if (!value || !value.trim()) {
      throw new Error(`${field} is required.`);
    }
  }

  private clonePlan(plan: BillingPlan): BillingPlan {
    return {
      ...plan,

      limits: {
        ...plan.limits,
      },

      features: [
        ...plan.features,
      ],

      metadata: plan.metadata
        ? {
            ...plan.metadata,
          }
        : undefined,
    };
  }

  private cloneSubscription(
    subscription: Subscription
  ): Subscription {
    return {
      ...subscription,

      currentPeriodStart: new Date(
        subscription.currentPeriodStart
      ),

      currentPeriodEnd: new Date(
        subscription.currentPeriodEnd
      ),

      createdAt: new Date(
        subscription.createdAt
      ),

      updatedAt: new Date(
        subscription.updatedAt
      ),

      metadata: subscription.metadata
        ? {
            ...subscription.metadata,
          }
        : undefined,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                 PLANS                                    */
  /* ------------------------------------------------------------------------ */

  registerPlan(plan: BillingPlan): BillingPlan {
    this.assertNonEmptyString(
      plan.id,
      "Billing plan id"
    );

    this.assertNonEmptyString(
      plan.name,
      `Billing plan "${plan.id}" name`
    );

    if (
      !Number.isFinite(plan.priceMonthly) ||
      plan.priceMonthly < 0
    ) {
      throw new Error(
        `Billing plan "${plan.id}" has an invalid monthly price.`
      );
    }

    if (
      plan.priceYearly !== undefined &&
      (
        !Number.isFinite(plan.priceYearly) ||
        plan.priceYearly < 0
      )
    ) {
      throw new Error(
        `Billing plan "${plan.id}" has an invalid yearly price.`
      );
    }

    for (
      const [metric, limit] of Object.entries(
        plan.limits
      )
    ) {
      if (
        !Number.isFinite(limit) ||
        limit < -1
      ) {
        throw new Error(
          `Billing plan "${plan.id}" has invalid limit for "${metric}".`
        );
      }
    }

    const storedPlan = this.clonePlan(plan);

    this.plans.set(
      storedPlan.id,
      storedPlan
    );

    return this.clonePlan(storedPlan);
  }

  getPlan(
    planId: PlanId
  ): BillingPlan | undefined {
    const plan = this.plans.get(planId);

    return plan
      ? this.clonePlan(plan)
      : undefined;
  }

  requirePlan(
    planId: PlanId
  ): BillingPlan {
    const plan = this.getPlan(planId);

    if (!plan) {
      throw new Error(
        `Billing plan not found: ${planId}`
      );
    }

    return plan;
  }

  getPlans(): BillingPlan[] {
    return Array.from(
      this.plans.values(),
      (plan) => this.clonePlan(plan)
    );
  }

  getActivePlans(): BillingPlan[] {
    return this.getPlans().filter(
      (plan) => plan.active
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               CUSTOMERS                                  */
  /* ------------------------------------------------------------------------ */

  setCustomer(
    customer: BillingCustomer
  ): BillingCustomer {
    this.assertNonEmptyString(
      customer.userId,
      "Customer userId"
    );

    const storedCustomer: BillingCustomer = {
      ...customer,

      metadata: customer.metadata
        ? {
            ...customer.metadata,
          }
        : undefined,
    };

    this.customers.set(
      customer.userId,
      storedCustomer
    );

    return {
      ...storedCustomer,

      metadata: storedCustomer.metadata
        ? {
            ...storedCustomer.metadata,
          }
        : undefined,
    };
  }

  getCustomer(
    userId: string
  ): BillingCustomer | undefined {
    const customer =
      this.customers.get(userId);

    if (!customer) {
      return undefined;
    }

    return {
      ...customer,

      metadata: customer.metadata
        ? {
            ...customer.metadata,
          }
        : undefined,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                             SUBSCRIPTIONS                                */
  /* ------------------------------------------------------------------------ */

  createSubscription(
    input: CreateSubscriptionInput
  ): Subscription {
    this.assertNonEmptyString(
      input.userId,
      "Subscription userId"
    );

    const plan =
      this.requirePlan(input.planId);

    if (!plan.active) {
      throw new Error(
        `Billing plan "${plan.id}" is inactive.`
      );
    }

    const now = new Date();

    const interval =
      input.interval ?? "month";

    const subscription: Subscription = {
      id: this.generateId("sub"),

      userId: input.userId,

      planId: plan.id,

      status: "active",

      interval,

      currentPeriodStart: now,

      currentPeriodEnd:
        this.calculatePeriodEnd(
          now,
          interval
        ),

      cancelAtPeriodEnd: false,

      createdAt: now,

      updatedAt: now,

      metadata: input.metadata
        ? {
            ...input.metadata,
          }
        : undefined,
    };

    this.subscriptions.set(
      input.userId,
      subscription
    );

    return this.cloneSubscription(
      subscription
    );
  }

  getSubscription(
    userId: string
  ): Subscription | undefined {
    const subscription =
      this.subscriptions.get(userId);

    if (!subscription) {
      return undefined;
    }

    const renewed =
      this.ensureCurrentPeriod(
        subscription
      );

    return this.cloneSubscription(
      renewed
    );
  }

  requireSubscription(
    userId: string
  ): Subscription {
    const subscription =
      this.getSubscription(userId);

    if (!subscription) {
      throw new Error(
        `Subscription not found for user: ${userId}`
      );
    }

    return subscription;
  }

  getOrCreateSubscription(
    userId: string
  ): Subscription {
    this.assertNonEmptyString(
      userId,
      "Subscription userId"
    );

    const existing =
      this.getSubscription(userId);

    if (existing) {
      return existing;
    }

    return this.createSubscription({
      userId,
      planId: FREE_PLAN.id,
      interval: "month",
    });
  }

  updateSubscription(
    userId: string,
    input: UpdateSubscriptionInput
  ): Subscription {
    const current =
      this.requireSubscription(userId);

    const nextPlanId =
      input.planId ??
      current.planId;

    const nextInterval =
      input.interval ??
      current.interval;

    const plan =
      this.requirePlan(nextPlanId);

    if (!plan.active) {
      throw new Error(
        `Billing plan "${plan.id}" is inactive.`
      );
    }

    const planChanged =
      nextPlanId !== current.planId;

    const intervalChanged =
      nextInterval !== current.interval;

    const now = new Date();

    const periodStart =
      planChanged || intervalChanged
        ? now
        : current.currentPeriodStart;

    const periodEnd =
      planChanged || intervalChanged
        ? this.calculatePeriodEnd(
            now,
            nextInterval
          )
        : current.currentPeriodEnd;

    const updated: Subscription = {
      ...current,

      planId: nextPlanId,

      status:
        input.status ??
        current.status,

      interval: nextInterval,

      currentPeriodStart:
        periodStart,

      currentPeriodEnd:
        periodEnd,

      cancelAtPeriodEnd:
        input.cancelAtPeriodEnd ??
        current.cancelAtPeriodEnd,

      metadata:
        input.metadata !== undefined
          ? {
              ...input.metadata,
            }
          : current.metadata,

      updatedAt: now,
    };

    this.subscriptions.set(
      userId,
      updated
    );

    return this.cloneSubscription(
      updated
    );
  }

  cancelSubscription(
    userId: string,
    immediately = false
  ): Subscription {
    const subscription =
      this.requireSubscription(userId);

    if (immediately) {
      const canceled: Subscription = {
        ...subscription,

        status: "canceled",

        cancelAtPeriodEnd: false,

        updatedAt: new Date(),
      };

      this.subscriptions.set(
        userId,
        canceled
      );

      return this.cloneSubscription(
        canceled
      );
    }

    return this.updateSubscription(
      userId,
      {
        cancelAtPeriodEnd: true,
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  USAGE                                   */
  /* ------------------------------------------------------------------------ */

  recordUsage(
    input: RecordUsageInput
  ): UsageRecord {
    this.assertNonEmptyString(
      input.userId,
      "Usage userId"
    );

    this.assertNonEmptyString(
      input.metric,
      "Usage metric"
    );

    const quantity =
      input.quantity ?? 1;

    if (
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      throw new Error(
        "Usage quantity must be a non-negative finite number."
      );
    }

    const timestamp =
      input.timestamp
        ? new Date(input.timestamp)
        : new Date();

    if (
      Number.isNaN(
        timestamp.getTime()
      )
    ) {
      throw new Error(
        "Usage timestamp is invalid."
      );
    }

    const record: UsageRecord = {
      id: this.generateId("usage"),

      userId: input.userId,

      metric: input.metric,

      quantity,

      timestamp,

      metadata: input.metadata
        ? {
            ...input.metadata,
          }
        : undefined,
    };

    const records =
      this.usageRecords.get(
        input.userId
      ) ?? [];

    records.push(record);

    this.usageRecords.set(
      input.userId,
      records
    );

    return this.cloneUsageRecord(
      record
    );
  }

  getUsage(
    userId: string,
    metric: UsageMetric | string,
    periodStart?: Date,
    periodEnd?: Date
  ): number {
    const records =
      this.usageRecords.get(
        userId
      ) ?? [];

    const period =
      this.getCurrentPeriod(userId);

    const start =
      periodStart
        ? new Date(periodStart)
        : period.start;

    const end =
      periodEnd
        ? new Date(periodEnd)
        : period.end;

    return records
      .filter(
        (record) =>
          record.metric === metric &&
          record.timestamp >= start &&
          record.timestamp <= end
      )
      .reduce(
        (total, record) =>
          total + record.quantity,
        0
      );
  }

  /* ------------------------------------------------------------------------ */
  /*                              ENTITLEMENTS                                */
  /* ------------------------------------------------------------------------ */

  getPlanLimit(
    userId: string,
    metric: UsageMetric | string
  ): number | null {
    const subscription =
      this.getOrCreateSubscription(
        userId
      );

    const plan =
      this.requirePlan(
        subscription.planId
      );

    const value =
      plan.limits[metric];

    return typeof value === "number"
      ? value
      : null;
  }

  getUsageSummary(
    userId: string,
    metric: UsageMetric | string
  ): UsageSummary {
    const period =
      this.getCurrentPeriod(
        userId
      );

    const used =
      this.getUsage(
        userId,
        metric,
        period.start,
        period.end
      );

    const limit =
      this.getPlanLimit(
        userId,
        metric
      );

    const unlimited =
      limit === -1;

    const remaining =
      limit === null || unlimited
        ? null
        : Math.max(
            0,
            limit - used
          );

    const percentage =
      limit === null ||
      unlimited ||
      limit <= 0
        ? null
        : Math.min(
            100,
            (used / limit) * 100
          );

    return {
      userId,

      metric,

      used,

      limit,

      remaining,

      percentage,

      periodStart:
        new Date(period.start),

      periodEnd:
        new Date(period.end),
    };
  }

  canUse(
    userId: string,
    metric: UsageMetric | string,
    quantity = 1
  ): BillingPermission {
    if (
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      return {
        allowed: false,

        reason:
          "Invalid usage quantity.",
      };
    }

    const subscription =
      this.getOrCreateSubscription(
        userId
      );

    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      return {
        allowed: false,

        reason:
          `Subscription is ${subscription.status}.`,
      };
    }

    if (
      subscription.cancelAtPeriodEnd &&
      new Date() >= subscription.currentPeriodEnd
    ) {
      return {
        allowed: false,

        reason:
          "Subscription period has ended.",
      };
    }

    const summary =
      this.getUsageSummary(
        userId,
        metric
      );

    /**
     * No explicit limit.
     */
    if (
      summary.limit === null
    ) {
      return {
        allowed: true,

        used: summary.used,
      };
    }

    /**
     * Unlimited.
     *
     * IMPORTANT:
     * remaining is intentionally omitted.
     * BillingPermission expects number | undefined,
     * not null.
     */
    if (
      summary.limit === -1
    ) {
      return {
        allowed: true,

        limit: -1,

        used: summary.used,
      };
    }

    const remaining =
      Math.max(
        0,
        summary.limit -
          summary.used
      );

    if (
      quantity > remaining
    ) {
      return {
        allowed: false,

        reason:
          `Usage limit exceeded for "${metric}".`,

        limit:
          summary.limit,

        used:
          summary.used,

        remaining,
      };
    }

    return {
      allowed: true,

      limit:
        summary.limit,

      used:
        summary.used,

      remaining,
    };
  }

  assertCanUse(
    userId: string,
    metric: UsageMetric | string,
    quantity = 1
  ): void {
    const permission =
      this.canUse(
        userId,
        metric,
        quantity
      );

    if (!permission.allowed) {
      throw new Error(
        permission.reason ??
          `Usage not allowed for "${metric}".`
      );
    }
  }

  /**
   * Check entitlement and record usage.
   *
   * For multi-instance production deployments,
   * this operation should be backed by a database
   * transaction or atomic provider operation.
   */
  consumeUsage(
    input: RecordUsageInput
  ): UsageRecord {
    const quantity =
      input.quantity ?? 1;

    this.assertCanUse(
      input.userId,
      input.metric,
      quantity
    );

    return this.recordUsage({
      ...input,

      quantity,
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                                FEATURES                                  */
  /* ------------------------------------------------------------------------ */

  hasFeature(
    userId: string,
    feature: string
  ): boolean {
    this.assertNonEmptyString(
      feature,
      "Feature"
    );

    const subscription =
      this.getOrCreateSubscription(
        userId
      );

    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      return false;
    }

    const plan =
      this.requirePlan(
        subscription.planId
      );

    return plan.features.includes(
      feature
    );
  }

  assertFeature(
    userId: string,
    feature: string
  ): void {
    if (
      !this.hasFeature(
        userId,
        feature
      )
    ) {
      throw new Error(
        `Feature "${feature}" is not available for this subscription.`
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                              PERIOD HELPERS                              */
  /* ------------------------------------------------------------------------ */

  getCurrentPeriod(
    userId: string
  ): {
    start: Date;
    end: Date;
  } {
    const subscription =
      this.getOrCreateSubscription(
        userId
      );

    return {
      start: new Date(
        subscription.currentPeriodStart
      ),

      end: new Date(
        subscription.currentPeriodEnd
      ),
    };
  }

  private ensureCurrentPeriod(
    subscription: Subscription
  ): Subscription {
    const now = new Date();

    /**
     * Canceled subscriptions should not be renewed.
     */
    if (
      subscription.status === "canceled"
    ) {
      return subscription;
    }

    /**
     * Subscription is still inside the current period.
     */
    if (
      now < subscription.currentPeriodEnd
    ) {
      return subscription;
    }

    /**
     * Cancel at period end means the subscription expires.
     */
    if (
      subscription.cancelAtPeriodEnd
    ) {
      const expired: Subscription = {
        ...subscription,

        status: "canceled",

        updatedAt: now,
      };

      this.subscriptions.set(
        subscription.userId,
        expired
      );

      return expired;
    }

    /**
     * Advance periods until the current date is covered.
     */
    let start = new Date(
      subscription.currentPeriodEnd
    );

    let end =
      this.calculatePeriodEnd(
        start,
        subscription.interval
      );

    while (
      now >= end
    ) {
      start = end;

      end =
        this.calculatePeriodEnd(
          start,
          subscription.interval
        );
    }

    const renewed: Subscription = {
      ...subscription,

      currentPeriodStart:
        start,

      currentPeriodEnd:
        end,

      updatedAt:
        now,
    };

    this.subscriptions.set(
      subscription.userId,
      renewed
    );

    return renewed;
  }

  private calculatePeriodEnd(
    start: Date,
    interval: BillingInterval
  ): Date {
    const end = new Date(start);

    if (
      interval === "year"
    ) {
      end.setFullYear(
        end.getFullYear() + 1
      );
    } else {
      end.setMonth(
        end.getMonth() + 1
      );
    }

    return end;
  }

  private cloneUsageRecord(
    record: UsageRecord
  ): UsageRecord {
    return {
      ...record,

      timestamp: new Date(
        record.timestamp
      ),

      metadata: record.metadata
        ? {
            ...record.metadata,
          }
        : undefined,
    };
  }

  private generateId(
    prefix: string
  ): string {
    const timestamp =
      Date.now()
        .toString(36);

    const random =
      Math.random()
        .toString(36)
        .slice(2, 12);

    return `${prefix}_${timestamp}_${random}`;
  }

  /* ------------------------------------------------------------------------ */
  /*                                 ADMIN                                    */
  /* ------------------------------------------------------------------------ */

  clearUsage(
    userId?: string
  ): void {
    if (userId) {
      this.usageRecords.delete(
        userId
      );

      return;
    }

    this.usageRecords.clear();
  }

  clearSubscriptions(): void {
    this.subscriptions.clear();
  }

  clearCustomers(): void {
    this.customers.clear();
  }
}

/* -------------------------------------------------------------------------- */
/*                              SINGLETON EXPORT                              */
/* -------------------------------------------------------------------------- */

export const billingService =
  new BillingService();

/* -------------------------------------------------------------------------- */
/*                            CONVENIENCE EXPORTS                             */
/* -------------------------------------------------------------------------- */

export function getBillingPlan(
  planId: PlanId
): BillingPlan | undefined {
  return billingService.getPlan(
    planId
  );
}

export function getBillingPlans(): BillingPlan[] {
  return billingService.getPlans();
}

export function getActiveBillingPlans(): BillingPlan[] {
  return billingService.getActivePlans();
}

export function getSubscription(
  userId: string
): Subscription | undefined {
  return billingService.getSubscription(
    userId
  );
}

export function getOrCreateSubscription(
  userId: string
): Subscription {
  return billingService.getOrCreateSubscription(
    userId
  );
}

export function createSubscription(
  input: CreateSubscriptionInput
): Subscription {
  return billingService.createSubscription(
    input
  );
}

export function updateSubscription(
  userId: string,
  input: UpdateSubscriptionInput
): Subscription {
  return billingService.updateSubscription(
    userId,
    input
  );
}

export function cancelSubscription(
  userId: string,
  immediately = false
): Subscription {
  return billingService.cancelSubscription(
    userId,
    immediately
  );
}

export function setBillingCustomer(
  customer: BillingCustomer
): BillingCustomer {
  return billingService.setCustomer(
    customer
  );
}

export function getBillingCustomer(
  userId: string
): BillingCustomer | undefined {
  return billingService.getCustomer(
    userId
  );
}

export function recordUsage(
  input: RecordUsageInput
): UsageRecord {
  return billingService.recordUsage(
    input
  );
}

export function consumeUsage(
  input: RecordUsageInput
): UsageRecord {
  return billingService.consumeUsage(
    input
  );
}

export function canUse(
  userId: string,
  metric: UsageMetric | string,
  quantity = 1
): BillingPermission {
  return billingService.canUse(
    userId,
    metric,
    quantity
  );
}

export function assertCanUse(
  userId: string,
  metric: UsageMetric | string,
  quantity = 1
): void {
  billingService.assertCanUse(
    userId,
    metric,
    quantity
  );
}

export function getUsageSummary(
  userId: string,
  metric: UsageMetric | string
): UsageSummary {
  return billingService.getUsageSummary(
    userId,
    metric
  );
}

export function getPlanLimit(
  userId: string,
  metric: UsageMetric | string
): number | null {
  return billingService.getPlanLimit(
    userId,
    metric
  );
}

export function hasFeature(
  userId: string,
  feature: string
): boolean {
  return billingService.hasFeature(
    userId,
    feature
  );
}

export function assertFeature(
  userId: string,
  feature: string
): void {
  billingService.assertFeature(
    userId,
    feature
  );
}

export default billingService;