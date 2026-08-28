"use client";

import {
  type ReactNode,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type TaskStatusValue =
  | "draft"
  | "pending"
  | "scheduled"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStatusConfig = {
  value: TaskStatusValue;

  label: string;

  description: string;
};

export type TaskStatusProps = {
  value?: TaskStatusValue;

  defaultValue?: TaskStatusValue;

  onChange?: (
    status: TaskStatusValue
  ) => void | Promise<void>;

  disabled?: boolean;

  showDescription?: boolean;

  showLabel?: boolean;

  compact?: boolean;

  className?: string;
};

/* ==================================================
   STATUS CONFIG
================================================== */

export const TASK_STATUS_CONFIG: Record<
  TaskStatusValue,
  TaskStatusConfig
> = {
  draft: {
    value: "draft",
    label: "Draft",
    description:
      "The task is still being prepared.",
  },

  pending: {
    value: "pending",
    label: "Pending",
    description:
      "The task is waiting to start.",
  },

  scheduled: {
    value: "scheduled",
    label: "Scheduled",
    description:
      "The task is scheduled to run.",
  },

  in_progress: {
    value: "in_progress",
    label: "In progress",
    description:
      "The task is currently running.",
  },

  paused: {
    value: "paused",
    label: "Paused",
    description:
      "The task has been temporarily paused.",
  },

  completed: {
    value: "completed",
    label: "Completed",
    description:
      "The task finished successfully.",
  },

  failed: {
    value: "failed",
    label: "Failed",
    description:
      "The task could not be completed.",
  },

  cancelled: {
    value: "cancelled",
    label: "Cancelled",
    description:
      "The task was cancelled.",
  },
};

/* ==================================================
   STATUS ORDER
================================================== */

export const TASK_STATUS_ORDER: TaskStatusValue[] =
  [
    "draft",
    "pending",
    "scheduled",
    "in_progress",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ];

/* ==================================================
   HELPERS
================================================== */

export function getTaskStatusLabel(
  status: TaskStatusValue
): string {
  return (
    TASK_STATUS_CONFIG[status]?.label ??
    status
  );
}

export function getTaskStatusDescription(
  status: TaskStatusValue
): string {
  return (
    TASK_STATUS_CONFIG[status]
      ?.description ??
    ""
  );
}

export function getTaskStatusClasses(
  status: TaskStatusValue
): string {
  switch (status) {
    case "draft":
      return "bg-muted text-muted-foreground border-border/60";

    case "pending":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400";

    case "scheduled":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";

    case "in_progress":
      return "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400";

    case "paused":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400";

    case "completed":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";

    case "failed":
      return "bg-destructive/10 text-destructive border-destructive/20";

    case "cancelled":
      return "bg-muted text-muted-foreground border-border/60";

    default:
      return "bg-muted text-muted-foreground border-border/60";
  }
}

export function getTaskStatusDotClasses(
  status: TaskStatusValue
): string {
  switch (status) {
    case "draft":
      return "bg-muted-foreground";

    case "pending":
      return "bg-amber-500";

    case "scheduled":
      return "bg-blue-500";

    case "in_progress":
      return "bg-violet-500";

    case "paused":
      return "bg-orange-500";

    case "completed":
      return "bg-emerald-500";

    case "failed":
      return "bg-destructive";

    case "cancelled":
      return "bg-muted-foreground";

    default:
      return "bg-muted-foreground";
  }
}

export function getTaskStatusIcon(
  status: TaskStatusValue
): ReactNode {
  switch (status) {
    case "draft":
      return <Circle className="h-4 w-4" />;

    case "pending":
      return <Clock3 className="h-4 w-4" />;

    case "scheduled":
      return <Clock3 className="h-4 w-4" />;

    case "in_progress":
      return <Loader2 className="h-4 w-4 animate-spin" />;

    case "paused":
      return <Pause className="h-4 w-4" />;

    case "completed":
      return (
        <CheckCircle2 className="h-4 w-4" />
      );

    case "failed":
      return (
        <AlertCircle className="h-4 w-4" />
      );

    case "cancelled":
      return <XCircle className="h-4 w-4" />;

    default:
      return <Circle className="h-4 w-4" />;
  }
}

/* ==================================================
   STATUS TRANSITIONS
================================================== */

export function canTransitionTaskStatus(
  from: TaskStatusValue,
  to: TaskStatusValue
): boolean {
  if (from === to) {
    return true;
  }

  const transitions: Record<
    TaskStatusValue,
    TaskStatusValue[]
  > = {
    draft: [
      "pending",
      "scheduled",
      "cancelled",
    ],

    pending: [
      "scheduled",
      "in_progress",
      "paused",
      "cancelled",
    ],

    scheduled: [
      "pending",
      "in_progress",
      "paused",
      "cancelled",
    ],

    in_progress: [
      "paused",
      "completed",
      "failed",
      "cancelled",
    ],

    paused: [
      "pending",
      "scheduled",
      "in_progress",
      "cancelled",
    ],

    completed: [
      "in_progress",
    ],

    failed: [
      "pending",
      "in_progress",
      "cancelled",
    ],

    cancelled: [
      "draft",
      "pending",
    ],
  };

  return transitions[from].includes(
    to
  );
}

/* ==================================================
   COMPONENT
================================================== */

export default function TaskStatus({
  value,
  defaultValue = "draft",
  onChange,
  disabled = false,
  showDescription = true,
  showLabel = true,
  compact = false,
  className = "",
}: TaskStatusProps): ReactNode {
  const [internalValue, setInternalValue] =
    useState<TaskStatusValue>(
      defaultValue
    );

  const [isOpen, setIsOpen] =
    useState<boolean>(false);

  const [isUpdating, setIsUpdating] =
    useState<boolean>(false);

  const currentValue =
    value ?? internalValue;

  const currentConfig =
    useMemo(
      (): TaskStatusConfig =>
        TASK_STATUS_CONFIG[
          currentValue
        ],
      [currentValue]
    );

  const availableStatuses =
    useMemo(
      (): TaskStatusValue[] =>
        TASK_STATUS_ORDER.filter(
          (
            status: TaskStatusValue
          ): boolean =>
            canTransitionTaskStatus(
              currentValue,
              status
            )
        ),
      [currentValue]
    );

  /* ================================================
     HANDLE STATUS CHANGE
  ================================================= */

  const handleChange =
    async (
      nextStatus: TaskStatusValue
    ): Promise<void> => {
      if (
        disabled ||
        isUpdating ||
        nextStatus === currentValue
      ) {
        setIsOpen(false);
        return;
      }

      if (
        !canTransitionTaskStatus(
          currentValue,
          nextStatus
        )
      ) {
        return;
      }

      try {
        setIsUpdating(true);

        if (
          value === undefined
        ) {
          setInternalValue(
            nextStatus
          );
        }

        await onChange?.(
          nextStatus
        );

        setIsOpen(false);
      } catch {
        /*
         * Controlled components are expected
         * to keep the previous value when
         * an external update fails.
         */
      } finally {
        setIsUpdating(false);
      }
    };

  /* ================================================
     COMPACT MODE
  ================================================= */

  if (compact) {
    return (
      <div
        className={[
          "relative inline-flex",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          disabled={
            disabled ||
            isUpdating
          }
          onClick={(): void => {
            setIsOpen(
              (
                current: boolean
              ): boolean =>
                !current
            );
          }}
          className={[
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            getTaskStatusClasses(
              currentValue
            ),
            disabled
              ? "cursor-not-allowed opacity-50"
              : "hover:opacity-80",
          ].join(" ")}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              getTaskStatusDotClasses(
                currentValue
              ),
            ].join(" ")}
          />

          {showLabel
            ? currentConfig.label
            : null}

          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {isOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-border/60 bg-background p-1 shadow-xl">
            {availableStatuses.map(
              (
                status: TaskStatusValue
              ) => {
                const selected =
                  status ===
                  currentValue;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={(): void => {
                      void handleChange(
                        status
                      );
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "bg-muted"
                        : "hover:bg-muted/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        getTaskStatusClasses(
                          status
                        ),
                      ].join(" ")}
                    >
                      {getTaskStatusIcon(
                        status
                      )}
                    </span>

                    <span className="flex-1">
                      <span className="block font-medium">
                        {getTaskStatusLabel(
                          status
                        )}
                      </span>

                      {showDescription ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {getTaskStatusDescription(
                            status
                          )}
                        </span>
                      ) : null}
                    </span>

                    {selected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                );
              }
            )}
          </div>
        ) : null}
      </div>
    );
  }

  /* ================================================
     FULL MODE
  ================================================= */

  return (
    <section
      className={[
        "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="rounded-2xl border border-border/60 bg-background p-5">
        {/* =========================================
            HEADER
        ========================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {getTaskStatusIcon(
                currentValue
              )}

              <h3 className="font-semibold">
                Task status
              </h3>
            </div>

            {showDescription ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {
                  currentConfig.description
                }
              </p>
            ) : null}
          </div>

          <div
            className={[
              "inline-flex items-center gap-2 self-start rounded-lg border px-3 py-1.5 text-xs font-medium",
              getTaskStatusClasses(
                currentValue
              ),
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                getTaskStatusDotClasses(
                  currentValue
                ),
              ].join(" ")}
            />

            {
              currentConfig.label
            }
          </div>
        </div>

        {/* =========================================
            STATUS OPTIONS
        ========================================== */}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {availableStatuses.map(
            (
              status: TaskStatusValue
            ) => {
              const selected =
                status ===
                currentValue;

              return (
                <button
                  key={status}
                  type="button"
                  disabled={
                    disabled ||
                    isUpdating
                  }
                  onClick={(): void => {
                    void handleChange(
                      status
                    );
                  }}
                  className={[
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/50",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      getTaskStatusClasses(
                        status
                      ),
                    ].join(" ")}
                  >
                    {getTaskStatusIcon(
                      status
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">
                        {getTaskStatusLabel(
                          status
                        )}
                      </span>

                      {selected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : null}
                    </span>

                    {showDescription ? (
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {getTaskStatusDescription(
                          status
                        )}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            }
          )}
        </div>

        {/* =========================================
            QUICK ACTIONS
        ========================================== */}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border/60 pt-5">
          {currentValue ===
          "in_progress" ? (
            <button
              type="button"
              disabled={
                disabled ||
                isUpdating
              }
              onClick={(): void => {
                void handleChange(
                  "completed"
                );
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />

              Complete task
            </button>
          ) : null}

          {[
            "pending",
            "scheduled",
          ].includes(
            currentValue
          ) ? (
            <button
              type="button"
              disabled={
                disabled ||
                isUpdating
              }
              onClick={(): void => {
                void handleChange(
                  "in_progress"
                );
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              <Play className="h-4 w-4" />

              Start task
            </button>
          ) : null}

          {currentValue ===
          "in_progress" ? (
            <button
              type="button"
              disabled={
                disabled ||
                isUpdating
              }
              onClick={(): void => {
                void handleChange(
                  "paused"
                );
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <Pause className="h-4 w-4" />

              Pause
            </button>
          ) : null}

          {[
            "paused",
            "failed",
            "completed",
          ].includes(
            currentValue
          ) ? (
            <button
              type="button"
              disabled={
                disabled ||
                isUpdating
              }
              onClick={(): void => {
                void handleChange(
                  "in_progress"
                );
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />

              Run again
            </button>
          ) : null}

          {![
            "completed",
            "cancelled",
          ].includes(
            currentValue
          ) ? (
            <button
              type="button"
              disabled={
                disabled ||
                isUpdating
              }
              onClick={(): void => {
                void handleChange(
                  "cancelled"
                );
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />

              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}