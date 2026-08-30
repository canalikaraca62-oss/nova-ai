// lib/ai/knowledge/search.ts

/**
 * SYRAVEN AI Knowledge Search Engine
 *
 * Responsibilities:
 * - Normalize search requests
 * - Execute keyword search
 * - Execute semantic search through a provider
 * - Execute hybrid search
 * - Rank and filter results
 * - Build AI-ready knowledge context
 * - Generate citations
 */

import {
  KNOWLEDGE_DEFAULTS,
  createEmptyKnowledgeContext,
  createKnowledgeSearchRequest,
  type KnowledgeCitation,
  type KnowledgeContext,
  type KnowledgeContextItem,
  type KnowledgeDocument,
  type KnowledgeProvider,
  type KnowledgeSearchMode,
  type KnowledgeSearchRequest,
  type KnowledgeSearchResponse,
  type KnowledgeSearchResult,
} from "./types";

/**
 * Options used when building AI context from search results.
 */
export interface BuildKnowledgeContextOptions {
  maxResults?: number;

  maxCharactersPerItem?: number;

  includeCitations?: boolean;

  minScore?: number;
}

/**
 * Search engine configuration.
 */
export interface KnowledgeSearchEngineOptions {
  provider: KnowledgeProvider;

  defaultMode?: KnowledgeSearchMode;

  defaultLimit?: number;

  maxLimit?: number;
}

/**
 * Result scoring weights for hybrid search.
 */
export interface HybridSearchWeights {
  keyword: number;

  semantic: number;
}

/**
 * Default hybrid scoring weights.
 */
export const DEFAULT_HYBRID_WEIGHTS: HybridSearchWeights = {
  keyword: 0.4,
  semantic: 0.6,
};

/**
 * Normalizes text for keyword comparison.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits a query into searchable terms.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);

  if (!normalized) {
    return [];
  }

  return Array.from(
    new Set(
      normalized
        .split(" ")
        .map((term) => term.trim())
        .filter((term) => term.length > 1),
    ),
  );
}

/**
 * Calculates a simple keyword relevance score.
 *
 * This is intentionally deterministic and can be used
 * as a fallback when a dedicated search backend is not available.
 */
export function calculateKeywordScore(
  query: string,
  content: string,
): {
  score: number;
  matchedTerms: string[];
} {
  const terms = tokenizeSearchQuery(query);

  if (terms.length === 0 || !content.trim()) {
    return {
      score: 0,
      matchedTerms: [],
    };
  }

  const normalizedContent =
    normalizeSearchText(content);

  const matchedTerms = terms.filter((term) =>
    normalizedContent.includes(term),
  );

  if (matchedTerms.length === 0) {
    return {
      score: 0,
      matchedTerms: [],
    };
  }

  const coverage =
    matchedTerms.length / terms.length;

  let frequencyScore = 0;

  for (const term of matchedTerms) {
    const occurrences =
      normalizedContent.split(term).length - 1;

    frequencyScore += Math.min(
      occurrences / 10,
      1,
    );
  }

  const normalizedFrequency =
    frequencyScore / matchedTerms.length;

  const score =
    coverage * 0.75 +
    normalizedFrequency * 0.25;

  return {
    score: Math.min(1, Math.max(0, score)),
    matchedTerms,
  };
}

/**
 * Combines keyword and semantic scores.
 */
export function calculateHybridScore(
  keywordScore?: number,
  semanticScore?: number,
  weights: HybridSearchWeights =
    DEFAULT_HYBRID_WEIGHTS,
): number {
  const safeKeywordScore =
    Math.max(0, Math.min(1, keywordScore ?? 0));

  const safeSemanticScore =
    Math.max(0, Math.min(1, semanticScore ?? 0));

  const totalWeight =
    weights.keyword + weights.semantic;

  if (totalWeight <= 0) {
    return Math.max(
      safeKeywordScore,
      safeSemanticScore,
    );
  }

  const score =
    (safeKeywordScore * weights.keyword +
      safeSemanticScore * weights.semantic) /
    totalWeight;

  return Math.max(0, Math.min(1, score));
}

/**
 * Sorts search results by score.
 */
export function sortKnowledgeResults(
  results: KnowledgeSearchResult[],
): KnowledgeSearchResult[] {
  return [...results].sort(
    (a, b) => b.score - a.score,
  );
}

/**
 * Removes duplicate chunk results.
 */
export function deduplicateKnowledgeResults(
  results: KnowledgeSearchResult[],
): KnowledgeSearchResult[] {
  const seen = new Map<
    string,
    KnowledgeSearchResult
  >();

  for (const result of results) {
    const existing = seen.get(result.chunk.id);

    if (!existing || result.score > existing.score) {
      seen.set(result.chunk.id, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * Applies minimum score filtering.
 */
export function filterKnowledgeResults(
  results: KnowledgeSearchResult[],
  minScore: number,
): KnowledgeSearchResult[] {
  return results.filter(
    (result) => result.score >= minScore,
  );
}

/**
 * Safely limits the number of results.
 */
export function limitKnowledgeResults(
  results: KnowledgeSearchResult[],
  limit: number,
): KnowledgeSearchResult[] {
  return results.slice(0, Math.max(0, limit));
}

/**
 * Creates a citation from a knowledge search result.
 */
export function createKnowledgeCitation(
  result: KnowledgeSearchResult,
): KnowledgeCitation {
  const documentTitle =
    result.document?.title ??
    result.source?.name ??
    "Knowledge Source";

  const sourceName =
    result.source?.name ??
    result.document?.source?.name ??
    "Knowledge Source";

  const sourceId =
    result.source?.id ??
    result.document?.sourceId ??
    result.chunk.sourceId;

  const documentId =
    result.document?.id ??
    result.chunk.documentId;

  const url =
    result.source?.url ??
    result.document?.source?.url;

  return {
    id: `citation-${result.chunk.id}`,

    sourceId,

    documentId,

    chunkId: result.chunk.id,

    title: documentTitle,

    sourceName,

    ...(url ? { url } : {}),

    excerpt: result.chunk.content,

    score: result.score,

    metadata: {
      ...result.chunk.metadata,
      ...(result.document?.metadata ?? {}),
    },
  };
}

/**
 * Truncates knowledge content safely.
 */
export function truncateKnowledgeContent(
  content: string,
  maxCharacters: number,
): string {
  if (maxCharacters <= 0) {
    return "";
  }

  if (content.length <= maxCharacters) {
    return content;
  }

  return `${content.slice(
    0,
    Math.max(0, maxCharacters - 1),
  )}…`;
}

/**
 * Converts search results into AI-ready context.
 */
export function buildKnowledgeContext(
  query: string,
  results: KnowledgeSearchResult[],
  options: BuildKnowledgeContextOptions = {},
): KnowledgeContext {
  if (results.length === 0) {
    return createEmptyKnowledgeContext(query);
  }

  const maxResults =
    Math.max(
      1,
      options.maxResults ??
        KNOWLEDGE_DEFAULTS.SEARCH_LIMIT,
    );

  const maxCharactersPerItem =
    Math.max(
      100,
      options.maxCharactersPerItem ?? 4_000,
    );

  const minScore =
    Math.max(0, options.minScore ?? 0);

  const includeCitations =
    options.includeCitations !== false;

  const filteredResults =
    limitKnowledgeResults(
      filterKnowledgeResults(
        sortKnowledgeResults(
          deduplicateKnowledgeResults(results),
        ),
        minScore,
      ),
      maxResults,
    );

  const items: KnowledgeContextItem[] =
    filteredResults.map((result) => ({
      id: result.chunk.id,

      content: truncateKnowledgeContent(
        result.chunk.content,
        maxCharactersPerItem,
      ),

      citation: createKnowledgeCitation(result),

      score: result.score,
    }));

  const citations = includeCitations
    ? items.map((item) => item.citation)
    : [];

  return {
    query,

    items,

    citations,

    totalResults: items.length,

    createdAt: new Date().toISOString(),
  };
}

/**
 * Attempts to calculate deterministic keyword scores
 * on provider search results.
 */
export function enrichKeywordScores(
  query: string,
  results: KnowledgeSearchResult[],
): KnowledgeSearchResult[] {
  return results.map((result) => {
    const keywordResult =
      calculateKeywordScore(
        query,
        [
          result.document?.title ?? "",
          result.chunk.content,
        ].join(" "),
      );

    return {
      ...result,

      keywordScore: keywordResult.score,

      matchedTerms: keywordResult.matchedTerms,
    };
  });
}

/**
 * Applies hybrid scoring to results.
 */
export function enrichHybridScores(
  results: KnowledgeSearchResult[],
  weights: HybridSearchWeights =
    DEFAULT_HYBRID_WEIGHTS,
): KnowledgeSearchResult[] {
  return results.map((result) => ({
    ...result,

    score: calculateHybridScore(
      result.keywordScore,
      result.semanticScore ??
        result.score,
      weights,
    ),
  }));
}

/**
 * Main knowledge search engine.
 */
export class KnowledgeSearchEngine {
  private readonly provider: KnowledgeProvider;

  private readonly defaultMode: KnowledgeSearchMode;

  private readonly defaultLimit: number;

  private readonly maxLimit: number;

  constructor(
    options: KnowledgeSearchEngineOptions,
  ) {
    this.provider = options.provider;

    this.defaultMode =
      options.defaultMode ??
      KNOWLEDGE_DEFAULTS.SEARCH_MODE;

    this.defaultLimit =
      Math.max(
        1,
        options.defaultLimit ??
          KNOWLEDGE_DEFAULTS.SEARCH_LIMIT,
      );

    this.maxLimit =
      Math.max(
        this.defaultLimit,
        options.maxLimit ??
          KNOWLEDGE_DEFAULTS.MAX_SEARCH_LIMIT,
      );
  }

  /**
   * Executes a search against the configured provider.
   */
  async search(
    request: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResponse> {
    const startedAt = Date.now();

    const normalizedRequest =
      createKnowledgeSearchRequest({
        ...request,

        mode:
          request.mode ??
          this.defaultMode,

        limit: Math.min(
          request.limit ??
            this.defaultLimit,
          this.maxLimit,
        ),
      });

    if (!normalizedRequest.query) {
      return {
        query: "",

        mode: normalizedRequest.mode,

        results: [],

        total: 0,

        tookMs: Date.now() - startedAt,
      };
    }

    const providerResponse =
      await this.provider.search(
        normalizedRequest,
      );

    let results =
      providerResponse.results;

    /**
     * Keyword mode:
     * Recalculate deterministic keyword relevance.
     */
    if (normalizedRequest.mode === "keyword") {
      results = enrichKeywordScores(
        normalizedRequest.query,
        results,
      ).map((result) => ({
        ...result,
        score: result.keywordScore ?? 0,
      }));
    }

    /**
     * Hybrid mode:
     * Combine deterministic keyword score with
     * semantic/provider score.
     */
    if (normalizedRequest.mode === "hybrid") {
      const keywordEnriched =
        enrichKeywordScores(
          normalizedRequest.query,
          results,
        );

      results = enrichHybridScores(
        keywordEnriched,
      );
    }

    results = limitKnowledgeResults(
      sortKnowledgeResults(
        deduplicateKnowledgeResults(
          filterKnowledgeResults(
            results,
            normalizedRequest.minScore,
          ),
        ),
      ),
      normalizedRequest.limit,
    );

    return {
      query: normalizedRequest.query,

      mode: normalizedRequest.mode,

      results,

      total: results.length,

      tookMs: Date.now() - startedAt,
    };
  }

  /**
   * Searches and directly builds RAG context.
   */
  async getContext(
    request: KnowledgeSearchRequest,
    options: BuildKnowledgeContextOptions = {},
  ): Promise<KnowledgeContext> {
    const response =
      await this.search(request);

    return buildKnowledgeContext(
      response.query,
      response.results,
      {
        maxResults:
          options.maxResults ??
          request.limit,

        maxCharactersPerItem:
          options.maxCharactersPerItem,

        includeCitations:
          options.includeCitations,

        minScore:
          options.minScore ??
          request.minScore,
      },
    );
  }

  /**
   * Returns the configured knowledge provider.
   */
  getProvider(): KnowledgeProvider {
    return this.provider;
  }
}

/**
 * Creates a knowledge search engine.
 */
export function createKnowledgeSearchEngine(
  options: KnowledgeSearchEngineOptions,
): KnowledgeSearchEngine {
  return new KnowledgeSearchEngine(options);
}

/**
 * Convenience function for one-off searches.
 */
export async function searchKnowledge(
  provider: KnowledgeProvider,
  request: KnowledgeSearchRequest,
): Promise<KnowledgeSearchResponse> {
  const engine =
    createKnowledgeSearchEngine({
      provider,
    });

  return engine.search(request);
}

/**
 * Convenience function for one-off
 * AI context generation.
 */
export async function getKnowledgeContext(
  provider: KnowledgeProvider,
  request: KnowledgeSearchRequest,
  options: BuildKnowledgeContextOptions = {},
): Promise<KnowledgeContext> {
  const engine =
    createKnowledgeSearchEngine({
      provider,
    });

  return engine.getContext(
    request,
    options,
  );
}

export default KnowledgeSearchEngine;