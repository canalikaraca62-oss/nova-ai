// ==================================================
// GROQ AI CLIENT
// Production-ready centralized AI client
// ==================================================

// ==================================================
// TYPES
// ==================================================

export type AIChatRole =
  | "system"
  | "user"
  | "assistant";

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
};

export type ReasoningEffort =
  | "low"
  | "medium"
  | "high";

type GroqUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;

  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

type GroqChoice = {
  finish_reason?: string | null;

  message?: {
    content?: string | null;
    reasoning?: string | null;
  };
};

type GroqResponse = {
  id?: string;
  model?: string;

  choices?: GroqChoice[];

  usage?: GroqUsage;

  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export type GroqRequestOptions = {
  model?: string;

  temperature?: number;

  topP?: number;

  maxTokens?: number;

  reasoningEffort?: ReasoningEffort;

  includeReasoning?: boolean;

  timeoutMs?: number;

  signal?: AbortSignal;
};

// ==================================================
// CONFIG
// ==================================================

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

const DEFAULT_MAX_TOKENS = 2200;

const DEFAULT_TIMEOUT_MS = 60_000;

const DEFAULT_MAX_RETRIES = 2;

const DEFAULT_TEMPERATURE = 0.7;

const DEFAULT_STREAM_TEMPERATURE = 0.6;

const DEFAULT_TOP_P = 0.95;

// ==================================================
// ERROR CLASS
// ==================================================

export class GroqError extends Error {
  readonly status: number;

  readonly retryable: boolean;

  readonly providerMessage?: string;

  constructor({
    message,
    status,
    retryable = false,
    providerMessage,
  }: {
    message: string;
    status: number;
    retryable?: boolean;
    providerMessage?: string;
  }) {
    super(message);

    this.name = "GroqError";

    this.status = status;

    this.retryable = retryable;

    this.providerMessage =
      providerMessage;

    Object.setPrototypeOf(
      this,
      GroqError.prototype
    );
  }
}

// ==================================================
// GET API KEY
// ==================================================

function getGroqApiKey(): string {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY bulunamadı."
    );
  }

  return apiKey;
}

// ==================================================
// VALIDATION
// ==================================================

function validateMessages(
  messages: AIChatMessage[]
): void {
  if (!Array.isArray(messages)) {
    throw new Error(
      "AI mesajları geçersiz."
    );
  }

  if (messages.length === 0) {
    throw new Error(
      "AI için en az bir mesaj gerekli."
    );
  }

  const validRoles: AIChatRole[] = [
    "system",
    "user",
    "assistant",
  ];

  for (const message of messages) {
    if (
      !message ||
      !validRoles.includes(
        message.role
      )
    ) {
      throw new Error(
        "Geçersiz AI mesaj rolü."
      );
    }

    if (
      typeof message.content !==
        "string"
    ) {
      throw new Error(
        "AI mesaj içeriği string olmalıdır."
      );
    }

    if (!message.content.trim()) {
      throw new Error(
        "Boş AI mesajı gönderilemez."
      );
    }
  }
}

function normalizeTemperature(
  value: number | undefined,
  fallback: number
): number {
  const result =
    value ?? fallback;

  if (
    !Number.isFinite(result) ||
    result < 0 ||
    result > 2
  ) {
    throw new Error(
      "temperature 0 ile 2 arasında olmalıdır."
    );
  }

  return result;
}

function normalizeTopP(
  value: number | undefined
): number {
  const result =
    value ?? DEFAULT_TOP_P;

  if (
    !Number.isFinite(result) ||
    result < 0 ||
    result > 1
  ) {
    throw new Error(
      "topP 0 ile 1 arasında olmalıdır."
    );
  }

  return result;
}

function normalizeMaxTokens(
  value: number | undefined
): number {
  const result =
    value ?? DEFAULT_MAX_TOKENS;

  if (
    !Number.isFinite(result) ||
    result <= 0
  ) {
    throw new Error(
      "maxTokens 0'dan büyük olmalıdır."
    );
  }

  return Math.floor(result);
}

// ==================================================
// ERROR PARSING
// ==================================================

function parseProviderError(
  errorText: string
): string | undefined {
  if (!errorText) {
    return undefined;
  }

  try {
    const parsed =
      JSON.parse(errorText) as GroqResponse;

    const message =
      parsed?.error?.message;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message.trim();
    }
  } catch {
    // JSON değilse provider mesajı
    // olarak kullanmıyoruz.
  }

  return undefined;
}

// ==================================================
// ERROR FACTORY
// ==================================================

function createGroqError(
  status: number,
  errorText: string
): GroqError {
  const providerMessage =
    parseProviderError(errorText);

  console.error(
    "GROQ API HATASI:",
    {
      status,
      providerMessage,
    }
  );

  switch (status) {
    case 400:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          "AI isteği geçersiz.",
      });

    case 401:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          "AI servis yetkilendirmesi başarısız.",
      });

    case 403:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          "AI servisine erişim izni yok.",
      });

    case 404:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          "AI modeli veya servis bulunamadı.",
      });

    case 413:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          "Gönderilen içerik model sınırını aştı.",
      });

    case 422:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          "AI isteği işlenemedi.",
      });

    case 429:
      return new GroqError({
        status,

        retryable: true,

        providerMessage,

        message:
          "AI kullanım limiti geçici olarak aşıldı.",
      });

    case 498:
      return new GroqError({
        status,

        retryable: true,

        providerMessage,

        message:
          "AI işlem kapasitesi geçici olarak dolu.",
      });

    case 500:
    case 502:
    case 503:
    case 504:
      return new GroqError({
        status,

        retryable: true,

        providerMessage,

        message:
          "AI servisi geçici olarak kullanılamıyor.",
      });

    default:
      return new GroqError({
        status,

        retryable: false,

        providerMessage,

        message:
          `AI servisi hata verdi. HTTP ${status}`,
      });
  }
}

// ==================================================
// SLEEP
// ==================================================

function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

// ==================================================
// RETRY DELAY
// ==================================================

function getRetryDelay(
  response: Response,
  attempt: number
): number {
  const retryAfter =
    response.headers.get(
      "retry-after"
    );

  if (retryAfter) {
    const seconds =
      Number(retryAfter);

    if (
      Number.isFinite(seconds) &&
      seconds > 0
    ) {
      return Math.min(
        seconds * 1000,
        30_000
      );
    }
  }

  // Exponential backoff + küçük random jitter
  const baseDelay =
    500 *
    Math.pow(
      2,
      attempt
    );

  const jitter =
    Math.floor(
      Math.random() * 250
    );

  return Math.min(
    baseDelay + jitter,
    10_000
  );
}

// ==================================================
// COMBINED ABORT SIGNAL
// ==================================================

function createRequestSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort(
          new Error(
            "Groq isteği zaman aşımına uğradı."
          )
        );
      },
      timeoutMs
    );

  const abortFromExternal =
    () => {
      controller.abort(
        externalSignal?.reason
      );
    };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        {
          once: true,
        }
      );
    }
  }

  return {
    signal:
      controller.signal,

    cleanup: () => {
      clearTimeout(timeout);

      if (externalSignal) {
        externalSignal.removeEventListener(
          "abort",
          abortFromExternal
        );
      }
    },
  };
}

// ==================================================
// BUILD REQUEST BODY
// ==================================================

function buildRequestBody(
  messages: AIChatMessage[],
  options: {
    model?: string;
    temperature: number;
    topP: number;
    maxTokens: number;
    reasoningEffort?: ReasoningEffort;
    includeReasoning?: boolean;
    stream: boolean;
  }
) {
  return {
    model:
      options.model ||
      DEFAULT_MODEL,

    messages,

    temperature:
      options.temperature,

    top_p:
      options.topP,

    max_completion_tokens:
      options.maxTokens,

    stream:
      options.stream,

    ...(options.reasoningEffort
      ? {
          reasoning_effort:
            options.reasoningEffort,
        }
      : {}),

    ...(typeof options.includeReasoning ===
    "boolean"
      ? {
          include_reasoning:
            options.includeReasoning,
        }
      : {}),
  };
}

// ==================================================
// FETCH GROQ
// ==================================================

async function fetchGroq(
  body: Record<string, unknown>,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    retries?: number;
  }
): Promise<Response> {
  const apiKey =
    getGroqApiKey();

  const timeoutMs =
    options?.timeoutMs ??
    DEFAULT_TIMEOUT_MS;

  const maxRetries =
    options?.retries ??
    DEFAULT_MAX_RETRIES;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    const {
      signal,
      cleanup,
    } =
      createRequestSignal(
        timeoutMs,
        options?.signal
      );

    try {
      const response =
        await fetch(
          GROQ_API_URL,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(body),

            signal,
          }
        );

      cleanup();

      if (response.ok) {
        return response;
      }

      const errorText =
        await response.text();

      const groqError =
        createGroqError(
          response.status,
          errorText
        );

      const canRetry =
        groqError.retryable &&
        attempt < maxRetries;

      if (!canRetry) {
        throw groqError;
      }

      const retryDelay =
        getRetryDelay(
          response,
          attempt
        );

      console.warn(
        "GROQ RETRY:",
        {
          attempt:
            attempt + 1,

          maxRetries,

          status:
            response.status,

          retryDelay,
        }
      );

      await sleep(
        retryDelay
      );
    } catch (error) {
      cleanup();

      if (
        error instanceof GroqError
      ) {
        throw error;
      }

      // Kullanıcı isteği iptal ettiyse
      // yeniden deneme yapma.
      if (
        options?.signal?.aborted
      ) {
        throw error;
      }

      // Network veya timeout hatası
      const isLastAttempt =
        attempt >= maxRetries;

      if (isLastAttempt) {
        console.error(
          "GROQ NETWORK/TIMEOUT HATASI:",
          error
        );

        throw new Error(
          "AI servisine bağlanırken hata oluştu."
        );
      }

      const retryDelay =
        Math.min(
          500 *
            Math.pow(
              2,
              attempt
            ) +
            Math.floor(
              Math.random() * 250
            ),
          10_000
        );

      console.warn(
        "GROQ NETWORK RETRY:",
        {
          attempt:
            attempt + 1,

          maxRetries,

          retryDelay,
        }
      );

      await sleep(
        retryDelay
      );
    }
  }

  throw new Error(
    "AI isteği tamamlanamadı."
  );
}

// ==================================================
// NORMAL AI REQUEST
// ==================================================

export async function callGroq(
  messages: AIChatMessage[],
  options?: GroqRequestOptions
): Promise<string> {
  validateMessages(
    messages
  );

  const temperature =
    normalizeTemperature(
      options?.temperature,
      DEFAULT_TEMPERATURE
    );

  const topP =
    normalizeTopP(
      options?.topP
    );

  const maxTokens =
    normalizeMaxTokens(
      options?.maxTokens
    );

  const response =
    await fetchGroq(
      buildRequestBody(
        messages,
        {
          model:
            options?.model,

          temperature,

          topP,

          maxTokens,

          reasoningEffort:
            options?.reasoningEffort,

          includeReasoning:
            options?.includeReasoning ??
            false,

          stream: false,
        }
      ),
      {
        timeoutMs:
          options?.timeoutMs,

        signal:
          options?.signal,
      }
    );

  const data =
    await response.json() as GroqResponse;

  const choice =
    data?.choices?.[0];

  const content =
    choice?.message?.content;

  if (
    typeof content === "string" &&
    content.trim()
  ) {
    return content.trim();
  }

  const finishReason =
    choice?.finish_reason;

  console.error(
    "GROQ BOŞ CEVAP:",
    {
      requestId:
        data?.id,

      model:
        data?.model,

      finishReason,

      usage:
        data?.usage,
    }
  );

  if (
    finishReason ===
    "length"
  ) {
    throw new GroqError({
      status: 200,

      retryable: false,

      message:
        "AI cevap üretmeden önce çıktı token limitine ulaştı.",
    });
  }

  throw new GroqError({
    status: 200,

    retryable: false,

    message:
      "AI boş bir cevap döndürdü.",
  });
}

// ==================================================
// STREAM AI REQUEST
// ==================================================

export async function streamGroq(
  messages: AIChatMessage[],
  options?: GroqRequestOptions
): Promise<Response> {
  validateMessages(
    messages
  );

  const temperature =
    normalizeTemperature(
      options?.temperature,
      DEFAULT_STREAM_TEMPERATURE
    );

  const topP =
    normalizeTopP(
      options?.topP
    );

  const maxTokens =
    normalizeMaxTokens(
      options?.maxTokens
    );

  const response =
    await fetchGroq(
      buildRequestBody(
        messages,
        {
          model:
            options?.model,

          temperature,

          topP,

          maxTokens,

          reasoningEffort:
            options?.reasoningEffort,

          includeReasoning:
            options?.includeReasoning ??
            false,

          stream: true,
        }
      ),
      {
        timeoutMs:
          options?.timeoutMs,

        signal:
          options?.signal,

        // Stream bağlantısı kurulmadan
        // oluşan geçici hatalarda retry yapılır.
        retries:
          DEFAULT_MAX_RETRIES,
      }
    );

  if (!response.body) {
    throw new GroqError({
      status: 500,

      retryable: false,

      message:
        "AI stream body bulunamadı.",
    });
  }

  return response;
}

// ==================================================
// CONVENIENCE HELPERS
// ==================================================

export async function callGroqFast(
  messages: AIChatMessage[],
  options?: Omit<
    GroqRequestOptions,
    "model"
  >
): Promise<string> {
  const fastModel =
    process.env.GROQ_FAST_MODEL;

  return callGroq(
    messages,
    {
      ...options,

      ...(fastModel
        ? {
            model:
              fastModel,
          }
        : {}),
    }
  );
}

// ==================================================
// EXPORT CONFIG
// ==================================================

export const groqConfig = {
  apiUrl:
    GROQ_API_URL,

  defaultModel:
    DEFAULT_MODEL,

  defaultMaxTokens:
    DEFAULT_MAX_TOKENS,

  defaultTimeoutMs:
    DEFAULT_TIMEOUT_MS,
};