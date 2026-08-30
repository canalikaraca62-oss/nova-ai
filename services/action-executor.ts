/**
 * SYRAVEN Action Executors
 *
 * Central execution layer for application actions.
 *
 * Responsibilities:
 * - Register action executors
 * - Execute actions safely
 * - Validate executor availability
 * - Apply timeouts
 * - Capture execution errors
 * - Support async actions
 * - Provide execution metadata
 *
 * This module is intentionally provider-agnostic.
 * Domain-specific executors can be registered dynamically.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ActionExecutorStatus =
  | "success"
  | "error"
  | "timeout"
  | "cancelled";

export interface ActionExecutionContext {
  userId?: string;
  organizationId?: string;
  projectId?: string;
  conversationId?: string;
  agentId?: string;

  requestId?: string;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

export interface ActionExecutionOptions {
  timeoutMs?: number;

  signal?: AbortSignal;

  metadata?: Record<string, unknown>;
}

export interface ActionExecutionResult<T = unknown> {
  success: boolean;

  status: ActionExecutorStatus;

  data?: T;

  error?: {
    message: string;
    code?: string;
    stack?: string;
  };

  startedAt: string;

  completedAt: string;

  durationMs: number;

  actionType: string;

  metadata?: Record<string, unknown>;
}

export interface ActionExecutorDefinition<
  TInput = unknown,
  TOutput = unknown
> {
  type: string;

  description?: string;

  execute(
    input: TInput,
    context: ActionExecutionContext
  ): Promise<TOutput> | TOutput;
}

/* -------------------------------------------------------------------------- */
/*                                   ERROR                                    */
/* -------------------------------------------------------------------------- */

export class ActionExecutorError extends Error {
  public readonly code: string;

  public readonly actionType?: string;

  public readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      actionType?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = "ActionExecutorError";

    this.code =
      options.code ??
      "ACTION_EXECUTION_ERROR";

    this.actionType =
      options.actionType;

    this.cause =
      options.cause;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_TIMEOUT_MS = 30_000;

const MAX_TIMEOUT_MS = 300_000;

/* -------------------------------------------------------------------------- */
/*                                HELPERS                                     */
/* -------------------------------------------------------------------------- */

function ensureActionType(
  actionType: string
): string {
  const normalized =
    typeof actionType === "string"
      ? actionType.trim()
      : "";

  if (!normalized) {
    throw new ActionExecutorError(
      "Action type is required.",
      {
        code: "INVALID_ACTION_TYPE",
      }
    );
  }

  return normalized;
}

function normalizeTimeout(
  timeoutMs?: number
): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(
    Math.floor(timeoutMs),
    MAX_TIMEOUT_MS
  );
}

function createAbortError(): Error {
  const error = new Error(
    "Action execution was cancelled."
  );

  error.name = "AbortError";

  return error;
}

function serializeError(
  error: unknown
): {
  message: string;
  code?: string;
  stack?: string;
} {
  if (
    error instanceof ActionExecutorError
  ) {
    return {
      message: error.message,
      code: error.code,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
      stack: error.stack,
    };
  }

  if (
    typeof error === "string"
  ) {
    return {
      message: error,
      code: "UNKNOWN_ERROR",
    };
  }

  return {
    message:
      "An unknown error occurred during action execution.",
    code: "UNKNOWN_ERROR",
  };
}

/* -------------------------------------------------------------------------- */
/*                              EXECUTOR REGISTRY                             */
/* -------------------------------------------------------------------------- */

export class ActionExecutorRegistry {
  private readonly executors =
    new Map<
      string,
      ActionExecutorDefinition
    >();

  /**
   * Register an executor.
   */
  register<TInput = unknown, TOutput = unknown>(
    executor: ActionExecutorDefinition<
      TInput,
      TOutput
    >
  ): void {
    const type =
      ensureActionType(
        executor.type
      );

    if (
      typeof executor.execute !==
      "function"
    ) {
      throw new ActionExecutorError(
        `Executor "${type}" must provide an execute function.`,
        {
          code:
            "INVALID_EXECUTOR",
          actionType: type,
        }
      );
    }

    if (
      this.executors.has(type)
    ) {
      throw new ActionExecutorError(
        `An executor for "${type}" is already registered.`,
        {
          code:
            "EXECUTOR_ALREADY_EXISTS",
          actionType: type,
        }
      );
    }

    this.executors.set(
      type,
      executor as ActionExecutorDefinition
    );
  }

  /**
   * Replace or register an executor.
   */
  registerOrReplace<
    TInput = unknown,
    TOutput = unknown
  >(
    executor: ActionExecutorDefinition<
      TInput,
      TOutput
    >
  ): void {
    const type =
      ensureActionType(
        executor.type
      );

    if (
      typeof executor.execute !==
      "function"
    ) {
      throw new ActionExecutorError(
        `Executor "${type}" must provide an execute function.`,
        {
          code:
            "INVALID_EXECUTOR",
          actionType: type,
        }
      );
    }

    this.executors.set(
      type,
      executor as ActionExecutorDefinition
    );
  }

  /**
   * Remove an executor.
   */
  unregister(
    actionType: string
  ): boolean {
    return this.executors.delete(
      ensureActionType(actionType)
    );
  }

  /**
   * Get an executor.
   */
  get(
    actionType: string
  ):
    | ActionExecutorDefinition
    | undefined {
    return this.executors.get(
      ensureActionType(actionType)
    );
  }

  /**
   * Check executor availability.
   */
  has(
    actionType: string
  ): boolean {
    return this.executors.has(
      ensureActionType(actionType)
    );
  }

  /**
   * Get all registered action types.
   */
  list(): string[] {
    return Array.from(
      this.executors.keys()
    );
  }

  /**
   * Clear all executors.
   */
  clear(): void {
    this.executors.clear();
  }
}

/* -------------------------------------------------------------------------- */
/*                              ACTION EXECUTOR                               */
/* -------------------------------------------------------------------------- */

export class ActionExecutorService {
  private readonly registry:
    ActionExecutorRegistry;

  constructor(
    registry: ActionExecutorRegistry =
      new ActionExecutorRegistry()
  ) {
    this.registry = registry;
  }

  /**
   * Register executor.
   */
  register<
    TInput = unknown,
    TOutput = unknown
  >(
    executor: ActionExecutorDefinition<
      TInput,
      TOutput
    >
  ): void {
    this.registry.register(
      executor
    );
  }

  /**
   * Register or replace executor.
   */
  registerOrReplace<
    TInput = unknown,
    TOutput = unknown
  >(
    executor: ActionExecutorDefinition<
      TInput,
      TOutput
    >
  ): void {
    this.registry.registerOrReplace(
      executor
    );
  }

  /**
   * Execute an action.
   */
  async execute<
    TInput = unknown,
    TOutput = unknown
  >(
    actionType: string,
    input: TInput,
    context: ActionExecutionContext = {},
    options: ActionExecutionOptions = {}
  ): Promise<
    ActionExecutionResult<TOutput>
  > {
    const normalizedActionType =
      ensureActionType(
        actionType
      );

    const startedAtDate =
      new Date();

    const startedAt =
      startedAtDate.toISOString();

    const executor =
      this.registry.get(
        normalizedActionType
      );

    if (!executor) {
      const completedAtDate =
        new Date();

      return {
        success: false,
        status: "error",
        error: {
          message:
            `No executor registered for action "${normalizedActionType}".`,
          code:
            "EXECUTOR_NOT_FOUND",
        },
        startedAt,
        completedAt:
          completedAtDate.toISOString(),
        durationMs:
          completedAtDate.getTime() -
          startedAtDate.getTime(),
        actionType:
          normalizedActionType,
        metadata:
          options.metadata,
      };
    }

    const timeoutMs =
      normalizeTimeout(
        options.timeoutMs
      );

    const externalSignal =
      options.signal ??
      context.signal;

    if (
      externalSignal?.aborted
    ) {
      const completedAtDate =
        new Date();

      return {
        success: false,
        status: "cancelled",
        error: {
          message:
            "Action execution was cancelled before it started.",
          code:
            "ACTION_CANCELLED",
        },
        startedAt,
        completedAt:
          completedAtDate.toISOString(),
        durationMs:
          completedAtDate.getTime() -
          startedAtDate.getTime(),
        actionType:
          normalizedActionType,
        metadata:
          options.metadata,
      };
    }

    const controller =
      new AbortController();

    const abortHandler = () => {
      controller.abort();
    };

    if (externalSignal) {
      externalSignal.addEventListener(
        "abort",
        abortHandler,
        {
          once: true,
        }
      );
    }

    const timeoutId =
      setTimeout(() => {
        controller.abort();
      }, timeoutMs);

    const executionContext:
      ActionExecutionContext = {
        ...context,
        signal: controller.signal,
        metadata: {
          ...(context.metadata ?? {}),
          ...(options.metadata ?? {}),
        },
      };

    try {
      const executionPromise =
        Promise.resolve(
          executor.execute(
            input,
            executionContext
          )
        ) as Promise<TOutput>;

      const abortPromise =
        new Promise<never>(
          (_, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => {
                reject(
                  createAbortError()
                );
              },
              {
                once: true,
              }
            );
          }
        );

      const data =
        await Promise.race([
          executionPromise,
          abortPromise,
        ]);

      const completedAtDate =
        new Date();

      return {
        success: true,
        status: "success",
        data,
        startedAt,
        completedAt:
          completedAtDate.toISOString(),
        durationMs:
          completedAtDate.getTime() -
          startedAtDate.getTime(),
        actionType:
          normalizedActionType,
        metadata:
          options.metadata,
      };
    } catch (error) {
      const completedAtDate =
        new Date();

      const isTimeout =
        controller.signal.aborted &&
        !externalSignal?.aborted;

      const isCancelled =
        externalSignal?.aborted === true;

      const status:
        ActionExecutorStatus =
        isCancelled
          ? "cancelled"
          : isTimeout
            ? "timeout"
            : "error";

      const errorCode =
        isCancelled
          ? "ACTION_CANCELLED"
          : isTimeout
            ? "ACTION_TIMEOUT"
            : undefined;

      const serialized =
        serializeError(error);

      return {
        success: false,
        status,
        error: {
          ...serialized,
          code:
            errorCode ??
            serialized.code,
          message:
            isTimeout
              ? `Action "${normalizedActionType}" timed out after ${timeoutMs}ms.`
              : isCancelled
                ? `Action "${normalizedActionType}" was cancelled.`
                : serialized.message,
        },
        startedAt,
        completedAt:
          completedAtDate.toISOString(),
        durationMs:
          completedAtDate.getTime() -
          startedAtDate.getTime(),
        actionType:
          normalizedActionType,
        metadata:
          options.metadata,
      };
    } finally {
      clearTimeout(timeoutId);

      if (externalSignal) {
        externalSignal.removeEventListener(
          "abort",
          abortHandler
        );
      }
    }
  }

  /**
   * Execute multiple actions sequentially.
   */
  async executeMany(
    actions: Array<{
      actionType: string;
      input: unknown;
      context?: ActionExecutionContext;
      options?: ActionExecutionOptions;
    }>
  ): Promise<
    Array<ActionExecutionResult>
  > {
    const results:
      Array<ActionExecutionResult> = [];

    for (
      const action of actions
    ) {
      const result =
        await this.execute(
          action.actionType,
          action.input,
          action.context,
          action.options
        );

      results.push(result);
    }

    return results;
  }

  /**
   * Access the executor registry.
   */
  getRegistry():
    ActionExecutorRegistry {
    return this.registry;
  }

  /**
   * Check if action type exists.
   */
  hasExecutor(
    actionType: string
  ): boolean {
    return this.registry.has(
      actionType
    );
  }

  /**
   * List registered executors.
   */
  listExecutors(): string[] {
    return this.registry.list();
  }
}

/* -------------------------------------------------------------------------- */
/*                            GLOBAL INSTANCES                                */
/* -------------------------------------------------------------------------- */

export const actionExecutorRegistry =
  new ActionExecutorRegistry();

export const actionExecutorService =
  new ActionExecutorService(
    actionExecutorRegistry
  );

/* -------------------------------------------------------------------------- */
/*                            HELPER FUNCTIONS                                */
/* -------------------------------------------------------------------------- */

export function registerActionExecutor<
  TInput = unknown,
  TOutput = unknown
>(
  executor: ActionExecutorDefinition<
    TInput,
    TOutput
  >
): void {
  actionExecutorService.register(
    executor
  );
}

export function executeAction<
  TInput = unknown,
  TOutput = unknown
>(
  actionType: string,
  input: TInput,
  context: ActionExecutionContext = {},
  options: ActionExecutionOptions = {}
): Promise<
  ActionExecutionResult<TOutput>
> {
  return actionExecutorService.execute<
    TInput,
    TOutput
  >(
    actionType,
    input,
    context,
    options
  );
}

export function hasActionExecutor(
  actionType: string
): boolean {
  return actionExecutorService.hasExecutor(
    actionType
  );
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default actionExecutorService;