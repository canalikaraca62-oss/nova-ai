"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Grid2X2,
  List,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

type ProjectStatus = "active" | "planning" | "completed" | "archived";
type ViewMode = "grid" | "list";

interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  workspace: string;
  progress: number;
  members: number;
  tasksCompleted: number;
  totalTasks: number;
  updatedAt: string;
  accent: string;
}

const projects: Project[] = [
  {
    id: "global-intelligence-platform",
    name: "Global Intelligence Platform",
    description:
      "A next-generation AI intelligence infrastructure for research, automation and strategic decision making.",
    status: "active",
    workspace: "SYRAVEN Core",
    progress: 68,
    members: 24,
    tasksCompleted: 86,
    totalTasks: 126,
    updatedAt: "Updated 12 minutes ago",
    accent: "from-violet-500/20 via-blue-500/10 to-transparent",
  },
  {
    id: "research-engine",
    name: "Research Engine",
    description:
      "Autonomous research workflows combining knowledge retrieval, AI agents and structured analysis.",
    status: "active",
    workspace: "Research Lab",
    progress: 47,
    members: 12,
    tasksCompleted: 41,
    totalTasks: 87,
    updatedAt: "Updated 1 hour ago",
    accent: "from-cyan-500/20 via-blue-500/10 to-transparent",
  },
  {
    id: "agent-orchestration",
    name: "Agent Orchestration",
    description:
      "A multi-agent system designed to coordinate complex tasks and enterprise workflows.",
    status: "planning",
    workspace: "Intelligence",
    progress: 18,
    members: 8,
    tasksCompleted: 12,
    totalTasks: 68,
    updatedAt: "Updated yesterday",
    accent: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    id: "syraven-marketplace",
    name: "SYRAVEN Marketplace",
    description:
      "A marketplace for AI agents, automation templates, workflows and intelligence tools.",
    status: "active",
    workspace: "Product",
    progress: 74,
    members: 16,
    tasksCompleted: 94,
    totalTasks: 127,
    updatedAt: "Updated 3 hours ago",
    accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
  },
  {
    id: "knowledge-graph",
    name: "Knowledge Graph",
    description:
      "A connected intelligence layer for documents, memories, entities and organizational knowledge.",
    status: "planning",
    workspace: "SYRAVEN Core",
    progress: 31,
    members: 9,
    tasksCompleted: 22,
    totalTasks: 71,
    updatedAt: "Updated 2 days ago",
    accent: "from-pink-500/20 via-purple-500/10 to-transparent",
  },
  {
    id: "legacy-automation",
    name: "Legacy Automation",
    description:
      "Completed automation infrastructure retained for historical reference and maintenance.",
    status: "archived",
    workspace: "Personal Workspace",
    progress: 100,
    members: 4,
    tasksCompleted: 54,
    totalTasks: 54,
    updatedAt: "Archived last month",
    accent: "from-slate-500/20 via-slate-400/10 to-transparent",
  },
];

const filters: Array<{
  label: string;
  value: ProjectStatus | "all";
}> = [
  { label: "All projects", value: "all" },
  { label: "Active", value: "active" },
  { label: "Planning", value: "planning" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    ProjectStatus | "all"
  >("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesFilter =
        activeFilter === "all" ||
        project.status === activeFilter;

      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.workspace.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [searchQuery, activeFilter]);

  const activeProjects = projects.filter(
    (project) => project.status === "active"
  ).length;

  const planningProjects = projects.filter(
    (project) => project.status === "planning"
  ).length;

  const totalMembers = projects.reduce(
    (total, project) => total + project.members,
    0
  );

  const totalTasks = projects.reduce(
    (total, project) => total + project.totalTasks,
    0
  );

  const completedTasks = projects.reduce(
    (total, project) => total + project.tasksCompleted,
    0
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        {/* Header */}
        <section className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              SYRAVEN Projects
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Projects
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Organize your work, intelligence, AI workflows and team
              execution in one connected project ecosystem.
            </p>
          </div>

          <Link
            href="/projects/new"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </section>

        {/* Statistics */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<FolderKanban className="h-5 w-5" />}
            label="Total projects"
            value={projects.length.toString()}
            description="Across all workspaces"
          />

          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Active projects"
            value={activeProjects.toString()}
            description={`${planningProjects} currently in planning`}
          />

          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Team members"
            value={totalMembers.toString()}
            description="Connected across projects"
          />

          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Task completion"
            value={`${Math.round(
              (completedTasks / totalTasks) * 100
            )}%`}
            description={`${completedTasks} of ${totalTasks} tasks`}
          />
        </section>

        {/* Toolbar */}
        <section className="mt-10 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search projects..."
              className="h-12 w-full rounded-xl border border-border bg-card py-2 pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <div className="flex items-center rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid2X2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        {/* Results */}
        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Your projects
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {filteredProjects.length}{" "}
                {filteredProjects.length === 1
                  ? "project"
                  : "projects"}{" "}
                found
              </p>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <EmptyState
              onReset={() => {
                setSearchQuery("");
                setActiveFilter("all");
              }}
            />
          ) : viewMode === "grid" ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {filteredProjects.map((project, index) => (
                <ProjectListItem
                  key={project.id}
                  project={project}
                  showBorder={
                    index !== filteredProjects.length - 1
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* AI insight */}
        <section className="mt-10 overflow-hidden rounded-3xl border border-primary/15 bg-primary/[0.04]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                SYRAVEN Intelligence
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Turn project data into strategic intelligence
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Connect tasks, knowledge, conversations and AI agents to
                continuously understand progress, detect risks and identify
                the next highest-impact actions.
              </p>
            </div>

            <Link
              href="/projects/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Explore project intelligence
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{icon}</span>

        <span className="text-xs font-medium text-muted-foreground">
          Live overview
        </span>
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: Project;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${project.accent}`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <StatusBadge status={project.status} />

          <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>

        <h3 className="mt-6 text-xl font-semibold text-foreground">
          {project.name}
        </h3>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Progress
            </span>

            <span className="font-semibold text-foreground">
              {project.progress}%
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${project.progress}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            {project.members} members
          </div>

          <div className="text-xs text-muted-foreground">
            {project.tasksCompleted}/{project.totalTasks} tasks
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProjectListItem({
  project,
  showBorder,
}: {
  project: Project;
  showBorder: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className={`group flex flex-col gap-5 p-6 transition-colors hover:bg-muted/50 lg:flex-row lg:items-center lg:justify-between ${
        showBorder ? "border-b border-border" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-foreground">
            {project.name}
          </h3>

          <StatusBadge status={project.status} />
        </div>

        <p className="mt-2 max-w-2xl truncate text-sm text-muted-foreground">
          {project.description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:items-center lg:gap-10">
        <div>
          <p className="text-xs text-muted-foreground">
            Progress
          </p>

          <p className="mt-1 text-sm font-semibold text-foreground">
            {project.progress}%
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Tasks
          </p>

          <p className="mt-1 text-sm font-semibold text-foreground">
            {project.tasksCompleted}/{project.totalTasks}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            Members
          </p>

          <p className="mt-1 text-sm font-semibold text-foreground">
            {project.members}
          </p>
        </div>

        <ArrowUpRight className="hidden h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 lg:block" />
      </div>
    </Link>
  );
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
      className:
        "bg-muted text-muted-foreground",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function EmptyState({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="h-6 w-6" />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-foreground">
        No projects found
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Try changing your search or filters to find the project you are
        looking for.
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Reset filters
      </button>
    </div>
  );
}