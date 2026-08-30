/**
 * SYRAVEN AI AGENT SYSTEM
 * Default Agent Configuration
 *
 * Shared defaults and helper utilities for all agents.
 */

import type {
  AgentDefinition,
  AgentMetadata,
  AgentPriority,
  AgentStatus,
  ExpertiseLevel,
} from "./types";

/**
 * Default agent priority.
 */
export const DEFAULT_AGENT_PRIORITY: AgentPriority = "medium";

/**
 * Default agent status.
 */
export const DEFAULT_AGENT_STATUS: AgentStatus = "active";

/**
 * Default expertise level.
 */
export const DEFAULT_EXPERTISE_LEVEL: ExpertiseLevel = "advanced";

/**
 * Default metadata shared by agents.
 */
export const DEFAULT_AGENT_METADATA: AgentMetadata = {
  domain: "general",
  author: "Syraven AI",
  priority: DEFAULT_AGENT_PRIORITY,
  expertiseLevel: DEFAULT_EXPERTISE_LEVEL,
  supportsResearch: true,
  supportsAnalysis: true,
  supportsExecution: false,
  supportsCollaboration: true,
  supportsPlanning: true,
  version: "1.0.0",
  status: DEFAULT_AGENT_STATUS,
};

/**
 * Default capabilities for general-purpose agents.
 */
export const DEFAULT_AGENT_CAPABILITIES = [
  "analysis",
  "research",
  "planning",
  "problem-solving",
  "decision-support",
];

/**
 * Default tools available to agents.
 */
export const DEFAULT_AGENT_TOOLS = [
  "analysis",
  "research",
  "planning",
];

/**
 * Creates a complete metadata object by merging custom metadata
 * with the platform defaults.
 */
export function createAgentMetadata(
  metadata: Partial<AgentMetadata> = {},
): AgentMetadata {
  return {
    ...DEFAULT_AGENT_METADATA,
    ...metadata,
  };
}

/**
 * Creates a normalized agent definition.
 *
 * This helper allows individual agents to override any defaults
 * while ensuring the required AgentDefinition structure exists.
 */
export function createAgentDefinition(
  agent: Partial<AgentDefinition> &
    Pick<AgentDefinition, "id" | "name" | "description" | "category">,
): AgentDefinition {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    category: agent.category,

    version: agent.version ?? "1.0.0",

    icon: agent.icon ?? "Bot",

    color: agent.color ?? "blue",

    enabled: agent.enabled ?? true,

    featured: agent.featured ?? false,

    status: agent.status ?? DEFAULT_AGENT_STATUS,

    capabilities:
      agent.capabilities?.length
        ? agent.capabilities
        : [...DEFAULT_AGENT_CAPABILITIES],

    systemPrompt:
      agent.systemPrompt ??
      "You are a highly capable AI agent designed to provide accurate, reliable and useful assistance.",

    welcomeMessage:
      agent.welcomeMessage ??
      `Hello. I am ${agent.name}, your AI assistant.`,

    suggestedPrompts:
      agent.suggestedPrompts?.length
        ? agent.suggestedPrompts
        : [],

    tools:
      agent.tools?.length
        ? agent.tools
        : [...DEFAULT_AGENT_TOOLS],

    examples:
      agent.examples?.length
        ? agent.examples
        : [],

    metadata: createAgentMetadata(agent.metadata),
  };
}

/**
 * Creates a disabled agent configuration.
 *
 * Useful for experimental or temporarily unavailable agents.
 */
export function createDisabledAgent(
  agent: Partial<AgentDefinition> &
    Pick<AgentDefinition, "id" | "name" | "description" | "category">,
): AgentDefinition {
  return createAgentDefinition({
    ...agent,
    enabled: false,
    featured: false,
    status: "inactive",
  });
}

/**
 * Creates an experimental agent configuration.
 */
export function createExperimentalAgent(
  agent: Partial<AgentDefinition> &
    Pick<AgentDefinition, "id" | "name" | "description" | "category">,
): AgentDefinition {
  return createAgentDefinition({
    ...agent,
    status: "experimental",
  });
}

/**
 * Checks whether an agent is active and available.
 */
export function isAgentActive(agent: AgentDefinition): boolean {
  return (
    agent.enabled === true &&
    agent.status !== "inactive" &&
    agent.status !== "deprecated"
  );
}

/**
 * Returns a safe public representation of an agent.
 *
 * Sensitive implementation details can be excluded here in the future.
 */
export function getPublicAgentDefinition(
  agent: AgentDefinition,
): Omit<AgentDefinition, "systemPrompt"> {
  const { systemPrompt, ...publicAgent } = agent;

  return publicAgent;
}

/**
 * Default system-level instruction shared conceptually
 * across the SYRAVEN agent ecosystem.
 */
export const DEFAULT_SYSTEM_PRINCIPLES = [
  "Prioritize accuracy and reliability.",
  "Do not invent facts or data.",
  "Clearly distinguish facts from assumptions.",
  "Explain uncertainty when relevant.",
  "Protect user privacy.",
  "Provide actionable recommendations.",
  "Use structured reasoning for complex tasks.",
  "Escalate ambiguity by asking for clarification when necessary.",
] as const;

/**
 * Default response structure for complex agent tasks.
 */
export const DEFAULT_COMPLEX_RESPONSE_STRUCTURE = [
  "Executive Summary",
  "Key Findings",
  "Analysis",
  "Risks and Limitations",
  "Recommendations",
  "Next Steps",
] as const;

export default {
  DEFAULT_AGENT_PRIORITY,
  DEFAULT_AGENT_STATUS,
  DEFAULT_EXPERTISE_LEVEL,
  DEFAULT_AGENT_METADATA,
  DEFAULT_AGENT_CAPABILITIES,
  DEFAULT_AGENT_TOOLS,
  DEFAULT_SYSTEM_PRINCIPLES,
  DEFAULT_COMPLEX_RESPONSE_STRUCTURE,
  createAgentMetadata,
  createAgentDefinition,
  createDisabledAgent,
  createExperimentalAgent,
  isAgentActive,
  getPublicAgentDefinition,
};