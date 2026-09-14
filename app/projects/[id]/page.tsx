"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Clock3,
  ExternalLink,
  FileText,
  FolderKanban,
  Plus,
  SearchX,
} from "lucide-react";

/*
  One project, loaded from GET /api/projects?id=.

  Only what the project row holds is shown. This page used to fall back
  to hardcoded sample projects, render an invented activity feed and
  "Momentum Strong / Risk Low / AI confidence 94%" cards on every
  project, and show progress, member and task counts it never measured
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-E03). Tasks and activity
  live on /tasks and /activity, which do measure them.
*/

type ProjectStatus = "active" | "completed" | "draft" | "archived";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
}

function getStatusConfig(status: string) {
  switch (status as ProjectStatus) {
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

    case "draft":
      return {
        label: "Draft",
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };

    case "archived":
      return {
        label: "Archived",
        className: "border-muted bg-muted text-muted-foreground",
      };

    default:
      return {
        label: "Unknown status",
        className: "border-muted bg-muted text-muted-foreground",
      };
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();

  const projectId = typeof params?.id === "string" ? params.id : "";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSignedOut(false);

    try {
      const response = await fetch(
        `/api/projects?id=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );

      if (response.status === 401) {
        setProject(null);
        setSignedOut(true);
        return;
      }

      if (!response.ok) {
        setProject(null);
        setLoadError("This project could not be loaded.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        data?: {
          id: string;
          name: string;
          description: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          due_date: string | null;
        }[];
      } | null;

      const row = payload?.data?.[0];

      setProject(
        row
          ? {
              id: row.id,
              name: row.name,
              description: row.description ?? "",
              status: row.status,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              dueDate: row.due_date,
            }
          : null,
      );
    } catch {
      setProject(null);
      setLoadError("This project could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    /*
      A plain container, not a second <main>: AppChrome already emits
      the page main landmark, and two of them is invalid HTML.
    */
    <div className="bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        <Link
          href="/projects"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>

        {loadError ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            Loading project...
          </p>
        ) : null}

        {!loading && !project && !loadError ? (
          <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
            <div className="rounded-2xl bg-muted p-4">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>

            <h1 className="mt-6 text-2xl font-semibold text-foreground">
              {signedOut ? "Sign in to view this project" : "Project not found"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {signedOut
                ? "Projects belong to an account. Sign in, then open it again."
                : "This project does not exist, or it belongs to another account."}
            </p>

            <Link
              href={signedOut ? "/login" : "/projects"}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {signedOut ? "Sign in" : "Back to projects"}
            </Link>
          </div>
        ) : null}

        {project ? (
          <ProjectView project={project} />
        ) : null}
      </div>
    </div>
  );
}

function ProjectView({ project }: { project: Project }) {
  const status = getStatusConfig(project.status);

  return (
    <>
      <section className="border-b border-border py-8 lg:py-10">
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

              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Updated {formatDate(project.updatedAt)}
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {project.name}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {project.description || "No description yet."}
            </p>
          </div>

          <Link
            href="/tasks"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add task
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />

            <h2 className="text-xl font-semibold text-foreground">
              Project details
            </h2>
          </div>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <DetailRow label="Status" value={status.label} />
            <DetailRow label="Deadline" value={formatDate(project.dueDate)} />
            <DetailRow label="Created" value={formatDate(project.createdAt)} />
            <DetailRow label="Last updated" value={formatDate(project.updatedAt)} />
          </dl>
        </section>

        <aside className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">
            Quick actions
          </h2>

          <div className="mt-5 space-y-2">
            <QuickAction href="/tasks" icon={Plus} label="Create new task" />
            <QuickAction href="/knowledge" icon={FileText} label="Knowledge" />
            <QuickAction href="/activity" icon={Activity} label="Recent activity" />
          </div>
        </aside>
      </div>
    </>
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
