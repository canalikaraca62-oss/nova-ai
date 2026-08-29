"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled";

export type TaskPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;
  workspaceId?: string;
  assigneeId?: string;
  tags?: string[];
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  workspaceId?: string;
  assigneeId?: string;
  tags?: string[];
  dueDate?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  workspaceId?: string;
  assigneeId?: string;
  tags?: string[];
  dueDate?: string | null;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TaskFilters {
  query?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  workspaceId?: string;
  assigneeId?: string;
  tags?: string[];
}

export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UseTasksOptions {
  initialTasks?: Task[];
  autoLoad?: boolean;
  endpoint?: string;
}

export interface UseTasksReturn {
  tasks: Task[];
  filteredTasks: Task[];

  selectedTask: Task | null;
  filters: TaskFilters;

  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  error: string | null;

  taskCount: number;
  completedCount: number;
  activeCount: number;

  load: () => Promise<void>;

  create: (
    input: CreateTaskInput
  ) => Promise<TaskResult<Task>>;

  update: (
    id: string,
    input: UpdateTaskInput
  ) => Promise<TaskResult<Task>>;

  remove: (
    id: string
  ) => Promise<TaskResult<string>>;

  complete: (
    id: string
  ) => Promise<TaskResult<Task>>;

  reopen: (
    id: string
  ) => Promise<TaskResult<Task>>;

  select: (
    task: Task | null
  ) => void;

  selectById: (
    id: string
  ) => void;

  clearSelection: () => void;

  setFilters: (
    filters: TaskFilters
  ) => void;

  updateFilters: (
    filters: Partial<TaskFilters>
  ) => void;

  clearFilters: () => void;

  refresh: () => Promise<void>;

  clearError: () => void;
}

const DEFAULT_ENDPOINT = "/api/tasks";

function normalizeText(
  value: string
): string {
  return value.trim().toLocaleLowerCase();
}

function matchesTags(
  task: Task,
  tags: string[]
): boolean {
  if (tags.length === 0) {
    return true;
  }

  const taskTags = (
    task.tags ?? []
  ).map(normalizeText);

  return tags.every((tag) =>
    taskTags.includes(
      normalizeText(tag)
    )
  );
}

function matchesTask(
  task: Task,
  filters: TaskFilters
): boolean {
  if (filters.query?.trim()) {
    const query = normalizeText(
      filters.query
    );

    const searchableText = [
      task.title,
      task.description ?? "",
      ...(task.tags ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();

    if (
      !searchableText.includes(query)
    ) {
      return false;
    }
  }

  if (
    filters.status &&
    task.status !== filters.status
  ) {
    return false;
  }

  if (
    filters.priority &&
    task.priority !== filters.priority
  ) {
    return false;
  }

  if (
    filters.projectId &&
    task.projectId !== filters.projectId
  ) {
    return false;
  }

  if (
    filters.workspaceId &&
    task.workspaceId !==
      filters.workspaceId
  ) {
    return false;
  }

  if (
    filters.assigneeId &&
    task.assigneeId !==
      filters.assigneeId
  ) {
    return false;
  }

  if (
    filters.tags &&
    filters.tags.length > 0 &&
    !matchesTags(
      task,
      filters.tags
    )
  ) {
    return false;
  }

  return true;
}

function isCompleted(
  task: Task
): boolean {
  return (
    task.status === "completed"
  );
}

async function parseResponse<T>(
  response: Response
): Promise<TaskResult<T>> {
  let payload: unknown = null;

  try {
    const contentType =
      response.headers.get(
        "content-type"
      ) ?? "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      payload = await response.json();
    }
  } catch {
    payload = null;
  }

  if (!response.ok) {
    let error =
      `Request failed with status ${response.status}`;

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      error = payload.error;
    }

    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data: payload as T,
  };
}

export function useTasks(
  options: UseTasksOptions = {}
): UseTasksReturn {
  const {
    initialTasks = [],
    autoLoad = true,
    endpoint = DEFAULT_ENDPOINT,
  } = options;

  const [tasks, setTasks] =
    useState<Task[]>(initialTasks);

  const [
    selectedTask,
    setSelectedTask,
  ] = useState<Task | null>(
    null
  );

  const [filters, setFiltersState] =
    useState<TaskFilters>({});

  const [isLoading, setIsLoading] =
    useState(false);

  const [isCreating, setIsCreating] =
    useState(false);

  const [isUpdating, setIsUpdating] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );

  const tasksRef =
    useRef<Task[]>(initialTasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) =>
        matchesTask(task, filters)
      ),
    [tasks, filters]
  );

  const taskCount = tasks.length;

  const completedCount = useMemo(
    () =>
      tasks.filter(isCompleted).length,
    [tasks]
  );

  const activeCount =
    taskCount - completedCount;

  const load = useCallback(
    async () => {
      abortControllerRef.current?.abort();

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          endpoint,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            signal: controller.signal,
          }
        );

        const result =
          await parseResponse<Task[]>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Tasks could not be loaded."
          );

          return;
        }

        setTasks(
          Array.isArray(result.data)
            ? result.data
            : []
        );
      } catch (requestError) {
        if (
          requestError instanceof
            DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred."
        );
      } finally {
        if (
          abortControllerRef.current ===
          controller
        ) {
          abortControllerRef.current =
            null;
        }

        setIsLoading(false);
      }
    },
    [endpoint]
  );

  const create = useCallback(
    async (
      input: CreateTaskInput
    ): Promise<TaskResult<Task>> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify(
              input
            ),
          }
        );

        const result =
          await parseResponse<Task>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Task could not be created."
          );

          return result;
        }

        if (result.data) {
          setTasks(
            (currentTasks) => [
              result.data as Task,
              ...currentTasks,
            ]
          );
        }

        return result;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setIsCreating(false);
      }
    },
    [endpoint]
  );

  const update = useCallback(
    async (
      id: string,
      input: UpdateTaskInput
    ): Promise<TaskResult<Task>> => {
      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch(
          `${endpoint}/${encodeURIComponent(
            id
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify(
              input
            ),
          }
        );

        const result =
          await parseResponse<Task>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Task could not be updated."
          );

          return result;
        }

        if (result.data) {
          const updatedTask =
            result.data;

          setTasks(
            (currentTasks) =>
              currentTasks.map(
                (task) =>
                  task.id === id
                    ? updatedTask
                    : task
              )
          );

          setSelectedTask(
            (currentTask) =>
              currentTask?.id === id
                ? updatedTask
                : currentTask
          );
        }

        return result;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setIsUpdating(false);
      }
    },
    [endpoint]
  );

  const remove = useCallback(
    async (
      id: string
    ): Promise<TaskResult<string>> => {
      setIsDeleting(true);
      setError(null);

      try {
        const response = await fetch(
          `${endpoint}/${encodeURIComponent(
            id
          )}`,
          {
            method: "DELETE",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

        const result =
          await parseResponse<unknown>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Task could not be deleted."
          );

          return {
            success: false,
            error: result.error,
          };
        }

        setTasks(
          (currentTasks) =>
            currentTasks.filter(
              (task) =>
                task.id !== id
            )
        );

        setSelectedTask(
          (currentTask) =>
            currentTask?.id === id
              ? null
              : currentTask
        );

        return {
          success: true,
          data: id,
        };
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setIsDeleting(false);
      }
    },
    [endpoint]
  );

  const complete = useCallback(
    async (
      id: string
    ): Promise<TaskResult<Task>> => {
      return update(id, {
        status: "completed",
        completedAt:
          new Date().toISOString(),
      });
    },
    [update]
  );

  const reopen = useCallback(
    async (
      id: string
    ): Promise<TaskResult<Task>> => {
      return update(id, {
        status: "todo",
        completedAt: null,
      });
    },
    [update]
  );

  const select = useCallback(
    (task: Task | null) => {
      setSelectedTask(task);
    },
    []
  );

  const selectById = useCallback(
    (id: string) => {
      setSelectedTask(
        tasksRef.current.find(
          (task) =>
            task.id === id
        ) ?? null
      );
    },
    []
  );

  const clearSelection =
    useCallback(() => {
      setSelectedTask(null);
    }, []);

  const setFilters = useCallback(
    (
      nextFilters: TaskFilters
    ) => {
      setFiltersState(nextFilters);
    },
    []
  );

  const updateFilters =
    useCallback(
      (
        nextFilters: Partial<TaskFilters>
      ) => {
        setFiltersState(
          (currentFilters) => ({
            ...currentFilters,
            ...nextFilters,
          })
        );
      },
      []
    );

  const clearFilters =
    useCallback(() => {
      setFiltersState({});
    }, []);

  const refresh = useCallback(
    async () => {
      await load();
    },
    [load]
  );

  const clearError =
    useCallback(() => {
      setError(null);
    },
    []
  );

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    void load();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [autoLoad, load]);

  return {
    tasks,
    filteredTasks,

    selectedTask,
    filters,

    isLoading,
    isCreating,
    isUpdating,
    isDeleting,

    error,

    taskCount,
    completedCount,
    activeCount,

    load,
    create,
    update,
    remove,

    complete,
    reopen,

    select,
    selectById,
    clearSelection,

    setFilters,
    updateFilters,
    clearFilters,

    refresh,
    clearError,
  };
}

export default useTasks;