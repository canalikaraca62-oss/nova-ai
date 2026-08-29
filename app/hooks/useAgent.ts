"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";

import {
  streamChat,
  type ChatStreamResult,
} from "./chat-stream";

/* =========================================================
   TYPES
========================================================= */

export type AgentStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "error";

export type AgentRole =
  | "assistant"
  | "research"
  | "coding"
  | "analysis"
  | "automation"
  | "creative"
  | "custom";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  role: AgentRole;
  avatar?: string;
  model?: string;
  enabled: boolean;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface UseAgentOptions {
  agent?: Agent | null;

  endpoint?: string;

  headers?: HeadersInit;

  initialMessages?: AgentMessage[];

  onStart?: () => void;

  onDelta?: (
    delta: string,
    content: string
  ) => void;

  onComplete?: (
    content: string,
    result: ChatStreamResult
  ) => void;

  onError?: (error: Error) => void;
}

export interface SendAgentMessageOptions {
  agentId?: string;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

export interface UseAgentReturn {
  agent: Agent | null;

  setAgent: (
    agent: Agent | null
  ) => void;

  status: AgentStatus;

  isLoading: boolean;

  isStreaming: boolean;

  error: Error | null;

  messages: AgentMessage[];

  sendMessage: (
    content: string,
    options?: SendAgentMessageOptions
  ) => Promise<string | null>;

  stop: () => void;

  reset: () => void;

  clearMessages: () => void;

  clearError: () => void;
}

/* =========================================================
   HELPERS
========================================================= */

function createId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
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
    "An unexpected agent error occurred."
  );
}

/* =========================================================
   HOOK
========================================================= */

export function useAgent(
  options: UseAgentOptions = {}
): UseAgentReturn {
  const {
    agent: initialAgent = null,

    endpoint = "/api/chat",

    headers,

    initialMessages = [],

    onStart,

    onDelta,

    onComplete,

    onError,
  } = options;

  const [agent, setAgent] =
    useState<Agent | null>(
      initialAgent
    );

  const [status, setStatus] =
    useState<AgentStatus>("idle");

  const [error, setError] =
    useState<Error | null>(null);

  const [messages, setMessages] =
    useState<AgentMessage[]>(
      initialMessages
    );

  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );

  const isLoading =
    status === "thinking" ||
    status === "streaming";

  const isStreaming =
    status === "streaming";

  /* =======================================================
     STOP
  ======================================================= */

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();

    abortControllerRef.current = null;

    setStatus("idle");
  }, []);

  /* =======================================================
     CLEAR ERROR
  ======================================================= */

  const clearError =
    useCallback(() => {
      setError(null);

      if (status === "error") {
        setStatus("idle");
      }
    }, [status]);

  /* =======================================================
     CLEAR MESSAGES
  ======================================================= */

  const clearMessages =
    useCallback(() => {
      setMessages([]);
    }, []);

  /* =======================================================
     RESET
  ======================================================= */

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();

    abortControllerRef.current = null;

    setStatus("idle");

    setError(null);

    setMessages(initialMessages);
  }, [initialMessages]);

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  const sendMessage =
    useCallback(
      async (
        content: string,
        sendOptions: SendAgentMessageOptions = {}
      ): Promise<string | null> => {
        const normalizedContent =
          content.trim();

        if (!normalizedContent) {
          return null;
        }

        if (isLoading) {
          return null;
        }

        setError(null);

        const userMessage: AgentMessage = {
          id: createId("msg"),

          role: "user",

          content: normalizedContent,

          createdAt:
            new Date().toISOString(),
        };

        const assistantMessageId =
          createId("msg");

        const assistantMessage: AgentMessage = {
          id: assistantMessageId,

          role: "assistant",

          content: "",

          createdAt:
            new Date().toISOString(),
        };

        const controller =
          new AbortController();

        abortControllerRef.current =
          controller;

        let removeExternalAbortListener:
          | (() => void)
          | undefined;

        try {
          if (sendOptions.signal) {
            const externalSignal =
              sendOptions.signal;

            const handleAbort = () => {
              controller.abort();
            };

            if (externalSignal.aborted) {
              controller.abort();
            } else {
              externalSignal.addEventListener(
                "abort",
                handleAbort,
                {
                  once: true,
                }
              );

              removeExternalAbortListener =
                () => {
                  externalSignal.removeEventListener(
                    "abort",
                    handleAbort
                  );
                };
            }
          }

          setMessages(
            (currentMessages) => [
              ...currentMessages,
              userMessage,
              assistantMessage,
            ]
          );

          setStatus("thinking");

          const requestBody = {
            agentId:
              sendOptions.agentId ??
              agent?.id ??
              null,

            messages: [
              ...messages,
              userMessage,
            ],

            metadata:
              sendOptions.metadata ??
              {},
          };

          let accumulatedContent = "";

          const result =
            await streamChat(
              endpoint,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  ...headers,
                },

                body: JSON.stringify(
                  requestBody
                ),

                signal: controller.signal,
              },
              {
                signal: controller.signal,

                onStart: () => {
                  setStatus("streaming");

                  onStart?.();
                },

                onDelta: (
                  delta,
                  fullContent
                ) => {
                  accumulatedContent =
                    fullContent;

                  setMessages(
                    (currentMessages) =>
                      currentMessages.map(
                        (message) =>
                          message.id ===
                          assistantMessageId
                            ? {
                                ...message,
                                content:
                                  fullContent,
                              }
                            : message
                      )
                  );

                  onDelta?.(
                    delta,
                    fullContent
                  );
                },

                onMessage: (data) => {
                  if (
                    typeof data ===
                      "object" &&
                    data !== null
                  ) {
                    const value =
                      data as Record<
                        string,
                        unknown
                      >;

                    const contentValue =
                      typeof value.content ===
                      "string"
                        ? value.content
                        : typeof value.text ===
                            "string"
                          ? value.text
                          : null;

                    if (contentValue) {
                      accumulatedContent =
                        contentValue;

                      setMessages(
                        (
                          currentMessages
                        ) =>
                          currentMessages.map(
                            (
                              message
                            ) =>
                              message.id ===
                              assistantMessageId
                                ? {
                                    ...message,
                                    content:
                                      contentValue,
                                  }
                                : message
                          )
                      );
                    }
                  }
                },

                onDone: () => {
                  setStatus("idle");
                },

                onError: (
                  streamError
                ) => {
                  setError(streamError);

                  setStatus("error");

                  onError?.(
                    streamError
                  );
                },
              }
            );

          const finalContent =
            result.content ||
            accumulatedContent;

          setMessages(
            (currentMessages) =>
              currentMessages.map(
                (message) =>
                  message.id ===
                  assistantMessageId
                    ? {
                        ...message,
                        content:
                          finalContent,
                      }
                    : message
              )
          );

          setStatus("idle");

          onComplete?.(
            finalContent,
            result
          );

          return finalContent;
        } catch (caughtError) {
          const normalizedError =
            normalizeError(
              caughtError
            );

          if (
            normalizedError.name ===
            "AbortError"
          ) {
            setMessages(
              (currentMessages) =>
                currentMessages.filter(
                  (message) =>
                    !(
                      message.id ===
                        assistantMessageId &&
                      !message.content
                    )
                )
            );

            setStatus("idle");

            return null;
          }

          setError(normalizedError);

          setStatus("error");

          onError?.(
            normalizedError
          );

          return null;
        } finally {
          removeExternalAbortListener?.();

          if (
            abortControllerRef.current ===
            controller
          ) {
            abortControllerRef.current =
              null;
          }
        }
      },
      [
        agent,
        endpoint,
        headers,
        initialMessages,
        isLoading,
        messages,
        onComplete,
        onDelta,
        onError,
        onStart,
      ]
    );

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    agent,

    setAgent,

    status,

    isLoading,

    isStreaming,

    error,

    messages,

    sendMessage,

    stop,

    reset,

    clearMessages,

    clearError,
  };
}

export default useAgent;