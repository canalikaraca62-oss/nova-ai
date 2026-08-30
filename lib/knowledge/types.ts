// lib/ai/knowledge/types.ts

/**
 * SYRAVEN AI Knowledge System
 *
 * Core type definitions for:
 * - Knowledge documents
 * - Sources
 * - Chunks
 * - Search
 * - Retrieval
 * - Citations
 * - RAG context
 */

/**
 * Supported knowledge source types.
 */
export type KnowledgeSourceType =
  | "document"
  | "website"
  | "url"
  | "file"
  | "note"
  | "database"
  | "api"
  | "conversation"
  | "manual";

/**
 * Supported document content types.
 */
export type KnowledgeContentType =
  | "text"
  | "markdown"
  | "html"
  | "pdf"
  | "json"
  | "csv"
  | "code"
  | "unknown";

/**
 * Knowledge document lifecycle status.
 */
export type KnowledgeDocumentStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "archived";

/**
 * Search strategies supported by the knowledge engine.
 */
export type KnowledgeSearchMode =
  | "keyword"
  | "semantic"
  | "hybrid";

/**
 * Sort direction.
 */
export type KnowledgeSortOrder =
  | "asc"
  | "desc";

/**
 * Metadata attached to knowledge records.
 */
export type KnowledgeMetadata = Record<
  string,
  unknown
>;

/**
 * Original source information.
 */
export interface KnowledgeSource {
  id: string;

  type: KnowledgeSourceType;

  name: string;

  url?: string;

  contentType?: KnowledgeContentType;

  metadata?: KnowledgeMetadata;

  createdAt: string;

  updatedAt?: string;
}

/**
 * Main knowledge document.
 */
export interface KnowledgeDocument {
  id: string;

  sourceId: string;

  title: string;

  content: string;

  source: KnowledgeSource;

  contentType: KnowledgeContentType;

  status: KnowledgeDocumentStatus;

  metadata: KnowledgeMetadata;

  createdAt: string;

  updatedAt: string;

  indexedAt?: string;
}

/**
 * A chunk is a smaller searchable section
 * extracted from a knowledge document.
 */
export interface KnowledgeChunk {
  id: string;

  documentId: string;

  sourceId: string;

  content: string;

  index: number;

  startOffset?: number;

  endOffset?: number;

  tokenCount?: number;

  metadata: KnowledgeMetadata;

  createdAt: string;
}

/**
 * Vector embedding attached to a chunk.
 */
export interface KnowledgeEmbedding {
  id: string;

  chunkId: string;

  model: string;

  dimensions: number;

  values: number[];

  createdAt: string;
}

/**
 * Search filters.
 */
export interface KnowledgeSearchFilters {
  sourceIds?: string[];

  documentIds?: string[];

  sourceTypes?: KnowledgeSourceType[];

  contentTypes?: KnowledgeContentType[];

  statuses?: KnowledgeDocumentStatus[];

  metadata?: Record<string, unknown>;
}

/**
 * Knowledge search request.
 */
export interface KnowledgeSearchRequest {
  query: string;

  mode?: KnowledgeSearchMode;

  limit?: number;

  offset?: number;

  minScore?: number;

  filters?: KnowledgeSearchFilters;

  includeContent?: boolean;

  includeMetadata?: boolean;
}

/**
 * A single knowledge search result.
 */
export interface KnowledgeSearchResult {
  chunk: KnowledgeChunk;

  document?: KnowledgeDocument;

  source?: KnowledgeSource;

  score: number;

  keywordScore?: number;

  semanticScore?: number;

  matchedTerms?: string[];

  highlights?: string[];
}

/**
 * Search response.
 */
export interface KnowledgeSearchResponse {
  query: string;

  mode: KnowledgeSearchMode;

  results: KnowledgeSearchResult[];

  total: number;

  tookMs: number;
}

/**
 * Citation generated from retrieved knowledge.
 */
export interface KnowledgeCitation {
  id: string;

  sourceId: string;

  documentId?: string;

  chunkId?: string;

  title: string;

  sourceName: string;

  url?: string;

  excerpt?: string;

  score?: number;

  metadata?: KnowledgeMetadata;
}

/**
 * Context item prepared for an AI model.
 */
export interface KnowledgeContextItem {
  id: string;

  content: string;

  citation: KnowledgeCitation;

  score: number;
}

/**
 * RAG context returned after retrieval.
 */
export interface KnowledgeContext {
  query: string;

  items: KnowledgeContextItem[];

  citations: KnowledgeCitation[];

  totalResults: number;

  createdAt: string;
}

/**
 * Configuration for chunk generation.
 */
export interface KnowledgeChunkingOptions {
  chunkSize?: number;

  chunkOverlap?: number;

  preserveParagraphs?: boolean;

  preserveSentences?: boolean;
}

/**
 * Configuration for knowledge indexing.
 */
export interface KnowledgeIndexingOptions {
  generateEmbeddings?: boolean;

  embeddingModel?: string;

  chunking?: KnowledgeChunkingOptions;

  metadata?: KnowledgeMetadata;
}

/**
 * Knowledge indexing request.
 */
export interface KnowledgeIndexRequest {
  source: KnowledgeSource;

  title: string;

  content: string;

  contentType?: KnowledgeContentType;

  options?: KnowledgeIndexingOptions;
}

/**
 * Result of indexing a document.
 */
export interface KnowledgeIndexResult {
  document: KnowledgeDocument;

  chunks: KnowledgeChunk[];

  embeddings?: KnowledgeEmbedding[];

  success: boolean;

  error?: string;

  indexedAt: string;
}

/**
 * Knowledge deletion result.
 */
export interface KnowledgeDeleteResult {
  success: boolean;

  deletedDocumentId?: string;

  deletedChunkIds?: string[];

  error?: string;
}

/**
 * Pagination configuration.
 */
export interface KnowledgePagination {
  limit: number;

  offset: number;

  total?: number;
}

/**
 * Generic paginated knowledge response.
 */
export interface KnowledgeListResponse<T> {
  items: T[];

  pagination: KnowledgePagination;
}

/**
 * Supported knowledge provider capabilities.
 */
export interface KnowledgeProviderCapabilities {
  keywordSearch: boolean;

  semanticSearch: boolean;

  hybridSearch: boolean;

  embeddings: boolean;

  metadataFiltering: boolean;

  documentStorage: boolean;

  chunkStorage: boolean;
}

/**
 * Generic knowledge provider interface.
 *
 * Storage implementations can implement this interface
 * using PostgreSQL, Pinecone, Weaviate, Qdrant,
 * Elasticsearch or another backend.
 */
export interface KnowledgeProvider {
  readonly name: string;

  readonly capabilities: KnowledgeProviderCapabilities;

  index(
    request: KnowledgeIndexRequest,
  ): Promise<KnowledgeIndexResult>;

  search(
    request: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResponse>;

  getDocument(
    documentId: string,
  ): Promise<KnowledgeDocument | null>;

  getChunk(
    chunkId: string,
  ): Promise<KnowledgeChunk | null>;

  deleteDocument(
    documentId: string,
  ): Promise<KnowledgeDeleteResult>;
}

/**
 * Default knowledge system constants.
 */
export const KNOWLEDGE_DEFAULTS = {
  SEARCH_MODE: "hybrid" as KnowledgeSearchMode,

  SEARCH_LIMIT: 10,

  MAX_SEARCH_LIMIT: 100,

  MIN_SCORE: 0,

  CHUNK_SIZE: 1_000,

  CHUNK_OVERLAP: 150,

  EMBEDDING_MODEL: "default",
} as const;

/**
 * Type guard for knowledge search mode.
 */
export function isKnowledgeSearchMode(
  value: unknown,
): value is KnowledgeSearchMode {
  return (
    value === "keyword" ||
    value === "semantic" ||
    value === "hybrid"
  );
}

/**
 * Type guard for knowledge source type.
 */
export function isKnowledgeSourceType(
  value: unknown,
): value is KnowledgeSourceType {
  return [
    "document",
    "website",
    "url",
    "file",
    "note",
    "database",
    "api",
    "conversation",
    "manual",
  ].includes(value as KnowledgeSourceType);
}

/**
 * Creates a safe search request with defaults.
 */
export function createKnowledgeSearchRequest(
  request: KnowledgeSearchRequest,
): Required<
  Pick<
    KnowledgeSearchRequest,
    "query" | "mode" | "limit" | "offset" | "minScore"
  >
> &
  Omit<
    KnowledgeSearchRequest,
    "query" | "mode" | "limit" | "offset" | "minScore"
  > {
  const limit = Math.min(
    Math.max(
      1,
      request.limit ?? KNOWLEDGE_DEFAULTS.SEARCH_LIMIT,
    ),
    KNOWLEDGE_DEFAULTS.MAX_SEARCH_LIMIT,
  );

  return {
    ...request,

    query: request.query.trim(),

    mode:
      request.mode ??
      KNOWLEDGE_DEFAULTS.SEARCH_MODE,

    limit,

    offset: Math.max(0, request.offset ?? 0),

    minScore: Math.max(
      0,
      request.minScore ??
        KNOWLEDGE_DEFAULTS.MIN_SCORE,
    ),
  };
}

/**
 * Creates a standard empty knowledge context.
 */
export function createEmptyKnowledgeContext(
  query: string,
): KnowledgeContext {
  return {
    query,

    items: [],

    citations: [],

    totalResults: 0,

    createdAt: new Date().toISOString(),
  };
}