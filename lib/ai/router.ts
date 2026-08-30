/**
 * SYRAVEN AI - Intelligent Agent Router
 *
 * Enterprise multi-agent routing system.
 *
 * Responsibilities:
 * - Analyze incoming requests
 * - Detect intent
 * - Match requests with agent capabilities
 * - Score candidate agents
 * - Support multi-agent routing
 * - Provide fallback routing
 * - Keep routing deterministic and type-safe
 */

import type { AgentDefinition } from "../agents/types";
import {
  agentRegistry,
  getAgentById,
  getActiveAgents,
} from "../agents/registry";

/**
 * Known agent identifiers.
 *
 * Kept local instead of depending on a specific AgentId export
 * so this router remains compatible with the current agent types.
 */
export type RouterAgentId =
  | "automation"
  | "business"
  | "coding"
  | "data"
  | "design"
  | "finance"
  | "marketing"
  | "news"
  | "personal"
  | "research"
  | "study"
  | "website"
  | "writing";

/**
 * Supported routing strategies.
 */
export type RoutingStrategy =
  | "single"
  | "multi"
  | "fallback"
  | "auto";

/**
 * Intent categories.
 */
export type RouteIntent =
  | "automation"
  | "business"
  | "coding"
  | "data"
  | "design"
  | "finance"
  | "marketing"
  | "news"
  | "personal"
  | "research"
  | "study"
  | "website"
  | "writing"
  | "general"
  | "unknown";

/**
 * Routing request.
 */
export interface RoutingRequest {
  query: string;

  preferredAgentId?: string;

  preferredAgents?: string[];

  requiredCapabilities?: string[];

  excludedAgents?: string[];

  strategy?: RoutingStrategy;

  maxAgents?: number;

  allowFallback?: boolean;

  metadata?: Record<string, unknown>;
}

/**
 * Individual agent match.
 */
export interface AgentRouteMatch {
  agent: AgentDefinition;

  score: number;

  confidence: number;

  reasons: string[];

  matchedKeywords: string[];

  matchedCapabilities: string[];
}

/**
 * Routing result.
 */
export interface RoutingResult {
  intent: RouteIntent;

  strategy: RoutingStrategy;

  primaryAgent: AgentDefinition | null;

  selectedAgents: AgentDefinition[];

  matches: AgentRouteMatch[];

  confidence: number;

  requiresMultipleAgents: boolean;

  fallbackAgent: AgentDefinition | null;

  explanation: string;
}

/**
 * Agent routing keywords.
 *
 * These are intentionally deterministic so routing works
 * even without an LLM classification call.
 */
const AGENT_KEYWORDS: Record<RouteIntent, string[]> = {
  automation: [
    "automation",
    "automate",
    "workflow",
    "process",
    "schedule",
    "trigger",
    "pipeline",
    "integration",
    "orchestration",
    "job",
    "cron",
  ],

  business: [
    "business",
    "company",
    "strategy",
    "growth",
    "startup",
    "market",
    "revenue",
    "customer",
    "competition",
    "management",
    "operations",
    "enterprise",
  ],

  coding: [
    "code",
    "coding",
    "programming",
    "typescript",
    "javascript",
    "python",
    "react",
    "nextjs",
    "next.js",
    "api",
    "database",
    "bug",
    "error",
    "debug",
    "software",
    "backend",
    "frontend",
    "architecture",
    "deploy",
  ],

  data: [
    "data",
    "dataset",
    "analytics",
    "analysis",
    "statistics",
    "metric",
    "kpi",
    "database",
    "sql",
    "dashboard",
    "forecast",
    "trend",
    "anomaly",
    "visualization",
  ],

  design: [
    "design",
    "ui",
    "ux",
    "interface",
    "visual",
    "branding",
    "brand",
    "layout",
    "color",
    "typography",
    "prototype",
    "figma",
  ],

  finance: [
    "finance",
    "financial",
    "budget",
    "investment",
    "valuation",
    "profit",
    "cashflow",
    "cash flow",
    "revenue",
    "expense",
    "cost",
    "roi",
    "forecast",
    "economic",
  ],

  marketing: [
    "marketing",
    "campaign",
    "advertising",
    "seo",
    "content marketing",
    "social media",
    "audience",
    "conversion",
    "brand awareness",
    "acquisition",
    "growth marketing",
  ],

  news: [
    "news",
    "latest",
    "breaking",
    "today",
    "current events",
    "headline",
    "update",
    "recent",
  ],

  personal: [
    "personal",
    "life",
    "routine",
    "productivity",
    "goal",
    "habit",
    "planning",
    "decision",
    "organize",
    "schedule",
  ],

  research: [
    "research",
    "investigate",
    "study",
    "evidence",
    "sources",
    "literature",
    "compare",
    "deep analysis",
    "find information",
    "report",
  ],

  study: [
    "learn",
    "learning",
    "study",
    "education",
    "course",
    "lesson",
    "exam",
    "teach",
    "explain",
    "homework",
    "practice",
  ],

  website: [
    "website",
    "web site",
    "landing page",
    "homepage",
    "web app",
    "responsive",
    "domain",
    "hosting",
    "seo website",
  ],

  writing: [
    "write",
    "writing",
    "article",
    "blog",
    "copy",
    "email",
    "text",
    "content",
    "story",
    "script",
    "documentation",
    "rewrite",
    "grammar",
  ],

  general: [],

  unknown: [],
};

/**
 * Normalize text for deterministic matching.
 */
export function normalizeRoutingText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Safely extract agent capabilities.
 *
 * AgentDefinition.capabilities may be optional depending
 * on the current types.ts definition.
 */
export function getAgentCapabilities(
  agent: AgentDefinition
): string[] {
  if (!Array.isArray(agent.capabilities)) {
    return [];
  }

  return agent.capabilities.filter(
    (capability): capability is string =>
      typeof capability === "string" &&
      capability.trim().length > 0
  );
}

/**
 * Detect the most likely intent.
 */
export function detectIntent(query: string): RouteIntent {
  const normalizedQuery = normalizeRoutingText(query);

  if (!normalizedQuery) {
    return "unknown";
  }

  let bestIntent: RouteIntent = "general";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(
    AGENT_KEYWORDS
  ) as [RouteIntent, string[]][]) {
    if (
      intent === "general" ||
      intent === "unknown"
    ) {
      continue;
    }

    let score = 0;

    for (const keyword of keywords) {
      const normalizedKeyword =
        normalizeRoutingText(keyword);

      if (
        normalizedKeyword &&
        normalizedQuery.includes(normalizedKeyword)
      ) {
        score += normalizedKeyword.includes(" ")
          ? 2
          : 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return bestScore > 0
    ? bestIntent
    : "general";
}

/**
 * Get keywords matched for a specific intent.
 */
export function getMatchedKeywords(
  query: string,
  intent: RouteIntent
): string[] {
  const normalizedQuery = normalizeRoutingText(query);

  const keywords =
    AGENT_KEYWORDS[intent] ?? [];

  return keywords.filter((keyword) =>
    normalizedQuery.includes(
      normalizeRoutingText(keyword)
    )
  );
}

/**
 * Calculate capability matches.
 */
export function getMatchedCapabilities(
  agent: AgentDefinition,
  requiredCapabilities?: string[]
): string[] {
  if (
    !requiredCapabilities ||
    requiredCapabilities.length === 0
  ) {
    return [];
  }

  const capabilities =
    getAgentCapabilities(agent).map((item) =>
      normalizeRoutingText(item)
    );

  return requiredCapabilities.filter(
    (requiredCapability) => {
      const normalizedRequired =
        normalizeRoutingText(requiredCapability);

      return capabilities.some(
        (capability) =>
          capability === normalizedRequired ||
          capability.includes(normalizedRequired) ||
          normalizedRequired.includes(capability)
      );
    }
  );
}

/**
 * Scores a single agent against a routing request.
 */
export function scoreAgent(
  agent: AgentDefinition,
  request: RoutingRequest,
  intent: RouteIntent
): AgentRouteMatch {
  const reasons: string[] = [];

  let score = 0;

  const matchedKeywords =
    getMatchedKeywords(request.query, intent);

  const agentId =
    typeof agent.id === "string"
      ? agent.id
      : "";

  const normalizedAgentId =
    normalizeRoutingText(agentId);

  const normalizedIntent =
    normalizeRoutingText(intent);

  if (
    normalizedAgentId === normalizedIntent
  ) {
    score += 50;

    reasons.push(
      `Agent ID directly matches detected intent "${intent}".`
    );
  }

  const capabilities =
    getAgentCapabilities(agent);

  const normalizedQuery =
    normalizeRoutingText(request.query);

  for (const capability of capabilities) {
    const normalizedCapability =
      normalizeRoutingText(capability);

    if (
      normalizedCapability &&
      normalizedQuery.includes(normalizedCapability)
    ) {
      score += 8;

      reasons.push(
        `Request matches capability "${capability}".`
      );
    }
  }

  if (matchedKeywords.length > 0) {
    score += matchedKeywords.length * 5;

    reasons.push(
      `Matched ${matchedKeywords.length} routing keyword(s).`
    );
  }

  const matchedCapabilities =
    getMatchedCapabilities(
      agent,
      request.requiredCapabilities
    );

  if (matchedCapabilities.length > 0) {
    score += matchedCapabilities.length * 15;

    reasons.push(
      `Matched ${matchedCapabilities.length} required capability/capabilities.`
    );
  }

  if (
    request.preferredAgentId &&
    request.preferredAgentId === agent.id
  ) {
    score += 100;

    reasons.push(
      "Agent explicitly requested by preferredAgentId."
    );
  }

  if (
    request.preferredAgents?.includes(
      String(agent.id)
    )
  ) {
    score += 40;

    reasons.push(
      "Agent is included in preferredAgents."
    );
  }

  if (
    request.excludedAgents?.includes(
      String(agent.id)
    )
  ) {
    score = -1000;

    reasons.push(
      "Agent is explicitly excluded from routing."
    );
  }

  const confidence =
    Math.max(
      0,
      Math.min(
        1,
        score / 100
      )
    );

  return {
    agent,
    score,
    confidence,
    reasons,
    matchedKeywords,
    matchedCapabilities,
  };
}

/**
 * Checks whether an agent can participate in routing.
 */
export function isAgentRoutable(
  agent: AgentDefinition
): boolean {
  return agent.enabled !== false;
}

/**
 * Gets all agents safely from the registry.
 */
export function getRoutableAgents(): AgentDefinition[] {
  try {
    const activeAgents = getActiveAgents();

    if (Array.isArray(activeAgents)) {
      return activeAgents.filter(isAgentRoutable);
    }
  } catch {
    // Fall through to registry fallback.
  }

  if (Array.isArray(agentRegistry)) {
    return agentRegistry.filter(isAgentRoutable);
  }

  if (
    agentRegistry &&
    typeof agentRegistry === "object"
  ) {
    return Object.values(
      agentRegistry
    ).filter(
      (agent): agent is AgentDefinition =>
        Boolean(agent) &&
        typeof agent === "object" &&
        "id" in agent &&
        isAgentRoutable(
          agent as AgentDefinition
        )
    );
  }

  return [];
}

/**
 * Resolves an explicitly requested agent.
 */
export function resolvePreferredAgent(
  agentId?: string
): AgentDefinition | null {
  if (!agentId) {
    return null;
  }

  try {
    const agent = getAgentById(agentId);

    if (
      agent &&
      isAgentRoutable(agent)
    ) {
      return agent;
    }
  } catch {
    // Use fallback search below.
  }

  const normalizedId =
    normalizeRoutingText(agentId);

  return (
    getRoutableAgents().find(
      (agent) =>
        normalizeRoutingText(
          String(agent.id)
        ) === normalizedId
    ) ?? null
  );
}

/**
 * Determines whether a request likely needs
 * multiple specialist agents.
 */
export function requiresMultipleAgents(
  request: RoutingRequest,
  matches: AgentRouteMatch[]
): boolean {
  if (request.strategy === "single") {
    return false;
  }

  if (request.strategy === "multi") {
    return true;
  }

  if (
    request.preferredAgents &&
    request.preferredAgents.length > 1
  ) {
    return true;
  }

  const highQualityMatches =
    matches.filter(
      (match) => match.score >= 20
    );

  if (highQualityMatches.length >= 2) {
    const topScore =
      highQualityMatches[0]?.score ?? 0;

    const secondScore =
      highQualityMatches[1]?.score ?? 0;

    return (
      topScore > 0 &&
      secondScore >= topScore * 0.6
    );
  }

  return false;
}

/**
 * Finds the best fallback agent.
 */
export function findFallbackAgent(
  matches: AgentRouteMatch[],
  primaryAgent: AgentDefinition | null
): AgentDefinition | null {
  for (const match of matches) {
    if (
      !primaryAgent ||
      match.agent.id !== primaryAgent.id
    ) {
      return match.agent;
    }
  }

  return null;
}

/**
 * Main deterministic routing function.
 */
export function routeRequest(
  request: RoutingRequest
): RoutingResult {
  const strategy =
    request.strategy ?? "auto";

  const maxAgents = Math.max(
    1,
    Math.min(
      request.maxAgents ?? 3,
      10
    )
  );

  const query =
    typeof request.query === "string"
      ? request.query.trim()
      : "";

  const safeRequest: RoutingRequest = {
    ...request,
    query,
  };

  /**
   * Explicit preferred agent always has highest priority.
   */
  const preferredAgent =
    resolvePreferredAgent(
      safeRequest.preferredAgentId
    );

  if (preferredAgent) {
    const fallback =
      safeRequest.allowFallback !== false
        ? getRoutableAgents().find(
            (agent) =>
              agent.id !== preferredAgent.id
          ) ?? null
        : null;

    return {
      intent: detectIntent(query),
      strategy,
      primaryAgent: preferredAgent,
      selectedAgents: [preferredAgent],
      matches: [
        {
          agent: preferredAgent,
          score: 100,
          confidence: 1,
          reasons: [
            "Explicit preferred agent selected.",
          ],
          matchedKeywords: [],
          matchedCapabilities: [],
        },
      ],
      confidence: 1,
      requiresMultipleAgents: false,
      fallbackAgent: fallback,
      explanation:
        "Routing used the explicitly requested preferred agent.",
    };
  }

  const intent =
    detectIntent(query);

  const agents =
    getRoutableAgents();

  const matches = agents
    .map((agent) =>
      scoreAgent(
        agent,
        safeRequest,
        intent
      )
    )
    .filter(
      (match) => match.score >= 0
    )
    .sort(
      (a, b) => b.score - a.score
    );

  /**
   * No agents available.
   */
  if (matches.length === 0) {
    return {
      intent,
      strategy,
      primaryAgent: null,
      selectedAgents: [],
      matches: [],
      confidence: 0,
      requiresMultipleAgents: false,
      fallbackAgent: null,
      explanation:
        "No active agents were available for this request.",
    };
  }

  /**
   * Determine whether multiple agents are useful.
   */
  const shouldUseMultiple =
    requiresMultipleAgents(
      safeRequest,
      matches
    );

  let selectedMatches: AgentRouteMatch[];

  if (
    strategy === "multi" ||
    (strategy === "auto" &&
      shouldUseMultiple)
  ) {
    selectedMatches =
      matches.slice(0, maxAgents);
  } else {
    selectedMatches =
      matches.slice(0, 1);
  }

  const selectedAgents =
    selectedMatches.map(
      (match) => match.agent
    );

  const primaryAgent =
    selectedAgents[0] ?? null;

  const fallbackAgent =
    safeRequest.allowFallback !== false
      ? findFallbackAgent(
          matches,
          primaryAgent
        )
      : null;

  const primaryMatch =
    selectedMatches[0];

  const confidence =
    primaryMatch?.confidence ?? 0;

  let explanation = "";

  if (!primaryAgent) {
    explanation =
      "No suitable agent could be selected.";
  } else if (selectedAgents.length > 1) {
    explanation =
      `Selected ${selectedAgents.length} agents because the request spans multiple relevant domains.`;
  } else {
    explanation =
      `Selected agent "${primaryAgent.name}" for detected intent "${intent}".`;
  }

  return {
    intent,
    strategy,
    primaryAgent,
    selectedAgents,
    matches,
    confidence,
    requiresMultipleAgents:
      selectedAgents.length > 1,
    fallbackAgent,
    explanation,
  };
}

/**
 * Route directly to a known agent ID.
 */
export function routeToAgent(
  agentId: string,
  query = ""
): RoutingResult {
  return routeRequest({
    query,
    preferredAgentId: agentId,
    strategy: "single",
    allowFallback: true,
  });
}

/**
 * Route using required capabilities.
 */
export function routeByCapabilities(
  query: string,
  capabilities: string[],
  maxAgents = 3
): RoutingResult {
  return routeRequest({
    query,
    requiredCapabilities: capabilities,
    strategy: "auto",
    maxAgents,
    allowFallback: true,
  });
}

/**
 * Returns only the primary agent.
 */
export function selectBestAgent(
  query: string
): AgentDefinition | null {
  return routeRequest({
    query,
    strategy: "single",
  }).primaryAgent;
}

/**
 * Returns selected agents for multi-agent workflows.
 */
export function selectAgents(
  query: string,
  maxAgents = 3
): AgentDefinition[] {
  return routeRequest({
    query,
    strategy: "auto",
    maxAgents,
  }).selectedAgents;
}

/**
 * Router health information.
 */
export function getRouterStats(): {
  totalAgents: number;
  activeAgents: number;
  availableAgentIds: string[];
} {
  const agents =
    getRoutableAgents();

  return {
    totalAgents: agents.length,
    activeAgents: agents.length,
    availableAgentIds: agents.map(
      (agent) => String(agent.id)
    ),
  };
}

/**
 * Default router API.
 */
const aiRouter = {
  normalizeRoutingText,
  getAgentCapabilities,
  detectIntent,
  getMatchedKeywords,
  getMatchedCapabilities,
  scoreAgent,
  isAgentRoutable,
  getRoutableAgents,
  resolvePreferredAgent,
  requiresMultipleAgents,
  findFallbackAgent,
  routeRequest,
  routeToAgent,
  routeByCapabilities,
  selectBestAgent,
  selectAgents,
  getRouterStats,
};

export default aiRouter;