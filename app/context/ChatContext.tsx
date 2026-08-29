"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
}

const ChatContext = createContext<
  ChatContextValue | undefined
>(undefined);

const CHAT_STORAGE_KEY =
  "nova-chat-conversations";

const MESSAGE_STORAGE_KEY =
  "nova-chat-messages";

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

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readStorage<T>(
  key: string,
  fallback: T
): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const value =
      window.localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
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
    // Storage failures must not break chat state.
  }
}

function createDefaultTitle(
  content?: string
): string {
  if (!content?.trim()) {
    return "New conversation";
  }

  const normalized =
    content.trim().replace(/\s+/g, " ");

  return normalized.length > 48
    ? `${normalized.slice(0, 48)}...`
    : normalized;
}

export function ChatProvider({
  children,
}: ChatProviderProps): React.ReactElement {
  const [conversations, setConversations] =
    useState<ChatConversation[]>([]);

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

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

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

  const persistConversations =
    useCallback(
      (
        nextConversations: ChatConversation[]
      ): void => {
        setConversations(nextConversations);

        writeStorage(
          CHAT_STORAGE_KEY,
          nextConversations
        );
      },
      []
    );

  const persistMessages =
    useCallback(
      (
        nextMessages: ChatMessage[]
      ): void => {
        setMessages(nextMessages);

        writeStorage(
          MESSAGE_STORAGE_KEY,
          nextMessages
        );
      },
      []
    );

  const refreshConversations =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production integration:
         *
         * const response = await fetch(
         *   "/api/chat/conversations",
         *   {
         *     credentials: "include",
         *   }
         * );
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to load conversations"
         *   );
         * }
         *
         * const data =
         *   (await response.json()) as ChatConversation[];
         */

        const storedConversations =
          readStorage<ChatConversation[]>(
            CHAT_STORAGE_KEY,
            []
          );

        setConversations(
          storedConversations
        );
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
    }, []);

  const refreshMessages = useCallback(
    async (
      conversationId: string
    ): Promise<void> => {
      setError(null);

      try {
        /*
         * Production integration:
         *
         * const response = await fetch(
         *   `/api/chat/conversations/${conversationId}/messages`,
         *   {
         *     credentials: "include",
         *   }
         * );
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to load messages"
         *   );
         * }
         *
         * const data =
         *   (await response.json()) as ChatMessage[];
         */

        const storedMessages =
          readStorage<ChatMessage[]>(
            MESSAGE_STORAGE_KEY,
            []
          );

        const conversationMessages =
          storedMessages.filter(
            (message) =>
              message.conversationId ===
              conversationId
          );

        setMessages(
          conversationMessages
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load messages";

        setError(message);
      }
    },
    []
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

  const createConversation =
    useCallback(
      async (
        options: CreateConversationOptions = {}
      ): Promise<
        ChatResult<ChatConversation>
      > => {
        setError(null);

        try {
          const now =
            new Date().toISOString();

          const conversation: ChatConversation =
            {
              id: createId("conversation"),
              title:
                options.title?.trim() ||
                "New conversation",
              createdAt: now,
              updatedAt: now,
              lastMessageAt: now,
              messageCount: 0,
              archived: false,
              metadata: options.metadata,
            };

          /*
           * Production integration:
           *
           * POST /api/chat/conversations
           */

          const nextConversations = [
            conversation,
            ...conversations,
          ];

          persistConversations(
            nextConversations
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
        conversations,
        persistConversations,
      ]
    );

  const setActiveConversation =
    useCallback(
      (
        conversationId: string | null
      ): void => {
        setActiveConversationId(
          conversationId
        );
      },
      []
    );

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
            title.trim();

          if (!normalizedTitle) {
            throw new Error(
              "Conversation title cannot be empty"
            );
          }

          const updatedAt =
            new Date().toISOString();

          let updatedConversation:
            | ChatConversation
            | null = null;

          const nextConversations =
            conversations.map(
              (conversation) => {
                if (
                  conversation.id !==
                  conversationId
                ) {
                  return conversation;
                }

                updatedConversation = {
                  ...conversation,
                  title: normalizedTitle,
                  updatedAt,
                };

                return updatedConversation;
              }
            );

          if (!updatedConversation) {
            throw new Error(
              "Conversation not found"
            );
          }

          persistConversations(
            nextConversations
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
        conversations,
        persistConversations,
      ]
    );

  const deleteConversation =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        setError(null);

        try {
          /*
           * Production integration:
           *
           * DELETE /api/chat/conversations/:id
           */

          const nextConversations =
            conversations.filter(
              (conversation) =>
                conversation.id !==
                conversationId
            );

          persistConversations(
            nextConversations
          );

          const allMessages =
            readStorage<ChatMessage[]>(
              MESSAGE_STORAGE_KEY,
              []
            );

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
            activeConversationId ===
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
        conversations,
        persistConversations,
        activeConversationId,
      ]
    );

  const archiveConversation =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        try {
          const updatedAt =
            new Date().toISOString();

          const nextConversations =
            conversations.map(
              (conversation) =>
                conversation.id ===
                conversationId
                  ? {
                      ...conversation,
                      archived: true,
                      updatedAt,
                    }
                  : conversation
            );

          persistConversations(
            nextConversations
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
        conversations,
        persistConversations,
      ]
    );

  const restoreConversation =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        try {
          const updatedAt =
            new Date().toISOString();

          const nextConversations =
            conversations.map(
              (conversation) =>
                conversation.id ===
                conversationId
                  ? {
                      ...conversation,
                      archived: false,
                      updatedAt,
                    }
                  : conversation
            );

          persistConversations(
            nextConversations
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
        conversations,
        persistConversations,
      ]
    );

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

      try {
        let conversationId =
          options.conversationId ??
          activeConversationId;

        let nextConversations = [
          ...conversations,
        ];

        if (!conversationId) {
          const now =
            new Date().toISOString();

          const conversation: ChatConversation =
            {
              id: createId("conversation"),
              title:
                createDefaultTitle(
                  normalizedContent
                ),
              createdAt: now,
              updatedAt: now,
              lastMessageAt: now,
              messageCount: 0,
              archived: false,
            };

          conversationId =
            conversation.id;

          nextConversations = [
            conversation,
            ...nextConversations,
          ];

          persistConversations(
            nextConversations
          );

          setActiveConversationId(
            conversationId
          );
        }

        const now =
          new Date().toISOString();

        const userMessage: ChatMessage =
          {
            id: createId("message"),
            conversationId,
            role: "user",
            content: normalizedContent,
            createdAt: now,
            status: "sending",
            metadata: options.metadata,
          };

        const allMessages =
          readStorage<ChatMessage[]>(
            MESSAGE_STORAGE_KEY,
            []
          );

        const nextAllMessages = [
          ...allMessages,
          userMessage,
        ];

        writeStorage(
          MESSAGE_STORAGE_KEY,
          nextAllMessages
        );

        if (
          activeConversationId ===
            conversationId ||
          !activeConversationId
        ) {
          setMessages((current) => [
            ...current,
            userMessage,
          ]);
        }

        const completedUserMessage: ChatMessage =
          {
            ...userMessage,
            status: "complete",
          };

        const completedMessages =
          nextAllMessages.map(
            (message) =>
              message.id === userMessage.id
                ? completedUserMessage
                : message
          );

        writeStorage(
          MESSAGE_STORAGE_KEY,
          completedMessages
        );

        setMessages((current) =>
          current.map(
            (message) =>
              message.id === userMessage.id
                ? completedUserMessage
                : message
          )
        );

        const updatedAt =
          new Date().toISOString();

        const updatedConversations =
          nextConversations.map(
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
                    updatedAt,
                    lastMessageAt: updatedAt,
                    messageCount:
                      conversation.messageCount +
                      1,
                  }
                : conversation
          );

        persistConversations(
          updatedConversations
        );

        /*
         * Production AI streaming integration:
         *
         * POST /api/chat/messages
         *
         * const response = await fetch(
         *   "/api/chat/messages",
         *   {
         *     method: "POST",
         *     headers: {
         *       "Content-Type": "application/json",
         *     },
         *     credentials: "include",
         *     body: JSON.stringify({
         *       conversationId,
         *       content: normalizedContent,
         *     }),
         *   }
         * );
         *
         * The streaming response can update
         * an assistant message incrementally.
         */

        return {
          success: true,
          data: completedUserMessage,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to send message";

        setError(message);

        return {
          success: false,
          message,
        };
      }
    },
    [
      activeConversationId,
      conversations,
      persistConversations,
    ]
  );

  const regenerateMessage =
    useCallback(
      async (
        messageId: string
      ): Promise<
        ChatResult<ChatMessage>
      > => {
        setError(null);
        setIsStreaming(true);

        try {
          const allMessages =
            readStorage<ChatMessage[]>(
              MESSAGE_STORAGE_KEY,
              []
            );

          const messageIndex =
            allMessages.findIndex(
              (message) =>
                message.id === messageId
            );

          if (messageIndex < 0) {
            throw new Error(
              "Message not found"
            );
          }

          const originalMessage =
            allMessages[messageIndex];

          if (
            originalMessage.role !==
            "assistant"
          ) {
            throw new Error(
              "Only assistant messages can be regenerated"
            );
          }

          const updatedMessage: ChatMessage =
            {
              ...originalMessage,
              content: "",
              status: "streaming",
              updatedAt:
                new Date().toISOString(),
              error: null,
            };

          const nextMessages =
            allMessages.map(
              (message) =>
                message.id === messageId
                  ? updatedMessage
                  : message
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextMessages
          );

          setMessages((current) =>
            current.map(
              (message) =>
                message.id === messageId
                  ? updatedMessage
                  : message
            )
          );

          /*
           * Production regeneration endpoint:
           *
           * POST /api/chat/messages/:id/regenerate
           */

          const completedMessage: ChatMessage =
            {
              ...updatedMessage,
              status: "complete",
            };

          const completedMessages =
            nextMessages.map(
              (message) =>
                message.id === messageId
                  ? completedMessage
                  : message
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            completedMessages
          );

          setMessages((current) =>
            current.map(
              (message) =>
                message.id === messageId
                  ? completedMessage
                  : message
            )
          );

          return {
            success: true,
            data: completedMessage,
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
          setIsStreaming(false);
        }
      },
      []
    );

  const deleteMessage =
    useCallback(
      async (
        messageId: string
      ): Promise<ChatResult> => {
        try {
          const allMessages =
            readStorage<ChatMessage[]>(
              MESSAGE_STORAGE_KEY,
              []
            );

          const targetMessage =
            allMessages.find(
              (message) =>
                message.id === messageId
            );

          if (!targetMessage) {
            throw new Error(
              "Message not found"
            );
          }

          const nextAllMessages =
            allMessages.filter(
              (message) =>
                message.id !== messageId
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextAllMessages
          );

          setMessages((current) =>
            current.filter(
              (message) =>
                message.id !== messageId
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
      []
    );

  const clearMessages =
    useCallback(
      async (
        conversationId: string
      ): Promise<ChatResult> => {
        try {
          const allMessages =
            readStorage<ChatMessage[]>(
              MESSAGE_STORAGE_KEY,
              []
            );

          const nextAllMessages =
            allMessages.filter(
              (message) =>
                message.conversationId !==
                conversationId
            );

          writeStorage(
            MESSAGE_STORAGE_KEY,
            nextAllMessages
          );

          if (
            activeConversationId ===
            conversationId
          ) {
            setMessages([]);
          }

          const nextConversations =
            conversations.map(
              (conversation) =>
                conversation.id ===
                conversationId
                  ? {
                      ...conversation,
                      messageCount: 0,
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : conversation
            );

          persistConversations(
            nextConversations
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
        activeConversationId,
        conversations,
        persistConversations,
      ]
    );

  const stopStreaming = useCallback((): void => {
    setIsStreaming(false);

    setMessages((current) =>
      current.map((message) =>
        message.status === "streaming"
          ? {
              ...message,
              status: "complete",
              updatedAt:
                new Date().toISOString(),
            }
          : message
      )
    );
  }, []);

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

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);

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