/**
 * SYRAVEN Task Service
 *
 * Enterprise-grade asynchronous task management.
 *
 * Features:
 * - Task creation
 * - Queue management
 * - Priority execution
 * - Scheduled tasks
 * - Retry handling
 * - Timeout handling
 * - Cancellation
 * - Pause / resume
 * - Bounded concurrency
 * - Task history
 * - Typed handlers
 * - Strict TypeScript compatibility
 * - In-memory execution engine
 *
 * Production adapters can later include:
 * - BullMQ / Redis
 * - Temporal
 * - AWS SQS
 * - RabbitMQ
 * - Google Cloud Tasks
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type TaskStatus =
  | "pending"
  | "scheduled"
  | "running"
  | "completed"
  | "failed"
  | "retrying"
  | "cancelled"
  | "paused";

export type TaskPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

/**
 * Task payloads intentionally use unknown.
 *
 * This allows strongly typed generic payloads without forcing
 * every payload to extend Record<string, unknown> or unknown[].
 */
export type TaskPayload = unknown;

export interface Task<
  TPayload extends TaskPayload = TaskPayload,
  TResult = unknown
> {
  id: string;

  type: string;

  payload: TPayload;

  status: TaskStatus;

  priority: TaskPriority;

  attempts: number;

  maxAttempts: number;

  timeoutMs?: number;

  runAt?: Date;

  createdAt: Date;

  updatedAt: Date;

  startedAt?: Date;

  completedAt?: Date;

  cancelledAt?: Date;

  result?: TResult;

  error?: TaskError;

  metadata?: Record<string, unknown>;
}

export interface TaskError {
  message: string;

  name?: string;

  stack?: string;

  retryable: boolean;

  timestamp: Date;
}

export interface CreateTaskInput<
  TPayload extends TaskPayload = TaskPayload
> {
  type: string;

  payload: TPayload;

  priority?: TaskPriority;

  maxAttempts?: number;

  timeoutMs?: number;

  runAt?: Date;

  metadata?: Record<string, unknown>;
}

export interface TaskHandlerContext {
  taskId: string;

  taskType: string;

  attempt: number;

  signal?: AbortSignal;
}

export type TaskHandler<
  TPayload extends TaskPayload = TaskPayload,
  TResult = unknown
> = (
  payload: TPayload,
  context: TaskHandlerContext
) => Promise<TResult> | TResult;

export interface TaskListOptions {
  status?: TaskStatus | TaskStatus[];

  type?: string;

  priority?: TaskPriority;

  limit?: number;

  offset?: number;
}

export interface TaskListResult {
  tasks: Task[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface TaskStats {
  total: number;

  pending: number;

  scheduled: number;

  running: number;

  completed: number;

  failed: number;

  retrying: number;

  cancelled: number;

  paused: number;
}

export interface TaskServiceOptions {
  concurrency?: number;

  autoStart?: boolean;

  pollIntervalMs?: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class TaskServiceError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "TaskServiceError";
  }
}

export class TaskValidationError extends TaskServiceError {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));

    this.name = "TaskValidationError";

    this.errors = errors;
  }
}

export class TaskNotFoundError extends TaskServiceError {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);

    this.name = "TaskNotFoundError";
  }
}

export class TaskHandlerNotFoundError extends TaskServiceError {
  constructor(taskType: string) {
    super(`Task handler not found: ${taskType}`);

    this.name = "TaskHandlerNotFoundError";
  }
}

export class TaskTimeoutError extends TaskServiceError {
  constructor(
    taskId: string,
    timeoutMs: number
  ) {
    super(
      `Task "${taskId}" exceeded timeout of ${timeoutMs}ms.`
    );

    this.name = "TaskTimeoutError";
  }
}

export class TaskCancelledError extends TaskServiceError {
  constructor(taskId: string) {
    super(`Task was cancelled: ${taskId}`);

    this.name = "TaskCancelledError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_TASK_CONCURRENCY = 5;

export const MAX_TASK_CONCURRENCY = 100;

export const DEFAULT_MAX_ATTEMPTS = 3;

export const DEFAULT_POLL_INTERVAL_MS = 250;

export const MIN_POLL_INTERVAL_MS = 50;

export const MAX_TASK_TIMEOUT_MS =
  60 * 60 * 1000;

export const DEFAULT_TASK_LIST_LIMIT = 100;

export const MAX_TASK_LIST_LIMIT = 1_000;

const PRIORITY_VALUES: Record<
  TaskPriority,
  number
> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

/* -------------------------------------------------------------------------- */
/*                               TASK SERVICE                                 */
/* -------------------------------------------------------------------------- */

export class TaskService {
  private readonly tasks = new Map<
    string,
    Task
  >();

  private readonly handlers = new Map<
    string,
    TaskHandler
  >();

  private readonly controllers = new Map<
    string,
    AbortController
  >();

  private concurrency: number;

  private runningCount = 0;

  private started = false;

  private processing = false;

  private pollIntervalMs: number;

  private pollTimer:
    | ReturnType<typeof setInterval>
    | null = null;

  constructor(
    options: TaskServiceOptions = {}
  ) {
    this.concurrency = normalizeConcurrency(
      options.concurrency
    );

    this.pollIntervalMs =
      normalizePollInterval(
        options.pollIntervalMs
      );

    if (options.autoStart !== false) {
      this.start();
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                HANDLERS                                  */
  /* ------------------------------------------------------------------------ */

  registerHandler<
    TPayload extends TaskPayload = TaskPayload,
    TResult = unknown
  >(
    type: string,
    handler: TaskHandler<TPayload, TResult>
  ): void {
    const normalizedType =
      normalizeTaskType(type);

    if (typeof handler !== "function") {
      throw new TaskValidationError([
        "Task handler must be a function.",
      ]);
    }

    this.handlers.set(
      normalizedType,
      handler as unknown as TaskHandler
    );
  }

  unregisterHandler(
    type: string
  ): boolean {
    return this.handlers.delete(
      normalizeTaskType(type)
    );
  }

  hasHandler(
    type: string
  ): boolean {
    return this.handlers.has(
      normalizeTaskType(type)
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                CREATION                                  */
  /* ------------------------------------------------------------------------ */

  create<
    TPayload extends TaskPayload = TaskPayload
  >(
    input: CreateTaskInput<TPayload>
  ): Task<TPayload> {
    this.validateCreateInput(input);

    const now = new Date();

    const runAt = input.runAt
      ? new Date(input.runAt)
      : undefined;

    const task: Task<TPayload> = {
      id: generateTaskId(),

      type: normalizeTaskType(
        input.type
      ),

      payload: cloneValue(
        input.payload
      ),

      status:
        runAt &&
        runAt.getTime() > now.getTime()
          ? "scheduled"
          : "pending",

      priority:
        input.priority ?? "normal",

      attempts: 0,

      maxAttempts:
        normalizeMaxAttempts(
          input.maxAttempts
        ),

      timeoutMs:
        normalizeTimeout(
          input.timeoutMs
        ),

      runAt,

      createdAt: now,

      updatedAt: now,

      metadata: input.metadata
        ? cloneRecord(input.metadata)
        : undefined,
    };

    this.tasks.set(
      task.id,
      task as Task
    );

    void this.process();

    return this.cloneTask(
      task
    );
  }

  createMany<
    TPayload extends TaskPayload = TaskPayload
  >(
    inputs: CreateTaskInput<TPayload>[]
  ): Task<TPayload>[] {
    return inputs.map(
      (input) => this.create(input)
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  READ                                    */
  /* ------------------------------------------------------------------------ */

  get(
    taskId: string
  ): Task | undefined {
    const task = this.tasks.get(taskId);

    return task
      ? this.cloneTask(task)
      : undefined;
  }

  require(
    taskId: string
  ): Task {
    const task = this.get(taskId);

    if (!task) {
      throw new TaskNotFoundError(
        taskId
      );
    }

    return task;
  }

  list(
    options: TaskListOptions = {}
  ): TaskListResult {
    const limit = normalizeListLimit(
      options.limit
    );

    const offset = normalizeOffset(
      options.offset
    );

    let tasks = Array.from(
      this.tasks.values()
    );

    if (options.status) {
      const statuses = new Set(
        Array.isArray(options.status)
          ? options.status
          : [options.status]
      );

      tasks = tasks.filter(
        (task) =>
          statuses.has(task.status)
      );
    }

    if (options.type) {
      const type = normalizeTaskType(
        options.type
      );

      tasks = tasks.filter(
        (task) => task.type === type
      );
    }

    if (options.priority) {
      tasks = tasks.filter(
        (task) =>
          task.priority ===
          options.priority
      );
    }

    tasks.sort((a, b) => {
      const priorityDifference =
        PRIORITY_VALUES[b.priority] -
        PRIORITY_VALUES[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        b.createdAt.getTime() -
        a.createdAt.getTime()
      );
    });

    const total = tasks.length;

    const items = tasks
      .slice(
        offset,
        offset + limit
      )
      .map((task) =>
        this.cloneTask(task)
      );

    return {
      tasks: items,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  getStats(): TaskStats {
    const stats: TaskStats = {
      total: this.tasks.size,
      pending: 0,
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      cancelled: 0,
      paused: 0,
    };

    for (const task of this.tasks.values()) {
      stats[task.status] += 1;
    }

    return stats;
  }

  /* ------------------------------------------------------------------------ */
  /*                              TASK CONTROL                                */
  /* ------------------------------------------------------------------------ */

  cancel(
    taskId: string
  ): Task {
    const task =
      this.requireInternal(taskId);

    if (
      task.status === "completed" ||
      task.status === "failed" ||
      task.status === "cancelled"
    ) {
      return this.cloneTask(task);
    }

    this.controllers
      .get(taskId)
      ?.abort();

    task.status = "cancelled";

    task.cancelledAt = new Date();

    task.updatedAt = new Date();

    task.error = this.createTaskError(
      new TaskCancelledError(taskId),
      false
    );

    this.tasks.set(taskId, task);

    return this.cloneTask(task);
  }

  pause(
    taskId: string
  ): Task {
    const task =
      this.requireInternal(taskId);

    if (
      task.status !== "pending" &&
      task.status !== "scheduled" &&
      task.status !== "retrying"
    ) {
      return this.cloneTask(task);
    }

    task.status = "paused";

    task.updatedAt = new Date();

    this.tasks.set(taskId, task);

    return this.cloneTask(task);
  }

  resume(
    taskId: string
  ): Task {
    const task =
      this.requireInternal(taskId);

    if (task.status !== "paused") {
      return this.cloneTask(task);
    }

    const now = new Date();

    task.status =
      task.runAt &&
      task.runAt.getTime() >
        now.getTime()
        ? "scheduled"
        : "pending";

    task.updatedAt = now;

    this.tasks.set(taskId, task);

    void this.process();

    return this.cloneTask(task);
  }

  retry(
    taskId: string
  ): Task {
    const task =
      this.requireInternal(taskId);

    if (
      task.status !== "failed" &&
      task.status !== "cancelled"
    ) {
      throw new TaskServiceError(
        `Task "${taskId}" cannot be retried from status "${task.status}".`
      );
    }

    task.status = "pending";

    task.error = undefined;

    task.cancelledAt = undefined;

    task.completedAt = undefined;

    task.startedAt = undefined;

    task.updatedAt = new Date();

    this.tasks.set(taskId, task);

    void this.process();

    return this.cloneTask(task);
  }

  delete(
    taskId: string
  ): boolean {
    const task = this.tasks.get(taskId);

    if (!task) {
      return false;
    }

    if (task.status === "running") {
      this.cancel(taskId);
    }

    this.controllers.delete(taskId);

    return this.tasks.delete(taskId);
  }

  clear(
    includeRunning = false
  ): void {
    for (const task of this.tasks.values()) {
      if (
        task.status === "running" &&
        !includeRunning
      ) {
        continue;
      }

      if (task.status === "running") {
        this.controllers
          .get(task.id)
          ?.abort();
      }

      this.tasks.delete(task.id);

      this.controllers.delete(task.id);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                              PROCESS CONTROL                             */
  /* ------------------------------------------------------------------------ */

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    this.pollTimer = setInterval(
      () => {
        void this.process();
      },
      this.pollIntervalMs
    );

    void this.process();
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(
        this.pollTimer
      );
    }

    this.pollTimer = null;

    this.started = false;
  }

  isRunning(): boolean {
    return this.started;
  }

  setConcurrency(
    value: number
  ): void {
    this.concurrency =
      normalizeConcurrency(value);

    void this.process();
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  getRunningCount(): number {
    return this.runningCount;
  }

  /* ------------------------------------------------------------------------ */
  /*                              TASK EXECUTION                              */
  /* ------------------------------------------------------------------------ */

  private async process(): Promise<void> {
    if (
      !this.started ||
      this.processing
    ) {
      return;
    }

    this.processing = true;

    try {
      while (
        this.runningCount <
        this.concurrency
      ) {
        const task =
          this.getNextRunnableTask();

        if (!task) {
          break;
        }

        this.runningCount += 1;

        void this.executeTask(
          task.id
        ).finally(() => {
          this.runningCount =
            Math.max(
              0,
              this.runningCount - 1
            );

          void this.process();
        });
      }
    } finally {
      this.processing = false;
    }
  }

  private getNextRunnableTask():
    | Task
    | undefined {
    const now = Date.now();

    const candidates = Array.from(
      this.tasks.values()
    )
      .filter((task) => {
        if (
          task.status !== "pending" &&
          task.status !== "retrying" &&
          task.status !== "scheduled"
        ) {
          return false;
        }

        if (
          task.runAt &&
          task.runAt.getTime() > now
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priorityDifference =
          PRIORITY_VALUES[b.priority] -
          PRIORITY_VALUES[a.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return (
          a.createdAt.getTime() -
          b.createdAt.getTime()
        );
      });

    return candidates[0];
  }

  private async executeTask(
    taskId: string
  ): Promise<void> {
    const task =
      this.tasks.get(taskId);

    if (!task) {
      return;
    }

    if (task.status === "cancelled") {
      return;
    }

    const handler =
      this.handlers.get(task.type);

    if (!handler) {
      this.failTask(
        task,
        new TaskHandlerNotFoundError(
          task.type
        ),
        false
      );

      return;
    }

    const controller =
      new AbortController();

    this.controllers.set(
      task.id,
      controller
    );

    task.status = "running";

    task.attempts += 1;

    task.startedAt = new Date();

    task.updatedAt = new Date();

    this.tasks.set(task.id, task);

    try {
      const result =
        await this.executeWithTimeout(
          task,
          handler,
          controller.signal
        );

      const current =
        this.tasks.get(task.id);

      if (
        !current ||
        current.status === "cancelled"
      ) {
        return;
      }

      current.status = "completed";

      current.result =
        cloneValue(result);

      current.completedAt =
        new Date();

      current.updatedAt =
        new Date();

      current.error = undefined;

      this.tasks.set(
        current.id,
        current
      );
    } catch (error) {
      const current =
        this.tasks.get(task.id);

      if (!current) {
        return;
      }

      if (
        current.status === "cancelled" ||
        controller.signal.aborted
      ) {
        current.status = "cancelled";

        current.cancelledAt =
          current.cancelledAt ??
          new Date();

        current.updatedAt =
          new Date();

        current.error =
          this.createTaskError(
            new TaskCancelledError(
              current.id
            ),
            false
          );

        this.tasks.set(
          current.id,
          current
        );

        return;
      }

      const retryable =
        this.isRetryableError(error);

      this.failTask(
        current,
        error,
        retryable
      );
    } finally {
      this.controllers.delete(
        task.id
      );
    }
  }

  private async executeWithTimeout(
    task: Task,
    handler: TaskHandler,
    signal: AbortSignal
  ): Promise<unknown> {
    const context: TaskHandlerContext = {
      taskId: task.id,
      taskType: task.type,
      attempt: task.attempts,
      signal,
    };

    const execution = Promise.resolve(
      handler(
        cloneValue(task.payload),
        context
      )
    );

    if (!task.timeoutMs) {
      return execution;
    }

    let timeoutId:
      | ReturnType<typeof setTimeout>
      | undefined;

    const timeout = new Promise<never>(
      (_resolve, reject) => {
        timeoutId = setTimeout(() => {
          this.controllers
            .get(task.id)
            ?.abort();

          reject(
            new TaskTimeoutError(
              task.id,
              task.timeoutMs ?? 0
            )
          );
        }, task.timeoutMs);
      }
    );

    try {
      return await Promise.race([
        execution,
        timeout,
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private failTask(
    task: Task,
    error: unknown,
    retryable: boolean
  ): void {
    const taskError =
      this.createTaskError(
        error,
        retryable
      );

    task.error = taskError;

    task.updatedAt = new Date();

    const canRetry =
      retryable &&
      task.attempts <
        task.maxAttempts;

    if (canRetry) {
      task.status = "retrying";

      this.tasks.set(
        task.id,
        task
      );

      queueMicrotask(() => {
        const current =
          this.tasks.get(task.id);

        if (
          !current ||
          current.status !== "retrying"
        ) {
          return;
        }

        current.status = "pending";

        current.updatedAt =
          new Date();

        this.tasks.set(
          current.id,
          current
        );

        void this.process();
      });

      return;
    }

    task.status = "failed";

    this.tasks.set(
      task.id,
      task
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UTILS                                   */
  /* ------------------------------------------------------------------------ */

  private requireInternal(
    taskId: string
  ): Task {
    const task =
      this.tasks.get(taskId);

    if (!task) {
      throw new TaskNotFoundError(
        taskId
      );
    }

    return task;
  }

  private validateCreateInput(
    input: CreateTaskInput
  ): void {
    const errors: string[] = [];

    if (
      !input ||
      typeof input !== "object"
    ) {
      errors.push(
        "Task input is required."
      );

      throw new TaskValidationError(
        errors
      );
    }

    if (
      !input.type ||
      typeof input.type !== "string" ||
      !input.type.trim()
    ) {
      errors.push(
        "Task type is required."
      );
    }

    if (
      input.maxAttempts !== undefined &&
      (
        !Number.isFinite(
          input.maxAttempts
        ) ||
        input.maxAttempts <= 0
      )
    ) {
      errors.push(
        "Task maxAttempts must be a positive finite number."
      );
    }

    if (
      input.timeoutMs !== undefined &&
      (
        !Number.isFinite(
          input.timeoutMs
        ) ||
        input.timeoutMs <= 0
      )
    ) {
      errors.push(
        "Task timeoutMs must be a positive finite number."
      );
    }

    if (
      input.runAt &&
      Number.isNaN(
        new Date(
          input.runAt
        ).getTime()
      )
    ) {
      errors.push(
        "Task runAt must be a valid date."
      );
    }

    if (errors.length > 0) {
      throw new TaskValidationError(
        errors
      );
    }
  }

  private createTaskError(
    error: unknown,
    retryable: boolean
  ): TaskError {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        retryable,
        timestamp: new Date(),
      };
    }

    return {
      message:
        typeof error === "string"
          ? error
          : "Unknown task execution error.",
      retryable,
      timestamp: new Date(),
    };
  }

  private isRetryableError(
    error: unknown
  ): boolean {
    if (
      error instanceof TaskCancelledError ||
      error instanceof TaskHandlerNotFoundError
    ) {
      return false;
    }

    return true;
  }

  private cloneTask<
    TPayload extends TaskPayload = TaskPayload,
    TResult = unknown
  >(
    task: Task<TPayload, TResult>
  ): Task<TPayload, TResult> {
    return {
      ...task,

      payload: cloneValue(
        task.payload
      ),

      result:
        task.result === undefined
          ? undefined
          : cloneValue(task.result),

      error: task.error
        ? {
            ...task.error,
            timestamp: new Date(
              task.error.timestamp
            ),
          }
        : undefined,

      metadata: task.metadata
        ? cloneRecord(task.metadata)
        : undefined,

      runAt: task.runAt
        ? new Date(task.runAt)
        : undefined,

      createdAt: new Date(
        task.createdAt
      ),

      updatedAt: new Date(
        task.updatedAt
      ),

      startedAt: task.startedAt
        ? new Date(task.startedAt)
        : undefined,

      completedAt: task.completedAt
        ? new Date(task.completedAt)
        : undefined,

      cancelledAt: task.cancelledAt
        ? new Date(task.cancelledAt)
        : undefined,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

function normalizeTaskType(
  value: string
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new TaskValidationError([
      "Task type is required.",
    ]);
  }

  return value.trim();
}

function normalizeConcurrency(
  value?: number
): number {
  const concurrency =
    value ?? DEFAULT_TASK_CONCURRENCY;

  if (
    !Number.isFinite(concurrency) ||
    concurrency <= 0
  ) {
    throw new TaskValidationError([
      "Task concurrency must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(concurrency),
    MAX_TASK_CONCURRENCY
  );
}

function normalizeMaxAttempts(
  value?: number
): number {
  const attempts =
    value ?? DEFAULT_MAX_ATTEMPTS;

  if (
    !Number.isFinite(attempts) ||
    attempts <= 0
  ) {
    throw new TaskValidationError([
      "Task maxAttempts must be a positive finite number.",
    ]);
  }

  return Math.floor(attempts);
}

function normalizeTimeout(
  value?: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new TaskValidationError([
      "Task timeoutMs must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(value),
    MAX_TASK_TIMEOUT_MS
  );
}

function normalizePollInterval(
  value?: number
): number {
  const interval =
    value ?? DEFAULT_POLL_INTERVAL_MS;

  if (
    !Number.isFinite(interval) ||
    interval <= 0
  ) {
    throw new TaskValidationError([
      "Task poll interval must be a positive finite number.",
    ]);
  }

  return Math.max(
    MIN_POLL_INTERVAL_MS,
    Math.floor(interval)
  );
}

function normalizeListLimit(
  value?: number
): number {
  if (value === undefined) {
    return DEFAULT_TASK_LIST_LIMIT;
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new TaskValidationError([
      "Task list limit must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(value),
    MAX_TASK_LIST_LIMIT
  );
}

function normalizeOffset(
  value?: number
): number {
  if (value === undefined) {
    return 0;
  }

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new TaskValidationError([
      "Task list offset must be a non-negative finite number.",
    ]);
  }

  return Math.floor(value);
}

function generateTaskId(): string {
  const random = Math.random()
    .toString(36)
    .slice(2, 12);

  return `task_${Date.now()}_${random}`;
}

function cloneRecord(
  value: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...value,
  };
}

function cloneValue<T>(
  value: T
): T {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (value instanceof Date) {
    return new Date(
      value.getTime()
    ) as T;
  }

  if (value instanceof Uint8Array) {
    return new Uint8Array(
      value
    ) as T;
  }

  if (Array.isArray(value)) {
    return value.map(
      (item) => cloneValue(item)
    ) as T;
  }

  if (typeof value === "object") {
    return {
      ...(value as Record<
        string,
        unknown
      >),
    } as T;
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const taskService =
  new TaskService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function registerTaskHandler<
  TPayload extends TaskPayload = TaskPayload,
  TResult = unknown
>(
  type: string,
  handler: TaskHandler<
    TPayload,
    TResult
  >
): void {
  taskService.registerHandler(
    type,
    handler
  );
}

export function unregisterTaskHandler(
  type: string
): boolean {
  return taskService.unregisterHandler(
    type
  );
}

export function createTask<
  TPayload extends TaskPayload = TaskPayload
>(
  input: CreateTaskInput<TPayload>
): Task<TPayload> {
  return taskService.create(input);
}

export function createTasks<
  TPayload extends TaskPayload = TaskPayload
>(
  inputs: CreateTaskInput<TPayload>[]
): Task<TPayload>[] {
  return taskService.createMany(
    inputs
  );
}

export function getTask(
  taskId: string
): Task | undefined {
  return taskService.get(taskId);
}

export function requireTask(
  taskId: string
): Task {
  return taskService.require(taskId);
}

export function listTasks(
  options?: TaskListOptions
): TaskListResult {
  return taskService.list(options);
}

export function getTaskStats(): TaskStats {
  return taskService.getStats();
}

export function cancelTask(
  taskId: string
): Task {
  return taskService.cancel(taskId);
}

export function pauseTask(
  taskId: string
): Task {
  return taskService.pause(taskId);
}

export function resumeTask(
  taskId: string
): Task {
  return taskService.resume(taskId);
}

export function retryTask(
  taskId: string
): Task {
  return taskService.retry(taskId);
}

export function deleteTask(
  taskId: string
): boolean {
  return taskService.delete(taskId);
}

export function clearTasks(
  includeRunning = false
): void {
  taskService.clear(includeRunning);
}

export function startTaskService(): void {
  taskService.start();
}

export function stopTaskService(): void {
  taskService.stop();
}

export function setTaskConcurrency(
  concurrency: number
): void {
  taskService.setConcurrency(
    concurrency
  );
}

export function getTaskConcurrency(): number {
  return taskService.getConcurrency();
}

export default taskService;