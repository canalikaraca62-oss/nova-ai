import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_TRANSCRIPT_URL =
  "https://api.openai.com/v1/audio/transcriptions";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 120_000;

const SUPPORTED_EXTENSIONS = new Set([
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

const SUPPORTED_MIME_TYPES = new Set([
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

const ALLOWED_MODELS = new Set([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
]);

type TranscriptionUsage = {
  type?: string;
  seconds?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type OpenAITranscriptionResponse = {
  text?: string;
  language?: string;
  duration?: number;
  usage?: TranscriptionUsage;
  error?: {
    message?: string;
    type?: string;
    code?: string | null;
  };
};

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (
    lastDotIndex === -1 ||
    lastDotIndex === fileName.length - 1
  ) {
    return "";
  }

  return fileName
    .slice(lastDotIndex + 1)
    .trim()
    .toLowerCase();
}

function isSupportedAudioFile(file: File): boolean {
  const extension = getFileExtension(file.name);

  const hasSupportedExtension =
    extension.length > 0 &&
    SUPPORTED_EXTENSIONS.has(extension);

  const mimeType = file.type
    .split(";")[0]
    .trim()
    .toLowerCase();

  const hasSupportedMimeType =
    mimeType.length === 0 ||
    SUPPORTED_MIME_TYPES.has(mimeType);

  return (
    hasSupportedExtension &&
    hasSupportedMimeType
  );
}

function getRequestedModel(
  value: FormDataEntryValue | null
): string {
  if (typeof value !== "string") {
    return "gpt-4o-mini-transcribe";
  }

  const model = value.trim();

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

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function isValidLanguage(value: string): boolean {
  return /^[a-z]{2,3}$/i.test(value);
}

function createErrorResponse(
  error: string,
  status: number,
  details?: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details ? { details } : {}),
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
  payload: OpenAITranscriptionResponse | null
): string {
  const message = payload?.error?.message;

  if (
    typeof message === "string" &&
    message.trim().length > 0
  ) {
    return message;
  }

  return "Voice transcription failed.";
}

export async function POST(
  request: NextRequest
) {
  const requestId = crypto.randomUUID();

  try {
    const apiKey =
      process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      console.error(
        "SYRAVEN VOICE TRANSCRIBE: Missing OPENAI_API_KEY",
        { requestId }
      );

      return createErrorResponse(
        "Voice transcription is not configured.",
        503
      );
    }

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
        415
      );
    }

    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      return createErrorResponse(
        "Invalid multipart form data.",
        400
      );
    }

    const fileValue =
      formData.get("file") ??
      formData.get("audio");

    if (
      !fileValue ||
      typeof fileValue === "string"
    ) {
      return createErrorResponse(
        "An audio file is required.",
        400
      );
    }

    const audioFile = fileValue as File;

    if (audioFile.size <= 0) {
      return createErrorResponse(
        "The audio file is empty.",
        400
      );
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        "The audio file is too large.",
        413,
        `Maximum allowed size is ${
          MAX_FILE_SIZE / 1024 / 1024
        } MB.`
      );
    }

    if (
      !audioFile.name ||
      !isSupportedAudioFile(audioFile)
    ) {
      return createErrorResponse(
        "Unsupported audio format.",
        415,
        "Supported formats include flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, and webm."
      );
    }

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
      isValidLanguage(requestedLanguage)
        ? requestedLanguage.toLowerCase()
        : null;

    const prompt =
      getOptionalString(
        formData.get("prompt"),
        4_000
      );

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

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

    let response: Response;

    try {
      response = await fetch(
        OPENAI_TRANSCRIPT_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
          },
          body: upstreamFormData,
          signal: controller.signal,
          cache: "no-store",
        }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return createErrorResponse(
          "Voice transcription timed out.",
          504
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
        502
      );
    } finally {
      clearTimeout(timeout);
    }

    const responseText =
      await response.text();

    let payload:
      | OpenAITranscriptionResponse
      | null = null;

    if (responseText) {
      try {
        payload =
          JSON.parse(responseText) as
            OpenAITranscriptionResponse;
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        getOpenAIErrorMessage(payload);

      console.error(
        "SYRAVEN VOICE TRANSCRIBE API ERROR:",
        {
          requestId,
          status: response.status,
          message,
        }
      );

      return createErrorResponse(
        message,
        response.status >= 500
          ? 502
          : response.status
      );
    }

    const transcript =
      payload?.text?.trim() ?? "";

    if (!transcript) {
      return NextResponse.json(
        {
          success: true,
          requestId,
          transcript: "",
          text: "",
          empty: true,
          model,
          language:
            payload?.language ??
            language ??
            null,
          duration:
            payload?.duration ??
            null,
          usage:
            payload?.usage ??
            null,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        requestId,

        transcript,
        text: transcript,

        empty: false,

        model,

        language:
          payload?.language ??
          language ??
          null,

        duration:
          payload?.duration ??
          null,

        usage:
          payload?.usage ??
          null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN VOICE TRANSCRIBE UNEXPECTED ERROR:",
      {
        error,
      }
    );

    return createErrorResponse(
      "An unexpected transcription error occurred.",
      500
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}