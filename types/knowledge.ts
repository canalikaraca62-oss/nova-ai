/**
 * SYRAVEN Knowledge Types
 *
 * Enterprise-grade knowledge domain contracts.
 *
 * Shared by:
 * - Knowledge Service
 * - Search Service
 * - File Service
 * - Document Reader
 * - AI / Agents
 * - Projects
 * - Chat
 * - API Routes
 */

/* -------------------------------------------------------------------------- */
/*                                PRIMITIVES                                  */
/* -------------------------------------------------------------------------- */

export type KnowledgeId = string;

export type KnowledgeSourceId = string;

export type KnowledgeChunkId = string;

export type KnowledgeCollectionId = string;

export type KnowledgeEmbeddingId = string;

/* -------------------------------------------------------------------------- */
/*                              KNOWLEDGE TYPES                               */
/* -------------------------------------------------------------------------- */

export type KnowledgeType =
  | "document"
  | "note"
  | "web"
  | "conversation"
  | "file"
  | "database"
  | "integration"
  | "manual"
  | "generated"
  | "other";

/* -------------------------------------------------------------------------- */
/*                             KNOWLEDGE STATUS                               */
/* -------------------------------------------------------------------------- */

export type KnowledgeStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "archived"
  | "deleted";

/* -------------------------------------------------------------------------- */
/*                              SOURCE TYPES                                  */
/* -------------------------------------------------------------------------- */

export type KnowledgeSourceType =
  | "file"
  | "url"
  | "text"
  | "message"
  | "integration"
  | "database"
  | "manual"
  | "generated";

/* -------------------------------------------------------------------------- */
/*                            COLLECTION VISIBILITY                           */
/* -------------------------------------------------------------------------- */

export type KnowledgeVisibility =
  | "private"
  | "workspace"
  | "project"
  | "public";

/* -------------------------------------------------------------------------- */
/*                             EMBEDDING STATUS                               */
/* -------------------------------------------------------------------------- */

export type EmbeddingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/* -------------------------------------------------------------------------- */
/*                             KNOWLEDGE METADATA                             */
/* -------------------------------------------------------------------------- */

export interface KnowledgeMetadata {
  title?: string;

  description?: string;

  author?: string;

  language?: string;

  tags?: string[];

  keywords?: string[];

  sourceUrl?: string;

  mimeType?: string;

  wordCount?: number;

  characterCount?: number;

  pageCount?: number;

  custom?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE SOURCE                                */
/* -------------------------------------------------------------------------- */

export interface KnowledgeSource {
  id: KnowledgeSourceId;

  type: KnowledgeSourceType;

  name?: string;

  url?: string;

  fileId?: string;

  externalId?: string;

  provider?: string;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE CHUNK                                 */
/* -------------------------------------------------------------------------- */

export interface KnowledgeChunk {
  id: KnowledgeChunkId;

  knowledgeId: KnowledgeId;

  index: number;

  content: string;

  tokenCount?: number;

  characterCount: number;

  startOffset?: number;

  endOffset?: number;

  embeddingId?: KnowledgeEmbeddingId;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE EMBEDDING                             */
/* -------------------------------------------------------------------------- */

export interface KnowledgeEmbedding {
  id: KnowledgeEmbeddingId;

  knowledgeId: KnowledgeId;

  chunkId?: KnowledgeChunkId;

  model: string;

  dimensions: number;

  vector?: number[];

  status: EmbeddingStatus;

  provider?: string;

  createdAt: Date;

  updatedAt: Date;

  error?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              KNOWLEDGE RECORD                              */
/* -------------------------------------------------------------------------- */

export interface KnowledgeRecord {
  id: KnowledgeId;

  type: KnowledgeType;

  status: KnowledgeStatus;

  title: string;

  content?: string;

  summary?: string;

  visibility: KnowledgeVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  source?: KnowledgeSource;

  metadata?: KnowledgeMetadata;

  chunks?: KnowledgeChunk[];

  embeddingStatus?: EmbeddingStatus;

  tags?: string[];

  createdAt: Date;

  updatedAt: Date;

  processedAt?: Date;

  archivedAt?: Date;

  deletedAt?: Date;
}

/**
 * Backward-compatible alias.
 */
export type Knowledge = KnowledgeRecord;

/* -------------------------------------------------------------------------- */
/*                           KNOWLEDGE COLLECTION                             */
/* -------------------------------------------------------------------------- */

export interface KnowledgeCollection {
  id: KnowledgeCollectionId;

  name: string;

  description?: string;

  visibility: KnowledgeVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE SUMMARY                               */
/* -------------------------------------------------------------------------- */

export interface KnowledgeSummary {
  id: KnowledgeId;

  type: KnowledgeType;

  status: KnowledgeStatus;

  title: string;

  summary?: string;

  visibility: KnowledgeVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  tags?: string[];

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                            CREATE KNOWLEDGE                                */
/* -------------------------------------------------------------------------- */

export interface CreateKnowledgeInput {
  type?: KnowledgeType;

  title: string;

  content?: string;

  summary?: string;

  visibility?: KnowledgeVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  source?: Omit<
    KnowledgeSource,
    "id" | "createdAt" | "updatedAt"
  >;

  metadata?: KnowledgeMetadata;

  tags?: string[];
}

/* -------------------------------------------------------------------------- */
/*                            UPDATE KNOWLEDGE                                */
/* -------------------------------------------------------------------------- */

export interface UpdateKnowledgeInput {
  type?: KnowledgeType;

  status?: KnowledgeStatus;

  title?: string;

  content?: string;

  summary?: string;

  visibility?: KnowledgeVisibility;

  collectionId?: KnowledgeCollectionId;

  metadata?: KnowledgeMetadata;

  tags?: string[];
}

/* -------------------------------------------------------------------------- */
/*                          CREATE COLLECTION                                 */
/* -------------------------------------------------------------------------- */

export interface CreateKnowledgeCollectionInput {
  name: string;

  description?: string;

  visibility?: KnowledgeVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                          UPDATE COLLECTION                                 */
/* -------------------------------------------------------------------------- */

export interface UpdateKnowledgeCollectionInput {
  name?: string;

  description?: string;

  visibility?: KnowledgeVisibility;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                           KNOWLEDGE IMPORT                                 */
/* -------------------------------------------------------------------------- */

export interface ImportKnowledgeInput {
  source: KnowledgeSource;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  visibility?: KnowledgeVisibility;

  metadata?: KnowledgeMetadata;

  tags?: string[];
}

export interface KnowledgeImportResult {
  knowledge: KnowledgeRecord;

  imported: boolean;

  source: KnowledgeSource;
}

/* -------------------------------------------------------------------------- */
/*                           KNOWLEDGE PROCESSING                             */
/* -------------------------------------------------------------------------- */

export interface KnowledgeProcessingOptions {
  extractText?: boolean;

  chunk?: boolean;

  chunkSize?: number;

  chunkOverlap?: number;

  generateEmbeddings?: boolean;

  generateSummary?: boolean;

  detectLanguage?: boolean;

  extractMetadata?: boolean;
}

export interface KnowledgeProcessingResult {
  knowledgeId: KnowledgeId;

  status: KnowledgeStatus;

  chunksCreated: number;

  embeddingsCreated: number;

  summary?: string;

  error?: string;

  startedAt: Date;

  completedAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE SEARCH                                */
/* -------------------------------------------------------------------------- */

export type KnowledgeSearchMode =
  | "keyword"
  | "semantic"
  | "hybrid";

export interface KnowledgeSearchOptions {
  query: string;

  mode?: KnowledgeSearchMode;

  ownerId?: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  types?: KnowledgeType[];

  statuses?: KnowledgeStatus[];

  tags?: string[];

  limit?: number;

  offset?: number;

  includeContent?: boolean;

  includeChunks?: boolean;

  minScore?: number;
}

export interface KnowledgeSearchMatch {
  knowledge: KnowledgeSummary;

  score: number;

  matchedChunk?: KnowledgeChunk;

  highlights?: string[];

  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchResult {
  matches: KnowledgeSearchMatch[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;

  query: string;

  mode: KnowledgeSearchMode;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE LIST                                  */
/* -------------------------------------------------------------------------- */

export type KnowledgeSortField =
  | "title"
  | "type"
  | "status"
  | "createdAt"
  | "updatedAt";

export type KnowledgeSortOrder =
  | "asc"
  | "desc";

export interface KnowledgeListOptions {
  ownerId?: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  type?: KnowledgeType | KnowledgeType[];

  status?: KnowledgeStatus | KnowledgeStatus[];

  visibility?: KnowledgeVisibility | KnowledgeVisibility[];

  tags?: string[];

  query?: string;

  limit?: number;

  offset?: number;

  sortBy?: KnowledgeSortField;

  sortOrder?: KnowledgeSortOrder;

  includeDeleted?: boolean;

  includeArchived?: boolean;
}

export interface KnowledgeListResult {
  knowledge: KnowledgeRecord[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              KNOWLEDGE FILTER                              */
/* -------------------------------------------------------------------------- */

export interface KnowledgeFilter {
  ownerId?: string;

  workspaceId?: string;

  projectId?: string;

  collectionId?: KnowledgeCollectionId;

  types?: KnowledgeType[];

  statuses?: KnowledgeStatus[];

  visibility?: KnowledgeVisibility[];

  tags?: string[];

  createdAfter?: Date;

  createdBefore?: Date;

  updatedAfter?: Date;

  updatedBefore?: Date;
}

/* -------------------------------------------------------------------------- */
/*                          KNOWLEDGE PERMISSIONS                             */
/* -------------------------------------------------------------------------- */

export type KnowledgePermission =
  | "read"
  | "write"
  | "delete"
  | "share"
  | "manage";

export interface KnowledgeAccess {
  userId: string;

  permissions: KnowledgePermission[];

  grantedAt: Date;

  grantedBy?: string;

  expiresAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                            KNOWLEDGE SHARING                               */
/* -------------------------------------------------------------------------- */

export interface KnowledgeShare {
  id: string;

  knowledgeId: KnowledgeId;

  userId?: string;

  token?: string;

  permissions: KnowledgePermission[];

  createdAt: Date;

  createdBy: string;

  expiresAt?: Date;

  revokedAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                              KNOWLEDGE EVENTS                              */
/* -------------------------------------------------------------------------- */

export type KnowledgeEventType =
  | "created"
  | "updated"
  | "processing_started"
  | "processing_completed"
  | "processing_failed"
  | "chunk_created"
  | "embedding_created"
  | "searched"
  | "shared"
  | "unshared"
  | "archived"
  | "deleted"
  | "restored";

export interface KnowledgeEvent {
  id: string;

  type: KnowledgeEventType;

  knowledgeId: KnowledgeId;

  actorId?: string;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

export const KNOWLEDGE_TYPE_VALUES = [
  "document",
  "note",
  "web",
  "conversation",
  "file",
  "database",
  "integration",
  "manual",
  "generated",
  "other",
] as const satisfies readonly KnowledgeType[];

export const KNOWLEDGE_STATUS_VALUES = [
  "pending",
  "processing",
  "ready",
  "failed",
  "archived",
  "deleted",
] as const satisfies readonly KnowledgeStatus[];

export const KNOWLEDGE_SOURCE_TYPE_VALUES = [
  "file",
  "url",
  "text",
  "message",
  "integration",
  "database",
  "manual",
  "generated",
] as const satisfies readonly KnowledgeSourceType[];

export const KNOWLEDGE_VISIBILITY_VALUES = [
  "private",
  "workspace",
  "project",
  "public",
] as const satisfies readonly KnowledgeVisibility[];

export const EMBEDDING_STATUS_VALUES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const satisfies readonly EmbeddingStatus[];

export const KNOWLEDGE_PERMISSION_VALUES = [
  "read",
  "write",
  "delete",
  "share",
  "manage",
] as const satisfies readonly KnowledgePermission[];

export const KNOWLEDGE_SEARCH_MODE_VALUES = [
  "keyword",
  "semantic",
  "hybrid",
] as const satisfies readonly KnowledgeSearchMode[];

/* -------------------------------------------------------------------------- */
/*                               TYPE GUARDS                                  */
/* -------------------------------------------------------------------------- */

export function isKnowledgeType(
  value: unknown
): value is KnowledgeType {
  return (
    typeof value === "string" &&
    KNOWLEDGE_TYPE_VALUES.includes(
      value as KnowledgeType
    )
  );
}

export function isKnowledgeStatus(
  value: unknown
): value is KnowledgeStatus {
  return (
    typeof value === "string" &&
    KNOWLEDGE_STATUS_VALUES.includes(
      value as KnowledgeStatus
    )
  );
}

export function isKnowledgeVisibility(
  value: unknown
): value is KnowledgeVisibility {
  return (
    typeof value === "string" &&
    KNOWLEDGE_VISIBILITY_VALUES.includes(
      value as KnowledgeVisibility
    )
  );
}

export function isKnowledgePermission(
  value: unknown
): value is KnowledgePermission {
  return (
    typeof value === "string" &&
    KNOWLEDGE_PERMISSION_VALUES.includes(
      value as KnowledgePermission
    )
  );
}

export function isKnowledgeSearchMode(
  value: unknown
): value is KnowledgeSearchMode {
  return (
    typeof value === "string" &&
    KNOWLEDGE_SEARCH_MODE_VALUES.includes(
      value as KnowledgeSearchMode
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

export function createKnowledgeSummary(
  knowledge: KnowledgeRecord
): KnowledgeSummary {
  return {
    id: knowledge.id,

    type: knowledge.type,

    status: knowledge.status,

    title: knowledge.title,

    summary: knowledge.summary,

    visibility:
      knowledge.visibility,

    ownerId:
      knowledge.ownerId,

    workspaceId:
      knowledge.workspaceId,

    projectId:
      knowledge.projectId,

    collectionId:
      knowledge.collectionId,

    tags:
      knowledge.tags
        ? [...knowledge.tags]
        : undefined,

    createdAt:
      new Date(
        knowledge.createdAt
      ),

    updatedAt:
      new Date(
        knowledge.updatedAt
      ),
  };
}

export function hasKnowledgePermission(
  access: KnowledgeAccess,
  permission: KnowledgePermission
): boolean {
  return access.permissions.includes(
    permission
  );
}

export function calculateKnowledgeContentStats(
  content: string
): {
  characters: number;
  words: number;
} {
  const normalized =
    content.trim();

  if (!normalized) {
    return {
      characters: 0,
      words: 0,
    };
  }

  return {
    characters:
      normalized.length,

    words:
      normalized.split(/\s+/).length,
  };
}