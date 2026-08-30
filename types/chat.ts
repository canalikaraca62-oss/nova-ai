/**
 * SYRAVEN Chat Types
 *
 * Enterprise-grade shared type definitions for:
 * - Conversations
 * - Messages
 * - Chat participants
 * - Streaming
 * - AI generations
 * - Tool calls
 * - Attachments
 * - Citations
 * - Usage
 * - Pagination
 * - API contracts
 *
 * This file contains shared contracts only.
 * Business logic belongs in services/chat.ts.
 */

/* -------------------------------------------------------------------------- */
/*                                PRIMITIVES                                  */
/* -------------------------------------------------------------------------- */

export type ChatId = string;

export type MessageId = string;

export type UserId = string;

export type WorkspaceId = string;

export type AssistantId = string;

export type ModelId = string;

export type ToolCallId = string;

export type AttachmentId = string;

export type CitationId = string;

/* -------------------------------------------------------------------------- */
/*                             CONVERSATION TYPES                             */
/* -------------------------------------------------------------------------- */

export type ConversationStatus =
  | "active"
  | "archived"
  | "deleted";

export type ConversationVisibility =
  | "private"
  | "workspace"
  | "public";

export interface ConversationMetadata {
  [key: string]: unknown;
}

export interface Conversation {
  id: ChatId;

  workspaceId?: WorkspaceId;

  userId: UserId;

  title: string;

  description?: string;

  status: ConversationStatus;

  visibility: ConversationVisibility;

  model?: ModelId;

  messageCount: number;

  lastMessageAt?: Date;

  createdAt: Date;

  updatedAt: Date;

  archivedAt?: Date;

  deletedAt?: Date;

  metadata?: ConversationMetadata;
}

export interface CreateConversationInput {
  userId: UserId;

  workspaceId?: WorkspaceId;

  title?: string;

  description?: string;

  visibility?: ConversationVisibility;

  model?: ModelId;

  metadata?: ConversationMetadata;
}

export interface UpdateConversationInput {
  title?: string;

  description?: string;

  visibility?: ConversationVisibility;

  model?: ModelId;

  status?: ConversationStatus;

  metadata?: ConversationMetadata;
}

/* -------------------------------------------------------------------------- */
/*                              MESSAGE TYPES                                 */
/* -------------------------------------------------------------------------- */

export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "developer";

export type MessageStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";

export type MessageContentType =
  | "text"
  | "markdown"
  | "json"
  | "image"
  | "file"
  | "audio"
  | "video"
  | "mixed";

export interface TextContentPart {
  type: "text";

  text: string;
}

export interface ImageContentPart {
  type: "image";

  url?: string;

  fileId?: string;

  mimeType?: string;

  alt?: string;

  metadata?: Record<string, unknown>;
}

export interface FileContentPart {
  type: "file";

  fileId: string;

  name?: string;

  mimeType?: string;

  size?: number;

  url?: string;

  metadata?: Record<string, unknown>;
}

export interface AudioContentPart {
  type: "audio";

  url?: string;

  fileId?: string;

  mimeType?: string;

  durationMs?: number;

  metadata?: Record<string, unknown>;
}

export interface JsonContentPart {
  type: "json";

  value: unknown;
}

export type MessageContentPart =
  | TextContentPart
  | ImageContentPart
  | FileContentPart
  | AudioContentPart
  | JsonContentPart;

export interface ChatMessageMetadata {
  [key: string]: unknown;
}

export interface ChatMessage {
  id: MessageId;

  conversationId: ChatId;

  role: MessageRole;

  content: string;

  contentType: MessageContentType;

  parts?: MessageContentPart[];

  status: MessageStatus;

  model?: ModelId;

  parentMessageId?: MessageId;

  replyToMessageId?: MessageId;

  toolCalls?: ToolCall[];

  toolCallId?: ToolCallId;

  attachments?: ChatAttachment[];

  citations?: ChatCitation[];

  usage?: ChatUsage;

  error?: ChatMessageError;

  createdAt: Date;

  updatedAt: Date;

  completedAt?: Date;

  metadata?: ChatMessageMetadata;
}

export interface CreateMessageInput {
  conversationId: ChatId;

  role: MessageRole;

  content: string;

  contentType?: MessageContentType;

  parts?: MessageContentPart[];

  parentMessageId?: MessageId;

  replyToMessageId?: MessageId;

  model?: ModelId;

  attachments?: ChatAttachment[];

  metadata?: ChatMessageMetadata;
}

export interface UpdateMessageInput {
  content?: string;

  contentType?: MessageContentType;

  parts?: MessageContentPart[];

  status?: MessageStatus;

  model?: ModelId;

  attachments?: ChatAttachment[];

  citations?: ChatCitation[];

  usage?: ChatUsage;

  error?: ChatMessageError;

  metadata?: ChatMessageMetadata;
}

/* -------------------------------------------------------------------------- */
/*                                ATTACHMENTS                                 */
/* -------------------------------------------------------------------------- */

export type AttachmentType =
  | "image"
  | "document"
  | "audio"
  | "video"
  | "archive"
  | "other";

export interface ChatAttachment {
  id: AttachmentId;

  type: AttachmentType;

  name: string;

  mimeType?: string;

  size?: number;

  url?: string;

  fileId?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                 CITATIONS                                  */
/* -------------------------------------------------------------------------- */

export type CitationSourceType =
  | "document"
  | "url"
  | "knowledge"
  | "message"
  | "file"
  | "database"
  | "other";

export interface ChatCitation {
  id: CitationId;

  sourceType: CitationSourceType;

  title?: string;

  sourceId?: string;

  url?: string;

  text?: string;

  startIndex?: number;

  endIndex?: number;

  score?: number;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                 TOOL CALLS                                 */
/* -------------------------------------------------------------------------- */

export type ToolCallStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ToolCall {
  id: ToolCallId;

  name: string;

  arguments: Record<string, unknown>;

  status: ToolCallStatus;

  result?: unknown;

  error?: string;

  startedAt?: Date;

  completedAt?: Date;

  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<
  TArguments extends Record<string, unknown> =
    Record<string, unknown>,
  TResult = unknown
> {
  name: string;

  description?: string;

  parameters?: Record<string, unknown>;

  execute?: (
    arguments_: TArguments,
    context: ToolExecutionContext
  ) => Promise<TResult> | TResult;

  metadata?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  conversationId: ChatId;

  messageId?: MessageId;

  userId: UserId;

  workspaceId?: WorkspaceId;

  signal?: AbortSignal;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                   USAGE                                    */
/* -------------------------------------------------------------------------- */

export interface ChatUsage {
  inputTokens?: number;

  outputTokens?: number;

  totalTokens?: number;

  cachedTokens?: number;

  reasoningTokens?: number;

  requestCount?: number;

  estimatedCost?: number;

  currency?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export interface ChatMessageError {
  code?: string;

  message: string;

  retryable?: boolean;

  provider?: string;

  details?: unknown;
}

/* -------------------------------------------------------------------------- */
/*                              GENERATION TYPES                              */
/* -------------------------------------------------------------------------- */

export type ChatGenerationStatus =
  | "queued"
  | "running"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";

export interface ChatGenerationOptions {
  model?: ModelId;

  temperature?: number;

  maxTokens?: number;

  topP?: number;

  frequencyPenalty?: number;

  presencePenalty?: number;

  stop?: string[];

  stream?: boolean;

  tools?: ToolDefinition[];

  metadata?: Record<string, unknown>;
}

export interface ChatGenerationRequest {
  conversationId: ChatId;

  userId: UserId;

  workspaceId?: WorkspaceId;

  messageId?: MessageId;

  messages?: ChatMessage[];

  prompt?: string;

  options?: ChatGenerationOptions;

  signal?: AbortSignal;
}

export interface ChatGenerationResult {
  conversationId: ChatId;

  message: ChatMessage;

  status: ChatGenerationStatus;

  model?: ModelId;

  usage?: ChatUsage;

  finishReason?: ChatFinishReason;

  metadata?: Record<string, unknown>;
}

export type ChatFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "cancelled"
  | "error"
  | "unknown";

/* -------------------------------------------------------------------------- */
/*                               STREAMING TYPES                              */
/* -------------------------------------------------------------------------- */

export type ChatStreamEventType =
  | "message_start"
  | "message_delta"
  | "message_complete"
  | "tool_call_start"
  | "tool_call_delta"
  | "tool_call_complete"
  | "usage"
  | "error"
  | "done";

export interface ChatStreamEvent<
  TData = unknown
> {
  id?: string;

  type: ChatStreamEventType;

  conversationId: ChatId;

  messageId?: MessageId;

  data?: TData;

  timestamp: Date;
}

export interface ChatMessageDelta {
  text?: string;

  content?: string;

  role?: MessageRole;

  index?: number;

  metadata?: Record<string, unknown>;
}

export interface ChatToolCallDelta {
  toolCallId: ToolCallId;

  name?: string;

  argumentsDelta?: string;

  status?: ToolCallStatus;
}

export interface ChatStreamError {
  code?: string;

  message: string;

  retryable?: boolean;

  details?: unknown;
}

/* -------------------------------------------------------------------------- */
/*                              PARTICIPANTS                                  */
/* -------------------------------------------------------------------------- */

export type ChatParticipantRole =
  | "owner"
  | "member"
  | "viewer"
  | "assistant";

export interface ChatParticipant {
  id: string;

  conversationId: ChatId;

  userId?: UserId;

  assistantId?: AssistantId;

  role: ChatParticipantRole;

  joinedAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               PAGINATION                                   */
/* -------------------------------------------------------------------------- */

export interface ChatPaginationInput {
  limit?: number;

  offset?: number;

  cursor?: string;
}

export interface ChatPaginationResult<T> {
  items: T[];

  total?: number;

  limit: number;

  offset?: number;

  nextCursor?: string;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               LIST OPTIONS                                 */
/* -------------------------------------------------------------------------- */

export interface ListConversationsInput
  extends ChatPaginationInput {
  userId?: UserId;

  workspaceId?: WorkspaceId;

  status?: ConversationStatus;

  visibility?: ConversationVisibility;

  search?: string;

  orderBy?: "createdAt" | "updatedAt" | "lastMessageAt";

  order?: "asc" | "desc";
}

export interface ListMessagesInput
  extends ChatPaginationInput {
  conversationId: ChatId;

  role?: MessageRole;

  status?: MessageStatus;

  order?: "asc" | "desc";
}

/* -------------------------------------------------------------------------- */
/*                              SERVICE CONTRACT                              */
/* -------------------------------------------------------------------------- */

export interface ChatServiceContract {
  createConversation(
    input: CreateConversationInput
  ): Promise<Conversation> | Conversation;

  getConversation(
    conversationId: ChatId
  ): Promise<Conversation | undefined> | Conversation | undefined;

  updateConversation(
    conversationId: ChatId,
    input: UpdateConversationInput
  ): Promise<Conversation> | Conversation;

  deleteConversation(
    conversationId: ChatId
  ): Promise<boolean> | boolean;

  listConversations(
    input?: ListConversationsInput
  ):
    | Promise<
        ChatPaginationResult<Conversation>
      >
    | ChatPaginationResult<Conversation>;

  createMessage(
    input: CreateMessageInput
  ): Promise<ChatMessage> | ChatMessage;

  getMessage(
    messageId: MessageId
  ): Promise<ChatMessage | undefined> | ChatMessage | undefined;

  updateMessage(
    messageId: MessageId,
    input: UpdateMessageInput
  ): Promise<ChatMessage> | ChatMessage;

  listMessages(
    input: ListMessagesInput
  ):
    | Promise<
        ChatPaginationResult<ChatMessage>
      >
    | ChatPaginationResult<ChatMessage>;

  generate(
    request: ChatGenerationRequest
  ):
    | Promise<ChatGenerationResult>
    | ChatGenerationResult;
}

/* -------------------------------------------------------------------------- */
/*                            TYPE GUARD HELPERS                              */
/* -------------------------------------------------------------------------- */

export function isMessageRole(
  value: unknown
): value is MessageRole {
  return (
    value === "system" ||
    value === "user" ||
    value === "assistant" ||
    value === "tool" ||
    value === "developer"
  );
}

export function isMessageStatus(
  value: unknown
): value is MessageStatus {
  return (
    value === "pending" ||
    value === "streaming" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  );
}

export function isConversationStatus(
  value: unknown
): value is ConversationStatus {
  return (
    value === "active" ||
    value === "archived" ||
    value === "deleted"
  );
}

export function isConversationVisibility(
  value: unknown
): value is ConversationVisibility {
  return (
    value === "private" ||
    value === "workspace" ||
    value === "public"
  );
}

export function isChatMessage(
  value: unknown
): value is ChatMessage {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.conversationId === "string" &&
    typeof candidate.content === "string" &&
    isMessageRole(candidate.role) &&
    isMessageStatus(candidate.status)
  );
}

export function isConversation(
  value: unknown
): value is Conversation {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.title === "string" &&
    isConversationStatus(candidate.status) &&
    isConversationVisibility(
      candidate.visibility
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                               DEFAULTS                                     */
/* -------------------------------------------------------------------------- */

export const DEFAULT_CHAT_MODEL =
  "default";

export const DEFAULT_CONVERSATION_TITLE =
  "New conversation";

export const DEFAULT_CHAT_PAGE_LIMIT =
  50;

export const MAX_CHAT_PAGE_LIMIT =
  500;

export const DEFAULT_CHAT_TEMPERATURE =
  0.7;

export const DEFAULT_MAX_TOKENS =
  4_096;

/* -------------------------------------------------------------------------- */
/*                              UTILITY TYPES                                 */
/* -------------------------------------------------------------------------- */

export type ChatProviderName =
  | "openai"
  | "anthropic"
  | "google"
  | "azure"
  | "custom"
  | string;

export interface ChatProviderConfig {
  provider: ChatProviderName;

  model?: ModelId;

  endpoint?: string;

  metadata?: Record<string, unknown>;
}

export interface ChatProviderResult {
  content: string;

  model?: ModelId;

  usage?: ChatUsage;

  finishReason?: ChatFinishReason;

  toolCalls?: ToolCall[];

  metadata?: Record<string, unknown>;
}