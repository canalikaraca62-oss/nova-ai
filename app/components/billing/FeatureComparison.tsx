"use client";

import React, { useMemo, useState } from "react";

type BillingPlan = "free" | "premium" | "pro" | "business" | "enterprise";

type FeatureValue = boolean | string;

type PlanDefinition = {
  id: BillingPlan;
  name: string;
  description: string;
  badge?: string;
  price: string;
  period: string;
  popular?: boolean;
};

type FeatureRow = {
  category: string;
  feature: string;
  description?: string;
  free: FeatureValue;
  premium: FeatureValue;
  pro: FeatureValue;
  business: FeatureValue;
  enterprise: FeatureValue;
};

export type FeatureComparisonProps = {
  currentPlan?: BillingPlan;
  onSelectPlan?: (plan: BillingPlan) => void;
  className?: string;
};

const plans: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Temel SYRAVEN deneyimi",
    price: "€0",
    period: "/ ay",
  },
  {
    id: "premium",
    name: "Premium",
    description: "Daha fazla güç ve üretkenlik",
    badge: "Popular",
    price: "€19",
    period: "/ ay",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Profesyonel AI çalışma alanı",
    price: "€49",
    period: "/ ay",
  },
  {
    id: "business",
    name: "Business",
    description: "Ekipler ve büyüyen organizasyonlar",
    price: "€149",
    period: "/ ay",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Kurumsal ölçek ve özel çözümler",
    price: "Custom",
    period: "",
  },
];

const features: FeatureRow[] = [
  {
    category: "AI & Intelligence",
    feature: "AI sohbetleri",
    description: "SYRAVEN AI ile günlük kullanım",
    free: "Limited",
    premium: "Extended",
    pro: "High",
    business: "Unlimited",
    enterprise: "Unlimited",
  },
  {
    category: "AI & Intelligence",
    feature: "Premium AI modelleri",
    description: "Gelişmiş model erişimi",
    free: false,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "AI & Intelligence",
    feature: "Agent execution",
    description: "AI agent oluşturma ve çalıştırma",
    free: "Limited",
    premium: "Extended",
    pro: "High",
    business: "Unlimited",
    enterprise: "Unlimited",
  },
  {
    category: "AI & Intelligence",
    feature: "Custom AI instructions",
    free: true,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "AI & Intelligence",
    feature: "Advanced reasoning",
    description: "Daha karmaşık görev çözümleme",
    free: false,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Agents",
    feature: "Aktif agent sayısı",
    free: "3",
    premium: "10",
    pro: "50",
    business: "Unlimited",
    enterprise: "Unlimited",
  },
  {
    category: "Agents",
    feature: "Custom agents",
    free: true,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Agents",
    feature: "Agent templates",
    free: "Basic",
    premium: "Premium",
    pro: "All",
    business: "All",
    enterprise: "Custom",
  },
  {
    category: "Agents",
    feature: "Multi-step workflows",
    free: false,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Agents",
    feature: "Team agent sharing",
    free: false,
    premium: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Knowledge",
    feature: "Knowledge storage",
    free: "1 GB",
    premium: "10 GB",
    pro: "100 GB",
    business: "1 TB",
    enterprise: "Custom",
  },
  {
    category: "Knowledge",
    feature: "Document analysis",
    free: true,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Knowledge",
    feature: "Advanced search",
    free: "Basic",
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Knowledge",
    feature: "Team knowledge base",
    free: false,
    premium: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Canvas & Projects",
    feature: "Projects",
    free: "3",
    premium: "25",
    pro: "100",
    business: "Unlimited",
    enterprise: "Unlimited",
  },
  {
    category: "Canvas & Projects",
    feature: "AI Canvas",
    free: "Basic",
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Canvas & Projects",
    feature: "Collaboration",
    free: false,
    premium: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Voice",
    feature: "Voice input",
    free: "Limited",
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Voice",
    feature: "Voice output",
    free: "Limited",
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Voice",
    feature: "Advanced transcription",
    free: false,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Usage & Limits",
    feature: "Monthly AI usage",
    free: "Starter",
    premium: "5×",
    pro: "20×",
    business: "Unlimited",
    enterprise: "Custom",
  },
  {
    category: "Usage & Limits",
    feature: "API access",
    free: false,
    premium: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Usage & Limits",
    feature: "Advanced analytics",
    free: false,
    premium: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Security & Support",
    feature: "Standard support",
    free: true,
    premium: true,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Security & Support",
    feature: "Priority support",
    free: false,
    premium: false,
    pro: true,
    business: true,
    enterprise: true,
  },
  {
    category: "Security & Support",
    feature: "Dedicated support",
    free: false,
    premium: false,
    pro: false,
    business: false,
    enterprise: true,
  },
  {
    category: "Security & Support",
    feature: "Custom integrations",
    free: false,
    premium: false,
    pro: false,
    business: true,
    enterprise: true,
  },
  {
    category: "Security & Support",
    feature: "SSO / SAML",
    free: false,
    premium: false,
    pro: false,
    business: false,
    enterprise: true,
  },
  {
    category: "Security & Support",
    feature: "Custom SLA",
    free: false,
    premium: false,
    pro: false,
    business: false,
    enterprise: true,
  },
];

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function FeatureValueDisplay({
  value,
}: {
  value: FeatureValue;
}) {
  if (value === true) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-500"
        aria-label="Included"
      >
        ✓
      </span>
    );
  }

  if (value === false) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-500/10 text-sm font-bold text-zinc-500"
        aria-label="Not included"
      >
        —
      </span>
    );
  }

  return (
    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {value}
    </span>
  );
}

export default function FeatureComparison({
  currentPlan = "free",
  onSelectPlan,
  className,
}: FeatureComparisonProps) {
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  const groupedFeatures = useMemo(() => {
    const filtered = features.filter((feature) => {
      if (!showOnlyDifferences) {
        return true;
      }

      const values = [
        feature.free,
        feature.premium,
        feature.pro,
        feature.business,
        feature.enterprise,
      ];

      return new Set(values.map((value) => String(value))).size > 1;
    });

    return filtered.reduce<Record<string, FeatureRow[]>>(
      (groups, feature) => {
        if (!groups[feature.category]) {
          groups[feature.category] = [];
        }

        groups[feature.category].push(feature);

        return groups;
      },
      {}
    );
  }, [showOnlyDifferences]);

  const handleSelectPlan = (plan: BillingPlan) => {
    if (plan === currentPlan) {
      return;
    }

    onSelectPlan?.(plan);
  };

  return (
    <section className={cn("w-full", className)}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            Compare plans
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
            Tüm özellikleri karşılaştır
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            SYRAVEN planlarını özellik, kullanım kapasitesi, agent gücü,
            knowledge altyapısı ve kurumsal yetenekler açısından detaylı
            şekilde karşılaştır.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-3 self-start rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 lg:self-auto">
          <input
            type="checkbox"
            checked={showOnlyDifferences}
            onChange={(event) =>
              setShowOnlyDifferences(event.target.checked)
            }
            className="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700 dark:accent-white"
          />

          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Sadece farklılıkları göster
          </span>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(150px,1fr))] border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-end p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    SYRAVEN
                  </p>

                  <h3 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                    Plan comparison
                  </h3>
                </div>
              </div>

              {plans.map((plan) => {
                const isCurrent = currentPlan === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative border-l border-zinc-200 p-5 dark:border-zinc-800",
                      plan.popular &&
                        "bg-zinc-50/80 dark:bg-zinc-900/50"
                    )}
                  >
                    {plan.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-950 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg dark:bg-white dark:text-zinc-950">
                        {plan.badge}
                      </span>
                    )}

                    <div className="min-h-[148px]">
                      <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                        {plan.name}
                      </h3>

                      <p className="mt-1 min-h-10 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {plan.description}
                      </p>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                          {plan.price}
                        </span>

                        {plan.period && (
                          <span className="text-xs text-zinc-500">
                            {plan.period}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCurrent}
                        className={cn(
                          "mt-4 inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-default dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-950",
                          isCurrent
                            ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            : plan.popular
                              ? "bg-zinc-950 text-white hover:scale-[1.02] hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                              : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
                        )}
                      >
                        {isCurrent
                          ? "Current plan"
                          : plan.id === "enterprise"
                            ? "Contact sales"
                            : "Choose plan"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.entries(groupedFeatures).map(
              ([category, categoryFeatures]) => (
                <React.Fragment key={category}>
                  <div className="grid grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(150px,1fr))] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {category}
                    </div>

                    {plans.map((plan) => (
                      <div
                        key={`${category}-${plan.id}`}
                        className="border-l border-zinc-200 dark:border-zinc-800"
                      />
                    ))}
                  </div>

                  {categoryFeatures.map((feature) => (
                    <div
                      key={`${category}-${feature.feature}`}
                      className="grid grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(150px,1fr))] border-b border-zinc-100 transition hover:bg-zinc-50/70 last:border-b-0 dark:border-zinc-900 dark:hover:bg-zinc-900/30"
                    >
                      <div className="px-6 py-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {feature.feature}
                        </div>

                        {feature.description && (
                          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-500">
                            {feature.description}
                          </div>
                        )}
                      </div>

                      {plans.map((plan) => {
                        const value = feature[plan.id];

                        return (
                          <div
                            key={`${feature.feature}-${plan.id}`}
                            className={cn(
                              "flex min-h-[72px] items-center justify-center border-l border-zinc-100 px-4 py-3 text-center dark:border-zinc-900",
                              currentPlan === plan.id &&
                                "bg-zinc-50/50 dark:bg-zinc-900/20"
                            )}
                          >
                            <FeatureValueDisplay value={value} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </React.Fragment>
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-zinc-950 dark:text-white">
              Daha büyük bir çözüm mü gerekiyor?
            </h3>

            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Enterprise plan ile özel limitler, gelişmiş güvenlik, SLA,
              özel entegrasyonlar ve kurumsal destek elde edin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleSelectPlan("enterprise")}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-950"
          >
            Enterprise ile konuş
          </button>
        </div>
      </div>
    </section>
  );
}