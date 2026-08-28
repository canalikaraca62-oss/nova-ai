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
  useSearchParams,
} from "next/navigation";

/* ==================================================
 * TYPES
 * ================================================== */

type SyncStatus =
  | "checking"
  | "success"
  | "pending"
  | "error";

type Plan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

type BillingResponse = {
  plan?: Plan;
  subscription_status?: string | null;
  status?: string | null;
};

/* ==================================================
 * PLAN CONFIG
 * ================================================== */

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  premium: "Premium",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

const PLAN_DESCRIPTIONS: Record<
  Plan,
  string
> = {
  free:
    "Your SYRAVEN workspace is ready to use.",

  premium:
    "Premium intelligence and expanded capabilities are now available.",

  pro:
    "Advanced AI, agents, workflows and higher limits are now available.",

  business:
    "Your business workspace is ready for collaborative AI workflows.",

  enterprise:
    "Your enterprise-level SYRAVEN environment is being activated.",
};

/* ==================================================
 * ICONS
 * ================================================== */

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6"
    >
      <path
        d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.7"
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
      className="h-5 w-5"
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

function WorkspaceIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M8 8h8M8 12h5M8 16h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <rect
        x="5"
        y="7"
        width="14"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M12 3v4M9 12h.01M15 12h.01M9 16h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ==================================================
 * HELPERS
 * ================================================== */

function normalizePlan(
  value: string | null | undefined
): Plan {
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

function getBillingStatus(
  value: string | null | undefined
) {
  const status =
    value
      ?.trim()
      .toLowerCase() ?? "";

  return status;
}

/* ==================================================
 * PAGE
 * ================================================== */

export default function BillingSuccessPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const sessionId =
    searchParams.get(
      "session_id"
    );

  const [
    syncStatus,
    setSyncStatus,
  ] =
    useState<SyncStatus>(
      "checking"
    );

  const [
    plan,
    setPlan,
  ] =
    useState<Plan>(
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
    isContinuing,
    setIsContinuing,
  ] =
    useState(false);

  /* ==================================================
   * LOAD BILLING STATUS
   *
   * Billing route hazır olduğunda
   * GET /api/billing üzerinden
   * güncel profile bilgisi okunur.
   * ================================================== */

  const syncBilling =
    useCallback(
      async () => {
        try {
          setSyncStatus(
            "checking"
          );

          const response =
            await fetch(
              "/api/billing",
              {
                method:
                  "GET",
                cache:
                  "no-store",
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
              "Billing status could not be loaded."
            );
          }

          const data:
            BillingResponse =
            await response.json();

          const nextPlan =
            normalizePlan(
              data.plan
            );

          const nextStatus =
            getBillingStatus(
              data.subscription_status ??
                data.status
            );

          setPlan(
            nextPlan
          );

          setSubscriptionStatus(
            nextStatus
          );

          /*
           * Stripe webhook bazen
           * success redirect'inden
           * birkaç saniye sonra gelir.
           *
           * Bu yüzden plan Free görünüyorsa
           * ekran hata vermeden pending kalır.
           */

          if (
            nextPlan === "free" &&
            sessionId
          ) {
            setSyncStatus(
              "pending"
            );

            return;
          }

          setSyncStatus(
            "success"
          );
        } catch (
          error
        ) {
          console.error(
            "SYRAVEN BILLING SUCCESS SYNC ERROR:",
            error
          );

          /*
           * Ödeme başarılı sayfasında
           * backend geçici olarak
           * cevap veremese bile kullanıcıyı
           * korkutmuyoruz.
           */

          setSyncStatus(
            "pending"
          );
        }
      },
      [
        sessionId,
      ]
    );

  /* ==================================================
   * INITIAL SYNC
   * ================================================== */

  useEffect(() => {
    void syncBilling();
  }, [
    syncBilling,
  ]);

  /* ==================================================
   * RETRY WEBHOOK SYNC
   *
   * Stripe webhook redirect'ten
   * sonra gelebileceği için kısa süreli
   * kontrollü tekrar deneme.
   * ================================================== */

  useEffect(() => {
    if (
      syncStatus !==
      "pending"
    ) {
      return;
    }

    let attempts =
      0;

    const maxAttempts =
      5;

    const interval =
      window.setInterval(
        () => {
          attempts +=
            1;

          void syncBilling();

          if (
            attempts >=
            maxAttempts
          ) {
            window.clearInterval(
              interval
            );
          }
        },
        2500
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    syncBilling,
    syncStatus,
  ]);

  /* ==================================================
   * CONTINUE
   * ================================================== */

  const handleContinue =
    useCallback(
      () => {
        if (
          isContinuing
        ) {
          return;
        }

        setIsContinuing(
          true
        );

        router.push(
          "/chat"
        );
      },
      [
        isContinuing,
        router,
      ]
    );

  /* ==================================================
   * UI DATA
   * ================================================== */

  const statusLabel =
    useMemo(
      () => {
        if (
          syncStatus ===
          "checking"
        ) {
          return "Verifying subscription";
        }

        if (
          syncStatus ===
          "pending"
        ) {
          return "Activating your workspace";
        }

        if (
          syncStatus ===
          "error"
        ) {
          return "Activation needs attention";
        }

        return "Subscription activated";
      },
      [
        syncStatus,
      ]
    );

  const subscriptionText =
    useMemo(
      () => {
        if (
          syncStatus ===
          "checking"
        ) {
          return "We are securely verifying your billing information.";
        }

        if (
          syncStatus ===
          "pending"
        ) {
          return "Your payment was completed. SYRAVEN is finalizing your subscription access.";
        }

        if (
          subscriptionStatus
        ) {
          return `Subscription status: ${subscriptionStatus}.`;
        }

        return "Your SYRAVEN plan is active and ready.";
      },
      [
        subscriptionStatus,
        syncStatus,
      ]
    );

  const activatedFeatures =
    useMemo(
      () => {
        const features =
          [
            "Advanced SYRAVEN intelligence",
            "Expanded workspace capabilities",
            "AI agents and intelligent workflows",
            "Priority access to premium tools",
          ];

        if (
          plan ===
          "business"
        ) {
          features.push(
            "Business collaboration and shared workflows"
          );
        }

        if (
          plan ===
          "enterprise"
        ) {
          features.push(
            "Enterprise controls and advanced organization features"
          );
        }

        return features;
      },
      [
        plan,
      ]
    );

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
            top-[-20rem]
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
            bottom-[-14rem]
            right-[-8rem]
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
              rgba(255,255,255,0.025)_1px,
              transparent_1px
            ),
            linear-gradient(
              to_bottom,
              rgba(255,255,255,0.025)_1px,
              transparent_1px
            )]
            bg-[size:56px_56px]
            [mask-image:linear-gradient(
              to_bottom,
              black,
              transparent_78%
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
          px-6
          py-6
          sm:px-8
        "
      >
        <Link
          href="/"
          className="
            group
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
              Intelligence Platform
            </div>
          </div>
        </Link>

        <div
          className="
            hidden
            items-center
            gap-2
            rounded-xl
            border
            border-white/10
            bg-white/[0.04]
            px-4
            py-2
            text-sm
            text-white/60
            sm:flex
          "
        >
          <ShieldIcon />

          Secure activation
        </div>
      </header>

      {/* CONTENT */}

      <section
        className="
          relative
          z-10
          mx-auto
          flex
          w-full
          max-w-7xl
          items-center
          px-6
          pb-20
          pt-8
          sm:px-8
          lg:min-h-[calc(100vh-88px)]
          lg:pb-28
          lg:pt-12
        "
      >
        <div
          className="
            grid
            w-full
            items-center
            gap-10
            lg:grid-cols-[1.1fr_0.9fr]
            lg:gap-16
          "
        >
          {/* LEFT */}

          <div
            className="
              mx-auto
              w-full
              max-w-2xl
              lg:mx-0
            "
          >
            <div
              className="
                mb-7
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-white/10
                bg-white/[0.045]
                px-3
                py-1.5
                text-xs
                font-medium
                text-white/60
              "
            >
              <span
                className="
                  flex
                  h-4
                  w-4
                  items-center
                  justify-center
                  rounded-full
                  bg-white/10
                  text-white
                "
              >
                {syncStatus ===
                "checking" ? (
                  <span
                    className="
                      h-2
                      w-2
                      animate-pulse
                      rounded-full
                      bg-white/70
                    "
                  />
                ) : (
                  <CheckIcon />
                )}
              </span>

              {statusLabel}
            </div>

            <h1
              className="
                max-w-3xl
                text-balance
                text-4xl
                font-semibold
                leading-[1.08]
                tracking-[-0.04em]
                text-white
                sm:text-5xl
                lg:text-6xl
              "
            >
              Welcome to the next level of SYRAVEN.
            </h1>

            <p
              className="
                mt-6
                max-w-xl
                text-pretty
                text-base
                leading-8
                text-white/55
                sm:text-lg
              "
            >
              {PLAN_DESCRIPTIONS[
                plan
              ]}
            </p>

            <p
              className="
                mt-3
                max-w-xl
                text-sm
                leading-7
                text-white/40
              "
            >
              {subscriptionText}
            </p>

            <div
              className="
                mt-10
                flex
                flex-col
                gap-3
                sm:flex-row
              "
            >
              <button
                type="button"
                onClick={
                  handleContinue
                }
                disabled={
                  isContinuing
                }
                className="
                  group
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-white
                  px-5
                  text-sm
                  font-semibold
                  text-black
                  transition
                  hover:bg-white/90
                  disabled:cursor-wait
                  disabled:opacity-70
                "
              >
                {isContinuing
                  ? "Opening SYRAVEN..."
                  : "Enter SYRAVEN"}

                {!isContinuing && (
                  <ArrowIcon />
                )}
              </button>

              <Link
                href="/billing"
                className="
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.035]
                  px-5
                  text-sm
                  font-medium
                  text-white/75
                  transition
                  hover:border-white/20
                  hover:bg-white/[0.07]
                  hover:text-white
                "
              >
                Manage billing
              </Link>
            </div>

            <div
              className="
                mt-10
                flex
                items-start
                gap-3
                rounded-2xl
                border
                border-white/[0.08]
                bg-white/[0.025]
                p-4
              "
            >
              <div
                className="
                  mt-0.5
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  text-white/70
                "
              >
                <ShieldIcon />
              </div>

              <div>
                <p
                  className="
                    text-sm
                    font-medium
                    text-white/85
                  "
                >
                  Your workspace remains yours
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    leading-6
                    text-white/45
                  "
                >
                  Your conversations, projects, knowledge,
                  agents and workspace data remain under your
                  account.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT */}

          <aside
            className="
              mx-auto
              w-full
              max-w-lg
              lg:mx-0
              lg:justify-self-end
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
                shadow-2xl
                shadow-black/40
              "
            >
              <div
                className="
                  absolute
                  inset-x-0
                  top-0
                  h-px
                  bg-gradient-to-r
                  from-transparent
                  via-white/20
                  to-transparent
                "
              />

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
                    items-start
                    justify-between
                    gap-4
                  "
                >
                  <div>
                    <p
                      className="
                        text-sm
                        font-medium
                        text-white/45
                      "
                    >
                      Activated plan
                    </p>

                    <h2
                      className="
                        mt-2
                        text-3xl
                        font-semibold
                        tracking-tight
                      "
                    >
                      {
                        PLAN_LABELS[
                          plan
                        ]
                      }
                    </h2>
                  </div>

                  <div
                    className="
                      flex
                      h-11
                      w-11
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.05]
                      text-white/80
                    "
                  >
                    <SparkIcon />
                  </div>
                </div>

                <div
                  className="
                    mt-7
                    space-y-3
                  "
                >
                  {activatedFeatures.map(
                    (
                      feature
                    ) => (
                      <div
                        key={
                          feature
                        }
                        className="
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          border
                          border-white/[0.07]
                          bg-white/[0.025]
                          px-4
                          py-3
                        "
                      >
                        <span
                          className="
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-white/10
                            bg-white/[0.05]
                            text-white/75
                          "
                        >
                          <CheckIcon />
                        </span>

                        <span
                          className="
                            text-sm
                            text-white/65
                          "
                        >
                          {feature}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div
                  className="
                    mt-7
                    grid
                    gap-3
                    border-t
                    border-white/[0.08]
                    pt-6
                    sm:grid-cols-2
                  "
                >
                  <Link
                    href="/workspace"
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-white/[0.025]
                      p-4
                      transition
                      hover:border-white/20
                      hover:bg-white/[0.06]
                    "
                  >
                    <span
                      className="
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-xl
                        bg-white/[0.05]
                        text-white/70
                      "
                    >
                      <WorkspaceIcon />
                    </span>

                    <span>
                      <span
                        className="
                          block
                          text-sm
                          font-medium
                          text-white/80
                        "
                      >
                        Workspace
                      </span>

                      <span
                        className="
                          mt-0.5
                          block
                          text-xs
                          text-white/40
                        "
                      >
                        Start building
                      </span>
                    </span>
                  </Link>

                  <Link
                    href="/agents"
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      border-white/[0.08]
                      bg-white/[0.025]
                      p-4
                      transition
                      hover:border-white/20
                      hover:bg-white/[0.06]
                    "
                  >
                    <span
                      className="
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-xl
                        bg-white/[0.05]
                        text-white/70
                      "
                    >
                      <AgentIcon />
                    </span>

                    <span>
                      <span
                        className="
                          block
                          text-sm
                          font-medium
                          text-white/80
                        "
                      >
                        Agents
                      </span>

                      <span
                        className="
                          mt-0.5
                          block
                          text-xs
                          text-white/40
                        "
                      >
                        Explore your AI team
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}