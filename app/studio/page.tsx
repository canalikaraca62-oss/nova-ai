"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  FileText,
  Image as ImageIcon,
  Mic2,
  Plus,
  Presentation,
  Search,
  Sparkles,
  TrendingUp,
  Video,
  WandSparkles,
} from "lucide-react";

type StudioCategory = "all" | "image" | "video" | "audio" | "presentation";

type StudioTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  category: Exclude<StudioCategory, "all">;
  icon: typeof ImageIcon;
  status: "Ready" | "Beta";
  badge: string;
};

type RecentProject = {
  id: string;
  title: string;
  type: Exclude<StudioCategory, "all">;
  createdAt: string;
  href: string;
};

const studioTools: StudioTool[] = [
  {
    id: "image",
    title: "AI Image Studio",
    description:
      "Create high-quality visuals, concepts and professional imagery with advanced AI generation.",
    href: "/studio/image",
    category: "image",
    icon: ImageIcon,
    status: "Ready",
    badge: "Visual Generation",
  },
  {
    id: "video",
    title: "AI Video Studio",
    description:
      "Transform creative ideas into cinematic stories, motion sequences and next-generation video content.",
    href: "/studio/video",
    category: "video",
    icon: Video,
    status: "Ready",
    badge: "Motion Generation",
  },
  {
    id: "audio",
    title: "AI Audio Studio",
    description:
      "Generate voice, audio concepts and intelligent sound experiences for your projects.",
    href: "/studio/audio",
    category: "audio",
    icon: Mic2,
    status: "Ready",
    badge: "Audio Intelligence",
  },
  {
    id: "presentation",
    title: "AI Presentation Studio",
    description:
      "Turn complex ideas into structured, professional presentations with AI-powered storytelling.",
    href: "/studio/presentation",
    category: "presentation",
    icon: Presentation,
    status: "Ready",
    badge: "Intelligent Slides",
  },
];

const recentProjects: RecentProject[] = [
  {
    id: "project-1",
    title: "Future Global Infrastructure",
    type: "presentation",
    createdAt: "Today",
    href: "/studio/presentation",
  },
  {
    id: "project-2",
    title: "Next Generation AI City",
    type: "video",
    createdAt: "Today",
    href: "/studio/video",
  },
  {
    id: "project-3",
    title: "Premium Technology Campaign",
    type: "image",
    createdAt: "Yesterday",
    href: "/studio/image",
  },
  {
    id: "project-4",
    title: "Global Product Voice",
    type: "audio",
    createdAt: "Yesterday",
    href: "/studio/audio",
  },
];

const categories: Array<{
  id: StudioCategory;
  label: string;
}> = [
  {
    id: "all",
    label: "All Tools",
  },
  {
    id: "image",
    label: "Image",
  },
  {
    id: "video",
    label: "Video",
  },
  {
    id: "audio",
    label: "Audio",
  },
  {
    id: "presentation",
    label: "Presentation",
  },
];

export default function StudioPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<StudioCategory>("all");

  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    return studioTools.filter((tool) => {
      const matchesCategory =
        selectedCategory === "all" ||
        tool.category === selectedCategory;

      const normalizedQuery =
        searchQuery.trim().toLowerCase();

      const matchesSearch =
        normalizedQuery.length === 0 ||
        tool.title
          .toLowerCase()
          .includes(normalizedQuery) ||
        tool.description
          .toLowerCase()
          .includes(normalizedQuery) ||
        tool.badge
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const getProjectIcon = (
    type: RecentProject["type"],
  ) => {
    switch (type) {
      case "image":
        return ImageIcon;

      case "video":
        return Video;

      case "audio":
        return Mic2;

      case "presentation":
        return Presentation;

      default:
        return FileText;
    }
  };

  const getProjectLabel = (
    type: RecentProject["type"],
  ) => {
    switch (type) {
      case "image":
        return "Image Studio";

      case "video":
        return "Video Studio";

      case "audio":
        return "Audio Studio";

      case "presentation":
        return "Presentation";

      default:
        return "Studio";
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}

        <div className="mb-10 flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI CREATIVE INFRASTRUCTURE
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              AI Studio
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              A unified creative intelligence workspace for
              generating images, videos, audio and presentations
              with powerful AI tools.
            </p>
          </div>

          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>

        {/* HERO */}

        <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />

          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <WandSparkles className="h-6 w-6" />
              </div>

              <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
                Create without limits
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                From an initial idea to professional visual
                content, intelligent media and complete
                presentations — everything starts from one
                powerful AI workspace.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/studio/image"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <ImageIcon className="h-4 w-4" />
                  Create Visual
                </Link>

                <Link
                  href="/studio/video"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
                >
                  <Video className="h-4 w-4" />
                  Generate Video
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 self-end">
              <div className="rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
                <ImageIcon className="h-5 w-5 text-primary" />

                <div className="mt-6 text-2xl font-bold">
                  Image
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Visual intelligence
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
                <Video className="h-5 w-5 text-primary" />

                <div className="mt-6 text-2xl font-bold">
                  Video
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Motion generation
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
                <Mic2 className="h-5 w-5 text-primary" />

                <div className="mt-6 text-2xl font-bold">
                  Audio
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Voice intelligence
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-5 backdrop-blur">
                <Presentation className="h-5 w-5 text-primary" />

                <div className="mt-6 text-2xl font-bold">
                  Slides
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Smart storytelling
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>

              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              4
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              AI Creative Tools
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              {recentProjects.length}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Recent Generations
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock3 className="h-5 w-5 text-primary" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              Instant
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              AI Processing
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <WandSparkles className="h-5 w-5 text-primary" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              Unified
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Creative Workspace
            </p>
          </div>
        </section>

        {/* TOOLS HEADER */}

        <section className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Creative Tools
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Choose a workspace and start creating.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search studio tools..."
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </section>

        {/* FILTERS */}

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected =
              selectedCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  setSelectedCategory(category.id)
                }
                className={[
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                ].join(" ")}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {/* TOOLS GRID */}

        {filteredTools.length > 0 ? (
          <section className="grid gap-5 md:grid-cols-2">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-primary/5 transition-transform group-hover:scale-125" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>

                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-xs font-medium",
                          tool.status === "Ready"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                        ].join(" ")}
                      >
                        {tool.status}
                      </span>
                    </div>

                    <div className="mt-7">
                      <p className="text-xs font-medium uppercase tracking-wider text-primary">
                        {tool.badge}
                      </p>

                      <h3 className="mt-2 text-xl font-semibold">
                        {tool.title}
                      </h3>

                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">
                      Open Studio

                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Search className="h-9 w-9 text-muted-foreground" />

            <h3 className="mt-5 font-semibold">
              No tools found
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Try changing your search or category filter.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* RECENT PROJECTS */}

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Recent Activity
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Continue working on your latest creative projects.
              </p>
            </div>

            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:opacity-80"
            >
              View Projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentProjects.map((project) => {
              const Icon = getProjectIcon(project.type);

              return (
                <Link
                  key={project.id}
                  href={project.href}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>

                  <h3 className="mt-6 truncate text-sm font-semibold">
                    {project.title}
                  </h3>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {getProjectLabel(project.type)}
                    </span>

                    <span>{project.createdAt}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* BOTTOM CTA */}

        <section className="relative mt-10 overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-7 sm:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative max-w-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>

            <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
              Build the next generation of ideas
            </h2>

            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              Combine AI-generated visuals, video, audio and
              presentations into one connected creative workflow.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Create New Project
              </Link>

              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium transition hover:bg-muted"
              >
                Explore Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}