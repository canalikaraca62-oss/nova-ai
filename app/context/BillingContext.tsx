"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type BillingPlan =
  | "free"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

export type BillingInterval =
  | "monthly"
  | "yearly";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "inactive";

export type Currency =
  | "USD"
  | "EUR"
  | "GBP";

export interface BillingPlanDefinition {
  id: BillingPlan;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  popular?: boolean;
  features: string[];
}

export interface UsageLimit {
  used: number;
  limit: number | null;
}

export interface BillingUsage {
  messages: UsageLimit;
  projects: UsageLimit;
  storage: UsageLimit;
  automations: UsageLimit;
  apiRequests: UsageLimit;
}

export interface BillingSubscription {
  id: string;
  plan: BillingPlan;
  interval: BillingInterval;
  status: SubscriptionStatus;
  currency: Currency;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string | null;
}

export interface CheckoutOptions {
  plan: BillingPlan;
  interval: BillingInterval;
}

export interface BillingResult {
  success: boolean;
  message?: string;
}

export interface BillingContextValue {
  subscription: BillingSubscription | null;

  usage: BillingUsage;

  plans: BillingPlanDefinition[];

  isLoading: boolean;

  isInitialized: boolean;

  error: string | null;

  currentPlan: BillingPlan;

  subscriptionStatus: SubscriptionStatus;

  isPremium: boolean;

  refreshBilling: () => Promise<void>;

  startCheckout: (
    options: CheckoutOptions
  ) => Promise<BillingResult>;

  changePlan: (
    plan: BillingPlan,
    interval?: BillingInterval
  ) => Promise<BillingResult>;

  cancelSubscription: () => Promise<BillingResult>;

  resumeSubscription: () => Promise<BillingResult>;

  openCustomerPortal: () => Promise<BillingResult>;

  clearError: () => void;
}

export interface BillingProviderProps {
  children: React.ReactNode;
}

const BillingContext = createContext<
  BillingContextValue | undefined
>(undefined);

const DEFAULT_USAGE: BillingUsage = {
  messages: {
    used: 0,
    limit: 100,
  },
  projects: {
    used: 0,
    limit: 3,
  },
  storage: {
    used: 0,
    limit: 1024,
  },
  automations: {
    used: 0,
    limit: 1,
  },
  apiRequests: {
    used: 0,
    limit: 1000,
  },
};

const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description:
      "Essential tools for exploring the SYRAVEN platform.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "EUR",
    features: [
      "100 AI messages per month",
      "3 active projects",
      "1 automation",
      "1 GB storage",
      "Community support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    description:
      "For individuals building serious projects.",
    monthlyPrice: 19,
    yearlyPrice: 190,
    currency: "EUR",
    features: [
      "2,000 AI messages per month",
      "10 active projects",
      "10 automations",
      "10 GB storage",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description:
      "Advanced intelligence and automation for professionals.",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "EUR",
    popular: true,
    features: [
      "Unlimited AI conversations",
      "Unlimited projects",
      "Unlimited automations",
      "100 GB storage",
      "Advanced AI models",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    description:
      "Collaboration and intelligence for high-performance teams.",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    currency: "EUR",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Shared workspaces",
      "1 TB storage",
      "Advanced analytics",
      "Dedicated support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "Custom infrastructure for mission-critical organizations.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "EUR",
    features: [
      "Everything in Business",
      "Custom AI infrastructure",
      "Unlimited team members",
      "Custom storage",
      "SLA guarantees",
      "Dedicated success manager",
    ],
  },
];

function createFreeSubscription(): BillingSubscription {
  return {
    id: "free",
    plan: "free",
    interval: "monthly",
    status: "active",
    currency: "EUR",
    cancelAtPeriodEnd: false,
  };
}

function getDefaultUsage(
  plan: BillingPlan
): BillingUsage {
  if (
    plan === "pro" ||
    plan === "business" ||
    plan === "enterprise"
  ) {
    return {
      messages: {
        used: 0,
        limit: null,
      },
      projects: {
        used: 0,
        limit: null,
      },
      storage: {
        used: 0,
        limit:
          plan === "enterprise"
            ? null
            : plan === "business"
              ? 1024 * 1024
              : 100 * 1024,
      },
      automations: {
        used: 0,
        limit: null,
      },
      apiRequests: {
        used: 0,
        limit: null,
      },
    };
  }

  if (plan === "starter") {
    return {
      messages: {
        used: 0,
        limit: 2000,
      },
      projects: {
        used: 0,
        limit: 10,
      },
      storage: {
        used: 0,
        limit: 10 * 1024,
      },
      automations: {
        used: 0,
        limit: 10,
      },
      apiRequests: {
        used: 0,
        limit: 10000,
      },
    };
  }

  return DEFAULT_USAGE;
}

export function BillingProvider({
  children,
}: BillingProviderProps): React.ReactElement {
  const [subscription, setSubscription] =
    useState<BillingSubscription | null>(null);

  const [usage, setUsage] =
    useState<BillingUsage>(DEFAULT_USAGE);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isInitialized, setIsInitialized] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const refreshBilling =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production integration point:
         *
         * const response = await fetch("/api/billing", {
         *   method: "GET",
         *   credentials: "include",
         * });
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to load billing information"
         *   );
         * }
         *
         * const data = (await response.json()) as {
         *   subscription: BillingSubscription | null;
         *   usage: BillingUsage;
         * };
         *
         * setSubscription(data.subscription);
         * setUsage(data.usage);
         */

        const nextSubscription =
          createFreeSubscription();

        setSubscription(nextSubscription);

        setUsage(
          getDefaultUsage(
            nextSubscription.plan
          )
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load billing information";

        setError(message);

        setSubscription(
          createFreeSubscription()
        );

        setUsage(DEFAULT_USAGE);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, []);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  const startCheckout = useCallback(
    async (
      options: CheckoutOptions
    ): Promise<BillingResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (options.plan === "free") {
          throw new Error(
            "Free plan does not require checkout"
          );
        }

        if (options.plan === "enterprise") {
          throw new Error(
            "Enterprise plans require contacting sales"
          );
        }

        /*
         * Production Stripe integration:
         *
         * const response = await fetch(
         *   "/api/billing/checkout",
         *   {
         *     method: "POST",
         *     headers: {
         *       "Content-Type": "application/json",
         *     },
         *     credentials: "include",
         *     body: JSON.stringify(options),
         *   }
         * );
         *
         * const data = await response.json();
         *
         * if (!response.ok) {
         *   throw new Error(
         *     data.message ?? "Unable to start checkout"
         *   );
         * }
         *
         * window.location.assign(data.url);
         */

        const now = new Date();

        const currentPeriodEnd =
          new Date(now);

        if (options.interval === "yearly") {
          currentPeriodEnd.setFullYear(
            currentPeriodEnd.getFullYear() + 1
          );
        } else {
          currentPeriodEnd.setMonth(
            currentPeriodEnd.getMonth() + 1
          );
        }

        const nextSubscription: BillingSubscription = {
          id: `subscription_${Date.now()}`,
          plan: options.plan,
          interval: options.interval,
          status: "active",
          currency: "EUR",
          currentPeriodStart:
            now.toISOString(),
          currentPeriodEnd:
            currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: false,
          trialEndsAt: null,
        };

        setSubscription(nextSubscription);

        setUsage(
          getDefaultUsage(options.plan)
        );

        return {
          success: true,
          message:
            "Subscription successfully activated",
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to start checkout";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const changePlan = useCallback(
    async (
      plan: BillingPlan,
      interval?: BillingInterval
    ): Promise<BillingResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (!subscription) {
          return startCheckout({
            plan,
            interval:
              interval ?? "monthly",
          });
        }

        if (plan === "enterprise") {
          throw new Error(
            "Enterprise plan changes require contacting sales"
          );
        }

        /*
         * Production integration:
         *
         * await fetch("/api/billing/change-plan", {
         *   method: "POST",
         *   headers: {
         *     "Content-Type": "application/json",
         *   },
         *   credentials: "include",
         *   body: JSON.stringify({
         *     plan,
         *     interval,
         *   }),
         * });
         */

        const nextPlanInterval =
          interval ?? subscription.interval;

        const updatedSubscription: BillingSubscription = {
          ...subscription,
          plan,
          interval: nextPlanInterval,
          status: "active",
          cancelAtPeriodEnd: false,
        };

        setSubscription(updatedSubscription);

        setUsage(
          getDefaultUsage(plan)
        );

        return {
          success: true,
          message:
            "Subscription plan successfully updated",
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to change subscription plan";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [startCheckout, subscription]
  );

  const cancelSubscription =
    useCallback(async (): Promise<BillingResult> => {
      if (!subscription) {
        return {
          success: false,
          message:
            "No active subscription found",
        };
      }

      if (subscription.plan === "free") {
        return {
          success: false,
          message:
            "Free plans cannot be canceled",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production integration:
         *
         * await fetch("/api/billing/cancel", {
         *   method: "POST",
         *   credentials: "include",
         * });
         */

        setSubscription(
          (current) => {
            if (!current) {
              return null;
            }

            return {
              ...current,
              cancelAtPeriodEnd: true,
            };
          }
        );

        return {
          success: true,
          message:
            "Your subscription will end at the current billing period",
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to cancel subscription";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    }, [subscription]);

  const resumeSubscription =
    useCallback(async (): Promise<BillingResult> => {
      if (!subscription) {
        return {
          success: false,
          message:
            "No subscription found",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production integration:
         *
         * await fetch("/api/billing/resume", {
         *   method: "POST",
         *   credentials: "include",
         * });
         */

        setSubscription(
          (current) => {
            if (!current) {
              return null;
            }

            return {
              ...current,
              cancelAtPeriodEnd: false,
              status: "active",
            };
          }
        );

        return {
          success: true,
          message:
            "Subscription successfully resumed",
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to resume subscription";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    }, [subscription]);

  const openCustomerPortal =
    useCallback(async (): Promise<BillingResult> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production Stripe customer portal:
         *
         * const response = await fetch(
         *   "/api/billing/portal",
         *   {
         *     method: "POST",
         *     credentials: "include",
         *   }
         * );
         *
         * const data = await response.json();
         *
         * if (!response.ok) {
         *   throw new Error(
         *     data.message ??
         *       "Unable to open billing portal"
         *   );
         * }
         *
         * window.location.assign(data.url);
         */

        return {
          success: true,
          message:
            "Billing portal integration is ready",
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to open billing portal";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    }, []);

  const currentPlan =
    subscription?.plan ?? "free";

  const subscriptionStatus =
    subscription?.status ?? "inactive";

  const isPremium =
    currentPlan !== "free";

  const value =
    useMemo<BillingContextValue>(
      () => ({
        subscription,
        usage,
        plans: BILLING_PLANS,
        isLoading,
        isInitialized,
        error,
        currentPlan,
        subscriptionStatus,
        isPremium,
        refreshBilling,
        startCheckout,
        changePlan,
        cancelSubscription,
        resumeSubscription,
        openCustomerPortal,
        clearError,
      }),
      [
        subscription,
        usage,
        isLoading,
        isInitialized,
        error,
        currentPlan,
        subscriptionStatus,
        isPremium,
        refreshBilling,
        startCheckout,
        changePlan,
        cancelSubscription,
        resumeSubscription,
        openCustomerPortal,
        clearError,
      ]
    );

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBillingContext(): BillingContextValue {
  const context =
    useContext(BillingContext);

  if (!context) {
    throw new Error(
      "useBillingContext must be used within a BillingProvider"
    );
  }

  return context;
}

export function useBilling(): BillingContextValue {
  return useBillingContext();
}