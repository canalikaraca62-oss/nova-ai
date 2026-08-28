import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==================================================
   NOVA / SYRAVEN OPENAI TEST API
   app/api/test-openai/route.ts
================================================== */

const OPENAI_API_URL =
  "https://api.openai.com/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-4o-mini";

const MAX_MESSAGE_LENGTH = 20_000;

type TestRequestBody = {
  message?: unknown;
  model?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChoice = {
  index?: number;
  message?: {
    role?: string;
    content?: string | null;
  };
  finish_reason?: string | null;
};

type OpenAIResponse = {
  id?: string;
  model?: string;
  created?: number;
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | null;
  };
};

/* ==================================================
   HELPERS
================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function getNumber(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return value;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function createJsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      success:
        status >= 200 &&
        status < 300,
      ...body,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

/* ==================================================
   OPENAI HEALTH CHECK
================================================== */

export async function GET() {
  const hasApiKey =
    Boolean(
      process.env.OPENAI_API_KEY?.trim()
    );

  return createJsonResponse({
    service: "openai",
    endpoint: "/api/test-openai",
    configured: hasApiKey,
    model: DEFAULT_MODEL,
    runtime: "nodejs",
    timestamp:
      new Date().toISOString(),
    message: hasApiKey
      ? "OpenAI API is configured and ready for testing."
      : "OPENAI_API_KEY is missing.",
  });
}

/* ==================================================
   OPENAI TEST REQUEST
================================================== */

export async function POST(
  request: NextRequest
) {
  const startedAt = Date.now();

  try {
    const apiKey =
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return createJsonResponse(
        {
          error: {
            code:
              "OPENAI_NOT_CONFIGURED",
            message:
              "OPENAI_API_KEY is not configured on the server.",
          },
          configured: false,
        },
        503
      );
    }

    let body: TestRequestBody = {};

    try {
      const parsedBody: unknown =
        await request.json();

      if (isRecord(parsedBody)) {
        body = parsedBody as TestRequestBody;
      }
    } catch {
      return createJsonResponse(
        {
          error: {
            code:
              "INVALID_JSON",
            message:
              "Request body must contain valid JSON.",
          },
        },
        400
      );
    }

    const requestedMessage =
      getString(body.message);

    const message =
      requestedMessage ??
      "Say hello and confirm that the OpenAI connection is working.";

    if (
      message.length >
      MAX_MESSAGE_LENGTH
    ) {
      return createJsonResponse(
        {
          error: {
            code:
              "MESSAGE_TOO_LONG",
            message:
              `Message must not exceed ${MAX_MESSAGE_LENGTH} characters.`,
          },
        },
        400
      );
    }

    const requestedModel =
      getString(body.model);

    const model =
      requestedModel ??
      DEFAULT_MODEL;

    const temperature =
      clamp(
        getNumber(
          body.temperature,
          0.7
        ),
        0,
        2
      );

    const maxTokens =
      Math.round(
        clamp(
          getNumber(
            body.maxTokens,
            500
          ),
          1,
          4096
        )
      );

    const messages: OpenAIMessage[] = [
      {
        role: "system",
        content:
          "You are the AI engine powering NOVA. Be concise, accurate, helpful, and professional.",
      },
      {
        role: "user",
        content: message,
      },
    ];

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        60_000
      );

    let response: Response;

    try {
      response = await fetch(
        OPENAI_API_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens:
              maxTokens,
          }),
          signal:
            controller.signal,
          cache: "no-store",
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    let data: OpenAIResponse = {};

    try {
      const parsedData: unknown =
        await response.json();

      if (isRecord(parsedData)) {
        data =
          parsedData as OpenAIResponse;
      }
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error(
        "NOVA OPENAI TEST ERROR:",
        {
          status:
            response.status,
          statusText:
            response.statusText,
          error:
            data.error?.message ??
            "Unknown OpenAI error",
          type:
            data.error?.type ??
            null,
          code:
            data.error?.code ??
            null,
        }
      );

      return createJsonResponse(
        {
          error: {
            code:
              "OPENAI_REQUEST_FAILED",
            message:
              data.error?.message ??
              "OpenAI request failed.",
            type:
              data.error?.type ??
              null,
            providerCode:
              data.error?.code ??
              null,
          },
          provider: "openai",
          model,
          status:
            response.status,
          latencyMs:
            Date.now() -
            startedAt,
        },
        response.status
      );
    }

    const firstChoice =
      data.choices?.[0];

    const content =
      firstChoice?.message?.content ??
      "";

    return createJsonResponse({
      provider: "openai",
      configured: true,
      model:
        data.model ??
        model,
      response: {
        id:
          data.id ??
          null,
        content,
        role:
          firstChoice?.message?.role ??
          "assistant",
        finishReason:
          firstChoice?.finish_reason ??
          null,
      },
      usage: {
        promptTokens:
          data.usage?.prompt_tokens ??
          null,
        completionTokens:
          data.usage?.completion_tokens ??
          null,
        totalTokens:
          data.usage?.total_tokens ??
          null,
      },
      latencyMs:
        Date.now() -
        startedAt,
      timestamp:
        new Date().toISOString(),
    });
  } catch (error) {
    const isAbortError =
      error instanceof Error &&
      error.name === "AbortError";

    console.error(
      "NOVA OPENAI TEST ROUTE ERROR:",
      error
    );

    return createJsonResponse(
      {
        error: {
          code: isAbortError
            ? "OPENAI_TIMEOUT"
            : "OPENAI_TEST_FAILED",
          message: isAbortError
            ? "The OpenAI request timed out."
            : "The OpenAI test request failed unexpectedly.",
        },
        latencyMs:
          Date.now() -
          startedAt,
      },
      isAbortError
        ? 504
        : 500
    );
  }
}

/* ==================================================
   UNSUPPORTED METHODS
================================================== */

export async function PUT() {
  return createJsonResponse(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "PUT is not supported on this endpoint.",
      },
    },
    405
  );
}

export async function PATCH() {
  return createJsonResponse(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "PATCH is not supported on this endpoint.",
      },
    },
    405
  );
}

export async function DELETE() {
  return createJsonResponse(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "DELETE is not supported on this endpoint.",
      },
    },
    405
  );
}