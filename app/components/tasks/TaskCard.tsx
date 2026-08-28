"use client";

import type { ReactNode } from "react";

import {
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  Flag,
  MoreHorizontal,
  Play,
  Trash2,
  User,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type TaskPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "completed";

export type TaskAssignee = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
};

export type TaskLabel = {
  id: string;
  name: string;
};

export type TaskSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type TaskCardTask = {
  id: string;

  title: string;

  description?: string;

  priority: TaskPriority;

  status: TaskStatus;

  dueDate?: string;

  assignee?: TaskAssignee;

  labels?: TaskLabel[];

  subtasks?: TaskSubtask[];

  createdAt?: string;

  updatedAt?: string;
};

export type TaskCardProps = {
  task: TaskCardTask;

  onClick?: (
    task: TaskCardTask
  ) => void;

  onEdit?: (
    task: TaskCardTask
  ) => void;

  onDelete?: (
    task: TaskCardTask
  ) => void;

  onStatusChange?: (
    task: TaskCardTask,
    status: TaskStatus
  ) => void;

  className?: string;

  compact?: boolean;
};

/* ==================================================
   CONSTANTS
================================================== */

const STATUS_LABELS: Record<
  TaskStatus,
  string
> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  completed: "Completed",
};

const PRIORITY_LABELS: Record<
  TaskPriority,
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/* ==================================================
   HELPERS
================================================== */

function getNextStatus(
  status: TaskStatus
): TaskStatus {
  const flow: TaskStatus[] = [
    "todo",
    "in_progress",
    "review",
    "completed",
  ];

  const currentIndex =
    flow.indexOf(status);

  if (
    currentIndex === -1 ||
    currentIndex === flow.length - 1
  ) {
    return "completed";
  }

  return (
    flow[currentIndex + 1] ??
    "completed"
  );
}

function getStatusIcon(
  status: TaskStatus
): ReactNode {
  switch (status) {
    case "todo":
      return (
        <Circle className="h-4 w-4" />
      );

    case "in_progress":
      return (
        <Play className="h-4 w-4" />
      );

    case "review":
      return (
        <Clock3 className="h-4 w-4" />
      );

    case "completed":
      return (
        <CheckCircle2 className="h-4 w-4" />
      );

    default:
      return (
        <Circle className="h-4 w-4" />
      );
  }
}

function getPriorityClasses(
  priority: TaskPriority
): string {
  switch (priority) {
    case "low":
      return "bg-muted text-muted-foreground";

    case "medium":
      return "bg-primary/10 text-primary";

    case "high":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";

    case "urgent":
      return "bg-destructive/10 text-destructive";

    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusClasses(
  status: TaskStatus
): string {
  switch (status) {
    case "todo":
      return "bg-muted text-muted-foreground";

    case "in_progress":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";

    case "review":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";

    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(
  value?: string
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    }
  ).format(date);
}

/* ==================================================
   COMPONENT
================================================== */

export default function TaskCard({
  task,
  onClick,
  onEdit,
  onDelete,
  onStatusChange,
  className = "",
  compact = false,
}: TaskCardProps): ReactNode {
  const subtasks =
    task.subtasks ?? [];

  const labels =
    task.labels ?? [];

  const completedSubtasks =
    subtasks.filter(
      (
        subtask: TaskSubtask
      ): boolean =>
        subtask.completed
    ).length;

  const subtaskProgress =
    subtasks.length > 0
      ? Math.round(
          (completedSubtasks /
            subtasks.length) *
            100
        )
      : 0;

  const formattedDueDate =
    formatDate(task.dueDate);

  const handleCardClick =
    (): void => {
      onClick?.(task);
    };

  const handleEdit = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    event.stopPropagation();

    onEdit?.(task);
  };

  const handleDelete = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    event.stopPropagation();

    onDelete?.(task);
  };

  const handleStatusChange = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    event.stopPropagation();

    const nextStatus =
      getNextStatus(
        task.status
      );

    onStatusChange?.(
      task,
      nextStatus
    );
  };

  return (
    <article
      onClick={handleCardClick}
      className={[
        "group relative flex w-full flex-col rounded-2xl border border-border/60 bg-background transition-all duration-200",
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          : "",
        task.status === "completed"
          ? "opacity-75"
          : "",
        compact
          ? "gap-3 p-4"
          : "gap-4 p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleStatusChange}
          aria-label={`Change task status from ${STATUS_LABELS[task.status]}`}
          className={[
            "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            getStatusClasses(
              task.status
            ),
            "hover:opacity-80",
          ].join(" ")}
        >
          {getStatusIcon(
            task.status
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className={[
                  "truncate font-semibold",
                  compact
                    ? "text-sm"
                    : "text-base",
                  task.status ===
                  "completed"
                    ? "text-muted-foreground line-through"
                    : "",
                ].join(" ")}
              >
                {task.title}
              </h3>

              {!compact &&
              task.description ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {task.description}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {onEdit ? (
                <button
                  type="button"
                  onClick={handleEdit}
                  aria-label="Edit task"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              ) : null}

              {onDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Delete task"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}

              {!onEdit &&
              !onDelete ? (
                <div className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          STATUS + PRIORITY
      ========================================== */}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
            getStatusClasses(
              task.status
            ),
          ].join(" ")}
        >
          {getStatusIcon(
            task.status
          )}

          {
            STATUS_LABELS[
              task.status
            ]
          }
        </span>

        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
            getPriorityClasses(
              task.priority
            ),
          ].join(" ")}
        >
          <Flag className="h-3.5 w-3.5" />

          {
            PRIORITY_LABELS[
              task.priority
            ]
          }
        </span>
      </div>

      {/* =========================================
          LABELS
      ========================================== */}

      {!compact &&
      labels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {labels
            .slice(0, 4)
            .map(
              (
                label: TaskLabel
              ) => (
                <span
                  key={label.id}
                  className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {label.name}
                </span>
              )
            )}

          {labels.length > 4 ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              +
              {labels.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* =========================================
          SUBTASK PROGRESS
      ========================================== */}

      {subtasks.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              Subtasks
            </span>

            <span className="font-medium">
              {completedSubtasks}/
              {subtasks.length}
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${subtaskProgress}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* =========================================
          FOOTER
      ========================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          {formattedDueDate ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />

              <span>
                {formattedDueDate}
              </span>
            </div>
          ) : null}

          {task.assignee ? (
            <div
              className="flex min-w-0 items-center gap-2"
              title={
                task.assignee.name
              }
            >
              {task.assignee.avatar ? (
                <img
                  src={
                    task.assignee
                      .avatar
                  }
                  alt={
                    task.assignee
                      .name
                  }
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}

              {!compact ? (
                <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                  {
                    task.assignee
                      .name
                  }
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {task.status ===
        "completed" ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />

            Completed
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  STATUS_LABELS,
  PRIORITY_LABELS,
  getNextStatus,
  getStatusIcon,
  getPriorityClasses,
  getStatusClasses,
  formatDate,
};