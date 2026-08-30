"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CancelReason =
  | "cancelled"
  | "abandoned"
  | "expired"
  | "payment_failed"
  | "unknown";

const FEATURES = [
  "AI agents and automation workflows",
  "Advanced workspace capabilities",
  "Premium AI models and tools",
  "Secure billing and subscription management",
];

function getCancelReason(): CancelReason {
  if (typeof window === "undefined") {
    return "cancelled";
  }

  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason")?.trim().toLowerCase();

  switch (reason) {
    case "abandoned":
      return "abandoned";

    case "expired":
      return "expired";

    case "payment_failed":
      return "payment_failed";

    case "cancelled":
    case "canceled":
      return "cancelled";

    default:
      return "unknown";
  }
}

function getCopy(reason: CancelReason) {
  switch (reason) {
    case "abandoned":
      return {
        eyebrow: "Checkout paused",
        title: "Your checkout was not completed.",
        description:
          "No subscription changes were made. You can safely return and continue whenever you are ready.",
      };

    case "expired":
      return {
        eyebrow: "Checkout expired",
        title: "Your checkout session expired.",
        description:
          "Nothing was charged. Start a new secure checkout session whenever you want to continue.",
      };

    case "payment_failed":
      return {
        eyebrow: "Payment needs attention",
        title: "We could not complete the payment.",
        description:
          "No successful subscription was created. You can try again or update your payment method.",
      };

    case "cancelled":
      return {
        eyebrow: "Checkout cancelled",
        title: "You cancelled the checkout.",
        description:
          "That is completely okay. Your current account and workspace remain available according to your existing plan.",
      };

    default:
      return {
        eyebrow: "Checkout not completed",
        title: "Your subscription was not changed.",
        description:
          "The checkout process did not finish, so no new subscription was activated.",
      };
  }
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
        strokeWidth="2.25"
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

export default function BillingCancelPage() {
  const router = useRouter();

  const [reason, setReason] = useState<CancelReason>("unknown");
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    setReason(getCancelReason());
  }, []);

  const copy = getCopy(reason);

  const handleReturnToBilling = useCallback(() => {
    if (isReturning) {
      return;
    }

    setIsReturning(true);
    router.push("/pricing");
  }, [isReturning, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-[-20rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-white/[0.035] blur-3xl" />

        <div className="absolute left-[-10rem] top-1/3 h-80 w-80 rounded-full bg-white/[0.025] blur-3xl" />

        <div className="absolute bottom-[-14rem] right-[-8rem] h-96 w-96 rounded-full bg-white/[0.025] blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 rounded-2xl outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30">
            <SparkIcon />
          </div>

          <div>
            <div className="text-sm font-semibold tracking-tight">
              SYRAVEN
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
              Intelligence Platform
            </div>
          </div>
        </Link>

        <Link
          href="/pricing"
          className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white sm:inline-flex"
        >
          View plans
        </Link>
      </header>

      {/* Content */}
      <section className="relative z-10 mx-auto flex w-full max-w-7xl items-center px-6 pb-20 pt-8 sm:px-8 lg:min-h-[calc(100vh-88px)] lg:pb-28 lg:pt-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          {/* Left */}
          <div className="mx-auto w-full max-w-2xl lg:mx-0">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-medium text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
              {copy.eyebrow}
            </div>

            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              {copy.title}
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-white/55 sm:text-lg">
              {copy.description}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleReturnToBilling}
                disabled={isReturning}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-70"
              >
                {isReturning
                  ? "Opening plans..."
                  : "Continue to plans"}

                {!isReturning && <ArrowIcon />}
              </button>

              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              >
                Return to workspace
              </Link>
            </div>

            <div className="mt-10 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
                <ShieldIcon />
              </div>

              <div>
                <p className="text-sm font-medium text-white/85">
                  Your account is safe
                </p>

                <p className="mt-1 text-sm leading-6 text-white/45">
                  Cancelling checkout does not delete your workspace, projects,
                  conversations, or existing account data.
                </p>
              </div>
            </div>
          </div>

          {/* Right */}
          <aside className="mx-auto w-full max-w-lg lg:mx-0 lg:justify-self-end">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-1 shadow-2xl shadow-black/40">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="rounded-[1.5rem] border border-white/[0.06] bg-black/20 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/45">
                      Why upgrade?
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                      Come back when it makes sense.
                    </h2>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/80">
                    <SparkIcon />
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-white/50">
                  There is no pressure to upgrade. When your workflow grows,
                  your plan can grow with it.
                </p>

                <div className="mt-7 space-y-3">
                  {FEATURES.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/75">
                        <CheckIcon />
                      </span>

                      <span className="text-sm text-white/65">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 border-t border-white/[0.08] pt-6">
                  <p className="text-xs leading-6 text-white/35">
                    You can review available plans, features, and billing
                    options at any time before starting a new checkout.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}