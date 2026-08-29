"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock3,
  Filter,
  ListTodo,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

type TaskStatus = "todo" | "in-progress" | "completed";

type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  project: string;
  createdAt: string;
};

const initialTasks: Task[] = [
  {
    id: "task-1",
    title: "Prepare AI infrastructure strategy",
    description:
      "Define the core architecture and implementation roadmap.",
    status: "in-progress",
    priority: "high",
    dueDate: "2026-09-05",
    project: "Global AI Platform",
    createdAt: "2026-08-29",
  },
  {
    id: "task-2",
    title: "Review product architecture",
    description:
      "Review application modules and improve system scalability.",
    status: "todo",
    priority: "high",
    dueDate: "2026-09-10",
    project: "Core Platform",
    createdAt: "2026-08-29",
  },
  {
    id: "task-3",
    title: "Create marketplace strategy",
    description:
      "Define marketplace categories and partner ecosystem.",
    status: "todo",
    priority: "medium",
    dueDate: "2026-09-15",
    project: "Marketplace",
    createdAt: "2026-08-28",
  },
  {
    id: "task-4",
    title: "Design AI Studio workflow",
    description:
      "Connect image, video, audio and presentation generation.",
    status: "completed",
    priority: "medium",
    dueDate: "2026-08-28",
    project: "AI Studio",
    createdAt: "2026-08-27",
  },
];

const statusOptions: Array<{
  id: "all" | TaskStatus;
  label: string;
}> = [
  {
    id: "all",
    label: "All Tasks",
  },
  {
    id: "todo",
    label: "To Do",
  },
  {
    id: "in-progress",
    label: "In Progress",
  },
  {
    id: "completed",
    label: "Completed",
  },
];

const priorityOptions: Array<{
  id: "all" | TaskPriority;
  label: string;
}> = [
  {
    id: "all",
    label: "All Priorities",
  },
  {
    id: "high",
    label: "High",
  },
  {
    id: "medium",
    label: "Medium",
  },
  {
    id: "low",
    label: "Low",
  },
];

export default function TasksPage() {
  const [tasks, setTasks] =
    useState<Task[]>(initialTasks);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedStatus, setSelectedStatus] =
    useState<"all" | TaskStatus>("all");

  const [selectedPriority, setSelectedPriority] =
    useState<"all" | TaskPriority>("all");

  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false);

  const [newTaskTitle, setNewTaskTitle] =
    useState("");

  const [newTaskDescription, setNewTaskDescription] =
    useState("");

  const [newTaskPriority, setNewTaskPriority] =
    useState<TaskPriority>("medium");

  const [newTaskDueDate, setNewTaskDueDate] =
    useState("");

  const filteredTasks = useMemo(() => {
    const normalizedQuery =
      searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        task.title
          .toLowerCase()
          .includes(normalizedQuery) ||
        task.description
          .toLowerCase()
          .includes(normalizedQuery) ||
        task.project
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        selectedStatus === "all" ||
        task.status === selectedStatus;

      const matchesPriority =
        selectedPriority === "all" ||
        task.priority === selectedPriority;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    tasks,
    searchQuery,
    selectedStatus,
    selectedPriority,
  ]);

  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      todo: tasks.filter(
        (task) => task.status === "todo",
      ).length,
      inProgress: tasks.filter(
        (task) => task.status === "in-progress",
      ).length,
      completed: tasks.filter(
        (task) => task.status === "completed",
      ).length,
    };
  }, [tasks]);

  const updateTaskStatus = (
    taskId: string,
    status: TaskStatus,
  ) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
            }
          : task,
      ),
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks((currentTasks) =>
      currentTasks.filter(
        (task) => task.id !== taskId,
      ),
    );
  };

  const createTask = () => {
    if (!newTaskTitle.trim()) {
      return;
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      description:
        newTaskDescription.trim() ||
        "No description provided.",
      status: "todo",
      priority: newTaskPriority,
      dueDate:
        newTaskDueDate ||
        new Date().toISOString().split("T")[0],
      project: "General",
      createdAt:
        new Date().toISOString().split("T")[0],
    };

    setTasks((currentTasks) => [
      newTask,
      ...currentTasks,
    ]);

    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("medium");
    setNewTaskDueDate("");
    setIsCreateModalOpen(false);
  };

  const getPriorityClass = (
    priority: TaskPriority,
  ) => {
    switch (priority) {
      case "high":
        return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";

      case "medium":
        return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";

      case "low":
        return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    }
  };

  const getStatusLabel = (
    status: TaskStatus,
  ) => {
    switch (status) {
      case "todo":
        return "To Do";

      case "in-progress":
        return "In Progress";

      case "completed":
        return "Completed";
    }
  };

  const getStatusClass = (
    status: TaskStatus,
  ) => {
    switch (status) {
      case "todo":
        return "border-border bg-muted text-muted-foreground";

      case "in-progress":
        return "border-primary/20 bg-primary/10 text-primary";

      case "completed":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    }
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-foreground">
                Tasks
              </span>
            </div>

            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
              <ListTodo className="h-8 w-8 text-primary" />
              Tasks
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Plan, organize and manage every important
              task across your projects and AI workflows.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setIsCreateModalOpen(true)
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        </div>

        {/* STATS */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ListTodo className="h-5 w-5 text-primary" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              {taskStats.total}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Total Tasks
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10">
              <Circle className="h-5 w-5 text-slate-500" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              {taskStats.todo}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              To Do
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock3 className="h-5 w-5 text-primary" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              {taskStats.inProgress}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              In Progress
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>

            <p className="mt-5 text-2xl font-bold">
              {taskStats.completed}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Completed
            </p>
          </div>
        </section>

        {/* AI CTA */}

        <section className="relative mb-8 overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>

              <h2 className="mt-5 text-xl font-bold sm:text-2xl">
                AI-powered task intelligence
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Organize complex workflows, connect tasks
                to projects and build a structured execution
                system for your entire workspace.
              </p>
            </div>

            <Link
              href="/projects"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium transition hover:bg-muted"
            >
              View Projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* SEARCH */}

        <section className="mb-6 flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search tasks..."
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <select
              value={selectedPriority}
              onChange={(event) =>
                setSelectedPriority(
                  event.target
                    .value as "all" | TaskPriority,
                )
              }
              className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            >
              {priorityOptions.map((priority) => (
                <option
                  key={priority.id}
                  value={priority.id}
                >
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* STATUS TABS */}

        <div className="mb-6 flex flex-wrap gap-2">
          {statusOptions.map((status) => {
            const isSelected =
              selectedStatus === status.id;

            return (
              <button
                key={status.id}
                type="button"
                onClick={() =>
                  setSelectedStatus(status.id)
                }
                className={[
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                ].join(" ")}
              >
                {status.label}
              </button>
            );
          })}
        </div>

        {/* TASK LIST */}

        {filteredTasks.length > 0 ? (
          <section className="space-y-4">
            {filteredTasks.map((task) => {
              const isCompleted =
                task.status === "completed";

              return (
                <article
                  key={task.id}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                    {/* STATUS BUTTON */}

                    <button
                      type="button"
                      onClick={() =>
                        updateTaskStatus(
                          task.id,
                          isCompleted
                            ? "todo"
                            : "completed",
                        )
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border transition hover:bg-muted"
                      aria-label="Toggle task completion"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* CONTENT */}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={[
                            "text-base font-semibold",
                            isCompleted
                              ? "text-muted-foreground line-through"
                              : "",
                          ].join(" ")}
                        >
                          {task.title}
                        </h3>

                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-xs font-medium",
                            getStatusClass(task.status),
                          ].join(" ")}
                        >
                          {getStatusLabel(task.status)}
                        </span>

                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                            getPriorityClass(task.priority),
                          ].join(" ")}
                        >
                          {task.priority}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {task.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(task.dueDate)}
                        </span>

                        <span>{task.project}</span>
                      </div>
                    </div>

                    {/* STATUS SELECT */}

                    <div className="flex items-center gap-2">
                      <select
                        value={task.status}
                        onChange={(event) =>
                          updateTaskStatus(
                            task.id,
                            event.target
                              .value as TaskStatus,
                          )
                        }
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition focus:border-primary"
                      >
                        <option value="todo">
                          To Do
                        </option>

                        <option value="in-progress">
                          In Progress
                        </option>

                        <option value="completed">
                          Completed
                        </option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          deleteTask(task.id)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <ListTodo className="h-8 w-8 text-primary" />
            </div>

            <h2 className="mt-6 text-xl font-semibold">
              No tasks found
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Try changing your filters or create a new task
              to start organizing your workflow.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
                setSelectedPriority("all");
              }}
              className="mt-5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              Reset Filters
            </button>
          </section>
        )}

        {/* CREATE TASK MODAL */}

        {isCreateModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    Create New Task
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a new task to your workspace.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsCreateModalOpen(false)
                  }
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Task Title
                  </label>

                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(event) =>
                      setNewTaskTitle(
                        event.target.value,
                      )
                    }
                    placeholder="Enter task title..."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Description
                  </label>

                  <textarea
                    value={newTaskDescription}
                    onChange={(event) =>
                      setNewTaskDescription(
                        event.target.value,
                      )
                    }
                    rows={4}
                    placeholder="Describe the task..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Priority
                    </label>

                    <select
                      value={newTaskPriority}
                      onChange={(event) =>
                        setNewTaskPriority(
                          event.target
                            .value as TaskPriority,
                        )
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="low">
                        Low
                      </option>

                      <option value="medium">
                        Medium
                      </option>

                      <option value="high">
                        High
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Due Date
                    </label>

                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(event) =>
                        setNewTaskDueDate(
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setIsCreateModalOpen(false)
                  }
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createTask}
                  disabled={!newTaskTitle.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Create Task
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}