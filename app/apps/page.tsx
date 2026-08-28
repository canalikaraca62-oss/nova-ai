"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AppCategory =
  | "All"
  | "AI"
  | "Productivity"
  | "Creative"
  | "Development"
  | "Research"
  | "Business";

type AppStatus = "Ready" | "Beta" | "Coming soon";

type AppItem = {
  id: string;
  name: string;
  description: string;
  category: Exclude<AppCategory, "All">;
  status: AppStatus;
  href: string;
  icon: string;
  color: string;
  tags: string[];
  featured?: boolean;
  new?: boolean;
  usage?: string;
};

const categories: AppCategory[] = [
  "All",
  "AI",
  "Productivity",
  "Creative",
  "Development",
  "Research",
  "Business",
];

const apps: AppItem[] = [
  {
    id: "agents",
    name: "AI Agents",
    description:
      "Build, configure and deploy intelligent agents for complex autonomous workflows.",
    category: "AI",
    status: "Ready",
    href: "/agents",
    icon: "✦",
    color: "from-violet-500 to-fuchsia-500",
    tags: ["Agents", "Automation", "Reasoning"],
    featured: true,
    usage: "12.4k runs",
  },
  {
    id: "chat",
    name: "Syraven Chat",
    description:
      "A powerful multi-model workspace for conversations, analysis and deep thinking.",
    category: "AI",
    status: "Ready",
    href: "/chat",
    icon: "◈",
    color: "from-cyan-500 to-blue-500",
    tags: ["Chat", "Models", "Workspace"],
    featured: true,
    usage: "8.7k messages",
  },
  {
    id: "canvas",
    name: "Infinite Canvas",
    description:
      "Turn ideas into visual systems, workflows, maps and connected knowledge.",
    category: "Creative",
    status: "Ready",
    href: "/canvas",
    icon: "◇",
    color: "from-orange-400 to-rose-500",
    tags: ["Visual", "Ideas", "Planning"],
    usage: "3.2k boards",
  },
  {
    id: "knowledge",
    name: "Knowledge Hub",
    description:
      "Search, organize and connect documents, files, notes and institutional knowledge.",
    category: "Research",
    status: "Ready",
    href: "/knowledge",
    icon: "◉",
    color: "from-emerald-400 to-teal-500",
    tags: ["Search", "Documents", "RAG"],
    featured: true,
    usage: "24.1k sources",
  },
  {
    id: "workspace",
    name: "AI Workspace",
    description:
      "A unified environment for analysis, creation, research and team collaboration.",
    category: "Productivity",
    status: "Ready",
    href: "/workspace",
    icon: "▦",
    color: "from-indigo-500 to-purple-500",
    tags: ["Projects", "Files", "Focus"],
    usage: "1.8k workspaces",
  },
  {
    id: "studio",
    name: "Creative Studio",
    description:
      "Create audio, visual concepts, presentations and AI-assisted creative content.",
    category: "Creative",
    status: "Beta",
    href: "/studio",
    icon: "✺",
    color: "from-pink-500 to-rose-500",
    tags: ["Image", "Audio", "Presentation"],
    new: true,
  },
  {
    id: "projects",
    name: "Project Command",
    description:
      "Plan, organize and execute ambitious projects with AI-powered intelligence.",
    category: "Productivity",
    status: "Ready",
    href: "/projects",
    icon: "▣",
    color: "from-blue-500 to-indigo-600",
    tags: ["Planning", "Teams", "Execution"],
    usage: "642 active",
  },
  {
    id: "tasks",
    name: "Task Engine",
    description:
      "Transform goals into structured tasks, schedules and automated execution flows.",
    category: "Productivity",
    status: "Ready",
    href: "/tasks",
    icon: "✓",
    color: "from-lime-400 to-green-500",
    tags: ["Tasks", "Automation", "Schedule"],
    usage: "9.1k completed",
  },
  {
    id: "code",
    name: "Developer Lab",
    description:
      "Analyze code, generate solutions and orchestrate advanced development workflows.",
    category: "Development",
    status: "Ready",
    href: "/studio",
    icon: "</>",
    color: "from-sky-500 to-cyan-500",
    tags: ["Code", "Analysis", "Engineering"],
    new: true,
  },
  {
    id: "research",
    name: "Research Engine",
    description:
      "Explore complex topics, synthesize information and structure deep research.",
    category: "Research",
    status: "Ready",
    href: "/search",
    icon: "⌕",
    color: "from-amber-400 to-orange-500",
    tags: ["Research", "Search", "Analysis"],
  },
  {
    id: "billing",
    name: "Business Intelligence",
    description:
      "Monitor usage, plans, growth and operational intelligence across your organization.",
    category: "Business",
    status: "Ready",
    href: "/billing",
    icon: "◫",
    color: "from-teal-400 to-emerald-600",
    tags: ["Usage", "Analytics", "Billing"],
  },
  {
    id: "voice",
    name: "Voice Intelligence",
    description:
      "Speak, transcribe and interact through a next-generation voice interface.",
    category: "AI",
    status: "Beta",
    href: "/chat",
    icon: "⌁",
    color: "from-purple-500 to-violet-600",
    tags: ["Speech", "Transcription", "Voice"],
    new: true,
  },
  {
    id: "automations",
    name: "Automation Center",
    description:
      "Design repeatable workflows and let intelligent systems execute them automatically.",
    category: "Business",
    status: "Coming soon",
    href: "/tasks",
    icon: "↻",
    color: "from-slate-400 to-slate-600",
    tags: ["Workflows", "Agents", "Automation"],
  },
];

function AppIcon({ value }: { value: string }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-xl"
      aria-hidden="true"
    >
      {value}
    </span>
  );
}

export default function AppsPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<AppCategory>("All");

  const [query, setQuery] = useState("");

  const [favorites, setFavorites] =
    useState<string[]>([]);

  const filteredApps = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    return apps.filter((app) => {
      const categoryMatches =
        selectedCategory === "All" ||
        app.category === selectedCategory;

      const queryMatches =
        normalizedQuery.length === 0 ||
        app.name
          .toLowerCase()
          .includes(normalizedQuery) ||
        app.description
          .toLowerCase()
          .includes(normalizedQuery) ||
        app.tags.some((tag) =>
          tag
            .toLowerCase()
            .includes(normalizedQuery)
        );

      return categoryMatches && queryMatches;
    });
  }, [query, selectedCategory]);

  const featuredApps = apps.filter(
    (app) => app.featured
  );

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter(
            (favoriteId) =>
              favoriteId !== id
          )
        : [...current, id]
    );
  };

  return (
    <main className="min-h-screen bg-[#07090f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[-15%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute right-[5%] top-[20%] h-[450px] w-[450px] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[35%] h-[450px] w-[450px] rounded-full bg-fuchsia-600/10 blur-[160px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur-2xl">
          <div className="relative overflow-hidden px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.12] via-transparent to-cyan-500/[0.08]" />

            <div className="relative max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.8)]" />
                SYRAVEN APPLICATION ECOSYSTEM
              </div>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                One ecosystem.
                <span className="block bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                  Unlimited possibilities.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
                Discover intelligent applications built to
                create, research, automate, collaborate and
                turn ambitious ideas into real outcomes.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/agents/create"
                  className="group inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:scale-[1.02] hover:bg-white/90"
                >
                  Create with AI
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>

                <a
                  href="#all-apps"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Explore ecosystem
                </a>
              </div>
            </div>
          </div>

          <div className="grid border-t border-white/10 sm:grid-cols-3">
            <div className="border-b border-white/10 px-6 py-5 sm:border-b-0 sm:border-r sm:px-10">
              <p className="text-2xl font-semibold tracking-tight">
                {apps.length}+
              </p>
              <p className="mt-1 text-sm text-white/45">
                Intelligent applications
              </p>
            </div>

            <div className="border-b border-white/10 px-6 py-5 sm:border-b-0 sm:border-r sm:px-10">
              <p className="text-2xl font-semibold tracking-tight">
                One
              </p>
              <p className="mt-1 text-sm text-white/45">
                Unified workspace
              </p>
            </div>

            <div className="px-6 py-5 sm:px-10">
              <p className="text-2xl font-semibold tracking-tight">
                AI-native
              </p>
              <p className="mt-1 text-sm text-white/45">
                Built for ambitious work
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-violet-300">
                FEATURED
              </p>

              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Start somewhere extraordinary
              </h2>
            </div>

            <span className="hidden text-sm text-white/40 sm:block">
              Your most powerful tools, connected.
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {featuredApps.map((app) => (
              <Link
                key={app.id}
                href={app.href}
                className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${app.color} opacity-70`}
                />

                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`rounded-2xl bg-gradient-to-br ${app.color} p-[1px] shadow-lg`}
                  >
                    <AppIcon value={app.icon} />
                  </div>

                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/50">
                    {app.status}
                  </span>
                </div>

                <h3 className="mt-8 text-xl font-semibold tracking-tight">
                  {app.name}
                </h3>

                <p className="mt-3 text-sm leading-6 text-white/50">
                  {app.description}
                </p>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {app.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] text-white/45"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="all-apps"
          className="mt-14 scroll-mt-8"
        >
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-medium text-cyan-300">
                APPLICATION DIRECTORY
              </p>

              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Explore everything
              </h2>

              <p className="mt-2 text-sm text-white/45">
                Find the right intelligence for the work ahead.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                ⌕
              </span>

              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search applications..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.045] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-violet-400/50 focus:bg-white/[0.06]"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => {
              const active =
                category === selectedCategory;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-white text-black"
                      : "border border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredApps.map((app) => {
              const isFavorite =
                favorites.includes(app.id);

              return (
                <article
                  key={app.id}
                  className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:border-white/20 hover:bg-white/[0.055]"
                >
                  <div
                    className={`absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-gradient-to-br ${app.color} opacity-[0.08] blur-3xl transition group-hover:opacity-[0.16]`}
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div
                      className={`rounded-2xl bg-gradient-to-br ${app.color} p-[1px]`}
                    >
                      <AppIcon value={app.icon} />
                    </div>

                    <button
                      type="button"
                      aria-label={`Toggle ${app.name} favorite`}
                      onClick={() =>
                        toggleFavorite(app.id)
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        isFavorite
                          ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-200"
                          : "border-white/10 bg-black/10 text-white/30 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      ★
                    </button>
                  </div>

                  <div className="relative mt-6 flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        app.status === "Ready"
                          ? "bg-emerald-400"
                          : app.status === "Beta"
                            ? "bg-amber-300"
                            : "bg-white/30"
                      }`}
                    />

                    <span className="text-xs text-white/45">
                      {app.status}
                    </span>

                    {app.new && (
                      <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                        New
                      </span>
                    )}
                  </div>

                  <h3 className="relative mt-3 text-xl font-semibold tracking-tight">
                    {app.name}
                  </h3>

                  <p className="relative mt-3 text-sm leading-6 text-white/48">
                    {app.description}
                  </p>

                  <div className="relative mt-auto pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-1.5">
                        {app.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-lg bg-white/[0.045] px-2 py-1 text-[10px] text-white/40"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {app.usage && (
                        <span className="text-[11px] text-white/30">
                          {app.usage}
                        </span>
                      )}
                    </div>

                    <Link
                      href={app.href}
                      className="mt-5 flex h-11 items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    >
                      Open application
                      <span>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredApps.length === 0 && (
            <div className="mt-8 rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center">
              <div className="text-3xl">⌕</div>

              <h3 className="mt-4 text-lg font-semibold">
                No applications found
              </h3>

              <p className="mt-2 text-sm text-white/45">
                Try another search or explore a different category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.06]"
              >
                Reset filters
              </button>
            </div>
          )}
        </section>

        <section className="mt-14 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-violet-500/[0.12] via-white/[0.03] to-cyan-500/[0.08] p-6 sm:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-violet-200">
                BUILD WHAT DOESN&apos;T EXIST YET
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Your next application can start with an idea.
              </h2>

              <p className="mt-4 text-sm leading-6 text-white/50 sm:text-base">
                Combine AI agents, knowledge, automation,
                projects and intelligent tools into a system
                designed around your own workflow.
              </p>
            </div>

            <Link
              href="/agents/create"
              className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90"
            >
              Start building
              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}