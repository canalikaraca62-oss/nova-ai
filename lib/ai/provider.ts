/**
 * SYRAVEN — AI provider adapter
 * lib/ai/provider.ts
 *
 * Phase 7 (see IMPLEMENTATION_PLAN.md).
 *
 * The single place that talks to an AI provider over the wire.
 *
 * WHY
 *
 * Before Phase 7, six routes each built their own fetch call with their
 * own base URL, timeout, error handling and fallback chain, and a
 * seventh used the OpenAI SDK directly. The behaviour differed per
 * route: `/api/chat` had a 120s timeout, `/api/agents/execute` passed
 * `request.signal` (client-controlled, so no server-side bound at all),
 * and none had a retry policy.
 *
 * SCOPE — deliberately small
 *
 * This is a transport adapter, not a framework. It sends a chat
 * completion, applies a timeout, retries once on a transient failure,
 * and normalises the error. Business logic stays in the routes.
 *
 * OpenAI and Groq share the OpenAI-compatible `/chat/completions`
 * schema, so one adapter serves both today. A provider with a different
 * wire format would add a sibling adapter behind the same
 * `ChatCompletionResult` type — no route would change.
 */

import "server-only";

import {
  type ModelDefinition,
  PROVIDER_ENDPOINTS,
  providerApiKey,
} from "./registry";

/* -------------------------------------------------------------------------- */
/*                                  POLICY                                    */
/* -------------------------------------------------------------------------- */

/**
 * Server-side request policy. None of these are client-controllable.
 */
export const AI_REQUEST_POLICY = {
  /**
   * Wall-clock ceiling for a single provider call.
   *
   * Matches the 120s already used by /api/chat, and replaces
   * /api/agents/execute passing the caller's own AbortSignal — which
   * meant a client could hold a request open indefinitely.
   */
  timeoutMs: 120_000,

  /**
   * Retries after the first attempt.
   *
   * ONE. Bounded deliberately: an unbounded or aggressive retry against
   * a paid provider multiplies cost during an outage, and a completion
   * that already reached the model may be billed even if the response
   * never arrived.
   */
  maxRetries: 1,

  /** Delay before the single retry. */
  retryDelayMs: 500,

  /**
   * Only these HTTP statuses are retried.
   *
   * 429 and 5xx are transient. A 400 or 401 is deterministic — retrying
   * it wastes time and, for 429, can deepen a rate-limit penalty.
   */
  retryableStatuses: [429, 500, 502, 503, 504] as readonly number[],
} as const;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  readonly model: ModelDefinition;
  readonly messages: readonly ChatMessage[];
  readonly maxTokens: number;
  readonly temperature: number;
  readonly stream?: boolean;
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

/**
 * A normalised provider failure.
 *
 * `AI_ERROR_KINDS` are the only shapes a route has to handle, whichever
 * provider produced them.
 */
export type AiErrorKind =
  | "NOT_CONFIGURED"
  | "AUTHENTICATION"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "EMPTY_RESPONSE";

export interface AiError {
  kind: AiErrorKind;
  /**
   * Safe to return to a client. Contains no provider internals, no key
   * material, and no stack trace.
   */
  clientMessage: string;
  /** HTTP status a route should reply with. */
  status: number;
}

export type ChatCompletionResult =
  | {
      ok: true;
      content: string;
      usage: TokenUsage;
      modelId: string;
    }
  | { ok: false; error: AiError };

export type ChatStreamResult =
  | { ok: true; body: ReadableStream<Uint8Array>; modelId: string }
  | { ok: false; error: AiError };

/* -------------------------------------------------------------------------- */
/*                            ERROR NORMALISATION                             */
/* -------------------------------------------------------------------------- */

/**
 * Maps a provider HTTP status onto an application error.
 *
 * The provider's own message body is deliberately NOT forwarded: it can
 * contain organisation ids, quota details, and occasionally echoes of the
 * request. It is logged server-side instead.
 */
export function normalizeHttpError(status: number): AiError {
  if (status === 401 || status === 403) {
    /*
     * The PROVIDER rejected our credentials. This is a server
     * misconfiguration, never the caller's fault, so it must not surface
     * as a 401 to the client — that would imply their session is bad.
     */
    return {
      kind: "AUTHENTICATION",
      clientMessage: "The AI service is unavailable.",
      status: 503,
    };
  }

  if (status === 429) {
    return {
      kind: "RATE_LIMITED",
      clientMessage: "The AI service is busy. Please try again shortly.",
      status: 503,
    };
  }

  if (status === 400 || status === 422) {
    return {
      kind: "INVALID_REQUEST",
      clientMessage: "The AI request could not be processed.",
      status: 400,
    };
  }

  return {
    kind: "PROVIDER_ERROR",
    clientMessage: "The AI service could not complete this request.",
    status: 502,
  };
}

export const TIMEOUT_ERROR: AiError = {
  kind: "TIMEOUT",
  clientMessage: "The AI request timed out. Please try again.",
  status: 504,
};

export const NOT_CONFIGURED_ERROR: AiError = {
  kind: "NOT_CONFIGURED",
  clientMessage: "The AI service is not configured.",
  status: 503,
};

export const EMPTY_RESPONSE_ERROR: AiError = {
  kind: "EMPTY_RESPONSE",
  clientMessage: "The AI service returned an empty response.",
  status: 502,
};

/* -------------------------------------------------------------------------- */
/*                                 TRANSPORT                                  */
/* -------------------------------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs one provider call with a server-side timeout.
 */
async function callProvider(
  request: ChatCompletionRequest,
  apiKey: string,
): Promise<Response> {
  const endpoint = PROVIDER_ENDPOINTS[request.model.provider];

  return fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      model: request.model.id,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: request.stream === true,
    }),

    /*
     * A SERVER-owned timeout. Routes must not pass the caller's signal
     * here: that would let a client hold a provider connection open for
     * as long as it liked.
     */
    signal: AbortSignal.timeout(AI_REQUEST_POLICY.timeoutMs),
  });
}

/**
 * Sends a request, retrying once on a transient failure.
 *
 * Returns the raw Response so the caller can decide whether to read it
 * as JSON or hand back a stream.
 */
async function sendWithRetry(
  request: ChatCompletionRequest,
  apiKey: string,
): Promise<{ response: Response } | { error: AiError }> {
  let attempt = 0;

  for (;;) {
    try {
      const response = await callProvider(request, apiKey);

      if (response.ok) return { response };

      const retryable = AI_REQUEST_POLICY.retryableStatuses.includes(
        response.status,
      );

      if (!retryable || attempt >= AI_REQUEST_POLICY.maxRetries) {
        /* Log the provider's own body server-side only. */
        const detail = await response.text().catch(() => "");

        console.error("SYRAVEN AI: provider error.", {
          provider: request.model.provider,
          model: request.model.id,
          status: response.status,
          detail: detail.slice(0, 500),
        });

        return { error: normalizeHttpError(response.status) };
      }
    } catch (cause) {
      const isTimeout =
        cause instanceof Error &&
        (cause.name === "TimeoutError" || cause.name === "AbortError");

      if (isTimeout || attempt >= AI_REQUEST_POLICY.maxRetries) {
        console.error("SYRAVEN AI: provider call failed.", {
          provider: request.model.provider,
          model: request.model.id,
          name: cause instanceof Error ? cause.name : "unknown",
        });

        return {
          error: isTimeout
            ? TIMEOUT_ERROR
            : {
                kind: "PROVIDER_ERROR",
                clientMessage:
                  "The AI service could not complete this request.",
                status: 502,
              },
        };
      }
    }

    attempt += 1;

    await sleep(AI_REQUEST_POLICY.retryDelayMs);
  }
}

/* -------------------------------------------------------------------------- */
/*                            PUBLIC OPERATIONS                               */
/* -------------------------------------------------------------------------- */

/**
 * Requests a non-streaming chat completion.
 */
export async function chatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const apiKey = providerApiKey(request.model.provider);

  if (apiKey === null) {
    return { ok: false, error: NOT_CONFIGURED_ERROR };
  }

  const sent = await sendWithRetry(
    { ...request, stream: false },
    apiKey,
  );

  if ("error" in sent) return { ok: false, error: sent.error };

  let payload: unknown;

  try {
    payload = await sent.response.json();
  } catch {
    return { ok: false, error: EMPTY_RESPONSE_ERROR };
  }

  const parsed = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
      total_tokens?: unknown;
    };
  };

  const content = parsed.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, error: EMPTY_RESPONSE_ERROR };
  }

  return {
    ok: true,
    content: content.trim(),
    modelId: request.model.id,
    usage: {
      /*
       * Reported as null when the provider omits them, never as 0.
       * Zero would be a false measurement; null says "not measured",
       * which is what the usage recorder needs to know.
       */
      promptTokens: numberOrNull(parsed.usage?.prompt_tokens),
      completionTokens: numberOrNull(parsed.usage?.completion_tokens),
      totalTokens: numberOrNull(parsed.usage?.total_tokens),
    },
  };
}

/**
 * Requests a streaming chat completion.
 *
 * Returns the provider's raw body so the route can transform it. Token
 * usage is NOT available up front for a stream — callers must record the
 * operation without counts rather than inventing them.
 */
export async function chatCompletionStream(
  request: ChatCompletionRequest,
): Promise<ChatStreamResult> {
  const apiKey = providerApiKey(request.model.provider);

  if (apiKey === null) {
    return { ok: false, error: NOT_CONFIGURED_ERROR };
  }

  const sent = await sendWithRetry({ ...request, stream: true }, apiKey);

  if ("error" in sent) return { ok: false, error: sent.error };

  const body = sent.response.body;

  if (!body) {
    return { ok: false, error: EMPTY_RESPONSE_ERROR };
  }

  return { ok: true, body, modelId: request.model.id };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value < 0 ? null : Math.floor(value);
}
