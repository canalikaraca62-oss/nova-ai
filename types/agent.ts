/**
 * SYRAVEN Agent Types
 *
 * Enterprise-grade AI agent domain types.
 *
 * Designed for:
 * - AI agents
 * - Agent execution
 * - Tool usage
 * - Capabilities
 * - Configuration
 * - Memory
 * - Execution context
 * - Observability
 * - Multi-agent orchestration
 *
 * Strict TypeScript.
 */

/* -------------------------------------------------------------------------- */
/*                               PRIMITIVE TYPES                              */
/* -------------------------------------------------------------------------- */

export type AgentId = string;

export type AgentExecutionId = string;

export type AgentToolId = string;

export type AgentCapabilityId = string;

export type AgentMemoryId = string;

/* -------------------------------------------------------------------------- */
/*                                AGENT STATUS                                */
/* -------------------------------------------------------------------------- */

export type AgentStatus =
  | "active"
  | "inactive"
  | "draft"
  | "archived"
  | "disabled"
  | "error";

/* -------------------------------------------------------------------------- */
/*                              EXECUTION STATUS                              */
/* -------------------------------------------------------------------------- */

export type AgentExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

/* -------------------------------------------------------------------------- */
/*                               AGENT CATEGORY                               */
/* -------------------------------------------------------------------------- */

export type AgentCategory =
  | "general"
  | "assistant"
  | "research"
  | "coding"
  | "analysis"
  | "automation"
  | "document"
  | "customer_support"
  | "sales"
  | "marketing"
  | "data"
  | "workflow"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                               MEMORY TYPES                                 */
/* -------------------------------------------------------------------------- */

export type AgentMemoryType =
  | "short_term"
  | "long_term"
  | "episodic"
  | "semantic"
  | "working";

/* -------------------------------------------------------------------------- */
/*                               TOOL STATUS                                  */
/* -------------------------------------------------------------------------- */

export type AgentToolStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/* -------------------------------------------------------------------------- */
/*                             EXECUTION PRIORITY                             */
/* -------------------------------------------------------------------------- */

export type AgentExecutionPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

/* -------------------------------------------------------------------------- */
/*                              JSON VALUE TYPES                              */
/* -------------------------------------------------------------------------- */

export type JsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray =
  JsonValue[];

/* -------------------------------------------------------------------------- */
/*                              AGENT CAPABILITY                              */
/* -------------------------------------------------------------------------- */

export interface AgentCapability {
  id: AgentCapabilityId;

  name: string;

  description?: string;

  enabled: boolean;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                                AGENT TOOL                                  */
/* -------------------------------------------------------------------------- */

export interface AgentToolDefinition<
  TInput = unknown,
  TOutput = unknown
> {
  id: AgentToolId;

  name: string;

  description?: string;

  enabled: boolean;

  execute?: (
    input: TInput,
    context: AgentToolExecutionContext
  ) =>
    | TOutput
    | Promise<TOutput>;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                         AGENT TOOL EXECUTION CONTEXT                       */
/* -------------------------------------------------------------------------- */

export interface AgentToolExecutionContext {
  agentId: AgentId;

  executionId: AgentExecutionId;

  userId?: string;

  workspaceId?: string;

  projectId?: string;

  signal?: AbortSignal;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              AGENT TOOL CALL                               */
/* -------------------------------------------------------------------------- */

export interface AgentToolCall<
  TInput = unknown,
  TOutput = unknown
> {
  id: string;

  toolId: AgentToolId;

  toolName: string;

  status: AgentToolStatus;

  input: TInput;

  output?: TOutput;

  error?: AgentExecutionError;

  startedAt?: Date;

  completedAt?: Date;

  durationMs?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                             AGENT EXECUTION ERROR                          */
/* -------------------------------------------------------------------------- */

export interface AgentExecutionError {
  message: string;

  name?: string;

  code?: string;

  stack?: string;

  retryable?: boolean;

  timestamp: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                               AGENT MEMORY                                 */
/* -------------------------------------------------------------------------- */

export interface AgentMemory {
  id: AgentMemoryId;

  agentId: AgentId;

  type: AgentMemoryType;

  key: string;

  value: unknown;

  createdAt: Date;

  updatedAt: Date;

  expiresAt?: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                             AGENT CONFIGURATION                            */
/* -------------------------------------------------------------------------- */

export interface AgentConfig {
  model?: string;

  provider?: string;

  temperature?: number;

  maxTokens?: number;

  maxIterations?: number;

  timeoutMs?: number;

  enableMemory?: boolean;

  enableTools?: boolean;

  systemPrompt?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                                   AGENT                                    */
/* -------------------------------------------------------------------------- */

export interface Agent {
  id: AgentId;

  name: string;

  description?: string;

  category: AgentCategory;

  status: AgentStatus;

  enabled: boolean;

  capabilities: AgentCapability[];

  tools: AgentToolDefinition[];

  config?: AgentConfig;

  createdAt: Date;

  updatedAt: Date;

  createdBy?: string;

  workspaceId?: string;

  projectId?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                           AGENT EXECUTION CONTEXT                          */
/* -------------------------------------------------------------------------- */

export interface AgentExecutionContext {
  executionId?: AgentExecutionId;

  userId?: string;

  workspaceId?: string;

  projectId?: string;

  conversationId?: string;

  signal?: AbortSignal;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                            AGENT EXECUTION INPUT                           */
/* -------------------------------------------------------------------------- */

export interface AgentExecutionInput<
  TInput = unknown
> {
  input: TInput;

  context?: AgentExecutionContext;

  priority?: AgentExecutionPriority;

  timeoutMs?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                           AGENT EXECUTION RESULT                           */
/* -------------------------------------------------------------------------- */

export interface AgentExecutionResult<
  TOutput = unknown
> {
  executionId: AgentExecutionId;

  agentId: AgentId;

  status: AgentExecutionStatus;

  output?: TOutput;

  error?: AgentExecutionError;

  toolCalls: AgentToolCall[];

  startedAt: Date;

  completedAt?: Date;

  durationMs?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                            AGENT EXECUTION RECORD                          */
/* -------------------------------------------------------------------------- */

export interface AgentExecution<
  TInput = unknown,
  TOutput = unknown
> {
  id: AgentExecutionId;

  agentId: AgentId;

  status: AgentExecutionStatus;

  priority: AgentExecutionPriority;

  input: TInput;

  output?: TOutput;

  context?: AgentExecutionContext;

  toolCalls: AgentToolCall[];

  error?: AgentExecutionError;

  attempts: number;

  maxAttempts: number;

  startedAt?: Date;

  completedAt?: Date;

  createdAt: Date;

  updatedAt: Date;

  durationMs?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              AGENT EXECUTOR                                */
/* -------------------------------------------------------------------------- */

/**
 * Important:
 *
 * Input is intentionally `unknown` here.
 *
 * Individual agents can implement more specific generic
 * executor signatures internally, while the registry can
 * safely store heterogeneous agents without generic
 * variance problems.
 */
export type AgentExecutor = (
  input: unknown,
  context: AgentExecutionContext
) =>
  | unknown
  | Promise<unknown>;

/* -------------------------------------------------------------------------- */
/*                              TYPED AGENT EXECUTOR                          */
/* -------------------------------------------------------------------------- */

export type TypedAgentExecutor<
  TInput,
  TOutput
> = (
  input: TInput,
  context: AgentExecutionContext
) =>
  | TOutput
  | Promise<TOutput>;

/* -------------------------------------------------------------------------- */
/*                                AGENT DEFINITION                            */
/* -------------------------------------------------------------------------- */

export interface AgentDefinition {
  id: AgentId;

  name: string;

  description?: string;

  category?: AgentCategory;

  enabled?: boolean;

  capabilities?: AgentCapability[];

  tools?: AgentToolDefinition[];

  config?: AgentConfig;

  execute: AgentExecutor;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                         GENERIC AGENT DEFINITION                           */
/* -------------------------------------------------------------------------- */

export interface TypedAgentDefinition<
  TInput,
  TOutput
> {
  id: AgentId;

  name: string;

  description?: string;

  category?: AgentCategory;

  enabled?: boolean;

  capabilities?: AgentCapability[];

  tools?: AgentToolDefinition[];

  config?: AgentConfig;

  execute: TypedAgentExecutor<
    TInput,
    TOutput
  >;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                             CREATE AGENT INPUT                             */
/* -------------------------------------------------------------------------- */

export interface CreateAgentInput {
  id?: AgentId;

  name: string;

  description?: string;

  category?: AgentCategory;

  enabled?: boolean;

  capabilities?: AgentCapability[];

  tools?: AgentToolDefinition[];

  config?: AgentConfig;

  workspaceId?: string;

  projectId?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                             UPDATE AGENT INPUT                             */
/* -------------------------------------------------------------------------- */

export interface UpdateAgentInput {
  name?: string;

  description?: string;

  category?: AgentCategory;

  status?: AgentStatus;

  enabled?: boolean;

  capabilities?: AgentCapability[];

  tools?: AgentToolDefinition[];

  config?: AgentConfig;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              AGENT LIST OPTIONS                            */
/* -------------------------------------------------------------------------- */

export interface AgentListOptions {
  status?: AgentStatus;

  category?: AgentCategory;

  enabled?: boolean;

  workspaceId?: string;

  projectId?: string;

  search?: string;

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                              AGENT LIST RESULT                             */
/* -------------------------------------------------------------------------- */

export interface AgentListResult {
  agents: Agent[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               AGENT EVENTS                                 */
/* -------------------------------------------------------------------------- */

export type AgentEventType =
  | "agent.created"
  | "agent.updated"
  | "agent.deleted"
  | "agent.enabled"
  | "agent.disabled"
  | "execution.started"
  | "execution.completed"
  | "execution.failed"
  | "execution.cancelled"
  | "tool.started"
  | "tool.completed"
  | "tool.failed";

/* -------------------------------------------------------------------------- */
/*                                AGENT EVENT                                 */
/* -------------------------------------------------------------------------- */

export interface AgentEvent<
  TData = unknown
> {
  id: string;

  type: AgentEventType;

  agentId: AgentId;

  executionId?: AgentExecutionId;

  data?: TData;

  createdAt: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                             AGENT SERVICE STATS                            */
/* -------------------------------------------------------------------------- */

export interface AgentStats {
  totalAgents: number;

  activeAgents: number;

  inactiveAgents: number;

  totalExecutions: number;

  runningExecutions: number;

  completedExecutions: number;

  failedExecutions: number;

  cancelledExecutions: number;
}

/* -------------------------------------------------------------------------- */
/*                              TYPE GUARDS                                   */
/* -------------------------------------------------------------------------- */

export function isAgentStatus(
  value: unknown
): value is AgentStatus {
  return (
    value === "active" ||
    value === "inactive" ||
    value === "draft" ||
    value === "archived" ||
    value === "disabled" ||
    value === "error"
  );
}

export function isAgentExecutionStatus(
  value: unknown
): value is AgentExecutionStatus {
  return (
    value === "pending" ||
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "timeout"
  );
}

export function isAgentCategory(
  value: unknown
): value is AgentCategory {
  return (
    value === "general" ||
    value === "assistant" ||
    value === "research" ||
    value === "coding" ||
    value === "analysis" ||
    value === "automation" ||
    value === "document" ||
    value === "customer_support" ||
    value === "sales" ||
    value === "marketing" ||
    value === "data" ||
    value === "workflow" ||
    value === "custom"
  );
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT VALUES                                */
/* -------------------------------------------------------------------------- */

export const DEFAULT_AGENT_CONFIG:
  Readonly<AgentConfig> = {
    temperature: 0.7,

    maxIterations: 10,

    timeoutMs: 60_000,

    enableMemory: true,

    enableTools: true,
  };

export const DEFAULT_AGENT_EXECUTION_PRIORITY:
  AgentExecutionPriority =
    "normal";

export const DEFAULT_AGENT_MAX_ATTEMPTS =
  1;