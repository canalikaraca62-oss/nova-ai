"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  Crown,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";

type BillingCycle = "monthly" | "yearly";

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  icon: "sparkles" | "zap" | "crown";
  features: string[];
  cta: string;
  href: string;
}

const PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description:
      "Essential AI capabilities for individuals exploring the SYRAVEN ecosystem.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: "sparkles",
    features: [
      "Core AI workspace",
      "Basic research tools",
      "Limited AI generations",
      "Personal knowledge memory",
      "Community support",
    ],
    cta: "Get started",
    href: "/login",
  },
  {
    id: "pro",
    name: "Pro",
    description:
      "Advanced intelligence and automation for ambitious builders and professionals.",
    monthlyPrice: 29,
    yearlyPrice: 24,
    popular: true,
    icon: "zap",
    features: [
      "Everything in Starter",
      "Advanced AI agents",
      "Expanded knowledge memory",
      "Priority AI processing",
      "Automation workflows",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Start Pro",
    href: "/login",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "A scalable intelligence infrastructure for organizations building at global scale.",
    monthlyPrice: 99,
    yearlyPrice: 79,
    icon: "crown",
    features: [
      "Everything in Pro",
      "Unlimited workspaces",
      "Team collaboration",
      "Enterprise security",
      "Advanced permissions",
      "Custom AI workflows",
      "Dedicated support",
    ],
    cta: "Contact sales",
    href: "/contact",
  },
];

function PlanIcon({
  type,
  className,
}: {
  type: PricingPlan["icon"];
  className?: string;
}) {
  switch (type) {
    case "sparkles":
      return <Sparkles className={className} />;

    case "zap":
      return <Zap className={className} />;

    case "crown":
      return <Crown className={className} />;

    default:
      return <Sparkles className={className} />;
  }
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");

  function getPrice(plan: PricingPlan) {
    return billingCycle === "monthly"
      ? plan.monthlyPrice
      : plan.yearlyPrice;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            SYRAVEN Intelligence Platform
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Intelligence that scales
            <span className="block text-primary">
              with your ambition.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Choose the intelligence infrastructure that fits your
            workflow. Start simple, scale when you are ready, and
            unlock increasingly powerful SYRAVEN capabilities.
          </p>
        </section>

        {/* Billing toggle */}
        <section className="mt-10 flex justify-center">
          <div className="inline-flex rounded-2xl border border-border bg-card p-1.5">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs opacity-80">
                Save up to 20%
              </span>
            </button>
          </div>
        </section>

        {/* Pricing cards */}
        <section className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan) => {
            const price = getPrice(plan);

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border bg-card p-7 transition-all ${
                  plan.popular
                    ? "border-primary shadow-xl lg:-translate-y-2"
                    : "border-border hover:border-primary/30 hover:shadow-lg"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg">
                      Most popular
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <PlanIcon
                      type={plan.icon}
                      className="h-6 w-6"
                    />
                  </div>

                  {plan.popular && (
                    <Sparkles className="h-5 w-5 text-primary" />
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {plan.name}
                  </h2>

                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-7 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-foreground">
                    ${price}
                  </span>

                  {price > 0 ? (
                    <span className="pb-1 text-sm text-muted-foreground">
                      / month
                    </span>
                  ) : (
                    <span className="pb-1 text-sm text-muted-foreground">
                      forever
                    </span>
                  )}
                </div>

                {billingCycle === "yearly" &&
                  plan.yearlyPrice > 0 && (
                    <p className="mt-2 text-xs font-medium text-primary">
                      Billed annually
                    </p>
                  )}

                <div className="mt-7 border-t border-border pt-6">
                  <p className="text-sm font-semibold text-foreground">
                    Included capabilities
                  </p>

                  <ul className="mt-5 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-muted-foreground"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </span>

                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-8">
                  <Link
                    href={plan.href}
                    className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all ${
                      plan.popular
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    {plan.cta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        {/* Trust section */}
        <section className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <h3 className="mt-5 font-semibold text-foreground">
              Secure by design
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your workspace data and intelligence workflows are
              protected with enterprise-ready security principles.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>

            <h3 className="mt-5 font-semibold text-foreground">
              Scale instantly
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Move from personal intelligence workflows to
              organization-wide automation without rebuilding.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HelpCircle className="h-5 w-5" />
            </div>

            <h3 className="mt-5 font-semibold text-foreground">
              Flexible plans
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Upgrade, scale or adapt your plan as your workspace and
              intelligence requirements evolve.
            </p>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-12 rounded-3xl border border-primary/20 bg-primary/5 px-6 py-10 text-center sm:px-10">
          <Sparkles className="mx-auto h-7 w-7 text-primary" />

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Build without limits.
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Start with the tools you need today and unlock more
            intelligence as your ambitions grow.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start building
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}