/**
 * SYRAVEN AI TASK SYSTEM
 * lib/ai/tasks/types.ts
 *
 * Enterprise task orchestration types.
 * Designed for scalable multi-agent workflows, scheduling,
 * retries, dependencies, priorities and execution tracking.
 */

/* -------------------------------------------------------------------------- */
/*                                BASIC TYPES                                 */
/* -------------------------------------------------------------------------- */

export type TaskId = string;

export type TaskName = string;

export type WorkflowId = string;

export type AgentId = string;

export type UserId = string;

export type OrganizationId = string;

/* -------------------------------------------------------------------------- */
/*                              TASK PRIORITY                                 */
/* -------------------------------------------------------------------------- */

export type TaskPriority =
  | "critical"
  | "high"
  | "normal"
  | "low"
  | "background";

/* -------------------------------------------------------------------------- */
/*                               TASK STATUS                                  */
/* -------------------------------------------------------------------------- */

export type TaskStatus =
  | "pending"
  | "queued"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying"
  | "blocked"
  | "expired";

/* -------------------------------------------------------------------------- */
/*                              TASK CATEGORY                                 */
/* -------------------------------------------------------------------------- */

export type TaskCategory =
  | "automation"
  | "analysis"
  | "research"
  | "data"
  | "coding"
  | "business"
  | "finance"
  | "marketing"
  | "design"
  | "content"
  | "writing"
  | "news"
  | "personal"
  | "workflow"
  | "system"
  | "security"
  | "integration"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              EXECUTION MODE                                */
/* -------------------------------------------------------------------------- */

export type TaskExecutionMode =
  | "immediate"
  | "scheduled"
  | "recurring"
  | "manual"
  | "event-driven"
  | "workflow";

/* -------------------------------------------------------------------------- */
/*                              RETRY POLICY                                  */
/* -------------------------------------------------------------------------- */

export interface RetryPolicy {
  enabled: boolean;

  maxAttempts: number;

  initialDelayMs: number;

  maxDelayMs: number;

  backoffMultiplier: number;

  retryOnStatuses?: number[];

  retryOnErrors?: string[];
}

/* -------------------------------------------------------------------------- */
/*                              TIMEOUT POLICY                                */
/* -------------------------------------------------------------------------- */

export interface TimeoutPolicy {
  enabled: boolean;

  timeoutMs: number;

  cancelOnTimeout: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              TASK SCHEDULE                                 */
/* -------------------------------------------------------------------------- */

export interface TaskSchedule {
  executionMode: TaskExecutionMode;

  scheduledAt?: Date | string;

  cron?: string;

  timezone?: string;

  intervalMs?: number;

  startAt?: Date | string;

  endAt?: Date | string;

  runImmediately?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              TASK DEPENDENCY                               */
/* -------------------------------------------------------------------------- */

export interface TaskDependency {
  taskId: TaskId;

  requiredStatus?: TaskStatus[];

  optional?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               TASK CONTEXT                                 */
/* -------------------------------------------------------------------------- */

export interface TaskContext {
  userId?: UserId;

  organizationId?: OrganizationId;

  workflowId?: WorkflowId;

  agentId?: AgentId;

  parentTaskId?: TaskId;

  correlationId?: string;

  sessionId?: string;

  requestId?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK INPUT                                   */
/* -------------------------------------------------------------------------- */

export interface TaskInput<T = unknown> {
  data: T;

  context?: TaskContext;

  variables?: Record<string, unknown>;

  attachments?: Array<{
    id: string;
    name: string;
    type?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK OUTPUT                                  */
/* -------------------------------------------------------------------------- */

export interface TaskOutput<T = unknown> {
  success: boolean;

  data?: T;

  error?: TaskError;

  metadata?: Record<string, unknown>;

  generatedAt: Date | string;
}

/* -------------------------------------------------------------------------- */
/*                                TASK ERROR                                  */
/* -------------------------------------------------------------------------- */

export interface TaskError {
  message: string;

  code?: string;

  stack?: string;

  name?: string;

  retryable?: boolean;

  details?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              TASK PROGRESS                                 */
/* -------------------------------------------------------------------------- */

export interface TaskProgress {
  percentage: number;

  currentStep?: string;

  completedSteps?: number;

  totalSteps?: number;

  message?: string;

  updatedAt: Date | string;
}

/* -------------------------------------------------------------------------- */
/*                              TASK METRICS                                  */
/* -------------------------------------------------------------------------- */

export interface TaskMetrics {
  executionTimeMs?: number;

  queueTimeMs?: number;

  totalTimeMs?: number;

  retryCount: number;

  attemptCount: number;

  tokensUsed?: number;

  estimatedCost?: number;

  memoryUsedMb?: number;

  cpuTimeMs?: number;
}

/* -------------------------------------------------------------------------- */
/*                              TASK EXECUTION                                */
/* -------------------------------------------------------------------------- */

export interface TaskExecution {
  executionId: string;

  taskId: TaskId;

  status: TaskStatus;

  startedAt?: Date | string;

  completedAt?: Date | string;

  durationMs?: number;

  workerId?: string;

  agentId?: AgentId;

  attempt: number;

  error?: TaskError;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK EVENT                                   */
/* -------------------------------------------------------------------------- */

export type TaskEventType =
  | "created"
  | "queued"
  | "scheduled"
  | "started"
  | "progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused"
  | "resumed"
  | "retrying"
  | "expired"
  | "blocked";

export interface TaskEvent {
  id: string;

  taskId: TaskId;

  type: TaskEventType;

  timestamp: Date | string;

  message?: string;

  data?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              TASK DEFINITION                               */
/* -------------------------------------------------------------------------- */

export interface TaskDefinition<TInput = unknown, TOutput = unknown> {
  id: TaskId;

  name: TaskName;

  description?: string;

  category: TaskCategory;

  priority: TaskPriority;

  status: TaskStatus;

  input: TaskInput<TInput>;

  output?: TaskOutput<TOutput>;

  context?: TaskContext;

  schedule?: TaskSchedule;

  dependencies?: TaskDependency[];

  retryPolicy?: RetryPolicy;

  timeoutPolicy?: TimeoutPolicy;

  progress?: TaskProgress;

  metrics?: TaskMetrics;

  tags?: string[];

  createdAt: Date | string;

  updatedAt: Date | string;

  startedAt?: Date | string;

  completedAt?: Date | string;

  expiresAt?: Date | string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK OPTIONS                                 */
/* -------------------------------------------------------------------------- */

export interface CreateTaskOptions<TInput = unknown> {
  id?: TaskId;

  name: TaskName;

  description?: string;

  category?: TaskCategory;

  priority?: TaskPriority;

  input: TInput;

  context?: TaskContext;

  schedule?: TaskSchedule;

  dependencies?: TaskDependency[];

  retryPolicy?: Partial<RetryPolicy>;

  timeoutPolicy?: Partial<TimeoutPolicy>;

  tags?: string[];

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               TASK UPDATE                                  */
/* -------------------------------------------------------------------------- */

export interface UpdateTaskOptions<TOutput = unknown> {
  name?: TaskName;

  description?: string;

  priority?: TaskPriority;

  status?: TaskStatus;

  output?: TaskOutput<TOutput>;

  schedule?: TaskSchedule;

  progress?: TaskProgress;

  metadata?: Record<string, unknown>;

  updatedAt?: Date | string;
}

/* -------------------------------------------------------------------------- */
/*                              TASK RESULT                                   */
/* -------------------------------------------------------------------------- */

export interface TaskResult<T = unknown> {
  success: boolean;

  taskId: TaskId;

  status: TaskStatus;

  data?: T;

  error?: TaskError;

  execution?: TaskExecution;

  metrics?: TaskMetrics;

  completedAt: Date | string;
}

/* -------------------------------------------------------------------------- */
/*                            TASK HANDLER                                    */
/* -------------------------------------------------------------------------- */

export type TaskHandler<TInput = unknown, TOutput = unknown> = (
  task: TaskDefinition<TInput, TOutput>,
) => Promise<TaskResult<TOutput>>;

/* -------------------------------------------------------------------------- */
/*                            TASK QUEUE ITEM                                 */
/* -------------------------------------------------------------------------- */

export interface TaskQueueItem {
  taskId: TaskId;

  priority: TaskPriority;

  queuedAt: Date | string;

  scheduledAt?: Date | string;

  attempts: number;

  maxAttempts: number;
}

/* -------------------------------------------------------------------------- */
/*                           SCHEDULER OPTIONS                                */
/* -------------------------------------------------------------------------- */

export interface SchedulerOptions {
  enabled?: boolean;

  maxConcurrentTasks?: number;

  pollingIntervalMs?: number;

  defaultTimeoutMs?: number;

  defaultRetryPolicy?: RetryPolicy;

  persistTasks?: boolean;

  cleanupCompletedTasks?: boolean;

  completedTaskRetentionMs?: number;
}

/* -------------------------------------------------------------------------- */
/*                           SCHEDULER STATS                                  */
/* -------------------------------------------------------------------------- */

export interface SchedulerStats {
  totalTasks: number;

  pendingTasks: number;

  queuedTasks: number;

  runningTasks: number;

  completedTasks: number;

  failedTasks: number;

  cancelledTasks: number;

  retryingTasks: number;

  blockedTasks: number;

  activeWorkers?: number;

  lastUpdated: Date | string;
}

/* -------------------------------------------------------------------------- */
/*                         TASK FILTER OPTIONS                                */
/* -------------------------------------------------------------------------- */

export interface TaskFilter {
  ids?: TaskId[];

  statuses?: TaskStatus[];

  categories?: TaskCategory[];

  priorities?: TaskPriority[];

  agentIds?: AgentId[];

  workflowIds?: WorkflowId[];

  userIds?: UserId[];

  organizationIds?: OrganizationId[];

  tags?: string[];

  createdAfter?: Date | string;

  createdBefore?: Date | string;

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                              PAGINATION                                    */
/* -------------------------------------------------------------------------- */

export interface TaskListResult<T = TaskDefinition> {
  tasks: T[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                            DEFAULT VALUES                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  enabled: true,
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  enabled: true,
  timeoutMs: 300000,
  cancelOnTimeout: true,
};

export const DEFAULT_SCHEDULER_OPTIONS: Required<
  Pick<
    SchedulerOptions,
    | "enabled"
    | "maxConcurrentTasks"
    | "pollingIntervalMs"
    | "defaultTimeoutMs"
    | "persistTasks"
    | "cleanupCompletedTasks"
    | "completedTaskRetentionMs"
  >
> & {
  defaultRetryPolicy: RetryPolicy;
} = {
  enabled: true,
  maxConcurrentTasks: 10,
  pollingIntervalMs: 1000,
  defaultTimeoutMs: 300000,
  defaultRetryPolicy: DEFAULT_RETRY_POLICY,
  persistTasks: true,
  cleanupCompletedTasks: true,
  completedTaskRetentionMs: 86400000,
};

/* -------------------------------------------------------------------------- */
/*                           TYPE GUARD HELPERS                               */
/* -------------------------------------------------------------------------- */

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

export function isActiveTaskStatus(status: TaskStatus): boolean {
  return (
    status === "queued" ||
    status === "scheduled" ||
    status === "running" ||
    status === "retrying"
  );
}

export function isSuccessfulTaskStatus(status: TaskStatus): boolean {
  return status === "completed";
}

export function canRetryTask(
  task: Pick<TaskDefinition, "status" | "retryPolicy" | "metrics">,
): boolean {
  if (!task.retryPolicy?.enabled) {
    return false;
  }

  if (task.status !== "failed") {
    return false;
  }

  const attemptCount = task.metrics?.attemptCount ?? 0;

  return attemptCount < task.retryPolicy.maxAttempts;
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

const taskTypes = {
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUT_POLICY,
  DEFAULT_SCHEDULER_OPTIONS,
  isTerminalTaskStatus,
  isActiveTaskStatus,
  isSuccessfulTaskStatus,
  canRetryTask,
};

export default taskTypes;