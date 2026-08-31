/**
 * Central AI model registry for SyraVen.
 *
 * This file contains model metadata and model-selection helpers.
 * It is intentionally provider-aware so agents can select the
 * correct model based on capability, speed and task complexity.
 */

export type AIProvider =
  | "groq"
  | "openai"
  | "anthropic"
  | "google"
  | "other";

export type AIModelCapability =
  | "chat"
  | "reasoning"
  | "coding"
  | "analysis"
  | "writing"
  | "research"
  | "vision"
  | "tool-use"
  | "structured-output"
  | "long-context";

export type AIModelTier =
  | "fast"
  | "balanced"
  | "powerful"
  | "reasoning";

export type AIModelStatus =
  | "active"
  | "deprecated"
  | "experimental";

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  tier: AIModelTier;
  status: AIModelStatus;
  capabilities: AIModelCapability[];
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  recommendedFor: string[];
  priority: number;
}

export interface AIModelSelectionOptions {
  provider?: AIProvider;
  capability?: AIModelCapability;
  tier?: AIModelTier;
  preferredModel?: string;
  excludeModels?: string[];
  requireTools?: boolean;
  requireVision?: boolean;
}

/**
 * Groq models used by the current AI infrastructure.
 *
 * IMPORTANT:
 * Model IDs must match the IDs sent to the provider API.
 */
export const AI_MODELS: readonly AIModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
    description:
      "High-quality general-purpose model for complex reasoning, writing, analysis and multi-agent orchestration.",
    tier: "powerful",
    status: "active",
    capabilities: [
      "chat",
      "reasoning",
      "analysis",
      "writing",
      "research",
      "tool-use",
      "structured-output",
      "long-context",
    ],
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    recommendedFor: [
      "complex reasoning",
      "multi-agent orchestration",
      "business strategy",
      "research analysis",
      "long-form writing",
      "planning",
    ],
    priority: 100,
  },

  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    provider: "groq",
    description:
      "Fast and efficient model for lightweight chat, classification, extraction and high-volume workloads.",
    tier: "fast",
    status: "active",
    capabilities: [
      "chat",
      "writing",
      "analysis",
      "structured-output",
    ],
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    recommendedFor: [
      "fast responses",
      "classification",
      "summarization",
      "data extraction",
      "simple writing",
    ],
    priority: 80,
  },

  {
    id: "qwen/qwen3-32b",
    name: "Qwen 3 32B",
    provider: "groq",
    description:
      "Advanced reasoning model suitable for complex analysis, coding assistance and structured problem solving.",
    tier: "reasoning",
    status: "active",
    capabilities: [
      "chat",
      "reasoning",
      "coding",
      "analysis",
      "writing",
      "structured-output",
      "tool-use",
    ],
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    recommendedFor: [
      "complex reasoning",
      "coding",
      "data analysis",
      "problem solving",
      "technical architecture",
    ],
    priority: 95,
  },

  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout",
    provider: "groq",
    description:
      "Multimodal-capable model designed for large-context analysis and advanced AI workflows.",
    tier: "balanced",
    status: "active",
    capabilities: [
      "chat",
      "reasoning",
      "analysis",
      "vision",
      "writing",
      "research",
      "long-context",
    ],
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsVision: true,
    supportsStreaming: true,
    recommendedFor: [
      "image understanding",
      "document analysis",
      "large context tasks",
      "research",
      "multimodal workflows",
    ],
    priority: 90,
  },
];

/**
 * Default model for the primary SyraVen AI system.
 */
export const DEFAULT_AI_MODEL_ID =
  "llama-3.3-70b-versatile";

/**
 * Fast model for lightweight operations.
 */
export const FAST_AI_MODEL_ID =
  "llama-3.1-8b-instant";

/**
 * Reasoning model for complex problem solving.
 */
export const REASONING_AI_MODEL_ID =
  "qwen/qwen3-32b";

/**
 * Returns all registered models.
 */
export function getAIModels(): AIModel[] {
  return [...AI_MODELS];
}

/**
 * Returns only active models.
 */
export function getActiveAIModels(): AIModel[] {
  return AI_MODELS.filter(
    (model) => model.status === "active",
  );
}

/**
 * Finds a model by its provider model ID.
 */
export function getAIModel(
  modelId: string,
): AIModel | undefined {
  return AI_MODELS.find(
    (model) => model.id === modelId,
  );
}

/**
 * Returns the default AI model.
 */
export function getDefaultAIModel(): AIModel {
  const model = getAIModel(
    DEFAULT_AI_MODEL_ID,
  );

  if (model === undefined) {
    throw new Error(
      `Default AI model "${DEFAULT_AI_MODEL_ID}" is not registered.`,
    );
  }

  return model;
}

/**
 * Returns the configured fast model.
 */
export function getFastAIModel(): AIModel {
  const model = getAIModel(
    FAST_AI_MODEL_ID,
  );

  if (model === undefined) {
    throw new Error(
      `Fast AI model "${FAST_AI_MODEL_ID}" is not registered.`,
    );
  }

  return model;
}

/**
 * Returns the configured reasoning model.
 */
export function getReasoningAIModel(): AIModel {
  const model = getAIModel(
    REASONING_AI_MODEL_ID,
  );

  if (model === undefined) {
    throw new Error(
      `Reasoning AI model "${REASONING_AI_MODEL_ID}" is not registered.`,
    );
  }

  return model;
}

/**
 * Filters models according to selection requirements.
 */
export function findAIModels(
  options: AIModelSelectionOptions = {},
): AIModel[] {
  const excludedModels =
    options.excludeModels ?? [];

  return getActiveAIModels()
    .filter((model) => {
      if (excludedModels.includes(model.id)) {
        return false;
      }

      if (
        options.provider !== undefined &&
        model.provider !== options.provider
      ) {
        return false;
      }

      if (
        options.tier !== undefined &&
        model.tier !== options.tier
      ) {
        return false;
      }

      if (
        options.capability !== undefined &&
        !model.capabilities.includes(
          options.capability,
        )
      ) {
        return false;
      }

      if (
        options.requireTools === true &&
        !model.supportsTools
      ) {
        return false;
      }

      if (
        options.requireVision === true &&
        !model.supportsVision
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        b.priority - a.priority,
    );
}

/**
 * Selects the most appropriate model for a task.
 */
export function selectAIModel(
  options: AIModelSelectionOptions = {},
): AIModel {
  if (options.preferredModel !== undefined) {
    const preferredModel = getAIModel(
      options.preferredModel,
    );

    if (
      preferredModel !== undefined &&
      preferredModel.status === "active"
    ) {
      return preferredModel;
    }
  }

  const candidates =
    findAIModels(options);

  const bestCandidate =
    candidates.at(0);

  if (bestCandidate !== undefined) {
    return bestCandidate;
  }

  return getDefaultAIModel();
}

/**
 * Selects a model optimized for speed.
 */
export function selectFastModel(): AIModel {
  const fastModels = findAIModels({
    tier: "fast",
  });

  const fastestModel =
    fastModels.at(0);

  if (fastestModel !== undefined) {
    return fastestModel;
  }

  return getFastAIModel();
}

/**
 * Selects a model optimized for reasoning.
 */
export function selectReasoningModel(): AIModel {
  const reasoningModels = findAIModels({
    capability: "reasoning",
  });

  const bestReasoningModel =
    reasoningModels.at(0);

  if (bestReasoningModel !== undefined) {
    return bestReasoningModel;
  }

  return getReasoningAIModel();
}

/**
 * Selects a model capable of vision tasks.
 */
export function selectVisionModel(): AIModel {
  const models = findAIModels({
    requireVision: true,
  });

  const visionModel =
    models.at(0);

  if (visionModel === undefined) {
    throw new Error(
      "No active vision-capable AI model is registered.",
    );
  }

  return visionModel;
}

/**
 * Selects a model capable of tool use.
 */
export function selectToolModel(): AIModel {
  const models = findAIModels({
    requireTools: true,
  });

  const toolModel =
    models.at(0);

  if (toolModel === undefined) {
    throw new Error(
      "No active tool-capable AI model is registered.",
    );
  }

  return toolModel;
}

/**
 * Returns true when a model supports a capability.
 */
export function modelSupportsCapability(
  model: AIModel,
  capability: AIModelCapability,
): boolean {
  return model.capabilities.includes(
    capability,
  );
}

/**
 * Returns true when a model can use tools.
 */
export function modelSupportsTools(
  model: AIModel,
): boolean {
  return model.supportsTools;
}

/**
 * Returns true when a model supports vision.
 */
export function modelSupportsVision(
  model: AIModel,
): boolean {
  return model.supportsVision;
}

/**
 * Returns the provider model ID.
 *
 * This is the value sent directly to the AI API.
 */
export function getProviderModelId(
  model: AIModel | string,
): string {
  if (typeof model === "string") {
    return model;
  }

  return model.id;
}

/**
 * Selects a model based on common task categories.
 */
export function selectModelForTask(
  task:
    | "chat"
    | "fast"
    | "reasoning"
    | "coding"
    | "analysis"
    | "writing"
    | "research"
    | "vision"
    | "tools",
): AIModel {
  switch (task) {
    case "fast":
      return selectFastModel();

    case "reasoning":
      return selectReasoningModel();

    case "vision":
      return selectVisionModel();

    case "tools":
      return selectToolModel();

    case "coding":
      return selectAIModel({
        capability: "coding",
      });

    case "analysis":
      return selectAIModel({
        capability: "analysis",
      });

    case "writing":
      return selectAIModel({
        capability: "writing",
      });

    case "research":
      return selectAIModel({
        capability: "research",
      });

    case "chat":
    default:
      return getDefaultAIModel();
  }
}

/**
 * Creates a lightweight serializable model summary.
 */
export function getAIModelSummary(
  model: AIModel,
) {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    tier: model.tier,
    status: model.status,
    capabilities: [...model.capabilities],
    supportsTools: model.supportsTools,
    supportsVision: model.supportsVision,
    supportsStreaming:
      model.supportsStreaming,
  };
}

export default AI_MODELS;