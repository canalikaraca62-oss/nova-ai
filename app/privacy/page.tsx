"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  FileText,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

const privacyPrinciples = [
  {
    icon: ShieldCheck,
    title: "Privacy by design",
    description:
      "NOVA is designed with privacy as a foundational principle, not an afterthought. Data protection considerations are built into the product experience.",
  },
  {
    icon: Lock,
    title: "Protected information",
    description:
      "Sensitive workspace information is handled through security-focused systems designed to reduce unnecessary exposure and protect user data.",
  },
  {
    icon: Eye,
    title: "Transparent control",
    description:
      "You should understand what information belongs to your workspace and have clear control over how your data is managed.",
  },
];

const dataCategories = [
  {
    icon: UserCheck,
    title: "Account information",
    description:
      "Information required to create and manage your NOVA account, workspace identity, preferences, and authentication.",
  },
  {
    icon: Database,
    title: "Workspace content",
    description:
      "Projects, messages, knowledge, files, memories, and other content you intentionally create or upload.",
  },
  {
    icon: Users,
    title: "Collaboration data",
    description:
      "Information related to workspace members, permissions, invitations, and collaborative activity.",
  },
];

const userRights = [
  "Access information associated with your account",
  "Update or correct account information",
  "Manage workspace content and preferences",
  "Delete content you no longer want to keep",
  "Control notifications and communication preferences",
  "Review activity within your workspace",
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            NOVA Privacy Center
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Your intelligence.
            <span className="block text-primary">
              Your data. Your control.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Privacy is fundamental to the NOVA ecosystem. We believe
            intelligent systems should give people more capability
            without taking away control over their information.
          </p>
        </section>

        {/* Main privacy statement */}
        <section className="mt-14 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Lock className="h-7 w-7" />
              </div>

              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
                Privacy is part of the infrastructure.
              </h2>
            </div>

            <div>
              <p className="text-base leading-7 text-muted-foreground">
                NOVA is designed as an intelligence workspace where
                users can create, research, collaborate, automate, and
                build. That requires trust.
              </p>

              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Our approach is centered around minimizing unnecessary
                data exposure, giving users meaningful control over
                their workspace, and building systems that can scale
                without compromising privacy principles.
              </p>

              <Link
                href="/privacy/activity"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-opacity hover:opacity-80"
              >
                View privacy activity
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="mt-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Our principles
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Designed around trust.
            </h2>

            <p className="mt-4 leading-7 text-muted-foreground">
              Privacy and security are ongoing responsibilities. These
              principles guide how NOVA evolves as the platform grows.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {privacyPrinciples.map((principle) => {
              const Icon = principle.icon;

              return (
                <article
                  key={principle.title}
                  className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    {principle.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {principle.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Data categories */}
        <section className="mt-16 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Information categories
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Understanding your workspace data.
            </h2>

            <p className="mt-4 leading-7 text-muted-foreground">
              Different parts of NOVA may process different categories
              of information depending on the features you choose to
              use.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {dataCategories.map((category) => {
              const Icon = category.icon;

              return (
                <div
                  key={category.title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <Icon className="h-5 w-5 text-primary" />

                  <h3 className="mt-4 font-semibold text-foreground">
                    {category.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* User controls */}
        <section className="mt-16 grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Your controls
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              You remain in control.
            </h2>

            <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
              NOVA is designed to give users meaningful control over
              their account, workspace, content, and communication
              preferences.
            </p>

            <Link
              href="/profile"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              Manage profile settings
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-3xl border border-border bg-card p-7">
            <ul className="space-y-4">
              {userRights.map((right) => (
                <li
                  key={right}
                  className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                  <span>{right}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Documentation */}
        <section className="mt-16 rounded-3xl border border-primary/20 bg-primary/5 p-7 sm:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>

              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                Transparency matters.
              </h2>

              <p className="mt-3 leading-7 text-muted-foreground">
                Review how privacy-related activity appears across your
                workspace and stay informed about important account
                actions.
              </p>
            </div>

            <Link
              href="/privacy/activity"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open privacy activity
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer note */}
        <section className="mt-10 border-t border-border pt-8 text-center">
          <p className="mx-auto max-w-3xl text-sm leading-6 text-muted-foreground">
            This Privacy Center provides an overview of NOVA&apos;s
            privacy principles and product controls. Additional legal
            terms and privacy documentation may apply depending on your
            use of the platform.
          </p>
        </section>
      </div>
    </main>
  );
}