"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

export type BillingPlan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

type PlanConfig = {
  name: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  description: string;
  features: string[];
  accent: string;
};

export type UpgradeModalProps = {
  open: boolean;

  currentPlan?: BillingPlan;

  defaultPlan?: BillingPlan;

  plans?: BillingPlan[];

  loading?: boolean;

  title?: string;

  description?: string;

  onClose: () => void;

  onUpgrade?: (
    plan: BillingPlan,
    interval: "month" | "year"
  ) => void | Promise<void>;

  onContactSales?: () => void;

  className?: string;
};

/* =========================================================
   PLAN CONFIGURATION
========================================================= */

const PLAN_CONFIG: Record<
  BillingPlan,
  PlanConfig
> = {
  free: {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description:
      "Temel SYRAVEN deneyimi.",
    features: [
      "Temel AI chat",
      "3 aktif agent",
      "Temel knowledge storage",
    ],
    accent: "Free",
  },

  premium: {
    name: "Premium",
    monthlyPrice: 19,
    yearlyPrice: 190,
    description:
      "Daha fazla AI gücü ve gelişmiş üretkenlik.",
    features: [
      "Premium AI modelleri",
      "10 aktif agent",
      "10 GB knowledge storage",
      "Voice features",
      "AI Canvas",
    ],
    accent: "Most popular",
  },

  pro: {
    name: "Pro",
    monthlyPrice: 49,
    yearlyPrice: 490,
    description:
      "Profesyoneller için yüksek performans.",
    features: [
      "Advanced AI reasoning",
      "50 aktif agent",
      "100 GB knowledge storage",
      "Multi-step workflows",
      "API access",
      "Priority support",
    ],
    accent: "Professional",
  },

  business: {
    name: "Business",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    description:
      "Ekipler ve büyüyen organizasyonlar için.",
    features: [
      "Unlimited agents",
      "1 TB knowledge storage",
      "Team collaboration",
      "Shared knowledge",
      "Advanced analytics",
      "Custom integrations",
    ],
    accent: "Teams",
  },

  enterprise: {
    name: "Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    description:
      "Kurumsal ölçek için özel altyapı ve güvenlik.",
    features: [
      "Custom infrastructure",
      "Enterprise security",
      "SSO / SAML",
      "Custom integrations",
      "Dedicated support",
      "Custom SLA",
    ],
    accent: "Custom",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function formatPrice(
  amount: number
) {
  try {
    return new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }
    ).format(amount);
  } catch {
    return `€${amount}`;
  }
}

function cn(
  ...classes: Array<
    string | undefined | null | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

/* =========================================================
   COMPONENT
========================================================= */

export default function UpgradeModal({
  open,

  currentPlan = "free",

  defaultPlan = "premium",

  plans = [
    "premium",
    "pro",
    "business",
    "enterprise",
  ],

  loading = false,

  title = "Upgrade your workspace",

  description =
    "Unlock more AI power, agents, knowledge capacity and advanced features.",

  onClose,

  onUpgrade,

  onContactSales,

  className,
}: UpgradeModalProps) {
  const [
    selectedPlan,
    setSelectedPlan,
  ] = useState<BillingPlan>(
    defaultPlan
  );

  const [
    interval,
    setInterval,
  ] = useState<
    "month" | "year"
  >("month");

  const [
    internalLoading,
    setInternalLoading,
  ] = useState(false);

  const isLoading =
    loading || internalLoading;

  /* =====================================================
     RESET SELECTED PLAN
  ===================================================== */

  useEffect(() => {
    if (open) {
      setSelectedPlan(
        plans.includes(defaultPlan)
          ? defaultPlan
          : plans[0] ??
              "premium"
      );
    }
  }, [
    open,
    defaultPlan,
    plans,
  ]);

  /* =====================================================
     ESCAPE
  ===================================================== */

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !isLoading
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    isLoading,
    onClose,
  ]);

  /* =====================================================
     LOCK BODY SCROLL
  ===================================================== */

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  /* =====================================================
     PLAN DATA
  ===================================================== */

  const selectedConfig =
    PLAN_CONFIG[selectedPlan];

  const currentConfig =
    PLAN_CONFIG[currentPlan];

  const price =
    interval === "year"
      ? selectedConfig.yearlyPrice
      : selectedConfig.monthlyPrice;

  const monthlyEquivalent =
    interval === "year" &&
    typeof price === "number"
      ? price / 12
      : null;

  const yearlySavings =
    typeof selectedConfig.monthlyPrice ===
      "number" &&
    typeof selectedConfig.yearlyPrice ===
      "number"
      ? selectedConfig.monthlyPrice *
          12 -
        selectedConfig.yearlyPrice
      : 0;

  const buttonLabel =
    selectedPlan === "enterprise"
      ? "Contact sales"
      : currentPlan === selectedPlan
        ? "Current plan"
        : isLoading
          ? "Processing..."
          : `Upgrade to ${selectedConfig.name}`;

  const selectedFeatures =
    useMemo(
      () =>
        selectedConfig.features,
      [selectedConfig]
    );

  /* =====================================================
     CLOSE
  ===================================================== */

  const handleBackdropClick = (
    event: React.MouseEvent<
      HTMLDivElement
    >
  ) => {
    if (
      event.target ===
        event.currentTarget &&
      !isLoading
    ) {
      onClose();
    }
  };

  /* =====================================================
     UPGRADE
  ===================================================== */

  const handleUpgrade =
    async () => {
      if (
        isLoading ||
        selectedPlan === currentPlan
      ) {
        return;
      }

      if (
        selectedPlan ===
        "enterprise"
      ) {
        onContactSales?.();
        return;
      }

      if (!onUpgrade) {
        return;
      }

      try {
        setInternalLoading(true);

        await onUpgrade(
          selectedPlan,
          interval
        );
      } finally {
        setInternalLoading(false);
      }
    };

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onMouseDown={
        handleBackdropClick
      }
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm",
        className
      )}
    >
      <div
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        className="relative my-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        {/* ===============================================
            HEADER
        =============================================== */}

        <div className="flex items-start justify-between gap-6 border-b border-zinc-200 px-6 py-6 dark:border-zinc-800 sm:px-8">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              SYRAVEN Intelligence
            </div>

            <h2
              id="upgrade-modal-title"
              className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl"
            >
              {title}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close upgrade modal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            ×
          </button>
        </div>

        {/* ===============================================
            CONTENT
        =============================================== */}

        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          {/* =============================================
              LEFT
          ============================================= */}

          <div className="border-b border-zinc-200 p-6 dark:border-zinc-800 lg:border-b-0 lg:border-r sm:p-8">
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Choose your plan
                </p>

                <h3 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-white">
                  Scale your AI workspace
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => {
                  const config =
                    PLAN_CONFIG[plan];

                  const isSelected =
                    selectedPlan ===
                    plan;

                  const isCurrent =
                    currentPlan ===
                    plan;

                  return (
                    <button
                      key={plan}
                      type="button"
                      onClick={() =>
                        setSelectedPlan(
                          plan
                        )
                      }
                      disabled={
                        isLoading
                      }
                      className={cn(
                        "relative rounded-2xl border p-5 text-left transition-all",
                        isSelected
                          ? "border-zinc-950 bg-zinc-950 text-white shadow-xl dark:border-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
                        isCurrent &&
                          !isSelected &&
                          "opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={cn(
                              "text-base font-bold",
                              isSelected
                                ? "text-current"
                                : ""
                            )}
                          >
                            {
                              config.name
                            }
                          </p>

                          <p
                            className={cn(
                              "mt-1 text-xs leading-5",
                              isSelected
                                ? "text-zinc-300 dark:text-zinc-600"
                                : "text-zinc-500 dark:text-zinc-400"
                            )}
                          >
                            {
                              config.description
                            }
                          </p>
                        </div>

                        {isCurrent && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider",
                              isSelected
                                ? "bg-white/15 text-white dark:bg-black/10 dark:text-zinc-950"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            Current
                          </span>
                        )}
                      </div>

                      <div className="mt-4">
                        {config.monthlyPrice ===
                        null ? (
                          <span className="text-lg font-bold">
                            Custom
                          </span>
                        ) : (
                          <span className="text-lg font-bold">
                            {formatPrice(
                              interval ===
                                "year"
                                ? config.yearlyPrice ??
                                    0
                                : config.monthlyPrice
                            )}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* =========================================
                  BILLING TOGGLE
              ========================================= */}

              {selectedPlan !==
                "enterprise" && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInterval(
                          "month"
                        )
                      }
                      disabled={
                        isLoading
                      }
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm font-semibold transition",
                        interval ===
                          "month"
                          ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      )}
                    >
                      Monthly
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setInterval(
                          "year"
                        )
                      }
                      disabled={
                        isLoading
                      }
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm font-semibold transition",
                        interval ===
                          "year"
                          ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      )}
                    >
                      <span>
                        Yearly
                      </span>

                      {yearlySavings >
                        0 && (
                        <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Save{" "}
                          {formatPrice(
                            yearlySavings
                          )}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* =========================================
                  CURRENT PLAN
              ========================================= */}

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Current workspace
                </p>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-zinc-950 dark:text-white">
                      {
                        currentConfig.name
                      }{" "}
                      plan
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Upgrade anytime as
                      your workspace grows.
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =============================================
              RIGHT
          ============================================= */}

          <div className="flex flex-col p-6 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                Selected plan
              </p>

              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {
                      selectedConfig.name
                    }
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {
                      selectedConfig.description
                    }
                  </p>
                </div>

                <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  {
                    selectedConfig.accent
                  }
                </span>
              </div>

              {/* =========================================
                  PRICE
              ========================================= */}

              <div className="mt-7 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
                {selectedPlan ===
                "enterprise" ? (
                  <>
                    <p className="text-sm text-zinc-500">
                      Pricing
                    </p>

                    <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                      Custom
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Our team can design
                      a dedicated SYRAVEN
                      deployment around your
                      organization.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-zinc-500">
                      {
                        interval ===
                        "year"
                          ? "Billed annually"
                          : "Billed monthly"
                      }
                    </p>

                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                        {price !== null
                          ? formatPrice(
                              price
                            )
                          : "Custom"}
                      </span>

                      <span className="pb-1 text-sm text-zinc-500">
                        /
                        {interval ===
                        "year"
                          ? "year"
                          : "month"}
                      </span>
                    </div>

                    {monthlyEquivalent !==
                      null && (
                      <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                        Equivalent to{" "}
                        {formatPrice(
                          Math.round(
                            monthlyEquivalent
                          )
                        )}{" "}
                        per month.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* =========================================
                  FEATURES
              ========================================= */}

              <div className="mt-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                  What you unlock
                </p>

                <ul className="mt-4 space-y-3">
                  {selectedFeatures.map(
                    (
                      feature
                    ) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ✓
                        </span>

                        <span className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                          {feature}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>

            {/* =============================================
                ACTIONS
            ============================================= */}

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={
                  handleUpgrade
                }
                disabled={
                  isLoading ||
                  selectedPlan ===
                    currentPlan
                }
                className={cn(
                  "inline-flex min-h-14 w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-zinc-600 dark:focus:ring-offset-zinc-950",
                  selectedPlan ===
                  currentPlan
                    ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    : "bg-zinc-950 text-white hover:scale-[1.01] hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
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

              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Maybe later
              </button>

              <p className="px-2 text-center text-[11px] leading-5 text-zinc-500">
                Secure billing. You can manage or
                cancel your subscription from your
                billing settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}