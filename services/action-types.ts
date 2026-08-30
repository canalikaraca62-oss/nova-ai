/**
 * SYRAVEN Action Types
 *
 * Central type contracts for the action system.
 *
 * Used by:
 * - services/action-parser.ts
 * - services/action-executors.ts
 * - AI agents
 * - integrations
 * - workflows
 */

export type ActionPrimitive =
  | string
  | number
  | boolean
  | null;

export type ActionValue =
  | ActionPrimitive
  | ActionObject
  | ActionValue[];

export interface ActionObject {
  [key: string]: ActionValue;
}

/* -------------------------------------------------------------------------- */
/*                               ACTION TYPES                                 */
/* -------------------------------------------------------------------------- */

export type ActionType =
  | string;

export type ActionCategory =
  | "integration"
  | "automation"
  | "communication"
  | "document"
  | "data"
  | "workflow"
  | "ai"
  | "system"
  | "custom";

export type ActionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export type ActionPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

/* -------------------------------------------------------------------------- */
/*                              ACTION CONTEXT                                */
/* -------------------------------------------------------------------------- */

export interface ActionContext {
  userId?: string;

  organizationId?: string;

  projectId?: string;

  conversationId?: string;

  agentId?: string;

  requestId?: string;

  workflowId?: string;

  executionId?: string;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

/* -------------------------------------------------------------------------- */
/*                              ACTION DEFINITION                             */
/* -------------------------------------------------------------------------- */

export interface ActionDefinition<
  TInput = unknown,
  TOutput = unknown
> {
  type: ActionType;

  name: string;

  description?: string;

  category?: ActionCategory;

  version?: string;

  input?: TInput;

  output?: TOutput;

  priority?: ActionPriority;

  timeoutMs?: number;

  requiresConfirmation?: boolean;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               ACTION REQUEST                               */
/* -------------------------------------------------------------------------- */

export interface ActionRequest<
  TInput = unknown
> {
  id?: string;

  type: ActionType;

  input: TInput;

  context?: ActionContext;

  priority?: ActionPriority;

  timeoutMs?: number;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              ACTION RESPONSE                               */
/* -------------------------------------------------------------------------- */

export interface ActionError {
  message: string;

  code?: string;

  details?: unknown;

  stack?: string;

  retryable?: boolean;
}

export interface ActionSuccess<TOutput = unknown> {
  success: true;

  status: "completed";

  data: TOutput;

  error?: never;
}

export interface ActionFailure {
  success: false;

  status:
    | "failed"
    | "cancelled"
    | "timeout";

  data?: never;

  error: ActionError;
}

export type ActionResult<TOutput = unknown> =
  | ActionSuccess<TOutput>
  | ActionFailure;

/* -------------------------------------------------------------------------- */
/*                              ACTION EXECUTION                              */
/* -------------------------------------------------------------------------- */

export interface ActionExecution<
  TInput = unknown,
  TOutput = unknown
> {
  id: string;

  action: ActionRequest<TInput>;

  status: ActionStatus;

  result?: ActionResult<TOutput>;

  startedAt?: string;

  completedAt?: string;

  durationMs?: number;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              ACTION EXECUTOR                               */
/* -------------------------------------------------------------------------- */

export interface ActionExecutor<
  TInput = unknown,
  TOutput = unknown
> {
  readonly type: ActionType;

  readonly name?: string;

  readonly description?: string;

  execute(
    input: TInput,
    context: ActionContext
  ): Promise<TOutput> | TOutput;
}

/* -------------------------------------------------------------------------- */
/*                            ACTION REGISTRY ENTRY                           */
/* -------------------------------------------------------------------------- */

export interface ActionRegistryEntry<
  TInput = unknown,
  TOutput = unknown
> {
  definition: ActionDefinition<
    TInput,
    TOutput
  >;

  executor: ActionExecutor<
    TInput,
    TOutput
  >;

  registeredAt: string;

  enabled: boolean;
}

/* -------------------------------------------------------------------------- */
/*                             ACTION PARSER TYPES                            */
/* -------------------------------------------------------------------------- */

export interface ParsedAction<
  TInput = unknown
> {
  type: ActionType;

  input: TInput;

  id?: string;

  metadata?: Record<string, unknown>;
}

export interface ActionParseError {
  message: string;

  code:
    | "INVALID_INPUT"
    | "INVALID_JSON"
    | "INVALID_ACTION"
    | "MISSING_ACTION_TYPE"
    | "INVALID_ACTION_TYPE"
    | "INVALID_PAYLOAD"
    | "EMPTY_ACTION_LIST"
    | "TOO_MANY_ACTIONS";

  path?: string;
}

export interface ActionParseSuccess<
  TInput = unknown
> {
  success: true;

  status: "success";

  action: ParsedAction<TInput>;
}

export interface ActionParseFailure {
  success: false;

  status: "error";

  error: ActionParseError;
}

export type ActionParseResult<
  TInput = unknown
> =
  | ActionParseSuccess<TInput>
  | ActionParseFailure;

export interface ActionBatchParseSuccess<
  TInput = unknown
> {
  success: true;

  status: "success";

  actions: ParsedAction<TInput>[];
}

export interface ActionBatchParseFailure {
  success: false;

  status: "error";

  error: ActionParseError;
}

export type ActionBatchParseResult<
  TInput = unknown
> =
  | ActionBatchParseSuccess<TInput>
  | ActionBatchParseFailure;

/* -------------------------------------------------------------------------- */
/*                              ACTION OPTIONS                                */
/* -------------------------------------------------------------------------- */

export interface ActionExecutionOptions {
  timeoutMs?: number;

  signal?: AbortSignal;

  priority?: ActionPriority;

  metadata?: Record<string, unknown>;
}

export interface ActionParserOptions {
  allowJsonString?: boolean;

  allowEmptyInput?: boolean;

  normalizeType?: boolean;

  acceptedTypePattern?: RegExp;

  maxActions?: number;
}

/* -------------------------------------------------------------------------- */
/*                              TYPE GUARDS                                   */
/* -------------------------------------------------------------------------- */

export function isActionSuccess<TOutput = unknown>(
  result: ActionResult<TOutput>
): result is ActionSuccess<TOutput> {
  return result.success === true;
}

export function isActionFailure(
  result: ActionResult<unknown>
): result is ActionFailure {
  return result.success === false;
}

export function isActionParseSuccess<
  TInput = unknown
>(
  result: ActionParseResult<TInput>
): result is ActionParseSuccess<TInput> {
  return result.success === true;
}

export function isActionParseFailure(
  result: ActionParseResult<unknown>
): result is ActionParseFailure {
  return result.success === false;
}

export function isActionCancelled(
  result: ActionResult<unknown>
): boolean {
  return result.status === "cancelled";
}

export function isActionTimedOut(
  result: ActionResult<unknown>
): boolean {
  return result.status === "timeout";
}

/* -------------------------------------------------------------------------- */
/*                             DEFAULT CONSTANTS                              */
/* -------------------------------------------------------------------------- */

export const DEFAULT_ACTION_TIMEOUT_MS =
  30_000;

export const MAX_ACTION_TIMEOUT_MS =
  300_000;

export const DEFAULT_ACTION_PRIORITY:
  ActionPriority =
  "normal";