/**
 * SYRAVEN AI Server
 *
 * Central server-side AI orchestration layer.
 *
 * Responsibilities:
 * - Server-only AI execution
 * - Request validation
 * - Model/provider abstraction
 * - Timeout handling
 * - Cancellation support
 * - Structured execution results
 * - Execution metrics
 * - Safe error normalization
 */

import type {
  AgentExecutionResult,
  AgentId,
} from "./agents";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AIProvider =
  | "groq"
  | "openai"
  | "anthropic"
  | "google"
  | "custom";

export type AIMessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIExecutionContext {
  userId?: string;
  organizationId?: string;
  projectId?: string;
  conversationId?: string;
  requestId?: string;
  agentId?: AgentId;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface AIRequest {
  messages: AIMessage[];

  model?: string;

  provider?: AIProvider;

  systemPrompt?: string;

  temperature?: number;

  maxTokens?: number;

  timeoutMs?: number;

  context?: AIExecutionContext;

  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  id: string;

  provider: AIProvider;

  model: string;

  content: string;

  usage?: AIUsage;

  finishReason?: string;

  metadata?: Record<string, unknown>;
}

export interface AIExecutionSuccess {
  success: true;

  status: "completed";

  data: AIResponse;

  startedAt: string;

  completedAt: string;

  durationMs: number;

  error?: never;
}

export interface AIExecutionFailure {
  success: false;

  status:
    | "failed"
    | "timeout"
    | "cancelled";

  data?: never;

  error: {
    message: string;
    code?: string;
    details?: unknown;
    retryable?: boolean;
  };

  startedAt: string;

  completedAt: string;

  durationMs: number;
}

export type AIExecutionResult =
  | AIExecutionSuccess
  | AIExecutionFailure;

/* -------------------------------------------------------------------------- */
/*                              PROVIDER TYPES                                */
/* -------------------------------------------------------------------------- */

export interface AIProviderRequest {
  messages: AIMessage[];

  model: string;

  systemPrompt?: string;

  temperature?: number;

  maxTokens?: number;

  signal?: AbortSignal;

  metadata?: Record<string, unknown>;
}

export interface AIProviderResponse {
  content: string;

  model?: string;

  usage?: AIUsage;

  finishReason?: string;

  metadata?: Record<string, unknown>;
}

export interface AIProviderAdapter {
  readonly provider: AIProvider;

  generate(
    request: AIProviderRequest
  ): Promise<AIProviderResponse>;
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_AI_TIMEOUT_MS = 60_000;

export const MAX_AI_TIMEOUT_MS = 300_000;

export const DEFAULT_AI_TEMPERATURE = 0.7;

export const DEFAULT_AI_MAX_TOKENS = 4_096;

export const MAX_AI_MESSAGES = 200;

export const MAX_MESSAGE_LENGTH = 100_000;

/* -------------------------------------------------------------------------- */
/*                                  ERRORS                                    */
/* -------------------------------------------------------------------------- */

export class AIServerError extends Error {
  public readonly code: string;

  public readonly details?: unknown;

  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options?: {
      details?: unknown;
      retryable?: boolean;
    }
  ) {
    super(message);

    this.name = "AIServerError";
    this.code = code;
    this.details = options?.details;
    this.retryable =
      options?.retryable ?? false;
  }
}

/* -------------------------------------------------------------------------- */
/*                              UTILITY FUNCTIONS                             */
/* -------------------------------------------------------------------------- */

function createAIRequestId(): string {
  const uuid =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID ===
      "function"
      ? globalThis.crypto.randomUUID()
      : Math.random()
          .toString(36)
          .slice(2);

  return `ai_${Date.now()}_${uuid}`;
}

function normalizeTimeout(
  value?: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return DEFAULT_AI_TIMEOUT_MS;
  }

  return Math.min(
    Math.floor(value),
    MAX_AI_TIMEOUT_MS
  );
}

function normalizeTemperature(
  value?: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_AI_TEMPERATURE;
  }

  return Math.max(
    0,
    Math.min(2, value)
  );
}

function normalizeMaxTokens(
  value?: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return DEFAULT_AI_MAX_TOKENS;
  }

  return Math.floor(value);
}

function normalizeError(
  error: unknown
): {
  message: string;
  code?: string;
  details?: unknown;
  retryable?: boolean;
} {
  if (error instanceof AIServerError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      details: {
        name: error.name,
      },
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  return {
    message: "Unknown AI server error",
    details: error,
  };
}

function validateMessages(
  messages: AIMessage[]
): void {
  if (!Array.isArray(messages)) {
    throw new AIServerError(
      "Messages must be an array",
      "INVALID_MESSAGES"
    );
  }

  if (messages.length === 0) {
    throw new AIServerError(
      "At least one message is required",
      "EMPTY_MESSAGES"
    );
  }

  if (messages.length > MAX_AI_MESSAGES) {
    throw new AIServerError(
      `Too many messages. Maximum is ${MAX_AI_MESSAGES}`,
      "TOO_MANY_MESSAGES"
    );
  }

  for (const message of messages) {
    if (
      !message ||
      typeof message !== "object"
    ) {
      throw new AIServerError(
        "Invalid message",
        "INVALID_MESSAGE"
      );
    }

    if (
      ![
        "system",
        "user",
        "assistant",
        "tool",
      ].includes(message.role)
    ) {
      throw new AIServerError(
        `Invalid message role: ${String(
          message.role
        )}`,
        "INVALID_MESSAGE_ROLE"
      );
    }

    if (
      typeof message.content !== "string"
    ) {
      throw new AIServerError(
        "Message content must be a string",
        "INVALID_MESSAGE_CONTENT"
      );
    }

    if (
      message.content.length >
      MAX_MESSAGE_LENGTH
    ) {
      throw new AIServerError(
        `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`,
        "MESSAGE_TOO_LARGE"
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                               AI SERVER                                    */
/* -------------------------------------------------------------------------- */

export class AIServer {
  private readonly providers =
    new Map<
      AIProvider,
      AIProviderAdapter
    >();

  /**
   * Register a provider adapter.
   */
  registerProvider(
    adapter: AIProviderAdapter
  ): this {
    if (
      !adapter ||
      typeof adapter !== "object"
    ) {
      throw new AIServerError(
        "Provider adapter is required",
        "INVALID_PROVIDER"
      );
    }

    if (
      typeof adapter.provider !== "string" ||
      !adapter.provider.trim()
    ) {
      throw new AIServerError(
        "Provider name is required",
        "INVALID_PROVIDER_NAME"
      );
    }

    if (
      typeof adapter.generate !== "function"
    ) {
      throw new AIServerError(
        "Provider generate function is required",
        "INVALID_PROVIDER_ADAPTER"
      );
    }

    this.providers.set(
      adapter.provider,
      adapter
    );

    return this;
  }

  /**
   * Remove a provider.
   */
  unregisterProvider(
    provider: AIProvider
  ): boolean {
    return this.providers.delete(provider);
  }

  /**
   * Check provider availability.
   */
  hasProvider(
    provider: AIProvider
  ): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get provider.
   */
  getProvider(
    provider: AIProvider
  ): AIProviderAdapter | undefined {
    return this.providers.get(provider);
  }

  /**
   * List providers.
   */
  listProviders(): AIProvider[] {
    return Array.from(
      this.providers.keys()
    );
  }

  /**
   * Execute an AI request.
   */
  async generate(
    request: AIRequest
  ): Promise<AIExecutionResult> {
    const startedAt =
      new Date().toISOString();

    const startedTimestamp =
      Date.now();

    let timeoutHandle:
      | ReturnType<typeof setTimeout>
      | undefined;

    let externalAbortListener:
      | (() => void)
      | undefined;

    try {
      validateMessages(request.messages);

      const providerName =
        request.provider ?? "groq";

      const provider =
        this.providers.get(providerName);

      if (!provider) {
        throw new AIServerError(
          `AI provider "${providerName}" is not registered`,
          "PROVIDER_NOT_FOUND"
        );
      }

      const model =
        request.model?.trim();

      if (!model) {
        throw new AIServerError(
          "AI model is required",
          "MODEL_REQUIRED"
        );
      }

      const controller =
        new AbortController();

      const timeoutMs =
        normalizeTimeout(
          request.timeoutMs
        );

      const externalSignal =
        request.context?.signal;

      if (externalSignal) {
        externalAbortListener = () => {
          controller.abort();
        };

        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener(
            "abort",
            externalAbortListener,
            { once: true }
          );
        }
      }

      timeoutHandle = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      const messages = [
        ...(request.systemPrompt
          ? [
              {
                role: "system" as const,
                content:
                  request.systemPrompt,
              },
            ]
          : []),
        ...request.messages,
      ];

      const response =
        await provider.generate({
          messages,
          model,
          temperature:
            normalizeTemperature(
              request.temperature
            ),
          maxTokens:
            normalizeMaxTokens(
              request.maxTokens
            ),
          signal: controller.signal,
          metadata: request.metadata,
        });

      if (
        typeof response.content !== "string"
      ) {
        throw new AIServerError(
          "AI provider returned invalid content",
          "INVALID_PROVIDER_RESPONSE"
        );
      }

      const completedAt =
        new Date().toISOString();

      const durationMs =
        Date.now() -
        startedTimestamp;

      return {
        success: true,
        status: "completed",
        data: {
          id: createAIRequestId(),
          provider: providerName,
          model:
            response.model ?? model,
          content: response.content,
          usage: response.usage,
          finishReason:
            response.finishReason,
          metadata:
            response.metadata,
        },
        startedAt,
        completedAt,
        durationMs,
      };
    } catch (error) {
      const completedAt =
        new Date().toISOString();

      const durationMs =
        Date.now() -
        startedTimestamp;

      const normalized =
        normalizeError(error);

      const isAbortError =
        error instanceof Error &&
        (
          error.name === "AbortError" ||
          error.name === "TimeoutError"
        );

      const status:
        | "failed"
        | "timeout"
        | "cancelled" =
        isAbortError
          ? durationMs >=
            normalizeTimeout(
              request.timeoutMs
            )
            ? "timeout"
            : "cancelled"
          : "failed";

      return {
        success: false,
        status,
        error: {
          ...normalized,
          code:
            normalized.code ??
            (
              status === "timeout"
                ? "AI_TIMEOUT"
                : status === "cancelled"
                  ? "AI_CANCELLED"
                  : "AI_EXECUTION_FAILED"
            ),
          retryable:
            normalized.retryable ??
            status === "failed",
        },
        startedAt,
        completedAt,
        durationMs,
      };
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear();
  }
}

/* -------------------------------------------------------------------------- */
/*                              SINGLETON INSTANCE                            */
/* -------------------------------------------------------------------------- */

export const aiServer =
  new AIServer();

export default aiServer;

/* -------------------------------------------------------------------------- */
/*                                TYPE GUARDS                                 */
/* -------------------------------------------------------------------------- */

export function isAIExecutionSuccess(
  result: AIExecutionResult
): result is AIExecutionSuccess {
  return result.success === true;
}

export function isAIExecutionFailure(
  result: AIExecutionResult
): result is AIExecutionFailure {
  return result.success === false;
}

/* -------------------------------------------------------------------------- */
/*                         OPTIONAL AGENT BRIDGE TYPE                         */
/* -------------------------------------------------------------------------- */

/**
 * Utility type for systems that combine
 * agent execution with AI execution.
 */
export type AIOrAgentExecutionResult<T = unknown> =
  | AIExecutionResult
  | AgentExecutionResult<T>;