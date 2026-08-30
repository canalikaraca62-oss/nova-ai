/**
 * SYRAVEN Messages Service
 *
 * Enterprise-grade message management.
 *
 * Features:
 * - Message CRUD
 * - Conversation isolation
 * - User / assistant / system / tool roles
 * - Message status lifecycle
 * - Attachments
 * - Metadata
 * - Pagination
 * - Ordering
 * - Soft delete / permanent delete
 * - Strict TypeScript
 * - In-memory implementation
 *
 * Production note:
 * This service is storage-agnostic. The in-memory store can later
 * be replaced with Supabase/PostgreSQL without changing the public API.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export type MessageStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled"
  | "deleted";

export type MessageContentType =
  | "text"
  | "markdown"
  | "json"
  | "tool_call"
  | "tool_result"
  | "error";

export interface MessageAttachment {
  id: string;

  name: string;

  mimeType?: string;

  size?: number;

  url?: string;

  fileId?: string;

  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;

  conversationId: string;

  role: MessageRole;

  content: string;

  contentType: MessageContentType;

  status: MessageStatus;

  userId?: string;

  assistantId?: string;

  parentMessageId?: string;

  attachments: MessageAttachment[];

  sequence: number;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface CreateMessageInput {
  conversationId: string;

  role: MessageRole;

  content: string;

  contentType?: MessageContentType;

  status?: MessageStatus;

  userId?: string;

  assistantId?: string;

  parentMessageId?: string;

  attachments?: MessageAttachment[];

  metadata?: Record<string, unknown>;
}

export interface UpdateMessageInput {
  content?: string;

  contentType?: MessageContentType;

  status?: MessageStatus;

  attachments?: MessageAttachment[];

  metadata?: Record<string, unknown>;
}

export interface MessageListOptions {
  conversationId?: string;

  role?: MessageRole;

  status?: MessageStatus;

  userId?: string;

  assistantId?: string;

  includeDeleted?: boolean;

  limit?: number;

  offset?: number;
}

export interface MessageListResult {
  messages: Message[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface MessageSearchOptions {
  query: string;

  conversationId?: string;

  role?: MessageRole;

  includeDeleted?: boolean;

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class MessageServiceError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "MessageServiceError";
  }
}

export class MessageNotFoundError extends MessageServiceError {
  constructor(messageId: string) {
    super(`Message not found: ${messageId}`);

    this.name = "MessageNotFoundError";
  }
}

export class MessageValidationError extends MessageServiceError {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));

    this.name = "MessageValidationError";

    this.errors = errors;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MESSAGE_LIMIT = 100;

export const MAX_MESSAGE_LIMIT = 500;

export const MAX_MESSAGE_CONTENT_LENGTH = 1_000_000;

export const MAX_MESSAGE_ATTACHMENTS = 100;

/* -------------------------------------------------------------------------- */
/*                              MESSAGE SERVICE                               */
/* -------------------------------------------------------------------------- */

export class MessagesService {
  private readonly messages = new Map<
    string,
    Message
  >();

  private readonly conversationSequences = new Map<
    string,
    number
  >();

  /* ------------------------------------------------------------------------ */
  /*                                  CREATE                                  */
  /* ------------------------------------------------------------------------ */

  create(
    input: CreateMessageInput
  ): Message {
    this.assertValidCreateInput(input);

    if (input.parentMessageId) {
      const parent = this.get(input.parentMessageId);

      if (!parent) {
        throw new MessageNotFoundError(
          input.parentMessageId
        );
      }

      if (
        parent.conversationId !==
        input.conversationId
      ) {
        throw new MessageValidationError([
          "Parent message must belong to the same conversation.",
        ]);
      }
    }

    const now = new Date();

    const sequence =
      this.getNextSequence(
        input.conversationId
      );

    const message: Message = {
      id: this.generateId("msg"),

      conversationId:
        input.conversationId.trim(),

      role:
        input.role,

      content:
        input.content,

      contentType:
        input.contentType ??
        "text",

      status:
        input.status ??
        "completed",

      userId:
        input.userId,

      assistantId:
        input.assistantId,

      parentMessageId:
        input.parentMessageId,

      attachments:
        this.cloneAttachments(
          input.attachments
        ),

      sequence,

      createdAt:
        now,

      updatedAt:
        now,

      metadata:
        this.cloneMetadata(
          input.metadata
        ),
    };

    this.messages.set(
      message.id,
      message
    );

    return this.cloneMessage(
      message
    );
  }

  createUserMessage(
    conversationId: string,
    content: string,
    options: Omit<
      CreateMessageInput,
      | "conversationId"
      | "role"
      | "content"
    > = {}
  ): Message {
    return this.create({
      ...options,

      conversationId,

      role: "user",

      content,
    });
  }

  createAssistantMessage(
    conversationId: string,
    content: string,
    options: Omit<
      CreateMessageInput,
      | "conversationId"
      | "role"
      | "content"
    > = {}
  ): Message {
    return this.create({
      ...options,

      conversationId,

      role: "assistant",

      content,
    });
  }

  createSystemMessage(
    conversationId: string,
    content: string,
    options: Omit<
      CreateMessageInput,
      | "conversationId"
      | "role"
      | "content"
    > = {}
  ): Message {
    return this.create({
      ...options,

      conversationId,

      role: "system",

      content,
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                                   READ                                   */
  /* ------------------------------------------------------------------------ */

  get(
    messageId: string
  ): Message | undefined {
    const message =
      this.messages.get(
        messageId
      );

    if (!message) {
      return undefined;
    }

    return this.cloneMessage(
      message
    );
  }

  require(
    messageId: string
  ): Message {
    const message =
      this.get(messageId);

    if (!message) {
      throw new MessageNotFoundError(
        messageId
      );
    }

    return message;
  }

  list(
    options: MessageListOptions = {}
  ): MessageListResult {
    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    let items =
      Array.from(
        this.messages.values()
      );

    if (
      options.conversationId !==
      undefined
    ) {
      items =
        items.filter(
          (message) =>
            message.conversationId ===
            options.conversationId
        );
    }

    if (
      options.role !==
      undefined
    ) {
      items =
        items.filter(
          (message) =>
            message.role ===
            options.role
        );
    }

    if (
      options.status !==
      undefined
    ) {
      items =
        items.filter(
          (message) =>
            message.status ===
            options.status
        );
    }

    if (
      options.userId !==
      undefined
    ) {
      items =
        items.filter(
          (message) =>
            message.userId ===
            options.userId
        );
    }

    if (
      options.assistantId !==
      undefined
    ) {
      items =
        items.filter(
          (message) =>
            message.assistantId ===
            options.assistantId
        );
    }

    if (!options.includeDeleted) {
      items =
        items.filter(
          (message) =>
            message.status !==
            "deleted"
        );
    }

    items.sort(
      (a, b) => {
        if (
          a.conversationId ===
          b.conversationId
        ) {
          return (
            a.sequence -
            b.sequence
          );
        }

        return (
          a.createdAt.getTime() -
          b.createdAt.getTime()
        );
      }
    );

    const total =
      items.length;

    const messages =
      items
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
      messages,

      total,

      limit,

      offset,

      hasMore:
        offset +
          messages.length <
        total,
    };
  }

  getConversationMessages(
    conversationId: string,
    options: Omit<
      MessageListOptions,
      "conversationId"
    > = {}
  ): MessageListResult {
    return this.list({
      ...options,
      conversationId,
    });
  }

  getLatest(
    conversationId: string
  ): Message | undefined {
    const messages =
      Array.from(
        this.messages.values()
      )
        .filter(
          (message) =>
            message.conversationId ===
              conversationId &&
            message.status !==
              "deleted"
        )
        .sort(
          (a, b) =>
            b.sequence -
            a.sequence
        );

    const latest =
      messages[0];

    return latest
      ? this.cloneMessage(
          latest
        )
      : undefined;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  SEARCH                                  */
  /* ------------------------------------------------------------------------ */

  search(
    options: MessageSearchOptions
  ): MessageListResult {
    const query =
      options.query.trim();

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

    const normalizedQuery =
      query.toLowerCase();

    const baseResult =
      this.list({
        conversationId:
          options.conversationId,

        role:
          options.role,

        includeDeleted:
          options.includeDeleted,

        limit:
          MAX_MESSAGE_LIMIT,

        offset: 0,
      });

    const matchingMessages =
      baseResult.messages.filter(
        (message) =>
          message.content
            .toLowerCase()
            .includes(
              normalizedQuery
            )
      );

    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    const messages =
      matchingMessages.slice(
        offset,
        offset + limit
      );

    return {
      messages,

      total:
        matchingMessages.length,

      limit,

      offset,

      hasMore:
        offset +
          messages.length <
        matchingMessages.length,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UPDATE                                  */
  /* ------------------------------------------------------------------------ */

  update(
    messageId: string,
    input: UpdateMessageInput
  ): Message {
    const existing =
      this.require(
        messageId
      );

    if (
      input.content !== undefined &&
      input.content.length >
        MAX_MESSAGE_CONTENT_LENGTH
    ) {
      throw new MessageValidationError([
        `Message content exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH}.`,
      ]);
    }

    if (
      input.attachments !==
        undefined &&
      input.attachments.length >
        MAX_MESSAGE_ATTACHMENTS
    ) {
      throw new MessageValidationError([
        `Message cannot have more than ${MAX_MESSAGE_ATTACHMENTS} attachments.`,
      ]);
    }

    const updated: Message = {
      ...existing,

      content:
        input.content ??
        existing.content,

      contentType:
        input.contentType ??
        existing.contentType,

      status:
        input.status ??
        existing.status,

      attachments:
        input.attachments !==
        undefined
          ? this.cloneAttachments(
              input.attachments
            )
          : existing.attachments,

      metadata:
        input.metadata !==
        undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        new Date(),
    };

    this.messages.set(
      messageId,
      updated
    );

    return this.cloneMessage(
      updated
    );
  }

  setStatus(
    messageId: string,
    status: MessageStatus
  ): Message {
    return this.update(
      messageId,
      {
        status,
      }
    );
  }

  startStreaming(
    messageId: string
  ): Message {
    return this.setStatus(
      messageId,
      "streaming"
    );
  }

  complete(
    messageId: string,
    content?: string
  ): Message {
    return this.update(
      messageId,
      {
        status: "completed",
        content,
      }
    );
  }

  fail(
    messageId: string
  ): Message {
    return this.setStatus(
      messageId,
      "failed"
    );
  }

  cancel(
    messageId: string
  ): Message {
    return this.setStatus(
      messageId,
      "cancelled"
    );
  }

  appendContent(
    messageId: string,
    content: string
  ): Message {
    const existing =
      this.require(
        messageId
      );

    const combinedContent =
      existing.content +
      content;

    if (
      combinedContent.length >
      MAX_MESSAGE_CONTENT_LENGTH
    ) {
      throw new MessageValidationError([
        `Message content exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH}.`,
      ]);
    }

    return this.update(
      messageId,
      {
        content:
          combinedContent,
      }
    );
  }

  addAttachment(
    messageId: string,
    attachment: MessageAttachment
  ): Message {
    const existing =
      this.require(
        messageId
      );

    if (
      existing.attachments.length >=
      MAX_MESSAGE_ATTACHMENTS
    ) {
      throw new MessageValidationError([
        `Message cannot have more than ${MAX_MESSAGE_ATTACHMENTS} attachments.`,
      ]);
    }

    return this.update(
      messageId,
      {
        attachments: [
          ...existing.attachments,
          attachment,
        ],
      }
    );
  }

  removeAttachment(
    messageId: string,
    attachmentId: string
  ): Message {
    const existing =
      this.require(
        messageId
      );

    return this.update(
      messageId,
      {
        attachments:
          existing.attachments.filter(
            (attachment) =>
              attachment.id !==
              attachmentId
          ),
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  DELETE                                  */
  /* ------------------------------------------------------------------------ */

  delete(
    messageId: string,
    permanently = false
  ): void {
    this.require(
      messageId
    );

    if (permanently) {
      this.messages.delete(
        messageId
      );

      return;
    }

    this.setStatus(
      messageId,
      "deleted"
    );
  }

  deleteConversationMessages(
    conversationId: string,
    permanently = false
  ): number {
    const messageIds =
      Array.from(
        this.messages.values()
      )
        .filter(
          (message) =>
            message.conversationId ===
            conversationId
        )
        .map(
          (message) =>
            message.id
        );

    for (
      const messageId of
      messageIds
    ) {
      this.delete(
        messageId,
        permanently
      );
    }

    if (permanently) {
      this.conversationSequences.delete(
        conversationId
      );
    }

    return messageIds.length;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  STATS                                   */
  /* ------------------------------------------------------------------------ */

  count(
    options: Omit<
      MessageListOptions,
      "limit" | "offset"
    > = {}
  ): number {
    return this.list({
      ...options,
      limit:
        MAX_MESSAGE_LIMIT,
      offset: 0,
    }).total;
  }

  getConversationMessageCount(
    conversationId: string
  ): number {
    return this.count({
      conversationId,
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                                  ADMIN                                   */
  /* ------------------------------------------------------------------------ */

  clear(): void {
    this.messages.clear();

    this.conversationSequences.clear();
  }

  clearConversation(
    conversationId: string
  ): void {
    this.deleteConversationMessages(
      conversationId,
      true
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                             PRIVATE HELPERS                              */
  /* ------------------------------------------------------------------------ */

  private assertValidCreateInput(
    input: CreateMessageInput
  ): void {
    const errors: string[] = [];

    if (
      !input.conversationId ||
      !input.conversationId.trim()
    ) {
      errors.push(
        "Conversation ID is required."
      );
    }

    if (
      !input.content &&
      (!input.attachments ||
        input.attachments.length === 0)
    ) {
      errors.push(
        "Message content or at least one attachment is required."
      );
    }

    if (
      input.content.length >
      MAX_MESSAGE_CONTENT_LENGTH
    ) {
      errors.push(
        `Message content exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH}.`
      );
    }

    if (
      input.attachments &&
      input.attachments.length >
        MAX_MESSAGE_ATTACHMENTS
    ) {
      errors.push(
        `Message cannot have more than ${MAX_MESSAGE_ATTACHMENTS} attachments.`
      );
    }

    if (errors.length > 0) {
      throw new MessageValidationError(
        errors
      );
    }
  }

  private getNextSequence(
    conversationId: string
  ): number {
    const current =
      this.conversationSequences.get(
        conversationId
      ) ?? 0;

    const next =
      current + 1;

    this.conversationSequences.set(
      conversationId,
      next
    );

    return next;
  }

  private normalizeLimit(
    limit?: number
  ): number {
    if (
      limit === undefined ||
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

  private cloneAttachments(
    attachments?: MessageAttachment[]
  ): MessageAttachment[] {
    if (!attachments) {
      return [];
    }

    return attachments.map(
      (attachment) => ({
        ...attachment,

        metadata:
          this.cloneMetadata(
            attachment.metadata
          ),
      })
    );
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

  private cloneMessage(
    message: Message
  ): Message {
    return {
      ...message,

      attachments:
        this.cloneAttachments(
          message.attachments
        ),

      createdAt:
        new Date(
          message.createdAt
        ),

      updatedAt:
        new Date(
          message.updatedAt
        ),

      metadata:
        this.cloneMetadata(
          message.metadata
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
        .slice(2, 14);

    return `${prefix}_${timestamp}_${random}`;
  }
}

/* -------------------------------------------------------------------------- */
/*                               SINGLETON                                    */
/* -------------------------------------------------------------------------- */

export const messagesService =
  new MessagesService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function createMessage(
  input: CreateMessageInput
): Message {
  return messagesService.create(
    input
  );
}

export function createUserMessage(
  conversationId: string,
  content: string,
  options: Omit<
    CreateMessageInput,
    | "conversationId"
    | "role"
    | "content"
  > = {}
): Message {
  return messagesService.createUserMessage(
    conversationId,
    content,
    options
  );
}

export function createAssistantMessage(
  conversationId: string,
  content: string,
  options: Omit<
    CreateMessageInput,
    | "conversationId"
    | "role"
    | "content"
  > = {}
): Message {
  return messagesService.createAssistantMessage(
    conversationId,
    content,
    options
  );
}

export function getMessage(
  messageId: string
): Message | undefined {
  return messagesService.get(
    messageId
  );
}

export function requireMessage(
  messageId: string
): Message {
  return messagesService.require(
    messageId
  );
}

export function updateMessage(
  messageId: string,
  input: UpdateMessageInput
): Message {
  return messagesService.update(
    messageId,
    input
  );
}

export function listMessages(
  options: MessageListOptions = {}
): MessageListResult {
  return messagesService.list(
    options
  );
}

export function getConversationMessages(
  conversationId: string,
  options: Omit<
    MessageListOptions,
    "conversationId"
  > = {}
): MessageListResult {
  return messagesService.getConversationMessages(
    conversationId,
    options
  );
}

export function searchMessages(
  options: MessageSearchOptions
): MessageListResult {
  return messagesService.search(
    options
  );
}

export function appendMessageContent(
  messageId: string,
  content: string
): Message {
  return messagesService.appendContent(
    messageId,
    content
  );
}

export function completeMessage(
  messageId: string,
  content?: string
): Message {
  return messagesService.complete(
    messageId,
    content
  );
}

export function deleteMessage(
  messageId: string,
  permanently = false
): void {
  messagesService.delete(
    messageId,
    permanently
  );
}

export default messagesService;