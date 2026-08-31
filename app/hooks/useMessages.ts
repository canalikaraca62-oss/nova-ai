"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

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
  error?: string | undefined;
}

export interface UseMessagesOptions {
  initialMessages?: Message[];
  maxMessages?: number;
}

export interface UseMessagesReturn {
  messages: Message[];

  messageCount: number;

  firstMessage: Message | null;

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

  prependToMessage: (
    id: string,
    content: string
  ) => Message | null;

  removeMessage: (
    id: string
  ) => void;

  removeMessages: (
    ids: string[]
  ) => void;

  clearMessages: () => void;

  getMessage: (
    id: string
  ) => Message | null;

  hasMessage: (
    id: string
  ) => boolean;

  findMessage: (
    predicate: (
      message: Message
    ) => boolean
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

  clearMessageError: (
    id: string
  ) => Message | null;

  replaceMessages: (
    messages: Message[]
  ) => void;

  setMessages: (
    messages: Message[]
  ) => void;
}

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_ROLES: readonly MessageRole[] = [
  "system",
  "user",
  "assistant",
  "tool",
];

const VALID_STATUSES: readonly MessageStatus[] = [
  "sending",
  "streaming",
  "complete",
  "error",
];

/* =========================================================
   ID HELPERS
========================================================= */

function createMessageId(): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID ===
      "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return [
    "msg",
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 12),
  ].join("_");
}

/* =========================================================
   TIME HELPERS
========================================================= */

function getTimestamp(): string {
  return new Date().toISOString();
}

/* =========================================================
   VALIDATION
========================================================= */

function isValidRole(
  value: unknown
): value is MessageRole {
  return (
    typeof value === "string" &&
    VALID_ROLES.includes(
      value as MessageRole
    )
  );
}

function isValidStatus(
  value: unknown
): value is MessageStatus {
  return (
    typeof value === "string" &&
    VALID_STATUSES.includes(
      value as MessageStatus
    )
  );
}

/* =========================================================
   CLONE HELPERS
========================================================= */

function cloneAttachments(
  attachments?: MessageAttachment[]
): MessageAttachment[] | undefined {
  if (!attachments) {
    return undefined;
  }

  return attachments.map(
    (attachment) => ({
      ...attachment,
    })
  );
}

function cloneMetadata(
  metadata?: MessageMetadata
): MessageMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  return {
    ...metadata,
  };
}

function cloneMessage(
  message: Message
): Message {
  return {
    ...message,
    attachments: cloneAttachments(
      message.attachments
    ),
    metadata: cloneMetadata(
      message.metadata
    ),
  };
}

/* =========================================================
   MESSAGE NORMALIZATION
========================================================= */

function normalizeMessage(
  input: CreateMessageInput
): Message {
  const timestamp = getTimestamp();

  return {
    id:
      typeof input.id === "string" &&
      input.id.trim().length > 0
        ? input.id.trim()
        : createMessageId(),

    role: isValidRole(input.role)
      ? input.role
      : "user",

    content:
      typeof input.content === "string"
        ? input.content
        : String(input.content ?? ""),

    status: isValidStatus(input.status)
      ? input.status
      : "complete",

    createdAt: timestamp,

    attachments: cloneAttachments(
      input.attachments
    ),

    metadata: cloneMetadata(
      input.metadata
    ),
  };
}

function normalizeExistingMessage(
  message: Message
): Message {
  const timestamp = getTimestamp();

  return {
    id:
      typeof message.id === "string" &&
      message.id.trim().length > 0
        ? message.id.trim()
        : createMessageId(),

    role: isValidRole(message.role)
      ? message.role
      : "user",

    content:
      typeof message.content === "string"
        ? message.content
        : String(message.content ?? ""),

    status: isValidStatus(message.status)
      ? message.status
      : "complete",

    createdAt:
      typeof message.createdAt === "string" &&
      message.createdAt.trim().length > 0
        ? message.createdAt
        : timestamp,

    ...(message.updatedAt
      ? {
          updatedAt:
            message.updatedAt,
        }
      : {}),

    ...(message.error !== undefined
      ? {
          error: message.error,
        }
      : {}),

    ...(message.attachments
      ? {
          attachments:
            cloneAttachments(
              message.attachments
            ),
        }
      : {}),

    ...(message.metadata
      ? {
          metadata:
            cloneMetadata(
              message.metadata
            ),
        }
      : {}),
  };
}

/* =========================================================
   ARRAY HELPERS
========================================================= */

function deduplicateMessages(
  messages: Message[]
): Message[] {
  const seenIds = new Set<string>();

  const result: Message[] = [];

  for (const message of messages) {
    if (seenIds.has(message.id)) {
      continue;
    }

    seenIds.add(message.id);
    result.push(message);
  }

  return result;
}

function applyMessageLimit(
  messages: Message[],
  maxMessages?: number
): Message[] {
  if (
    maxMessages === undefined ||
    !Number.isFinite(maxMessages) ||
    maxMessages <= 0
  ) {
    return messages;
  }

  const safeMax = Math.floor(
    maxMessages
  );

  if (messages.length <= safeMax) {
    return messages;
  }

  return messages.slice(
    messages.length - safeMax
  );
}

function findMessageById(
  messages: readonly Message[],
  id: string
): Message | null {
  const message = messages.find(
    (item) => item.id === id
  );

  return message ?? null;
}

/* =========================================================
   HOOK
========================================================= */

export function useMessages(
  options: UseMessagesOptions = {}
): UseMessagesReturn {
  const {
    initialMessages = [],
    maxMessages,
  } = options;

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  const initialMessagesRef =
    useRef<Message[] | null>(null);

  if (
    initialMessagesRef.current === null
  ) {
    const normalized =
      initialMessages.map(
        normalizeExistingMessage
      );

    initialMessagesRef.current =
      applyMessageLimit(
        deduplicateMessages(normalized),
        maxMessages
      );
  }

  const [messages, setMessagesState] =
    useState<Message[]>(
      initialMessagesRef.current
    );

  const messagesRef =
    useRef<Message[]>(
      initialMessagesRef.current
    );

  /* =======================================================
     COMMIT STATE
  ======================================================= */

  const commitMessages = useCallback(
    (
      updater:
        | Message[]
        | ((
            current: Message[]
          ) => Message[])
    ): void => {
      setMessagesState(
        (currentMessages) => {
          const nextMessages =
            typeof updater === "function"
              ? updater(currentMessages)
              : updater;

          const safeMessages =
            nextMessages.map(
              cloneMessage
            );

          messagesRef.current =
            safeMessages;

          return safeMessages;
        }
      );
    },
    []
  );

  /* =======================================================
     LIMIT
  ======================================================= */

  const applyLimit = useCallback(
    (
      nextMessages: Message[]
    ): Message[] => {
      return applyMessageLimit(
        nextMessages,
        maxMessages
      );
    },
    [maxMessages]
  );

  useEffect(() => {
    if (
      maxMessages === undefined ||
      !Number.isFinite(maxMessages) ||
      maxMessages <= 0
    ) {
      return;
    }

    commitMessages(
      (currentMessages) =>
        applyLimit(currentMessages)
    );
  }, [
    maxMessages,
    applyLimit,
    commitMessages,
  ]);

  /* =======================================================
     DERIVED VALUES
  ======================================================= */

  const messageCount =
    messages.length;

  const firstMessage = useMemo(
    (): Message | null =>
      messages.length > 0
        ? messages[0] ?? null
        : null,
    [messages]
  );

  const lastMessage = useMemo(
    (): Message | null =>
      messages.length > 0
        ? messages[
            messages.length - 1
          ] ?? null
        : null,
    [messages]
  );

  const isEmpty =
    messages.length === 0;

  /* =======================================================
     GETTERS
  ======================================================= */

  const getMessage = useCallback(
    (
      id: string
    ): Message | null => {
      return findMessageById(
        messagesRef.current,
        id
      );
    },
    []
  );

  const hasMessage = useCallback(
    (id: string): boolean => {
      return messagesRef.current.some(
        (message) =>
          message.id === id
      );
    },
    []
  );

  const findMessage = useCallback(
    (
      predicate: (
        message: Message
      ) => boolean
    ): Message | null => {
      const message =
        messagesRef.current.find(
          predicate
        );

      return message ?? null;
    },
    []
  );

  const getMessagesByRole =
    useCallback(
      (
        role: MessageRole
      ): Message[] => {
        return messagesRef.current
          .filter(
            (message) =>
              message.role === role
          )
          .map(cloneMessage);
      },
      []
    );

  /* =======================================================
     ADD SINGLE
  ======================================================= */

  const addMessage = useCallback(
    (
      input: CreateMessageInput
    ): Message => {
      let message =
        normalizeMessage(input);

      const exists =
        messagesRef.current.some(
          (item) =>
            item.id === message.id
        );

      if (exists) {
        message = {
          ...message,
          id: createMessageId(),
        };
      }

      commitMessages(
        (currentMessages) =>
          applyLimit([
            ...currentMessages,
            message,
          ])
      );

      return cloneMessage(message);
    },
    [
      applyLimit,
      commitMessages,
    ]
  );

  /* =======================================================
     ADD MULTIPLE
  ======================================================= */

  const addMessages = useCallback(
    (
      inputs: CreateMessageInput[]
    ): Message[] => {
      if (
        !Array.isArray(inputs) ||
        inputs.length === 0
      ) {
        return [];
      }

      const existingIds = new Set(
        messagesRef.current.map(
          (message) => message.id
        )
      );

      const createdMessages: Message[] =
        [];

      for (const input of inputs) {
        let message =
          normalizeMessage(input);

        while (
          existingIds.has(message.id)
        ) {
          message = {
            ...message,
            id: createMessageId(),
          };
        }

        existingIds.add(message.id);
        createdMessages.push(message);
      }

      commitMessages(
        (currentMessages) =>
          applyLimit([
            ...currentMessages,
            ...createdMessages,
          ])
      );

      return createdMessages.map(
        cloneMessage
      );
    },
    [
      applyLimit,
      commitMessages,
    ]
  );

  /* =======================================================
     UPDATE
  ======================================================= */

  const updateMessage = useCallback(
    (
      id: string,
      input: UpdateMessageInput
    ): Message | null => {
      const existingMessage =
        findMessageById(
          messagesRef.current,
          id
        );

      if (!existingMessage) {
        return null;
      }

      const updatedMessage: Message = {
        ...existingMessage,
        updatedAt: getTimestamp(),
      };

      if (
        input.content !== undefined
      ) {
        updatedMessage.content =
          input.content;
      }

      if (
        input.status !== undefined
      ) {
        updatedMessage.status =
          input.status;
      }

      if (
        input.attachments !== undefined
      ) {
        updatedMessage.attachments =
          cloneAttachments(
            input.attachments
          );
      }

      if (
        input.metadata !== undefined
      ) {
        updatedMessage.metadata = {
          ...existingMessage.metadata,
          ...input.metadata,
        };
      }

      if (
        input.error !== undefined
      ) {
        updatedMessage.error =
          input.error;
      }

      if (
        input.status === "complete" &&
        input.error === undefined
      ) {
        delete updatedMessage.error;
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

      return cloneMessage(
        updatedMessage
      );
    },
    [commitMessages]
  );

  /* =======================================================
     UPDATE CONTENT
  ======================================================= */

  const updateMessageContent =
    useCallback(
      (
        id: string,
        content: string
      ): Message | null => {
        return updateMessage(id, {
          content,
        });
      },
      [updateMessage]
    );

  /* =======================================================
     APPEND
  ======================================================= */

  const appendToMessage =
    useCallback(
      (
        id: string,
        content: string
      ): Message | null => {
        const existingMessage =
          findMessageById(
            messagesRef.current,
            id
          );

        if (!existingMessage) {
          return null;
        }

        if (!content) {
          return cloneMessage(
            existingMessage
          );
        }

        return updateMessage(id, {
          content:
            existingMessage.content +
            content,
        });
      },
      [updateMessage]
    );

  /* =======================================================
     PREPEND
  ======================================================= */

  const prependToMessage =
    useCallback(
      (
        id: string,
        content: string
      ): Message | null => {
        const existingMessage =
          findMessageById(
            messagesRef.current,
            id
          );

        if (!existingMessage) {
          return null;
        }

        if (!content) {
          return cloneMessage(
            existingMessage
          );
        }

        return updateMessage(id, {
          content:
            content +
            existingMessage.content,
        });
      },
      [updateMessage]
    );

  /* =======================================================
     REMOVE SINGLE
  ======================================================= */

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

  /* =======================================================
     REMOVE MULTIPLE
  ======================================================= */

  const removeMessages =
    useCallback(
      (
        ids: string[]
      ): void => {
        if (
          !Array.isArray(ids) ||
          ids.length === 0
        ) {
          return;
        }

        const idsSet =
          new Set(ids);

        commitMessages(
          (currentMessages) =>
            currentMessages.filter(
              (message) =>
                !idsSet.has(
                  message.id
                )
            )
        );
      },
      [commitMessages]
    );

  /* =======================================================
     CLEAR
  ======================================================= */

  const clearMessages =
    useCallback((): void => {
      commitMessages([]);
    }, [commitMessages]);

  /* =======================================================
     STATUS
  ======================================================= */

  const setMessageStatus =
    useCallback(
      (
        id: string,
        status: MessageStatus
      ): Message | null => {
        return updateMessage(id, {
          status,
        });
      },
      [updateMessage]
    );

  /* =======================================================
     SET ERROR
  ======================================================= */

  const setMessageError =
    useCallback(
      (
        id: string,
        error: string
      ): Message | null => {
        return updateMessage(id, {
          error,
          status: "error",
        });
      },
      [updateMessage]
    );

  /* =======================================================
     CLEAR ERROR
  ======================================================= */

  const clearMessageError =
    useCallback(
      (
        id: string
      ): Message | null => {
        const existingMessage =
          findMessageById(
            messagesRef.current,
            id
          );

        if (!existingMessage) {
          return null;
        }

        const updatedMessage: Message = {
          ...existingMessage,
          updatedAt: getTimestamp(),
        };

        delete updatedMessage.error;

        commitMessages(
          (currentMessages) =>
            currentMessages.map(
              (message) =>
                message.id === id
                  ? updatedMessage
                  : message
            )
        );

        return cloneMessage(
          updatedMessage
        );
      },
      [commitMessages]
    );

  /* =======================================================
     REPLACE
  ======================================================= */

  const replaceMessages =
    useCallback(
      (
        nextMessages: Message[]
      ): void => {
        if (
          !Array.isArray(
            nextMessages
          )
        ) {
          commitMessages([]);
          return;
        }

        const normalizedMessages =
          nextMessages.map(
            normalizeExistingMessage
          );

        const uniqueMessages =
          deduplicateMessages(
            normalizedMessages
          );

        commitMessages(
          applyLimit(
            uniqueMessages
          )
        );
      },
      [
        applyLimit,
        commitMessages,
      ]
    );

  /* =======================================================
     SET
  ======================================================= */

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

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    messages,

    messageCount,

    firstMessage,

    lastMessage,

    isEmpty,

    addMessage,

    addMessages,

    updateMessage,

    updateMessageContent,

    appendToMessage,

    prependToMessage,

    removeMessage,

    removeMessages,

    clearMessages,

    getMessage,

    hasMessage,

    findMessage,

    getMessagesByRole,

    setMessageStatus,

    setMessageError,

    clearMessageError,

    replaceMessages,

    setMessages,
  };
}

export default useMessages;