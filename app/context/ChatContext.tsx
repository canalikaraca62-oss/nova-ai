"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type MessageRole =
  | "user"
  | "assistant"
  | "system";

export type MessageStatus =
  | "sending"
  | "streaming"
  | "complete"
  | "error";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  updatedAt?: string;
  status: MessageStatus;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messageCount: number;
  archived: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateConversationOptions {
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageOptions {
  conversationId?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResult<T = void> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ChatContextValue {
  conversations: ChatConversation[];

  activeConversationId: string | null;

  activeConversation: ChatConversation | null;

  messages: ChatMessage[];

  isLoading: boolean;

  isInitialized: boolean;

  isStreaming: boolean;

  error: string | null;

  createConversation: (
    options?: CreateConversationOptions
  ) => Promise<ChatResult<ChatConversation>>;

  deleteConversation: (
    conversationId: string
  ) => Promise<ChatResult>;

  archiveConversation: (
    conversationId: string
  ) => Promise<ChatResult>;

  restoreConversation: (
    conversationId: string
  ) => Promise<ChatResult>;

  renameConversation: (
    conversationId: string,
    title: string
  ) => Promise<ChatResult<ChatConversation>>;

  setActiveConversation: (
    conversationId: string | null
  ) => void;

  sendMessage: (
    options: SendMessageOptions
  ) => Promise<ChatResult<ChatMessage>>;

  regenerateMessage: (
    messageId: string
  ) => Promise<ChatResult<ChatMessage>>;

  deleteMessage: (
    messageId: string
  ) => Promise<ChatResult>;

  clearMessages: (
    conversationId: string
  ) => Promise<ChatResult>;

  refreshConversations: () => Promise<void>;

  refreshMessages: (
    conversationId: string
  ) => Promise<void>;

  stopStreaming: () => void;

  clearError: () => void;
}

export interface ChatProviderProps {
  children: React.ReactNode;

  /**
   * API endpoint'lerini değiştirmek istersen
   * provider üzerinden override edebilirsin.
   */
  apiBaseUrl?: string;

  /**
   * true olduğunda API çağrıları yapılır.
   *
   * false olduğunda sadece local persistence
   * kullanılabilir.
   */
  enableApi?: boolean;
}

/* ==================================================
   CONTEXT
================================================== */

const ChatContext = createContext<
  ChatContextValue | undefined
>(undefined);

/* ==================================================
   STORAGE
================================================== */

const CHAT_STORAGE_KEY =
  "syraven-chat-conversations-v2";

const MESSAGE_STORAGE_KEY =
  "syraven-chat-messages-v2";

const ACTIVE_CONVERSATION_STORAGE_KEY =
  "syraven-active-conversation-v2";

/* ==================================================
   CONSTANTS
================================================== */

const DEFAULT_CONVERSATION_TITLE =
  "New conversation";

const MAX_TITLE_LENGTH = 120;

const MAX_MESSAGE_LENGTH = 100_000;

/* ==================================================
   HELPERS
================================================== */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function now(): string {
  return new Date().toISOString();
}

function normalizeText(
  value: string
): string {
  return value.trim().replace(/\s+/g, " ");
}

function createDefaultTitle(
  content?: string
): string {
  const normalized = normalizeText(
    content ?? ""
  );

  if (!normalized) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const maxLength = 60;

  return normalized.length > maxLength
    ? `${normalized.slice(
        0,
        maxLength
      )}…`
    : normalized;
}

function isValidMessageRole(
  value: unknown
): value is MessageRole {
  return (
    value === "user" ||
    value === "assistant" ||
    value === "system"
  );
}

function isValidMessageStatus(
  value: unknown
): value is MessageStatus {
  return (
    value === "sending" ||
    value === "streaming" ||
    value === "complete" ||
    value === "error"
  );
}

/* ==================================================
   RUNTIME VALIDATION
================================================== */

function isValidConversation(
  value: unknown
): value is ChatConversation {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const conversation =
    value as Partial<ChatConversation>;

  return (
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    typeof conversation.createdAt === "string" &&
    typeof conversation.updatedAt === "string" &&
    typeof conversation.messageCount === "number" &&
    typeof conversation.archived === "boolean"
  );
}

function isValidMessage(
  value: unknown
): value is ChatMessage {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const message =
    value as Partial<ChatMessage>;

  return (
    typeof message.id === "string" &&
    typeof message.conversationId === "string" &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string" &&
    isValidMessageRole(message.role) &&
    isValidMessageStatus(message.status)
  );
}

/* ==================================================
   STORAGE HELPERS
================================================== */

function readStorage<T>(
  key: string,
  fallback: T,
  validator?: (
    value: unknown
  ) => value is T
): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const rawValue =
      window.localStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    const parsedValue: unknown =
      JSON.parse(rawValue);

    if (
      validator &&
      !validator(parsedValue)
    ) {
      return fallback;
    }

    return parsedValue as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(
  key: string,
  value: T
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    // Storage quota veya browser privacy errors
    // uygulamanın çalışmasını engellememelidir.
  }
}

function removeStorage(
  key: string
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function getStoredConversations(): ChatConversation[] {
  const value = readStorage<unknown[]>(
    CHAT_STORAGE_KEY,
    []
  );

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    isValidConversation
  );
}

function getStoredMessages(): ChatMessage[] {
  const value = readStorage<unknown[]>(
    MESSAGE_STORAGE_KEY,
    []
  );

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isValidMessage);
}

function sortConversations(
  conversations: ChatConversation[]
): ChatConversation[] {
  return [...conversations].sort(
    (a, b) => {
      const aTime =
        new Date(
          a.lastMessageAt ??
            a.updatedAt
        ).getTime();

      const bTime =
        new Date(
          b.lastMessageAt ??
            b.updatedAt
        ).getTime();

      return bTime - aTime;
    }
  );
}

function sortMessages(
  messages: ChatMessage[]
): ChatMessage[] {
  return [...messages].sort(
    (a, b) =>
      new Date(
        a.createdAt
      ).getTime() -
      new Date(
        b.createdAt
      ).getTime()
  );
}

/* ==================================================
   API HELPERS
================================================== */

async function parseApiError(
  response: Response
): Promise<string> {
  try {
    const body: unknown =
      await response.json();

    if (
      typeof body === "object" &&
      body !== null
    ) {
      const record =
        body as Record<string, unknown>;

      if (
        typeof record.message === "string"
      ) {
        return record.message;
      }

      if (
        typeof record.error === "string"
      ) {
        return record.error;
      }
    }
  } catch {
    // Ignore JSON parsing failure.
  }

  return (
    response.statusText ||
    "Request failed"
  );
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(
    url,
    {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers ?? {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      await parseApiError(response)
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/* ==================================================
   PROVIDER
================================================== */

export function ChatProvider({
  children,
  apiBaseUrl = "/api/chat",
  enableApi = true,
}: ChatProviderProps): React.ReactElement {
  const [
    conversations,
    setConversations,
  ] = useState<ChatConversation[]>([]);

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<string | null>(null);

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isInitialized, setIsInitialized] =
    useState<boolean>(false);

  const [isStreaming, setIsStreaming] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const conversationsRef =
    useRef<ChatConversation[]>([]);

  const activeConversationIdRef =
    useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current =
      conversations;
  }, [conversations]);

  useEffect(() => {
    activeConversationIdRef.current =
      activeConversationId;
  }, [activeConversationId]);

  /* ==================================================
     DERIVED STATE
  ================================================== */

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.id ===
          activeConversationId
      ) ?? null,
    [
      conversations,
      activeConversationId,
    ]
  );

  /* ==================================================
     STATE HELPERS
  ================================================== */

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const setConversationsState =
    useCallback(
      (
        nextConversations:
          | ChatConversation[]
          | ((
              previous: ChatConversation[]
            ) => ChatConversation[])
      ): void => {
        setConversations(
          (previous) => {
            const resolved =
              typeof nextConversations ===
              "function"
                ? nextConversations(previous)
                : nextConversations;

            const sorted =
              sortConversations(resolved);

            writeStorage(
              CHAT_STORAGE_KEY,
              sorted
            );

            return sorted;
          }
        );
      },
      []
    );

  const setMessagesState = useCallback(
    (
      nextMessages:
        | ChatMessage[]
        | ((
            previous: ChatMessage[]
          ) => ChatMessage[])
    ): void => {
      setMessages((previous) => {
        const resolved =
          typeof nextMessages === "function"
            ? nextMessages(previous)
            : nextMessages;

        return sortMessages(resolved);
      });
    },
    []
  );

  /* ==================================================
     INITIALIZATION
  ================================================== */

  const refreshConversations =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        if (enableApi) {
          try {
            const data =
              await apiRequest<
                ChatConversation[]
              >(
                `${apiBaseUrl}/conversations`
              );

            const validData =
              Array.isArray(data)
                ? data.filter(
                    isValidConversation
                  )
                : [];

            setConversationsState(
              validData
            );

            return;
          } catch {
            /*
             * API geçici olarak erişilemezse
             * local cache fallback yapılır.
             */
          }
        }

        const stored =
          getStoredConversations();

        setConversationsState(stored);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load conversations";

        setError(message);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, [
      apiBaseUrl,
      enableApi,
      setConversationsState,
    ]);

  const refreshMessages = useCallback(
    async (
      conversationId: string
    ): Promise<void> => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      setError(null);

      try {
        if (enableApi) {
          try {
            const data =
              await apiRequest<
                ChatMessage[]
              >(
                `${apiBaseUrl}/conversations/${encodeURIComponent(
                  conversationId
                )}/messages`
              );

            const validData =
              Array.isArray(data)
                ? data.filter(isValidMessage)
                : [];

            writeStorage(
              MESSAGE_STORAGE_KEY,
              validData
            );

            setMessagesState(validData);

            return;
          } catch {
            /*
             * Local fallback.
             */
          }
        }

        const stored =
          getStoredMessages();

        const filtered =
          stored.filter(
            (message) =>
              message.conversationId ===
              conversationId
          );

        setMessagesState(filtered);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load messages";

        setError(message);
      }
    },
    [
      apiBaseUrl,
      enableApi,
      setMessagesState,
    ]
  );

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    void refreshMessages(
      activeConversationId
    );
  }, [
    activeConversationId,
    refreshMessages,
  ]);

  /* ==================================================
     ACTIVE CONVERSATION PERSISTENCE
  ================================================== */

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    if (!activeConversationId) {
      removeStorage(
        ACTIVE_CONVERSATION_STORAGE_KEY
      );

      return;
    }

    writeStorage(
      ACTIVE_CONVERSATION_STORAGE_KEY,
      activeConversationId
    );
  }, [activeConversationId]);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const stored =
      readStorage<string | null>(
        ACTIVE_CONVERSATION_STORAGE_KEY,
        null
      );

    if (stored) {
      setActiveConversationId(stored);
    }
  }, []);

  /* ==================================================
     CROSS TAB SYNCHRONIZATION
  ================================================== */

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        event.key === CHAT_STORAGE_KEY
      ) {
        const stored =
          getStoredConversations();

        setConversations(
          sortConversations(stored)
        );
      }

      if (
        event.key === MESSAGE_STORAGE_KEY &&
        activeConversationIdRef.current
      ) {
        const stored =
          getStoredMessages();

        const filtered =
          stored.filter(
            (message) =>
              message.conversationId ===
              activeConversationIdRef.current
          );

        setMessages(
          sortMessages(filtered)
        );
      }

      if (
        event.key ===
        ACTIVE_CONVERSATION_STORAGE_KEY
      ) {
        const value =
          event.newValue;

        setActiveConversationId(
          value || null
        );
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  /* ==================================================
     CLEANUP
  ================================================== */

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /* ==================================================
     CREATE CONVERSATION
  ================================================== */

  const createConversation =
    useCallback(
      async (
        options: CreateConversationOptions = {}
      ): Promise<
        ChatResult<ChatConversation>
      > => {
        setError(null);

        try {
          const title =
            options.title
              ? normalizeText(
                  options.title
                )
              : DEFAULT_CONVERSATION_TITLE;

          const normalizedTitle =
            title.slice(
              0,
              MAX_TITLE_LENGTH
            ) ||
            DEFAULT_CONVERSATION_TITLE;

          if (enableApi) {
            try {
              const conversation =
                await apiRequest<ChatConversation>(
                  `${apiBaseUrl}/conversations`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      title: normalizedTitle,
                      metadata:
                        options.metadata,
                    }),
                  }
                );

              if (
                !isValidConversation(
                  conversation
                )
              ) {
                throw new Error(
                  "Invalid conversation response"
                );
              }

              setConversationsState(
                (previous) => [
                  conversation,
                  ...previous,
                ]
              );

              setActiveConversationId(
                conversation.id
              );

              return {
                success: true,
                data: conversation,
              };
            } catch {
              /*
               * Offline/local fallback.
               */
            }
          }

          const timestamp = now();

          const conversation: ChatConversation =
            {
              id: createId("conversation"),
              title: normalizedTitle,
              createdAt: timestamp,
              updatedAt: timestamp,
              lastMessageAt: timestamp,
              messageCount: 0,
              archived: false,
              metadata: options.metadata,
            };

          setConversationsState(
            (previous) => [
              conversation,
              ...previous,
            ]
          );

          setActiveConversationId(
            conversation.id
          );

          return {
            success: true,
            data: conversation,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to create conversation";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
      ]
    );

  /* ==================================================
     SET ACTIVE CONVERSATION
  ================================================== */

  const setActiveConversation =
    useCallback(
      (
        conversationId: string | null
      ): void => {
        setError(null);
        setActiveConversationId(
          conversationId
        );
      },
      []
    );

  /* ==================================================
     RENAME CONVERSATION
  ================================================== */

  const renameConversation =
    useCallback(
      async (
        conversationId: string,
        title: string
      ): Promise<
        ChatResult<ChatConversation>
      > => {
        setError(null);

        try {
          const normalizedTitle =
            normalizeText(title).slice(
              0,
              MAX_TITLE_LENGTH
            );

          if (!normalizedTitle) {
            throw new Error(
              "Conversation title cannot be empty"
            );
          }

          const existing =
            conversationsRef.current.find(
              (conversation) =>
                conversation.id ===
                conversationId
            );

          if (!existing) {
            throw new Error(
              "Conversation not found"
            );
          }

          let updatedConversation:
            ChatConversation = {
              ...existing,
              title: normalizedTitle,
              updatedAt: now(),
            };

          if (enableApi) {
            try {
              const response =
                await apiRequest<ChatConversation>(
                  `${apiBaseUrl}/conversations/${encodeURIComponent(
                    conversationId
                  )}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify({
                      title: normalizedTitle,
                    }),
                  }
                );

              if (
                isValidConversation(
                  response
                )
              ) {
                updatedConversation =
                  response;
              }
            } catch {
              /*
               * Keep local update.
               */
            }
          }

          setConversationsState(
            (previous) =>
              previous.map(
                (conversation) =>
                  conversation.id ===
                  conversationId
                    ? updatedConversation
                    : conversation
              )
          );

          return {
            success: true,
            data: updatedConversation,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to rename conversation";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
      ]
    );

  /* ==================================================
     DELETE CONVERSATION
  ================================================== */

  const deleteConversation =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        setError(null);

        try {
          if (!conversationId) {
            throw new Error(
              "Conversation ID is required"
            );
          }

          if (enableApi) {
            try {
              await apiRequest<void>(
                `${apiBaseUrl}/conversations/${encodeURIComponent(
                  conversationId
                )}`,
                {
                  method: "DELETE",
                }
              );
            } catch {
              /*
               * Local deletion still proceeds.
               */
            }
          }

          setConversationsState(
            (previous) =>
              previous.filter(
                (conversation) =>
                  conversation.id !==
                  conversationId
              )
          );

          const allMessages =
            getStoredMessages();

          const nextMessages =
            allMessages.filter(
              (message) =>
                message.conversationId !==
                conversationId
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextMessages
          );

          if (
            activeConversationIdRef.current ===
            conversationId
          ) {
            setActiveConversationId(
              null
            );

            setMessages([]);
          }

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to delete conversation";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
      ]
    );

  /* ==================================================
     ARCHIVE CONVERSATION
  ================================================== */

  const archiveConversation =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        setError(null);

        try {
          const existing =
            conversationsRef.current.find(
              (conversation) =>
                conversation.id ===
                conversationId
            );

          if (!existing) {
            throw new Error(
              "Conversation not found"
            );
          }

          const updatedConversation:
            ChatConversation = {
              ...existing,
              archived: true,
              updatedAt: now(),
            };

          if (enableApi) {
            try {
              await apiRequest<ChatConversation>(
                `${apiBaseUrl}/conversations/${encodeURIComponent(
                  conversationId
                )}`,
                {
                  method: "PATCH",
                  body: JSON.stringify({
                    archived: true,
                  }),
                }
              );
            } catch {
              // Local fallback.
            }
          }

          setConversationsState(
            (previous) =>
              previous.map(
                (conversation) =>
                  conversation.id ===
                  conversationId
                    ? updatedConversation
                    : conversation
              )
          );

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to archive conversation";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
      ]
    );

  /* ==================================================
     RESTORE CONVERSATION
  ================================================== */

  const restoreConversation =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        setError(null);

        try {
          const existing =
            conversationsRef.current.find(
              (conversation) =>
                conversation.id ===
                conversationId
            );

          if (!existing) {
            throw new Error(
              "Conversation not found"
            );
          }

          const updatedConversation:
            ChatConversation = {
              ...existing,
              archived: false,
              updatedAt: now(),
            };

          if (enableApi) {
            try {
              await apiRequest<ChatConversation>(
                `${apiBaseUrl}/conversations/${encodeURIComponent(
                  conversationId
                )}`,
                {
                  method: "PATCH",
                  body: JSON.stringify({
                    archived: false,
                  }),
                }
              );
            } catch {
              // Local fallback.
            }
          }

          setConversationsState(
            (previous) =>
              previous.map(
                (conversation) =>
                  conversation.id ===
                  conversationId
                    ? updatedConversation
                    : conversation
              )
          );

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to restore conversation";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
      ]
    );

  /* ==================================================
     SEND MESSAGE
  ================================================== */

  const sendMessage = useCallback(
    async (
      options: SendMessageOptions
    ): Promise<
      ChatResult<ChatMessage>
    > => {
      setError(null);

      const normalizedContent =
        options.content.trim();

      if (!normalizedContent) {
        const message =
          "Message content cannot be empty";

        setError(message);

        return {
          success: false,
          message,
        };
      }

      if (
        normalizedContent.length >
        MAX_MESSAGE_LENGTH
      ) {
        const message =
          `Message exceeds the maximum allowed length of ${MAX_MESSAGE_LENGTH} characters`;

        setError(message);

        return {
          success: false,
          message,
        };
      }

      if (isStreaming) {
        const message =
          "Please wait for the current response to finish";

        setError(message);

        return {
          success: false,
          message,
        };
      }

      let conversationId =
        options.conversationId ??
        activeConversationIdRef.current;

      try {
        /*
         * Eğer conversation yoksa oluştur.
         */

        if (!conversationId) {
          const timestamp = now();

          const conversation: ChatConversation =
            {
              id: createId("conversation"),
              title:
                createDefaultTitle(
                  normalizedContent
                ),
              createdAt: timestamp,
              updatedAt: timestamp,
              lastMessageAt: timestamp,
              messageCount: 0,
              archived: false,
            };

          conversationId =
            conversation.id;

          setConversationsState(
            (previous) => [
              conversation,
              ...previous,
            ]
          );

          setActiveConversationId(
            conversationId
          );
        }

        const timestamp = now();

        const userMessage: ChatMessage =
          {
            id: createId("message"),
            conversationId,
            role: "user",
            content: normalizedContent,
            createdAt: timestamp,
            status: "sending",
            metadata: options.metadata,
          };

        /*
         * Optimistic UI update.
         */

        if (
          activeConversationIdRef.current ===
            conversationId ||
          !activeConversationIdRef.current
        ) {
          setMessagesState(
            (previous) => [
              ...previous,
              userMessage,
            ]
          );
        }

        /*
         * Global message persistence.
         */

        const allMessages =
          getStoredMessages();

        const messagesWithUser = [
          ...allMessages,
          userMessage,
        ];

        writeStorage(
          MESSAGE_STORAGE_KEY,
          messagesWithUser
        );

        /*
         * Conversation metadata update.
         */

        const messageTime = now();

        setConversationsState(
          (previous) =>
            previous.map(
              (conversation) =>
                conversation.id ===
                conversationId
                  ? {
                      ...conversation,
                      title:
                        conversation.messageCount ===
                        0
                          ? createDefaultTitle(
                              normalizedContent
                            )
                          : conversation.title,
                      updatedAt:
                        messageTime,
                      lastMessageAt:
                        messageTime,
                      messageCount:
                        conversation.messageCount +
                        1,
                    }
                  : conversation
            )
        );

        /*
         * API MESSAGE REQUEST
         */

        let finalUserMessage:
          ChatMessage = {
            ...userMessage,
            status: "complete",
          };

        if (enableApi) {
          const controller =
            new AbortController();

          abortControllerRef.current =
            controller;

          setIsStreaming(true);

          try {
            const response =
              await fetch(
                `${apiBaseUrl}/messages`,
                {
                  method: "POST",
                  credentials: "include",
                  signal:
                    controller.signal,
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    conversationId,
                    content:
                      normalizedContent,
                    metadata:
                      options.metadata,
                  }),
                }
              );

            if (!response.ok) {
              throw new Error(
                await parseApiError(
                  response
                )
              );
            }

            /*
             * Server JSON response format:
             *
             * {
             *   userMessage?: ChatMessage,
             *   assistantMessage?: ChatMessage
             * }
             */

            const contentType =
              response.headers.get(
                "content-type"
              ) ?? "";

            if (
              contentType.includes(
                "application/json"
              )
            ) {
              const result: unknown =
                await response.json();

              if (
                typeof result === "object" &&
                result !== null
              ) {
                const payload =
                  result as Record<
                    string,
                    unknown
                  >;

                if (
                  isValidMessage(
                    payload.userMessage
                  )
                ) {
                  finalUserMessage =
                    payload.userMessage;
                }

                if (
                  isValidMessage(
                    payload.assistantMessage
                  )
                ) {
                  const assistantMessage =
                    payload.assistantMessage;

                  const stored =
                    getStoredMessages();

                  writeStorage(
                    MESSAGE_STORAGE_KEY,
                    [
                      ...stored.filter(
                        (message) =>
                          message.id !==
                          assistantMessage.id
                      ),
                      assistantMessage,
                    ]
                  );

                  if (
                    activeConversationIdRef.current ===
                    conversationId
                  ) {
                    setMessagesState(
                      (previous) => [
                        ...previous.filter(
                          (message) =>
                            message.id !==
                            assistantMessage.id
                        ),
                        assistantMessage,
                      ]
                    );
                  }

                  setConversationsState(
                    (previous) =>
                      previous.map(
                        (
                          conversation
                        ) =>
                          conversation.id ===
                          conversationId
                            ? {
                                ...conversation,
                                messageCount:
                                  conversation.messageCount +
                                  1,
                                updatedAt:
                                  now(),
                                lastMessageAt:
                                  now(),
                              }
                            : conversation
                      )
                  );
                }
              }
            }
          } catch (caughtError) {
            if (
              caughtError instanceof DOMException &&
              caughtError.name ===
                "AbortError"
            ) {
              finalUserMessage = {
                ...userMessage,
                status: "complete",
              };
            } else {
              throw caughtError;
            }
          } finally {
            if (
              abortControllerRef.current ===
              controller
            ) {
              abortControllerRef.current =
                null;
            }

            setIsStreaming(false);
          }
        }

        /*
         * Complete optimistic message.
         */

        const finalAllMessages =
          getStoredMessages().map(
            (message) =>
              message.id === userMessage.id
                ? finalUserMessage
                : message
          );

        writeStorage(
          MESSAGE_STORAGE_KEY,
          finalAllMessages
        );

        setMessagesState(
          (previous) =>
            previous.map(
              (message) =>
                message.id === userMessage.id
                  ? finalUserMessage
                  : message
            )
        );

        return {
          success: true,
          data: finalUserMessage,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to send message";

        setError(message);

        /*
         * Eğer kullanıcı mesajı oluştuysa
         * hata state'ine geçir.
         */

        if (conversationId) {
          const stored =
            getStoredMessages();

          const failedMessages =
            stored.map(
              (storedMessage) =>
                storedMessage.conversationId ===
                  conversationId &&
                storedMessage.role === "user" &&
                storedMessage.content ===
                  normalizedContent &&
                storedMessage.status ===
                  "sending"
                  ? {
                      ...storedMessage,
                      status:
                        "error" as MessageStatus,
                      error: message,
                      updatedAt: now(),
                    }
                  : storedMessage
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            failedMessages
          );

          if (
            activeConversationIdRef.current ===
            conversationId
          ) {
            setMessagesState(
              (previous) =>
                previous.map(
                  (currentMessage) =>
                    currentMessage.conversationId ===
                      conversationId &&
                    currentMessage.role ===
                      "user" &&
                    currentMessage.content ===
                      normalizedContent &&
                    currentMessage.status ===
                      "sending"
                      ? {
                          ...currentMessage,
                          status:
                            "error" as MessageStatus,
                          error: message,
                          updatedAt: now(),
                        }
                      : currentMessage
                )
            );
          }
        }

        return {
          success: false,
          message,
        };
      } finally {
        setIsStreaming(false);
      }
    },
    [
      apiBaseUrl,
      enableApi,
      isStreaming,
      setConversationsState,
      setMessagesState,
    ]
  );

  /* ==================================================
     REGENERATE MESSAGE
  ================================================== */

  const regenerateMessage =
    useCallback(
      async (
        messageId: string
      ): Promise<
        ChatResult<ChatMessage>
      > => {
        setError(null);

        if (isStreaming) {
          return {
            success: false,
            message:
              "Another response is already streaming",
          };
        }

        setIsStreaming(true);

        try {
          const storedMessages =
            getStoredMessages();

          const originalMessage =
            storedMessages.find(
              (message) =>
                message.id === messageId
            );

          if (!originalMessage) {
            throw new Error(
              "Message not found"
            );
          }

          if (
            originalMessage.role !==
            "assistant"
          ) {
            throw new Error(
              "Only assistant messages can be regenerated"
            );
          }

          if (!enableApi) {
            throw new Error(
              "Message regeneration requires API integration"
            );
          }

          const controller =
            new AbortController();

          abortControllerRef.current =
            controller;

          const response =
            await apiRequest<ChatMessage>(
              `${apiBaseUrl}/messages/${encodeURIComponent(
                messageId
              )}/regenerate`,
              {
                method: "POST",
                signal:
                  controller.signal,
              }
            );

          if (!isValidMessage(response)) {
            throw new Error(
              "Invalid regenerated message response"
            );
          }

          const nextStored =
            storedMessages.map(
              (message) =>
                message.id === messageId
                  ? response
                  : message
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextStored
          );

          if (
            activeConversationIdRef.current ===
            response.conversationId
          ) {
            setMessagesState(
              (previous) =>
                previous.map(
                  (message) =>
                    message.id === messageId
                      ? response
                      : message
                )
            );
          }

          return {
            success: true,
            data: response,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to regenerate message";

          setError(message);

          return {
            success: false,
            message,
          };
        } finally {
          abortControllerRef.current = null;
          setIsStreaming(false);
        }
      },
      [
        apiBaseUrl,
        enableApi,
        isStreaming,
        setMessagesState,
      ]
    );

  /* ==================================================
     DELETE MESSAGE
  ================================================== */

  const deleteMessage =
    useCallback(
      async (
        messageId: string
      ): Promise<ChatResult> => {
        setError(null);

        try {
          const allMessages =
            getStoredMessages();

          const target =
            allMessages.find(
              (message) =>
                message.id === messageId
            );

          if (!target) {
            throw new Error(
              "Message not found"
            );
          }

          if (enableApi) {
            try {
              await apiRequest<void>(
                `${apiBaseUrl}/messages/${encodeURIComponent(
                  messageId
                )}`,
                {
                  method: "DELETE",
                }
              );
            } catch {
              // Local deletion fallback.
            }
          }

          const nextMessages =
            allMessages.filter(
              (message) =>
                message.id !== messageId
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextMessages
          );

          if (
            activeConversationIdRef.current ===
            target.conversationId
          ) {
            setMessagesState(
              (previous) =>
                previous.filter(
                  (message) =>
                    message.id !== messageId
                )
            );
          }

          setConversationsState(
            (previous) =>
              previous.map(
                (conversation) =>
                  conversation.id ===
                  target.conversationId
                    ? {
                        ...conversation,
                        messageCount:
                          Math.max(
                            0,
                            conversation.messageCount -
                              1
                          ),
                        updatedAt: now(),
                      }
                    : conversation
              )
          );

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to delete message";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
        setMessagesState,
      ]
    );

  /* ==================================================
     CLEAR MESSAGES
  ================================================== */

  const clearMessages =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        setError(null);

        try {
          if (enableApi) {
            try {
              await apiRequest<void>(
                `${apiBaseUrl}/conversations/${encodeURIComponent(
                  conversationId
                )}/messages`,
                {
                  method: "DELETE",
                }
              );
            } catch {
              // Local fallback.
            }
          }

          const allMessages =
            getStoredMessages();

          const nextMessages =
            allMessages.filter(
              (message) =>
                message.conversationId !==
                conversationId
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextMessages
          );

          if (
            activeConversationIdRef.current ===
            conversationId
          ) {
            setMessages([]);
          }

          setConversationsState(
            (previous) =>
              previous.map(
                (conversation) =>
                  conversation.id ===
                  conversationId
                    ? {
                        ...conversation,
                        messageCount: 0,
                        updatedAt: now(),
                        lastMessageAt:
                          undefined,
                      }
                    : conversation
              )
          );

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to clear messages";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        apiBaseUrl,
        enableApi,
        setConversationsState,
      ]
    );

  /* ==================================================
     STOP STREAMING
  ================================================== */

  const stopStreaming = useCallback(
    (): void => {
      abortControllerRef.current?.abort();

      abortControllerRef.current = null;

      setIsStreaming(false);

      const stored =
        getStoredMessages();

      const updatedStored =
        stored.map(
          (message) =>
            message.status === "streaming"
              ? {
                  ...message,
                  status:
                    "complete" as MessageStatus,
                  updatedAt: now(),
                }
              : message
        );

      writeStorage(
        MESSAGE_STORAGE_KEY,
        updatedStored
      );

      setMessagesState(
        (previous) =>
          previous.map(
            (message) =>
              message.status ===
              "streaming"
                ? {
                    ...message,
                    status:
                      "complete" as MessageStatus,
                    updatedAt: now(),
                  }
                : message
          )
      );
    },
    [setMessagesState]
  );

  /* ==================================================
     CONTEXT VALUE
  ================================================== */

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      activeConversationId,
      activeConversation,
      messages,
      isLoading,
      isInitialized,
      isStreaming,
      error,

      createConversation,
      deleteConversation,
      archiveConversation,
      restoreConversation,
      renameConversation,

      setActiveConversation,

      sendMessage,
      regenerateMessage,

      deleteMessage,
      clearMessages,

      refreshConversations,
      refreshMessages,

      stopStreaming,
      clearError,
    }),
    [
      conversations,
      activeConversationId,
      activeConversation,
      messages,
      isLoading,
      isInitialized,
      isStreaming,
      error,
      createConversation,
      deleteConversation,
      archiveConversation,
      restoreConversation,
      renameConversation,
      setActiveConversation,
      sendMessage,
      regenerateMessage,
      deleteMessage,
      clearMessages,
      refreshConversations,
      refreshMessages,
      stopStreaming,
      clearError,
    ]
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

/* ==================================================
   HOOKS
================================================== */

export function useChatContext(): ChatContextValue {
  const context =
    useContext(ChatContext);

  if (!context) {
    throw new Error(
      "useChatContext must be used within a ChatProvider"
    );
  }

  return context;
}

export function useChat(): ChatContextValue {
  return useChatContext();
}