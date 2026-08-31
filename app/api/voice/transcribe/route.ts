import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN VOICE TRANSCRIPTION API
================================================== */

const OPENAI_TRANSCRIPT_URL =
  "https://api.openai.com/v1/audio/transcriptions";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 120_000;

const SUPPORTED_EXTENSIONS = new Set<string>([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

const SUPPORTED_MIME_TYPES = new Set<string>([
  "audio/flac",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

const ALLOWED_MODELS = new Set<string>([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
]);

/* ==================================================
   TYPES
================================================== */

type TranscriptionUsage = {
  type?: string;
  seconds?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type OpenAITranscriptionError = {
  message?: string;
  type?: string;
  code?: string | null;
};

type OpenAITranscriptionResponse = {
  text?: string;
  language?: string;
  duration?: number;
  usage?: TranscriptionUsage;
  error?: OpenAITranscriptionError;
};

/* ==================================================
   FILE HELPERS
================================================== */

function getFileExtension(
  fileName: string | null | undefined
): string {
  if (typeof fileName !== "string") {
    return "";
  }

  const normalizedName = fileName.trim();

  if (!normalizedName) {
    return "";
  }

  const lastDotIndex =
    normalizedName.lastIndexOf(".");

  if (
    lastDotIndex === -1 ||
    lastDotIndex === normalizedName.length - 1
  ) {
    return "";
  }

  return normalizedName
    .slice(lastDotIndex + 1)
    .trim()
    .toLowerCase();
}

function normalizeMimeType(
  value: string | null | undefined
): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value
    .split(";")
    .shift()
    ?.trim()
    .toLowerCase();

  return normalized ?? "";
}

function isSupportedAudioFile(
  file: File
): boolean {
  const extension =
    getFileExtension(file.name);

  const hasSupportedExtension =
    extension.length > 0 &&
    SUPPORTED_EXTENSIONS.has(extension);

  const mimeType =
    normalizeMimeType(file.type);

  /*
    Some browsers may send an empty MIME type.
    In that case we allow the file when the
    extension itself is supported.
  */

  const hasSupportedMimeType =
    mimeType.length === 0 ||
    SUPPORTED_MIME_TYPES.has(mimeType);

  return (
    hasSupportedExtension &&
    hasSupportedMimeType
  );
}

/* ==================================================
   FORM DATA HELPERS
================================================== */

function getRequestedModel(
  value: FormDataEntryValue | null
): string {
  if (typeof value !== "string") {
    return "gpt-4o-mini-transcribe";
  }

  const model =
    value.trim();

  if (!ALLOWED_MODELS.has(model)) {
    return "gpt-4o-mini-transcribe";
  }

  return model;
}

function getOptionalString(
  value: FormDataEntryValue | null,
  maxLength: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength
  );
}

function isValidLanguage(
  value: string
): boolean {
  return /^[a-z]{2,3}$/i.test(
    value.trim()
  );
}

/* ==================================================
   RESPONSE HELPERS
================================================== */

function createErrorResponse(
  error: string,
  status: number,
  details?: string,
  requestId?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      ...(requestId
        ? { requestId }
        : {}),
      error,
      ...(details
        ? { details }
        : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function getOpenAIErrorMessage(
  payload:
    | OpenAITranscriptionResponse
    | null
): string {
  const message =
    payload?.error?.message;

  if (
    typeof message === "string" &&
    message.trim().length > 0
  ) {
    return message.trim();
  }

  return "Voice transcription failed.";
}

function parseOpenAIResponse(
  responseText: string
): OpenAITranscriptionResponse | null {
  if (!responseText.trim()) {
    return null;
  }

  try {
    const parsed: unknown =
      JSON.parse(responseText);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    return parsed as OpenAITranscriptionResponse;
  } catch {
    return null;
  }
}

/* ==================================================
   OPENAI REQUEST
================================================== */

async function requestTranscription({
  apiKey,
  formData,
}: {
  apiKey: string;
  formData: FormData;
}): Promise<Response> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    return await fetch(
      OPENAI_TRANSCRIPT_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,
        },

        body: formData,

        signal:
          controller.signal,

        cache:
          "no-store",
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* ==================================================
   POST
================================================== */

export async function POST(
  request: NextRequest
) {
  const requestId =
    crypto.randomUUID();

  try {
    /* ==============================================
       ENVIRONMENT
    ============================================== */

    const apiKey =
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      console.error(
        "SYRAVEN VOICE TRANSCRIBE: Missing OPENAI_API_KEY",
        {
          requestId,
        }
      );

      return createErrorResponse(
        "Voice transcription is not configured.",
        503,
        undefined,
        requestId
      );
    }

    /* ==============================================
       CONTENT TYPE VALIDATION
    ============================================== */

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (
      !contentType.includes(
        "multipart/form-data"
      )
    ) {
      return createErrorResponse(
        "Content-Type must be multipart/form-data.",
        415,
        undefined,
        requestId
      );
    }

    /* ==============================================
       PARSE FORM DATA
    ============================================== */

    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      return createErrorResponse(
        "Invalid multipart form data.",
        400,
        undefined,
        requestId
      );
    }

    /* ==============================================
       GET AUDIO FILE
    ============================================== */

    const fileValue =
      formData.get("file") ??
      formData.get("audio");

    if (
      !fileValue ||
      typeof fileValue === "string"
    ) {
      return createErrorResponse(
        "An audio file is required.",
        400,
        undefined,
        requestId
      );
    }

    const audioFile =
      fileValue as File;

    /* ==============================================
       FILE VALIDATION
    ============================================== */

    if (audioFile.size <= 0) {
      return createErrorResponse(
        "The audio file is empty.",
        400,
        undefined,
        requestId
      );
    }

    if (
      audioFile.size >
      MAX_FILE_SIZE
    ) {
      const maxSizeMB =
        Math.floor(
          MAX_FILE_SIZE /
            1024 /
            1024
        );

      return createErrorResponse(
        "The audio file is too large.",
        413,
        `Maximum allowed size is ${maxSizeMB} MB.`,
        requestId
      );
    }

    if (
      !audioFile.name ||
      !isSupportedAudioFile(
        audioFile
      )
    ) {
      return createErrorResponse(
        "Unsupported audio format.",
        415,
        "Supported formats include flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, and webm.",
        requestId
      );
    }

    /* ==============================================
       REQUEST OPTIONS
    ============================================== */

    const model =
      getRequestedModel(
        formData.get("model")
      );

    const requestedLanguage =
      getOptionalString(
        formData.get("language"),
        10
      );

    const language =
      requestedLanguage &&
      isValidLanguage(
        requestedLanguage
      )
        ? requestedLanguage
            .trim()
            .toLowerCase()
        : null;

    const prompt =
      getOptionalString(
        formData.get("prompt"),
        4_000
      );

    /* ==============================================
       CREATE UPSTREAM FORM DATA
    ============================================== */

    const upstreamFormData =
      new FormData();

    upstreamFormData.append(
      "file",
      audioFile,
      audioFile.name
    );

    upstreamFormData.append(
      "model",
      model
    );

    if (language) {
      upstreamFormData.append(
        "language",
        language
      );
    }

    if (prompt) {
      upstreamFormData.append(
        "prompt",
        prompt
      );
    }

    /* ==============================================
       OPENAI REQUEST
    ============================================== */

    let response: Response;

    try {
      response =
        await requestTranscription({
          apiKey,
          formData:
            upstreamFormData,
        });
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return createErrorResponse(
          "Voice transcription timed out.",
          504,
          undefined,
          requestId
        );
      }

      console.error(
        "SYRAVEN VOICE TRANSCRIBE NETWORK ERROR:",
        {
          requestId,
          error,
        }
      );

      return createErrorResponse(
        "Unable to reach the transcription service.",
        502,
        undefined,
        requestId
      );
    }

    /* ==============================================
       PARSE RESPONSE
    ============================================== */

    const responseText =
      await response.text();

    const payload =
      parseOpenAIResponse(
        responseText
      );

    /* ==============================================
       OPENAI ERROR
    ============================================== */

    if (!response.ok) {
      const message =
        getOpenAIErrorMessage(
          payload
        );

      console.error(
        "SYRAVEN VOICE TRANSCRIBE API ERROR:",
        {
          requestId,
          status:
            response.status,
          message,
        }
      );

      const safeStatus =
        response.status >= 500
          ? 502
          : response.status;

      return createErrorResponse(
        message,
        safeStatus,
        undefined,
        requestId
      );
    }

    /* ==============================================
       TRANSCRIPT
    ============================================== */

    const transcript =
      typeof payload?.text ===
      "string"
        ? payload.text.trim()
        : "";

    const responseLanguage =
      typeof payload?.language ===
      "string"
        ? payload.language
            .trim()
            .toLowerCase()
        : language;

    const duration =
      typeof payload?.duration ===
        "number" &&
      Number.isFinite(
        payload.duration
      )
        ? payload.duration
        : null;

    /* ==============================================
       SUCCESS RESPONSE
    ============================================== */

    return NextResponse.json(
      {
        success: true,

        requestId,

        transcript,

        text:
          transcript,

        empty:
          transcript.length === 0,

        model,

        language:
          responseLanguage ??
          null,

        duration,

        usage:
          payload?.usage ??
          null,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN VOICE TRANSCRIBE UNEXPECTED ERROR:",
      {
        requestId,
        error,
      }
    );

    return createErrorResponse(
      "An unexpected transcription error occurred.",
      500,
      undefined,
      requestId
    );
  }
}

/* ==================================================
   OPTIONS
================================================== */

export async function OPTIONS() {
  return new NextResponse(
    null,
    {
      status: 204,

      headers: {
        Allow:
          "POST, OPTIONS",

        "Cache-Control":
          "no-store",
      },
    }
  );
}