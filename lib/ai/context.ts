import type { AgentDefinition } from "../agents/types";

/**
 * AI conversation message roles.
 */
export type AIMessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

/**
 * Single message inside the AI context.
 */
export interface AIMessage {
  id: string;

  role: AIMessageRole;

  content: string;

  createdAt: Date;

  agentId?: string;

  metadata?: Record<string, unknown>;
}

/**
 * Information about the current user request.
 */
export interface AIRequest {
  id: string;

  message: string;

  createdAt: Date;

  metadata?: Record<string, unknown>;
}

/**
 * Execution state for an agent.
 */
export type AgentExecutionStatus =
  | "idle"
  | "planning"
  | "running"
  | "waiting"
  | "completed"
  | "failed";

/**
 * Information about an agent participating in the current task.
 */
export interface ActiveAgentContext {
  agentId: string;

  agent: AgentDefinition;

  status: AgentExecutionStatus;

  startedAt?: Date;

  completedAt?: Date;

  metadata?: Record<string, unknown>;
}

/**
 * Shared data generated during AI execution.
 */
export interface AIContextData {
  [key: string]: unknown;
}

/**
 * Execution configuration.
 */
export interface AIExecutionConfig {
  maxSteps?: number;

  timeout?: number;

  allowParallelAgents?: boolean;

  enableTools?: boolean;

  enableMemory?: boolean;

  metadata?: Record<string, unknown>;
}

/**
 * Main AI context used across the application.
 *
 * This object represents the complete state of a single AI task.
 */
export interface AIContext {
  /**
   * Unique context identifier.
   */
  id: string;

  /**
   * Original user request.
   */
  request: AIRequest;

  /**
   * Conversation history.
   */
  messages: AIMessage[];

  /**
   * Currently selected primary agent.
   */
  activeAgent?: ActiveAgentContext;

  /**
   * All agents participating in the task.
   */
  agents: ActiveAgentContext[];

  /**
   * Shared execution data.
   */
  data: AIContextData;

  /**
   * Execution configuration.
   */
  config: AIExecutionConfig;

  /**
   * Context creation time.
   */
  createdAt: Date;

  /**
   * Last update time.
   */
  updatedAt: Date;
}

/**
 * Input for creating a new AI context.
 */
export interface CreateAIContextInput {
  message: string;

  requestId?: string;

  messages?: AIMessage[];

  data?: AIContextData;

  config?: AIExecutionConfig;

  metadata?: Record<string, unknown>;
}

/**
 * Generates a unique identifier.
 *
 * Uses crypto.randomUUID when available.
 */
function generateId(prefix: string): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Creates a new AI context.
 */
export function createAIContext(
  input: CreateAIContextInput
): AIContext {
  const now = new Date();

  const request: AIRequest = {
    id: input.requestId ?? generateId("request"),

    message: input.message,

    createdAt: now,

    metadata: input.metadata,
  };

  const userMessage: AIMessage = {
    id: generateId("message"),

    role: "user",

    content: input.message,

    createdAt: now,
  };

  const messages =
    input.messages && input.messages.length > 0
      ? [...input.messages]
      : [userMessage];

  return {
    id: generateId("context"),

    request,

    messages,

    agents: [],

    data: {
      ...(input.data ?? {}),
    },

    config: {
      maxSteps: 20,

      timeout: 120000,

      allowParallelAgents: true,

      enableTools: true,

      enableMemory: true,

      ...(input.config ?? {}),
    },

    createdAt: now,

    updatedAt: now,
  };
}

/**
 * Adds a message to the AI context.
 */
export function addMessage(
  context: AIContext,
  message: Omit<AIMessage, "id" | "createdAt">
): AIContext {
  const now = new Date();

  const newMessage: AIMessage = {
    id: generateId("message"),

    createdAt: now,

    ...message,
  };

  return {
    ...context,

    messages: [...context.messages, newMessage],

    updatedAt: now,
  };
}

/**
 * Adds an agent to the current AI context.
 */
export function addAgentToContext(
  context: AIContext,
  agent: AgentDefinition
): AIContext {
  const now = new Date();

  const exists = context.agents.some(
    (item) => item.agentId === agent.id
  );

  if (exists) {
    return context;
  }

  const agentContext: ActiveAgentContext = {
    agentId: agent.id,

    agent,

    status: "idle",

    metadata: {},
  };

  return {
    ...context,

    agents: [...context.agents, agentContext],

    updatedAt: now,
  };
}

/**
 * Sets the primary active agent.
 */
export function setActiveAgent(
  context: AIContext,
  agentId: string
): AIContext {
  const now = new Date();

  const agentContext = context.agents.find(
    (item) => item.agentId === agentId
  );

  if (!agentContext) {
    return context;
  }

  return {
    ...context,

    activeAgent: agentContext,

    updatedAt: now,
  };
}

/**
 * Updates the execution status of an agent.
 */
export function updateAgentStatus(
  context: AIContext,
  agentId: string,
  status: AgentExecutionStatus
): AIContext {
  const now = new Date();

  const agents = context.agents.map((item) => {
    if (item.agentId !== agentId) {
      return item;
    }

    return {
      ...item,

      status,

      startedAt:
        status === "planning" || status === "running"
          ? item.startedAt ?? now
          : item.startedAt,

      completedAt:
        status === "completed" || status === "failed"
          ? now
          : item.completedAt,
    };
  });

  const activeAgent =
    context.activeAgent?.agentId === agentId
      ? agents.find((item) => item.agentId === agentId)
      : context.activeAgent;

  return {
    ...context,

    agents,

    activeAgent,

    updatedAt: now,
  };
}

/**
 * Updates shared context data.
 */
export function updateContextData(
  context: AIContext,
  data: AIContextData
): AIContext {
  return {
    ...context,

    data: {
      ...context.data,

      ...data,
    },

    updatedAt: new Date(),
  };
}

/**
 * Gets an agent from the context.
 */
export function getContextAgent(
  context: AIContext,
  agentId: string
): ActiveAgentContext | undefined {
  return context.agents.find(
    (agent) => agent.agentId === agentId
  );
}

/**
 * Gets the latest message.
 */
export function getLatestMessage(
  context: AIContext
): AIMessage | undefined {
  return context.messages[context.messages.length - 1];
}

/**
 * Gets all messages for a specific role.
 */
export function getMessagesByRole(
  context: AIContext,
  role: AIMessageRole
): AIMessage[] {
  return context.messages.filter(
    (message) => message.role === role
  );
}

/**
 * Returns a plain conversation history suitable for model input.
 */
export function getConversationHistory(
  context: AIContext
): Array<{
  role: AIMessageRole;
  content: string;
}> {
  return context.messages.map((message) => ({
    role: message.role,

    content: message.content,
  }));
}

/**
 * Checks whether an agent is currently active.
 */
export function isAgentActive(
  context: AIContext,
  agentId: string
): boolean {
  const agent = getContextAgent(context, agentId);

  if (!agent) {
    return false;
  }

  return (
    agent.status === "planning" ||
    agent.status === "running" ||
    agent.status === "waiting"
  );
}

/**
 * Checks whether the context contains an agent.
 */
export function hasAgent(
  context: AIContext,
  agentId: string
): boolean {
  return context.agents.some(
    (agent) => agent.agentId === agentId
  );
}

/**
 * Returns all completed agents.
 */
export function getCompletedAgents(
  context: AIContext
): ActiveAgentContext[] {
  return context.agents.filter(
    (agent) => agent.status === "completed"
  );
}

/**
 * Returns all failed agents.
 */
export function getFailedAgents(
  context: AIContext
): ActiveAgentContext[] {
  return context.agents.filter(
    (agent) => agent.status === "failed"
  );
}

/**
 * Determines whether all participating agents
 * have completed or failed.
 */
export function isContextFinished(
  context: AIContext
): boolean {
  if (context.agents.length === 0) {
    return false;
  }

  return context.agents.every(
    (agent) =>
      agent.status === "completed" ||
      agent.status === "failed"
  );
}

/**
 * Creates a serializable representation
 * of the AI context.
 */
export function serializeAIContext(context: AIContext) {
  return {
    ...context,

    createdAt: context.createdAt.toISOString(),

    updatedAt: context.updatedAt.toISOString(),

    request: {
      ...context.request,

      createdAt: context.request.createdAt.toISOString(),
    },

    messages: context.messages.map((message) => ({
      ...message,

      createdAt: message.createdAt.toISOString(),
    })),

    agents: context.agents.map((agent) => ({
      ...agent,

      startedAt: agent.startedAt?.toISOString(),

      completedAt: agent.completedAt?.toISOString(),
    })),

    activeAgent: context.activeAgent
      ? {
          ...context.activeAgent,

          startedAt:
            context.activeAgent.startedAt?.toISOString(),

          completedAt:
            context.activeAgent.completedAt?.toISOString(),
        }
      : undefined,
  };
}

/**
 * Default export is intentionally omitted.
 *
 * Context utilities should be imported explicitly.
 */