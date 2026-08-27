import { supabase } from "@/lib/supabase";

import type {
  ActionRequest,
} from "@/services/action-types";

/* ==================================================
 * TYPES
 * ================================================== */

export type StreamAttachment = {
  name: string;
  url: string;
  type: string;
};

export type StreamMessage = {
  role: "user" | "assistant";
  content: string;
  attachment?: StreamAttachment | null;
};

type GroqStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

type StreamCallbacks = {
  onChunk: (
    chunk: string
  ) => void;

  onAction?: (
    action: ActionRequest
  ) => void;
};

/* ==================================================
 * ACTION VALIDATION
 * ================================================== */

function isActionRequest(
  value: unknown
): value is ActionRequest {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const action =
    value as Record<string, unknown>;

  return (
    typeof action.type === "string" &&
    typeof action.requiresConfirmation ===
      "boolean" &&
    typeof action.confidence === "number" &&
    typeof action.data === "object" &&
    action.data !== null &&
    !Array.isArray(
      action.data
    )
  );
}

/* ==================================================
 * SSE EVENT PROCESSING
 * ================================================== */

function processSSEEvent(
  event: string,
  callbacks: StreamCallbacks
): boolean {
  const lines =
    event.split(
      /\r?\n/
    );

  let eventType = "";

  const dataLines: string[] =
    [];

  for (
    const line of lines
  ) {
    if (
      line.startsWith(
        "event:"
      )
    ) {
      eventType =
        line
          .slice(6)
          .trim();

      continue;
    }

    if (
      !line.startsWith(
        "data:"
      )
    ) {
      continue;
    }

    dataLines.push(
      line
        .slice(5)
        .trimStart()
    );
  }

  if (
    dataLines.length === 0
  ) {
    return false;
  }

  const data =
    dataLines
      .join("\n")
      .trim();

  if (!data) {
    return false;
  }

  if (
    data === "[DONE]"
  ) {
    return true;
  }

  try {
    const json =
      JSON.parse(data);

    /* ==============================================
     * CUSTOM ACTION EVENT
     * ============================================== */

    if (
      eventType === "action" &&
      isActionRequest(json)
    ) {
      callbacks.onAction?.(
        json
      );

      return false;
    }

    if (
      isActionRequest(
        json?.action
      )
    ) {
      callbacks.onAction?.(
        json.action
      );

      return false;
    }

    /* ==============================================
     * GROQ CONTENT CHUNK
     * ============================================== */

    const chunk =
      json as GroqStreamChunk;

    const content =
      chunk
        .choices?.[0]
        ?.delta
        ?.content;

    if (
      typeof content ===
        "string" &&
      content.length > 0
    ) {
      callbacks.onChunk(
        content
      );
    }
  } catch (error) {
    console.error(
      "SSE JSON parse hatası:",
      error,
      data
    );
  }

  return false;
}

/* ==================================================
 * STREAM CHAT
 * ================================================== */

export async function streamChat(
  messages: StreamMessage[],

  onChunk: (
    chunk: string
  ) => void,

  signal?: AbortSignal,

  onAction?: (
    action: ActionRequest
  ) => void
): Promise<void> {
  /* ================================================
   * SESSION
   * ================================================ */

  const {
    data: {
      session,
    },

    error: sessionError,
  } =
    await supabase.auth
      .getSession();

  if (
    sessionError ||
    !session?.access_token
  ) {
    throw new Error(
      "Oturum bulunamadı."
    );
  }

  /* ================================================
   * REQUEST
   * ================================================ */

  const response =
    await fetch(
      "/api/stream",
      {
        method: "POST",

        signal,

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${session.access_token}`,
        },

        body:
          JSON.stringify({
            messages,
          }),
      }
    );

  /* ================================================
   * ERROR RESPONSE
   * ================================================ */

  if (!response.ok) {
    let message =
      "AI yanıtı alınamadı.";

    try {
      const errorData =
        await response.json();

      if (
        typeof errorData?.error ===
          "string" &&
        errorData.error.trim()
      ) {
        message =
          errorData.error;
      }
    } catch {
      // JSON olmayan hata cevabı
    }

    throw new Error(
      message
    );
  }

  if (!response.body) {
    throw new Error(
      "AI stream body bulunamadı."
    );
  }

  /* ================================================
   * STREAM READER
   * ================================================ */

  const reader =
    response.body
      .getReader();

  const decoder =
    new TextDecoder(
      "utf-8"
    );

  const callbacks:
    StreamCallbacks = {
      onChunk,
      onAction,
    };

  let buffer = "";

  let streamFinished =
    false;

  try {
    while (true) {
      const {
        value,
        done,
      } =
        await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      buffer +=
        decoder.decode(
          value,
          {
            stream: true,
          }
        );

      const events =
        buffer.split(
          /\r?\n\r?\n/
        );

      buffer =
        events.pop() ?? "";

      for (
        const event of events
      ) {
        if (
          !event.trim()
        ) {
          continue;
        }

        const isDone =
          processSSEEvent(
            event,
            callbacks
          );

        if (isDone) {
          streamFinished =
            true;

          break;
        }
      }

      if (
        streamFinished
      ) {
        break;
      }
    }

    /* ==============================================
     * FINAL DECODER BUFFER
     * ============================================== */

    buffer +=
      decoder.decode();

    if (
      !streamFinished &&
      buffer.trim()
    ) {
      processSSEEvent(
        buffer,
        callbacks
      );
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Stream zaten kapanmış olabilir.
    }
  }
}