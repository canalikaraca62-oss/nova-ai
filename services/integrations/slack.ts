/**
 * SYRAVEN Slack Integration Service
 *
 * Production-oriented Slack Web API abstraction.
 *
 * Capabilities:
 * - Get authenticated user
 * - List channels
 * - Get channel information
 * - Join channels
 * - Leave channels
 * - Send messages
 * - Update messages
 * - Delete messages
 * - Reply in threads
 * - Add reactions
 * - Remove reactions
 * - Get conversation history
 * - Search messages
 * - Get users
 */

export interface SlackCredentials {
  accessToken: string;
  apiBaseUrl?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  displayName?: string;
  email?: string;
  title?: string;
  timezone?: string;
  isBot?: boolean;
  isAdmin?: boolean;
  deleted?: boolean;
  avatarUrl?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isChannel?: boolean;
  isPrivate?: boolean;
  isArchived?: boolean;
  isMember?: boolean;
  isGeneral?: boolean;
  topic?: string;
  purpose?: string;
  memberCount?: number;
}

export interface SlackMessage {
  type?: string;
  channel?: string;
  user?: string;
  text: string;
  ts: string;
  threadTs?: string;
  replyCount?: number;
  replyUsers?: string[];
  reactions?: SlackReaction[];
  blocks?: unknown[];
  attachments?: unknown[];
}

export interface SlackReaction {
  name: string;
  count: number;
  users?: string[];
}

export interface SlackApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  responseMetadata?: {
    nextCursor?: string;
  };
  data?: T;
}

export interface SlackPaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface SlackListChannelsOptions
  extends SlackPaginationOptions {
  excludeArchived?: boolean;
  types?: string[];
}

export interface SlackHistoryOptions
  extends SlackPaginationOptions {
  oldest?: string;
  latest?: string;
  inclusive?: boolean;
}

export interface SlackSearchOptions
  extends SlackPaginationOptions {
  sort?: "score" | "timestamp";
  sortDirection?: "asc" | "desc";
}

export interface SendSlackMessageInput {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: unknown[];
  attachments?: unknown[];
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

export interface UpdateSlackMessageInput {
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}

export interface DeleteSlackMessageInput {
  channel: string;
  ts: string;
}

export interface SlackSearchResult {
  messages: SlackMessage[];
  total: number;
  paging?: {
    page?: number;
    pageCount?: number;
    perPage?: number;
    total?: number;
  };
}

export interface SlackListResult<T> {
  items: T[];
  nextCursor?: string;
}

export class SlackIntegrationError extends Error {
  public readonly code?: string;
  public readonly status?: number;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = "SlackIntegrationError";
    this.code = options.code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

const DEFAULT_API_BASE_URL =
  "https://slack.com/api";

/* -------------------------------------------------------------------------- */
/*                               VALIDATION                                   */
/* -------------------------------------------------------------------------- */

function ensureString(
  value: string,
  fieldName: string
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new SlackIntegrationError(
      `${fieldName} is required.`,
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return normalized;
}

function normalizeLimit(
  value?: number,
  fallback = 100
): number {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new SlackIntegrationError(
      "Limit must be a positive number.",
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return Math.min(
    Math.floor(value),
    1000
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAPPERS                                     */
/* -------------------------------------------------------------------------- */

function mapSlackUser(
  data: Record<string, unknown>
): SlackUser {
  const profile =
    data.profile &&
    typeof data.profile === "object"
      ? (data.profile as Record<string, unknown>)
      : {};

  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),
    realName:
      typeof data.real_name === "string"
        ? data.real_name
        : undefined,
    displayName:
      typeof profile.display_name === "string"
        ? profile.display_name
        : undefined,
    email:
      typeof profile.email === "string"
        ? profile.email
        : undefined,
    title:
      typeof profile.title === "string"
        ? profile.title
        : undefined,
    timezone:
      typeof data.tz === "string"
        ? data.tz
        : undefined,
    isBot:
      typeof data.is_bot === "boolean"
        ? data.is_bot
        : undefined,
    isAdmin:
      typeof data.is_admin === "boolean"
        ? data.is_admin
        : undefined,
    deleted:
      typeof data.deleted === "boolean"
        ? data.deleted
        : undefined,
    avatarUrl:
      typeof profile.image_512 === "string"
        ? profile.image_512
        : typeof profile.image_192 === "string"
          ? profile.image_192
          : typeof profile.image_72 === "string"
            ? profile.image_72
            : undefined,
  };
}

function mapSlackChannel(
  data: Record<string, unknown>
): SlackChannel {
  const topic =
    data.topic &&
    typeof data.topic === "object"
      ? (data.topic as Record<string, unknown>)
      : {};

  const purpose =
    data.purpose &&
    typeof data.purpose === "object"
      ? (data.purpose as Record<string, unknown>)
      : {};

  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),
    isChannel:
      typeof data.is_channel === "boolean"
        ? data.is_channel
        : undefined,
    isPrivate:
      typeof data.is_private === "boolean"
        ? data.is_private
        : undefined,
    isArchived:
      typeof data.is_archived === "boolean"
        ? data.is_archived
        : undefined,
    isMember:
      typeof data.is_member === "boolean"
        ? data.is_member
        : undefined,
    isGeneral:
      typeof data.is_general === "boolean"
        ? data.is_general
        : undefined,
    topic:
      typeof topic.value === "string"
        ? topic.value
        : undefined,
    purpose:
      typeof purpose.value === "string"
        ? purpose.value
        : undefined,
    memberCount:
      typeof data.num_members === "number"
        ? data.num_members
        : undefined,
  };
}

function mapSlackReaction(
  data: Record<string, unknown>
): SlackReaction {
  return {
    name: String(data.name ?? ""),
    count: Number(data.count ?? 0),
    users: Array.isArray(data.users)
      ? data.users.filter(
          (value): value is string =>
            typeof value === "string"
        )
      : undefined,
  };
}

function mapSlackMessage(
  data: Record<string, unknown>
): SlackMessage {
  return {
    type:
      typeof data.type === "string"
        ? data.type
        : undefined,
    channel:
      typeof data.channel === "string"
        ? data.channel
        : undefined,
    user:
      typeof data.user === "string"
        ? data.user
        : undefined,
    text:
      typeof data.text === "string"
        ? data.text
        : "",
    ts: String(data.ts ?? ""),
    threadTs:
      typeof data.thread_ts === "string"
        ? data.thread_ts
        : undefined,
    replyCount:
      typeof data.reply_count === "number"
        ? data.reply_count
        : undefined,
    replyUsers: Array.isArray(
      data.reply_users
    )
      ? data.reply_users.filter(
          (value): value is string =>
            typeof value === "string"
        )
      : undefined,
    reactions: Array.isArray(data.reactions)
      ? data.reactions
          .filter(
            (
              value
            ): value is Record<string, unknown> =>
              Boolean(value) &&
              typeof value === "object"
          )
          .map(mapSlackReaction)
      : undefined,
    blocks: Array.isArray(data.blocks)
      ? data.blocks
      : undefined,
    attachments: Array.isArray(
      data.attachments
    )
      ? data.attachments
      : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                              SLACK SERVICE                                 */
/* -------------------------------------------------------------------------- */

export class SlackService {
  private readonly accessToken: string;
  private readonly apiBaseUrl: string;

  constructor(
    credentials: SlackCredentials
  ) {
    this.accessToken = ensureString(
      credentials.accessToken,
      "Slack access token"
    );

    this.apiBaseUrl = (
      credentials.apiBaseUrl ||
      DEFAULT_API_BASE_URL
    ).replace(/\/+$/, "");
  }

  private async request<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.apiBaseUrl}/${method}`;

    try {
      const body = new URLSearchParams();

      if (params) {
        for (
          const [key, value] of Object.entries(
            params
          )
        ) {
          if (
            value === undefined ||
            value === null
          ) {
            continue;
          }

          if (Array.isArray(value)) {
            body.set(
              key,
              value.join(",")
            );
            continue;
          }

          if (typeof value === "object") {
            body.set(
              key,
              JSON.stringify(value)
            );
            continue;
          }

          body.set(key, String(value));
        }
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      });

      const payload: unknown =
        await response.json();

      if (!response.ok) {
        throw new SlackIntegrationError(
          `Slack API request failed with status ${response.status}.`,
          {
            status: response.status,
            code: "SLACK_HTTP_ERROR",
            cause: payload,
          }
        );
      }

      if (
        !payload ||
        typeof payload !== "object"
      ) {
        throw new SlackIntegrationError(
          "Invalid Slack API response.",
          {
            code: "INVALID_RESPONSE",
            cause: payload,
          }
        );
      }

      const data =
        payload as Record<string, unknown>;

      if (data.ok !== true) {
        throw new SlackIntegrationError(
          typeof data.error === "string"
            ? data.error
            : "Slack API returned an error.",
          {
            code: "SLACK_API_ERROR",
            cause: payload,
          }
        );
      }

      return data as T;
    } catch (error) {
      if (
        error instanceof SlackIntegrationError
      ) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unknown Slack request error.";

      throw new SlackIntegrationError(
        `Slack request failed: ${message}`,
        {
          code: "SLACK_REQUEST_FAILED",
          cause: error,
        }
      );
    }
  }

  /**
   * Get information about the authenticated user.
   */
  async getAuthenticatedUser(): Promise<SlackUser> {
    const response = await this.request<
      Record<string, unknown>
    >("auth.test");

    const userId = String(
      response.user_id ?? ""
    );

    if (!userId) {
      throw new SlackIntegrationError(
        "Unable to determine authenticated Slack user.",
        {
          code: "AUTH_USER_NOT_FOUND",
        }
      );
    }

    return this.getUser(userId);
  }

  /**
   * Get a Slack user.
   */
  async getUser(
    userId: string
  ): Promise<SlackUser> {
    const response = await this.request<
      Record<string, unknown>
    >("users.info", {
      user: ensureString(
        userId,
        "Slack user ID"
      ),
    });

    const user =
      response.user &&
      typeof response.user === "object"
        ? (response.user as Record<
            string,
            unknown
          >)
        : null;

    if (!user) {
      throw new SlackIntegrationError(
        "Slack user was not found.",
        {
          code: "USER_NOT_FOUND",
        }
      );
    }

    return mapSlackUser(user);
  }

  /**
   * List workspace users.
   */
  async listUsers(
    options: SlackPaginationOptions = {}
  ): Promise<SlackListResult<SlackUser>> {
    const response = await this.request<
      Record<string, unknown>
    >("users.list", {
      limit: normalizeLimit(options.limit),
      cursor: options.cursor,
    });

    const members = Array.isArray(
      response.members
    )
      ? response.members
      : [];

    const responseMetadata =
      response.response_metadata &&
      typeof response.response_metadata ===
        "object"
        ? (
            response.response_metadata as Record<
              string,
              unknown
            >
          )
        : {};

    return {
      items: members
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapSlackUser),
      nextCursor:
        typeof responseMetadata.next_cursor ===
        "string"
          ? responseMetadata.next_cursor
          : undefined,
    };
  }

  /**
   * List workspace channels.
   */
  async listChannels(
    options: SlackListChannelsOptions = {}
  ): Promise<SlackListResult<SlackChannel>> {
    const response = await this.request<
      Record<string, unknown>
    >("conversations.list", {
      limit: normalizeLimit(options.limit),
      cursor: options.cursor,
      exclude_archived:
        options.excludeArchived ?? true,
      types:
        options.types?.join(",") ??
        "public_channel,private_channel",
    });

    const channels = Array.isArray(
      response.channels
    )
      ? response.channels
      : [];

    const responseMetadata =
      response.response_metadata &&
      typeof response.response_metadata ===
        "object"
        ? (
            response.response_metadata as Record<
              string,
              unknown
            >
          )
        : {};

    return {
      items: channels
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapSlackChannel),
      nextCursor:
        typeof responseMetadata.next_cursor ===
        "string"
          ? responseMetadata.next_cursor
          : undefined,
    };
  }

  /**
   * Get channel information.
   */
  async getChannel(
    channelId: string
  ): Promise<SlackChannel> {
    const response = await this.request<
      Record<string, unknown>
    >("conversations.info", {
      channel: ensureString(
        channelId,
        "Slack channel ID"
      ),
    });

    const channel =
      response.channel &&
      typeof response.channel === "object"
        ? (response.channel as Record<
            string,
            unknown
          >)
        : null;

    if (!channel) {
      throw new SlackIntegrationError(
        "Slack channel was not found.",
        {
          code: "CHANNEL_NOT_FOUND",
        }
      );
    }

    return mapSlackChannel(channel);
  }

  /**
   * Join a channel.
   */
  async joinChannel(
    channelId: string
  ): Promise<SlackChannel> {
    const response = await this.request<
      Record<string, unknown>
    >("conversations.join", {
      channel: ensureString(
        channelId,
        "Slack channel ID"
      ),
    });

    const channel =
      response.channel &&
      typeof response.channel === "object"
        ? (response.channel as Record<
            string,
            unknown
          >)
        : null;

    if (!channel) {
      throw new SlackIntegrationError(
        "Unable to join Slack channel.",
        {
          code: "JOIN_CHANNEL_FAILED",
        }
      );
    }

    return mapSlackChannel(channel);
  }

  /**
   * Leave a channel.
   */
  async leaveChannel(
    channelId: string
  ): Promise<void> {
    await this.request(
      "conversations.leave",
      {
        channel: ensureString(
          channelId,
          "Slack channel ID"
        ),
      }
    );
  }

  /**
   * Send a message.
   */
  async sendMessage(
    input: SendSlackMessageInput
  ): Promise<SlackMessage> {
    const response = await this.request<
      Record<string, unknown>
    >("chat.postMessage", {
      channel: ensureString(
        input.channel,
        "Slack channel"
      ),
      text: ensureString(
        input.text,
        "Message text"
      ),
      thread_ts: input.threadTs,
      blocks: input.blocks,
      attachments: input.attachments,
      unfurl_links:
        input.unfurlLinks ?? false,
      unfurl_media:
        input.unfurlMedia ?? false,
    });

    const message =
      response.message &&
      typeof response.message === "object"
        ? (response.message as Record<
            string,
            unknown
          >)
        : null;

    if (!message) {
      throw new SlackIntegrationError(
        "Slack did not return the created message.",
        {
          code: "MESSAGE_NOT_RETURNED",
        }
      );
    }

    return mapSlackMessage({
      ...message,
      channel: input.channel,
    });
  }

  /**
   * Update an existing message.
   */
  async updateMessage(
    input: UpdateSlackMessageInput
  ): Promise<SlackMessage> {
    const response = await this.request<
      Record<string, unknown>
    >("chat.update", {
      channel: ensureString(
        input.channel,
        "Slack channel"
      ),
      ts: ensureString(
        input.ts,
        "Message timestamp"
      ),
      text: ensureString(
        input.text,
        "Message text"
      ),
      blocks: input.blocks,
    });

    const message =
      response.message &&
      typeof response.message === "object"
        ? (response.message as Record<
            string,
            unknown
          >)
        : null;

    if (!message) {
      throw new SlackIntegrationError(
        "Slack did not return the updated message.",
        {
          code: "MESSAGE_NOT_RETURNED",
        }
      );
    }

    return mapSlackMessage({
      ...message,
      channel: input.channel,
    });
  }

  /**
   * Delete a message.
   */
  async deleteMessage(
    input: DeleteSlackMessageInput
  ): Promise<void> {
    await this.request(
      "chat.delete",
      {
        channel: ensureString(
          input.channel,
          "Slack channel"
        ),
        ts: ensureString(
          input.ts,
          "Message timestamp"
        ),
      }
    );
  }

  /**
   * Reply to an existing thread.
   */
  async replyToThread(
    channel: string,
    threadTs: string,
    text: string,
    options: {
      blocks?: unknown[];
      attachments?: unknown[];
    } = {}
  ): Promise<SlackMessage> {
    return this.sendMessage({
      channel,
      threadTs: ensureString(
        threadTs,
        "Thread timestamp"
      ),
      text,
      blocks: options.blocks,
      attachments: options.attachments,
    });
  }

  /**
   * Add an emoji reaction.
   */
  async addReaction(
    channel: string,
    timestamp: string,
    reactionName: string
  ): Promise<void> {
    await this.request("reactions.add", {
      channel: ensureString(
        channel,
        "Slack channel"
      ),
      timestamp: ensureString(
        timestamp,
        "Message timestamp"
      ),
      name: ensureString(
        reactionName,
        "Reaction name"
      ),
    });
  }

  /**
   * Remove an emoji reaction.
   */
  async removeReaction(
    channel: string,
    timestamp: string,
    reactionName: string
  ): Promise<void> {
    await this.request(
      "reactions.remove",
      {
        channel: ensureString(
          channel,
          "Slack channel"
        ),
        timestamp: ensureString(
          timestamp,
          "Message timestamp"
        ),
        name: ensureString(
          reactionName,
          "Reaction name"
        ),
      }
    );
  }

  /**
   * Get conversation history.
   */
  async getChannelHistory(
    channelId: string,
    options: SlackHistoryOptions = {}
  ): Promise<SlackListResult<SlackMessage>> {
    const response = await this.request<
      Record<string, unknown>
    >("conversations.history", {
      channel: ensureString(
        channelId,
        "Slack channel ID"
      ),
      limit: normalizeLimit(options.limit),
      cursor: options.cursor,
      oldest: options.oldest,
      latest: options.latest,
      inclusive: options.inclusive,
    });

    const messages = Array.isArray(
      response.messages
    )
      ? response.messages
      : [];

    const responseMetadata =
      response.response_metadata &&
      typeof response.response_metadata ===
        "object"
        ? (
            response.response_metadata as Record<
              string,
              unknown
            >
          )
        : {};

    return {
      items: messages
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map((message) =>
          mapSlackMessage({
            ...message,
            channel: channelId,
          })
        ),
      nextCursor:
        typeof responseMetadata.next_cursor ===
        "string"
          ? responseMetadata.next_cursor
          : undefined,
    };
  }

  /**
   * Get replies in a thread.
   */
  async getThreadReplies(
    channelId: string,
    threadTs: string,
    options: SlackPaginationOptions = {}
  ): Promise<SlackListResult<SlackMessage>> {
    const response = await this.request<
      Record<string, unknown>
    >("conversations.replies", {
      channel: ensureString(
        channelId,
        "Slack channel ID"
      ),
      ts: ensureString(
        threadTs,
        "Thread timestamp"
      ),
      limit: normalizeLimit(options.limit),
      cursor: options.cursor,
    });

    const messages = Array.isArray(
      response.messages
    )
      ? response.messages
      : [];

    const responseMetadata =
      response.response_metadata &&
      typeof response.response_metadata ===
        "object"
        ? (
            response.response_metadata as Record<
              string,
              unknown
            >
          )
        : {};

    return {
      items: messages
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map((message) =>
          mapSlackMessage({
            ...message,
            channel: channelId,
          })
        ),
      nextCursor:
        typeof responseMetadata.next_cursor ===
        "string"
          ? responseMetadata.next_cursor
          : undefined,
    };
  }

  /**
   * Search Slack messages.
   */
  async searchMessages(
    query: string,
    options: SlackSearchOptions = {}
  ): Promise<SlackSearchResult> {
    const response = await this.request<
      Record<string, unknown>
    >("search.messages", {
      query: ensureString(
        query,
        "Search query"
      ),
      count: normalizeLimit(
        options.limit,
        100
      ),
      page: options.cursor,
      sort: options.sort,
      sort_dir: options.sortDirection,
    });

    const messagesContainer =
      response.messages &&
      typeof response.messages === "object"
        ? (response.messages as Record<
            string,
            unknown
          >)
        : {};

    const matches = Array.isArray(
      messagesContainer.matches
    )
      ? messagesContainer.matches
      : [];

    const paging =
      messagesContainer.paging &&
      typeof messagesContainer.paging ===
        "object"
        ? (
            messagesContainer.paging as Record<
              string,
              unknown
            >
          )
        : undefined;

    return {
      messages: matches
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapSlackMessage),

      total: Number(
        messagesContainer.total ?? 0
      ),

      paging: paging
        ? {
            page:
              typeof paging.page === "number"
                ? paging.page
                : undefined,
            pageCount:
              typeof paging.page_count ===
              "number"
                ? paging.page_count
                : undefined,
            perPage:
              typeof paging.per_page ===
              "number"
                ? paging.per_page
                : undefined,
            total:
              typeof paging.total === "number"
                ? paging.total
                : undefined,
          }
        : undefined,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                              FACTORY                                       */
/* -------------------------------------------------------------------------- */

export function createSlackService(
  credentials: SlackCredentials
): SlackService {
  return new SlackService(credentials);
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default SlackService;