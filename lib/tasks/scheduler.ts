/**
 * SYRAVEN AI - Enterprise Task Scheduler
 * lib/ai/tasks/scheduler.ts
 *
 * Production-grade task scheduling system.
 * Designed for scalable multi-agent orchestration.
 */

export type TaskStatus =
  | "pending"
  | "scheduled"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type TaskPriority = "low" | "normal" | "high" | "critical";

export type TaskExecutionMode =
  | "immediate"
  | "scheduled"
  | "recurring"
  | "manual";

export interface TaskSchedule {
  executeAt?: Date;
  cron?: string;
  intervalMs?: number;
}

export interface TaskMetadata {
  source?: string;
  agentId?: string;
  userId?: string;
  projectId?: string;
  workflowId?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ScheduledTask<TPayload = unknown> {
  id: string;
  name: string;
  description?: string;

  payload: TPayload;

  status: TaskStatus;
  priority: TaskPriority;
  executionMode: TaskExecutionMode;

  schedule?: TaskSchedule;

  createdAt: Date;
  updatedAt: Date;

  startedAt?: Date;
  completedAt?: Date;

  attempts: number;
  maxAttempts: number;

  timeoutMs?: number;

  nextRunAt?: Date;
  lastRunAt?: Date;

  metadata?: TaskMetadata;

  error?: string;

  enabled: boolean;
}

export interface CreateTaskInput<TPayload = unknown> {
  id?: string;

  name: string;
  description?: string;

  payload: TPayload;

  priority?: TaskPriority;

  executionMode?: TaskExecutionMode;

  schedule?: TaskSchedule;

  maxAttempts?: number;

  timeoutMs?: number;

  metadata?: TaskMetadata;

  enabled?: boolean;
}

export interface UpdateTaskInput<TPayload = unknown> {
  name?: string;
  description?: string;

  payload?: TPayload;

  priority?: TaskPriority;

  status?: TaskStatus;

  executionMode?: TaskExecutionMode;

  schedule?: TaskSchedule;

  maxAttempts?: number;

  timeoutMs?: number;

  metadata?: TaskMetadata;

  enabled?: boolean;
}

export interface TaskExecutionResult {
  taskId: string;

  success: boolean;

  startedAt: Date;
  completedAt: Date;

  durationMs: number;

  error?: string;

  result?: unknown;
}

export type TaskHandler<TPayload = unknown> = (
  task: ScheduledTask<TPayload>
) => Promise<unknown>;

export interface SchedulerStats {
  total: number;

  pending: number;
  scheduled: number;
  running: number;

  completed: number;
  failed: number;

  cancelled: number;
  paused: number;

  enabled: number;
  disabled: number;
}

/**
 * Generate unique task ID.
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);

  return `task_${timestamp}_${random}`;
}

/**
 * Safely clone a task.
 */
function cloneTask<TPayload>(
  task: ScheduledTask<TPayload>
): ScheduledTask<TPayload> {
  return {
    ...task,

    schedule: task.schedule
      ? {
          ...task.schedule,
          executeAt: task.schedule.executeAt
            ? new Date(task.schedule.executeAt)
            : undefined,
        }
      : undefined,

    metadata: task.metadata
      ? {
          ...task.metadata,
          tags: task.metadata.tags
            ? [...task.metadata.tags]
            : undefined,
        }
      : undefined,

    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),

    startedAt: task.startedAt
      ? new Date(task.startedAt)
      : undefined,

    completedAt: task.completedAt
      ? new Date(task.completedAt)
      : undefined,

    nextRunAt: task.nextRunAt
      ? new Date(task.nextRunAt)
      : undefined,

    lastRunAt: task.lastRunAt
      ? new Date(task.lastRunAt)
      : undefined,
  };
}

/**
 * Priority weight.
 */
function getPriorityWeight(priority: TaskPriority): number {
  switch (priority) {
    case "critical":
      return 4;

    case "high":
      return 3;

    case "normal":
      return 2;

    case "low":
      return 1;

    default:
      return 2;
  }
}

/**
 * Enterprise Task Scheduler.
 */
export class TaskScheduler {
  private readonly tasks = new Map<string, ScheduledTask>();

  private readonly handlers = new Map<
    string,
    TaskHandler
  >();

  private readonly activeExecutions = new Map<
    string,
    Promise<TaskExecutionResult>
  >();

  /**
   * Register task handler.
   */
  registerHandler<TPayload = unknown>(
    taskName: string,
    handler: TaskHandler<TPayload>
  ): void {
    this.handlers.set(
      taskName,
      handler as TaskHandler
    );
  }

  /**
   * Remove task handler.
   */
  unregisterHandler(taskName: string): boolean {
    return this.handlers.delete(taskName);
  }

  /**
   * Check handler availability.
   */
  hasHandler(taskName: string): boolean {
    return this.handlers.has(taskName);
  }

  /**
   * Create task.
   */
  createTask<TPayload = unknown>(
    input: CreateTaskInput<TPayload>
  ): ScheduledTask<TPayload> {
    const now = new Date();

    const executionMode =
      input.executionMode ?? "manual";

    const task: ScheduledTask<TPayload> = {
      id: input.id ?? generateTaskId(),

      name: input.name,

      description: input.description,

      payload: input.payload,

      status:
        executionMode === "scheduled" ||
        executionMode === "recurring"
          ? "scheduled"
          : "pending",

      priority: input.priority ?? "normal",

      executionMode,

      schedule: input.schedule
        ? {
            ...input.schedule,
          }
        : undefined,

      createdAt: now,

      updatedAt: now,

      attempts: 0,

      maxAttempts: Math.max(
        1,
        input.maxAttempts ?? 3
      ),

      timeoutMs: input.timeoutMs,

      nextRunAt:
        input.schedule?.executeAt
          ? new Date(input.schedule.executeAt)
          : undefined,

      metadata: input.metadata
        ? {
            ...input.metadata,
          }
        : undefined,

      enabled: input.enabled ?? true,
    };

    this.tasks.set(
      task.id,
      task as ScheduledTask
    );

    return cloneTask(task);
  }

  /**
   * Get task.
   */
  getTask<TPayload = unknown>(
    taskId: string
  ): ScheduledTask<TPayload> | null {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    return cloneTask(
      task as ScheduledTask<TPayload>
    );
  }

  /**
   * Get all tasks.
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
      .map((task) => cloneTask(task));
  }

  /**
   * Get tasks by status.
   */
  getTasksByStatus(
    status: TaskStatus
  ): ScheduledTask[] {
    return this.getTasks().filter(
      (task) => task.status === status
    );
  }

  /**
   * Get tasks by agent.
   */
  getTasksByAgent(
    agentId: string
  ): ScheduledTask[] {
    return this.getTasks().filter(
      (task) => task.metadata?.agentId === agentId
    );
  }

  /**
   * Update task.
   */
  updateTask<TPayload = unknown>(
    taskId: string,
    input: UpdateTaskInput<TPayload>
  ): ScheduledTask<TPayload> | null {
    const existingTask = this.tasks.get(taskId);

    if (!existingTask) {
      return null;
    }

    const updatedTask: ScheduledTask<TPayload> = {
      ...(existingTask as ScheduledTask<TPayload>),

      ...input,

      schedule:
        input.schedule !== undefined
          ? {
              ...input.schedule,
            }
          : existingTask.schedule,

      metadata:
        input.metadata !== undefined
          ? {
              ...existingTask.metadata,
              ...input.metadata,
            }
          : existingTask.metadata,

      updatedAt: new Date(),
    };

    if (
      input.schedule?.executeAt
    ) {
      updatedTask.nextRunAt =
        new Date(
          input.schedule.executeAt
        );
    }

    this.tasks.set(
      taskId,
      updatedTask as ScheduledTask
    );

    return cloneTask(updatedTask);
  }

  /**
   * Delete task.
   */
  deleteTask(taskId: string): boolean {
    if (
      this.activeExecutions.has(taskId)
    ) {
      return false;
    }

    return this.tasks.delete(taskId);
  }

  /**
   * Cancel task.
   */
  cancelTask(
    taskId: string
  ): ScheduledTask | null {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    if (task.status === "running") {
      return null;
    }

    task.status = "cancelled";
    task.enabled = false;
    task.updatedAt = new Date();

    this.tasks.set(taskId, task);

    return cloneTask(task);
  }

  /**
   * Pause task.
   */
  pauseTask(
    taskId: string
  ): ScheduledTask | null {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    if (task.status === "running") {
      return null;
    }

    task.status = "paused";
    task.enabled = false;
    task.updatedAt = new Date();

    this.tasks.set(taskId, task);

    return cloneTask(task);
  }

  /**
   * Resume task.
   */
  resumeTask(
    taskId: string
  ): ScheduledTask | null {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    if (task.status === "running") {
      return null;
    }

    task.enabled = true;

    task.status =
      task.executionMode === "scheduled" ||
      task.executionMode === "recurring"
        ? "scheduled"
        : "pending";

    task.updatedAt = new Date();

    this.tasks.set(taskId, task);

    return cloneTask(task);
  }

  /**
   * Execute a task.
   */
  async executeTask(
    taskId: string
  ): Promise<TaskExecutionResult> {
    const existingExecution =
      this.activeExecutions.get(taskId);

    if (existingExecution) {
      return existingExecution;
    }

    const executionPromise =
      this.runTask(taskId);

    this.activeExecutions.set(
      taskId,
      executionPromise
    );

    try {
      return await executionPromise;
    } finally {
      this.activeExecutions.delete(taskId);
    }
  }

  /**
   * Internal task execution.
   */
  private async runTask(
    taskId: string
  ): Promise<TaskExecutionResult> {
    const task = this.tasks.get(taskId);

    const startedAt = new Date();

    if (!task) {
      const completedAt = new Date();

      return {
        taskId,
        success: false,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        error: "Task not found.",
      };
    }

    if (!task.enabled) {
      const completedAt = new Date();

      return {
        taskId,
        success: false,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        error: "Task is disabled.",
      };
    }

    const handler =
      this.handlers.get(task.name);

    if (!handler) {
      const completedAt = new Date();

      task.status = "failed";
      task.error =
        `No handler registered for task: ${task.name}`;

      task.completedAt = completedAt;
      task.updatedAt = completedAt;

      this.tasks.set(task.id, task);

      return {
        taskId,
        success: false,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        error: task.error,
      };
    }

    task.status = "running";
    task.startedAt = startedAt;
    task.lastRunAt = startedAt;
    task.attempts += 1;
    task.updatedAt = startedAt;

    this.tasks.set(task.id, task);

    try {
      const result =
        await this.executeWithTimeout(
          () =>
            handler(
              cloneTask(task)
            ),
          task.timeoutMs
        );

      const completedAt = new Date();

      task.status = "completed";
      task.completedAt = completedAt;
      task.updatedAt = completedAt;
      task.error = undefined;

      if (
        task.executionMode === "recurring"
      ) {
        task.status = "scheduled";
        task.nextRunAt =
          this.calculateNextRun(task);
      }

      this.tasks.set(task.id, task);

      return {
        taskId,
        success: true,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        result,
      };
    } catch (error) {
      const completedAt = new Date();

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      task.error = errorMessage;
      task.completedAt = completedAt;
      task.updatedAt = completedAt;

      const shouldRetry =
        task.attempts < task.maxAttempts;

      task.status = shouldRetry
        ? "scheduled"
        : "failed";

      if (shouldRetry) {
        task.nextRunAt =
          this.calculateRetryTime(
            task
          );
      }

      this.tasks.set(task.id, task);

      return {
        taskId,
        success: false,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        error: errorMessage,
      };
    }
  }

  /**
   * Execute promise with timeout.
   */
  private async executeWithTimeout<T>(
    callback: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (
      !timeoutMs ||
      timeoutMs <= 0
    ) {
      return callback();
    }

    return Promise.race([
      callback(),

      new Promise<T>(
        (_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Task execution timed out after ${timeoutMs}ms.`
              )
            );
          }, timeoutMs);
        }
      ),
    ]);
  }

  /**
   * Calculate retry time using exponential backoff.
   */
  private calculateRetryTime(
    task: ScheduledTask
  ): Date {
    const baseDelay = 1000;

    const exponent =
      Math.max(
        0,
        task.attempts - 1
      );

    const delay =
      Math.min(
        baseDelay *
          Math.pow(2, exponent),
        60_000
      );

    return new Date(
      Date.now() + delay
    );
  }

  /**
   * Calculate next recurring execution.
   */
  private calculateNextRun(
    task: ScheduledTask
  ): Date | undefined {
    const interval =
      task.schedule?.intervalMs;

    if (
      interval &&
      interval > 0
    ) {
      return new Date(
        Date.now() + interval
      );
    }

    return undefined;
  }

  /**
   * Execute due tasks.
   */
  async runDueTasks(): Promise<
    TaskExecutionResult[]
  > {
    const now = Date.now();

    const dueTasks =
      Array.from(
        this.tasks.values()
      )
        .filter((task) => {
          if (!task.enabled) {
            return false;
          }

          if (
            task.status !== "scheduled" &&
            task.status !== "pending"
          ) {
            return false;
          }

          if (
            task.executionMode ===
            "manual"
          ) {
            return false;
          }

          if (!task.nextRunAt) {
            return task.status === "pending";
          }

          return (
            task.nextRunAt.getTime() <= now
          );
        })
        .sort((a, b) => {
          const priorityDifference =
            getPriorityWeight(
              b.priority
            ) -
            getPriorityWeight(
              a.priority
            );

          if (
            priorityDifference !== 0
          ) {
            return priorityDifference;
          }

          return (
            a.createdAt.getTime() -
            b.createdAt.getTime()
          );
        });

    const results =
      await Promise.all(
        dueTasks.map((task) =>
          this.executeTask(task.id)
        )
      );

    return results;
  }

  /**
   * Execute immediate task.
   */
  async runNow(
    taskId: string
  ): Promise<TaskExecutionResult> {
    return this.executeTask(taskId);
  }

  /**
   * Get scheduler statistics.
   */
  getStats(): SchedulerStats {
    const stats: SchedulerStats = {
      total: 0,

      pending: 0,
      scheduled: 0,
      running: 0,

      completed: 0,
      failed: 0,

      cancelled: 0,
      paused: 0,

      enabled: 0,
      disabled: 0,
    };

    for (
      const task of this.tasks.values()
    ) {
      stats.total += 1;

      if (task.enabled) {
        stats.enabled += 1;
      } else {
        stats.disabled += 1;
      }

      switch (task.status) {
        case "pending":
          stats.pending += 1;
          break;

        case "scheduled":
          stats.scheduled += 1;
          break;

        case "running":
          stats.running += 1;
          break;

        case "completed":
          stats.completed += 1;
          break;

        case "failed":
          stats.failed += 1;
          break;

        case "cancelled":
          stats.cancelled += 1;
          break;

        case "paused":
          stats.paused += 1;
          break;
      }
    }

    return stats;
  }

  /**
   * Remove completed tasks.
   */
  clearCompleted(): number {
    let removed = 0;

    for (
      const [
        taskId,
        task
      ] of this.tasks.entries()
    ) {
      if (
        task.status === "completed"
      ) {
        this.tasks.delete(taskId);
        removed += 1;
      }
    }

    return removed;
  }

  /**
   * Remove failed tasks.
   */
  clearFailed(): number {
    let removed = 0;

    for (
      const [
        taskId,
        task
      ] of this.tasks.entries()
    ) {
      if (
        task.status === "failed"
      ) {
        this.tasks.delete(taskId);
        removed += 1;
      }
    }

    return removed;
  }

  /**
   * Clear all tasks.
   */
  clear(): void {
    this.tasks.clear();
  }

  /**
   * Get active execution count.
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }
}

/**
 * Global scheduler instance.
 */
export const taskScheduler =
  new TaskScheduler();

export default taskScheduler;