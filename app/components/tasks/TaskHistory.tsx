"use client";

import type { ReactNode } from "react";

import {
  Activity,
  Bot,
  Calendar,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  Flag,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  User,
  XCircle,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type TaskHistoryEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "priority_changed"
  | "assigned"
  | "unassigned"
  | "subtask_added"
  | "subtask_completed"
  | "subtask_removed"
  | "comment"
  | "scheduled"
  | "started"
  | "completed"
  | "cancelled"
  | "deleted"
  | "automation";

export type TaskHistoryActor = {
  id: string;
  name: string;
  avatar?: string;
  type?: "user" | "agent" | "system";
};

export type TaskHistoryEvent = {
  id: string;

  type: TaskHistoryEventType;

  title: string;

  description?: string;

  createdAt: string;

  actor?: TaskHistoryActor;

  metadata?: Record<string, string | number | boolean | null>;
};

export type TaskHistoryProps = {
  events?: TaskHistoryEvent[];

  onEventClick?: (
    event: TaskHistoryEvent
  ) => void;

  className?: string;

  compact?: boolean;

  emptyTitle?: string;

  emptyDescription?: string;
};

/* ==================================================
   HELPERS
================================================== */

function getEventIcon(
  type: TaskHistoryEventType
): ReactNode {
  switch (type) {
    case "created":
      return <Plus className="h-4 w-4" />;

    case "updated":
      return <Edit3 className="h-4 w-4" />;

    case "status_changed":
      return <RotateCcw className="h-4 w-4" />;

    case "priority_changed":
      return <Flag className="h-4 w-4" />;

    case "assigned":
      return <User className="h-4 w-4" />;

    case "unassigned":
      return <User className="h-4 w-4" />;

    case "subtask_added":
      return <ListChecks className="h-4 w-4" />;

    case "subtask_completed":
      return (
        <CheckCircle2 className="h-4 w-4" />
      );

    case "subtask_removed":
      return <Trash2 className="h-4 w-4" />;

    case "comment":
      return <FileText className="h-4 w-4" />;

    case "scheduled":
      return <Calendar className="h-4 w-4" />;

    case "started":
      return <Play className="h-4 w-4" />;

    case "completed":
      return (
        <CheckCircle2 className="h-4 w-4" />
      );

    case "cancelled":
      return <XCircle className="h-4 w-4" />;

    case "deleted":
      return <Trash2 className="h-4 w-4" />;

    case "automation":
      return <Bot className="h-4 w-4" />;

    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getEventClasses(
  type: TaskHistoryEventType
): string {
  switch (type) {
    case "created":
      return "bg-primary/10 text-primary";

    case "updated":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";

    case "status_changed":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";

    case "priority_changed":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";

    case "assigned":
      return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";

    case "unassigned":
      return "bg-muted text-muted-foreground";

    case "subtask_added":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";

    case "subtask_completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

    case "subtask_removed":
      return "bg-destructive/10 text-destructive";

    case "comment":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";

    case "scheduled":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";

    case "started":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";

    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

    case "cancelled":
      return "bg-destructive/10 text-destructive";

    case "deleted":
      return "bg-destructive/10 text-destructive";

    case "automation":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";

    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatHistoryDate(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatRelativeTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = Date.now();

  const difference =
    now - date.getTime();

  const seconds = Math.floor(
    difference / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days}d ago`;
  }

  return formatHistoryDate(value);
}

/* ==================================================
   DATE GROUPING
================================================== */

type HistoryGroup = {
  label: string;
  events: TaskHistoryEvent[];
};

function getDateGroupLabel(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Earlier";
  }

  const today = new Date();

  const currentDay =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();

  const eventDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();

  const difference =
    Math.round(
      (currentDay - eventDay) /
        (1000 * 60 * 60 * 24)
    );

  if (difference === 0) {
    return "Today";
  }

  if (difference === 1) {
    return "Yesterday";
  }

  if (difference < 7) {
    return "This week";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function groupHistoryEvents(
  events: TaskHistoryEvent[]
): HistoryGroup[] {
  const groups = new Map<
    string,
    TaskHistoryEvent[]
  >();

  const sortedEvents =
    [...events].sort(
      (
        first: TaskHistoryEvent,
        second: TaskHistoryEvent
      ): number =>
        new Date(
          second.createdAt
        ).getTime() -
        new Date(
          first.createdAt
        ).getTime()
    );

  for (
    const event of sortedEvents
  ) {
    const label =
      getDateGroupLabel(
        event.createdAt
      );

    const current =
      groups.get(label) ?? [];

    current.push(event);

    groups.set(
      label,
      current
    );
  }

  return Array.from(
    groups.entries()
  ).map(
    (
      [label, groupedEvents]
    ): HistoryGroup => ({
      label,
      events: groupedEvents,
    })
  );
}

/* ==================================================
   COMPONENT
================================================== */

export default function TaskHistory({
  events = [],
  onEventClick,
  className = "",
  compact = false,
  emptyTitle = "No activity yet",
  emptyDescription = "Task activity will appear here as the task progresses.",
}: TaskHistoryProps): ReactNode {
  const groups =
    groupHistoryEvents(events);

  return (
    <section
      className={[
        "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      {!compact ? (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />

              <h2 className="text-lg font-semibold">
                Task history
              </h2>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              A complete timeline of changes,
              activity and automation events.
            </p>
          </div>

          {events.length > 0 ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border/60 px-3 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />

              {events.length}{" "}
              {events.length === 1
                ? "event"
                : "events"}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* =========================================
          EMPTY STATE
      ========================================== */}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>

          <h3 className="mt-4 font-medium">
            {emptyTitle}
          </h3>

          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(
            (
              group: HistoryGroup
            ) => (
              <div
                key={group.label}
              >
                {/* =================================
                    DATE HEADER
                ================================== */}

                <div className="mb-4 flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>

                  <div className="h-px flex-1 bg-border/60" />
                </div>

                {/* =================================
                    TIMELINE
                ================================== */}

                <div className="relative">
                  <div className="absolute bottom-0 left-[19px] top-0 w-px bg-border/60" />

                  <div className="space-y-5">
                    {group.events.map(
                      (
                        event: TaskHistoryEvent
                      ) => (
                        <article
                          key={event.id}
                          onClick={(): void => {
                            onEventClick?.(
                              event
                            );
                          }}
                          className={[
                            "relative flex gap-4",
                            onEventClick
                              ? "cursor-pointer"
                              : "",
                          ].join(" ")}
                        >
                          {/* =====================
                              ICON
                          ====================== */}

                          <div
                            className={[
                              "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              getEventClasses(
                                event.type
                              ),
                            ].join(" ")}
                          >
                            {getEventIcon(
                              event.type
                            )}
                          </div>

                          {/* =====================
                              CONTENT
                          ====================== */}

                          <div
                            className={[
                              "min-w-0 flex-1 pb-1",
                              onEventClick
                                ? "transition-opacity hover:opacity-75"
                                : "",
                            ].join(" ")}
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                              <div className="min-w-0">
                                <h3 className="text-sm font-medium">
                                  {
                                    event.title
                                  }
                                </h3>

                                {event.description ? (
                                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    {
                                      event.description
                                    }
                                  </p>
                                ) : null}
                              </div>

                              <time
                                dateTime={
                                  event.createdAt
                                }
                                title={
                                  formatHistoryDate(
                                    event.createdAt
                                  )
                                }
                                className="shrink-0 text-xs text-muted-foreground"
                              >
                                {formatRelativeTime(
                                  event.createdAt
                                )}
                              </time>
                            </div>

                            {/* ===================
                                ACTOR
                            ==================== */}

                            {event.actor ? (
                              <div className="mt-3 flex items-center gap-2">
                                {event.actor.avatar ? (
                                  <img
                                    src={
                                      event.actor
                                        .avatar
                                    }
                                    alt={
                                      event.actor
                                        .name
                                    }
                                    className="h-5 w-5 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                                    {event.actor
                                      .type ===
                                    "agent" ? (
                                      <Bot className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <User className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                )}

                                <span className="text-xs text-muted-foreground">
                                  {
                                    event.actor
                                      .name
                                  }
                                </span>

                                {event.actor
                                  .type ===
                                "agent" ? (
                                  <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
                                    Agent
                                  </span>
                                ) : null}

                                {event.actor
                                  .type ===
                                "system" ? (
                                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    System
                                  </span>
                                ) : null}
                              </div>
                            ) : null}

                            {/* ===================
                                METADATA
                            ==================== */}

                            {event.metadata &&
                            Object.keys(
                              event.metadata
                            ).length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(
                                  event.metadata
                                ).map(
                                  (
                                    [
                                      key,
                                      value,
                                    ]
                                  ) => (
                                    <span
                                      key={
                                        key
                                      }
                                      className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
                                    >
                                      <span className="font-medium text-foreground/80">
                                        {key}
                                      </span>

                                      {": "}

                                      {value ===
                                      null
                                        ? "—"
                                        : String(
                                            value
                                          )}
                                    </span>
                                  )
                                )}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  getEventIcon,
  getEventClasses,
  formatHistoryDate,
  formatRelativeTime,
  getDateGroupLabel,
  groupHistoryEvents,
};