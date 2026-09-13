"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogBehaviour } from "@/app/components/ui/useDialogBehaviour";

/*
  SYRAVEN — Activity

  WHERE THESE EVENTS COME FROM

  GET /api/activity, which reads the caller's own projects, tasks, Brain
  records and agent approvals and derives events from their timestamp
  columns (lib/activity/events.ts). Every entry is either "this row was
  created then", "this row was last changed then", or a terminal moment
  a column records explicitly -- completed_at, decided_at, expires_at.

  WHAT IT USED TO SHOW

  Eight invented events presented as the user's own history ("Research
  Agent completed a market analysis", "24 sources"), each stamped "2
  minutes ago" and flagged unread. After those went, the page still
  carried a pulsing "Live activity feed" badge over a feed that was
  never live, a panel reporting "AI activity: Active" and "Automations:
  Healthy" when no automation exists, and "Mark all as read" over read
  state that nothing stores and a reload discarded.

  All of that is gone. There is no unread concept because nothing
  records reads. The feed is not live, so it says when it was loaded and
  offers a refresh that actually refetches. Categories are limited to
  the four that have a source, so no filter permanently reads zero.
*/

type ActivityKind = "project" | "task" | "knowledge" | "approval";

type ActivityTone = "success" | "progress" | "pending" | "failed" | "info";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  tone: ActivityTone;
  occurredAt: string;
  href: string | null;
};

type KindFilter = "all" | ActivityKind;

type TimeFilter = "all" | "today" | "week";

const KINDS: readonly ActivityKind[] = ["project", "task", "knowledge", "approval"];

const KIND: Record<ActivityKind, { label: string; mark: string }> = {
  project: { label: "Projects", mark: "◫" },
  task: { label: "Tasks", mark: "✓" },
  knowledge: { label: "Brain", mark: "◇" },
  approval: { label: "Approvals", mark: "◈" },
};

const TONE: Record<ActivityTone, { label: string; badge: string; dot: string }> = {
  success: {
    label: "Done",
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  progress: {
    label: "In progress",
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
  },
  pending: {
    label: "Waiting on you",
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  failed: {
    label: "Needs attention",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  info: {
    label: "Recorded",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

const DAY_MS = 86_400_000;

/** Local midnight of the day containing `ms`. */
function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayGroup(occurredAt: string, now: number): "Today" | "Yesterday" | "Earlier" {
  const at = Date.parse(occurredAt);
  const today = startOfDay(now);

  if (at >= today) return "Today";
  if (at >= today - DAY_MS) return "Yesterday";
  return "Earlier";
}

/** Relative to the moment the feed was loaded, not to a clock read during render. */
function formatWhen(occurredAt: string, now: number): string {
  const at = Date.parse(occurredAt);
  const seconds = Math.max(0, Math.round((now - at) / 1000));

  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: new Date(at).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  }).format(at);
}

function formatExact(occurredAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(Date.parse(occurredAt));
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string[]>([]);

  /** When the feed was fetched. Times are shown relative to this. */
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const [kind, setKind] = useState<KindFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/activity", { cache: "no-store" });

      if (response.status === 401) {
        setActivities([]);
        setDegraded([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: { events?: ActivityItem[]; degraded?: string[] };
      } | null;

      setActivities(payload?.data?.events ?? []);
      setDegraded(payload?.data?.degraded ?? []);
      setLoadedAt(Date.now());
    } catch {
      setLoadError("Your activity could not be loaded.");
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

  const now = loadedAt ?? 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((activity) => {
      if (kind !== "all" && activity.kind !== kind) return false;

      if (timeFilter === "today" && dayGroup(activity.occurredAt, now) !== "Today") {
        return false;
      }

      if (timeFilter === "week" && now - Date.parse(activity.occurredAt) > 7 * DAY_MS) {
        return false;
      }

      if (!query) return true;

      return (
        activity.title.toLowerCase().includes(query) ||
        activity.detail.toLowerCase().includes(query)
      );
    });
  }, [activities, kind, timeFilter, search, now]);

  const grouped = useMemo(() => {
    const groups: Record<"Today" | "Yesterday" | "Earlier", ActivityItem[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const activity of filtered) groups[dayGroup(activity.occurredAt, now)].push(activity);

    return groups;
  }, [filtered, now]);

  const counts = useMemo(() => {
    const byTone = (tone: ActivityTone) =>
      activities.filter((activity) => activity.tone === tone).length;

    return {
      total: activities.length,
      done: byTone("success"),
      waiting: byTone("pending"),
      attention: byTone("failed"),
    };
  }, [activities]);

  const kindCount = (value: KindFilter) =>
    value === "all"
      ? activities.length
      : activities.filter((activity) => activity.kind === value).length;

  const filtersActive = kind !== "all" || timeFilter !== "all" || search.trim() !== "";

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              What has changed across your projects, tasks, Brain and agent
              approvals, newest first. Each entry comes from a timestamp
              recorded on the item itself.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {loadedAt !== null && !isLoading ? (
              <span className="text-xs text-muted-foreground">
                Loaded {formatWhen(new Date(loadedAt).toISOString(), loadedAt)}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => void load()}
              disabled={isLoading}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        <section
          aria-label="Summary"
          className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <Stat label="Events" value={counts.total} />
          <Stat label="Done" value={counts.done} tone="success" />
          <Stat label="Waiting on you" value={counts.waiting} tone="pending" />
          <Stat label="Needs attention" value={counts.attention} tone="failed" />
        </section>

        {counts.waiting > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
            <span>
              {counts.waiting === 1
                ? "An agent step is waiting for your decision."
                : `${counts.waiting} agent steps are waiting for your decision.`}
            </span>

            <Link href="/approvals" className="font-medium text-warning hover:underline">
              Review approvals
            </Link>
          </div>
        ) : null}

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

        {degraded.length > 0 ? (
          <p
            role="status"
            className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            Some sources could not be read ({degraded.join(", ")}), so this
            timeline is incomplete.
          </p>
        ) : null}

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="activity-search" className="sr-only">
              Search activity
            </label>

            <input
              id="activity-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activity..."
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/30 sm:max-w-sm"
            />

            <label htmlFor="activity-time" className="sr-only">
              Time range
            </label>

            <select
              id="activity-time"
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by kind">
            <KindChip
              label="All"
              count={kindCount("all")}
              active={kind === "all"}
              onClick={() => setKind("all")}
            />

            {KINDS.map((value) => (
              <KindChip
                key={value}
                label={KIND[value].label}
                mark={KIND[value].mark}
                count={kindCount(value)}
                active={kind === value}
                onClick={() => setKind(value)}
              />
            ))}
          </div>
        </section>

        <section className="mt-6" aria-label="Timeline">
          {isLoading && activities.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground"
            >
              Loading your activity...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">
                {filtersActive ? "Nothing matches these filters" : "Nothing has happened yet"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {filtersActive
                  ? "Try a wider time range or a different kind."
                  : "Create a project, add a task or teach the Brain something, and it appears here."}
              </p>

              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setKind("all");
                    setTimeFilter("all");
                    setSearch("");
                  }}
                  className="mt-5 text-sm font-medium text-primary hover:underline"
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/projects"
                  className="mt-5 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Go to projects
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {(["Today", "Yesterday", "Earlier"] as const).map((group) =>
                grouped[group].length === 0 ? null : (
                  <div key={group}>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </h2>

                    <ul className="space-y-2">
                      {grouped[group].map((activity) => (
                        <li key={activity.id}>
                          <ActivityRow
                            activity={activity}
                            now={now}
                            onSelect={() => setSelected(activity)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <ActivityDetail activity={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: ActivityTone;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {tone ? (
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} />
        ) : null}
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function KindChip({
  label,
  mark,
  count,
  active,
  onClick,
}: {
  label: string;
  mark?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors ${
        active
          ? "border-foreground/30 bg-foreground/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {mark ? <span aria-hidden="true">{mark}</span> : null}
      {label}
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
    </button>
  );
}

function ActivityRow({
  activity,
  now,
  onSelect,
}: {
  activity: ActivityItem;
  now: number;
  onSelect: () => void;
}) {
  const tone = TONE[activity.tone];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-base"
      >
        {KIND[activity.kind].mark}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-foreground">{activity.title}</span>

          <time
            dateTime={activity.occurredAt}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {formatWhen(activity.occurredAt, now)}
          </time>
        </span>

        <span className="mt-1 block truncate text-sm text-muted-foreground">
          {activity.detail}
        </span>

        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.badge}`}
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {tone.label}
        </span>
      </span>
    </button>
  );
}

function ActivityDetail({
  activity,
  onClose,
}: {
  activity: ActivityItem;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useDialogBehaviour({ open: true, onClose, panelRef });

  const tone = TONE[activity.tone];

  return (
    <div
      className="motion-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-detail-title"
        className="motion-dialog w-full max-w-lg rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.badge}`}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {tone.label}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity details"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        <h2 id="activity-detail-title" className="mt-4 text-xl font-semibold tracking-tight">
          {activity.title}
        </h2>

        <p className="mt-2 break-words text-sm text-muted-foreground">{activity.detail}</p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Kind</dt>
            <dd className="mt-1 text-sm font-medium">{KIND[activity.kind].label}</dd>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">When</dt>
            <dd className="mt-1 text-sm font-medium">
              <time dateTime={activity.occurredAt}>{formatExact(activity.occurredAt)}</time>
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Close
          </button>

          {activity.href ? (
            <Link
              href={activity.href}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
