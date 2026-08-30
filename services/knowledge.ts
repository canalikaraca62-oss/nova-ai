/**
 * SYRAVEN Knowledge Service
 *
 * Enterprise-grade knowledge management layer.
 *
 * Features:
 * - Knowledge item management
 * - Collections
 * - Tags
 * - Search
 * - Filtering
 * - Pagination
 * - Status management
 * - Source tracking
 * - Metadata
 * - In-memory implementation
 * - Strict TypeScript support
 *
 * Production note:
 * This service is intentionally storage-agnostic.
 * The in-memory store can later be replaced with
 * Supabase/PostgreSQL/vector database infrastructure.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type KnowledgeStatus =
  | "draft"
  | "processing"
  | "ready"
  | "failed"
  | "archived"
  | "deleted";

export type KnowledgeSourceType =
  | "manual"
  | "document"
  | "url"
  | "file"
  | "api"
  | "integration"
  | "conversation"
  | "generated";

export type KnowledgeVisibility =
  | "private"
  | "workspace"
  | "organization"
  | "public";

export interface KnowledgeSource {
  type: KnowledgeSourceType;

  name?: string;

  url?: string;

  externalId?: string;

  fileId?: string;

  metadata?: Record<string, unknown>;
}

export interface KnowledgeItem {
  id: string;

  title: string;

  content: string;

  summary?: string;

  status: KnowledgeStatus;

  source: KnowledgeSource;

  visibility: KnowledgeVisibility;

  userId?: string;

  workspaceId?: string;

  collectionId?: string;

  tags: string[];

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface KnowledgeCollection {
  id: string;

  name: string;

  description?: string;

  userId?: string;

  workspaceId?: string;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeInput {
  title: string;

  content: string;

  summary?: string;

  status?: KnowledgeStatus;

  source?: KnowledgeSource;

  visibility?: KnowledgeVisibility;

  userId?: string;

  workspaceId?: string;

  collectionId?: string;

  tags?: string[];

  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeInput {
  title?: string;

  content?: string;

  summary?: string;

  status?: KnowledgeStatus;

  source?: KnowledgeSource;

  visibility?: KnowledgeVisibility;

  collectionId?: string;

  tags?: string[];

  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeCollectionInput {
  name: string;

  description?: string;

  userId?: string;

  workspaceId?: string;

  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeCollectionInput {
  name?: string;

  description?: string;

  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchOptions {
  query?: string;

  userId?: string;

  workspaceId?: string;

  collectionId?: string;

  status?: KnowledgeStatus;

  sourceType?: KnowledgeSourceType;

  visibility?: KnowledgeVisibility;

  tags?: string[];

  limit?: number;

  offset?: number;
}

export interface KnowledgeSearchResult {
  items: KnowledgeItem[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface KnowledgeCollectionListOptions {
  userId?: string;

  workspaceId?: string;

  limit?: number;

  offset?: number;
}

export interface KnowledgeCollectionListResult {
  collections: KnowledgeCollection[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class KnowledgeServiceError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "KnowledgeServiceError";
  }
}

export class KnowledgeNotFoundError
  extends KnowledgeServiceError {
  constructor(knowledgeId: string) {
    super(
      `Knowledge item not found: ${knowledgeId}`
    );

    this.name =
      "KnowledgeNotFoundError";
  }
}

export class KnowledgeCollectionNotFoundError
  extends KnowledgeServiceError {
  constructor(collectionId: string) {
    super(
      `Knowledge collection not found: ${collectionId}`
    );

    this.name =
      "KnowledgeCollectionNotFoundError";
  }
}

export class KnowledgeValidationError
  extends KnowledgeServiceError {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));

    this.name =
      "KnowledgeValidationError";

    this.errors = errors;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_KNOWLEDGE_LIMIT =
  50;

export const MAX_KNOWLEDGE_LIMIT =
  500;

export const DEFAULT_KNOWLEDGE_SOURCE: KnowledgeSource =
  {
    type: "manual",
  };

/* -------------------------------------------------------------------------- */
/*                              KNOWLEDGE SERVICE                             */
/* -------------------------------------------------------------------------- */

export class KnowledgeService {
  private readonly knowledge =
    new Map<
      string,
      KnowledgeItem
    >();

  private readonly collections =
    new Map<
      string,
      KnowledgeCollection
    >();

  /* ------------------------------------------------------------------------ */
  /*                               KNOWLEDGE CRUD                             */
  /* ------------------------------------------------------------------------ */

  create(
    input: CreateKnowledgeInput
  ): KnowledgeItem {
    this.assertValidCreateInput(
      input
    );

    if (
      input.collectionId &&
      !this.collections.has(
        input.collectionId
      )
    ) {
      throw new KnowledgeCollectionNotFoundError(
        input.collectionId
      );
    }

    const now =
      new Date();

    const item: KnowledgeItem = {
      id:
        this.generateId(
          "knowledge"
        ),

      title:
        this.normalizeTitle(
          input.title
        ),

      content:
        input.content.trim(),

      summary:
        this.normalizeOptionalText(
          input.summary
        ),

      status:
        input.status ??
        "ready",

      source:
        this.cloneSource(
          input.source ??
            DEFAULT_KNOWLEDGE_SOURCE
        ),

      visibility:
        input.visibility ??
        "private",

      userId:
        input.userId,

      workspaceId:
        input.workspaceId,

      collectionId:
        input.collectionId,

      tags:
        this.normalizeTags(
          input.tags
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

    this.knowledge.set(
      item.id,
      item
    );

    return this.cloneKnowledge(
      item
    );
  }

  get(
    knowledgeId: string
  ): KnowledgeItem | undefined {
    const item =
      this.knowledge.get(
        knowledgeId
      );

    if (!item) {
      return undefined;
    }

    return this.cloneKnowledge(
      item
    );
  }

  require(
    knowledgeId: string
  ): KnowledgeItem {
    const item =
      this.get(
        knowledgeId
      );

    if (!item) {
      throw new KnowledgeNotFoundError(
        knowledgeId
      );
    }

    return item;
  }

  update(
    knowledgeId: string,
    input: UpdateKnowledgeInput
  ): KnowledgeItem {
    const existing =
      this.require(
        knowledgeId
      );

    if (
      input.collectionId !==
        undefined &&
      input.collectionId &&
      !this.collections.has(
        input.collectionId
      )
    ) {
      throw new KnowledgeCollectionNotFoundError(
        input.collectionId
      );
    }

    if (
      input.title !== undefined &&
      !input.title.trim()
    ) {
      throw new KnowledgeValidationError([
        "Knowledge title cannot be empty.",
      ]);
    }

    if (
      input.content !== undefined &&
      !input.content.trim()
    ) {
      throw new KnowledgeValidationError([
        "Knowledge content cannot be empty.",
      ]);
    }

    const updated: KnowledgeItem = {
      ...existing,

      title:
        input.title !== undefined
          ? this.normalizeTitle(
              input.title
            )
          : existing.title,

      content:
        input.content !== undefined
          ? input.content.trim()
          : existing.content,

      summary:
        input.summary !== undefined
          ? this.normalizeOptionalText(
              input.summary
            )
          : existing.summary,

      status:
        input.status ??
        existing.status,

      source:
        input.source !== undefined
          ? this.cloneSource(
              input.source
            )
          : existing.source,

      visibility:
        input.visibility ??
        existing.visibility,

      collectionId:
        input.collectionId !==
        undefined
          ? input.collectionId
          : existing.collectionId,

      tags:
        input.tags !== undefined
          ? this.normalizeTags(
              input.tags
            )
          : existing.tags,

      metadata:
        input.metadata !== undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        new Date(),
    };

    this.knowledge.set(
      knowledgeId,
      updated
    );

    return this.cloneKnowledge(
      updated
    );
  }

  setStatus(
    knowledgeId: string,
    status: KnowledgeStatus
  ): KnowledgeItem {
    return this.update(
      knowledgeId,
      {
        status,
      }
    );
  }

  archive(
    knowledgeId: string
  ): KnowledgeItem {
    return this.setStatus(
      knowledgeId,
      "archived"
    );
  }

  restore(
    knowledgeId: string
  ): KnowledgeItem {
    return this.setStatus(
      knowledgeId,
      "ready"
    );
  }

  delete(
    knowledgeId: string,
    permanently = false
  ): void {
    this.require(
      knowledgeId
    );

    if (permanently) {
      this.knowledge.delete(
        knowledgeId
      );

      return;
    }

    this.setStatus(
      knowledgeId,
      "deleted"
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  SEARCH                                  */
  /* ------------------------------------------------------------------------ */

  search(
    options: KnowledgeSearchOptions = {}
  ): KnowledgeSearchResult {
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
        this.knowledge.values()
      );

    if (
      options.userId !==
      undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.userId ===
            options.userId
        );
    }

    if (
      options.workspaceId !==
      undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.workspaceId ===
            options.workspaceId
        );
    }

    if (
      options.collectionId !==
      undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.collectionId ===
            options.collectionId
        );
    }

    if (
      options.status !==
      undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.status ===
            options.status
        );
    }

    if (
      options.sourceType !==
      undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.source.type ===
            options.sourceType
        );
    }

    if (
      options.visibility !==
      undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.visibility ===
            options.visibility
        );
    }

    if (
      options.tags &&
      options.tags.length > 0
    ) {
      const requestedTags =
        this.normalizeTags(
          options.tags
        );

      items =
        items.filter(
          (item) =>
            requestedTags.every(
              (tag) =>
                item.tags.includes(
                  tag
                )
            )
        );
    }

    if (
      options.query &&
      options.query.trim()
    ) {
      const query =
        options.query
          .trim()
          .toLowerCase();

      items =
        items.filter(
          (item) =>
            this.matchesQuery(
              item,
              query
            )
        );
    }

    items =
      items.filter(
        (item) =>
          item.status !==
          "deleted"
      );

    items.sort(
      (a, b) =>
        b.updatedAt.getTime() -
        a.updatedAt.getTime()
    );

    const total =
      items.length;

    const paginated =
      items
        .slice(
          offset,
          offset + limit
        )
        .map(
          (item) =>
            this.cloneKnowledge(
              item
            )
        );

    return {
      items:
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

  getByCollection(
    collectionId: string,
    options: Omit<
      KnowledgeSearchOptions,
      "collectionId"
    > = {}
  ): KnowledgeSearchResult {
    return this.search({
      ...options,
      collectionId,
    });
  }

  getByUser(
    userId: string,
    options: Omit<
      KnowledgeSearchOptions,
      "userId"
    > = {}
  ): KnowledgeSearchResult {
    return this.search({
      ...options,
      userId,
    });
  }

  getByWorkspace(
    workspaceId: string,
    options: Omit<
      KnowledgeSearchOptions,
      "workspaceId"
    > = {}
  ): KnowledgeSearchResult {
    return this.search({
      ...options,
      workspaceId,
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                                COLLECTIONS                               */
  /* ------------------------------------------------------------------------ */

  createCollection(
    input: CreateKnowledgeCollectionInput
  ): KnowledgeCollection {
    const name =
      input.name.trim();

    if (!name) {
      throw new KnowledgeValidationError([
        "Collection name is required.",
      ]);
    }

    const now =
      new Date();

    const collection: KnowledgeCollection =
      {
        id:
          this.generateId(
            "collection"
          ),

        name,

        description:
          this.normalizeOptionalText(
            input.description
          ),

        userId:
          input.userId,

        workspaceId:
          input.workspaceId,

        createdAt:
          now,

        updatedAt:
          now,

        metadata:
          this.cloneMetadata(
            input.metadata
          ),
      };

    this.collections.set(
      collection.id,
      collection
    );

    return this.cloneCollection(
      collection
    );
  }

  getCollection(
    collectionId: string
  ): KnowledgeCollection | undefined {
    const collection =
      this.collections.get(
        collectionId
      );

    if (!collection) {
      return undefined;
    }

    return this.cloneCollection(
      collection
    );
  }

  requireCollection(
    collectionId: string
  ): KnowledgeCollection {
    const collection =
      this.getCollection(
        collectionId
      );

    if (!collection) {
      throw new KnowledgeCollectionNotFoundError(
        collectionId
      );
    }

    return collection;
  }

  updateCollection(
    collectionId: string,
    input: UpdateKnowledgeCollectionInput
  ): KnowledgeCollection {
    const existing =
      this.requireCollection(
        collectionId
      );

    if (
      input.name !== undefined &&
      !input.name.trim()
    ) {
      throw new KnowledgeValidationError([
        "Collection name cannot be empty.",
      ]);
    }

    const updated: KnowledgeCollection =
      {
        ...existing,

        name:
          input.name !== undefined
            ? input.name.trim()
            : existing.name,

        description:
          input.description !==
          undefined
            ? this.normalizeOptionalText(
                input.description
              )
            : existing.description,

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

    this.collections.set(
      collectionId,
      updated
    );

    return this.cloneCollection(
      updated
    );
  }

  listCollections(
    options: KnowledgeCollectionListOptions = {}
  ): KnowledgeCollectionListResult {
    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    let collections =
      Array.from(
        this.collections.values()
      );

    if (
      options.userId !==
      undefined
    ) {
      collections =
        collections.filter(
          (collection) =>
            collection.userId ===
            options.userId
        );
    }

    if (
      options.workspaceId !==
      undefined
    ) {
      collections =
        collections.filter(
          (collection) =>
            collection.workspaceId ===
            options.workspaceId
        );
    }

    collections.sort(
      (a, b) =>
        b.updatedAt.getTime() -
        a.updatedAt.getTime()
    );

    const total =
      collections.length;

    const paginated =
      collections
        .slice(
          offset,
          offset + limit
        )
        .map(
          (collection) =>
            this.cloneCollection(
              collection
            )
        );

    return {
      collections:
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

  deleteCollection(
    collectionId: string,
    permanently = false
  ): void {
    this.requireCollection(
      collectionId
    );

    const relatedKnowledge =
      Array.from(
        this.knowledge.values()
      ).filter(
        (item) =>
          item.collectionId ===
          collectionId
      );

    if (!permanently) {
      for (
        const item of
        relatedKnowledge
      ) {
        this.update(
          item.id,
          {
            collectionId:
              undefined,
          }
        );
      }
    } else {
      for (
        const item of
        relatedKnowledge
      ) {
        this.knowledge.delete(
          item.id
        );
      }
    }

    this.collections.delete(
      collectionId
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                 STATS                                    */
  /* ------------------------------------------------------------------------ */

  count(
    options: Omit<
      KnowledgeSearchOptions,
      "limit" | "offset"
    > = {}
  ): number {
    return this.search({
      ...options,
      limit:
        MAX_KNOWLEDGE_LIMIT,
      offset: 0,
    }).total;
  }

  getTags(
    userId?: string
  ): string[] {
    let items =
      Array.from(
        this.knowledge.values()
      );

    if (
      userId !== undefined
    ) {
      items =
        items.filter(
          (item) =>
            item.userId ===
            userId
        );
    }

    const tags =
      new Set<string>();

    for (
      const item of
      items
    ) {
      for (
        const tag of
        item.tags
      ) {
        tags.add(tag);
      }
    }

    return Array.from(
      tags
    ).sort();
  }

  /* ------------------------------------------------------------------------ */
  /*                                 ADMIN                                    */
  /* ------------------------------------------------------------------------ */

  clearKnowledge(): void {
    this.knowledge.clear();
  }

  clearCollections(): void {
    this.collections.clear();
  }

  clear(): void {
    this.clearKnowledge();

    this.clearCollections();
  }

  /* ------------------------------------------------------------------------ */
  /*                             PRIVATE HELPERS                              */
  /* ------------------------------------------------------------------------ */

  private assertValidCreateInput(
    input: CreateKnowledgeInput
  ): void {
    const errors: string[] =
      [];

    if (
      !input.title ||
      !input.title.trim()
    ) {
      errors.push(
        "Knowledge title is required."
      );
    }

    if (
      !input.content ||
      !input.content.trim()
    ) {
      errors.push(
        "Knowledge content is required."
      );
    }

    if (errors.length > 0) {
      throw new KnowledgeValidationError(
        errors
      );
    }
  }

  private normalizeTitle(
    value: string
  ): string {
    return value
      .trim()
      .replace(
        /\s+/g,
        " "
      )
      .slice(
        0,
        500
      );
  }

  private normalizeOptionalText(
    value?: string
  ): string | undefined {
    if (
      value === undefined ||
      value === null
    ) {
      return undefined;
    }

    const normalized =
      value.trim();

    return normalized ||
      undefined;
  }

  private normalizeTags(
    tags?: string[]
  ): string[] {
    if (!tags) {
      return [];
    }

    const normalized =
      tags
        .map(
          (tag) =>
            tag
              .trim()
              .toLowerCase()
        )
        .filter(
          Boolean
        );

    return Array.from(
      new Set(
        normalized
      )
    );
  }

  private matchesQuery(
    item: KnowledgeItem,
    query: string
  ): boolean {
    const searchableValues =
      [
        item.title,
        item.content,
        item.summary ?? "",
        item.source.name ?? "",
        item.source.url ?? "",
        ...item.tags,
      ];

    return searchableValues.some(
      (value) =>
        value
          .toLowerCase()
          .includes(query)
    );
  }

  private normalizeLimit(
    limit?: number
  ): number {
    if (
      limit === undefined ||
      !Number.isFinite(limit)
    ) {
      return DEFAULT_KNOWLEDGE_LIMIT;
    }

    return Math.max(
      1,
      Math.min(
        Math.floor(limit),
        MAX_KNOWLEDGE_LIMIT
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

  private cloneSource(
    source: KnowledgeSource
  ): KnowledgeSource {
    return {
      ...source,

      metadata:
        this.cloneMetadata(
          source.metadata
        ),
    };
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

  private cloneKnowledge(
    item: KnowledgeItem
  ): KnowledgeItem {
    return {
      ...item,

      source:
        this.cloneSource(
          item.source
        ),

      tags:
        [...item.tags],

      createdAt:
        new Date(
          item.createdAt
        ),

      updatedAt:
        new Date(
          item.updatedAt
        ),

      metadata:
        this.cloneMetadata(
          item.metadata
        ),
    };
  }

  private cloneCollection(
    collection: KnowledgeCollection
  ): KnowledgeCollection {
    return {
      ...collection,

      createdAt:
        new Date(
          collection.createdAt
        ),

      updatedAt:
        new Date(
          collection.updatedAt
        ),

      metadata:
        this.cloneMetadata(
          collection.metadata
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
        .slice(
          2,
          14
        );

    return `${prefix}_${timestamp}_${random}`;
  }
}

/* -------------------------------------------------------------------------- */
/*                               SINGLETON                                    */
/* -------------------------------------------------------------------------- */

export const knowledgeService =
  new KnowledgeService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function createKnowledge(
  input: CreateKnowledgeInput
): KnowledgeItem {
  return knowledgeService.create(
    input
  );
}

export function getKnowledge(
  knowledgeId: string
): KnowledgeItem | undefined {
  return knowledgeService.get(
    knowledgeId
  );
}

export function requireKnowledge(
  knowledgeId: string
): KnowledgeItem {
  return knowledgeService.require(
    knowledgeId
  );
}

export function updateKnowledge(
  knowledgeId: string,
  input: UpdateKnowledgeInput
): KnowledgeItem {
  return knowledgeService.update(
    knowledgeId,
    input
  );
}

export function deleteKnowledge(
  knowledgeId: string,
  permanently = false
): void {
  knowledgeService.delete(
    knowledgeId,
    permanently
  );
}

export function searchKnowledge(
  options: KnowledgeSearchOptions = {}
): KnowledgeSearchResult {
  return knowledgeService.search(
    options
  );
}

export function createKnowledgeCollection(
  input: CreateKnowledgeCollectionInput
): KnowledgeCollection {
  return knowledgeService.createCollection(
    input
  );
}

export function getKnowledgeCollection(
  collectionId: string
): KnowledgeCollection | undefined {
  return knowledgeService.getCollection(
    collectionId
  );
}

export function updateKnowledgeCollection(
  collectionId: string,
  input: UpdateKnowledgeCollectionInput
): KnowledgeCollection {
  return knowledgeService.updateCollection(
    collectionId,
    input
  );
}

export function deleteKnowledgeCollection(
  collectionId: string,
  permanently = false
): void {
  knowledgeService.deleteCollection(
    collectionId,
    permanently
  );
}

export function listKnowledgeCollections(
  options: KnowledgeCollectionListOptions = {}
): KnowledgeCollectionListResult {
  return knowledgeService.listCollections(
    options
  );
}

export function getKnowledgeTags(
  userId?: string
): string[] {
  return knowledgeService.getTags(
    userId
  );
}

export default knowledgeService;