"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type WorkspaceStatus = "active" | "archived";

type WorkspaceProject = {
  id: string;
  name: string;
  description: string;
  status: WorkspaceStatus;
  updatedAt: string;
  color: string;
};

/*
 * PROJECTS ON THIS PAGE ARE REAL ROWS.
 *
 * This screen used to open on four invented projects — "SYRAVEN Core"
 * with 24 members, an "Agent Network" with 18 — held in useState and
 * seeded at module scope. Creating one more built an id out of the name
 * and Date.now() and unshifted it into that array, so it survived until
 * the next reload and no further.
 *
 * The worst of it was the link. Each card linked to
 * /projects/{project.id}, and those ids ("syraven-core") matched no row
 * in any table, so every card on the page led to a project that did not
 * exist.
 *
 * Projects now load from /api/projects, which is session-scoped and
 * RLS-enforced, and creation returns a server id. The links resolve
 * because the projects are real.
 */

/** A project row as this page consumes it. */
interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
}

/*
 * A stable colour per project, derived from its id.
 *
 * The seed data carried a hand-picked gradient per project. Real rows
 * have no colour column, and inventing one per render would make cards
 * flicker between loads, so it is derived deterministically instead.
 */
const PROJECT_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
] as const;

function colorForProject(id: string): string {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return PROJECT_COLORS[hash % PROJECT_COLORS.length]!;
}

function formatUpdatedAt(value: string): string {
  /*
   * A fixed slice of the ISO string, not toLocaleDateString(): the
   * server and the browser would format that differently and the
   * mismatch would surface as a hydration error.
   */
  return `Updated ${value.slice(0, 10)}`;
}

function toWorkspaceProject(
  row: ProjectRow,
): WorkspaceProject {
  return {
    id: row.id,
    name: row.name,
    description:
      row.description ?? "No description provided.",
    status:
      row.status === "archived" ? "archived" : "active",
    updatedAt: formatUpdatedAt(row.updated_at),
    color: colorForProject(row.id),
  };
}

export default function WorkspacePage() {
  const [projects, setProjects] =
    useState<WorkspaceProject[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [projectError, setProjectError] =
    useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setProjectError(null);

    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setProjects([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json()) as {
        data?: ProjectRow[];
      };

      setProjects(
        (payload.data ?? []).map(toWorkspaceProject),
      );
    } catch {
      setProjectError("Projects could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return loadProjects();
    });

    return () => {
      cancelled = true;
    };
  }, [loadProjects]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  /*
   * Fixed for now: nothing on this page edits them, and a setter that
   * is never called reads as an editor that was lost rather than one
   * that was never built.
   */
  const workspaceName = "SYRAVEN";

  const workspaceDescription =
    "The intelligent operating system for the future.";

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] =
    useState("");

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        query.length === 0 ||
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query);

      const matchesStatus =
        showArchived || project.status === "active";

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, showArchived]);

  const activeProjects = projects.filter(
    (project) => project.status === "active",
  ).length;

  const archivedProjects = projects.filter(
    (project) => project.status === "archived",
  ).length;


  const handleCreateProject = async () => {
    const name = newProjectName.trim();

    if (!name || isCreating) {
      return;
    }

    setIsCreating(true);
    setProjectError(null);

    try {
      /*
        The id comes from the SERVER. It used to be built from the
        project name plus Date.now(), which meant the card linked to
        /projects/<an id that existed nowhere>.
      */
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description:
            newProjectDescription.trim() || undefined,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as {
        data?: ProjectRow;
      } | null;

      const created = payload?.data;

      if (!response.ok || !created) {
        throw new Error("failed");
      }

      setProjects((current) => [
        toWorkspaceProject(created),
        ...current,
      ]);

      setNewProjectName("");
      setNewProjectDescription("");
      setShowCreateModal(false);
    } catch {
      setProjectError(
        "That project could not be created.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Header */}
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm text-white/40">
              <Link
                href="/"
                className="transition hover:text-white"
              >
                SYRAVEN
              </Link>

              <span>/</span>

              <span className="text-white/70">Workspace</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-bold shadow-lg shadow-violet-500/20">
                N
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {workspaceName}
                </h1>

                <p className="mt-1 text-sm text-white/45">
                  {workspaceDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/teams"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
            >
              Manage team
            </Link>

            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white"
            >
              Workspace settings
            </Link>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              + New project
            </button>
          </div>
        </div>

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active projects"
            value={activeProjects}
            description="Currently in progress"
          />

          <StatCard
            label="Archived projects"
            value={archivedProjects}
            description="Historical workspaces"
          />

          <StatCard
            label="Total projects"
            value={projects.length}
            description="Active and archived"
          />
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main content */}
          <section>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Projects
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Manage the initiatives and systems inside your workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className={[
                  "rounded-xl border px-4 py-2.5 text-sm transition",
                  showArchived
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
                ].join(" ")}
              >
                {showArchived
                  ? "Hide archived"
                  : "Show archived"}
              </button>
            </div>

            {/* Search */}
            <div className="mt-6">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  ⌕
                </span>

                <input
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="Search projects..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.05]"
                />
              </div>
            </div>

            {/* Projects */}
            {projectError ? (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
              >
                {projectError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {filteredProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-white/20 hover:bg-white/[0.045]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={[
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold",
                        project.color,
                      ].join(" ")}
                    >
                      {project.name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </div>

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        project.status === "active"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-white/[0.06] text-white/40",
                      ].join(" ")}
                    >
                      {project.status === "active"
                        ? "Active"
                        : "Archived"}
                    </span>
                  </div>

                  <h3 className="mt-5 font-semibold text-white transition group-hover:text-white/90">
                    {project.name}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-white/40">
                    {project.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/35">
                    <span className="capitalize">
                      {project.status}
                    </span>

                    <span>{project.updatedAt}</span>
                  </div>
                </Link>
              ))}
            </div>

            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center"
              >
                <p className="text-sm text-white/40">
                  Loading your projects...
                </p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
                <p className="font-medium">
                  {projects.length === 0
                    ? "No projects yet"
                    : "No projects found"}
                </p>

                <p className="mt-2 text-sm text-white/40">
                  {projects.length === 0
                    ? "Create your first project to start organising work."
                    : "Try a different search or create a new project."}
                </p>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Create project
                </button>
              </div>
            ) : null}
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/*
              The invented roster lived here: four people — "Emma Wilson,
              Research" and three others — hardcoded at module scope and
              presented as the workspace's collaborators, above a
              headcount derived from that same array.

              There is no members endpoint for a workspace yet, so this
              panel now points at the real place membership is managed
              rather than fabricating a list.
            */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="font-semibold">Team members</h2>

              <p className="mt-2 text-xs leading-5 text-white/35">
                Membership is managed for the whole organisation rather
                than per workspace.
              </p>

              <Link
                href="/teams"
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                Manage members
              </Link>
            </div>


            {/* Quick actions */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="font-semibold">
                Quick actions
              </h2>

              <div className="mt-4 space-y-2">
                <QuickLink
                  href="/projects/new"
                  title="Create project"
                  description="Start a new initiative"
                />

                <QuickLink
                  href="/knowledge"
                  title="Open knowledge"
                  description="Explore workspace intelligence"
                />

                <QuickLink
                  href="/tasks"
                  title="View tasks"
                  description="Manage active work"
                />

                <QuickLink
                  href="/settings"
                  title="Workspace settings"
                  description="Configure your environment"
                />
              </div>
            </div>

            {/* Workspace */}
            <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.08] to-indigo-500/[0.03] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-300/70">
                Workspace intelligence
              </p>

              <h3 className="mt-3 text-lg font-semibold">
                Everything connected
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Projects, agents, knowledge, tasks and collaboration
                operate from one unified workspace.
              </p>

              <Link
                href="/dashboard"
                className="mt-5 inline-flex text-sm font-medium text-violet-200 transition hover:text-white"
              >
                Open dashboard →
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Create project modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111114] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold">
                  Create new project
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Add a new initiative to your workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Project name
                </label>

                <input
                  value={newProjectName}
                  onChange={(event) =>
                    setNewProjectName(event.target.value)
                  }
                  placeholder="Enter project name"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">
                  Description
                </label>

                <textarea
                  value={newProjectDescription}
                  onChange={(event) =>
                    setNewProjectDescription(event.target.value)
                  }
                  placeholder="What is this project about?"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
                />
              </div>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleCreateProject();
                }}
                disabled={isCreating || !newProjectName.trim()}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isCreating ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  success = false,
}: {
  label: string;
  value: string | number;
  description: string;
  success?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <p className="text-sm text-white/40">
        {label}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className={[
            "text-2xl font-semibold tracking-tight",
            success ? "text-emerald-300" : "text-white",
          ].join(" ")}
        >
          {value}
        </p>
      </div>

      <p className="mt-2 text-xs text-white/30">
        {description}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div>
        <p className="text-sm font-medium text-white/75 transition group-hover:text-white">
          {title}
        </p>

        <p className="mt-0.5 text-xs text-white/35">
          {description}
        </p>
      </div>

      <span className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/70">
        →
      </span>
    </Link>
  );
}