/**
 * SYRAVEN Notion Integration Service
 *
 * Production-oriented Notion API abstraction.
 *
 * Capabilities:
 * - Get current bot/user
 * - Search pages and databases
 * - Get pages
 * - Create pages
 * - Update pages
 * - Archive pages
 * - Get page blocks
 * - Append blocks
 * - Retrieve databases/data sources
 * - Query databases/data sources
 *
 * Uses the official Notion REST API directly via fetch.
 */

export interface NotionCredentials {
  accessToken: string;
  apiBaseUrl?: string;
  apiVersion?: string;
}

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type NotionObjectType =
  | "page"
  | "database"
  | "data_source"
  | "block"
  | "user"
  | "comment";

export interface NotionUser {
  id: string;
  object: "user";
  type?: "person" | "bot";
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

export interface NotionParent {
  type: string;
  pageId?: string;
  databaseId?: string;
  dataSourceId?: string;
  workspace?: boolean;
}

export interface NotionRichText {
  type?: string;
  plainText: string;
  href?: string | null;
  annotations?: Record<string, unknown>;
}

export interface NotionPage {
  id: string;
  object: "page";
  createdTime?: string;
  lastEditedTime?: string;
  archived?: boolean;
  inTrash?: boolean;
  url?: string;
  parent?: NotionParent;
  properties: Record<string, unknown>;
  cover?: unknown;
  icon?: unknown;
}

export interface NotionDatabase {
  id: string;
  object: "database";
  title: string;
  description?: string;
  url?: string;
  archived?: boolean;
  inTrash?: boolean;
  createdTime?: string;
  lastEditedTime?: string;
  parent?: NotionParent;
  properties: Record<string, unknown>;
}

export interface NotionDataSource {
  id: string;
  object: "data_source";
  name?: string;
  url?: string;
  archived?: boolean;
  inTrash?: boolean;
  parent?: NotionParent;
  properties: Record<string, unknown>;
}

export interface NotionBlock {
  id: string;
  object: "block";
  type: string;
  hasChildren?: boolean;
  archived?: boolean;
  inTrash?: boolean;
  createdTime?: string;
  lastEditedTime?: string;
  parent?: NotionParent;
  content?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface NotionSearchOptions {
  query?: string;
  filter?: {
    property: "object";
    value: "page" | "database";
  };
  sort?: {
    direction: "ascending" | "descending";
    timestamp: "last_edited_time";
  };
  pageSize?: number;
  startCursor?: string;
}

export interface NotionSearchResult {
  results: Array<NotionPage | NotionDatabase>;
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface NotionBlockChildrenResult {
  results: NotionBlock[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface CreateNotionPageInput {
  parent:
    | {
        pageId: string;
      }
    | {
        databaseId: string;
      }
    | {
        dataSourceId: string;
      };

  properties: Record<string, unknown>;

  children?: Array<Record<string, unknown>>;

  icon?: unknown;
  cover?: unknown;
}

export interface UpdateNotionPageInput {
  properties?: Record<string, unknown>;
  archived?: boolean;
  inTrash?: boolean;
  icon?: unknown;
  cover?: unknown;
}

export interface AppendNotionBlocksInput {
  children: Array<Record<string, unknown>>;
  after?: string;
}

export interface QueryNotionDatabaseInput {
  filter?: Record<string, unknown>;
  sorts?: Array<Record<string, unknown>>;
  pageSize?: number;
  startCursor?: string;
}

export interface QueryNotionDatabaseResult {
  results: NotionPage[];
  nextCursor?: string | null;
  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                  ERROR                                     */
/* -------------------------------------------------------------------------- */

export class NotionIntegrationError extends Error {
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

    this.name = "NotionIntegrationError";
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_API_BASE_URL = "https://api.notion.com";

const DEFAULT_API_VERSION = "2022-06-28";

const MAX_PAGE_SIZE = 100;

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
    throw new NotionIntegrationError(
      `${fieldName} is required.`,
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return normalized;
}

function normalizePageSize(
  value?: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new NotionIntegrationError(
      "Page size must be a positive number.",
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return Math.min(
    Math.floor(value),
    MAX_PAGE_SIZE
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAPPERS                                     */
/* -------------------------------------------------------------------------- */

function mapParent(
  value: unknown
): NotionParent | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const parent =
    value as Record<string, unknown>;

  return {
    type: String(parent.type ?? ""),
    pageId:
      typeof parent.page_id === "string"
        ? parent.page_id
        : undefined,
    databaseId:
      typeof parent.database_id === "string"
        ? parent.database_id
        : undefined,
    dataSourceId:
      typeof parent.data_source_id === "string"
        ? parent.data_source_id
        : undefined,
    workspace:
      typeof parent.workspace === "boolean"
        ? parent.workspace
        : undefined,
  };
}

function extractRichText(
  value: unknown
): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (
        item &&
        typeof item === "object"
      ) {
        const record =
          item as Record<string, unknown>;

        if (
          typeof record.plain_text ===
          "string"
        ) {
          return record.plain_text;
        }
      }

      return "";
    })
    .filter(Boolean)
    .join("");
}

function mapNotionUser(
  data: Record<string, unknown>
): NotionUser {
  const person =
    data.person &&
    typeof data.person === "object"
      ? (data.person as Record<string, unknown>)
      : {};

  return {
    id: String(data.id ?? ""),
    object: "user",
    type:
      data.type === "person"
        ? "person"
        : data.type === "bot"
          ? "bot"
          : undefined,
    name:
      typeof data.name === "string"
        ? data.name
        : null,
    avatarUrl:
      typeof data.avatar_url === "string"
        ? data.avatar_url
        : null,
    email:
      typeof person.email === "string"
        ? person.email
        : null,
  };
}

function mapNotionPage(
  data: Record<string, unknown>
): NotionPage {
  return {
    id: String(data.id ?? ""),
    object: "page",
    createdTime:
      typeof data.created_time === "string"
        ? data.created_time
        : undefined,
    lastEditedTime:
      typeof data.last_edited_time ===
      "string"
        ? data.last_edited_time
        : undefined,
    archived:
      typeof data.archived === "boolean"
        ? data.archived
        : undefined,
    inTrash:
      typeof data.in_trash === "boolean"
        ? data.in_trash
        : undefined,
    url:
      typeof data.url === "string"
        ? data.url
        : undefined,
    parent: mapParent(data.parent),
    properties:
      data.properties &&
      typeof data.properties === "object"
        ? (data.properties as Record<
            string,
            unknown
          >)
        : {},
    cover: data.cover,
    icon: data.icon,
  };
}

function mapNotionDatabase(
  data: Record<string, unknown>
): NotionDatabase {
  return {
    id: String(data.id ?? ""),
    object: "database",
    title: extractRichText(data.title),
    description: extractRichText(
      data.description
    ),
    url:
      typeof data.url === "string"
        ? data.url
        : undefined,
    archived:
      typeof data.archived === "boolean"
        ? data.archived
        : undefined,
    inTrash:
      typeof data.in_trash === "boolean"
        ? data.in_trash
        : undefined,
    createdTime:
      typeof data.created_time === "string"
        ? data.created_time
        : undefined,
    lastEditedTime:
      typeof data.last_edited_time ===
      "string"
        ? data.last_edited_time
        : undefined,
    parent: mapParent(data.parent),
    properties:
      data.properties &&
      typeof data.properties === "object"
        ? (data.properties as Record<
            string,
            unknown
          >)
        : {},
  };
}

function mapNotionDataSource(
  data: Record<string, unknown>
): NotionDataSource {
  return {
    id: String(data.id ?? ""),
    object: "data_source",
    name:
      typeof data.name === "string"
        ? data.name
        : undefined,
    url:
      typeof data.url === "string"
        ? data.url
        : undefined,
    archived:
      typeof data.archived === "boolean"
        ? data.archived
        : undefined,
    inTrash:
      typeof data.in_trash === "boolean"
        ? data.in_trash
        : undefined,
    parent: mapParent(data.parent),
    properties:
      data.properties &&
      typeof data.properties === "object"
        ? (data.properties as Record<
            string,
            unknown
          >)
        : {},
  };
}

function mapNotionBlock(
  data: Record<string, unknown>
): NotionBlock {
  const type =
    typeof data.type === "string"
      ? data.type
      : "unknown";

  const content =
    data[type] &&
    typeof data[type] === "object"
      ? (data[type] as Record<
          string,
          unknown
        >)
      : undefined;

  return {
    id: String(data.id ?? ""),
    object: "block",
    type,
    hasChildren:
      typeof data.has_children === "boolean"
        ? data.has_children
        : undefined,
    archived:
      typeof data.archived === "boolean"
        ? data.archived
        : undefined,
    inTrash:
      typeof data.in_trash === "boolean"
        ? data.in_trash
        : undefined,
    createdTime:
      typeof data.created_time === "string"
        ? data.created_time
        : undefined,
    lastEditedTime:
      typeof data.last_edited_time ===
      "string"
        ? data.last_edited_time
        : undefined,
    parent: mapParent(data.parent),
    content,
    raw: data,
  };
}

/* -------------------------------------------------------------------------- */
/*                              NOTION SERVICE                                */
/* -------------------------------------------------------------------------- */

export class NotionService {
  private readonly accessToken: string;

  private readonly apiBaseUrl: string;

  private readonly apiVersion: string;

  constructor(
    credentials: NotionCredentials
  ) {
    this.accessToken = ensureString(
      credentials.accessToken,
      "Notion access token"
    );

    this.apiBaseUrl = (
      credentials.apiBaseUrl ||
      DEFAULT_API_BASE_URL
    ).replace(/\/+$/, "");

    this.apiVersion =
      credentials.apiVersion ||
      DEFAULT_API_VERSION;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const response = await fetch(
      `${this.apiBaseUrl}${path}`,
      {
        method: options.method ?? "GET",

        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Notion-Version": this.apiVersion,
          Accept: "application/json",
          ...(options.body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),
        },

        body:
          options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
      }
    ).catch((error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown network error.";

      throw new NotionIntegrationError(
        `Notion request failed: ${message}`,
        {
          code: "NOTION_REQUEST_FAILED",
          cause: error,
        }
      );
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType =
      response.headers.get("content-type") ??
      "";

    let payload: unknown;

    try {
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

      const message =
        typeof errorPayload.message === "string"
          ? errorPayload.message
          : `Notion API request failed with status ${response.status}.`;

      throw new NotionIntegrationError(
        message,
        {
          status: response.status,
          code:
            typeof errorPayload.code === "string"
              ? errorPayload.code
              : "NOTION_API_ERROR",
          cause: payload,
        }
      );
    }

    return payload as T;
  }

  /**
   * Get the authenticated integration user.
   */
  async getAuthenticatedUser(): Promise<NotionUser> {
    const data = await this.request<
      Record<string, unknown>
    >("/v1/users/me");

    return mapNotionUser(data);
  }

  /**
   * Get a user by ID.
   */
  async getUser(
    userId: string
  ): Promise<NotionUser> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/users/${encodeURIComponent(
        ensureString(userId, "Notion user ID")
      )}`
    );

    return mapNotionUser(data);
  }

  /**
   * Search pages and databases.
   */
  async search(
    options: NotionSearchOptions = {}
  ): Promise<NotionSearchResult> {
    const pageSize = normalizePageSize(
      options.pageSize
    );

    const data = await this.request<
      Record<string, unknown>
    >("/v1/search", {
      method: "POST",
      body: {
        query: options.query,
        filter: options.filter,
        sort: options.sort,
        page_size: pageSize,
        start_cursor:
          options.startCursor,
      },
    });

    const rawResults = Array.isArray(
      data.results
    )
      ? data.results
      : [];

    const results = rawResults
      .filter(
        (
          value
        ): value is Record<string, unknown> =>
          Boolean(value) &&
          typeof value === "object"
      )
      .map((item) => {
        if (item.object === "database") {
          return mapNotionDatabase(item);
        }

        return mapNotionPage(item);
      });

    return {
      results,
      nextCursor:
        typeof data.next_cursor === "string"
          ? data.next_cursor
          : null,
      hasMore: Boolean(data.has_more),
    };
  }

  /**
   * Get a page.
   */
  async getPage(
    pageId: string
  ): Promise<NotionPage> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/pages/${encodeURIComponent(
        ensureString(pageId, "Notion page ID")
      )}`
    );

    return mapNotionPage(data);
  }

  /**
   * Create a page.
   */
  async createPage(
    input: CreateNotionPageInput
  ): Promise<NotionPage> {
    if (
      !input ||
      !input.parent ||
      !input.properties
    ) {
      throw new NotionIntegrationError(
        "Page parent and properties are required.",
        {
          code: "VALIDATION_ERROR",
        }
      );
    }

    const parent: Record<string, string> = {};

    if ("pageId" in input.parent) {
      parent.page_id = ensureString(
        input.parent.pageId,
        "Parent page ID"
      );
    } else if ("databaseId" in input.parent) {
      parent.database_id = ensureString(
        input.parent.databaseId,
        "Parent database ID"
      );
    } else if ("dataSourceId" in input.parent) {
      parent.data_source_id = ensureString(
        input.parent.dataSourceId,
        "Parent data source ID"
      );
    } else {
      throw new NotionIntegrationError(
        "A valid page parent is required.",
        {
          code: "VALIDATION_ERROR",
        }
      );
    }

    const data = await this.request<
      Record<string, unknown>
    >("/v1/pages", {
      method: "POST",
      body: {
        parent,
        properties: input.properties,
        children: input.children,
        icon: input.icon,
        cover: input.cover,
      },
    });

    return mapNotionPage(data);
  }

  /**
   * Update a page.
   */
  async updatePage(
    pageId: string,
    input: UpdateNotionPageInput
  ): Promise<NotionPage> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/pages/${encodeURIComponent(
        ensureString(pageId, "Notion page ID")
      )}`,
      {
        method: "PATCH",
        body: {
          properties: input.properties,
          archived: input.archived,
          in_trash: input.inTrash,
          icon: input.icon,
          cover: input.cover,
        },
      }
    );

    return mapNotionPage(data);
  }

  /**
   * Archive a page.
   */
  async archivePage(
    pageId: string
  ): Promise<NotionPage> {
    return this.updatePage(pageId, {
      archived: true,
    });
  }

  /**
   * Restore an archived page.
   */
  async restorePage(
    pageId: string
  ): Promise<NotionPage> {
    return this.updatePage(pageId, {
      archived: false,
    });
  }

  /**
   * Get block children.
   */
  async getBlockChildren(
    blockId: string,
    options: {
      pageSize?: number;
      startCursor?: string;
    } = {}
  ): Promise<NotionBlockChildrenResult> {
    const params = new URLSearchParams();

    const pageSize = normalizePageSize(
      options.pageSize
    );

    if (pageSize !== undefined) {
      params.set(
        "page_size",
        String(pageSize)
      );
    }

    if (options.startCursor) {
      params.set(
        "start_cursor",
        options.startCursor
      );
    }

    const query = params.toString();

    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/blocks/${encodeURIComponent(
        ensureString(blockId, "Notion block ID")
      )}/children${query ? `?${query}` : ""}`
    );

    const rawResults = Array.isArray(
      data.results
    )
      ? data.results
      : [];

    return {
      results: rawResults
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapNotionBlock),

      nextCursor:
        typeof data.next_cursor === "string"
          ? data.next_cursor
          : null,

      hasMore: Boolean(data.has_more),
    };
  }

  /**
   * Append children to a block/page.
   */
  async appendBlocks(
    blockId: string,
    input: AppendNotionBlocksInput
  ): Promise<NotionBlockChildrenResult> {
    if (
      !Array.isArray(input.children) ||
      input.children.length === 0
    ) {
      throw new NotionIntegrationError(
        "At least one child block is required.",
        {
          code: "VALIDATION_ERROR",
        }
      );
    }

    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/blocks/${encodeURIComponent(
        ensureString(blockId, "Notion block ID")
      )}/children`,
      {
        method: "PATCH",
        body: {
          children: input.children,
          after: input.after,
        },
      }
    );

    const rawResults = Array.isArray(
      data.results
    )
      ? data.results
      : [];

    return {
      results: rawResults
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapNotionBlock),

      nextCursor:
        typeof data.next_cursor === "string"
          ? data.next_cursor
          : null,

      hasMore: Boolean(data.has_more),
    };
  }

  /**
   * Get a database.
   */
  async getDatabase(
    databaseId: string
  ): Promise<NotionDatabase> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/databases/${encodeURIComponent(
        ensureString(
          databaseId,
          "Notion database ID"
        )
      )}`
    );

    return mapNotionDatabase(data);
  }

  /**
   * Get a data source.
   */
  async getDataSource(
    dataSourceId: string
  ): Promise<NotionDataSource> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/data_sources/${encodeURIComponent(
        ensureString(
          dataSourceId,
          "Notion data source ID"
        )
      )}`
    );

    return mapNotionDataSource(data);
  }

  /**
   * Query a data source.
   *
   * Modern Notion API database querying is performed
   * through data sources.
   */
  async queryDataSource(
    dataSourceId: string,
    input: QueryNotionDatabaseInput = {}
  ): Promise<QueryNotionDatabaseResult> {
    const pageSize = normalizePageSize(
      input.pageSize
    );

    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/data_sources/${encodeURIComponent(
        ensureString(
          dataSourceId,
          "Notion data source ID"
        )
      )}/query`,
      {
        method: "POST",
        body: {
          filter: input.filter,
          sorts: input.sorts,
          page_size: pageSize,
          start_cursor: input.startCursor,
        },
      }
    );

    const rawResults = Array.isArray(
      data.results
    )
      ? data.results
      : [];

    return {
      results: rawResults
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapNotionPage),

      nextCursor:
        typeof data.next_cursor === "string"
          ? data.next_cursor
          : null,

      hasMore: Boolean(data.has_more),
    };
  }

  /**
   * Backward-compatible database query helper.
   *
   * Uses the legacy database query endpoint.
   */
  async queryDatabase(
    databaseId: string,
    input: QueryNotionDatabaseInput = {}
  ): Promise<QueryNotionDatabaseResult> {
    const pageSize = normalizePageSize(
      input.pageSize
    );

    const data = await this.request<
      Record<string, unknown>
    >(
      `/v1/databases/${encodeURIComponent(
        ensureString(
          databaseId,
          "Notion database ID"
        )
      )}/query`,
      {
        method: "POST",
        body: {
          filter: input.filter,
          sorts: input.sorts,
          page_size: pageSize,
          start_cursor: input.startCursor,
        },
      }
    );

    const rawResults = Array.isArray(
      data.results
    )
      ? data.results
      : [];

    return {
      results: rawResults
        .filter(
          (
            value
          ): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object"
        )
        .map(mapNotionPage),

      nextCursor:
        typeof data.next_cursor === "string"
          ? data.next_cursor
          : null,

      hasMore: Boolean(data.has_more),
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                                 FACTORY                                    */
/* -------------------------------------------------------------------------- */

export function createNotionService(
  credentials: NotionCredentials
): NotionService {
  return new NotionService(credentials);
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default NotionService;