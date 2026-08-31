"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  FolderKanban,
  ListTodo,
  MoreHorizontal,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

type TaskStatus =
  | "todo"
  | "in-progress"
  | "completed";

type TaskPriority =
  | "low"
  | "medium"
  | "high";

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  project: string;
  createdAt: string;
  updatedAt: string;
};

/* ==================================================
   CONSTANTS
================================================== */

const STATUS_OPTIONS: Array<{
  id: TaskStatus;
  label: string;
  icon: typeof Circle;
}> = [
  {
    id: "todo",
    label: "To Do",
    icon: Circle,
  },
  {
    id: "in-progress",
    label: "In Progress",
    icon: Clock3,
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
  },
];

const PRIORITY_OPTIONS: TaskPriority[] = [
  "low",
  "medium",
  "high",
];

/* ==================================================
   MOCK DATABASE
================================================== */

const taskDatabase: Record<string, Task> = {
  "task-1": {
    id: "task-1",
    title: "Prepare AI infrastructure strategy",
    description:
      "Define the core architecture, execution roadmap and strategic technology infrastructure required to build a scalable global AI platform.",
    status: "in-progress",
    priority: "high",
    dueDate: "2026-09-05",
    project: "Global AI Platform",
    createdAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },

  "task-2": {
    id: "task-2",
    title: "Review product architecture",
    description:
      "Review all major application modules and identify opportunities to improve scalability, maintainability and performance.",
    status: "todo",
    priority: "high",
    dueDate: "2026-09-10",
    project: "Core Platform",
    createdAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },

  "task-3": {
    id: "task-3",
    title: "Create marketplace strategy",
    description:
      "Define marketplace categories, partner ecosystem, monetization structure and the long-term platform expansion strategy.",
    status: "todo",
    priority: "medium",
    dueDate: "2026-09-15",
    project: "Marketplace",
    createdAt: "2026-08-28",
    updatedAt: "2026-08-28",
  },

  "task-4": {
    id: "task-4",
    title: "Design AI Studio workflow",
    description:
      "Connect image, video, audio and presentation generation into one unified creative intelligence workflow.",
    status: "completed",
    priority: "medium",
    dueDate: "2026-08-28",
    project: "AI Studio",
    createdAt: "2026-08-27",
    updatedAt: "2026-08-28",
  },
};

/* ==================================================
   DATE HELPERS
================================================== */

function getCurrentDate(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  dateValue: string
): string {
  if (!dateValue) {
    return "Not set";
  }

  const date = new Date(
    `${dateValue}T00:00:00`
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

/* ==================================================
   TASK HELPERS
================================================== */

function createDefaultTask(
  id: string
): Task {
  const currentDate =
    getCurrentDate();

  return {
    id,
    title: "Untitled Task",
    description:
      "This task was created in your workspace.",
    status: "todo",
    priority: "medium",
    dueDate: currentDate,
    project: "General",
    createdAt: currentDate,
    updatedAt: currentDate,
  };
}

function getTaskById(
  id: string
): Task {
  const existingTask =
    taskDatabase[id];

  if (existingTask) {
    return {
      ...existingTask,
    };
  }

  return createDefaultTask(id);
}

function getCompletionPercentage(
  status: TaskStatus
): number {
  switch (status) {
    case "todo":
      return 0;

    case "in-progress":
      return 50;

    case "completed":
      return 100;

    default:
      return 0;
  }
}

function getPriorityClass(
  priority: TaskPriority
): string {
  switch (priority) {
    case "high":
      return [
        "border-red-500/20",
        "bg-red-500/10",
        "text-red-600",
        "dark:text-red-400",
      ].join(" ");

    case "medium":
      return [
        "border-amber-500/20",
        "bg-amber-500/10",
        "text-amber-600",
        "dark:text-amber-400",
      ].join(" ");

    case "low":
      return [
        "border-blue-500/20",
        "bg-blue-500/10",
        "text-blue-600",
        "dark:text-blue-400",
      ].join(" ");

    default:
      return "";
  }
}

function getStatusClass(
  status: TaskStatus
): string {
  switch (status) {
    case "todo":
      return [
        "border-border",
        "bg-muted",
        "text-muted-foreground",
      ].join(" ");

    case "in-progress":
      return [
        "border-primary/20",
        "bg-primary/10",
        "text-primary",
      ].join(" ");

    case "completed":
      return [
        "border-emerald-500/20",
        "bg-emerald-500/10",
        "text-emerald-600",
        "dark:text-emerald-400",
      ].join(" ");

    default:
      return "";
  }
}

function getStatusLabel(
  status: TaskStatus
): string {
  switch (status) {
    case "todo":
      return "To Do";

    case "in-progress":
      return "In Progress";

    case "completed":
      return "Completed";

    default:
      return "Unknown";
  }
}

/* ==================================================
   PAGE
================================================== */

export default function TaskDetailPage() {
  /*
   * Client Component için güvenli dynamic route çözümü.
   *
   * app/tasks/[id]/page.tsx
   *
   * URL:
   * /tasks/task-1
   *
   * id:
   * "task-1"
   */
  const params =
    useParams<{
      id: string;
    }>();

  /*
   * useParams teorik olarak boş bir obje
   * döndürebileceği için ekstra güvenlik.
   */
  const taskId =
    typeof params?.id === "string" &&
    params.id.trim().length > 0
      ? params.id
      : "unknown-task";

  /* ==================================================
     INITIAL TASK
  ================================================== */

  const initialTask = useMemo(
    () => getTaskById(taskId),
    [taskId]
  );

  /* ==================================================
     STATE
  ================================================== */

  const [task, setTask] =
    useState<Task>(initialTask);

  const [isEditing, setIsEditing] =
    useState(false);

  const [isDeleted, setIsDeleted] =
    useState(false);

  const [showActions, setShowActions] =
    useState(false);

  const [draftTitle, setDraftTitle] =
    useState<string>(
      initialTask.title
    );

  const [
    draftDescription,
    setDraftDescription,
  ] = useState<string>(
    initialTask.description
  );

  const [
    draftPriority,
    setDraftPriority,
  ] = useState<TaskPriority>(
    initialTask.priority
  );

  const [
    draftDueDate,
    setDraftDueDate,
  ] = useState<string>(
    initialTask.dueDate
  );

  /* ==================================================
     SYNC TASK WHEN ROUTE CHANGES
  ================================================== */

  useEffect(() => {
    setTask(initialTask);

    setDraftTitle(
      initialTask.title
    );

    setDraftDescription(
      initialTask.description
    );

    setDraftPriority(
      initialTask.priority
    );

    setDraftDueDate(
      initialTask.dueDate
    );

    setIsEditing(false);
    setIsDeleted(false);
    setShowActions(false);
  }, [initialTask]);

  /* ==================================================
     DERIVED VALUES
  ================================================== */

  const completionPercentage =
    useMemo(
      () =>
        getCompletionPercentage(
          task.status
        ),
      [task.status]
    );

  /* ==================================================
     ACTIONS
  ================================================== */

  const toggleCompletion =
    useCallback(() => {
      setTask(
        (currentTask): Task => ({
          ...currentTask,

          status:
            currentTask.status ===
            "completed"
              ? "todo"
              : "completed",

          updatedAt:
            getCurrentDate(),
        })
      );
    }, []);

  const updateStatus =
    useCallback(
      (
        status: TaskStatus
      ) => {
        setTask(
          (currentTask): Task => ({
            ...currentTask,
            status,
            updatedAt:
              getCurrentDate(),
          })
        );
      },
      []
    );

  const openEditing =
    useCallback(() => {
      setDraftTitle(task.title);

      setDraftDescription(
        task.description
      );

      setDraftPriority(
        task.priority
      );

      setDraftDueDate(
        task.dueDate
      );

      setShowActions(false);

      setIsEditing(true);
    }, [task]);

  const cancelEditing =
    useCallback(() => {
      setDraftTitle(task.title);

      setDraftDescription(
        task.description
      );

      setDraftPriority(
        task.priority
      );

      setDraftDueDate(
        task.dueDate
      );

      setIsEditing(false);
    }, [task]);

  const saveTask =
    useCallback(() => {
      const normalizedTitle =
        draftTitle.trim();

      if (!normalizedTitle) {
        return;
      }

      const normalizedDescription =
        draftDescription.trim();

      const safeDueDate =
        draftDueDate.trim() ||
        getCurrentDate();

      setTask(
        (currentTask): Task => ({
          ...currentTask,

          title:
            normalizedTitle,

          description:
            normalizedDescription ||
            "No description provided.",

          priority:
            draftPriority,

          dueDate:
            safeDueDate,

          updatedAt:
            getCurrentDate(),
        })
      );

      setIsEditing(false);
    }, [
      draftDescription,
      draftDueDate,
      draftPriority,
      draftTitle,
    ]);

  const deleteTask =
    useCallback(() => {
      setShowActions(false);

      setIsEditing(false);

      setIsDeleted(true);
    }, []);

  /* ==================================================
     DELETED STATE
  ================================================== */

  if (isDeleted) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10">
            <Trash2 className="h-9 w-9 text-destructive" />
          </div>

          <h1 className="mt-6 text-2xl font-bold">
            Task deleted
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            This task has been removed from
            your workspace.
          </p>

          <Link
            href="/tasks"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Link>
        </div>
      </main>
    );
  }

  /* ==================================================
     PAGE
  ================================================== */

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ============================================
            TOP NAVIGATION
        ============================================ */}

        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowActions(
                  (value) => !value
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-muted"
              aria-label="Task actions"
              aria-expanded={
                showActions
              }
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showActions ? (
              <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-border bg-card p-2 shadow-xl">
                <button
                  type="button"
                  onClick={openEditing}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-muted"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Task
                </button>

                <button
                  type="button"
                  onClick={deleteTask}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Task
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ============================================
            HEADER
        ============================================ */}

        <section className="mb-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="relative p-6 sm:p-8 lg:p-10">

            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

                <div className="max-w-3xl">
                  <div className="mb-5 flex flex-wrap items-center gap-2">

                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        getStatusClass(
                          task.status
                        ),
                      ].join(" ")}
                    >
                      {getStatusLabel(
                        task.status
                      )}
                    </span>

                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-medium capitalize",
                        getPriorityClass(
                          task.priority
                        ),
                      ].join(" ")}
                    >
                      {task.priority} priority
                    </span>
                  </div>

                  <div className="flex items-start gap-4">

                    <button
                      type="button"
                      onClick={
                        toggleCompletion
                      }
                      className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background transition hover:bg-muted"
                      aria-label="Toggle completion"
                    >
                      {task.status ===
                      "completed" ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>

                    <div>
                      <h1
                        className={[
                          "text-3xl font-bold tracking-tight sm:text-4xl",
                          task.status ===
                          "completed"
                            ? "text-muted-foreground line-through"
                            : "",
                        ].join(" ")}
                      >
                        {task.title}
                      </h1>

                      <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                        {task.description}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openEditing}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Task
                </button>
              </div>

              {/* ======================================
                  TASK META
              ====================================== */}

              <div className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderKanban className="h-4 w-4" />
                    Project
                  </div>

                  <p className="mt-3 font-semibold">
                    {task.project}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Due Date
                  </div>

                  <p className="mt-3 font-semibold">
                    {formatDate(
                      task.dueDate
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    Created
                  </div>

                  <p className="mt-3 font-semibold">
                    {formatDate(
                      task.createdAt
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Task ID
                  </div>

                  <p className="mt-3 truncate font-mono text-sm font-semibold">
                    {task.id}
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ============================================
            CONTENT GRID
        ============================================ */}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

          {/* ==========================================
              MAIN CONTENT
          ========================================== */}

          <div className="space-y-6">

            {/* PROGRESS */}

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">

                <div>
                  <h2 className="text-lg font-semibold">
                    Task Progress
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Track the current execution state
                    of this task.
                  </p>
                </div>

                <span className="text-lg font-bold text-primary">
                  {completionPercentage}%
                </span>
              </div>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width:
                      `${completionPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {STATUS_OPTIONS.map(
                  (item) => {
                    const Icon =
                      item.icon;

                    const isActive =
                      task.status ===
                      item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          updateStatus(
                            item.id
                          )
                        }
                        className={[
                          "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-5 w-5",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground",
                          ].join(" ")}
                        />

                        <span className="text-sm font-medium">
                          {item.label}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            {/* DESCRIPTION */}

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <ListTodo className="h-5 w-5 text-primary" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Task Details
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Description and execution
                    context.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border bg-background/50 p-5">
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {task.description}
                </p>
              </div>
            </section>

            {/* ACTIVITY */}

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                Activity
              </h2>

              <div className="mt-6 space-y-6">

                <div className="flex gap-4">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary" />

                  <div>
                    <p className="text-sm font-medium">
                      Task created
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(
                        task.createdAt
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary/50" />

                  <div>
                    <p className="text-sm font-medium">
                      Last updated
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(
                        task.updatedAt
                      )}
                    </p>
                  </div>
                </div>

              </div>
            </section>

          </div>

          {/* ==========================================
              SIDEBAR
          ========================================== */}

          <aside className="space-y-6">

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">

              <h2 className="font-semibold">
                Quick Actions
              </h2>

              <div className="mt-4 space-y-2">

                <button
                  type="button"
                  onClick={openEditing}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition hover:bg-muted"
                >
                  <Edit3 className="h-4 w-4 text-primary" />
                  Edit Task
                </button>

                <button
                  type="button"
                  onClick={
                    toggleCompletion
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition hover:bg-muted"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                  {task.status ===
                  "completed"
                    ? "Reopen Task"
                    : "Mark Completed"}
                </button>

                <Link
                  href="/tasks"
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium transition hover:bg-muted"
                >
                  <ListTodo className="h-4 w-4 text-primary" />
                  All Tasks
                </Link>

              </div>
            </section>

            <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5">

              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

              <div className="relative">

                <Sparkles className="h-5 w-5 text-primary" />

                <h2 className="mt-4 font-semibold">
                  AI Task Intelligence
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This task can later connect with
                  AI agents, project workflows and
                  automated execution.
                </p>

              </div>
            </section>

          </aside>
        </div>

        {/* ============================================
            EDIT MODAL
        ============================================ */}

        {isEditing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">

            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-task-title"
            >

              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2
                    id="edit-task-title"
                    className="text-xl font-bold"
                  >
                    Edit Task
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Update task information and
                    execution settings.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              {/* FORM */}

              <div className="mt-6 space-y-5">

                {/* TITLE */}

                <div>
                  <label
                    htmlFor="task-title"
                    className="mb-2 block text-sm font-medium"
                  >
                    Task Title
                  </label>

                  <input
                    id="task-title"
                    type="text"
                    value={draftTitle}
                    onChange={(event) =>
                      setDraftTitle(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* DESCRIPTION */}

                <div>
                  <label
                    htmlFor="task-description"
                    className="mb-2 block text-sm font-medium"
                  >
                    Description
                  </label>

                  <textarea
                    id="task-description"
                    value={
                      draftDescription
                    }
                    onChange={(event) =>
                      setDraftDescription(
                        event.target.value
                      )
                    }
                    rows={7}
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* PRIORITY + DATE */}

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label
                      htmlFor="task-priority"
                      className="mb-2 block text-sm font-medium"
                    >
                      Priority
                    </label>

                    <select
                      id="task-priority"
                      value={
                        draftPriority
                      }
                      onChange={(event) =>
                        setDraftPriority(
                          event.target
                            .value as TaskPriority
                        )
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    >
                      {PRIORITY_OPTIONS.map(
                        (priority) => (
                          <option
                            key={priority}
                            value={priority}
                          >
                            {priority.charAt(0).toUpperCase() +
                              priority.slice(1)}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="task-due-date"
                      className="mb-2 block text-sm font-medium"
                    >
                      Due Date
                    </label>

                    <input
                      id="task-due-date"
                      type="date"
                      value={
                        draftDueDate
                      }
                      onChange={(event) =>
                        setDraftDueDate(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>

                </div>

              </div>

              {/* ACTIONS */}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveTask}
                  disabled={
                    !draftTitle.trim()
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>

              </div>

            </div>
          </div>
        ) : null}

      </div>
    </main>
  );
}