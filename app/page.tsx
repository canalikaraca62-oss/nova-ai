"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Bot,
  CheckCircle2,
  Command,
  Database,
  Layers3,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Intelligent Knowledge",
    description:
      "Transform information into structured, searchable, and actionable intelligence.",
  },
  {
    icon: Bot,
    title: "AI Agents",
    description:
      "Deploy intelligent agents that help automate workflows and execute complex tasks.",
  },
  {
    icon: Layers3,
    title: "Unified Workspace",
    description:
      "Projects, conversations, knowledge, tasks, and collaboration in one system.",
  },
  {
    icon: Zap,
    title: "Powerful Automation",
    description:
      "Build scalable workflows that connect intelligence with real execution.",
  },
];

const capabilities = [
  "AI-powered workspaces",
  "Autonomous agents",
  "Knowledge management",
  "Project intelligence",
  "Team collaboration",
  "Workflow automation",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090b] text-white">
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-20rem] h-[50rem] w-[50rem] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute bottom-[-15rem] right-[-10rem] h-[35rem] w-[35rem] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      {/* Navigation */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
              <Sparkles className="h-4 w-4 text-violet-300" />
            </div>

            <span className="text-lg font-semibold tracking-tight">
              SYRAVEN
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <Link
              href="/workspace"
              className="transition-colors hover:text-white"
            >
              Workspace
            </Link>

            <Link
              href="/marketplace"
              className="transition-colors hover:text-white"
            >
              Marketplace
            </Link>

            <Link
              href="/pricing"
              className="transition-colors hover:text-white"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white sm:block"
            >
              Sign in
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02] hover:bg-white/90"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200">
          <Sparkles className="h-4 w-4" />
          <span>The intelligent operating system for modern work</span>
        </div>

        <h1 className="max-w-5xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-8xl">
          Build the future
          <br />
          with{" "}
          <span className="bg-gradient-to-r from-violet-300 via-white to-indigo-300 bg-clip-text text-transparent">
            intelligence.
          </span>
        </h1>

        <p className="mt-8 max-w-2xl text-base leading-8 text-white/50 sm:text-lg">
          SYRAVEN brings AI agents, knowledge, projects, automation, and
          collaboration together into one intelligent workspace.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-black transition-all hover:bg-white/90"
          >
            Start building with SYRAVEN
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/workspace"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Command className="h-4 w-4" />
            Explore workspace
          </Link>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-white/40">
          {capabilities.map((capability) => (
            <div key={capability} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400/70" />
              <span>{capability}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-violet-300">
              SYRAVEN Platform
            </p>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              One intelligence layer for everything.
            </h2>

            <p className="mt-5 text-white/50">
              Designed to connect people, AI, knowledge, and execution without
              forcing teams to jump between disconnected tools.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-7 transition-all duration-200 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.04]"
                >
                  <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10">
                    <Icon className="h-5 w-5 text-violet-300" />
                  </div>

                  <h3 className="text-lg font-semibold text-white">
                    {feature.title}
                  </h3>

                  <p className="mt-3 max-w-md leading-7 text-white/50">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Intelligence Section */}
      <section className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-8 md:p-14">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                  <Database className="h-6 w-6 text-violet-300" />
                </div>

                <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Your organization&apos;s intelligence, connected.
                </h2>

                <p className="mt-6 max-w-xl leading-8 text-white/50">
                  SYRAVEN turns disconnected information into an intelligent
                  system that can understand context, support decisions, and
                  help teams move faster.
                </p>

                <Link
                  href="/knowledge"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-violet-300"
                >
                  Explore knowledge
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5 shadow-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 shrink-0 text-violet-300" />

                      <div>
                        <div className="text-sm font-medium text-white">
                          Intelligence Layer
                        </div>

                        <div className="mt-1 text-xs text-white/40">
                          Understanding context across your workspace
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-5 w-5 shrink-0 text-indigo-300" />

                      <div>
                        <div className="text-sm font-medium text-white">
                          AI Collaboration
                        </div>

                        <div className="mt-1 text-xs text-white/40">
                          Agents working alongside your team
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 shrink-0 text-yellow-300" />

                      <div>
                        <div className="text-sm font-medium text-white">
                          Automated Execution
                        </div>

                        <div className="mt-1 text-xs text-white/40">
                          Turning intelligence into action
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-violet-300" />

          <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-5xl">
            Build what comes next.
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-white/50">
            Start building your intelligent workspace with SYRAVEN.
          </p>

          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02] hover:bg-white/90"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {new Date().getFullYear()} SYRAVEN. All rights reserved.
          </div>

          <div className="flex gap-5">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              Privacy
            </Link>

            <Link
              href="/terms"
              className="transition-colors hover:text-white"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}