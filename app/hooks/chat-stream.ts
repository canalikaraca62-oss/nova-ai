export type ChatStreamEventType =
  | "start"
  | "delta"
  | "message"
  | "done"
  | "error"
  | "metadata";

export interface ChatStreamEvent<T = unknown> {
  type: ChatStreamEventType;
  data?: T;
  id?: string;
}

export interface ChatStreamOptions {
  signal?: AbortSignal;

  onStart?: () => void;

  onDelta?: (
    delta: string,
    fullContent: string
  ) => void;

  onMessage?: (data: unknown) => void;

  onMetadata?: (data: unknown) => void;

  onDone?: () => void;

  onError?: (error: Error) => void;
}

export interface ChatStreamResult {
  content: string;
  completed: boolean;
}

function createAbortError(): Error {
  const error = new Error(
    "The chat stream was aborted."
  );

  error.name = "AbortError";

  return error;
}

function normalizeError(
  error: unknown
): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error(
    "An unknown chat stream error occurred."
  );
}

function parseEventData(
  value: string
): unknown {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function extractText(
  data: unknown
): string {
  if (typeof data === "string") {
    return data;
  }

  if (
    typeof data === "object" &&
    data !== null
  ) {
    const value =
      data as Record<string, unknown>;

    const possibleKeys = [
      "content",
      "text",
      "delta",
      "token",
      "message",
    ];

    for (const key of possibleKeys) {
      const candidate = value[key];

      if (typeof candidate === "string") {
        return candidate;
      }

      if (
        typeof candidate === "object" &&
        candidate !== null
      ) {
        const nested =
          candidate as Record<
            string,
            unknown
          >;

        if (
          typeof nested.content ===
          "string"
        ) {
          return nested.content;
        }

        if (
          typeof nested.text === "string"
        ) {
          return nested.text;
        }
      }
    }
  }

  return "";
}

function parseSSEBlock(
  block: string
): ChatStreamEvent | null {
  const lines = block
    .split("\n")
    .map((line) => line.trimEnd());

  let eventType = "message";

  const dataLines: string[] = [];

  let id: string | undefined;

  for (const line of lines) {
    if (
      !line ||
      line.startsWith(":")
    ) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventType = line
        .slice(6)
        .trim();

      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(
        line.slice(5).trimStart()
      );

      continue;
    }

    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData =
    dataLines.join("\n");

  if (rawData === "[DONE]") {
    return {
      type: "done",
      id,
    };
  }

  const data =
    parseEventData(rawData);

  const validTypes: ChatStreamEventType[] =
    [
      "start",
      "delta",
      "message",
      "done",
      "error",
      "metadata",
    ];

  const type = validTypes.includes(
    eventType as ChatStreamEventType
  )
    ? (eventType as ChatStreamEventType)
    : "message";

  return {
    type,
    data,
    id,
  };
}

export async function consumeChatStream(
  response: Response,
  options: ChatStreamOptions = {}
): Promise<ChatStreamResult> {
  const {
    signal,
    onStart,
    onDelta,
    onMessage,
    onMetadata,
    onDone,
    onError,
  } = options;

  if (!response.ok) {
    const error = new Error(
      `Chat stream failed with status ${response.status}.`
    );

    onError?.(error);

    throw error;
  }

  if (!response.body) {
    const error = new Error(
      "Chat stream response has no readable body."
    );

    onError?.(error);

    throw error;
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  let content = "";

  let completed = false;

  let started = false;

  const emitStart = () => {
    if (!started) {
      started = true;

      onStart?.();
    }
  };

  try {
    emitStart();

    while (true) {
      if (signal?.aborted) {
        throw createAbortError();
      }

      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        {
          stream: true,
        }
      );

      buffer = buffer.replace(
        /\r\n/g,
        "\n"
      );

      let separatorIndex =
        buffer.indexOf("\n\n");

      while (separatorIndex !== -1) {
        const block = buffer.slice(
          0,
          separatorIndex
        );

        buffer = buffer.slice(
          separatorIndex + 2
        );

        const event =
          parseSSEBlock(block);

        if (event) {
          if (event.type === "start") {
            emitStart();
          }

          if (event.type === "delta") {
            emitStart();

            const text =
              extractText(event.data);

            if (text) {
              content += text;

              onDelta?.(
                text,
                content
              );
            }
          }

          if (event.type === "message") {
            emitStart();

            const text =
              extractText(event.data);

            if (text) {
              content += text;
            }

            onMessage?.(
              event.data
            );
          }

          if (
            event.type ===
            "metadata"
          ) {
            onMetadata?.(
              event.data
            );
          }

          if (
            event.type === "error"
          ) {
            const message =
              extractText(event.data) ||
              "The chat stream returned an error.";

            throw new Error(
              message
            );
          }

          if (
            event.type === "done"
          ) {
            completed = true;

            onDone?.();

            await reader.cancel();

            return {
              content,
              completed,
            };
          }
        }

        separatorIndex =
          buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      const event =
        parseSSEBlock(buffer);

      if (
        event?.type === "delta"
      ) {
        const text =
          extractText(event.data);

        if (text) {
          content += text;

          onDelta?.(
            text,
            content
          );
        }
      }

      if (
        event?.type === "message"
      ) {
        const text =
          extractText(event.data);

        if (text) {
          content += text;
        }

        onMessage?.(
          event.data
        );
      }

      if (
        event?.type === "metadata"
      ) {
        onMetadata?.(
          event.data
        );
      }

      if (
        event?.type === "error"
      ) {
        const message =
          extractText(event.data) ||
          "The chat stream returned an error.";

        throw new Error(
          message
        );
      }

      if (
        event?.type === "done"
      ) {
        completed = true;
      }
    }

    completed = true;

    onDone?.();

    return {
      content,
      completed,
    };
  } catch (error) {
    const normalizedError =
      normalizeError(error);

    onError?.(
      normalizedError
    );

    throw normalizedError;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be closed or cancelled.
    }
  }
}

export async function streamChat(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ChatStreamOptions = {}
): Promise<ChatStreamResult> {
  const response = await fetch(
    input,
    {
      ...init,

      signal:
        options.signal ??
        init.signal,

      headers: {
        Accept:
          "text/event-stream",

        ...init.headers,
      },
    }
  );

  return consumeChatStream(
    response,
    options
  );
}