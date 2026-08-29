"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export type MessageStatus =
  | "sending"
  | "streaming"
  | "complete"
  | "error";

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size?: number;
  url?: string;
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  latency?: number;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
  attachments?: MessageAttachment[];
  metadata?: MessageMetadata;
  error?: string;
}

export interface CreateMessageInput {
  id?: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  attachments?: MessageAttachment[];
  metadata?: MessageMetadata;
}

export interface UpdateMessageInput {
  content?: string;
  status?: MessageStatus;
  attachments?: MessageAttachment[];
  metadata?: MessageMetadata;
  error?: string;
}

export interface UseMessagesOptions {
  initialMessages?: Message[];
  maxMessages?: number;
}

export interface UseMessagesReturn {
  messages: Message[];

  messageCount: number;

  lastMessage: Message | null;

  isEmpty: boolean;

  addMessage: (
    input: CreateMessageInput
  ) => Message;

  addMessages: (
    inputs: CreateMessageInput[]
  ) => Message[];

  updateMessage: (
    id: string,
    input: UpdateMessageInput
  ) => Message | null;

  updateMessageContent: (
    id: string,
    content: string
  ) => Message | null;

  appendToMessage: (
    id: string,
    content: string
  ) => Message | null;

  removeMessage: (
    id: string
  ) => void;

  clearMessages: () => void;

  getMessage: (
    id: string
  ) => Message | null;

  getMessagesByRole: (
    role: MessageRole
  ) => Message[];

  setMessageStatus: (
    id: string,
    status: MessageStatus
  ) => Message | null;

  setMessageError: (
    id: string,
    error: string
  ) => Message | null;

  replaceMessages: (
    messages: Message[]
  ) => void;

  setMessages: (
    messages: Message[]
  ) => void;
}

function createMessageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2),
  ].join("-");
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function normalizeMessage(
  input: CreateMessageInput
): Message {
  const timestamp = getTimestamp();

  return {
    id: input.id ?? createMessageId(),
    role: input.role,
    content: input.content,
    status: input.status ?? "complete",
    createdAt: timestamp,
    attachments: input.attachments,
    metadata: input.metadata,
  };
}

export function useMessages(
  options: UseMessagesOptions = {}
): UseMessagesReturn {
  const {
    initialMessages = [],
    maxMessages,
  } = options;

  const [messages, setMessagesState] =
    useState<Message[]>(initialMessages);

  const messagesRef =
    useRef<Message[]>(initialMessages);

  const commitMessages = useCallback(
    (
      updater:
        | Message[]
        | ((
            current: Message[]
          ) => Message[])
    ) => {
      setMessagesState(
        (currentMessages) => {
          const nextMessages =
            typeof updater === "function"
              ? updater(currentMessages)
              : updater;

          messagesRef.current =
            nextMessages;

          return nextMessages;
        }
      );
    },
    []
  );

  const applyLimit = useCallback(
    (items: Message[]): Message[] => {
      if (
        !maxMessages ||
        maxMessages <= 0
      ) {
        return items;
      }

      if (
        items.length <= maxMessages
      ) {
        return items;
      }

      return items.slice(
        items.length - maxMessages
      );
    },
    [maxMessages]
  );

  const messageCount =
    messages.length;

  const lastMessage = useMemo(
    () =>
      messages.length > 0
        ? messages[messages.length - 1]
        : null,
    [messages]
  );

  const isEmpty =
    messages.length === 0;

  const addMessage = useCallback(
    (
      input: CreateMessageInput
    ): Message => {
      const message =
        normalizeMessage(input);

      commitMessages(
        (currentMessages) =>
          applyLimit([
            ...currentMessages,
            message,
          ])
      );

      return message;
    },
    [
      applyLimit,
      commitMessages,
    ]
  );

  const addMessages = useCallback(
    (
      inputs: CreateMessageInput[]
    ): Message[] => {
      const newMessages =
        inputs.map(
          normalizeMessage
        );

      if (
        newMessages.length === 0
      ) {
        return [];
      }

      commitMessages(
        (currentMessages) =>
          applyLimit([
            ...currentMessages,
            ...newMessages,
          ])
      );

      return newMessages;
    },
    [
      applyLimit,
      commitMessages,
    ]
  );

  const updateMessage = useCallback(
    (
      id: string,
      input: UpdateMessageInput
    ): Message | null => {
      const existingMessage =
        messagesRef.current.find(
          (message) =>
            message.id === id
        );

      if (!existingMessage) {
        return null;
      }

      const updatedMessage: Message = {
        ...existingMessage,
        ...input,
        updatedAt: getTimestamp(),
      };

      if (
        input.metadata !== undefined
      ) {
        updatedMessage.metadata = {
          ...existingMessage.metadata,
          ...input.metadata,
        };
      }

      commitMessages(
        (currentMessages) =>
          currentMessages.map(
            (message) =>
              message.id === id
                ? updatedMessage
                : message
          )
      );

      return updatedMessage;
    },
    [commitMessages]
  );

  const updateMessageContent =
    useCallback(
      (
        id: string,
        content: string
      ): Message | null => {
        return updateMessage(
          id,
          { content }
        );
      },
      [updateMessage]
    );

  const appendToMessage =
    useCallback(
      (
        id: string,
        content: string
      ): Message | null => {
        const existingMessage =
          messagesRef.current.find(
            (message) =>
              message.id === id
          );

        if (!existingMessage) {
          return null;
        }

        return updateMessage(
          id,
          {
            content:
              existingMessage.content +
              content,
          }
        );
      },
      [updateMessage]
    );

  const removeMessage =
    useCallback(
      (id: string): void => {
        commitMessages(
          (currentMessages) =>
            currentMessages.filter(
              (message) =>
                message.id !== id
            )
        );
      },
      [commitMessages]
    );

  const clearMessages =
    useCallback(() => {
      commitMessages([]);
    }, [commitMessages]);

  const getMessage = useCallback(
    (
      id: string
    ): Message | null => {
      return (
        messagesRef.current.find(
          (message) =>
            message.id === id
        ) ?? null
      );
    },
    []
  );

  const getMessagesByRole =
    useCallback(
      (
        role: MessageRole
      ): Message[] => {
        return messagesRef.current.filter(
          (message) =>
            message.role === role
        );
      },
      []
    );

  const setMessageStatus =
    useCallback(
      (
        id: string,
        status: MessageStatus
      ): Message | null => {
        return updateMessage(
          id,
          { status }
        );
      },
      [updateMessage]
    );

  const setMessageError =
    useCallback(
      (
        id: string,
        error: string
      ): Message | null => {
        return updateMessage(
          id,
          {
            error,
            status: "error",
          }
        );
      },
      [updateMessage]
    );

  const replaceMessages =
    useCallback(
      (
        nextMessages: Message[]
      ): void => {
        commitMessages(
          applyLimit(
            [...nextMessages]
          )
        );
      },
      [
        applyLimit,
        commitMessages,
      ]
    );

  const setMessages =
    useCallback(
      (
        nextMessages: Message[]
      ): void => {
        replaceMessages(
          nextMessages
        );
      },
      [replaceMessages]
    );

  return {
    messages,

    messageCount,

    lastMessage,

    isEmpty,

    addMessage,

    addMessages,

    updateMessage,

    updateMessageContent,

    appendToMessage,

    removeMessage,

    clearMessages,

    getMessage,

    getMessagesByRole,

    setMessageStatus,

    setMessageError,

    replaceMessages,

    setMessages,
  };
}

export default useMessages;