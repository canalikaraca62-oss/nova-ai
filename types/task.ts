/**
 * SYRAVEN Task Types
 *
 * Shared task domain contracts.
 *
 * Supports:
 * - Asynchronous tasks
 * - Queues
 * - Priorities
 * - Scheduling
 * - Retries
 * - Timeouts
 * - Cancellation
 * - Pause / resume
 * - Task handlers
 * - Task execution
 * - Task history
 * - Filtering
 * - Pagination
 *
 * Designed for strict TypeScript and large-scale systems.
 */

/* -------------------------------------------------------------------------- */
/*                                TASK STATUS                                 */
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

/* -------------------------------------------------------------------------- */
/*                               TASK PRIORITY                                */
/* -------------------------------------------------------------------------- */

export type TaskPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

/* -------------------------------------------------------------------------- */
/*                                TASK PAYLOAD                                */
/* -------------------------------------------------------------------------- */

export type TaskPayload =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

/* -------------------------------------------------------------------------- */
/*                                TASK RESULT                                 */
/* -------------------------------------------------------------------------- */

export type TaskResult =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

/* -------------------------------------------------------------------------- */
/*                                TASK ERROR                                  */
/* -------------------------------------------------------------------------- */

export interface TaskError {
  message: string;

  name?: string;

  code?: string;

  stack?: string;

  retryable: boolean;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                  TASK                                      */
/* -------------------------------------------------------------------------- */

export interface Task<
  TPayload = TaskPayload,
  TResult = TaskResult
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

/* -------------------------------------------------------------------------- */
/*                             CREATE TASK INPUT                              */
/* -------------------------------------------------------------------------- */

export interface CreateTaskInput<
  TPayload = TaskPayload
> {
  type: string;

  payload: TPayload;

  priority?: TaskPriority;

  maxAttempts?: number;

  timeoutMs?: number;

  runAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             UPDATE TASK INPUT                              */
/* -------------------------------------------------------------------------- */

export interface UpdateTaskInput<
  TPayload = TaskPayload
> {
  payload?: TPayload;

  priority?: TaskPriority;

  maxAttempts?: number;

  timeoutMs?: number;

  runAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                           TASK HANDLER CONTEXT                             */
/* -------------------------------------------------------------------------- */

export interface TaskHandlerContext {
  taskId: string;

  taskType: string;

  attempt: number;

  maxAttempts: number;

  signal?: AbortSignal;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK HANDLER                                 */
/* -------------------------------------------------------------------------- */

export type TaskHandler<
  TPayload = unknown,
  TResult = unknown
> = (
  payload: TPayload,
  context: TaskHandlerContext
) => Promise<TResult> | TResult;

/* -------------------------------------------------------------------------- */
/*                           TASK HANDLER REGISTRATION                        */
/* -------------------------------------------------------------------------- */

export interface TaskHandlerRegistration {
  type: string;

  registeredAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            TASK EXECUTION EVENT                            */
/* -------------------------------------------------------------------------- */

export type TaskEventType =
  | "task.created"
  | "task.scheduled"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.retrying"
  | "task.cancelled"
  | "task.paused"
  | "task.resumed"
  | "task.deleted";

/* -------------------------------------------------------------------------- */
/*                               TASK EVENT                                   */
/* -------------------------------------------------------------------------- */

export interface TaskEvent {
  id: string;

  taskId: string;

  type: TaskEventType;

  timestamp: Date;

  attempt?: number;

  message?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              TASK EXECUTION                                */
/* -------------------------------------------------------------------------- */

export interface TaskExecution<
  TResult = TaskResult
> {
  id: string;

  taskId: string;

  attempt: number;

  status:
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "timed_out";

  startedAt: Date;

  completedAt?: Date;

  durationMs?: number;

  result?: TResult;

  error?: TaskError;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK FILTERS                                 */
/* -------------------------------------------------------------------------- */

export interface TaskListOptions {
  status?: TaskStatus | TaskStatus[];

  type?: string;

  priority?: TaskPriority;

  limit?: number;

  offset?: number;

  createdAfter?: Date;

  createdBefore?: Date;

  runAfter?: Date;

  runBefore?: Date;
}

/* -------------------------------------------------------------------------- */
/*                            TASK LIST RESULT                                */
/* -------------------------------------------------------------------------- */

export interface TaskListResult {
  tasks: Task[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              TASK STATISTICS                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                           TASK EXECUTION STATS                             */
/* -------------------------------------------------------------------------- */

export interface TaskExecutionStats {
  totalExecutions: number;

  successfulExecutions: number;

  failedExecutions: number;

  cancelledExecutions: number;

  timedOutExecutions: number;

  averageDurationMs: number;

  totalDurationMs: number;
}

/* -------------------------------------------------------------------------- */
/*                              TASK PERMISSION                               */
/* -------------------------------------------------------------------------- */

export interface TaskPermission {
  allowed: boolean;

  reason?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            RETRY CONFIGURATION                             */
/* -------------------------------------------------------------------------- */

export interface TaskRetryOptions {
  maxAttempts?: number;

  retryDelayMs?: number;

  backoffMultiplier?: number;

  maxRetryDelayMs?: number;
}

/* -------------------------------------------------------------------------- */
/*                           SCHEDULING CONFIGURATION                         */
/* -------------------------------------------------------------------------- */

export interface TaskScheduleOptions {
  runAt?: Date;

  delayMs?: number;

  timezone?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            TASK SERVICE OPTIONS                            */
/* -------------------------------------------------------------------------- */

export interface TaskServiceOptions {
  concurrency?: number;

  autoStart?: boolean;

  pollIntervalMs?: number;

  defaultMaxAttempts?: number;

  defaultTimeoutMs?: number;

  maxQueueSize?: number;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            TASK SERVICE STATE                              */
/* -------------------------------------------------------------------------- */

export interface TaskServiceState {
  started: boolean;

  processing: boolean;

  concurrency: number;

  runningCount: number;

  queuedCount: number;

  totalTasks: number;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                              CONSTANTS                                     */
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

/* -------------------------------------------------------------------------- */
/*                            PRIORITY VALUES                                 */
/* -------------------------------------------------------------------------- */

export const TASK_PRIORITY_VALUES:
  Record<TaskPriority, number> = {
    low: 1,

    normal: 2,

    high: 3,

    critical: 4,
  };

/* -------------------------------------------------------------------------- */
/*                          TERMINAL TASK STATUSES                            */
/* -------------------------------------------------------------------------- */

export const TERMINAL_TASK_STATUSES:
  readonly TaskStatus[] = [
    "completed",
    "failed",
    "cancelled",
  ];

/* -------------------------------------------------------------------------- */
/*                          ACTIVE TASK STATUSES                              */
/* -------------------------------------------------------------------------- */

export const ACTIVE_TASK_STATUSES:
  readonly TaskStatus[] = [
    "pending",
    "scheduled",
    "running",
    "retrying",
  ];