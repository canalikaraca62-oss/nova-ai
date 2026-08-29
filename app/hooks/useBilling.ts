"use client";

import {
  useCallback,
  useMemo,
} from "react";

import {
  useBillingContext,
} from "../context/BillingContext";

export type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export type BillingPlan =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

type UnknownRecord = Record<
  string,
  unknown
>;

interface BillingPlanLike {
  id?: string;
  name?: string;
  slug?: string;
  status?: string;
  active?: boolean;
}

export interface UseBillingReturn {
  plans: unknown[];

  plan: BillingPlan;
  status: BillingStatus;

  isLoading: boolean;
  isProcessing: boolean;

  isFree: boolean;
  isStarter: boolean;
  isPro: boolean;
  isBusiness: boolean;
  isEnterprise: boolean;

  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isCanceled: boolean;

  hasActiveSubscription: boolean;

  canUpgrade: boolean;
  canManageBilling: boolean;

  subscription: unknown;
  usage: unknown;

  refresh: () => Promise<void>;

  upgrade: (
    plan: BillingPlan
  ) => Promise<void>;

  cancel: () => Promise<void>;

  openCustomerPortal: () => Promise<void>;
}

function getRecordValue(
  record: UnknownRecord,
  key: string
): unknown {
  return record[key];
}

function getFunction(
  record: UnknownRecord,
  ...keys: string[]
):
  | ((
      ...args: unknown[]
    ) => unknown)
  | undefined {
  for (const key of keys) {
    const value =
      getRecordValue(
        record,
        key
      );

    if (
      typeof value ===
      "function"
    ) {
      return value as (
        ...args: unknown[]
      ) => unknown;
    }
  }

  return undefined;
}

function normalizePlan(
  value: unknown
): BillingPlan {
  if (
    value === "starter" ||
    value === "pro" ||
    value === "business" ||
    value === "enterprise" ||
    value === "free"
  ) {
    return value;
  }

  return "free";
}

function normalizeStatus(
  value: unknown
): BillingStatus {
  if (
    value === "active" ||
    value === "trialing" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "inactive"
  ) {
    return value;
  }

  return "inactive";
}

function getPlanName(
  value: unknown
): BillingPlan {
  if (
    typeof value ===
    "string"
  ) {
    return normalizePlan(value);
  }

  if (
    typeof value ===
      "object" &&
    value !== null
  ) {
    const plan =
      value as BillingPlanLike;

    return normalizePlan(
      plan.slug ??
        plan.id ??
        plan.name
    );
  }

  return "free";
}

export function useBilling(): UseBillingReturn {
  const context =
    useBillingContext();

  /*
   * BillingContext'in gerçek yapısını
   * güvenli şekilde okuyoruz.
   */
  const billing =
    context as unknown as UnknownRecord;

  const plansValue =
    billing.plans;

  const plans = Array.isArray(
    plansValue
  )
    ? plansValue
    : [];

  const subscription =
    billing.subscription ??
    billing.currentSubscription ??
    null;

  const usage =
    billing.usage ??
    billing.currentUsage ??
    null;

  const currentPlanValue =
    billing.currentPlan ??
    billing.plan ??
    billing.activePlan ??
    subscription;

  const plan = getPlanName(
    currentPlanValue
  );

  const subscriptionRecord =
    subscription &&
    typeof subscription ===
      "object"
      ? (subscription as UnknownRecord)
      : null;

  const statusValue =
    billing.status ??
    billing.subscriptionStatus ??
    subscriptionRecord?.status;

  const status =
    normalizeStatus(
      statusValue
    );

  const isLoading =
    Boolean(
      billing.isLoading ??
        billing.loading
    );

  const isProcessing =
    Boolean(
      billing.isProcessing ??
        billing.processing ??
        billing.isUpdating
    );

  const isFree =
    plan === "free";

  const isStarter =
    plan === "starter";

  const isPro =
    plan === "pro";

  const isBusiness =
    plan === "business";

  const isEnterprise =
    plan === "enterprise";

  const isActive =
    status === "active";

  const isTrialing =
    status === "trialing";

  const isPastDue =
    status === "past_due";

  const isCanceled =
    status === "canceled";

  const hasActiveSubscription =
    isActive ||
    isTrialing;

  const canUpgrade =
    !isEnterprise;

  const canManageBilling =
    hasActiveSubscription ||
    isPastDue;

  const refreshFunction =
    getFunction(
      billing,
      "refresh",
      "refreshBilling",
      "refetch",
      "loadBilling"
    );

  const upgradeFunction =
    getFunction(
      billing,
      "upgrade",
      "upgradePlan",
      "changePlan",
      "subscribe"
    );

  const cancelFunction =
    getFunction(
      billing,
      "cancel",
      "cancelSubscription",
      "cancelPlan"
    );

  const portalFunction =
    getFunction(
      billing,
      "openCustomerPortal",
      "openBillingPortal",
      "manageBilling",
      "createPortalSession"
    );

  const refresh = useCallback(
    async () => {
      if (!refreshFunction) {
        return;
      }

      await Promise.resolve(
        refreshFunction()
      );
    },
    [
      refreshFunction,
    ]
  );

  const upgrade = useCallback(
    async (
      nextPlan: BillingPlan
    ) => {
      if (nextPlan === "free") {
        throw new Error(
          "Free plan cannot be selected as an upgrade."
        );
      }

      if (!upgradeFunction) {
        throw new Error(
          "Billing upgrade function is not available."
        );
      }

      await Promise.resolve(
        upgradeFunction(
          nextPlan
        )
      );
    },
    [
      upgradeFunction,
    ]
  );

  const cancel = useCallback(
    async () => {
      if (!cancelFunction) {
        throw new Error(
          "Subscription cancellation is not available."
        );
      }

      await Promise.resolve(
        cancelFunction()
      );
    },
    [
      cancelFunction,
    ]
  );

  const openCustomerPortal =
    useCallback(
      async () => {
        if (!portalFunction) {
          throw new Error(
            "Billing portal is not available."
          );
        }

        await Promise.resolve(
          portalFunction()
        );
      },
      [
        portalFunction,
      ]
    );

  return useMemo(
    () => ({
      plans,

      plan,
      status,

      isLoading,
      isProcessing,

      isFree,
      isStarter,
      isPro,
      isBusiness,
      isEnterprise,

      isActive,
      isTrialing,
      isPastDue,
      isCanceled,

      hasActiveSubscription,

      canUpgrade,
      canManageBilling,

      subscription,
      usage,

      refresh,
      upgrade,
      cancel,
      openCustomerPortal,
    }),
    [
      plans,

      plan,
      status,

      isLoading,
      isProcessing,

      isFree,
      isStarter,
      isPro,
      isBusiness,
      isEnterprise,

      isActive,
      isTrialing,
      isPastDue,
      isCanceled,

      hasActiveSubscription,

      canUpgrade,
      canManageBilling,

      subscription,
      usage,

      refresh,
      upgrade,
      cancel,
      openCustomerPortal,
    ]
  );
}

export default useBilling;