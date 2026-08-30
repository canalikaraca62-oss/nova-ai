"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  FileText,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

type ProjectStatus = "active" | "planning" | "completed";

interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  members: number;
  tasksCompleted: number;
  totalTasks: number;
  updatedAt: string;
  createdAt: string;
  deadline: string;
  workspace: string;
}

const projects: Record<string, Project> = {
  "syraven-platform": {
    id: "syraven-platform",
    name: "SYRAVEN Platform",
    description:
      "The central AI operating system for building intelligent workflows, managing knowledge, and coordinating autonomous agents.",
    status: "active",
    progress: 78,
    members: 12,
    tasksCompleted: 94,
    totalTasks: 120,
    updatedAt: "Updated 2 minutes ago",
    createdAt: "January 12, 2026",
    deadline: "December 31, 2026",
    workspace: "SYRAVEN Core",
  },
  "ai-research": {
    id: "ai-research",
    name: "AI Research",
    description:
      "Advanced research initiatives focused on next-generation reasoning systems and intelligent agent architectures.",
    status: "active",
    progress: 64,
    members: 8,
    tasksCompleted: 51,
    totalTasks: 80,
    updatedAt: "Updated 1 hour ago",
    createdAt: "February 4, 2026",
    deadline: "October 20, 2026",
    workspace: "Research Lab",
  },
  "knowledge-engine": {
    id: "knowledge-engine",
    name: "Knowledge Engine",
    description:
      "A unified knowledge infrastructure designed to connect documents, memories, agents, and organizational intelligence.",
    status: "planning",
    progress: 32,
    members: 6,
    tasksCompleted: 18,
    totalTasks: 56,
    updatedAt: "Updated yesterday",
    createdAt: "March 18, 2026",
    deadline: "March 30, 2027",
    workspace: "Intelligence",
  },
};

const fallbackProject: Project = {
  id: "project",
  name: "Untitled Project",
  description:
    "This project is part of your SYRAVEN workspace. Add more details to begin organizing tasks, knowledge, and collaboration.",
  status: "planning",
  progress: 0,
  members: 1,
  tasksCompleted: 0,
  totalTasks: 0,
  updatedAt: "Recently created",
  createdAt: "Today",
  deadline: "Not set",
  workspace: "Personal Workspace",
};

const activities = [
  {
    title: "Project workspace updated",
    description:
      "Project settings and workspace configuration were updated.",
    time: "2 minutes ago",
    icon: Settings,
  },
  {
    title: "New knowledge connected",
    description:
      "Research documents were linked to this project.",
    time: "24 minutes ago",
    icon: FileText,
  },
  {
    title: "Tasks completed",
    description:
      "Multiple project tasks were marked as completed.",
    time: "1 hour ago",
    icon: CheckCircle2,
  },
  {
    title: "AI analysis generated",
    description:
      "SYRAVEN generated a new project intelligence summary.",
    time: "3 hours ago",
    icon: Sparkles,
  },
];

function getStatusConfig(status: ProjectStatus) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };

    case "completed":
      return {
        label: "Completed",
        className:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };

    default:
      return {
        label: "Planning",
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();

  const projectId =
    typeof params?.id === "string"
      ? params.id
      : "project";

  const project =
    projects[projectId] ?? {
      ...fallbackProject,
      id: projectId,
      name:
        projectId
          .split("-")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() +
              word.slice(1)
          )
          .join(" ") || fallbackProject.name,
    };

  const status = getStatusConfig(project.status);

  const taskProgress =
    project.totalTasks > 0
      ? Math.round(
          (project.tasksCompleted /
            project.totalTasks) *
            100
        )
      : 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        {/* Top navigation */}
        <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/projects"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${project.id}/edit`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Edit3 className="h-4 w-4" />
              Edit project
            </Link>

            <button
              type="button"
              aria-label="More project options"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Hero */}
        <section className="py-8 lg:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FolderKanban className="h-6 w-6" />
                </div>

                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>

                <span className="text-sm text-muted-foreground">
                  {project.updatedAt}
                </span>
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {project.name}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {project.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex lg:flex-col">
              <Link
                href={`/projects/${project.id}/new`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add task
              </Link>

              <Link
                href="/studio"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Sparkles className="h-4 w-4" />
                Open Studio
              </Link>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Activity}
            label="Project progress"
            value={`${project.progress}%`}
            description="Overall completion"
          />

          <MetricCard
            icon={CheckCircle2}
            label="Tasks"
            value={`${project.tasksCompleted}/${project.totalTasks}`}
            description={`${taskProgress}% task completion`}
          />

          <MetricCard
            icon={Users}
            label="Team members"
            value={String(project.members)}
            description="Active collaborators"
          />

          <MetricCard
            icon={Calendar}
            label="Deadline"
            value={project.deadline}
            description="Project target date"
            smallValue
          />
        </section>

        {/* Main content */}
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            {/* Progress */}
            <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />

                    <h2 className="text-xl font-semibold text-foreground">
                      Project progress
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Track the overall progress of this project.
                  </p>
                </div>

                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {project.progress}%
                </span>
              </div>

              <div className="mt-7">
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        Math.max(project.progress, 0),
                        100
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {project.tasksCompleted} tasks completed
                  </span>

                  <span>
                    {Math.max(
                      project.totalTasks -
                        project.tasksCompleted,
                      0
                    )}{" "}
                    remaining
                  </span>
                </div>
              </div>
            </section>

            {/* Project intelligence */}
            <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />

                    <h2 className="text-xl font-semibold text-foreground">
                      SYRAVEN Intelligence
                    </h2>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    AI-powered insights generated from your project
                    activity, tasks, workspace knowledge and
                    collaboration patterns.
                  </p>
                </div>

                <Link
                  href={`/projects/${project.id}/intelligence`}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  View insights
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-3">
                <InsightCard
                  title="Momentum"
                  value="Strong"
                  description="Project activity is trending upward."
                />

                <InsightCard
                  title="Risk level"
                  value="Low"
                  description="No critical blockers detected."
                />

                <InsightCard
                  title="AI confidence"
                  value="94%"
                  description="Based on current project signals."
                />
              </div>
            </section>

            {/* Activity */}
            <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-primary" />

                    <h2 className="text-xl font-semibold text-foreground">
                      Recent activity
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    The latest activity across this project.
                  </p>
                </div>

                <Link
                  href="/privacy/activity"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>

              <div className="mt-7 space-y-6">
                {activities.map((activity) => {
                  const Icon = activity.icon;

                  return (
                    <div
                      key={activity.title}
                      className="flex gap-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <h3 className="text-sm font-semibold text-foreground">
                            {activity.title}
                          </h3>

                          <span className="shrink-0 text-xs text-muted-foreground">
                            {activity.time}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {activity.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="rounded-3xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground">
                Project details
              </h2>

              <dl className="mt-6 space-y-5">
                <DetailRow
                  label="Workspace"
                  value={project.workspace}
                />

                <DetailRow
                  label="Created"
                  value={project.createdAt}
                />

                <DetailRow
                  label="Deadline"
                  value={project.deadline}
                />

                <DetailRow
                  label="Status"
                  value={status.label}
                />
              </dl>
            </section>

            <section className="rounded-3xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground">
                Quick actions
              </h2>

              <div className="mt-5 space-y-2">
                <QuickAction
                  href={`/projects/${project.id}/new`}
                  icon={Plus}
                  label="Create new task"
                />

                <QuickAction
                  href="/knowledge"
                  icon={FileText}
                  label="Project knowledge"
                />

                <QuickAction
                  href="/studio"
                  icon={Sparkles}
                  label="Ask SYRAVEN AI"
                />

                <QuickAction
                  href={`/projects/${project.id}/settings`}
                  icon={Settings}
                  label="Project settings"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-primary/15 bg-primary/[0.04] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>

              <h2 className="mt-5 text-base font-semibold text-foreground">
                AI project assistant
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ask SYRAVEN to analyze progress, identify risks, create
                plans or generate your next steps.
              </p>

              <Link
                href="/studio"
                className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Open AI assistant
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  smallValue = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  description: string;
  smallValue?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>

        <Icon className="h-4 w-4 text-primary" />
      </div>

      <div
        className={`mt-4 font-semibold tracking-tight text-foreground ${
          smallValue
            ? "text-lg"
            : "text-3xl"
        }`}
      >
        {value}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>

      <p className="mt-3 text-2xl font-semibold text-foreground">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>

      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
}