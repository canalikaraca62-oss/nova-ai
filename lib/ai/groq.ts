import type {
  AIMessage,
  AIMessageRole,
} from "./context";

/**
 * Groq API configuration.
 */
export interface GroqConfig {
  apiKey?: string;

  baseUrl?: string;

  defaultModel?: string;

  timeout?: number;

  maxRetries?: number;
}

/**
 * Supported model roles for the Groq API.
 */
export type GroqMessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

/**
 * Message sent to Groq.
 */
export interface GroqMessage {
  role: GroqMessageRole;

  content: string;
}

/**
 * Chat completion options.
 */
export interface GroqChatOptions {
  model?: string;

  temperature?: number;

  maxTokens?: number;

  topP?: number;

  stop?: string[];

  stream?: boolean;
}

/**
 * Simplified Groq completion result.
 */
export interface GroqChatResult {
  id: string;

  model: string;

  content: string;

  finishReason?: string;

  usage?: {
    promptTokens?: number;

    completionTokens?: number;

    totalTokens?: number;
  };

  raw: unknown;
}

/**
 * Groq API error.
 */
export class GroqError extends Error {
  public readonly status?: number;

  public readonly code?: string;

  public readonly details?: unknown;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      details?: unknown;
    }
  ) {
    super(message);

    this.name = "GroqError";

    this.status = options?.status;

    this.code = options?.code;

    this.details = options?.details;
  }
}

/**
 * Default Groq configuration.
 */
const DEFAULT_CONFIG: Required<
  Pick<
    GroqConfig,
    "baseUrl" | "defaultModel" | "timeout" | "maxRetries"
  >
> = {
  baseUrl: "https://api.groq.com/openai/v1",

  defaultModel:
    process.env.GROQ_MODEL ||
    "llama-3.3-70b-versatile",

  timeout: 120000,

  maxRetries: 2,
};

/**
 * Converts an internal AI message into
 * a Groq-compatible message.
 */
export function toGroqMessage(
  message: Pick<AIMessage, "role" | "content">
): GroqMessage {
  const roleMap: Record<
    AIMessageRole,
    GroqMessageRole
  > = {
    system: "system",
    user: "user",
    assistant: "assistant",
    tool: "tool",
  };

  return {
    role: roleMap[message.role],

    content: message.content,
  };
}

/**
 * Converts multiple internal messages
 * into Groq-compatible messages.
 */
export function toGroqMessages(
  messages: Array<
    Pick<AIMessage, "role" | "content">
  >
): GroqMessage[] {
  return messages.map(toGroqMessage);
}

/**
 * Safely waits for a number of milliseconds.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Returns a readable error message from
 * an unknown API response.
 */
function getErrorMessage(
  data: unknown
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data
  ) {
    const error = (
      data as {
        error?: unknown;
      }
    ).error;

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      const message = (
        error as {
          message?: unknown;
        }
      ).message;

      if (typeof message === "string") {
        return message;
      }
    }
  }

  return "Groq API request failed.";
}

/**
 * Groq AI client.
 *
 * Uses the OpenAI-compatible Groq API.
 */
export class GroqClient {
  private readonly apiKey: string;

  private readonly baseUrl: string;

  private readonly defaultModel: string;

  private readonly timeout: number;

  private readonly maxRetries: number;

  constructor(config: GroqConfig = {}) {
    const apiKey =
      config.apiKey ||
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new GroqError(
        "GROQ_API_KEY environment variable is not configured."
      );
    }

    this.apiKey = apiKey;

    this.baseUrl =
      config.baseUrl ||
      DEFAULT_CONFIG.baseUrl;

    this.defaultModel =
      config.defaultModel ||
      DEFAULT_CONFIG.defaultModel;

    this.timeout =
      config.timeout ??
      DEFAULT_CONFIG.timeout;

    this.maxRetries =
      config.maxRetries ??
      DEFAULT_CONFIG.maxRetries;
  }

  /**
   * Returns the configured default model.
   */
  getModel(): string {
    return this.defaultModel;
  }

  /**
   * Executes a request against Groq.
   */
  private async request<T>(
    path: string,
    body: unknown
  ): Promise<T> {
    const url =
      `${this.baseUrl.replace(/\/$/, "")}${path}`;

    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= this.maxRetries;
      attempt += 1
    ) {
      const controller =
        new AbortController();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.timeout);

      try {
        const response = await fetch(url, {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${this.apiKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(body),

          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data: unknown =
          await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            getErrorMessage(data);

          const error = new GroqError(
            message,
            {
              status: response.status,
              details: data,
            }
          );

          const shouldRetry =
            response.status === 429 ||
            response.status >= 500;

          if (
            !shouldRetry ||
            attempt === this.maxRetries
          ) {
            throw error;
          }

          lastError = error;

          await sleep(
            500 * Math.pow(2, attempt)
          );

          continue;
        }

        return data as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof GroqError) {
          if (
            attempt === this.maxRetries
          ) {
            throw error;
          }

          lastError = error;

          continue;
        }

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          lastError = new GroqError(
            `Groq request timed out after ${this.timeout}ms.`
          );
        } else {
          lastError = error;
        }

        if (
          attempt === this.maxRetries
        ) {
          break;
        }

        await sleep(
          500 * Math.pow(2, attempt)
        );
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new GroqError(
      "Groq API request failed after multiple attempts."
    );
  }

  /**
   * Creates a chat completion.
   */
  async chat(
    messages: GroqMessage[],
    options: GroqChatOptions = {}
  ): Promise<GroqChatResult> {
    if (messages.length === 0) {
      throw new GroqError(
        "At least one message is required."
      );
    }

    const payload = {
      model:
        options.model ||
        this.defaultModel,

      messages,

      temperature:
        options.temperature ?? 0.7,

      max_tokens:
        options.maxTokens,

      top_p:
        options.topP,

      stop:
        options.stop,

      stream: false,
    };

    interface GroqApiResponse {
      id?: string;

      model?: string;

      choices?: Array<{
        message?: {
          content?: string | null;
        };

        finish_reason?: string | null;
      }>;

      usage?: {
        prompt_tokens?: number;

        completion_tokens?: number;

        total_tokens?: number;
      };
    }

    const response =
      await this.request<GroqApiResponse>(
        "/chat/completions",
        payload
      );

    const choice =
      response.choices?.[0];

    const content =
      choice?.message?.content ?? "";

    if (!content) {
      throw new GroqError(
        "Groq returned an empty response.",
        {
          details: response,
        }
      );
    }

    return {
      id:
        response.id ||
        crypto.randomUUID(),

      model:
        response.model ||
        payload.model,

      content,

      finishReason:
        choice?.finish_reason ||
        undefined,

      usage: response.usage
        ? {
            promptTokens:
              response.usage.prompt_tokens,

            completionTokens:
              response.usage
                .completion_tokens,

            totalTokens:
              response.usage.total_tokens,
          }
        : undefined,

      raw: response,
    };
  }

  /**
   * Sends internal AI messages directly
   * to the Groq API.
   */
  async chatWithContext(
    messages: Array<
      Pick<AIMessage, "role" | "content">
    >,
    options: GroqChatOptions = {}
  ): Promise<GroqChatResult> {
    return this.chat(
      toGroqMessages(messages),
      options
    );
  }

  /**
   * Simple completion helper.
   */
  async complete(
    prompt: string,
    options: GroqChatOptions = {}
  ): Promise<GroqChatResult> {
    return this.chat(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      options
    );
  }
}

/**
 * Singleton client instance.
 *
 * The instance is created lazily to avoid
 * build-time failures when environment
 * variables are unavailable.
 */
let groqClientInstance:
  | GroqClient
  | null = null;

/**
 * Returns the shared Groq client.
 */
export function getGroqClient(): GroqClient {
  if (!groqClientInstance) {
    groqClientInstance =
      new GroqClient();
  }

  return groqClientInstance;
}

/**
 * Convenience helper for creating
 * a chat completion.
 */
export async function groqChat(
  messages: GroqMessage[],
  options: GroqChatOptions = {}
): Promise<GroqChatResult> {
  const client = getGroqClient();

  return client.chat(
    messages,
    options
  );
}

/**
 * Convenience helper for sending
 * a simple prompt.
 */
export async function groqComplete(
  prompt: string,
  options: GroqChatOptions = {}
): Promise<GroqChatResult> {
  const client = getGroqClient();

  return client.complete(
    prompt,
    options
  );
}

export default getGroqClient;