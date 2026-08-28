"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

/* ==================================================
 * TYPES
 * ================================================== */

type SyravenPlan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

type BillingStatus =
  | "loading"
  | "ready"
  | "error";

type BillingResponse = {
  plan?: string | null;
  subscription_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  usage?: {
    messages?: number | null;
    agents?: number | null;
    projects?: number | null;
    storage_bytes?: number | null;
  } | null;
};

type PlanConfig = {
  id: SyravenPlan;
  name: string;
  badge: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  featured?: boolean;
  features: string[];
};

/* ==================================================
 * PLAN CONFIG
 *
 * UI tarafındaki fiyatlar ve özellikler burada.
 * Gerçek checkout fiyatlandırması backend/Stripe
 * üzerinden doğrulanmalıdır.
 * ================================================== */

const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    badge: "Explore",
    description:
      "Experience the core SYRAVEN intelligence platform.",
    monthlyPrice: "€0",
    yearlyPrice: "€0",
    features: [
      "Core AI chat",
      "Basic workspace",
      "Limited agents",
      "Personal memory",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    badge: "Advanced",
    description:
      "More intelligence, more creation and more room to work.",
    monthlyPrice: "€19",
    yearlyPrice: "€190",
    features: [
      "Everything in Free",
      "Advanced AI models",
      "More agents and workflows",
      "Expanded memory",
      "Priority processing",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Power",
    description:
      "The complete SYRAVEN experience for serious creators and builders.",
    monthlyPrice: "€49",
    yearlyPrice: "€490",
    featured: true,
    features: [
      "Everything in Premium",
      "Premium AI access",
      "Advanced agents",
      "Deep research workflows",
      "Coding and creative tools",
      "Higher usage limits",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    badge: "Teams",
    description:
      "A powerful AI operating environment for ambitious teams.",
    monthlyPrice: "€99",
    yearlyPrice: "€990",
    features: [
      "Everything in Pro",
      "Team workspace",
      "Shared knowledge",
      "Team agents",
      "Advanced collaboration",
      "Business controls",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: "Scale",
    description:
      "Custom AI infrastructure, governance and enterprise capabilities.",
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    features: [
      "Everything in Business",
      "Enterprise controls",
      "Advanced security",
      "Custom integrations",
      "Organization management",
      "Dedicated support",
    ],
  },
];

/* ==================================================
 * HELPERS
 * ================================================== */

function normalizePlan(
  value: string | null | undefined
): SyravenPlan {
  switch (
    value
      ?.trim()
      .toLowerCase()
  ) {
    case "premium":
    case "plus":
      return "premium";

    case "pro":
    case "vip":
      return "pro";

    case "business":
      return "business";

    case "enterprise":
      return "enterprise";

    default:
      return "free";
  }
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatBytes(
  bytes: number | null | undefined
) {
  if (
    !bytes ||
    bytes <= 0
  ) {
    return "0 MB";
  }

  const mb =
    bytes / 1024 / 1024;

  if (
    mb >= 1024
  ) {
    return `${(
      mb / 1024
    ).toFixed(1)} GB`;
  }

  return `${mb.toFixed(
    mb >= 100 ? 0 : 1
  )} MB`;
}

/* ==================================================
 * ICONS
 * ================================================== */

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M7 15h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M20 11a8 8 0 0 0-14.9-4L3 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M3 4v5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M4 13a8 8 0 0 0 14.9 4L21 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M21 20v-5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ==================================================
 * PAGE
 * ================================================== */

export default function BillingPage() {
  const router =
    useRouter();

  const [
    billingStatus,
    setBillingStatus,
  ] =
    useState<BillingStatus>(
      "loading"
    );

  const [
    currentPlan,
    setCurrentPlan,
  ] =
    useState<SyravenPlan>(
      "free"
    );

  const [
    subscriptionStatus,
    setSubscriptionStatus,
  ] =
    useState<string>(
      ""
    );

  const [
    currentPeriodEnd,
    setCurrentPeriodEnd,
  ] =
    useState<string | null>(
      null
    );

  const [
    cancelAtPeriodEnd,
    setCancelAtPeriodEnd,
  ] =
    useState(false);

  const [
    usage,
    setUsage,
  ] =
    useState<
      NonNullable<
        BillingResponse["usage"]
      >
    >({});

  const [
    billingError,
    setBillingError,
  ] =
    useState<string>(
      ""
    );

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    activeAction,
    setActiveAction,
  ] =
    useState<string | null>(
      null
    );

  const [
    yearly,
    setYearly,
  ] =
    useState(false);

  /* ==================================================
   * LOAD BILLING
   * ================================================== */

  const loadBilling =
    useCallback(
      async (
        showRefreshState = false
      ) => {
        try {
          if (
            showRefreshState
          ) {
            setIsRefreshing(
              true
            );
          }

          setBillingStatus(
            "loading"
          );

          setBillingError(
            ""
          );

          const response =
            await fetch(
              "/api/billing",
              {
                method: "GET",
                cache: "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          if (
            !response.ok
          ) {
            throw new Error(
              "Unable to load billing information."
            );
          }

          const data:
            BillingResponse =
            await response.json();

          setCurrentPlan(
            normalizePlan(
              data.plan
            )
          );

          setSubscriptionStatus(
            data.subscription_status ??
              ""
          );

          setCurrentPeriodEnd(
            data.current_period_end ??
              null
          );

          setCancelAtPeriodEnd(
            Boolean(
              data.cancel_at_period_end
            )
          );

          setUsage(
            data.usage ??
              {}
          );

          setBillingStatus(
            "ready"
          );
        } catch (
          error
        ) {
          console.error(
            "SYRAVEN BILLING LOAD ERROR:",
            error
          );

          setBillingError(
            error instanceof Error
              ? error.message
              : "Unable to load billing information."
          );

          setBillingStatus(
            "error"
          );
        } finally {
          setIsRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadBilling();
  }, [
    loadBilling,
  ]);

  /* ==================================================
   * START CHECKOUT
   * ================================================== */

  const startCheckout =
    useCallback(
      async (
        plan: SyravenPlan
      ) => {
        if (
          activeAction
        ) {
          return;
        }

        if (
          plan === "enterprise"
        ) {
          router.push(
            "/contact?plan=enterprise"
          );

          return;
        }

        if (
          plan === "free"
        ) {
          return;
        }

        try {
          setActiveAction(
            `checkout-${plan}`
          );

          const response =
            await fetch(
              "/api/billing/checkout",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Accept:
                    "application/json",
                },
                body:
                  JSON.stringify({
                    plan,
                    interval:
                      yearly
                        ? "year"
                        : "month",
                  }),
              }
            );

          const data:
            {
              url?: string;
              error?: string;
            } =
            await response.json();

          if (
            !response.ok ||
            !data.url
          ) {
            throw new Error(
              data.error ??
                "Unable to start checkout."
            );
          }

          window.location.assign(
            data.url
          );
        } catch (
          error
        ) {
          console.error(
            "SYRAVEN CHECKOUT ERROR:",
            error
          );

          setBillingError(
            error instanceof Error
              ? error.message
              : "Unable to start checkout."
          );
        } finally {
          setActiveAction(
            null
          );
        }
      },
      [
        activeAction,
        router,
        yearly,
      ]
    );

  /* ==================================================
   * OPEN BILLING PORTAL
   * ================================================== */

  const openBillingPortal =
    useCallback(
      async () => {
        if (
          activeAction
        ) {
          return;
        }

        try {
          setActiveAction(
            "portal"
          );

          const response =
            await fetch(
              "/api/billing/portal",
              {
                method: "POST",
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          const data:
            {
              url?: string;
              error?: string;
            } =
            await response.json();

          if (
            !response.ok ||
            !data.url
          ) {
            throw new Error(
              data.error ??
                "Unable to open billing portal."
            );
          }

          window.location.assign(
            data.url
          );
        } catch (
          error
        ) {
          console.error(
            "SYRAVEN BILLING PORTAL ERROR:",
            error
          );

          setBillingError(
            error instanceof Error
              ? error.message
              : "Unable to open billing portal."
          );
        } finally {
          setActiveAction(
            null
          );
        }
      },
      [
        activeAction,
      ]
    );

  /* ==================================================
   * CURRENT PLAN
   * ================================================== */

  const currentPlanConfig =
    useMemo(
      () =>
        PLANS.find(
          (
            plan
          ) =>
            plan.id ===
            currentPlan
        ) ??
        PLANS[0],
      [
        currentPlan,
      ]
    );

  const statusLabel =
    useMemo(
      () => {
        if (
          billingStatus ===
          "loading"
        ) {
          return "Loading";
        }

        if (
          billingStatus ===
          "error"
        ) {
          return "Needs attention";
        }

        if (
          cancelAtPeriodEnd
        ) {
          return "Cancels at period end";
        }

        switch (
          subscriptionStatus
            .trim()
            .toLowerCase()
        ) {
          case "active":
            return "Active";

          case "trialing":
            return "Trial";

          case "past_due":
            return "Payment required";

          case "unpaid":
            return "Payment required";

          case "canceled":
          case "cancelled":
            return "Cancelled";

          default:
            return currentPlan ===
              "free"
              ? "Free"
              : "Active";
        }
      },
      [
        billingStatus,
        cancelAtPeriodEnd,
        currentPlan,
        subscriptionStatus,
      ]
    );

  const messagesUsage =
    usage.messages ??
    0;

  const agentsUsage =
    usage.agents ??
    0;

  const projectsUsage =
    usage.projects ??
    0;

  /* ==================================================
   * RENDER
   * ================================================== */

  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-zinc-950
        text-white
      "
    >
      {/* BACKGROUND */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
        "
      >
        <div
          className="
            absolute
            left-1/2
            top-[-22rem]
            h-[42rem]
            w-[42rem]
            -translate-x-1/2
            rounded-full
            bg-white/[0.035]
            blur-3xl
          "
        />

        <div
          className="
            absolute
            bottom-[-12rem]
            left-[-8rem]
            h-96
            w-96
            rounded-full
            bg-white/[0.025]
            blur-3xl
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-[linear-gradient(
              to_right,
              rgba(255,255,255,0.022)_1px,
              transparent_1px
            ),
            linear-gradient(
              to_bottom,
              rgba(255,255,255,0.022)_1px,
              transparent_1px
            )]
            bg-[size:56px_56px]
            [mask-image:linear-gradient(
              to_bottom,
              black,
              transparent_80%
            )]
          "
        />
      </div>

      {/* HEADER */}

      <header
        className="
          relative
          z-10
          mx-auto
          flex
          w-full
          max-w-7xl
          items-center
          justify-between
          px-5
          py-5
          sm:px-8
          sm:py-6
        "
      >
        <Link
          href="/"
          className="
            inline-flex
            items-center
            gap-3
            rounded-2xl
            outline-none
            transition
            hover:opacity-80
            focus-visible:ring-2
            focus-visible:ring-white/50
          "
        >
          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-white/10
              bg-white/[0.06]
              shadow-2xl
              shadow-black/30
            "
          >
            <SparkIcon />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                tracking-tight
              "
            >
              SYRAVEN
            </div>

            <div
              className="
                text-[10px]
                uppercase
                tracking-[0.22em]
                text-white/40
              "
            >
              Billing Center
            </div>
          </div>
        </Link>

        <Link
          href="/chat"
          className="
            hidden
            rounded-xl
            border
            border-white/10
            bg-white/[0.04]
            px-4
            py-2
            text-sm
            font-medium
            text-white/70
            transition
            hover:border-white/20
            hover:bg-white/[0.08]
            hover:text-white
            sm:inline-flex
          "
        >
          Return to SYRAVEN
        </Link>
      </header>

      {/* CONTENT */}

      <section
        className="
          relative
          z-10
          mx-auto
          w-full
          max-w-7xl
          px-5
          pb-20
          pt-6
          sm:px-8
          sm:pt-10
        "
      >
        {/* HERO */}

        <div
          className="
            flex
            flex-col
            justify-between
            gap-6
            border-b
            border-white/[0.08]
            pb-10
            lg:flex-row
            lg:items-end
          "
        >
          <div>
            <div
              className="
                mb-5
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-white/10
                bg-white/[0.04]
                px-3
                py-1.5
                text-xs
                font-medium
                text-white/55
              "
            >
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-white/60
                "
              />

              SYRAVEN Membership
            </div>

            <h1
              className="
                max-w-3xl
                text-4xl
                font-semibold
                tracking-[-0.04em]
                sm:text-5xl
                lg:text-6xl
              "
            >
              Your intelligence,
              <br />
              without limits.
            </h1>

            <p
              className="
                mt-5
                max-w-2xl
                text-base
                leading-8
                text-white/50
                sm:text-lg
              "
            >
              Manage your SYRAVEN plan, unlock more
              capabilities and scale your personal AI
              operating system when you are ready.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadBilling(
                true
              )
            }
            disabled={
              isRefreshing
            }
            className="
              inline-flex
              h-11
              items-center
              justify-center
              gap-2
              self-start
              rounded-xl
              border
              border-white/10
              bg-white/[0.035]
              px-4
              text-sm
              font-medium
              text-white/65
              transition
              hover:border-white/20
              hover:bg-white/[0.07]
              hover:text-white
              disabled:cursor-wait
              disabled:opacity-60
              lg:self-auto
            "
          >
            <span
              className={
                isRefreshing
                  ? "animate-spin"
                  : ""
              }
            >
              <RefreshIcon />
            </span>

            Refresh
          </button>
        </div>

        {/* ERROR */}

        {billingError && (
          <div
            className="
              mt-6
              flex
              items-start
              justify-between
              gap-4
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/[0.06]
              p-4
            "
          >
            <div>
              <p
                className="
                  text-sm
                  font-medium
                  text-red-100
                "
              >
                Billing needs attention
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  leading-6
                  text-red-100/60
                "
              >
                {billingError}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setBillingError(
                  ""
                )
              }
              className="
                shrink-0
                text-sm
                text-red-100/60
                transition
                hover:text-red-100
              "
            >
              Dismiss
            </button>
          </div>
        )}

        {/* CURRENT PLAN */}

        <div
          className="
            mt-10
            grid
            gap-5
            lg:grid-cols-[1.2fr_0.8fr]
          "
        >
          <div
            className="
              relative
              overflow-hidden
              rounded-[1.75rem]
              border
              border-white/10
              bg-white/[0.035]
              p-1
            "
          >
            <div
              className="
                rounded-[1.5rem]
                border
                border-white/[0.06]
                bg-black/20
                p-6
                sm:p-8
              "
            >
              <div
                className="
                  flex
                  flex-col
                  gap-6
                  sm:flex-row
                  sm:items-start
                  sm:justify-between
                "
              >
                <div>
                  <p
                    className="
                      text-sm
                      text-white/45
                    "
                  >
                    Current plan
                  </p>

                  <div
                    className="
                      mt-3
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <h2
                      className="
                        text-4xl
                        font-semibold
                        tracking-tight
                      "
                    >
                      {
                        currentPlanConfig.name
                      }
                    </h2>

                    <span
                      className="
                        rounded-full
                        border
                        border-white/10
                        bg-white/[0.05]
                        px-2.5
                        py-1
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.16em]
                        text-white/55
                      "
                    >
                      {
                        statusLabel
                      }
                    </span>
                  </div>

                  <p
                    className="
                      mt-3
                      max-w-xl
                      text-sm
                      leading-7
                      text-white/45
                    "
                  >
                    {
                      currentPlanConfig.description
                    }
                  </p>
                </div>

                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/[0.05]
                    text-white/75
                  "
                >
                  <SparkIcon />
                </div>
              </div>

              <div
                className="
                  mt-8
                  grid
                  gap-3
                  border-t
                  border-white/[0.08]
                  pt-6
                  sm:grid-cols-3
                "
              >
                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    Subscription
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      font-medium
                      text-white/75
                    "
                  >
                    {subscriptionStatus ||
                    currentPlan ===
                      "free"
                      ? subscriptionStatus ||
                        "Free plan"
                      : "Active"}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    Renewal
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      font-medium
                      text-white/75
                    "
                  >
                    {currentPlan ===
                    "free"
                      ? "Any time"
                      : formatDate(
                          currentPeriodEnd
                        )}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-[0.14em]
                      text-white/35
                    "
                  >
                    Billing
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      font-medium
                      text-white/75
                    "
                  >
                    {cancelAtPeriodEnd
                      ? "Cancelling"
                      : "Managed securely"}
                  </p>
                </div>
              </div>

              {currentPlan !==
                "free" && (
                <button
                  type="button"
                  onClick={
                    openBillingPortal
                  }
                  disabled={
                    activeAction !==
                      null
                  }
                  className="
                    mt-7
                    inline-flex
                    h-11
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.035]
                    px-4
                    text-sm
                    font-medium
                    text-white/70
                    transition
                    hover:border-white/20
                    hover:bg-white/[0.07]
                    hover:text-white
                    disabled:cursor-wait
                    disabled:opacity-60
                  "
                >
                  <CreditCardIcon />

                  {activeAction ===
                  "portal"
                    ? "Opening secure portal..."
                    : "Manage subscription"}
                </button>
              )}
            </div>
          </div>

          {/* USAGE */}

          <div
            className="
              rounded-[1.75rem]
              border
              border-white/10
              bg-white/[0.025]
              p-6
              sm:p-8
            "
          >
            <p
              className="
                text-sm
                font-medium
                text-white/45
              "
            >
              Workspace activity
            </p>

            <h2
              className="
                mt-2
                text-2xl
                font-semibold
                tracking-tight
              "
            >
              Your SYRAVEN usage
            </h2>

            <div
              className="
                mt-7
                space-y-5
              "
            >
              <div>
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    text-sm
                  "
                >
                  <span className="text-white/50">
                    Messages
                  </span>

                  <span className="text-white/80">
                    {messagesUsage}
                  </span>
                </div>

                <div
                  className="
                    mt-2
                    h-1.5
                    overflow-hidden
                    rounded-full
                    bg-white/[0.06]
                  "
                >
                  <div
                    className="
                      h-full
                      w-[45%]
                      rounded-full
                      bg-white/50
                    "
                  />
                </div>
              </div>

              <div>
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    text-sm
                  "
                >
                  <span className="text-white/50">
                    Agents
                  </span>

                  <span className="text-white/80">
                    {agentsUsage}
                  </span>
                </div>

                <div
                  className="
                    mt-2
                    h-1.5
                    overflow-hidden
                    rounded-full
                    bg-white/[0.06]
                  "
                >
                  <div
                    className="
                      h-full
                      w-[28%]
                      rounded-full
                      bg-white/50
                    "
                  />
                </div>
              </div>

              <div>
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    text-sm
                  "
                >
                  <span className="text-white/50">
                    Projects
                  </span>

                  <span className="text-white/80">
                    {projectsUsage}
                  </span>
                </div>

                <div
                  className="
                    mt-2
                    h-1.5
                    overflow-hidden
                    rounded-full
                    bg-white/[0.06]
                  "
                >
                  <div
                    className="
                      h-full
                      w-[35%]
                      rounded-full
                      bg-white/50
                    "
                  />
                </div>
              </div>

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-t
                  border-white/[0.08]
                  pt-5
                  text-sm
                "
              >
                <span className="text-white/50">
                  Storage used
                </span>

                <span className="font-medium text-white/80">
                  {formatBytes(
                    usage.storage_bytes
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PLANS HEADER */}

        <div
          className="
            mt-16
            flex
            flex-col
            justify-between
            gap-5
            sm:flex-row
            sm:items-end
          "
        >
          <div>
            <p
              className="
                text-sm
                text-white/40
              "
            >
              Choose your level
            </p>

            <h2
              className="
                mt-2
                text-3xl
                font-semibold
                tracking-tight
                sm:text-4xl
              "
            >
              Scale with your ambition.
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setYearly(
                (
                  previous
                ) =>
                  !previous
              )
            }
            className="
              inline-flex
              h-11
              items-center
              gap-1
              self-start
              rounded-xl
              border
              border-white/10
              bg-white/[0.035]
              p-1
              text-sm
              sm:self-auto
            "
          >
            <span
              className={
                !yearly
                  ? `
                    rounded-lg
                    bg-white
                    px-3
                    py-1.5
                    font-medium
                    text-black
                  `
                  : `
                    px-3
                    py-1.5
                    text-white/45
                  `
              }
            >
              Monthly
            </span>

            <span
              className={
                yearly
                  ? `
                    rounded-lg
                    bg-white
                    px-3
                    py-1.5
                    font-medium
                    text-black
                  `
                  : `
                    px-3
                    py-1.5
                    text-white/45
                  `
              }
            >
              Yearly
            </span>
          </button>
        </div>

        {/* PLANS */}

        <div
          className="
            mt-8
            grid
            gap-4
            md:grid-cols-2
            xl:grid-cols-5
          "
        >
          {PLANS.map(
            (
              plan
            ) => {
              const isCurrent =
                plan.id ===
                currentPlan;

              const isBusy =
                activeAction ===
                `checkout-${plan.id}`;

              const price =
                yearly
                  ? plan.yearlyPrice
                  : plan.monthlyPrice;

              return (
                <article
                  key={plan.id}
                  className={`
                    relative
                    flex
                    min-h-[560px]
                    flex-col
                    overflow-hidden
                    rounded-[1.5rem]
                    border
                    p-6
                    transition
                    ${
                      plan.featured
                        ? `
                          border-white/25
                          bg-white/[0.075]
                          shadow-2xl
                          shadow-black/30
                        `
                        : `
                          border-white/[0.09]
                          bg-white/[0.025]
                          hover:border-white/[0.16]
                          hover:bg-white/[0.04]
                        `
                    }
                  `}
                >
                  {plan.featured && (
                    <div
                      className="
                        absolute
                        inset-x-0
                        top-0
                        h-px
                        bg-gradient-to-r
                        from-transparent
                        via-white/60
                        to-transparent
                      "
                    />
                  )}

                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-3
                    "
                  >
                    <span
                      className="
                        rounded-full
                        border
                        border-white/10
                        bg-white/[0.05]
                        px-2.5
                        py-1
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.15em]
                        text-white/50
                      "
                    >
                      {plan.badge}
                    </span>

                    {isCurrent && (
                      <span
                        className="
                          rounded-full
                          bg-white
                          px-2.5
                          py-1
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-[0.12em]
                          text-black
                        "
                      >
                        Current
                      </span>
                    )}
                  </div>

                  <h3
                    className="
                      mt-6
                      text-2xl
                      font-semibold
                      tracking-tight
                    "
                  >
                    {plan.name}
                  </h3>

                  <p
                    className="
                      mt-3
                      min-h-[72px]
                      text-sm
                      leading-6
                      text-white/45
                    "
                  >
                    {
                      plan.description
                    }
                  </p>

                  <div
                    className="
                      mt-6
                      flex
                      items-end
                      gap-2
                    "
                  >
                    <span
                      className="
                        text-3xl
                        font-semibold
                        tracking-tight
                      "
                    >
                      {price}
                    </span>

                    {plan.id !==
                      "free" &&
                      plan.id !==
                        "enterprise" && (
                        <span
                          className="
                            mb-1
                            text-xs
                            text-white/35
                          "
                        >
                          / {yearly
                            ? "year"
                            : "month"}
                        </span>
                      )}
                  </div>

                  <div
                    className="
                      mt-7
                      space-y-3
                      border-t
                      border-white/[0.08]
                      pt-6
                    "
                  >
                    {plan.features.map(
                      (
                        feature
                      ) => (
                        <div
                          key={
                            feature
                          }
                          className="
                            flex
                            items-start
                            gap-2.5
                            text-sm
                            leading-5
                            text-white/60
                          "
                        >
                          <span
                            className="
                              mt-0.5
                              flex
                              h-5
                              w-5
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              border
                              border-white/10
                              bg-white/[0.04]
                              text-white/70
                            "
                          >
                            <CheckIcon />
                          </span>

                          {feature}
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-auto pt-8">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="
                          flex
                          h-11
                          w-full
                          cursor-default
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-white/10
                          bg-white/[0.05]
                          text-sm
                          font-medium
                          text-white/40
                        "
                      >
                        Current plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void startCheckout(
                            plan.id
                          )
                        }
                        disabled={
                          activeAction !==
                          null
                        }
                        className={`
                          group
                          flex
                          h-11
                          w-full
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          text-sm
                          font-semibold
                          transition
                          disabled:cursor-wait
                          disabled:opacity-60
                          ${
                            plan.featured
                              ? `
                                bg-white
                                text-black
                                hover:bg-white/90
                              `
                              : `
                                border
                                border-white/10
                                bg-white/[0.045]
                                text-white/75
                                hover:border-white/20
                                hover:bg-white/[0.08]
                                hover:text-white
                              `
                          }
                        `}
                      >
                        {isBusy
                          ? "Opening..."
                          : plan.id ===
                            "enterprise"
                            ? "Contact sales"
                            : currentPlan ===
                                "free"
                              ? "Choose plan"
                              : "Switch plan"}

                        {!isBusy && (
                          <ArrowIcon />
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </div>

        {/* TRUST */}

        <div
          className="
            mt-12
            grid
            gap-4
            border-t
            border-white/[0.08]
            pt-10
            md:grid-cols-3
          "
        >
          <div
            className="
              flex
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-white/10
                bg-white/[0.04]
                text-white/65
              "
            >
              <ShieldIcon />
            </div>

            <div>
              <p
                className="
                  text-sm
                  font-medium
                  text-white/80
                "
              >
                Secure billing
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  leading-6
                  text-white/40
                "
              >
                Payment and subscription management
                remain securely separated from your
                workspace data.
              </p>
            </div>
          </div>

          <div
            className="
              flex
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-white/10
                bg-white/[0.04]
                text-white/65
              "
            >
              <CreditCardIcon />
            </div>

            <div>
              <p
                className="
                  text-sm
                  font-medium
                  text-white/80
                "
              >
                Full control
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  leading-6
                  text-white/40
                "
              >
                Manage payment methods, invoices and
                subscription settings from your secure
                billing portal.
              </p>
            </div>
          </div>

          <div
            className="
              flex
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-white/10
                bg-white/[0.04]
                text-white/65
              "
            >
              <SparkIcon />
            </div>

            <div>
              <p
                className="
                  text-sm
                  font-medium
                  text-white/80
                "
              >
                Upgrade when ready
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  leading-6
                  text-white/40
                "
              >
                SYRAVEN grows with your workflow, from
                personal intelligence to enterprise-scale
                AI operations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}