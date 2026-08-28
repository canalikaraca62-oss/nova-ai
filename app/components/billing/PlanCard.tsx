"use client";

import React, { useMemo, useState } from "react";

export type BillingPlan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

export type PlanFeature = {
  text: string;
  included?: boolean;
};

export type PlanCardProps = {
  plan: BillingPlan;
  name?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  interval?: "month" | "year";
  features?: PlanFeature[];
  currentPlan?: BillingPlan;
  popular?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onSelect?: (plan: BillingPlan) => void | Promise<void>;
};

type DefaultPlanConfig = {
  name: string;
  description: string;
  price: number | null;
  features: PlanFeature[];
  popular?: boolean;
};

const DEFAULT_PLANS: Record<BillingPlan, DefaultPlanConfig> = {
  free: {
    name: "Free",
    description: "SYRAVEN ile üretmeye başlamak için temel araçlar.",
    price: 0,
    features: [
      { text: "Temel AI sohbeti" },
      { text: "3 aktif agent" },
      { text: "Temel knowledge storage" },
      { text: "Standart destek" },
    ],
  },

  premium: {
    name: "Premium",
    description: "Daha fazla AI gücü ve gelişmiş üretkenlik.",
    price: 19,
    popular: true,
    features: [
      { text: "Gelişmiş AI modelleri" },
      { text: "10 aktif agent" },
      { text: "10 GB knowledge storage" },
      { text: "AI Canvas erişimi" },
      { text: "Voice özellikleri" },
      { text: "Öncelikli kullanım kapasitesi" },
    ],
  },

  pro: {
    name: "Pro",
    description: "Profesyonel kullanıcılar için yüksek performans.",
    price: 49,
    features: [
      { text: "Yüksek AI kullanım limiti" },
      { text: "50 aktif agent" },
      { text: "100 GB knowledge storage" },
      { text: "Advanced reasoning" },
      { text: "Multi-step workflows" },
      { text: "API access" },
      { text: "Priority support" },
    ],
  },

  business: {
    name: "Business",
    description: "Ekipler ve büyüyen organizasyonlar için.",
    price: 149,
    features: [
      { text: "Yüksek kapasiteli AI altyapısı" },
      { text: "Unlimited agents" },
      { text: "1 TB knowledge storage" },
      { text: "Team collaboration" },
      { text: "Shared knowledge base" },
      { text: "Advanced analytics" },
      { text: "Custom integrations" },
      { text: "Priority support" },
    ],
  },

  enterprise: {
    name: "Enterprise",
    description: "Kurumsal ölçek, özel güvenlik ve sınırsız esneklik.",
    price: null,
    features: [
      { text: "Custom AI infrastructure" },
      { text: "Unlimited agent capacity" },
      { text: "Custom storage" },
      { text: "SSO / SAML" },
      { text: "Custom integrations" },
      { text: "Dedicated support" },
      { text: "Custom SLA" },
      { text: "Enterprise security" },
    ],
  },
};

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

function formatPrice(
  price: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `€${price}`;
  }
}

export default function PlanCard({
  plan,
  name,
  description,
  price,
  currency = "EUR",
  interval = "month",
  features,
  currentPlan,
  popular,
  disabled = false,
  loading = false,
  className,
  onSelect,
}: PlanCardProps) {
  const [internalLoading, setInternalLoading] = useState(false);

  const config = useMemo(
    () => DEFAULT_PLANS[plan],
    [plan]
  );

  const resolvedName = name ?? config.name;

  const resolvedDescription =
    description ?? config.description;

  const resolvedPrice =
    price === undefined
      ? config.price
      : price;

  const resolvedFeatures =
    features ?? config.features;

  const isPopular =
    popular ?? config.popular ?? false;

  const isCurrent =
    currentPlan === plan;

  const isEnterprise =
    plan === "enterprise";

  const isLoading =
    loading || internalLoading;

  const handleSelect = async () => {
    if (
      disabled ||
      loading ||
      internalLoading ||
      isCurrent
    ) {
      return;
    }

    if (!onSelect) {
      return;
    }

    try {
      setInternalLoading(true);

      await onSelect(plan);
    } finally {
      setInternalLoading(false);
    }
  };

  const buttonLabel = isCurrent
    ? "Current plan"
    : isEnterprise
      ? "Contact sales"
      : "Choose plan";

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition-all duration-300 dark:bg-zinc-950 sm:p-7",
        isPopular
          ? "border-zinc-950 shadow-xl shadow-zinc-950/10 dark:border-white dark:shadow-black/30"
          : "border-zinc-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800 dark:hover:border-zinc-700",
        isCurrent &&
          "ring-2 ring-zinc-950 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950",
        className
      )}
    >
      {isPopular && (
        <div className="absolute right-0 top-0">
          <div className="rounded-bl-2xl bg-zinc-950 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white dark:bg-white dark:text-zinc-950">
            Most popular
          </div>
        </div>
      )}

      {isCurrent && (
        <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Current plan
        </div>
      )}

      <div
        className={cn(
          "mb-7",
          isCurrent && "pt-9",
          isPopular && !isCurrent && "pt-3"
        )}
      >
        <h3 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          {resolvedName}
        </h3>

        <p className="mt-3 min-h-[48px] text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {resolvedDescription}
        </p>

        <div className="mt-7 flex items-end gap-2">
          {resolvedPrice === null ? (
            <span className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Custom
            </span>
          ) : (
            <>
              <span className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                {formatPrice(
                  resolvedPrice,
                  currency
                )}
              </span>

              <span className="pb-1 text-sm text-zinc-500 dark:text-zinc-400">
                / {interval === "year" ? "year" : "month"}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mb-7 h-px w-full bg-zinc-200 dark:bg-zinc-800" />

      <div className="flex-1">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          Included
        </p>

        <ul className="space-y-3.5">
          {resolvedFeatures.map(
            (feature, index) => {
              const included =
                feature.included !== false;

              return (
                <li
                  key={`${feature.text}-${index}`}
                  className="flex items-start gap-3"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      included
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
                    )}
                  >
                    {included ? "✓" : "—"}
                  </span>

                  <span
                    className={cn(
                      "text-sm leading-6",
                      included
                        ? "text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-400 line-through dark:text-zinc-600"
                    )}
                  >
                    {feature.text}
                  </span>
                </li>
              );
            }
          )}
        </ul>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={handleSelect}
          disabled={
            disabled ||
            isLoading ||
            isCurrent
          }
          className={cn(
            "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-950",
            isCurrent
              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              : isPopular
                ? "bg-zinc-950 text-white hover:scale-[1.02] hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                : "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing...
            </span>
          ) : (
            buttonLabel
          )}
        </button>

        {isEnterprise && (
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-500">
            Custom pricing and infrastructure for
            large-scale organizations.
          </p>
        )}
      </div>
    </article>
  );
}