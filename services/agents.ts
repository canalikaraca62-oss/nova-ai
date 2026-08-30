/**
 * SYRAVEN Agent Service
 *
 * Enterprise AI agent registry and execution layer.
 *
 * Features:
 * - Type-safe generic agents
 * - Agent registry
 * - Capability management
 * - Enable / disable controls
 * - Execution context
 * - Execution metrics
 * - Error handling
 * - Agent discovery
 * - Safe type erasure inside registry
 */

export type AgentId = string;

export type AgentCategory =
  | "research"
  | "coding"
  | "writing"
  | "business"
  | "finance"
  | "marketing"
  | "news"
  | "personal"
  | "study"
  | "website"
  | "automation"
  | "custom";

export type AgentStatus =
  | "active"
  | "inactive"
  | "disabled"
  | "error";

export interface AgentCapability {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionContext {
  requestId?: string;

  userId?: string;

  sessionId?: string;

  conversationId?: string;

  agentId?: AgentId;

  timestamp?: Date;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

export interface AgentExecutionMetrics {
  startedAt: Date;

  completedAt?: Date;

  durationMs?: number;

  success: boolean;

  error?: string;
}

export interface AgentExecutionResult<TOutput = unknown> {
  success: boolean;

  output?: TOutput;

  error?: AgentExecutionError;

  metrics: AgentExecutionMetrics;
}

export interface AgentExecutionError {
  name: string;

  message: string;

  code?: string;

  stack?: string;
}

/**
 * Generic Agent Definition
 *
 * Important:
 * TInput and TOutput remain preserved here.
 * This prevents the TypeScript execute incompatibility
 * caused by forcing generic functions into unknown input.
 */
export interface AgentDefinition<
  TInput = unknown,
  TOutput = unknown
> {
  id: AgentId;

  name: string;

  description: string;

  category: AgentCategory;

  enabled: boolean;

  capabilities: AgentCapability[];

  metadata?: Record<string, unknown>;

  execute: (
    input: TInput,
    context: AgentExecutionContext
  ) => TOutput | Promise<TOutput>;
}

/**
 * Configuration used when creating an agent.
 */
export interface CreateAgentOptions<
  TInput = unknown,
  TOutput = unknown
> {
  id: AgentId;

  name: string;

  description: string;

  category?: AgentCategory;

  enabled?: boolean;

  capabilities?: AgentCapability[];

  metadata?: Record<string, unknown>;

  execute: (
    input: TInput,
    context: AgentExecutionContext
  ) => TOutput | Promise<TOutput>;
}

/**
 * Internal type used by registry.
 *
 * The registry must store agents with different input/output types.
 * We intentionally erase generic types ONLY at storage boundaries.
 *
 * Public APIs restore generic types.
 */
type AnyAgentDefinition = AgentDefinition<any, any>;

class AgentRegistry {
  private readonly agents = new Map<
    AgentId,
    AnyAgentDefinition
  >();

  /**
   * Register an agent.
   */
  register<
    TInput = unknown,
    TOutput = unknown
  >(
    agent: AgentDefinition<TInput, TOutput>
  ): AgentDefinition<TInput, TOutput> {
    if (!agent.id?.trim()) {
      throw new Error(
        "Agent id is required."
      );
    }

    if (!agent.name?.trim()) {
      throw new Error(
        `Agent "${agent.id}" must have a name.`
      );
    }

    if (!agent.description?.trim()) {
      throw new Error(
        `Agent "${agent.id}" must have a description.`
      );
    }

    if (typeof agent.execute !== "function") {
      throw new Error(
        `Agent "${agent.id}" must provide an execute function.`
      );
    }

    if (this.agents.has(agent.id)) {
      throw new Error(
        `Agent "${agent.id}" is already registered.`
      );
    }

    /**
     * Type erasure is intentionally isolated here.
     *
     * Generic typing is preserved at public API boundaries.
     */
    this.agents.set(
      agent.id,
      agent as AnyAgentDefinition
    );

    return agent;
  }

  /**
   * Register or replace an existing agent.
   */
  upsert<
    TInput = unknown,
    TOutput = unknown
  >(
    agent: AgentDefinition<TInput, TOutput>
  ): AgentDefinition<TInput, TOutput> {
    if (!agent.id?.trim()) {
      throw new Error(
        "Agent id is required."
      );
    }

    if (typeof agent.execute !== "function") {
      throw new Error(
        `Agent "${agent.id}" must provide an execute function.`
      );
    }

    this.agents.set(
      agent.id,
      agent as AnyAgentDefinition
    );

    return agent;
  }

  /**
   * Get an agent.
   */
  get<
    TInput = unknown,
    TOutput = unknown
  >(
    agentId: AgentId
  ): AgentDefinition<TInput, TOutput> | undefined {
    const agent = this.agents.get(agentId);

    if (!agent) {
      return undefined;
    }

    return agent as AgentDefinition<
      TInput,
      TOutput
    >;
  }

  /**
   * Get an agent or throw.
   */
  require<
    TInput = unknown,
    TOutput = unknown
  >(
    agentId: AgentId
  ): AgentDefinition<TInput, TOutput> {
    const agent = this.get<
      TInput,
      TOutput
    >(agentId);

    if (!agent) {
      throw new Error(
        `Agent not found: ${agentId}`
      );
    }

    return agent;
  }

  /**
   * Check whether an agent exists.
   */
  has(
    agentId: AgentId
  ): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Remove an agent.
   */
  unregister(
    agentId: AgentId
  ): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get all agents.
   */
  list(): AgentDefinition[] {
    return Array.from(
      this.agents.values()
    );
  }

  /**
   * Get active agents only.
   */
  listActive(): AgentDefinition[] {
    return this.list().filter(
      (agent) =>
        agent.enabled === true
    );
  }

  /**
   * Find agents by category.
   */
  findByCategory(
    category: AgentCategory
  ): AgentDefinition[] {
    return this.list().filter(
      (agent) =>
        agent.category === category
    );
  }

  /**
   * Find agents with a capability.
   */
  findByCapability(
    capabilityId: string
  ): AgentDefinition[] {
    return this.list().filter(
      (agent) =>
        agent.capabilities.some(
          (capability) =>
            capability.id === capabilityId &&
            capability.enabled
        )
    );
  }

  /**
   * Enable an agent.
   */
  enable(
    agentId: AgentId
  ): AgentDefinition {
    const agent = this.require(agentId);

    agent.enabled = true;

    return agent;
  }

  /**
   * Disable an agent.
   */
  disable(
    agentId: AgentId
  ): AgentDefinition {
    const agent = this.require(agentId);

    agent.enabled = false;

    return agent;
  }

  /**
   * Clear all registered agents.
   *
   * Mainly useful for tests.
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Number of registered agents.
   */
  get size(): number {
    return this.agents.size;
  }
}

/**
 * Main singleton registry.
 */
export const agentRegistry =
  new AgentRegistry();

/**
 * Create a strongly typed agent.
 */
export function createAgent<
  TInput = unknown,
  TOutput = unknown
>(
  options: CreateAgentOptions<
    TInput,
    TOutput
  >
): AgentDefinition<TInput, TOutput> {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    category:
      options.category ?? "custom",
    enabled:
      options.enabled ?? true,
    capabilities:
      options.capabilities ?? [],
    metadata:
      options.metadata,
    execute:
      options.execute,
  };
}

/**
 * Register an agent.
 */
export function registerAgent<
  TInput = unknown,
  TOutput = unknown
>(
  agent: AgentDefinition<TInput, TOutput>
): AgentDefinition<TInput, TOutput> {
  return agentRegistry.register(
    agent
  );
}

/**
 * Register or replace an agent.
 */
export function upsertAgent<
  TInput = unknown,
  TOutput = unknown
>(
  agent: AgentDefinition<TInput, TOutput>
): AgentDefinition<TInput, TOutput> {
  return agentRegistry.upsert(
    agent
  );
}

/**
 * Get an agent.
 */
export function getAgent<
  TInput = unknown,
  TOutput = unknown
>(
  agentId: AgentId
): AgentDefinition<
  TInput,
  TOutput
> | undefined {
  return agentRegistry.get<
    TInput,
    TOutput
  >(agentId);
}

/**
 * Require an agent.
 */
export function requireAgent<
  TInput = unknown,
  TOutput = unknown
>(
  agentId: AgentId
): AgentDefinition<
  TInput,
  TOutput
> {
  return agentRegistry.require<
    TInput,
    TOutput
  >(agentId);
}

/**
 * Check whether an agent exists.
 */
export function hasAgent(
  agentId: AgentId
): boolean {
  return agentRegistry.has(agentId);
}

/**
 * Remove an agent.
 */
export function unregisterAgent(
  agentId: AgentId
): boolean {
  return agentRegistry.unregister(
    agentId
  );
}

/**
 * Get all agents.
 */
export function getAllAgents(): AgentDefinition[] {
  return agentRegistry.list();
}

/**
 * Get active agents.
 */
export function getActiveAgents(): AgentDefinition[] {
  return agentRegistry.listActive();
}

/**
 * Find agents by category.
 */
export function getAgentsByCategory(
  category: AgentCategory
): AgentDefinition[] {
  return agentRegistry.findByCategory(
    category
  );
}

/**
 * Find agents by capability.
 */
export function getAgentsByCapability(
  capabilityId: string
): AgentDefinition[] {
  return agentRegistry.findByCapability(
    capabilityId
  );
}

/**
 * Enable an agent.
 */
export function enableAgent(
  agentId: AgentId
): AgentDefinition {
  return agentRegistry.enable(agentId);
}

/**
 * Disable an agent.
 */
export function disableAgent(
  agentId: AgentId
): AgentDefinition {
  return agentRegistry.disable(agentId);
}

/**
 * Execute an agent.
 *
 * Generic input/output types are preserved.
 */
export async function executeAgent<
  TInput = unknown,
  TOutput = unknown
>(
  agentId: AgentId,
  input: TInput,
  context: AgentExecutionContext = {}
): Promise<TOutput> {
  const agent = requireAgent<
    TInput,
    TOutput
  >(agentId);

  if (!agent.enabled) {
    throw new Error(
      `Agent "${agentId}" is disabled.`
    );
  }

  const executionContext: AgentExecutionContext = {
    ...context,
    agentId,
    timestamp:
      context.timestamp ?? new Date(),
  };

  return await agent.execute(
    input,
    executionContext
  );
}

/**
 * Execute an agent with structured result.
 *
 * This is useful when callers should not receive
 * uncaught execution errors.
 */
export async function executeAgentSafely<
  TInput = unknown,
  TOutput = unknown
>(
  agentId: AgentId,
  input: TInput,
  context: AgentExecutionContext = {}
): Promise<
  AgentExecutionResult<TOutput>
> {
  const startedAt = new Date();

  try {
    const output =
      await executeAgent<
        TInput,
        TOutput
      >(
        agentId,
        input,
        context
      );

    const completedAt = new Date();

    return {
      success: true,
      output,
      metrics: {
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        success: true,
      },
    };
  } catch (error) {
    const completedAt = new Date();

    const normalizedError =
      normalizeAgentError(error);

    return {
      success: false,
      error: normalizedError,
      metrics: {
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
        success: false,
        error:
          normalizedError.message,
      },
    };
  }
}

/**
 * Normalize unknown errors.
 */
export function normalizeAgentError(
  error: unknown
): AgentExecutionError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      name: "AgentExecutionError",
      message: error,
    };
  }

  if (
    error &&
    typeof error === "object"
  ) {
    const possibleError =
      error as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
      };

    return {
      name:
        typeof possibleError.name ===
        "string"
          ? possibleError.name
          : "AgentExecutionError",

      message:
        typeof possibleError.message ===
        "string"
          ? possibleError.message
          : "Unknown agent execution error",

      code:
        typeof possibleError.code ===
        "string"
          ? possibleError.code
          : undefined,
    };
  }

  return {
    name: "AgentExecutionError",
    message:
      "Unknown agent execution error",
  };
}

/**
 * Get registry statistics.
 */
export interface AgentRegistryStats {
  total: number;

  active: number;

  disabled: number;

  byCategory: Partial<
    Record<AgentCategory, number>
  >;
}

export function getAgentRegistryStats(): AgentRegistryStats {
  const agents =
    agentRegistry.list();

  const byCategory: Partial<
    Record<AgentCategory, number>
  > = {};

  let active = 0;
  let disabled = 0;

  for (const agent of agents) {
    if (agent.enabled) {
      active += 1;
    } else {
      disabled += 1;
    }

    byCategory[agent.category] =
      (byCategory[agent.category] ?? 0) + 1;
  }

  return {
    total: agents.length,
    active,
    disabled,
    byCategory,
  };
}

/**
 * Reset registry.
 *
 * Intended for tests and controlled development environments.
 */
export function clearAgentRegistry(): void {
  agentRegistry.clear();
}

/**
 * Default export.
 */
export default agentRegistry;