"use client";

import { useMemo } from "react";
import { useWorkspace } from "../context/WorkspaceContext";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function DashboardPage() {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isLoading,
    error,
    setActiveWorkspaceId,
  } = useWorkspace();

  const dashboardData = useMemo(() => {
    const activeWorkspaces = workspaces.filter(
      (workspace) => workspace.status === "active"
    );

    const archivedWorkspaces = workspaces.filter(
      (workspace) => workspace.status === "archived"
    );

    const totalMembers = workspaces.reduce(
      (total, workspace) =>
        total + workspace.members.length,
      0
    );

    const recentWorkspaces = [...workspaces]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
      )
      .slice(0, 5);

    return {
      activeWorkspaces,
      archivedWorkspaces,
      totalMembers,
      recentWorkspaces,
    };
  }, [workspaces]);

  const stats = [
    {
      label: "Total Workspaces",
      value: workspaces.length,
      description: "All your workspaces",
    },
    {
      label: "Active Workspaces",
      value: dashboardData.activeWorkspaces.length,
      description: "Currently active",
    },
    {
      label: "Team Members",
      value: dashboardData.totalMembers,
      description: "Across all workspaces",
    },
    {
      label: "Archived",
      value: dashboardData.archivedWorkspaces.length,
      description: "Previous workspaces",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                SYRA Workspace
              </p>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {getGreeting()}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage your workspaces, monitor activity, and keep
                your projects moving forward from one central place.
              </p>
            </div>

            {workspaces.length > 0 && (
              <div className="w-full lg:w-72">
                <label
                  htmlFor="workspace"
                  className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Active Workspace
                </label>

                <select
                  id="workspace"
                  value={activeWorkspaceId ?? ""}
                  onChange={(event) =>
                    setActiveWorkspaceId(
                      event.target.value || null
                    )
                  }
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {workspaces.map((workspace) => (
                    <option
                      key={workspace.id}
                      value={workspace.id}
                    >
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight">
                {stat.value}
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                {stat.description}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Recent Workspaces
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Your most recently updated workspaces.
                </p>
              </div>
            </div>

            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="space-y-4 p-5">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-xl bg-muted"
                    />
                  ))}
                </div>
              ) : dashboardData.recentWorkspaces.length > 0 ? (
                dashboardData.recentWorkspaces.map(
                  (workspace) => {
                    const isActive =
                      workspace.id === activeWorkspaceId;

                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        onClick={() =>
                          setActiveWorkspaceId(workspace.id)
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-muted/50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-sm font-bold"
                            style={{
                              backgroundColor:
                                workspace.color ??
                                undefined,
                            }}
                          >
                            {workspace.icon ??
                              workspace.name
                                .charAt(0)
                                .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">
                                {workspace.name}
                              </p>

                              {isActive && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  ACTIVE
                                </span>
                              )}
                            </div>

                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {workspace.description ||
                                "No description provided"}
                            </p>
                          </div>
                        </div>

                        <div className="hidden shrink-0 text-right sm:block">
                          <p className="text-xs text-muted-foreground">
                            {workspace.members.length} members
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Updated{" "}
                            {formatDate(
                              workspace.updatedAt
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  }
                )
              ) : (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-xl">
                    ◈
                  </div>

                  <h3 className="mt-4 font-semibold">
                    No workspaces yet
                  </h3>

                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Create your first workspace to start organizing
                    projects, tasks, and collaboration.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">
                Current Workspace
              </h2>

              {activeWorkspace ? (
                <div className="mt-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted text-lg font-bold"
                      style={{
                        backgroundColor:
                          activeWorkspace.color ??
                          undefined,
                      }}
                    >
                      {activeWorkspace.icon ??
                        activeWorkspace.name
                          .charAt(0)
                          .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">
                        {activeWorkspace.name}
                      </h3>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {activeWorkspace.members.length} team members
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Status
                      </p>

                      <p className="mt-1 text-sm font-semibold capitalize">
                        {activeWorkspace.status}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Visibility
                      </p>

                      <p className="mt-1 text-sm font-semibold capitalize">
                        {
                          activeWorkspace.settings
                            .visibility
                        }
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-xs leading-5 text-muted-foreground">
                    Created{" "}
                    {formatDate(
                      activeWorkspace.createdAt
                    )}
                  </p>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Select a workspace to view details.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">
                Workspace Overview
              </h2>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Active
                  </span>

                  <span className="text-sm font-semibold">
                    {
                      dashboardData.activeWorkspaces
                        .length
                    }
                  </span>
                </div>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Archived
                  </span>

                  <span className="text-sm font-semibold">
                    {
                      dashboardData.archivedWorkspaces
                        .length
                    }
                  </span>
                </div>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Members
                  </span>

                  <span className="text-sm font-semibold">
                    {dashboardData.totalMembers}
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}