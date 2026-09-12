"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useDialogBehaviour } from "@/app/components/ui/useDialogBehaviour";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  ListTodo,
  MoreHorizontal,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

/*
  SYRAVEN — Task detail

  WHAT THIS PAGE SHOWS

  One task, from GET /api/tasks on the caller's session. public.tasks
  is owner-scoped, so another person's task is never returned rather
  than filtered out here.

  WHAT IT USED TO SHOW

  A module-scope `taskDatabase` holding four invented tasks keyed
  "task-1".."task-4", and -- worse than the other fabricated surfaces
  in this codebase -- a `createDefaultTask(id)` fallback that INVENTED
  a task for any id it did not recognise:

    title       "Untitled Task"
    description "This task was created in your workspace."
    status      todo, priority medium, project "General"
    dates       today

  /tasks links to /tasks/${task.id} with real UUIDs, which never match
  those four keys. So every genuine task rendered as a fabrication, and
  the description asserted it had been created in the user's workspace.
  There was no path on which this page could report that a task did not
  exist.

  Editing, status changes and completion toggles all called setTask and
  nothing else. The UI moved, the row never did, and a reload undid it.

  WHAT IS DELIBERATELY ABSENT

  A progress percentage. getCompletionPercentage mapped status to
  0/50/100 and drove a progress bar off it. That is a restatement of
  the status badge dressed as a measurement; public.tasks has no
  progress column.

  A project name. The API returns project_id, not a name. The list page
  substitutes the literal "General" here; repeating that would spread a
  placeholder rather than fix one.

  STATUS VOCABULARY

  public.tasks.status is free text defaulting to 'pending', while the
  route validates writes against todo | in_progress | blocked |
  completed | cancelled. This page displays the same three-state
  vocabulary /tasks uses and converts on the way out, so a status
  change sends in_progress rather than the hyphenated spelling the API
  would reject.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

type TaskStatus = "todo" | "in-progress" | "completed";
type TaskPriority = "low" | "medium" | "high" | "urgent";

/** A task row exactly as /api/tasks returns it. */
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_OPTIONS: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

const STATUS_OPTIONS: Array<{
  id: TaskStatus;
  label: string;
  icon: typeof Circle;
}> = [
  { id: "todo", label: "To do", icon: Circle },
  { id: "in-progress", label: "In progress", icon: Clock3 },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
];

/**
 * Maps the column's free text into this page's vocabulary.
 *
 * Both spellings of in-progress arrive in practice, and an
 * unrecognised value renders as "to do" rather than dropping the task
 * or leaving a blank badge. Mirrors /tasks so the two pages agree.
 */
function normalizeStatus(value: string): TaskStatus {
  switch (value) {
    case "in-progress":
    case "in_progress":
      return "in-progress";

    case "completed":
    case "done":
      return "completed";

    default:
      return "todo";
  }
}

/** The spelling the route validates against. */
function toApiStatus(status: TaskStatus): string {
  return status === "in-progress" ? "in_progress" : status;
}

function normalizePriority(value: string): TaskPriority {
  return (PRIORITY_OPTIONS as string[]).includes(value)
    ? (value as TaskPriority)
    : "medium";
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    dueDate: row.due_date ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function formatDate(value: string): string {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function getStatusClass(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

    case "in-progress":
      return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";

    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: TaskStatus): string {
  return (
    STATUS_OPTIONS.find((option) => option.id === status)?.label ??
    "To do"
  );
}

function getPriorityClass(priority: TaskPriority): string {
  switch (priority) {
    case "urgent":
      return "border-destructive/30 bg-destructive/10 text-destructive";

    case "high":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";

    case "low":
      return "border-border bg-muted text-muted-foreground";

    default:
      return "border-border bg-background text-muted-foreground";
  }
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const taskId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  const editPanelRef = useRef<HTMLDivElement | null>(null);

  useDialogBehaviour({
    open: isEditing,
    onClose: () => setIsEditing(false),
    panelRef: editPanelRef,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPriority, setDraftPriority] =
    useState<TaskPriority>("medium");
  const [draftDueDate, setDraftDueDate] = useState("");

  /*
    GET /api/tasks takes no id parameter -- its filters are status,
    priority, projectId, agentId, search, limit and offset -- so the
    task is found in the caller's own list rather than fetched
    directly. RLS means that list contains only their rows, so a task
    that is absent here is absent, not somebody else's.
  */
  const load = useCallback(async () => {
    if (!taskId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/tasks?limit=100", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setTask(null);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: { tasks?: TaskRow[] };
      } | null;

      const row = (payload?.data?.tasks ?? []).find(
        (candidate) => candidate.id === taskId,
      );

      setTask(row ? toTask(row) : null);
    } catch {
      setLoadError("This task could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

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

  const completedOptions = useMemo(() => STATUS_OPTIONS, []);

  /* ------------------------------------------------------------------ */
  /*                              MUTATIONS                             */
  /* ------------------------------------------------------------------ */

  /**
   * Sends a change and adopts what the server returns.
   *
   * The previous version of this page moved local state and stopped
   * there, so every edit survived exactly until a reload.
   */
  const patchTask = useCallback(
    async (changes: Record<string, unknown>) => {
      if (!task) return;

      setActionError(null);

      const previous = task;

      try {
        const response = await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, ...changes }),
        });

        if (!response.ok) throw new Error("failed");

        await load();
      } catch {
        setTask(previous);
        setActionError("That change could not be saved.");
      }
    },
    [task, load],
  );

  const updateStatus = useCallback(
    (status: TaskStatus) => {
      void patchTask({ status: toApiStatus(status) });
    },
    [patchTask],
  );

  const toggleCompletion = useCallback(() => {
    if (!task) return;

    updateStatus(task.status === "completed" ? "todo" : "completed");
  }, [task, updateStatus]);

  const openEditing = useCallback(() => {
    if (!task) return;

    setDraftTitle(task.title);
    setDraftDescription(task.description);
    setDraftPriority(task.priority);
    setDraftDueDate(task.dueDate.slice(0, 10));
    setActionError(null);
    setIsEditing(true);
    setShowActions(false);
  }, [task]);

  const saveTask = useCallback(async () => {
    const title = draftTitle.trim();
    if (!title || !task) return;

    setIsSaving(true);

    await patchTask({
      title,
      description: draftDescription.trim() || null,
      priority: draftPriority,
    });

    setIsSaving(false);
    setIsEditing(false);
  }, [draftTitle, draftDescription, draftPriority, task, patchTask]);

  const deleteTask = useCallback(async () => {
    if (!task) return;

    setActionError(null);

    try {
      const response = await fetch(
        `/api/tasks?id=${encodeURIComponent(task.id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("failed");

      router.push("/tasks");
    } catch {
      setActionError("That task could not be removed.");
      setShowActions(false);
    }
  }, [task, router]);

  /* ------------------------------------------------------------------ */
  /*                               STATES                               */
  /* ------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className="bg-background text-foreground">
        <div
          role="status"
          aria-live="polite"
          className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4 text-sm text-muted-foreground"
        >
          Loading this task...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-background text-foreground">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    /*
      A real state at last. The previous version could not reach this:
      an unknown id produced an invented task instead.
    */
    return (
      <div className="bg-background text-foreground">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-2xl">
            ?
          </div>

          <h1 className="mt-6 text-2xl font-bold">Task not found</h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            This task does not exist, or it is not yours to view.
          </p>

          <Link
            href="/tasks"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tasks
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*                                TASK                                */
  /* ------------------------------------------------------------------ */

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tasks
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowActions((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted"
              aria-label="Task actions"
              aria-expanded={showActions}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showActions ? (
              <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-border bg-card p-2 shadow-xl">
                <button
                  type="button"
                  onClick={openEditing}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit task
                </button>

                <button
                  type="button"
                  onClick={() => void deleteTask()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete task
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {actionError}
          </p>
        ) : null}

        {/* HEADER */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(task.status)}`}
                  >
                    {getStatusLabel(task.status)}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getPriorityClass(task.priority)}`}
                  >
                    {task.priority} priority
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={toggleCompletion}
                    className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background transition-colors hover:bg-muted"
                    aria-label={
                      task.status === "completed"
                        ? "Reopen task"
                        : "Mark task completed"
                    }
                  >
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>

                  <div>
                    <h1
                      className={`text-3xl font-bold tracking-tight sm:text-4xl ${
                        task.status === "completed"
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                    >
                      {task.title}
                    </h1>

                    {task.description ? (
                      <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                        {task.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={openEditing}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Edit3 className="h-4 w-4" />
                Edit task
              </button>
            </div>

            {/*
              Three facts the row actually states. A fourth tile used to
              read Project "General" -- a literal, not a lookup -- and a
              progress bar above it turned the status badge into a
              percentage.
            */}
            <div className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Due date
                </div>

                <p className="mt-3 font-semibold">
                  {formatDate(task.dueDate) || "Not set"}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Created
                </div>

                <p className="mt-3 font-semibold">
                  {formatDate(task.createdAt)}
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
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {/* STATUS */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Status</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Where this task stands.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {completedOptions.map((item) => {
                  const Icon = item.icon;
                  const isActive = task.status === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateStatus(item.id)}
                      aria-pressed={isActive}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />

                      <span className="text-sm font-medium">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* DESCRIPTION */}
            {task.description ? (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <ListTodo className="h-5 w-5 text-primary" />
                  </div>

                  <h2 className="text-lg font-semibold">Details</h2>
                </div>

                <div className="mt-6 rounded-xl border border-border bg-background/50 p-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {task.description}
                  </p>
                </div>
              </section>
            ) : null}

            {/* TIMESTAMPS */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">History</h2>

              <div className="mt-6 space-y-6">
                <div className="flex gap-4">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary" />

                  <div>
                    <p className="text-sm font-medium">Created</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(task.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-primary/50" />

                  <div>
                    <p className="text-sm font-medium">Last updated</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(task.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Quick actions</h2>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={openEditing}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Edit3 className="h-4 w-4 text-primary" />
                  Edit task
                </button>

                <button
                  type="button"
                  onClick={toggleCompletion}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                  {task.status === "completed"
                    ? "Reopen task"
                    : "Mark completed"}
                </button>

                <Link
                  href="/tasks"
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <ListTodo className="h-4 w-4 text-primary" />
                  All tasks
                </Link>
              </div>
            </section>
          </aside>
        </div>

        {/* EDIT */}
        {isEditing ? (
          <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div
              ref={editPanelRef}
              className="motion-dialog max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-task-title"
            >
              <div className="flex items-start justify-between gap-4">
                <h2
                  id="edit-task-title"
                  className="text-xl font-bold"
                >
                  Edit task
                </h2>

                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="task-title"
                    className="mb-2 block text-sm font-medium"
                  >
                    Title
                  </label>

                  <input
                    id="task-title"
                    type="text"
                    value={draftTitle}
                    onChange={(event) =>
                      setDraftTitle(event.target.value)
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-description"
                    className="mb-2 block text-sm font-medium"
                  >
                    Description
                  </label>

                  <textarea
                    id="task-description"
                    value={draftDescription}
                    onChange={(event) =>
                      setDraftDescription(event.target.value)
                    }
                    rows={7}
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-priority"
                    className="mb-2 block text-sm font-medium"
                  >
                    Priority
                  </label>

                  <select
                    id="task-priority"
                    value={draftPriority}
                    onChange={(event) =>
                      setDraftPriority(
                        event.target.value as TaskPriority,
                      )
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() +
                          priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/*
                  The due date is shown above but not editable here:
                  PATCH accepts title, description, status, priority,
                  tags and metadata. Offering a date field that the
                  route would discard is the defect this page was full
                  of.
                */}
                {draftDueDate ? (
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(draftDueDate)}. Changing the due
                    date is not available yet.
                  </p>
                ) : null}
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void saveTask()}
                  disabled={!draftTitle.trim() || isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
