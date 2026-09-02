"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Crown,
  HelpCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  getPricingPlans,
  getPlanPrice,
  getYearlyMonthlyEquivalent,
  getYearlySavings,
  getYearlySavingsPercentage,
  type BillingInterval,
  type Plan,
  type PlanId,
} from "@/lib/plans";

const pricingPlans = getPricingPlans();

const categoryLabels: Record<string, string> = {
  core: "Core",
  intelligence: "Intelligence",
  productivity: "Productivity",
  automation: "Automation",
  business: "Business",
  enterprise: "Enterprise",
  support: "Support",
};

function getPlanIcon(planId: PlanId) {
  switch (planId) {
    case "free":
      return Sparkles;

    case "starter":
      return Rocket;

    case "pro":
      return Crown;

    case "business":
      return Building2;

    case "enterprise":
      return ShieldCheck;

    default:
      return Zap;
  }
}

function formatLimit(value: number): string {
  if (value === -1) {
    return "Unlimited";
  }

  return value.toLocaleString("en-US");
}

function formatPrice(
  plan: Plan,
  interval: BillingInterval,
): string {
  if (plan.id === "enterprise") {
    return "Custom";
  }

  return `€${getPlanPrice(plan.id, interval).toLocaleString(
    "en-US",
  )}`;
}

function getPlanFeatures(plan: Plan): Plan["features"] {
  return plan.features.filter((feature) => feature.included);
}

function getFeatureLimitText(
  plan: Plan,
  featureId: string,
): string | null {
  switch (featureId) {
    case "chat":
      if (plan.limits.messagesPerMonth === -1) {
        return "Unlimited messages";
      }

      return `${formatLimit(
        plan.limits.messagesPerMonth,
      )} messages / month`;

    case "memory":
      if (plan.limits.memoryItems === -1) {
        return "Unlimited memory";
      }

      return `${formatLimit(
        plan.limits.memoryItems,
      )} memory items`;

    case "voice":
      if (plan.limits.voiceMinutesPerMonth === -1) {
        return "Unlimited voice";
      }

      return `${formatLimit(
        plan.limits.voiceMinutesPerMonth,
      )} minutes / month`;

    case "file-analysis":
      if (plan.limits.fileUploadsPerMonth === -1) {
        return "Unlimited uploads";
      }

      return `${formatLimit(
        plan.limits.fileUploadsPerMonth,
      )} uploads / month`;

    case "vision":
      if (plan.limits.visionRequestsPerMonth === -1) {
        return "Unlimited requests";
      }

      return `${formatLimit(
        plan.limits.visionRequestsPerMonth,
      )} requests / month`;

    case "deep-research":
      if (plan.limits.deepResearchPerMonth === -1) {
        return "Unlimited research";
      }

      return `${formatLimit(
        plan.limits.deepResearchPerMonth,
      )} research runs / month`;

    case "projects":
      if (plan.limits.projects === -1) {
        return "Unlimited projects";
      }

      return `${formatLimit(
        plan.limits.projects,
      )} projects`;

    case "tasks":
      if (plan.limits.tasksPerMonth === -1) {
        return "Unlimited tasks";
      }

      return `${formatLimit(
        plan.limits.tasksPerMonth,
      )} tasks / month`;

    case "automations":
      if (plan.limits.automations === -1) {
        return "Unlimited automations";
      }

      return `${formatLimit(
        plan.limits.automations,
      )} automations`;

    case "agents":
      if (plan.limits.agents === -1) {
        return "Unlimited agents";
      }

      return `${formatLimit(
        plan.limits.agents,
      )} AI agents`;

    case "api":
      if (plan.limits.apiRequestsPerMonth === -1) {
        return "Unlimited API requests";
      }

      return `${formatLimit(
        plan.limits.apiRequestsPerMonth,
      )} API requests / month`;

    case "team":
      if (plan.limits.teamMembers === -1) {
        return "Unlimited members";
      }

      return `${formatLimit(
        plan.limits.teamMembers,
      )} team members`;

    default:
      return null;
  }
}

function PlanCard({
  plan,
  interval,
}: {
  plan: Plan;
  interval: BillingInterval;
}) {
  const Icon = getPlanIcon(plan.id);

  const isTrial = plan.id === "free";
  const isPopular = plan.id === "pro";
  const isEnterprise = plan.id === "enterprise";

  const yearlySavings = getYearlySavings(plan.id);
  const yearlySavingsPercentage =
    getYearlySavingsPercentage(plan.id);

  const yearlyEquivalent =
    getYearlyMonthlyEquivalent(plan.id);

  const features = getPlanFeatures(plan);

  const ctaHref =
    isEnterprise
      ? "/contact"
      : isTrial
        ? "/signup"
        : `/login?plan=${plan.id}&interval=${interval}`;

  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm transition-all duration-200",
        isPopular
          ? "border-zinc-950 shadow-xl shadow-zinc-950/10 md:-translate-y-2"
          : "border-zinc-200 hover:-translate-y-1 hover:shadow-lg",
      ].join(" ")}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
            Most Popular
          </div>
        </div>
      )}

      {isTrial && (
        <div className="absolute -top-4 left-6">
          <div className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-950 ring-1 ring-zinc-200">
            14 Days Full Access
          </div>
        </div>
      )}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100">
            <Icon className="h-5 w-5 text-zinc-900" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-zinc-950">
            {plan.name}
          </h2>

          <p className="mt-2 min-h-[48px] text-sm leading-6 text-zinc-500">
            {plan.description}
          </p>
        </div>

        {plan.badge && !isPopular && !isTrial && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {plan.badge}
          </span>
        )}
      </div>

      <div className="mb-6">
        {isEnterprise ? (
          <div>
            <div className="text-3xl font-black tracking-tight text-zinc-950">
              Custom
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              Tailored to your organization
            </p>
          </div>
        ) : isTrial ? (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-zinc-950">
                €0
              </span>

              <span className="text-sm font-medium text-zinc-500">
                / first 14 days
              </span>
            </div>

            <p className="mt-2 text-sm font-medium text-zinc-600">
              Then continue on Free with limited features.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-zinc-950">
                {formatPrice(plan, interval)}
              </span>

              <span className="text-sm font-medium text-zinc-500">
                / {interval === "yearly" ? "year" : "month"}
              </span>
            </div>

            {interval === "yearly" &&
              yearlyEquivalent > 0 && (
                <p className="mt-2 text-sm text-zinc-500">
                  ≈ €{yearlyEquivalent.toFixed(2)} / month
                </p>
              )}

            {interval === "yearly" &&
              yearlySavings > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">
                  Save €{yearlySavings.toLocaleString("en-US")} / year
                  {yearlySavingsPercentage > 0 && (
                    <span>
                      ({yearlySavingsPercentage}%)
                    </span>
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      <Link
        href={ctaHref}
        className={[
          "mb-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition",
          isPopular
            ? "bg-zinc-950 text-white hover:bg-zinc-800"
            : isTrial
              ? "bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
              : "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50",
        ].join(" ")}
      >
        {plan.cta}

        <ArrowRight className="h-4 w-4" />
      </Link>

      <div className="mb-6 border-t border-zinc-100 pt-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          What&apos;s included
        </p>

        <ul className="space-y-3">
          {features.map((feature) => {
            const limitText = getFeatureLimitText(
              plan,
              feature.id,
            );

            return (
              <li
                key={feature.id}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                  <Check className="h-3.5 w-3.5 text-zinc-900" />
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800">
                    {feature.name}
                  </p>

                  {limitText && (
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {limitText}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto rounded-2xl bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Best for
        </p>

        <p className="mt-1 text-sm leading-5 text-zinc-700">
          {plan.audience}
        </p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [interval, setInterval] =
    useState<BillingInterval>("monthly");

  return (
    <main className="min-h-screen bg-[#fafafa] text-zinc-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-20 lg:px-8 lg:pb-20 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700">
              <Sparkles className="h-4 w-4" />
              14-day full-access launch trial
            </div>

            <h1 className="text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
              Choose the NOVA
              <span className="block">
                experience that fits you.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-500 sm:text-lg">
              Start with 14 days of full NOVA access.
              After your trial, you automatically continue
              on the permanent Free plan with limited
              features — or upgrade whenever you want.
            </p>
          </div>

          {/* Trial banner */}
          <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-950/10 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <Zap className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold">
                    14 days. Full NOVA experience.
                  </h2>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-300">
                    Explore advanced chat, memory, voice,
                    file analysis, research, agents,
                    automation and more before choosing
                    a paid plan.
                  </p>
                </div>
              </div>

              <Link
                href="/signup"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 transition hover:bg-zinc-100"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-[1600px] px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-10 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
              Pricing
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              Simple plans. Clear limits.
            </h2>
          </div>

          {/* Billing toggle */}
          <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={[
                "rounded-xl px-5 py-2.5 text-sm font-bold transition",
                interval === "monthly"
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:text-zinc-950",
              ].join(" ")}
              aria-pressed={interval === "monthly"}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setInterval("yearly")}
              className={[
                "rounded-xl px-5 py-2.5 text-sm font-bold transition",
                interval === "yearly"
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:text-zinc-950",
              ].join(" ")}
              aria-pressed={interval === "yearly"}
            >
              Yearly
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700">
                Save
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {pricingPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              interval={interval}
            />
          ))}
        </div>
      </section>

      {/* Feature categories */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
              NOVA Platform
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950">
              Everything organized by capability.
            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-500 sm:text-base">
              Your plan controls the amount of access,
              capacity and advanced capabilities available
              to your account.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "💬",
                title: "Core",
                description:
                  "Chat, memory, voice and file intelligence.",
              },
              {
                icon: "🔎",
                title: "Intelligence",
                description:
                  "Vision, advanced reasoning and deep research.",
              },
              {
                icon: "⚡",
                title: "Productivity",
                description:
                  "Projects, tasks and intelligent workflows.",
              },
              {
                icon: "🤖",
                title: "Automation",
                description:
                  "Agents, automations and AI-powered execution.",
              },
              {
                icon: "👥",
                title: "Business",
                description:
                  "Team collaboration and developer capabilities.",
              },
              {
                icon: "🏢",
                title: "Enterprise",
                description:
                  "Security, SSO, compliance and custom deployment.",
              },
              {
                icon: "🛟",
                title: "Support",
                description:
                  "Support levels designed for every stage.",
              },
              {
                icon: "✨",
                title: "Full Trial",
                description:
                  "14 days to experience the full NOVA platform.",
              },
            ].map((category) => (
              <div
                key={category.title}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
              >
                <div className="text-2xl">
                  {category.icon}
                </div>

                <h3 className="mt-4 font-bold text-zinc-950">
                  {category.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {category.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free plan explanation */}
      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100">
              <HelpCircle className="h-5 w-5 text-zinc-900" />
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-950">
                What happens after 14 days?
              </h2>

              <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-600">
                <p>
                  You are <strong className="text-zinc-950">not automatically charged</strong>.
                  Your account simply returns to the permanent
                  Free plan.
                </p>

                <p>
                  The Free plan keeps NOVA useful with
                  limited messages, storage, research,
                  agents, automations and other capabilities.
                </p>

                <p>
                  Whenever you need more capacity or
                  advanced features, you can upgrade to
                  Starter, Pro, Business or Enterprise.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <ShieldCheck className="mx-auto h-6 w-6 text-zinc-700" />

              <h3 className="mt-3 font-bold text-zinc-950">
                No automatic charge
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Your trial does not automatically
                convert into a paid subscription.
              </p>
            </div>

            <div className="text-center">
              <Sparkles className="mx-auto h-6 w-6 text-zinc-700" />

              <h3 className="mt-3 font-bold text-zinc-950">
                Full access for 14 days
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Experience the core NOVA platform
                before deciding.
              </p>
            </div>

            <div className="text-center">
              <Check className="mx-auto h-6 w-6 text-zinc-700" />

              <h3 className="mt-3 font-bold text-zinc-950">
                Stay free if you want
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                After the trial, continue with
                limited Free access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-zinc-950">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">
          <Sparkles className="mx-auto h-8 w-8 text-white" />

          <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Experience NOVA before you decide.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            Start your 14-day full-access trial today.
            No automatic payment. After the trial,
            your account continues on Free unless you
            choose a paid plan.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-zinc-950 transition hover:bg-zinc-100"
            >
              Start 14-Day Full Trial
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Talk to Sales
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <footer className="border-t border-white/10 bg-zinc-950 px-6 pb-10 text-center">
        <p className="text-xs text-zinc-500">
          NOVA pricing is subject to change. Enterprise
          pricing is customized according to requirements.
        </p>
      </footer>
    </main>
  );
}