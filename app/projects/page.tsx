"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  FolderKanban,
  Grid2X2,
  List,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

/*
  SYRAVEN — Projects

  WHAT THIS PAGE SHOWS

  The caller's own projects, from GET /api/projects on their session.
  public.projects is owner-scoped, so somebody else's rows are never
  returned rather than filtered out here.

  WHAT IT USED TO SHOW

  A module-scope array of invented projects with invented progress
  percentages, member counts, task tallies and gradient accents. The
  search box filtered fiction and four stat tiles totalled it.

  One of those tiles computed Math.round((completedTasks / totalTasks)
  * 100). With real data and no tasks that is 0/0 -- it would have
  rendered "NaN%" on the first honest load.

  WHAT IS DELIBERATELY ABSENT

  Progress. There is no progress column and no way to derive one: a
  project is not a percentage of anything the schema records.

  Member counts. Projects have an owner_id and a workspace_id, and
  there is no project_members table.

  Task tallies. public.tasks does carry project_id, so a count is
  derivable -- but it costs a second request per project and would be
  a claim assembled here rather than a fact the row states. If it is
  worth showing it is worth doing deliberately, not as a side effect
  of this fix.

  Workspace names. The API returns workspace_id, not a name.

  Accent gradients, which were decoration invented per row.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

type ProjectStatus = "active" | "planning" | "completed" | "archived";
type ViewMode = "grid" | "list";

/** A project row exactly as /api/projects returns it. */
interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  workspace_id: string | null;
  updated_at: string | null;
}

const KNOWN_STATUSES: readonly ProjectStatus[] = [
  "active",
  "planning",
  "completed",
  "archived",
];

/**
 * Narrows the free-text status column to one this page can label.
 *
 * The column has no CHECK constraint, so a row may hold a value this
 * UI has never seen. Those render as active rather than disappearing:
 * a project the user created should not vanish from their own list
 * over a label.
 */
function statusOf(value: string | null): ProjectStatus {
  return KNOWN_STATUSES.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : "active";
}

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

function formatUpdated(value: string | null): string {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    ProjectStatus | "all"
  >("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setProjects([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: ProjectRow[];
      } | null;

      setProjects(payload?.data ?? []);
    } catch {
      setLoadError("Your projects could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesFilter =
        activeFilter === "all" ||
        statusOf(project.status) === activeFilter;

      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        (project.description ?? "").toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [projects, searchQuery, activeFilter]);

  /*
    Two counts, both of real rows. Two further tiles used to sit beside
    these: "Team members", totalled from an invented per-project count,
    and "Task completion", a percentage over two invented fields that
    would divide by zero the moment the data was real.
  */
  const activeProjects = useMemo(
    () =>
      projects.filter((p) => statusOf(p.status) === "active").length,
    [projects],
  );

  const planningProjects = useMemo(
    () =>
      projects.filter((p) => statusOf(p.status) === "planning").length,
    [projects],
  );

  return (
    /*
      A plain container, not a second <main>: AppChrome already emits
      the page main landmark, and two of them is invalid HTML.
    */
    <div className="bg-background">
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
              Your work, organised.
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
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatCard
            icon={<FolderKanban className="h-5 w-5" />}
            label="Total projects"
            value={isLoading ? "—" : projects.length.toString()}
          />

          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Active projects"
            value={isLoading ? "—" : activeProjects.toString()}
            description={
              isLoading
                ? undefined
                : `${planningProjects} in planning`
            }
          />
        </section>

        {/* Toolbar */}
        <section className="mt-10 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search projects..."
              aria-label="Search projects"
              className="h-12 w-full rounded-xl border border-border bg-card py-2 pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <div className="flex items-center rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
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
                aria-pressed={viewMode === "list"}
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
              aria-pressed={activeFilter === filter.value}
              className={`shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors ${
                activeFilter === filter.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        {loadError ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {loadError}

            <button
              type="button"
              onClick={() => void load()}
              className="ml-3 font-medium underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-8 rounded-3xl border border-dashed border-border px-6 py-20 text-center text-sm text-muted-foreground"
          >
            Loading your projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-border px-6 py-20 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              {projects.length === 0
                ? "No projects yet"
                : "No matches"}
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {projects.length === 0
                ? "Projects you create will appear here."
                : "No project matches this search or filter."}
            </p>

            {projects.length === 0 ? (
              <Link
                href="/projects/new"
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                New project
              </Link>
            ) : null}
          </div>
        ) : viewMode === "grid" ? (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card">
            {filteredProjects.map((project, index) => (
              <ProjectListItem
                key={project.id}
                project={project}
                showBorder={index < filteredProjects.length - 1}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   PIECES                                   */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="text-muted-foreground">{icon}</span>

      <p className="mt-5 text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      {description ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const updated = formatUpdated(project.updated_at);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <StatusBadge status={statusOf(project.status)} />

        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      <h3 className="mt-6 text-xl font-semibold text-foreground">
        {project.name}
      </h3>

      {project.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>
      ) : null}

      {updated ? (
        <p className="mt-6 border-t border-border pt-5 text-xs text-muted-foreground">
          Updated {updated}
        </p>
      ) : null}
    </Link>
  );
}

function ProjectListItem({
  project,
  showBorder,
}: {
  project: ProjectRow;
  showBorder: boolean;
}) {
  const updated = formatUpdated(project.updated_at);

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

          <StatusBadge status={statusOf(project.status)} />
        </div>

        {project.description ? (
          <p className="mt-2 max-w-2xl truncate text-sm text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-6">
        {updated ? (
          <span className="text-xs text-muted-foreground">
            Updated {updated}
          </span>
        ) : null}

        <ArrowUpRight className="hidden h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 lg:block" />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = {
    active: {
      label: "Active",
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    planning: {
      label: "Planning",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    completed: {
      label: "Completed",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    archived: {
      label: "Archived",
      className: "bg-muted text-muted-foreground",
    },
  }[status];

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
