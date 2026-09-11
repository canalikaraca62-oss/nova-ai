"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { GraphEdge, GraphNode } from "./GraphScene";

/*
  SYRAVEN — Work Graph

  WHAT THIS IS

  The structure of a person's work, drawn from the relationships that
  actually exist in the database:

    workspace --contains--> project   (projects.workspace_id)
    project   --contains--> task      (tasks.project_id)

  Both are real foreign keys, and every row arrives through an
  authorized, session-scoped API. Nothing here is inferred. If two
  things are connected on screen, the schema says they are.

  WHAT IS DELIBERATELY ABSENT

  public.ai_memory_relations would be the richer source — typed
  relations with a strength score — and it exists, with row level
  security enabled and an ownership policy that joins through
  ai_memories.user_id.

  It is unused here for a simpler reason: nothing in the product writes
  to it. No API route, no service, no UI touches that table, so it holds
  zero rows and a view of it would draw nothing. Wiring it up means
  building the producer first, not adding a query here.

  Agents, documents, decisions and outcomes are not here either. The
  product has no edge data for them, and a graph that invents
  relationships to look complete is worth less than one that shows only
  what is true.
*/

/* Three is ~23 MB. It must never enter another page's bundle. */
const GraphScene = dynamic(() => import("./GraphScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-2xl border border-border bg-card text-sm text-foreground/50">
      Preparing the spatial view...
    </div>
  ),
});

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

interface WorkspaceRow {
  id: string;
  name: string;
}

interface ProjectRow {
  id: string;
  name: string;
  workspace_id: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  project_id: string | null;
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function GraphPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setGraphError(null);

    try {
      const [workspaceResponse, projectResponse, taskResponse] =
        await Promise.all([
          fetch("/api/workspaces", { cache: "no-store" }),
          fetch("/api/projects", { cache: "no-store" }),
          fetch("/api/tasks", { cache: "no-store" }),
        ]);

      if (
        workspaceResponse.status === 401 ||
        projectResponse.status === 401 ||
        taskResponse.status === 401
      ) {
        setWorkspaces([]);
        setProjects([]);
        setTasks([]);
        return;
      }

      /*
        Each route wraps its rows differently, and assuming a shared
        envelope would have failed silently here: /api/workspaces
        returns `workspaces`, not `data`, so every workspace node and
        every workspace->project edge would have vanished and the page
        would have read "Nothing to map yet" forever.
      */
      const workspacePayload = (await workspaceResponse
        .json()
        .catch(() => null)) as { workspaces?: WorkspaceRow[] } | null;

      const projectPayload = (await projectResponse
        .json()
        .catch(() => null)) as { data?: ProjectRow[] } | null;

      const taskPayload = (await taskResponse.json().catch(() => null)) as {
        data?: { tasks?: TaskRow[] };
      } | null;

      setWorkspaces(workspacePayload?.workspaces ?? []);
      setProjects(projectPayload?.data ?? []);
      setTasks(taskPayload?.data?.tasks ?? []);
    } catch {
      setGraphError("The work graph could not be loaded.");
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

  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = [
      ...workspaces.map((workspace) => ({
        id: `w:${workspace.id}`,
        label: workspace.name,
        kind: "workspace" as const,
      })),
      ...projects.map((project) => ({
        id: `p:${project.id}`,
        label: project.name,
        kind: "project" as const,
      })),
      ...tasks.map((task) => ({
        id: `t:${task.id}`,
        label: task.title,
        kind: "task" as const,
      })),
    ];

    const known = new Set(graphNodes.map((node) => node.id));

    /*
      An edge is only drawn when BOTH ends are present. A project whose
      workspace the caller cannot see must not sprout a line to nowhere,
      and a dangling edge would imply a relationship the user cannot
      verify.
    */
    const graphEdges: GraphEdge[] = [];

    for (const project of projects) {
      if (!project.workspace_id) continue;

      const from = `w:${project.workspace_id}`;
      const to = `p:${project.id}`;

      if (known.has(from) && known.has(to)) {
        graphEdges.push({ from, to });
      }
    }

    for (const task of tasks) {
      if (!task.project_id) continue;

      const from = `p:${task.project_id}`;
      const to = `t:${task.id}`;

      if (known.has(from) && known.has(to)) {
        graphEdges.push({ from, to });
      }
    }

    return { nodes: graphNodes, edges: graphEdges };
  }, [workspaces, projects, tasks]);

  /** Projects grouped under their workspace, for the readable view. */
  const grouped = useMemo(() => {
    return workspaces.map((workspace) => ({
      workspace,
      projects: projects
        .filter((project) => project.workspace_id === workspace.id)
        .map((project) => ({
          project,
          tasks: tasks.filter((task) => task.project_id === project.id),
        })),
    }));
  }, [workspaces, projects, tasks]);

  const orphanProjects = useMemo(
    () => projects.filter((project) => !project.workspace_id),
    [projects],
  );

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Work graph
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/50">
            How your work connects: workspaces hold projects, and
            projects hold tasks. Every connection shown here comes from
            a real link in your data.
          </p>
        </header>

        {graphError ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {graphError}
          </div>
        ) : null}

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-8 flex h-[480px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-sm text-foreground/50"
          >
            Loading your work graph...
          </div>
        ) : nodes.length === 0 ? (
          <div className="mt-8 flex h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center">
            <h2 className="text-lg font-semibold">Nothing to map yet</h2>

            <p className="mt-2 max-w-sm text-sm leading-6 text-foreground/50">
              Once you have a workspace with projects and tasks in it,
              their structure appears here.
            </p>

            <Link
              href="/projects"
              className="mt-5 text-sm font-medium text-primary hover:underline"
            >
              Go to projects
            </Link>
          </div>
        ) : (
          <>
            <section className="mt-8">
              <GraphScene nodes={nodes} edges={edges} />

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-foreground/45">
                <Legend color="bg-foreground" label="Workspace" />
                <Legend color="bg-violet-500" label="Project" />
                <Legend color="bg-cyan-400" label="Task" />

                <span className="ml-auto">
                  {nodes.length} node{nodes.length === 1 ? "" : "s"}
                  {" · "}
                  {edges.length} connection
                  {edges.length === 1 ? "" : "s"}
                </span>
              </div>
            </section>

            {/*
              The same structure, readable. A picture of a graph is not
              navigable on a phone, and a spatial view nobody can use is
              decoration — so the relationships are always available as
              text, not only when WebGL is missing.
            */}
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                Structure
              </h2>

              <div className="mt-4 space-y-4">
                {grouped.map(({ workspace, projects: workspaceProjects }) => (
                  <div
                    key={workspace.id}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <h3 className="font-semibold">{workspace.name}</h3>

                    {workspaceProjects.length === 0 ? (
                      <p className="mt-2 text-sm text-foreground/40">
                        No projects in this workspace yet.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {workspaceProjects.map(
                          ({ project, tasks: projectTasks }) => (
                            <li key={project.id}>
                              <Link
                                href={`/projects/${project.id}`}
                                className="text-sm font-medium text-foreground hover:underline"
                              >
                                {project.name}
                              </Link>

                              <span className="ml-2 text-xs text-foreground/40">
                                {projectTasks.length} task
                                {projectTasks.length === 1 ? "" : "s"}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                  </div>
                ))}

                {orphanProjects.length > 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
                    <h3 className="text-sm font-semibold text-foreground/70">
                      Not in a workspace
                    </h3>

                    <ul className="mt-3 space-y-2">
                      {orphanProjects.map((project) => (
                        <li key={project.id}>
                          <Link
                            href={`/projects/${project.id}`}
                            className="text-sm text-foreground/70 hover:underline"
                          >
                            {project.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${color}`}
      />
      {label}
    </span>
  );
}
