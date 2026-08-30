/**
 * SYRAVEN Gmail Integration Service
 *
 * Production-oriented Gmail REST API abstraction.
 *
 * Capabilities:
 * - Get authenticated profile
 * - List messages
 * - Get messages
 * - Search messages
 * - Send emails
 * - Reply to emails
 * - List threads
 * - Get threads
 * - Modify labels
 * - Mark read/unread
 * - Star/unstar
 * - Trash/untrash
 * - List labels
 *
 * Uses Gmail REST API directly via fetch.
 */

export interface GmailCredentials {
  accessToken: string;
  apiBaseUrl?: string;
  userId?: string;
}

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: "system" | "user";
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailAttachment {
  filename: string;
  mimeType?: string;
  attachmentId?: string;
  size?: number;
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;

  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  date?: string;

  bodyText?: string;
  bodyHtml?: string;

  headers?: GmailHeader[];
  attachments?: GmailAttachment[];

  raw?: Record<string, unknown>;
}

export interface GmailThread {
  id: string;
  historyId?: string;
  messages: GmailMessage[];
  snippet?: string;
}

export interface GmailListOptions {
  maxResults?: number;
  pageToken?: string;
  query?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export interface GmailListMessagesResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailListThreadsResult {
  threads: GmailThread[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailSendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;

  cc?: string | string[];
  bcc?: string | string[];

  replyTo?: string;

  threadId?: string;

  inReplyTo?: string;
  references?: string;

  from?: string;
}

export interface GmailModifyMessageInput {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface GmailModifyThreadInput {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

/* -------------------------------------------------------------------------- */
/*                                  ERROR                                     */
/* -------------------------------------------------------------------------- */

export class GmailIntegrationError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = "GmailIntegrationError";
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_API_BASE_URL =
  "https://gmail.googleapis.com/gmail/v1";

const DEFAULT_USER_ID = "me";

const MAX_RESULTS_LIMIT = 500;

/* -------------------------------------------------------------------------- */
/*                               VALIDATION                                   */
/* -------------------------------------------------------------------------- */

function ensureString(
  value: string | undefined | null,
  fieldName: string
): string {
  const normalized =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!normalized) {
    throw new GmailIntegrationError(
      `${fieldName} is required.`,
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return normalized;
}

function normalizeMaxResults(
  value?: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new GmailIntegrationError(
      "maxResults must be a positive number.",
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return Math.min(
    Math.floor(value),
    MAX_RESULTS_LIMIT
  );
}

function normalizeEmailList(
  value?: string | string[]
): string[] {
  if (!value) {
    return [];
  }

  const values =
    typeof value === "string"
      ? [value]
      : value;

  return values
    .map((email) => email.trim())
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/*                              BASE64 HELPERS                                */
/* -------------------------------------------------------------------------- */

function encodeBase64Url(
  value: string
): string {
  const bytes = new TextEncoder().encode(value);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(
  value?: string
): string {
  if (!value) {
    return "";
  }

  try {
    const normalized = value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padding =
      "=".repeat(
        (4 - (normalized.length % 4)) % 4
      );

    const binary = atob(
      normalized + padding
    );

    const bytes = Uint8Array.from(
      binary,
      (character) =>
        character.charCodeAt(0)
    );

    return new TextDecoder().decode(
      bytes
    );
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/*                                MAPPERS                                     */
/* -------------------------------------------------------------------------- */

function getHeaderValue(
  headers: GmailHeader[],
  name: string
): string | undefined {
  const header = headers.find(
    (item) =>
      item.name.toLowerCase() ===
      name.toLowerCase()
  );

  return header?.value;
}

function mapHeaders(
  value: unknown
): GmailHeader[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object"
    )
    .map((item) => ({
      name:
        typeof item.name === "string"
          ? item.name
          : "",
      value:
        typeof item.value === "string"
          ? item.value
          : "",
    }))
    .filter(
      (item) =>
        item.name.length > 0
    );
}

function extractMessageParts(
  payload: Record<string, unknown> | undefined
): {
  text?: string;
  html?: string;
  attachments: GmailAttachment[];
} {
  if (!payload) {
    return {
      attachments: [],
    };
  }

  let text = "";
  let html = "";

  const attachments: GmailAttachment[] = [];

  const processPart = (
    part: Record<string, unknown>
  ) => {
    const mimeType =
      typeof part.mimeType === "string"
        ? part.mimeType
        : "";

    const filename =
      typeof part.filename === "string"
        ? part.filename
        : "";

    const body =
      part.body &&
      typeof part.body === "object"
        ? (part.body as Record<
            string,
            unknown
          >)
        : {};

    const data =
      typeof body.data === "string"
        ? body.data
        : undefined;

    if (
      mimeType === "text/plain" &&
      data
    ) {
      text += decodeBase64Url(data);
    }

    if (
      mimeType === "text/html" &&
      data
    ) {
      html += decodeBase64Url(data);
    }

    if (
      filename ||
      typeof body.attachmentId === "string"
    ) {
      attachments.push({
        filename,
        mimeType: mimeType || undefined,
        attachmentId:
          typeof body.attachmentId ===
          "string"
            ? body.attachmentId
            : undefined,
        size:
          typeof body.size === "number"
            ? body.size
            : undefined,
      });
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        if (
          child &&
          typeof child === "object"
        ) {
          processPart(
            child as Record<
              string,
              unknown
            >
          );
        }
      }
    }
  };

  processPart(payload);

  return {
    text: text || undefined,
    html: html || undefined,
    attachments,
  };
}

function mapGmailMessage(
  data: Record<string, unknown>
): GmailMessage {
  const payload =
    data.payload &&
    typeof data.payload === "object"
      ? (data.payload as Record<
          string,
          unknown
        >)
      : undefined;

  const headers = mapHeaders(
    payload?.headers
  );

  const extracted =
    extractMessageParts(payload);

  return {
    id: String(data.id ?? ""),

    threadId:
      typeof data.threadId === "string"
        ? data.threadId
        : undefined,

    labelIds: Array.isArray(data.labelIds)
      ? data.labelIds.filter(
          (value): value is string =>
            typeof value === "string"
        )
      : undefined,

    snippet:
      typeof data.snippet === "string"
        ? data.snippet
        : undefined,

    historyId:
      typeof data.historyId === "string"
        ? data.historyId
        : undefined,

    internalDate:
      typeof data.internalDate === "string"
        ? data.internalDate
        : undefined,

    sizeEstimate:
      typeof data.sizeEstimate === "number"
        ? data.sizeEstimate
        : undefined,

    subject: getHeaderValue(
      headers,
      "Subject"
    ),

    from: getHeaderValue(
      headers,
      "From"
    ),

    to: getHeaderValue(
      headers,
      "To"
    ),

    cc: getHeaderValue(
      headers,
      "Cc"
    ),

    bcc: getHeaderValue(
      headers,
      "Bcc"
    ),

    date: getHeaderValue(
      headers,
      "Date"
    ),

    bodyText: extracted.text,

    bodyHtml: extracted.html,

    headers,

    attachments: extracted.attachments,

    raw: data,
  };
}

function mapGmailThread(
  data: Record<string, unknown>
): GmailThread {
  const messages =
    Array.isArray(data.messages)
      ? data.messages
          .filter(
            (
              item
            ): item is Record<
              string,
              unknown
            > =>
              Boolean(item) &&
              typeof item === "object"
          )
          .map(mapGmailMessage)
      : [];

  return {
    id: String(data.id ?? ""),

    historyId:
      typeof data.historyId === "string"
        ? data.historyId
        : undefined,

    messages,

    snippet:
      typeof data.snippet === "string"
        ? data.snippet
        : undefined,
  };
}

function mapGmailLabel(
  data: Record<string, unknown>
): GmailLabel {
  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),

    type:
      data.type === "system" ||
      data.type === "user"
        ? data.type
        : undefined,

    messageListVisibility:
      typeof data.messageListVisibility ===
      "string"
        ? data.messageListVisibility
        : undefined,

    labelListVisibility:
      typeof data.labelListVisibility ===
      "string"
        ? data.labelListVisibility
        : undefined,

    messagesTotal:
      typeof data.messagesTotal === "number"
        ? data.messagesTotal
        : undefined,

    messagesUnread:
      typeof data.messagesUnread === "number"
        ? data.messagesUnread
        : undefined,

    threadsTotal:
      typeof data.threadsTotal === "number"
        ? data.threadsTotal
        : undefined,

    threadsUnread:
      typeof data.threadsUnread === "number"
        ? data.threadsUnread
        : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                              MIME BUILDER                                  */
/* -------------------------------------------------------------------------- */

function buildMimeMessage(
  input: GmailSendEmailInput
): string {
  const to = normalizeEmailList(input.to);

  if (to.length === 0) {
    throw new GmailIntegrationError(
      "At least one recipient is required.",
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  const subject = ensureString(
    input.subject,
    "Email subject"
  );

  if (
    !input.text &&
    !input.html
  ) {
    throw new GmailIntegrationError(
      "Email text or html content is required.",
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  const headers: string[] = [
    `To: ${to.join(", ")}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  ];

  const cc = normalizeEmailList(
    input.cc
  );

  const bcc = normalizeEmailList(
    input.bcc
  );

  if (cc.length > 0) {
    headers.push(
      `Cc: ${cc.join(", ")}`
    );
  }

  if (bcc.length > 0) {
    headers.push(
      `Bcc: ${bcc.join(", ")}`
    );
  }

  if (input.from) {
    headers.push(
      `From: ${input.from.trim()}`
    );
  }

  if (input.replyTo) {
    headers.push(
      `Reply-To: ${input.replyTo.trim()}`
    );
  }

  if (input.inReplyTo) {
    headers.push(
      `In-Reply-To: ${input.inReplyTo.trim()}`
    );
  }

  if (input.references) {
    headers.push(
      `References: ${input.references.trim()}`
    );
  }

  if (
    input.text &&
    input.html
  ) {
    const boundary =
      `boundary_${crypto.randomUUID()}`;

    headers.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    );

    return [
      ...headers,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html,
      "",
      `--${boundary}--`,
    ].join("\r\n");
  }

  if (input.html) {
    headers.push(
      'Content-Type: text/html; charset="UTF-8"'
    );

    return [
      ...headers,
      "",
      input.html,
    ].join("\r\n");
  }

  headers.push(
    'Content-Type: text/plain; charset="UTF-8"'
  );

  return [
    ...headers,
    "",
    input.text ?? "",
  ].join("\r\n");
}

/* -------------------------------------------------------------------------- */
/*                              GMAIL SERVICE                                 */
/* -------------------------------------------------------------------------- */

export class GmailService {
  private readonly accessToken: string;

  private readonly apiBaseUrl: string;

  private readonly userId: string;

  constructor(
    credentials: GmailCredentials
  ) {
    this.accessToken = ensureString(
      credentials.accessToken,
      "Gmail access token"
    );

    this.apiBaseUrl = (
      credentials.apiBaseUrl ||
      DEFAULT_API_BASE_URL
    ).replace(/\/+$/, "");

    this.userId =
      credentials.userId?.trim() ||
      DEFAULT_USER_ID;
  }

  private getUserPath(
    path = ""
  ): string {
    return `/users/${encodeURIComponent(
      this.userId
    )}${path}`;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(
        `${this.apiBaseUrl}${path}`,
        {
          method:
            options.method ?? "GET",

          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: "application/json",
            ...(options.body !== undefined
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),
          },

          body:
            options.body !== undefined
              ? JSON.stringify(
                  options.body
                )
              : undefined,
        }
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown network error.";

      throw new GmailIntegrationError(
        `Gmail request failed: ${message}`,
        {
          code: "GMAIL_REQUEST_FAILED",
          cause: error,
        }
      );
    }

    if (
      response.status === 204
    ) {
      return undefined as T;
    }

    let payload: unknown;

    try {
      const contentType =
        response.headers.get(
          "content-type"
        ) ?? "";

      payload = contentType.includes(
        "application/json"
      )
        ? await response.json()
        : await response.text();
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const errorPayload =
        payload &&
        typeof payload === "object"
          ? (payload as Record<
              string,
              unknown
            >)
          : {};

      const errorObject =
        errorPayload.error &&
        typeof errorPayload.error ===
          "object"
          ? (errorPayload.error as Record<
              string,
              unknown
            >)
          : errorPayload;

      const message =
        typeof errorObject.message ===
        "string"
          ? errorObject.message
          : `Gmail API request failed with status ${response.status}.`;

      const code =
        typeof errorObject.status ===
        "string"
          ? errorObject.status
          : "GMAIL_API_ERROR";

      throw new GmailIntegrationError(
        message,
        {
          status: response.status,
          code,
          cause: payload,
        }
      );
    }

    return payload as T;
  }

  /**
   * Get authenticated Gmail profile.
   */
  async getProfile(): Promise<GmailProfile> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath("/profile")
    );

    return {
      emailAddress: String(
        data.emailAddress ?? ""
      ),

      messagesTotal:
        typeof data.messagesTotal ===
        "number"
          ? data.messagesTotal
          : undefined,

      threadsTotal:
        typeof data.threadsTotal ===
        "number"
          ? data.threadsTotal
          : undefined,

      historyId:
        typeof data.historyId === "string"
          ? data.historyId
          : undefined,
    };
  }

  /**
   * List Gmail messages.
   */
  async listMessages(
    options: GmailListOptions = {}
  ): Promise<GmailListMessagesResult> {
    const params =
      new URLSearchParams();

    const maxResults =
      normalizeMaxResults(
        options.maxResults
      );

    if (
      maxResults !== undefined
    ) {
      params.set(
        "maxResults",
        String(maxResults)
      );
    }

    if (options.pageToken) {
      params.set(
        "pageToken",
        options.pageToken
      );
    }

    if (options.query) {
      params.set(
        "q",
        options.query
      );
    }

    if (
      options.includeSpamTrash !==
      undefined
    ) {
      params.set(
        "includeSpamTrash",
        String(
          options.includeSpamTrash
        )
      );
    }

    for (
      const labelId of
        options.labelIds ?? []
    ) {
      params.append(
        "labelIds",
        labelId
      );
    }

    const query =
      params.toString();

    const data = await this.request<
      Record<string, unknown>
    >(
      `${this.getUserPath(
        "/messages"
      )}${query ? `?${query}` : ""}`
    );

    const messageReferences =
      Array.isArray(data.messages)
        ? data.messages
        : [];

    const messages =
      await Promise.all(
        messageReferences
          .filter(
            (
              item
            ): item is Record<
              string,
              unknown
            > =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof item.id === "string"
          )
          .map((item) =>
            this.getMessage(
              item.id as string
            )
          )
      );

    return {
      messages,

      nextPageToken:
        typeof data.nextPageToken ===
        "string"
          ? data.nextPageToken
          : undefined,

      resultSizeEstimate:
        typeof data.resultSizeEstimate ===
        "number"
          ? data.resultSizeEstimate
          : undefined,
    };
  }

  /**
   * Search Gmail messages.
   *
   * Gmail search syntax example:
   * from:user@example.com
   * is:unread
   * subject:invoice
   */
  async searchMessages(
    query: string,
    options: Omit<
      GmailListOptions,
      "query"
    > = {}
  ): Promise<GmailListMessagesResult> {
    return this.listMessages({
      ...options,
      query: ensureString(
        query,
        "Gmail search query"
      ),
    });
  }

  /**
   * Get a full Gmail message.
   */
  async getMessage(
    messageId: string
  ): Promise<GmailMessage> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `${this.getUserPath(
        `/messages/${encodeURIComponent(
          ensureString(
            messageId,
            "Gmail message ID"
          )
        )}`
      )}?format=full`
    );

    return mapGmailMessage(data);
  }

  /**
   * Send an email.
   */
  async sendEmail(
    input: GmailSendEmailInput
  ): Promise<GmailMessage> {
    const mimeMessage =
      buildMimeMessage(input);

    const raw =
      encodeBase64Url(
        mimeMessage
      );

    const body: Record<
      string,
      unknown
    > = {
      raw,
    };

    if (input.threadId) {
      body.threadId =
        input.threadId.trim();
    }

    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        "/messages/send"
      ),
      {
        method: "POST",
        body,
      }
    );

    return mapGmailMessage(data);
  }

  /**
   * Reply to an existing Gmail message.
   */
  async replyToMessage(
    messageId: string,
    input: Omit<
      GmailSendEmailInput,
      "threadId" | "inReplyTo"
    >
  ): Promise<GmailMessage> {
    const original =
      await this.getMessage(
        messageId
      );

    const messageIdHeader =
      getHeaderValue(
        original.headers ?? [],
        "Message-ID"
      );

    const references =
      getHeaderValue(
        original.headers ?? [],
        "References"
      );

    const newReferences =
      [
        references,
        messageIdHeader,
      ]
        .filter(Boolean)
        .join(" ");

    return this.sendEmail({
      ...input,

      threadId:
        original.threadId,

      inReplyTo:
        messageIdHeader,

      references:
        newReferences || undefined,
    });
  }

  /**
   * Modify Gmail message labels.
   */
  async modifyMessage(
    messageId: string,
    input: GmailModifyMessageInput
  ): Promise<GmailMessage> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/messages/${encodeURIComponent(
          ensureString(
            messageId,
            "Gmail message ID"
          )
        )}/modify`
      ),
      {
        method: "POST",

        body: {
          addLabelIds:
            input.addLabelIds,
          removeLabelIds:
            input.removeLabelIds,
        },
      }
    );

    return mapGmailMessage(data);
  }

  /**
   * Mark a message as read.
   */
  async markAsRead(
    messageId: string
  ): Promise<GmailMessage> {
    return this.modifyMessage(
      messageId,
      {
        removeLabelIds: ["UNREAD"],
      }
    );
  }

  /**
   * Mark a message as unread.
   */
  async markAsUnread(
    messageId: string
  ): Promise<GmailMessage> {
    return this.modifyMessage(
      messageId,
      {
        addLabelIds: ["UNREAD"],
      }
    );
  }

  /**
   * Star a message.
   */
  async starMessage(
    messageId: string
  ): Promise<GmailMessage> {
    return this.modifyMessage(
      messageId,
      {
        addLabelIds: ["STARRED"],
      }
    );
  }

  /**
   * Remove star from message.
   */
  async unstarMessage(
    messageId: string
  ): Promise<GmailMessage> {
    return this.modifyMessage(
      messageId,
      {
        removeLabelIds: ["STARRED"],
      }
    );
  }

  /**
   * Move message to trash.
   */
  async trashMessage(
    messageId: string
  ): Promise<GmailMessage> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/messages/${encodeURIComponent(
          ensureString(
            messageId,
            "Gmail message ID"
          )
        )}/trash`
      ),
      {
        method: "POST",
      }
    );

    return mapGmailMessage(data);
  }

  /**
   * Restore message from trash.
   */
  async untrashMessage(
    messageId: string
  ): Promise<GmailMessage> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/messages/${encodeURIComponent(
          ensureString(
            messageId,
            "Gmail message ID"
          )
        )}/untrash`
      ),
      {
        method: "POST",
      }
    );

    return mapGmailMessage(data);
  }

  /**
   * Permanently delete a message.
   */
  async deleteMessage(
    messageId: string
  ): Promise<void> {
    await this.request<void>(
      this.getUserPath(
        `/messages/${encodeURIComponent(
          ensureString(
            messageId,
            "Gmail message ID"
          )
        )}`
      ),
      {
        method: "DELETE",
      }
    );
  }

  /**
   * List Gmail threads.
   */
  async listThreads(
    options: GmailListOptions = {}
  ): Promise<GmailListThreadsResult> {
    const params =
      new URLSearchParams();

    const maxResults =
      normalizeMaxResults(
        options.maxResults
      );

    if (
      maxResults !== undefined
    ) {
      params.set(
        "maxResults",
        String(maxResults)
      );
    }

    if (options.pageToken) {
      params.set(
        "pageToken",
        options.pageToken
      );
    }

    if (options.query) {
      params.set(
        "q",
        options.query
      );
    }

    if (
      options.includeSpamTrash !==
      undefined
    ) {
      params.set(
        "includeSpamTrash",
        String(
          options.includeSpamTrash
        )
      );
    }

    for (
      const labelId of
        options.labelIds ?? []
    ) {
      params.append(
        "labelIds",
        labelId
      );
    }

    const query =
      params.toString();

    const data = await this.request<
      Record<string, unknown>
    >(
      `${this.getUserPath(
        "/threads"
      )}${query ? `?${query}` : ""}`
    );

    const threadReferences =
      Array.isArray(data.threads)
        ? data.threads
        : [];

    const threads =
      await Promise.all(
        threadReferences
          .filter(
            (
              item
            ): item is Record<
              string,
              unknown
            > =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof item.id === "string"
          )
          .map((item) =>
            this.getThread(
              item.id as string
            )
          )
      );

    return {
      threads,

      nextPageToken:
        typeof data.nextPageToken ===
        "string"
          ? data.nextPageToken
          : undefined,

      resultSizeEstimate:
        typeof data.resultSizeEstimate ===
        "number"
          ? data.resultSizeEstimate
          : undefined,
    };
  }

  /**
   * Get a complete Gmail thread.
   */
  async getThread(
    threadId: string
  ): Promise<GmailThread> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `${this.getUserPath(
        `/threads/${encodeURIComponent(
          ensureString(
            threadId,
            "Gmail thread ID"
          )
        )}`
      )}?format=full`
    );

    return mapGmailThread(data);
  }

  /**
   * Modify labels for an entire thread.
   */
  async modifyThread(
    threadId: string,
    input: GmailModifyThreadInput
  ): Promise<GmailThread> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/threads/${encodeURIComponent(
          ensureString(
            threadId,
            "Gmail thread ID"
          )
        )}/modify`
      ),
      {
        method: "POST",

        body: {
          addLabelIds:
            input.addLabelIds,
          removeLabelIds:
            input.removeLabelIds,
        },
      }
    );

    return mapGmailThread(data);
  }

  /**
   * Move thread to trash.
   */
  async trashThread(
    threadId: string
  ): Promise<GmailThread> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/threads/${encodeURIComponent(
          ensureString(
            threadId,
            "Gmail thread ID"
          )
        )}/trash`
      ),
      {
        method: "POST",
      }
    );

    return mapGmailThread(data);
  }

  /**
   * Restore thread from trash.
   */
  async untrashThread(
    threadId: string
  ): Promise<GmailThread> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/threads/${encodeURIComponent(
          ensureString(
            threadId,
            "Gmail thread ID"
          )
        )}/untrash`
      ),
      {
        method: "POST",
      }
    );

    return mapGmailThread(data);
  }

  /**
   * List Gmail labels.
   */
  async listLabels(): Promise<
    GmailLabel[]
  > {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath("/labels")
    );

    const labels =
      Array.isArray(data.labels)
        ? data.labels
        : [];

    return labels
      .filter(
        (
          item
        ): item is Record<
          string,
          unknown
        > =>
          Boolean(item) &&
          typeof item === "object"
      )
      .map(mapGmailLabel);
  }

  /**
   * Get Gmail label.
   */
  async getLabel(
    labelId: string
  ): Promise<GmailLabel> {
    const data = await this.request<
      Record<string, unknown>
    >(
      this.getUserPath(
        `/labels/${encodeURIComponent(
          ensureString(
            labelId,
            "Gmail label ID"
          )
        )}`
      )
    );

    return mapGmailLabel(data);
  }
}

/* -------------------------------------------------------------------------- */
/*                                 FACTORY                                    */
/* -------------------------------------------------------------------------- */

export function createGmailService(
  credentials: GmailCredentials
): GmailService {
  return new GmailService(
    credentials
  );
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default GmailService;