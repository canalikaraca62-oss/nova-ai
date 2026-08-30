/**
 * SYRAVEN Chat Service
 *
 * Enterprise-grade in-memory chat domain service.
 *
 * Features:
 * - Conversations
 * - Messages
 * - Participants
 * - Metadata
 * - Message lifecycle
 * - Conversation lifecycle
 * - Pagination
 * - Search
 * - Strict TypeScript compatibility
 * - Framework-independent architecture
 *
 * Persistence should be implemented behind this service boundary
 * in production infrastructure.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ChatRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export type MessageStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";

export type ConversationStatus =
  | "active"
  | "archived"
  | "deleted";

export interface ChatParticipant {
  id: string;
  name?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;

  conversationId: string;

  role: ChatRole;

  content: string;

  status: MessageStatus;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface ChatConversation {
  id: string;

  userId: string;

  title: string;

  status: ConversationStatus;

  participants: ChatParticipant[];

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface CreateConversationInput {
  userId: string;

  title?: string;

  participants?: ChatParticipant[];

  metadata?: Record<string, unknown>;
}

export interface UpdateConversationInput {
  title?: string;

  status?: ConversationStatus;

  participants?: ChatParticipant[];

  metadata?: Record<string, unknown>;
}

export interface CreateMessageInput {
  conversationId: string;

  role: ChatRole;

  content: string;

  status?: MessageStatus;

  metadata?: Record<string, unknown>;
}

export interface UpdateMessageInput {
  content?: string;

  status?: MessageStatus;

  metadata?: Record<string, unknown>;
}

export interface ChatPaginationOptions {
  limit?: number;

  offset?: number;
}

export interface PaginatedChatMessages {
  messages: ChatMessage[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface ChatSearchOptions
  extends ChatPaginationOptions {
  query: string;

  conversationId?: string;

  userId?: string;

  role?: ChatRole;
}

/* -------------------------------------------------------------------------- */
/*                              ERROR TYPES                                   */
/* -------------------------------------------------------------------------- */

export class ChatServiceError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "ChatServiceError";
  }
}

export class ConversationNotFoundError
  extends ChatServiceError {
  constructor(
    conversationId: string
  ) {
    super(
      `Conversation not found: ${conversationId}`
    );

    this.name =
      "ConversationNotFoundError";
  }
}

export class MessageNotFoundError
  extends ChatServiceError {
  constructor(
    messageId: string
  ) {
    super(
      `Message not found: ${messageId}`
    );

    this.name =
      "MessageNotFoundError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_MESSAGE_LIMIT =
  50;

const MAX_MESSAGE_LIMIT =
  500;

const DEFAULT_TITLE =
  "New conversation";

/* -------------------------------------------------------------------------- */
/*                               CHAT SERVICE                                 */
/* -------------------------------------------------------------------------- */

export class ChatService {
  private readonly conversations =
    new Map<
      string,
      ChatConversation
    >();

  private readonly messages =
    new Map<
      string,
      ChatMessage[]
    >();

  /* ------------------------------------------------------------------------ */
  /*                             CONVERSATIONS                                */
  /* ------------------------------------------------------------------------ */

  createConversation(
    input: CreateConversationInput
  ): ChatConversation {
    this.assertNonEmptyString(
      input.userId,
      "userId"
    );

    const now =
      new Date();

    const conversation: ChatConversation = {
      id:
        this.generateId(
          "conversation"
        ),

      userId:
        input.userId.trim(),

      title:
        this.normalizeTitle(
          input.title
        ),

      status:
        "active",

      participants:
        this.cloneParticipants(
          input.participants ?? []
        ),

      createdAt:
        now,

      updatedAt:
        now,

      metadata:
        this.cloneMetadata(
          input.metadata
        ),
    };

    this.conversations.set(
      conversation.id,
      conversation
    );

    this.messages.set(
      conversation.id,
      []
    );

    return this.cloneConversation(
      conversation
    );
  }

  getConversation(
    conversationId: string
  ): ChatConversation | undefined {
    const conversation =
      this.conversations.get(
        conversationId
      );

    if (!conversation) {
      return undefined;
    }

    return this.cloneConversation(
      conversation
    );
  }

  requireConversation(
    conversationId: string
  ): ChatConversation {
    const conversation =
      this.getConversation(
        conversationId
      );

    if (!conversation) {
      throw new ConversationNotFoundError(
        conversationId
      );
    }

    return conversation;
  }

  getConversations(
    userId?: string
  ): ChatConversation[] {
    const conversations =
      Array.from(
        this.conversations.values()
      );

    const filtered =
      userId
        ? conversations.filter(
            (conversation) =>
              conversation.userId === userId
          )
        : conversations;

    return filtered
      .sort(
        (a, b) =>
          b.updatedAt.getTime() -
          a.updatedAt.getTime()
      )
      .map(
        (conversation) =>
          this.cloneConversation(
            conversation
          )
      );
  }

  updateConversation(
    conversationId: string,
    input: UpdateConversationInput
  ): ChatConversation {
    const existing =
      this.requireConversation(
        conversationId
      );

    const stored =
      this.conversations.get(
        conversationId
      );

    if (!stored) {
      throw new ConversationNotFoundError(
        conversationId
      );
    }

    const updated: ChatConversation = {
      ...existing,

      title:
        input.title !== undefined
          ? this.normalizeTitle(
              input.title
            )
          : existing.title,

      status:
        input.status ??
        existing.status,

      participants:
        input.participants !== undefined
          ? this.cloneParticipants(
              input.participants
            )
          : existing.participants,

      metadata:
        input.metadata !== undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        new Date(),
    };

    this.conversations.set(
      conversationId,
      updated
    );

    return this.cloneConversation(
      updated
    );
  }

  archiveConversation(
    conversationId: string
  ): ChatConversation {
    return this.updateConversation(
      conversationId,
      {
        status: "archived",
      }
    );
  }

  restoreConversation(
    conversationId: string
  ): ChatConversation {
    return this.updateConversation(
      conversationId,
      {
        status: "active",
      }
    );
  }

  deleteConversation(
    conversationId: string,
    permanently = false
  ): void {
    this.requireConversation(
      conversationId
    );

    if (permanently) {
      this.conversations.delete(
        conversationId
      );

      this.messages.delete(
        conversationId
      );

      return;
    }

    this.updateConversation(
      conversationId,
      {
        status: "deleted",
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                MESSAGES                                  */
  /* ------------------------------------------------------------------------ */

  createMessage(
    input: CreateMessageInput
  ): ChatMessage {
    this.requireConversation(
      input.conversationId
    );

    this.assertNonEmptyString(
      input.content,
      "message content"
    );

    const now =
      new Date();

    const message: ChatMessage = {
      id:
        this.generateId(
          "message"
        ),

      conversationId:
        input.conversationId,

      role:
        input.role,

      content:
        input.content,

      status:
        input.status ??
        "completed",

      createdAt:
        now,

      updatedAt:
        now,

      metadata:
        this.cloneMetadata(
          input.metadata
        ),
    };

    const messages =
      this.messages.get(
        input.conversationId
      );

    if (!messages) {
      throw new ConversationNotFoundError(
        input.conversationId
      );
    }

    messages.push(
      message
    );

    this.messages.set(
      input.conversationId,
      messages
    );

    this.touchConversation(
      input.conversationId
    );

    return this.cloneMessage(
      message
    );
  }

  getMessage(
    conversationId: string,
    messageId: string
  ): ChatMessage | undefined {
    const messages =
      this.messages.get(
        conversationId
      );

    if (!messages) {
      return undefined;
    }

    const message =
      messages.find(
        (item) =>
          item.id === messageId
      );

    if (!message) {
      return undefined;
    }

    return this.cloneMessage(
      message
    );
  }

  requireMessage(
    conversationId: string,
    messageId: string
  ): ChatMessage {
    const message =
      this.getMessage(
        conversationId,
        messageId
      );

    if (!message) {
      throw new MessageNotFoundError(
        messageId
      );
    }

    return message;
  }

  updateMessage(
    conversationId: string,
    messageId: string,
    input: UpdateMessageInput
  ): ChatMessage {
    this.requireConversation(
      conversationId
    );

    const messages =
      this.messages.get(
        conversationId
      );

    if (!messages) {
      throw new ConversationNotFoundError(
        conversationId
      );
    }

    const index =
      messages.findIndex(
        (message) =>
          message.id === messageId
      );

    if (index === -1) {
      throw new MessageNotFoundError(
        messageId
      );
    }

    const existing =
      messages[index];

    if (!existing) {
      throw new MessageNotFoundError(
        messageId
      );
    }

    const updated: ChatMessage = {
      ...existing,

      content:
        input.content !== undefined
          ? input.content
          : existing.content,

      status:
        input.status ??
        existing.status,

      metadata:
        input.metadata !== undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        new Date(),
    };

    messages[index] =
      updated;

    this.messages.set(
      conversationId,
      messages
    );

    this.touchConversation(
      conversationId
    );

    return this.cloneMessage(
      updated
    );
  }

  deleteMessage(
    conversationId: string,
    messageId: string
  ): void {
    this.requireConversation(
      conversationId
    );

    const messages =
      this.messages.get(
        conversationId
      );

    if (!messages) {
      throw new ConversationNotFoundError(
        conversationId
      );
    }

    const index =
      messages.findIndex(
        (message) =>
          message.id === messageId
      );

    if (index === -1) {
      throw new MessageNotFoundError(
        messageId
      );
    }

    messages.splice(
      index,
      1
    );

    this.messages.set(
      conversationId,
      messages
    );

    this.touchConversation(
      conversationId
    );
  }

  getMessages(
    conversationId: string,
    options: ChatPaginationOptions = {}
  ): PaginatedChatMessages {
    this.requireConversation(
      conversationId
    );

    const messages =
      this.messages.get(
        conversationId
      ) ?? [];

    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    const total =
      messages.length;

    const paginated =
      messages
        .slice(
          offset,
          offset + limit
        )
        .map(
          (message) =>
            this.cloneMessage(
              message
            )
        );

    return {
      messages:
        paginated,

      total,

      limit,

      offset,

      hasMore:
        offset +
          paginated.length <
        total,
    };
  }

  getLatestMessage(
    conversationId: string
  ): ChatMessage | undefined {
    const messages =
      this.messages.get(
        conversationId
      );

    if (
      !messages ||
      messages.length === 0
    ) {
      return undefined;
    }

    const message =
      messages[
        messages.length - 1
      ];

    return message
      ? this.cloneMessage(
          message
        )
      : undefined;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  SEARCH                                  */
  /* ------------------------------------------------------------------------ */

  searchMessages(
    options: ChatSearchOptions
  ): PaginatedChatMessages {
    const query =
      options.query
        .trim()
        .toLowerCase();

    if (!query) {
      return {
        messages: [],
        total: 0,
        limit:
          this.normalizeLimit(
            options.limit
          ),
        offset:
          this.normalizeOffset(
            options.offset
          ),
        hasMore: false,
      };
    }

    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    let source: ChatMessage[];

    if (
      options.conversationId
    ) {
      source =
        this.messages.get(
          options.conversationId
        ) ?? [];
    } else {
      source =
        Array.from(
          this.messages.values()
        ).flat();
    }

    const results =
      source.filter(
        (message) => {
          if (
            options.role &&
            message.role !==
              options.role
          ) {
            return false;
          }

          if (
            options.userId
          ) {
            const conversation =
              this.conversations.get(
                message.conversationId
              );

            if (
              !conversation ||
              conversation.userId !==
                options.userId
            ) {
              return false;
            }
          }

          return (
            message.content
              .toLowerCase()
              .includes(query)
          );
        }
      );

    const total =
      results.length;

    const paginated =
      results
        .sort(
          (a, b) =>
            b.createdAt.getTime() -
            a.createdAt.getTime()
        )
        .slice(
          offset,
          offset + limit
        )
        .map(
          (message) =>
            this.cloneMessage(
              message
            )
        );

    return {
      messages:
        paginated,

      total,

      limit,

      offset,

      hasMore:
        offset +
          paginated.length <
        total,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                               CONVERSION                                 */
  /* ------------------------------------------------------------------------ */

  getConversationTranscript(
    conversationId: string
  ): string {
    const result =
      this.getMessages(
        conversationId,
        {
          limit:
            MAX_MESSAGE_LIMIT,
          offset: 0,
        }
      );

    return result.messages
      .map(
        (message) =>
          `${message.role}: ${message.content}`
      )
      .join("\n");
  }

  getConversationMessageCount(
    conversationId: string
  ): number {
    this.requireConversation(
      conversationId
    );

    return (
      this.messages.get(
        conversationId
      )?.length ?? 0
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  ADMIN                                   */
  /* ------------------------------------------------------------------------ */

  clearConversationMessages(
    conversationId: string
  ): void {
    this.requireConversation(
      conversationId
    );

    this.messages.set(
      conversationId,
      []
    );

    this.touchConversation(
      conversationId
    );
  }

  clearAll(): void {
    this.conversations.clear();

    this.messages.clear();
  }

  /* ------------------------------------------------------------------------ */
  /*                              PRIVATE HELPERS                             */
  /* ------------------------------------------------------------------------ */

  private touchConversation(
    conversationId: string
  ): void {
    const conversation =
      this.conversations.get(
        conversationId
      );

    if (!conversation) {
      return;
    }

    const updated: ChatConversation = {
      ...conversation,

      updatedAt:
        new Date(),
    };

    this.conversations.set(
      conversationId,
      updated
    );
  }

  private normalizeTitle(
    title?: string
  ): string {
    const normalized =
      title?.trim();

    if (!normalized) {
      return DEFAULT_TITLE;
    }

    return normalized;
  }

  private normalizeLimit(
    limit?: number
  ): number {
    if (
      limit === undefined
    ) {
      return DEFAULT_MESSAGE_LIMIT;
    }

    if (
      !Number.isFinite(limit)
    ) {
      return DEFAULT_MESSAGE_LIMIT;
    }

    return Math.max(
      1,
      Math.min(
        Math.floor(limit),
        MAX_MESSAGE_LIMIT
      )
    );
  }

  private normalizeOffset(
    offset?: number
  ): number {
    if (
      offset === undefined ||
      !Number.isFinite(offset)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(offset)
    );
  }

  private assertNonEmptyString(
    value: string,
    field: string
  ): void {
    if (
      typeof value !==
        "string" ||
      !value.trim()
    ) {
      throw new ChatServiceError(
        `${field} must be a non-empty string.`
      );
    }
  }

  private cloneMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!metadata) {
      return undefined;
    }

    return {
      ...metadata,
    };
  }

  private cloneParticipants(
    participants: ChatParticipant[]
  ): ChatParticipant[] {
    return participants.map(
      (participant) => ({
        ...participant,

        metadata:
          participant.metadata
            ? {
                ...participant.metadata,
              }
            : undefined,
      })
    );
  }

  private cloneConversation(
    conversation: ChatConversation
  ): ChatConversation {
    return {
      ...conversation,

      participants:
        this.cloneParticipants(
          conversation.participants
        ),

      metadata:
        this.cloneMetadata(
          conversation.metadata
        ),

      createdAt:
        new Date(
          conversation.createdAt
        ),

      updatedAt:
        new Date(
          conversation.updatedAt
        ),
    };
  }

  private cloneMessage(
    message: ChatMessage
  ): ChatMessage {
    return {
      ...message,

      metadata:
        this.cloneMetadata(
          message.metadata
        ),

      createdAt:
        new Date(
          message.createdAt
        ),

      updatedAt:
        new Date(
          message.updatedAt
        ),
    };
  }

  private generateId(
    prefix: string
  ): string {
    const timestamp =
      Date.now()
        .toString(36);

    const random =
      Math.random()
        .toString(36)
        .slice(2, 12);

    return `${prefix}_${timestamp}_${random}`;
  }
}

/* -------------------------------------------------------------------------- */
/*                               SINGLETON                                    */
/* -------------------------------------------------------------------------- */

export const chatService =
  new ChatService();

/* -------------------------------------------------------------------------- */
/*                            CONVENIENCE EXPORTS                             */
/* -------------------------------------------------------------------------- */

export function createConversation(
  input: CreateConversationInput
): ChatConversation {
  return chatService.createConversation(
    input
  );
}

export function getConversation(
  conversationId: string
): ChatConversation | undefined {
  return chatService.getConversation(
    conversationId
  );
}

export function getConversations(
  userId?: string
): ChatConversation[] {
  return chatService.getConversations(
    userId
  );
}

export function updateConversation(
  conversationId: string,
  input: UpdateConversationInput
): ChatConversation {
  return chatService.updateConversation(
    conversationId,
    input
  );
}

export function archiveConversation(
  conversationId: string
): ChatConversation {
  return chatService.archiveConversation(
    conversationId
  );
}

export function restoreConversation(
  conversationId: string
): ChatConversation {
  return chatService.restoreConversation(
    conversationId
  );
}

export function deleteConversation(
  conversationId: string,
  permanently = false
): void {
  chatService.deleteConversation(
    conversationId,
    permanently
  );
}

export function createMessage(
  input: CreateMessageInput
): ChatMessage {
  return chatService.createMessage(
    input
  );
}

export function getMessages(
  conversationId: string,
  options: ChatPaginationOptions = {}
): PaginatedChatMessages {
  return chatService.getMessages(
    conversationId,
    options
  );
}

export function getLatestMessage(
  conversationId: string
): ChatMessage | undefined {
  return chatService.getLatestMessage(
    conversationId
  );
}

export function updateMessage(
  conversationId: string,
  messageId: string,
  input: UpdateMessageInput
): ChatMessage {
  return chatService.updateMessage(
    conversationId,
    messageId,
    input
  );
}

export function deleteMessage(
  conversationId: string,
  messageId: string
): void {
  chatService.deleteMessage(
    conversationId,
    messageId
  );
}

export function searchMessages(
  options: ChatSearchOptions
): PaginatedChatMessages {
  return chatService.searchMessages(
    options
  );
}

export function getConversationTranscript(
  conversationId: string
): string {
  return chatService.getConversationTranscript(
    conversationId
  );
}

export function getConversationMessageCount(
  conversationId: string
): number {
  return chatService.getConversationMessageCount(
    conversationId
  );
}

export function clearConversationMessages(
  conversationId: string
): void {
  chatService.clearConversationMessages(
    conversationId
  );
}

export default chatService;