/**
 * SYRAVEN AI AGENT SYSTEM
 * Core Type Definitions
 *
 * Central type system for all AI agents.
 * Every agent in the platform must conform to these interfaces.
 */

export type AgentPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ExpertiseLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type AgentStatus =
  | "active"
  | "inactive"
  | "experimental"
  | "deprecated";

export type AgentCategory =
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
  | "general";

export interface AgentExample {
  input: string;
  output: string;
}

export interface AgentMetadata {
  domain: string;

  author: string;

  priority: AgentPriority;

  expertiseLevel: ExpertiseLevel;

  supportsResearch: boolean;

  supportsAnalysis: boolean;

  supportsExecution: boolean;

  supportsCollaboration: boolean;

  /**
   * Planning capability.
   * Optional for backward compatibility with existing agents.
   */
  supportsPlanning?: boolean;

  /**
   * Optional version information.
   */
  version?: string;

  /**
   * Agent lifecycle status.
   */
  status?: AgentStatus;

  /**
   * Additional metadata allowed for future agents.
   */
  [key: string]: unknown;
}

export interface AgentDefinition {
  /**
   * Unique agent identifier.
   */
  id: string;

  /**
   * Human-readable agent name.
   */
  name: string;

  /**
   * Short agent description.
   */
  description: string;

  /**
   * Main agent category.
   */
  category: AgentCategory | string;

  /**
   * Optional agent version.
   */
  version?: string;

  /**
   * Optional icon identifier.
   */
  icon?: string;

  /**
   * Optional UI color.
   */
  color?: string;

  /**
   * Whether the agent is enabled.
   */
  enabled?: boolean;

  /**
   * Whether the agent should be highlighted.
   */
  featured?: boolean;

  /**
   * Agent lifecycle status.
   */
  status?: AgentStatus;

  /**
   * Primary agent capabilities.
   */
  capabilities?: string[];

  /**
   * Detailed system instructions.
   */
  systemPrompt?: string;

  /**
   * Short welcome message.
   */
  welcomeMessage?: string;

  /**
   * Example prompts displayed to users.
   */
  suggestedPrompts?: string[];

  /**
   * Recommended tools for this agent.
   */
  tools?: string[];

  /**
   * Example conversations.
   */
  examples?: AgentExample[];

  /**
   * Agent metadata.
   */
  metadata: AgentMetadata;

  /**
   * Extended configuration.
   *
   * Allows future enterprise-scale agent configuration
   * without breaking existing agent definitions.
   */
  [key: string]: unknown;
}

export interface AgentRegistry {
  [agentId: string]: AgentDefinition;
}

export interface AgentExecutionContext {
  agentId: string;

  userId?: string;

  sessionId?: string;

  conversationId?: string;

  input: string;

  history?: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;

  metadata?: Record<string, unknown>;
}

export interface AgentExecutionResult {
  success: boolean;

  output: string;

  agentId: string;

  error?: string;

  metadata?: Record<string, unknown>;
}

export interface AgentTool {
  id: string;

  name: string;

  description: string;

  enabled?: boolean;
}

export interface AgentCapability {
  id: string;

  name: string;

  description?: string;
}