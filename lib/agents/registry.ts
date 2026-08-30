import type {
  AgentDefinition,
} from "./types";

import { automationAgent } from "./automation-agent";
import { businessAgent } from "./business-agent";
import { codingAgent } from "./coding-agent";
import { dataAgent } from "./data-agent";
import { designAgent } from "./design-agent";
import { financeAgent } from "./finance-agent";
import { marketingAgent } from "./marketing-agent";
import { newsAgent } from "./news-agent";
import { personalAgent } from "./personal-agent";
import { researchAgent } from "./research-agent";

/**
 * ============================================================
 * SYRAVEN AI - AGENT REGISTRY
 * ============================================================
 *
 * Central registry for all AI agents.
 *
 * This file is the single source of truth for:
 * - Agent discovery
 * - Agent lookup
 * - Agent search
 * - Category filtering
 * - Capability filtering
 * - Registry statistics
 *
 * Built for scalable multi-agent architecture.
 * ============================================================
 */

/**
 * All registered agents.
 */
export const agents: AgentDefinition[] = [
  automationAgent,
  businessAgent,
  codingAgent,
  dataAgent,
  designAgent,
  financeAgent,
  marketingAgent,
  newsAgent,
  personalAgent,
  researchAgent,
];

/**
 * Fast lookup registry.
 */
export const agentRegistry = new Map<
  string,
  AgentDefinition
>();

/**
 * Initialize registry.
 */
for (const agent of agents) {
  agentRegistry.set(agent.id, agent);
}

/**
 * Get all agents.
 */
export function getAllAgents(): AgentDefinition[] {
  return [...agents];
}

/**
 * Get agent by ID.
 */
export function getAgentById(
  agentId: string | null | undefined,
): AgentDefinition | null {
  if (!agentId) {
    return null;
  }

  return agentRegistry.get(agentId) ?? null;
}

/**
 * Check whether an agent exists.
 */
export function hasAgent(
  agentId: string | null | undefined,
): boolean {
  if (!agentId) {
    return false;
  }

  return agentRegistry.has(agentId);
}

/**
 * Get agent or throw an error.
 */
export function requireAgent(
  agentId: string,
): AgentDefinition {
  const agent = getAgentById(agentId);

  if (!agent) {
    throw new Error(
      `Agent "${agentId}" was not found in the registry.`,
    );
  }

  return agent;
}

/**
 * Get enabled agents.
 */
export function getActiveAgents(): AgentDefinition[] {
  return agents.filter((agent) => {
    return agent.enabled === true;
  });
}

/**
 * Get featured agents.
 */
export function getFeaturedAgents(): AgentDefinition[] {
  return agents.filter((agent) => {
    return (
      agent.enabled === true &&
      agent.featured === true
    );
  });
}

/**
 * Get agents by category.
 */
export function getAgentsByCategory(
  category: string,
): AgentDefinition[] {
  const normalizedCategory =
    category.trim().toLowerCase();

  if (!normalizedCategory) {
    return [];
  }

  return agents.filter((agent) => {
    const agentCategory =
      String(agent.category ?? "").toLowerCase();

    return (
      agent.enabled === true &&
      agentCategory === normalizedCategory
    );
  });
}

/**
 * Get agent capabilities safely.
 *
 * Some AgentDefinition objects may have
 * capabilities defined as optional.
 */
function getCapabilities(
  agent: AgentDefinition,
): string[] {
  if (!Array.isArray(agent.capabilities)) {
    return [];
  }

  return agent.capabilities.filter(
    (capability): capability is string =>
      typeof capability === "string",
  );
}

/**
 * Search agents.
 */
export function searchAgents(
  query: string,
): AgentDefinition[] {
  const normalizedQuery =
    query.trim().toLowerCase();

  if (!normalizedQuery) {
    return getActiveAgents();
  }

  return getActiveAgents().filter((agent) => {
    const capabilities =
      getCapabilities(agent);

    const prompts =
      Array.isArray(agent.suggestedPrompts)
        ? agent.suggestedPrompts
        : [];

    const searchableContent = [
      agent.id,
      agent.name,
      agent.description,
      String(agent.category ?? ""),
      ...capabilities,
      ...prompts,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string",
      )
      .join(" ")
      .toLowerCase();

    return searchableContent.includes(
      normalizedQuery,
    );
  });
}

/**
 * Get agents by one capability.
 */
export function getAgentsByCapability(
  capability: string,
): AgentDefinition[] {
  const normalizedCapability =
    capability.trim().toLowerCase();

  if (!normalizedCapability) {
    return [];
  }

  return getActiveAgents().filter((agent) => {
    const capabilities =
      getCapabilities(agent);

    return capabilities.some(
      (agentCapability) =>
        agentCapability.toLowerCase() ===
        normalizedCapability,
    );
  });
}

/**
 * Get agents matching at least one capability.
 */
export function getAgentsByCapabilities(
  capabilities: string[],
): AgentDefinition[] {
  const normalizedCapabilities =
    capabilities
      .filter(
        (capability): capability is string =>
          typeof capability === "string",
      )
      .map((capability) =>
        capability.trim().toLowerCase(),
      )
      .filter(Boolean);

  if (normalizedCapabilities.length === 0) {
    return [];
  }

  return getActiveAgents().filter((agent) => {
    const agentCapabilities =
      getCapabilities(agent).map(
        (capability) =>
          capability.toLowerCase(),
      );

    return normalizedCapabilities.some(
      (capability) =>
        agentCapabilities.includes(capability),
    );
  });
}

/**
 * Get agents matching all capabilities.
 */
export function getAgentsMatchingAllCapabilities(
  capabilities: string[],
): AgentDefinition[] {
  const normalizedCapabilities =
    capabilities
      .filter(
        (capability): capability is string =>
          typeof capability === "string",
      )
      .map((capability) =>
        capability.trim().toLowerCase(),
      )
      .filter(Boolean);

  if (normalizedCapabilities.length === 0) {
    return [];
  }

  return getActiveAgents().filter((agent) => {
    const agentCapabilities =
      getCapabilities(agent).map(
        (capability) =>
          capability.toLowerCase(),
      );

    return normalizedCapabilities.every(
      (capability) =>
        agentCapabilities.includes(capability),
    );
  });
}

/**
 * Get research-capable agents.
 */
export function getResearchAgents(): AgentDefinition[] {
  return getActiveAgents().filter((agent) => {
    return (
      agent.metadata?.supportsResearch === true
    );
  });
}

/**
 * Get analysis-capable agents.
 */
export function getAnalysisAgents(): AgentDefinition[] {
  return getActiveAgents().filter((agent) => {
    return (
      agent.metadata?.supportsAnalysis === true
    );
  });
}

/**
 * Get execution-capable agents.
 */
export function getExecutionAgents(): AgentDefinition[] {
  return getActiveAgents().filter((agent) => {
    return (
      agent.metadata?.supportsExecution === true
    );
  });
}

/**
 * Get collaboration-capable agents.
 */
export function getCollaborativeAgents(): AgentDefinition[] {
  return getActiveAgents().filter((agent) => {
    return (
      agent.metadata?.supportsCollaboration === true
    );
  });
}

/**
 * Get planning-capable agents.
 */
export function getPlanningAgents(): AgentDefinition[] {
  return getActiveAgents().filter((agent) => {
    return (
      agent.metadata?.supportsPlanning === true
    );
  });
}

/**
 * Lightweight catalog.
 *
 * Suitable for UI lists and API responses.
 */
export function getAgentCatalog() {
  return getActiveAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    icon: agent.icon,
    color: agent.color,
    featured: agent.featured,
    capabilities: getCapabilities(agent),
  }));
}

/**
 * Registry statistics.
 */
export function getAgentRegistryStats() {
  const allAgents = getAllAgents();
  const activeAgents = getActiveAgents();
  const featuredAgents = getFeaturedAgents();

  const uniqueCategories = new Set<string>();

  const uniqueCapabilities = new Set<string>();

  for (const agent of activeAgents) {
    if (agent.category) {
      uniqueCategories.add(
        String(agent.category),
      );
    }

    const capabilities =
      getCapabilities(agent);

    for (const capability of capabilities) {
      uniqueCapabilities.add(capability);
    }
  }

  return {
    total: allAgents.length,
    active: activeAgents.length,
    featured: featuredAgents.length,
    categories: uniqueCategories.size,
    capabilities: uniqueCapabilities.size,
  };
}

/**
 * Default registry export.
 */
export default agentRegistry;