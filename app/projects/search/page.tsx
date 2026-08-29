"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Command,
  FileText,
  FolderKanban,
  Hash,
  Loader2,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type ProjectStatus =
  | "active"
  | "planning"
  | "completed"
  | "archived";

interface SearchProject {
  id: string;
  name: string;
  description: string;
  workspace: string;
  status: ProjectStatus;
  progress: number;
  members: number;
  updatedAt: string;
  tags: string[];
}

const projects: SearchProject[] = [
  {
    id: "global-intelligence-platform",
    name: "Global Intelligence Platform",
    description:
      "A next-generation AI intelligence infrastructure for autonomous research, strategic analysis and enterprise decision making.",
    workspace: "NOVA Core",
    status: "active",
    progress: 68,
    members: 24,
    updatedAt: "12 minutes ago",
    tags: ["AI", "Intelligence", "Infrastructure"],
  },
  {
    id: "research-engine",
    name: "Research Engine",
    description:
      "An autonomous research environment connecting knowledge, agents, sources and structured analytical workflows.",
    workspace: "Research Lab",
    status: "active",
    progress: 47,
    members: 12,
    updatedAt: "1 hour ago",
    tags: ["Research", "Agents", "Knowledge"],
  },
  {
    id: "agent-orchestration",
    name: "Agent Orchestration",
    description:
      "A coordinated multi-agent execution system for complex tasks, automation pipelines and enterprise workflows.",
    workspace: "Intelligence",
    status: "planning",
    progress: 18,
    members: 8,
    updatedAt: "Yesterday",
    tags: ["Agents", "Automation", "AI"],
  },
  {
    id: "nova-marketplace",
    name: "NOVA Marketplace",
    description:
      "A unified marketplace for AI agents, workflows, templates and intelligence capabilities.",
    workspace: "Product",
    status: "active",
    progress: 74,
    members: 16,
    updatedAt: "3 hours ago",
    tags: ["Marketplace", "AI", "Product"],
  },
  {
    id: "knowledge-graph",
    name: "Knowledge Graph",
    description:
      "A connected intelligence layer for documents, memories, entities and organizational knowledge.",
    workspace: "NOVA Core",
    status: "planning",
    progress: 31,
    members: 9,
    updatedAt: "2 days ago",
    tags: ["Knowledge", "Graph", "Memory"],
  },
  {
    id: "voice-intelligence",
    name: "Voice Intelligence",
    description:
      "Voice-driven AI interaction with transcription, semantic memory and intelligent action execution.",
    workspace: "NOVA Studio",
    status: "active",
    progress: 56,
    members: 11,
    updatedAt: "5 hours ago",
    tags: ["Voice", "AI", "Studio"],
  },
  {
    id: "automation-core",
    name: "Automation Core",
    description:
      "Infrastructure for designing, executing and monitoring large-scale automated workflows.",
    workspace: "Engineering",
    status: "completed",
    progress: 100,
    members: 18,
    updatedAt: "1 week ago",
    tags: ["Automation", "Infrastructure", "Engineering"],
  },
  {
    id: "legacy-automation",
    name: "Legacy Automation",
    description:
      "Archived automation infrastructure retained for maintenance, migration and historical reference.",
    workspace: "Archive",
    status: "archived",
    progress: 100,
    members: 4,
    updatedAt: "1 month ago",
    tags: ["Legacy", "Automation", "Archive"],
  },
];

const statusFilters: Array<{
  value: ProjectStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "planning", label: "Planning" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const popularSearches = [
  "AI infrastructure",
  "Research",
  "Agents",
  "Knowledge",
  "Automation",
  "Marketplace",
];

export default function ProjectSearchPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">(
    "all"
  );
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStatus =
        status === "all" || project.status === status;

      if (!normalizedQuery) {
        return matchesStatus;
      }

      const searchableContent = [
        project.name,
        project.description,
        project.workspace,
        project.status,
        ...project.tags,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        searchableContent.includes(normalizedQuery)
      );
    });
  }, [query, status]);

  function handleSearch(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    window.setTimeout(() => {
      setIsSearching(false);
    }, 250);
  }

  function clearSearch() {
    setQuery("");
    setStatus("all");
    setIsSearching(false);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8 lg:py-12">
        {/* Header */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.05] px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            NOVA Project Intelligence
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Search projects
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Search across projects, workspaces, AI initiatives,
            automation systems and organizational intelligence.
          </p>
        </section>

        {/* Search */}
        <section className="mx-auto mt-10 max-w-4xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

            <input
              value={query}
              onChange={(event) =>
                handleSearch(event.target.value)
              }
              autoFocus
              type="search"
              placeholder="Search projects, workspaces, technologies..."
              className="h-16 w-full rounded-2xl border border-border bg-card py-3 pl-14 pr-28 text-base text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
            />

            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <div className="hidden items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-xs text-muted-foreground sm:flex">
                <Command className="h-3.5 w-3.5" />
                K
              </div>
            </div>
          </div>

          {/* Popular searches */}
          {!query && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1 text-sm text-muted-foreground">
                Popular:
              </span>

              {popularSearches.map((search) => (
                <button
                  key={search}
                  type="button"
                  onClick={() => handleSearch(search)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {search}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Status filters */}
        <section className="mt-10 flex justify-center">
          <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  status === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        {/* Results header */}
        <section className="mt-12">
          <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {query
                  ? `Results for "${query}"`
                  : "Explore all projects"}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {isSearching
                  ? "Searching project intelligence..."
                  : `${results.length} ${
                      results.length === 1
                        ? "project"
                        : "projects"
                    } found`}
              </p>
            </div>

            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-sm font-medium text-primary transition-opacity hover:opacity-70"
              >
                Clear search
              </button>
            )}
          </div>

          {/* Loading */}
          {isSearching && (
            <div className="flex min-h-[280px] flex-col items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />

              <p className="mt-4 text-sm text-muted-foreground">
                Searching NOVA intelligence...
              </p>
            </div>
          )}

          {/* Empty state */}
          {!isSearching && results.length === 0 && (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>

              <h3 className="mt-6 text-xl font-semibold text-foreground">
                No projects found
              </h3>

              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                We couldn&apos;t find a project matching your search.
                Try another keyword, workspace or project category.
              </p>

              <button
                type="button"
                onClick={clearSearch}
                className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Reset search
              </button>
            </div>
          )}

          {/* Results */}
          {!isSearching && results.length > 0 && (
            <div className="mt-6 grid gap-4">
              {results.map((project) => (
                <SearchResultCard
                  key={project.id}
                  project={project}
                  query={query}
                />
              ))}
            </div>
          )}
        </section>

        {/* Search intelligence footer */}
        <section className="mt-12 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                Intelligent Discovery
              </div>

              <h3 className="mt-3 text-xl font-semibold text-foreground">
                Find knowledge beyond project names
              </h3>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                NOVA search is designed to evolve into a unified
                intelligence layer connecting projects, tasks, documents,
                conversations, agents and organizational memory.
              </p>
            </div>

            <Link
              href="/knowledge"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Explore knowledge
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function SearchResultCard({
  project,
  query,
}: {
  project: SearchProject;
  query: string;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={project.status} />

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              {project.workspace}
            </div>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
            <HighlightedText
              text={project.name}
              query={query}
            />
          </h3>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            <HighlightedText
              text={project.description}
              query={query}
            />
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                <Hash className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-[210px] flex-col gap-4 lg:items-end">
          <div className="w-full lg:w-48">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Progress
              </span>

              <span className="font-semibold text-foreground">
                {project.progress}%
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${project.progress}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {project.members} members
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {project.updatedAt}
            </span>
          </div>

          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Open project
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const expression = new RegExp(
    `(${escapeRegExp(query.trim())})`,
    "gi"
  );

  const parts = text.split(expression);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded bg-primary/15 px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function StatusBadge({
  status,
}: {
  status: ProjectStatus;
}) {
  const config = {
    active: {
      label: "Active",
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    planning: {
      label: "Planning",
      className:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    completed: {
      label: "Completed",
      className:
        "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    archived: {
      label: "Archived",
      className: "bg-muted text-muted-foreground",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {status === "active" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}

      {status === "completed" && (
        <CheckCircle2 className="h-3 w-3" />
      )}

      {config.label}
    </span>
  );
}