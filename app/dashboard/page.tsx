"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { useWorkspace } from "../context/WorkspaceContext";

/*
  SYRAVEN — Home

  WHAT THIS PAGE ANSWERS

  "What needs me, what changed, and where do I start?" -- in that order.

    Needs you        the caller's live pending approvals, from
                     /api/agents/approvals. An agent step at high risk
                     stops and waits for a person; this is where that
                     waiting is visible without going looking for it.

    Recent activity  the newest events from /api/activity, which derives
                     them from timestamps on the caller's own rows.

    Start            links to the places work begins. Each is a route
                     that exists.

    Workspaces       unchanged in behaviour: the switcher and the create
                     flow, which must stay reachable in every state.

  WHAT IT USED TO BE

  Four counters -- total workspaces, active workspaces, team members,
  archived -- and a second panel repeating three of them. They were real
  numbers, but they answered "how many workspaces do I have", which is
  not what anyone opens a command center to learn.

  NOTHING HERE IS INVENTED

  Every item on this page is a row the caller owns or an approval
  addressed to them. When there is none, the page says so. Relative
  times are computed from the moment the data arrived, not from a clock
  read during render, so server and client markup always agree.
*/

interface PendingApproval {
  readonly id: string;
  readonly agentId: string;
  readonly toolId: string;
  readonly risk: string;
  readonly effect: string;
  readonly expiresAt: string;
}

interface ActivityEvent {
  readonly id: string;
  readonly kind: "project" | "task" | "knowledge" | "approval";
  readonly title: string;
  readonly detail: string;
  readonly tone: "success" | "progress" | "pending" | "failed" | "info";
  readonly occurredAt: string;
  readonly href: string | null;
}

const TONE_DOT: Record<ActivityEvent["tone"], string> = {
  success: "bg-success",
  progress: "bg-info",
  pending: "bg-warning",
  failed: "bg-destructive",
  info: "bg-muted-foreground",
};

const START: readonly { href: string; label: string; detail: string }[] = [
  { href: "/projects/new", label: "New project", detail: "Give the work a home" },
  { href: "/tasks", label: "Tasks", detail: "Plan and track the next step" },
  { href: "/knowledge", label: "Teach the Brain", detail: "Add what SYRAVEN should know" },
  { href: "/agents", label: "Run an agent", detail: "Hand a goal to an agent" },
];

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

/** Relative to `now`, which is the load moment -- never a render-time clock. */
function formatAgo(value: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(value)) / 1000));

  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return formatDate(value);
}

function formatLeft(expiresAt: string, now: number): string {
  const minutes = Math.floor((Date.parse(expiresAt) - now) / 60_000);

  if (!Number.isFinite(minutes) || minutes < 0) return "expiring";
  if (minutes < 1) return "under a minute left";

  return minutes === 1 ? "1 minute left" : `${minutes} minutes left`;
}

/*
  Reads the CLOCK, so it must not run during render.

  This page is a client component, but Next.js still prerenders it on
  the server. The greeting was computed once there and again in the
  browser: whenever the two land either side of noon or 18:00 -- or
  simply in different timezones -- the markup disagreed and React
  threw a hydration mismatch (#418), observed on /dashboard in
  production on both desktop and mobile.

  It is now resolved after mount, so the server and the first client
  render always agree.
*/
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
    createWorkspace,
    isCreating,
  } = useWorkspace();

  /*
    Empty on the server and on the first client render, so the two
    always match; the real greeting appears immediately after
    hydration. useSyncExternalStore is the sanctioned way to express
    a value that legitimately differs between server and client --
    the same pattern this codebase already uses on /chat.
  */
  const greeting = useSyncExternalStore(
    () => () => {},
    () => getGreeting(),
    () => "Welcome back",
  );

  const [showCreate, setShowCreate] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [approvalsFailed, setApprovalsFailed] = useState(false);
  const [activityFailed, setActivityFailed] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const loadSignals = useCallback(async () => {
    setSignalsLoading(true);

    const [approvalResult, activityResult] = await Promise.allSettled([
      fetch("/api/agents/approvals", { cache: "no-store" }),
      fetch("/api/activity", { cache: "no-store" }),
    ]);

    /* Each source fails on its own; one outage does not blank the other. */
    if (approvalResult.status === "fulfilled" && approvalResult.value.ok) {
      const payload = (await approvalResult.value.json().catch(() => null)) as {
        data?: { approvals?: PendingApproval[] };
      } | null;

      setApprovals(payload?.data?.approvals ?? []);
      setApprovalsFailed(false);
    } else if (approvalResult.status === "fulfilled" && approvalResult.value.status === 401) {
      setApprovals([]);
      setApprovalsFailed(false);
    } else {
      setApprovalsFailed(true);
    }

    if (activityResult.status === "fulfilled" && activityResult.value.ok) {
      const payload = (await activityResult.value.json().catch(() => null)) as {
        data?: { events?: ActivityEvent[] };
      } | null;

      setEvents((payload?.data?.events ?? []).slice(0, 6));
      setActivityFailed(false);
    } else if (activityResult.status === "fulfilled" && activityResult.value.status === 401) {
      setEvents([]);
      setActivityFailed(false);
    } else {
      setActivityFailed(true);
    }

    setLoadedAt(Date.now());
    setSignalsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return loadSignals();
    });

    return () => {
      cancelled = true;
    };
  }, [loadSignals]);

  const now = loadedAt ?? 0;

  async function handleCreateWorkspace() {
    const name = newWorkspaceName.trim();

    if (!name) {
      setCreateError("Enter a workspace name.");
      return;
    }

    setCreateError(null);

    try {
      await createWorkspace({ name });

      setNewWorkspaceName("");
      setShowCreate(false);
    } catch (creationError) {
      setCreateError(
        creationError instanceof Error
          ? creationError.message
          : "Failed to create workspace.",
      );
    }
  }

  const recentWorkspaces = useMemo(
    () =>
      [...workspaces]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime(),
        )
        .slice(0, 5),
    [workspaces],
  );

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {signalsLoading
                ? "Checking what needs you..."
                : approvals.length > 0
                  ? approvals.length === 1
                    ? "One agent step is waiting for your decision."
                    : `${approvals.length} agent steps are waiting for your decision.`
                  : "Nothing is waiting on you. Here is what changed recently."}
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
                  setActiveWorkspaceId(event.target.value || null)
                }
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <nav aria-label="Start" className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {START.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/50"
            >
              <span className="block text-sm font-semibold text-foreground">
                {entry.label}
              </span>

              <span className="mt-1 block text-xs text-muted-foreground">
                {entry.detail}
              </span>
            </Link>
          ))}
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section
              aria-labelledby="needs-you-title"
              className={`rounded-2xl border bg-card ${
                approvals.length > 0 ? "border-warning/40" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 id="needs-you-title" className="text-lg font-semibold">
                  Needs you
                </h2>

                <Link href="/approvals" className="text-sm font-medium text-primary hover:underline">
                  Approvals
                </Link>
              </div>

              <div className="px-5 py-4">
                {signalsLoading ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading...
                  </p>
                ) : approvalsFailed ? (
                  <p role="alert" className="text-sm text-destructive">
                    Pending approvals could not be loaded.
                  </p>
                ) : approvals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No agent step is waiting for a decision. High-risk steps
                    stop here until you approve them.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {approvals.slice(0, 3).map((approval) => (
                      <li
                        key={approval.id}
                        className="rounded-xl border border-border bg-background p-3"
                      >
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-medium text-warning">
                            {approval.risk} risk
                          </span>
                          <span className="font-mono">{approval.toolId}</span>
                          <span>{approval.agentId}</span>
                          <span className="ml-auto">{formatLeft(approval.expiresAt, now)}</span>
                        </p>

                        <p className="mt-2 text-sm text-foreground">{approval.effect}</p>
                      </li>
                    ))}

                    {approvals.length > 3 ? (
                      <li className="text-sm text-muted-foreground">
                        and {approvals.length - 3} more on the approvals page.
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="recent-activity-title" className="rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 id="recent-activity-title" className="text-lg font-semibold">
                  Recent activity
                </h2>

                <Link href="/activity" className="text-sm font-medium text-primary hover:underline">
                  All activity
                </Link>
              </div>

              <div className="px-5 py-2">
                {signalsLoading ? (
                  <p role="status" className="py-3 text-sm text-muted-foreground">
                    Loading...
                  </p>
                ) : activityFailed ? (
                  <p role="alert" className="py-3 text-sm text-destructive">
                    Recent activity could not be loaded.
                  </p>
                ) : events.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">
                    Nothing has happened yet. Create a project or a task and
                    it appears here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {events.map((event) => {
                      const body = (
                        <span className="flex items-start gap-3 py-3">
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[event.tone]}`}
                          />

                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {event.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {event.detail}
                            </span>
                          </span>

                          <time
                            dateTime={event.occurredAt}
                            className="shrink-0 text-xs text-muted-foreground"
                          >
                            {formatAgo(event.occurredAt, now)}
                          </time>
                        </span>
                      );

                      return (
                        <li key={event.id}>
                          {event.href ? (
                            <Link href={event.href} className="block rounded-lg hover:bg-muted/50">
                              {body}
                            </Link>
                          ) : (
                            body
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">Recent Workspaces</h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Your most recently updated workspaces.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreate((open) => !open)}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  disabled={isCreating}
                >
                  {showCreate ? "Cancel" : "New workspace"}
                </button>
              </div>

              {showCreate ? (
                <div className="border-b border-border px-5 py-4">
                  <label className="sr-only" htmlFor="dashboard-new-workspace">
                    Workspace name
                  </label>

                  <input
                    id="dashboard-new-workspace"
                    value={newWorkspaceName}
                    onChange={(event) => setNewWorkspaceName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleCreateWorkspace();
                      }
                    }}
                    placeholder="e.g. Product Team"
                    maxLength={120}
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-foreground/30"
                  />

                  {createError ? (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      {createError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleCreateWorkspace()}
                    disabled={isCreating}
                    className="mt-3 h-11 w-full rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreating ? "Creating..." : "Create workspace"}
                  </button>
                </div>
              ) : null}

              <div className="divide-y divide-border">
                {isLoading ? (
                  <p role="status" className="p-5 text-sm text-muted-foreground">
                    Loading your workspaces...
                  </p>
                ) : recentWorkspaces.length > 0 ? (
                  recentWorkspaces.map((workspace) => {
                    const isActive = workspace.id === activeWorkspaceId;

                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        onClick={() => setActiveWorkspaceId(workspace.id)}
                        aria-pressed={isActive}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-muted/50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-sm font-bold"
                            style={{ backgroundColor: workspace.color ?? undefined }}
                          >
                            {workspace.icon ?? workspace.name.charAt(0).toUpperCase()}
                          </span>

                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium">{workspace.name}</span>

                              {isActive && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  ACTIVE
                                </span>
                              )}
                            </span>

                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              Updated {formatDate(workspace.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-5 py-10 text-center">
                    <h3 className="font-semibold">No workspaces yet</h3>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Create your first workspace to start organizing
                      projects, tasks, and collaboration.
                    </p>

                    {/*
                      The action the copy above asks for. Without it this
                      empty state was a dead end for every new account.
                    */}
                    <button
                      type="button"
                      onClick={() => setShowCreate(true)}
                      className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition hover:opacity-90"
                    >
                      Create workspace
                    </button>
                  </div>
                )}
              </div>
            </section>

            {activeWorkspace ? (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Current workspace
                </h2>

                <p className="mt-3 truncate text-lg font-semibold">{activeWorkspace.name}</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Members</dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {activeWorkspace.members.length}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="mt-1 font-semibold capitalize">{activeWorkspace.status}</dd>
                  </div>
                </dl>

                <p className="mt-4 text-xs text-muted-foreground">
                  Created {formatDate(activeWorkspace.createdAt)}
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
