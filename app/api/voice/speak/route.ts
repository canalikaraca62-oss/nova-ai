import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==================================================
   NOVA VOICE SPEAK API
   app/api/voice/speak/route.ts

   Text -> Speech endpoint

   Supports:
   - OpenAI TTS
   - Input validation
   - Voice selection
   - Audio format selection
   - Speed control
   - Timeout protection
   - Safe error handling
================================================== */

const OPENAI_TTS_URL =
  "https://api.openai.com/v1/audio/speech";

const DEFAULT_MODEL =
  process.env.OPENAI_TTS_MODEL?.trim() ||
  "gpt-4o-mini-tts";

const DEFAULT_VOICE =
  "alloy";

const DEFAULT_FORMAT =
  "mp3";

const MAX_TEXT_LENGTH =
  10_000;

const REQUEST_TIMEOUT =
  60_000;

/* ==================================================
   TYPES
================================================== */

type VoiceName =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer"
  | "verse";

type AudioFormat =
  | "mp3"
  | "opus"
  | "aac"
  | "flac"
  | "wav"
  | "pcm";

type SpeakRequestBody = {
  text?: unknown;
  voice?: unknown;
  model?: unknown;
  format?: unknown;
  speed?: unknown;
};

/* ==================================================
   ALLOWED VALUES
================================================== */

const ALLOWED_VOICES:
  readonly VoiceName[] = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
  ];

const ALLOWED_FORMATS:
  readonly AudioFormat[] = [
    "mp3",
    "opus",
    "aac",
    "flac",
    "wav",
    "pcm",
  ];

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
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

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

function isVoiceName(
  value: string
): value is VoiceName {
  return (
    ALLOWED_VOICES as readonly string[]
  ).includes(value);
}

function isAudioFormat(
  value: string
): value is AudioFormat {
  return (
    ALLOWED_FORMATS as readonly string[]
  ).includes(value);
}

function getContentType(
  format: AudioFormat
): string {
  switch (format) {
    case "opus":
      return "audio/ogg";

    case "aac":
      return "audio/aac";

    case "flac":
      return "audio/flac";

    case "wav":
      return "audio/wav";

    case "pcm":
      return "audio/L16";

    case "mp3":
    default:
      return "audio/mpeg";
  }
}

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      success:
        status >= 200 &&
        status < 300,
      ...data,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma:
          "no-cache",
        Expires:
          "0",
      },
    }
  );
}

/* ==================================================
   HEALTH / CAPABILITIES
================================================== */

export async function GET() {
  const configured =
    Boolean(
      process.env.OPENAI_API_KEY?.trim()
    );

  return json({
    service: "voice-speak",
    endpoint:
      "/api/voice/speak",
    configured,
    provider: "openai",
    model:
      DEFAULT_MODEL,
    capabilities: {
      textToSpeech: true,
      streaming: false,
      maxTextLength:
        MAX_TEXT_LENGTH,
      voices:
        ALLOWED_VOICES,
      formats:
        ALLOWED_FORMATS,
      speed: {
        min: 0.25,
        max: 4,
        default: 1,
      },
    },
    timestamp:
      new Date().toISOString(),
  });
}

/* ==================================================
   TEXT TO SPEECH
================================================== */

export async function POST(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    const apiKey =
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return json(
        {
          error: {
            code:
              "OPENAI_NOT_CONFIGURED",
            message:
              "OPENAI_API_KEY is not configured.",
          },
        },
        503
      );
    }

    let body:
      SpeakRequestBody = {};

    try {
      const parsed:
        unknown =
        await request.json();

      if (
        isRecord(parsed)
      ) {
        body =
          parsed as SpeakRequestBody;
      }
    } catch {
      return json(
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

    const text =
      getString(
        body.text
      );

    if (!text) {
      return json(
        {
          error: {
            code:
              "TEXT_REQUIRED",
            message:
              "A non-empty text value is required.",
          },
        },
        400
      );
    }

    if (
      text.length >
      MAX_TEXT_LENGTH
    ) {
      return json(
        {
          error: {
            code:
              "TEXT_TOO_LONG",
            message:
              `Text must not exceed ${MAX_TEXT_LENGTH} characters.`,
          },
        },
        400
      );
    }

    const requestedVoice =
      getString(
        body.voice
      )?.toLowerCase();

    const voice:
      VoiceName =
      requestedVoice &&
      isVoiceName(
        requestedVoice
      )
        ? requestedVoice
        : DEFAULT_VOICE;

    const requestedFormat =
      getString(
        body.format
      )?.toLowerCase();

    const format:
      AudioFormat =
      requestedFormat &&
      isAudioFormat(
        requestedFormat
      )
        ? requestedFormat
        : DEFAULT_FORMAT;

    const requestedModel =
      getString(
        body.model
      );

    const model =
      requestedModel ??
      DEFAULT_MODEL;

    const speed =
      clamp(
        getNumber(
          body.speed,
          1
        ),
        0.25,
        4
      );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        REQUEST_TIMEOUT
      );

    let response:
      Response;

    try {
      response =
        await fetch(
          OPENAI_TTS_URL,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",

              Accept:
                getContentType(
                  format
                ),
            },

            body:
              JSON.stringify({
                model,
                voice,
                input:
                  text,
                response_format:
                  format,
                speed,
              }),

            signal:
              controller.signal,

            cache:
              "no-store",
          }
        );
    } finally {
      clearTimeout(
        timeout
      );
    }

    if (
      !response.ok
    ) {
      let providerError:
        Record<
          string,
          unknown
        > | null =
        null;

      try {
        const parsed:
          unknown =
          await response.json();

        if (
          isRecord(parsed)
        ) {
          providerError =
            parsed;
        }
      } catch {
        providerError =
          null;
      }

      const errorData =
        isRecord(
          providerError?.error
        )
          ? providerError.error
          : null;

      const providerMessage =
        getString(
          errorData?.message
        ) ??
        "Text-to-speech request failed.";

      const providerType =
        getString(
          errorData?.type
        );

      console.error(
        "NOVA VOICE SPEAK ERROR:",
        {
          status:
            response.status,
          message:
            providerMessage,
          type:
            providerType,
        }
      );

      return json(
        {
          error: {
            code:
              "TTS_REQUEST_FAILED",
            message:
              providerMessage,
            providerType,
          },

          provider:
            "openai",

          status:
            response.status,

          latencyMs:
            Date.now() -
            startedAt,
        },
        response.status
      );
    }

    const audioBuffer =
      await response.arrayBuffer();

    return new NextResponse(
      audioBuffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            response.headers.get(
              "content-type"
            ) ??
            getContentType(
              format
            ),

          "Content-Length":
            String(
              audioBuffer.byteLength
            ),

          "Content-Disposition":
            `inline; filename="nova-voice.${format}"`,

          "Cache-Control":
            "no-store",

          "X-NOVA-Provider":
            "openai",

          "X-NOVA-Model":
            model,

          "X-NOVA-Voice":
            voice,

          "X-NOVA-Latency-Ms":
            String(
              Date.now() -
              startedAt
            ),
        },
      }
    );
  } catch (error) {
    const isAbortError =
      error instanceof Error &&
      error.name ===
        "AbortError";

    console.error(
      "NOVA VOICE SPEAK ROUTE ERROR:",
      error
    );

    return json(
      {
        error: {
          code:
            isAbortError
              ? "TTS_TIMEOUT"
              : "TTS_FAILED",

          message:
            isAbortError
              ? "The text-to-speech request timed out."
              : "The text-to-speech request failed unexpectedly.",
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
   METHOD NOT ALLOWED
================================================== */

export async function PUT() {
  return json(
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
  return json(
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
  return json(
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