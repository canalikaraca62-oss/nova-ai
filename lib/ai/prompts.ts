/**
 * SYRAVEN AI - Prompt Engineering System
 * Enterprise AI Prompt Infrastructure
 *
 * Centralized prompt generation for:
 * - Multi-agent orchestration
 * - Context-aware conversations
 * - System instructions
 * - Research and analysis
 * - Business intelligence
 * - Production-grade AI workflows
 */

export type PromptRole =
  | "system"
  | "user"
  | "assistant"
  | "developer";

export interface PromptMessage {
  role: PromptRole;
  content: string;
}

export interface PromptAgent {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  capabilities?: string[];
  systemPrompt?: string;
}

export interface PromptContext {
  request?: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;

  locale?: string;
  timezone?: string;

  history?: PromptMessage[];

  memory?: string[];
  knowledge?: string[];

  metadata?: Record<string, unknown>;

  currentDate?: string;

  additionalInstructions?: string;
}

export interface BuildPromptOptions {
  agent: PromptAgent;
  context?: PromptContext;

  userMessage?: string;

  includeSafety?: boolean;
  includeReasoningGuidelines?: boolean;
  includeOutputGuidelines?: boolean;

  maxContextItems?: number;
}

export interface PromptTemplateOptions {
  title?: string;
  instructions?: string[];
  context?: string;
  input?: string;
  outputFormat?: string;
}

/**
 * Core global AI behavior.
 */
export const CORE_SYSTEM_PROMPT = `
You are SYRAVEN, an advanced enterprise artificial intelligence system.

Your mission is to help users solve complex problems with accuracy,
clarity, intelligence and practical execution.

Core principles:

1. Be accurate and honest.
2. Never invent facts when information is uncertain.
3. Clearly distinguish facts, assumptions and recommendations.
4. Prefer structured reasoning for complex problems.
5. Produce actionable and practical outputs.
6. Consider scalability, reliability and long-term consequences.
7. Protect privacy and sensitive information.
8. Avoid unnecessary repetition.
9. Adapt the response depth to the complexity of the request.
10. When multiple solutions exist, compare trade-offs clearly.

You operate as part of a multi-agent intelligence system.

When relevant:
- break complex tasks into logical components
- identify dependencies
- surface risks
- explain assumptions
- recommend next actions
- produce implementation-ready results

Always optimize for usefulness, correctness and clarity.
`.trim();

/**
 * Safety instructions shared by all prompts.
 */
export const SAFETY_PROMPT = `
Safety and reliability requirements:

- Do not fabricate data, sources, results or system capabilities.
- Do not claim to have completed actions that were not completed.
- Do not expose secrets, credentials or sensitive private information.
- Treat uncertain information explicitly as uncertain.
- For high-impact decisions, encourage verification where appropriate.
- Prefer safe, reversible and well-documented recommendations.
- Do not provide misleading certainty.
`.trim();

/**
 * Reasoning guidelines.
 */
export const REASONING_GUIDELINES_PROMPT = `
Problem-solving guidelines:

1. Understand the objective before proposing a solution.
2. Identify constraints and dependencies.
3. Separate facts from assumptions.
4. Consider multiple approaches when useful.
5. Evaluate trade-offs.
6. Prioritize scalable and maintainable solutions.
7. Identify major risks and failure points.
8. Provide a clear recommended path forward.
`.trim();

/**
 * Output quality requirements.
 */
export const OUTPUT_GUIDELINES_PROMPT = `
Output requirements:

- Be concise when the task is simple.
- Be detailed when complexity requires detail.
- Use headings for complex responses.
- Use bullet points for clarity.
- Use tables only when comparison benefits from them.
- Provide actionable next steps when appropriate.
- Avoid unnecessary filler.
- Prefer production-ready recommendations.
`.trim();

/**
 * Formats conversation history.
 */
export function formatConversationHistory(
  history?: PromptMessage[],
  maxMessages = 20
): string {
  if (!history || history.length === 0) {
    return "";
  }

  const messages = history.slice(-maxMessages);

  return messages
    .map((message) => {
      const role =
        message.role.charAt(0).toUpperCase() + message.role.slice(1);

      return `${role}: ${message.content}`;
    })
    .join("\n\n");
}

/**
 * Formats memory entries.
 */
export function formatMemory(
  memory?: string[],
  maxItems = 10
): string {
  if (!memory || memory.length === 0) {
    return "";
  }

  return memory
    .slice(0, maxItems)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

/**
 * Formats knowledge entries.
 */
export function formatKnowledge(
  knowledge?: string[],
  maxItems = 10
): string {
  if (!knowledge || knowledge.length === 0) {
    return "";
  }

  return knowledge
    .slice(0, maxItems)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

/**
 * Formats arbitrary metadata safely.
 */
export function formatMetadata(
  metadata?: Record<string, unknown>
): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "";
  }
}

/**
 * Builds contextual information.
 */
export function buildContextPrompt(
  context?: PromptContext,
  maxContextItems = 10
): string {
  if (!context) {
    return "";
  }

  const sections: string[] = [];

  if (context.request) {
    sections.push(`
CURRENT REQUEST:
${context.request}
`.trim());
  }

  if (context.locale) {
    sections.push(`
LOCALE:
${context.locale}
`.trim());
  }

  if (context.timezone) {
    sections.push(`
TIMEZONE:
${context.timezone}
`.trim());
  }

  if (context.currentDate) {
    sections.push(`
CURRENT DATE:
${context.currentDate}
`.trim());
  }

  const memory = formatMemory(
    context.memory,
    maxContextItems
  );

  if (memory) {
    sections.push(`
RELEVANT MEMORY:
${memory}
`.trim());
  }

  const knowledge = formatKnowledge(
    context.knowledge,
    maxContextItems
  );

  if (knowledge) {
    sections.push(`
RELEVANT KNOWLEDGE:
${knowledge}
`.trim());
  }

  const metadata = formatMetadata(context.metadata);

  if (metadata) {
    sections.push(`
ADDITIONAL METADATA:
${metadata}
`.trim());
  }

  if (context.additionalInstructions) {
    sections.push(`
ADDITIONAL INSTRUCTIONS:
${context.additionalInstructions}
`.trim());
  }

  return sections.join("\n\n");
}

/**
 * Builds the base system prompt for an agent.
 *
 * IMPORTANT:
 * capabilities is optional, therefore optional chaining
 * and a fallback value are used.
 */
export function buildBaseSystemPrompt(
  options: BuildPromptOptions
): string {
  const {
    agent,
    context,
    includeSafety = true,
    includeReasoningGuidelines = true,
    includeOutputGuidelines = true,
    maxContextItems = 10,
  } = options;

  const sections: string[] = [];

  sections.push(CORE_SYSTEM_PROMPT);

  sections.push(`
AGENT ID:
${agent.id ?? "unknown"}

AGENT NAME:
${agent.name}

DESCRIPTION:
${agent.description ?? "No description provided"}

CATEGORY:
${agent.category ?? "general"}

CAPABILITIES:
${agent.capabilities?.length
  ? agent.capabilities.join(", ")
  : "No specific capabilities defined"}

AGENT INSTRUCTIONS:
${agent.systemPrompt ?? "Provide accurate, useful and actionable assistance."}
`.trim());

  if (includeSafety) {
    sections.push(SAFETY_PROMPT);
  }

  if (includeReasoningGuidelines) {
    sections.push(REASONING_GUIDELINES_PROMPT);
  }

  if (includeOutputGuidelines) {
    sections.push(OUTPUT_GUIDELINES_PROMPT);
  }

  const contextPrompt = buildContextPrompt(
    context,
    maxContextItems
  );

  if (contextPrompt) {
    sections.push(`
CONTEXT:
${contextPrompt}
`.trim());
  }

  return sections
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Builds a complete chat message array.
 */
export function buildChatMessages(
  options: BuildPromptOptions
): PromptMessage[] {
  const messages: PromptMessage[] = [];

  const systemPrompt = buildBaseSystemPrompt(options);

  messages.push({
    role: "system",
    content: systemPrompt,
  });

  const history = options.context?.history;

  if (history && history.length > 0) {
    messages.push(...history);
  }

  if (options.userMessage) {
    messages.push({
      role: "user",
      content: options.userMessage,
    });
  }

  return messages;
}

/**
 * Builds a generic structured task prompt.
 */
export function buildTaskPrompt(
  options: PromptTemplateOptions
): string {
  const sections: string[] = [];

  if (options.title) {
    sections.push(`
TASK:
${options.title}
`.trim());
  }

  if (
    options.instructions &&
    options.instructions.length > 0
  ) {
    const instructionList = options.instructions
      .map(
        (instruction, index) =>
          `${index + 1}. ${instruction}`
      )
      .join("\n");

    sections.push(`
INSTRUCTIONS:
${instructionList}
`.trim());
  }

  if (options.context) {
    sections.push(`
CONTEXT:
${options.context}
`.trim());
  }

  if (options.input) {
    sections.push(`
INPUT:
${options.input}
`.trim());
  }

  if (options.outputFormat) {
    sections.push(`
EXPECTED OUTPUT FORMAT:
${options.outputFormat}
`.trim());
  }

  return sections
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Builds a research prompt.
 */
export function buildResearchPrompt(
  topic: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Research: ${topic}`,
    instructions: [
      "Define the research objective.",
      "Identify the most important questions.",
      "Separate verified facts from assumptions.",
      "Analyze competing perspectives when relevant.",
      "Identify important risks and uncertainties.",
      "Provide actionable conclusions.",
      "Clearly state limitations in the available information.",
    ],
    context,
    outputFormat: `
1. Executive Summary
2. Key Findings
3. Analysis
4. Risks and Uncertainties
5. Recommendations
6. Next Steps
`.trim(),
  });
}

/**
 * Builds a business analysis prompt.
 */
export function buildBusinessPrompt(
  objective: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Business Analysis: ${objective}`,
    instructions: [
      "Understand the strategic objective.",
      "Analyze the current situation.",
      "Identify market and operational opportunities.",
      "Evaluate risks and constraints.",
      "Compare strategic alternatives.",
      "Recommend the highest-value path.",
      "Provide measurable next steps.",
    ],
    context,
    outputFormat: `
1. Executive Summary
2. Strategic Context
3. Opportunities
4. Risks
5. Strategic Options
6. Recommended Plan
7. KPIs
8. Next Steps
`.trim(),
  });
}

/**
 * Builds a technical architecture prompt.
 */
export function buildArchitecturePrompt(
  objective: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Technical Architecture: ${objective}`,
    instructions: [
      "Identify functional requirements.",
      "Identify non-functional requirements.",
      "Design for scalability.",
      "Design for reliability.",
      "Consider security and privacy.",
      "Identify integration dependencies.",
      "Recommend a maintainable architecture.",
      "Explain important trade-offs.",
    ],
    context,
    outputFormat: `
1. Requirements
2. Architecture Overview
3. Components
4. Data Flow
5. Security Considerations
6. Scalability Strategy
7. Reliability Strategy
8. Technology Recommendations
9. Risks
10. Implementation Roadmap
`.trim(),
  });
}

/**
 * Builds a coding implementation prompt.
 */
export function buildCodingPrompt(
  objective: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Software Implementation: ${objective}`,
    instructions: [
      "Understand the existing architecture.",
      "Preserve compatibility where possible.",
      "Use strong typing.",
      "Avoid unnecessary complexity.",
      "Handle errors safely.",
      "Consider edge cases.",
      "Write maintainable production-grade code.",
      "Explain important implementation decisions.",
    ],
    context,
    outputFormat: `
1. Implementation Strategy
2. Architecture Changes
3. Production Code
4. Error Handling
5. Edge Cases
6. Testing Recommendations
7. Integration Notes
`.trim(),
  });
}

/**
 * Builds a data analysis prompt.
 */
export function buildDataAnalysisPrompt(
  objective: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Data Analysis: ${objective}`,
    instructions: [
      "Understand the dataset and objective.",
      "Identify data quality issues.",
      "Analyze important patterns.",
      "Identify anomalies.",
      "Distinguish correlation from causation.",
      "Quantify uncertainty where possible.",
      "Provide actionable insights.",
    ],
    context,
    outputFormat: `
1. Executive Summary
2. Data Overview
3. Data Quality
4. Key Patterns
5. Anomalies
6. Insights
7. Risks and Limitations
8. Recommendations
`.trim(),
  });
}

/**
 * Builds a decision-making prompt.
 */
export function buildDecisionPrompt(
  decision: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Decision Analysis: ${decision}`,
    instructions: [
      "Define the decision clearly.",
      "Identify available options.",
      "Define evaluation criteria.",
      "Analyze benefits and risks.",
      "Consider short-term and long-term effects.",
      "Identify assumptions.",
      "Recommend the strongest option.",
    ],
    context,
    outputFormat: `
1. Decision Summary
2. Options
3. Evaluation Criteria
4. Trade-off Analysis
5. Risk Analysis
6. Recommendation
7. Implementation Steps
`.trim(),
  });
}

/**
 * Builds a multi-agent handoff prompt.
 */
export function buildAgentHandoffPrompt(
  fromAgent: string,
  toAgent: string,
  task: string,
  context?: string
): string {
  return `
MULTI-AGENT HANDOFF

FROM AGENT:
${fromAgent}

TO AGENT:
${toAgent}

TASK:
${task}

${context ? `CONTEXT:\n${context}` : ""}

HANDOFF REQUIREMENTS:

- Preserve relevant context.
- Clearly identify the objective.
- State important assumptions.
- Identify dependencies.
- Highlight risks or unresolved questions.
- Provide structured information for the receiving agent.
`.trim();
}

/**
 * Builds a summarization prompt.
 */
export function buildSummaryPrompt(
  content: string,
  style: "short" | "detailed" | "executive" = "detailed"
): string {
  const instructions: Record<
    "short" | "detailed" | "executive",
    string[]
  > = {
    short: [
      "Create a concise summary.",
      "Focus only on the most important information.",
      "Avoid unnecessary detail.",
    ],

    detailed: [
      "Preserve important context.",
      "Organize key findings clearly.",
      "Include important decisions and implications.",
    ],

    executive: [
      "Focus on strategic implications.",
      "Highlight risks and opportunities.",
      "Provide clear recommendations.",
      "Use executive-level language.",
    ],
  };

  return buildTaskPrompt({
    title: "Summarize Content",
    instructions: instructions[style],
    input: content,
  });
}

/**
 * Builds an execution prompt.
 */
export function buildExecutionPrompt(
  objective: string,
  context?: string
): string {
  return buildTaskPrompt({
    title: `Execution Plan: ${objective}`,
    instructions: [
      "Break the objective into concrete phases.",
      "Identify dependencies.",
      "Prioritize high-impact actions.",
      "Define measurable outcomes.",
      "Identify risks.",
      "Provide a realistic execution sequence.",
    ],
    context,
    outputFormat: `
1. Objective
2. Phase 1
3. Phase 2
4. Phase 3
5. Dependencies
6. Risks
7. KPIs
8. Immediate Next Actions
`.trim(),
  });
}

/**
 * Sanitizes prompt content.
 */
export function sanitizePromptInput(
  value: string,
  maxLength = 50000
): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Estimates prompt size approximately.
 */
export function estimatePromptTokens(
  text: string
): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

/**
 * Trims prompt content to an approximate token limit.
 */
export function trimPromptToTokenLimit(
  text: string,
  maxTokens: number
): string {
  if (!text) {
    return "";
  }

  const maxCharacters = maxTokens * 4;

  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, maxCharacters)}\n\n[Content truncated]`;
}

/**
 * Creates a production-ready AI request prompt.
 */
export function buildProductionPrompt(
  options: BuildPromptOptions
): {
  systemPrompt: string;
  messages: PromptMessage[];
  estimatedTokens: number;
} {
  const systemPrompt = buildBaseSystemPrompt(options);

  const messages = buildChatMessages(options);

  const fullText = messages
    .map(
      (message) =>
        `${message.role}: ${message.content}`
    )
    .join("\n");

  return {
    systemPrompt,
    messages,
    estimatedTokens: estimatePromptTokens(fullText),
  };
}

export default {
  CORE_SYSTEM_PROMPT,
  SAFETY_PROMPT,
  REASONING_GUIDELINES_PROMPT,
  OUTPUT_GUIDELINES_PROMPT,

  formatConversationHistory,
  formatMemory,
  formatKnowledge,
  formatMetadata,

  buildContextPrompt,
  buildBaseSystemPrompt,
  buildChatMessages,
  buildTaskPrompt,

  buildResearchPrompt,
  buildBusinessPrompt,
  buildArchitecturePrompt,
  buildCodingPrompt,
  buildDataAnalysisPrompt,
  buildDecisionPrompt,
  buildAgentHandoffPrompt,
  buildSummaryPrompt,
  buildExecutionPrompt,

  sanitizePromptInput,
  estimatePromptTokens,
  trimPromptToTokenLimit,
  buildProductionPrompt,
};