"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";

import {
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Flag,
  Layers3,
  Plus,
  Save,
  Tag,
  Trash2,
  User,
  X,
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

export type TaskBuilderValue = {
  title: string;
  description: string;

  priority: TaskPriority;
  status: TaskStatus;

  dueDate?: string;

  assignee?: TaskAssignee;

  labels: TaskLabel[];

  subtasks: TaskSubtask[];
};

export type TaskBuilderProps = {
  initialValue?: Partial<TaskBuilderValue>;

  assignees?: TaskAssignee[];

  availableLabels?: TaskLabel[];

  onSave?: (
    value: TaskBuilderValue
  ) => void | Promise<void>;

  onCancel?: () => void;

  className?: string;
};

/* ==================================================
   CONSTANTS
================================================== */

const PRIORITY_OPTIONS: {
  value: TaskPriority;
  label: string;
  description: string;
}[] = [
  {
    value: "low",
    label: "Low",
    description: "Low importance",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Normal priority",
  },
  {
    value: "high",
    label: "High",
    description: "Needs attention",
  },
  {
    value: "urgent",
    label: "Urgent",
    description: "Immediate action required",
  },
];

const STATUS_OPTIONS: {
  value: TaskStatus;
  label: string;
}[] = [
  {
    value: "todo",
    label: "To do",
  },
  {
    value: "in_progress",
    label: "In progress",
  },
  {
    value: "review",
    label: "Review",
  },
  {
    value: "completed",
    label: "Completed",
  },
];

const DEFAULT_ASSIGNEES: TaskAssignee[] = [
  {
    id: "unassigned",
    name: "Unassigned",
  },
  {
    id: "alex",
    name: "Alex Morgan",
    email: "alex@example.com",
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    email: "jordan@example.com",
  },
  {
    id: "sam",
    name: "Sam Taylor",
    email: "sam@example.com",
  },
];

const DEFAULT_LABELS: TaskLabel[] = [
  {
    id: "product",
    name: "Product",
  },
  {
    id: "design",
    name: "Design",
  },
  {
    id: "engineering",
    name: "Engineering",
  },
  {
    id: "research",
    name: "Research",
  },
  {
    id: "automation",
    name: "Automation",
  },
];

/* ==================================================
   HELPERS
================================================== */

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getPriorityLabel(
  priority: TaskPriority
): string {
  const option =
    PRIORITY_OPTIONS.find(
      (
        current: {
          value: TaskPriority;
          label: string;
          description: string;
        }
      ): boolean =>
        current.value === priority
    );

  return option?.label ?? "Medium";
}

function getStatusLabel(
  status: TaskStatus
): string {
  const option =
    STATUS_OPTIONS.find(
      (
        current: {
          value: TaskStatus;
          label: string;
        }
      ): boolean =>
        current.value === status
    );

  return option?.label ?? "To do";
}

/* ==================================================
   COMPONENT
================================================== */

export default function TaskBuilder({
  initialValue,
  assignees = DEFAULT_ASSIGNEES,
  availableLabels = DEFAULT_LABELS,
  onSave,
  onCancel,
  className = "",
}: TaskBuilderProps): ReactNode {
  const [title, setTitle] =
    useState<string>(
      initialValue?.title ?? ""
    );

  const [
    description,
    setDescription,
  ] = useState<string>(
    initialValue?.description ?? ""
  );

  const [priority, setPriority] =
    useState<TaskPriority>(
      initialValue?.priority ??
        "medium"
    );

  const [status, setStatus] =
    useState<TaskStatus>(
      initialValue?.status ??
        "todo"
    );

  const [dueDate, setDueDate] =
    useState<string>(
      initialValue?.dueDate ?? ""
    );

  const [assigneeId, setAssigneeId] =
    useState<string>(
      initialValue?.assignee?.id ??
        "unassigned"
    );

  const [labels, setLabels] =
    useState<TaskLabel[]>(
      initialValue?.labels ?? []
    );

  const [subtasks, setSubtasks] =
    useState<TaskSubtask[]>(
      initialValue?.subtasks ?? []
    );

  const [
    newSubtask,
    setNewSubtask,
  ] = useState<string>("");

  const [
    isSaving,
    setIsSaving,
  ] = useState<boolean>(false);

  /* ================================================
     DERIVED VALUES
  ================================================= */

  const selectedAssignee =
    useMemo(
      (): TaskAssignee | undefined => {
        if (
          assigneeId === "unassigned"
        ) {
          return undefined;
        }

        return assignees.find(
          (
            assignee: TaskAssignee
          ): boolean =>
            assignee.id ===
            assigneeId
        );
      },
      [
        assigneeId,
        assignees,
      ]
    );

  const completedSubtasks =
    useMemo(
      (): number =>
        subtasks.filter(
          (
            subtask: TaskSubtask
          ): boolean =>
            subtask.completed
        ).length,
      [subtasks]
    );

  const progress =
    useMemo(
      (): number => {
        if (
          subtasks.length === 0
        ) {
          return 0;
        }

        return Math.round(
          (completedSubtasks /
            subtasks.length) *
            100
        );
      },
      [
        completedSubtasks,
        subtasks.length,
      ]
    );

  const canSave =
    useMemo(
      (): boolean =>
        title.trim().length > 0 &&
        !isSaving,
      [
        isSaving,
        title,
      ]
    );

  /* ================================================
     LABELS
  ================================================= */

  const toggleLabel = (
    label: TaskLabel
  ): void => {
    setLabels(
      (
        current: TaskLabel[]
      ): TaskLabel[] => {
        const exists =
          current.some(
            (
              currentLabel: TaskLabel
            ): boolean =>
              currentLabel.id ===
              label.id
          );

        if (exists) {
          return current.filter(
            (
              currentLabel: TaskLabel
            ): boolean =>
              currentLabel.id !==
              label.id
          );
        }

        return [
          ...current,
          label,
        ];
      }
    );
  };

  const removeLabel = (
    labelId: string
  ): void => {
    setLabels(
      (
        current: TaskLabel[]
      ): TaskLabel[] =>
        current.filter(
          (
            label: TaskLabel
          ): boolean =>
            label.id !== labelId
        )
    );
  };

  /* ================================================
     SUBTASKS
  ================================================= */

  const addSubtask = (): void => {
    const trimmedTitle =
      newSubtask.trim();

    if (!trimmedTitle) {
      return;
    }

    setSubtasks(
      (
        current: TaskSubtask[]
      ): TaskSubtask[] => [
        ...current,
        {
          id: createId(),
          title: trimmedTitle,
          completed: false,
        },
      ]
    );

    setNewSubtask("");
  };

  const toggleSubtask = (
    id: string
  ): void => {
    setSubtasks(
      (
        current: TaskSubtask[]
      ): TaskSubtask[] =>
        current.map(
          (
            subtask: TaskSubtask
          ): TaskSubtask =>
            subtask.id === id
              ? {
                  ...subtask,
                  completed:
                    !subtask.completed,
                }
              : subtask
        )
    );
  };

  const removeSubtask = (
    id: string
  ): void => {
    setSubtasks(
      (
        current: TaskSubtask[]
      ): TaskSubtask[] =>
        current.filter(
          (
            subtask: TaskSubtask
          ): boolean =>
            subtask.id !== id
        )
    );
  };

  const updateSubtaskTitle = (
    id: string,
    value: string
  ): void => {
    setSubtasks(
      (
        current: TaskSubtask[]
      ): TaskSubtask[] =>
        current.map(
          (
            subtask: TaskSubtask
          ): TaskSubtask =>
            subtask.id === id
              ? {
                  ...subtask,
                  title: value,
                }
              : subtask
        )
    );
  };

  /* ================================================
     SAVE
  ================================================= */

  const handleSave =
    async (): Promise<void> => {
      if (!canSave) {
        return;
      }

      const value: TaskBuilderValue = {
        title: title.trim(),

        description:
          description.trim(),

        priority,

        status,

        dueDate:
          dueDate.trim() ||
          undefined,

        assignee:
          selectedAssignee,

        labels,

        subtasks,
      };

      try {
        setIsSaving(true);

        await onSave?.(
          value
        );
      } finally {
        setIsSaving(false);
      }
    };

  /* ================================================
     RENDER
  ================================================= */

  return (
    <div
      className={[
        "mx-auto w-full max-w-5xl space-y-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers3 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              Task builder
            </h2>

            <p className="text-sm text-muted-foreground">
              Create and organize a new
              workspace task.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isSaving ? (
              <Clock3 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {isSaving
              ? "Saving..."
              : "Save task"}
          </button>
        </div>
      </div>

      {/* =========================================
          BASIC DETAILS
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="font-semibold">
            Task details
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Define what needs to be done.
          </p>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Task title
            </span>

            <input
              value={title}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ): void => {
                setTitle(
                  event.target.value
                );
              }}
              placeholder="What needs to be done?"
              className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Description
            </span>

            <textarea
              value={description}
              onChange={(
                event: ChangeEvent<HTMLTextAreaElement>
              ): void => {
                setDescription(
                  event.target.value
                );
              }}
              rows={5}
              placeholder="Add context, requirements or instructions..."
              className="resize-none rounded-xl border border-border/60 bg-background px-3 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
      </section>

      {/* =========================================
          STATUS & PRIORITY
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="font-semibold">
            Status and priority
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Set the current state and importance.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Status
            </span>

            <div className="relative">
              <select
                value={status}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ): void => {
                  setStatus(
                    event.target
                      .value as TaskStatus
                  );
                }}
                className="h-11 w-full appearance-none rounded-xl border border-border/60 bg-background px-3 pr-10 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              >
                {STATUS_OPTIONS.map(
                  (
                    option: {
                      value: TaskStatus;
                      label: string;
                    }
                  ) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <span className="text-xs text-muted-foreground">
              Current:{" "}
              {getStatusLabel(
                status
              )}
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Priority
            </span>

            <div className="relative">
              <select
                value={priority}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ): void => {
                  setPriority(
                    event.target
                      .value as TaskPriority
                  );
                }}
                className="h-11 w-full appearance-none rounded-xl border border-border/60 bg-background px-3 pr-10 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              >
                {PRIORITY_OPTIONS.map(
                  (
                    option: {
                      value: TaskPriority;
                      label: string;
                      description: string;
                    }
                  ) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <span className="text-xs text-muted-foreground">
              Priority:{" "}
              {getPriorityLabel(
                priority
              )}
            </span>
          </label>
        </div>
      </section>

      {/* =========================================
          ASSIGNEE & DATE
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="font-semibold">
            Assignment
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Choose an owner and optional deadline.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-muted-foreground" />

              Assignee
            </span>

            <div className="relative">
              <select
                value={assigneeId}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ): void => {
                  setAssigneeId(
                    event.target.value
                  );
                }}
                className="h-11 w-full appearance-none rounded-xl border border-border/60 bg-background px-3 pr-10 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              >
                {assignees.map(
                  (
                    assignee: TaskAssignee
                  ) => (
                    <option
                      key={
                        assignee.id
                      }
                      value={
                        assignee.id
                      }
                    >
                      {assignee.name}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />

              Due date
            </span>

            <input
              type="date"
              value={dueDate}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ): void => {
                setDueDate(
                  event.target.value
                );
              }}
              className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
      </section>

      {/* =========================================
          LABELS
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Tag className="h-4 w-4" />

            Labels
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Categorize this task.
          </p>
        </div>

        {labels.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {labels.map(
              (
                label: TaskLabel
              ) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={(): void => {
                    removeLabel(
                      label.id
                    );
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-opacity hover:opacity-75"
                >
                  {label.name}

                  <X className="h-3.5 w-3.5" />
                </button>
              )
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {availableLabels.map(
            (
              label: TaskLabel
            ) => {
              const selected =
                labels.some(
                  (
                    currentLabel: TaskLabel
                  ): boolean =>
                    currentLabel.id ===
                    label.id
                );

              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={(): void => {
                    toggleLabel(
                      label
                    );
                  }}
                  className={[
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:bg-muted",
                  ].join(" ")}
                >
                  {selected ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}

                  {label.name}
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* =========================================
          SUBTASKS
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">
              Subtasks
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Break the task into smaller steps.
            </p>
          </div>

          {subtasks.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              {completedSubtasks}/
              {subtasks.length} completed
            </div>
          ) : null}
        </div>

        {subtasks.length > 0 ? (
          <div className="mb-5">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {subtasks.map(
            (
              subtask: TaskSubtask
            ) => (
              <div
                key={subtask.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
              >
                <button
                  type="button"
                  onClick={(): void => {
                    toggleSubtask(
                      subtask.id
                    );
                  }}
                  aria-label={
                    subtask.completed
                      ? "Mark incomplete"
                      : "Mark complete"
                  }
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    subtask.completed
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {subtask.completed ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Circle className="h-2 w-2 opacity-0" />
                  )}
                </button>

                <input
                  value={subtask.title}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ): void => {
                    updateSubtaskTitle(
                      subtask.id,
                      event.target.value
                    );
                  }}
                  className={[
                    "min-w-0 flex-1 bg-transparent text-sm outline-none",
                    subtask.completed
                      ? "text-muted-foreground line-through"
                      : "",
                  ].join(" ")}
                />

                <button
                  type="button"
                  onClick={(): void => {
                    removeSubtask(
                      subtask.id
                    );
                  }}
                  aria-label="Remove subtask"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newSubtask}
            onChange={(
              event: ChangeEvent<HTMLInputElement>
            ): void => {
              setNewSubtask(
                event.target.value
              );
            }}
            onKeyDown={(
              event: React.KeyboardEvent<HTMLInputElement>
            ): void => {
              if (
                event.key === "Enter"
              ) {
                event.preventDefault();

                addSubtask();
              }
            }}
            placeholder="Add a subtask..."
            className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />

          <button
            type="button"
            onClick={addSubtask}
            disabled={
              !newSubtask.trim()
            }
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/60 px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />

            Add
          </button>
        </div>
      </section>

      {/* =========================================
          SUMMARY
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <Flag className="mt-0.5 h-5 w-5 text-primary" />

          <div className="min-w-0">
            <h3 className="font-medium">
              Task summary
            </h3>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>
                Status:{" "}
                {getStatusLabel(
                  status
                )}
              </span>

              <span>
                Priority:{" "}
                {getPriorityLabel(
                  priority
                )}
              </span>

              <span>
                Subtasks:{" "}
                {completedSubtasks}/
                {subtasks.length}
              </span>

              {dueDate ? (
                <span>
                  Due: {dueDate}
                </span>
              ) : null}

              {selectedAssignee ? (
                <span>
                  Owner:{" "}
                  {
                    selectedAssignee.name
                  }
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  DEFAULT_ASSIGNEES,
  DEFAULT_LABELS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  createId,
  getPriorityLabel,
  getStatusLabel,
};