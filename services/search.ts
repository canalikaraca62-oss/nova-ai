/**
 * SYRAVEN Search Service
 *
 * Enterprise-grade search infrastructure.
 *
 * Features:
 * - Provider-based architecture
 * - Document indexing
 * - Document removal
 * - Full-text style search
 * - Multi-field search
 * - Filtering
 * - Sorting
 * - Relevance scoring
 * - Highlighting
 * - Pagination
 * - Facets
 * - Search suggestions
 * - Query validation
 * - In-memory provider
 *
 * Production note:
 * The public API is provider-agnostic.
 * The in-memory provider can later be replaced with:
 *
 * - PostgreSQL full-text search
 * - Supabase/Postgres
 * - Elasticsearch
 * - OpenSearch
 * - Meilisearch
 * - Typesense
 * - Vector / hybrid search
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type SearchPrimitive =
  | string
  | number
  | boolean
  | null;

export type SearchValue =
  | SearchPrimitive
  | SearchPrimitive[];

export type SearchDocumentFields =
  Record<
    string,
    SearchValue
  >;

export interface SearchDocument {
  id: string;

  type?: string;

  title?: string;

  content?: string;

  fields?: SearchDocumentFields;

  metadata?: Record<
    string,
    unknown
  >;

  createdAt?: Date;

  updatedAt?: Date;
}

export type SearchSortDirection =
  | "asc"
  | "desc";

export interface SearchSort {
  field: string;

  direction?: SearchSortDirection;
}

export type SearchFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "starts_with"
  | "in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists";

export interface SearchFilter {
  field: string;

  operator?: SearchFilterOperator;

  value?: SearchValue;
}

export interface SearchHighlight {
  field: string;

  fragments: string[];
}

export interface SearchHit {
  id: string;

  document: SearchDocument;

  score: number;

  highlights?: SearchHighlight[];
}

export interface SearchFacetBucket {
  value: string;

  count: number;
}

export interface SearchFacet {
  field: string;

  buckets: SearchFacetBucket[];
}

export interface SearchQuery {
  query?: string;

  types?: string[];

  filters?: SearchFilter[];

  sort?: SearchSort[];

  page?: number;

  limit?: number;

  highlight?: boolean;

  highlightFields?: string[];

  facetFields?: string[];

  minScore?: number;
}

export interface SearchResult {
  hits: SearchHit[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;

  facets: SearchFacet[];

  query: string;
}

export interface SearchSuggestion {
  value: string;

  score: number;
}

export interface SearchProvider {
  index(
    document: SearchDocument
  ): Promise<void>;

  indexMany(
    documents: SearchDocument[]
  ): Promise<void>;

  remove(
    documentId: string
  ): Promise<void>;

  removeMany(
    documentIds: string[]
  ): Promise<void>;

  get(
    documentId: string
  ): Promise<
    SearchDocument | undefined
  >;

  search(
    query: SearchQuery
  ): Promise<SearchResult>;

  clear(): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class SearchServiceError
  extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "SearchServiceError";
  }
}

export class SearchValidationError
  extends SearchServiceError {
  readonly errors: string[];

  constructor(
    errors: string[]
  ) {
    super(
      errors.join(" ")
    );

    this.name =
      "SearchValidationError";

    this.errors =
      errors;
  }
}

export class SearchDocumentNotFoundError
  extends SearchServiceError {
  constructor(
    documentId: string
  ) {
    super(
      `Search document not found: ${documentId}`
    );

    this.name =
      "SearchDocumentNotFoundError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SEARCH_LIMIT =
  20;

export const MAX_SEARCH_LIMIT =
  100;

export const MAX_SEARCH_QUERY_LENGTH =
  1_000;

export const MAX_SEARCH_FILTERS =
  50;

export const MAX_SEARCH_SORTS =
  10;

export const MAX_SEARCH_FACETS =
  25;

export const MAX_HIGHLIGHT_LENGTH =
  300;

/* -------------------------------------------------------------------------- */
/*                            IN-MEMORY PROVIDER                              */
/* -------------------------------------------------------------------------- */

export class InMemorySearchProvider
  implements SearchProvider {
  private readonly documents =
    new Map<
      string,
      SearchDocument
    >();

  async index(
    document: SearchDocument
  ): Promise<void> {
    this.validateDocument(
      document
    );

    this.documents.set(
      document.id,
      this.cloneDocument(
        document
      )
    );
  }

  async indexMany(
    documents: SearchDocument[]
  ): Promise<void> {
    for (
      const document of documents
    ) {
      await this.index(
        document
      );
    }
  }

  async remove(
    documentId: string
  ): Promise<void> {
    this.documents.delete(
      documentId
    );
  }

  async removeMany(
    documentIds: string[]
  ): Promise<void> {
    for (
      const documentId of documentIds
    ) {
      this.documents.delete(
        documentId
      );
    }
  }

  async get(
    documentId: string
  ): Promise<
    SearchDocument | undefined
  > {
    const document =
      this.documents.get(
        documentId
      );

    if (!document) {
      return undefined;
    }

    return this.cloneDocument(
      document
    );
  }

  async search(
    input: SearchQuery
  ): Promise<SearchResult> {
    const query =
      this.normalizeQuery(
        input
      );

    let documents =
      Array.from(
        this.documents.values()
      );

    if (
      query.types &&
      query.types.length > 0
    ) {
      const allowedTypes =
        new Set(
          query.types
        );

      documents =
        documents.filter(
          (document) =>
            document.type !== undefined &&
            allowedTypes.has(
              document.type
            )
        );
    }

    if (
      query.filters &&
      query.filters.length > 0
    ) {
      documents =
        documents.filter(
          (document) =>
            query.filters!.every(
              (filter) =>
                this.matchesFilter(
                  document,
                  filter
                )
            )
        );
    }

    const searchTerms =
      this.tokenize(
        query.query ?? ""
      );

    let hits =
      documents.map(
        (document) => {
          const score =
            this.calculateScore(
              document,
              searchTerms
            );

          return {
            id:
              document.id,

            document:
              this.cloneDocument(
                document
              ),

            score,
          };
        }
      );

    if (
      searchTerms.length > 0
    ) {
      hits =
        hits.filter(
          (hit) =>
            hit.score > 0
        );
    }

    if (
      query.minScore !== undefined
    ) {
      hits =
        hits.filter(
          (hit) =>
            hit.score >=
            query.minScore!
        );
    }

    if (
      query.sort &&
      query.sort.length > 0
    ) {
      hits.sort(
        (a, b) =>
          this.compareHits(
            a,
            b,
            query.sort!
          )
      );
    } else {
      hits.sort(
        (a, b) => {
          if (
            b.score !==
            a.score
          ) {
            return (
              b.score -
              a.score
            );
          }

          return a.id.localeCompare(
            b.id
          );
        }
      );
    }

    if (
      query.highlight &&
      searchTerms.length > 0
    ) {
      hits =
        hits.map(
          (hit) => ({
            ...hit,

            highlights:
              this.createHighlights(
                hit.document,
                searchTerms,
                query.highlightFields
              ),
          })
        );
    }

    const facets =
      this.createFacets(
        hits,
        query.facetFields
      );

    const total =
      hits.length;

    const page =
      query.page ??
      1;

    const limit =
      query.limit ??
      DEFAULT_SEARCH_LIMIT;

    const start =
      (page - 1) *
      limit;

    const paginatedHits =
      hits.slice(
        start,
        start + limit
      );

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total /
            limit
          );

    return {
      hits:
        paginatedHits,

      total,

      page,

      limit,

      totalPages,

      hasNextPage:
        page <
        totalPages,

      hasPreviousPage:
        page > 1,

      facets,

      query:
        query.query ?? "",
    };
  }

  async clear(): Promise<void> {
    this.documents.clear();
  }

  /* ------------------------------------------------------------------------ */
  /*                             SEARCH ENGINE                                */
  /* ------------------------------------------------------------------------ */

  private calculateScore(
    document: SearchDocument,
    terms: string[]
  ): number {
    if (
      terms.length === 0
    ) {
      return 1;
    }

    let score =
      0;

    const title =
      document.title ??
      "";

    const content =
      document.content ??
      "";

    const normalizedTitle =
      title.toLowerCase();

    const normalizedContent =
      content.toLowerCase();

    for (
      const term of terms
    ) {
      if (
        normalizedTitle ===
        term
      ) {
        score += 20;
      }

      if (
        normalizedTitle.includes(
          term
        )
      ) {
        score += 10;
      }

      if (
        normalizedContent.includes(
          term
        )
      ) {
        score += 3;
      }

      const fieldScore =
        this.calculateFieldsScore(
          document.fields,
          term
        );

      score +=
        fieldScore;
    }

    return score;
  }

  private calculateFieldsScore(
    fields: SearchDocumentFields | undefined,
    term: string
  ): number {
    if (!fields) {
      return 0;
    }

    let score =
      0;

    for (
      const value of Object.values(
        fields
      )
    ) {
      if (
        Array.isArray(
          value
        )
      ) {
        for (
          const item of value
        ) {
          if (
            String(item)
              .toLowerCase()
              .includes(
                term
              )
          ) {
            score += 2;
          }
        }

        continue;
      }

      if (
        String(value)
          .toLowerCase()
          .includes(
            term
          )
      ) {
        score += 2;
      }
    }

    return score;
  }

  /* ------------------------------------------------------------------------ */
  /*                                FILTERING                                 */
  /* ------------------------------------------------------------------------ */

  private matchesFilter(
    document: SearchDocument,
    filter: SearchFilter
  ): boolean {
    const value =
      this.getFieldValue(
        document,
        filter.field
      );

    const operator =
      filter.operator ??
      "eq";

    switch (
      operator
    ) {
      case "eq":
        return this.valuesEqual(
          value,
          filter.value
        );

      case "neq":
        return !this.valuesEqual(
          value,
          filter.value
        );

      case "contains":
        return this.valueContains(
          value,
          filter.value
        );

      case "starts_with":
        return this.valueStartsWith(
          value,
          filter.value
        );

      case "in":
        return this.valueIn(
          value,
          filter.value
        );

      case "gt":
        return this.compareValues(
          value,
          filter.value
        ) > 0;

      case "gte":
        return this.compareValues(
          value,
          filter.value
        ) >= 0;

      case "lt":
        return this.compareValues(
          value,
          filter.value
        ) < 0;

      case "lte":
        return this.compareValues(
          value,
          filter.value
        ) <= 0;

      case "exists":
        return (
          value !== undefined &&
          value !== null
        );

      default:
        return false;
    }
  }

  private getFieldValue(
    document: SearchDocument,
    field: string
  ): SearchValue | undefined {
    if (
      field === "id"
    ) {
      return document.id;
    }

    if (
      field === "type"
    ) {
      return document.type;
    }

    if (
      field === "title"
    ) {
      return document.title;
    }

    if (
      field === "content"
    ) {
      return document.content;
    }

    return document.fields?.[
      field
    ];
  }

  private valuesEqual(
    left: SearchValue | undefined,
    right: SearchValue | undefined
  ): boolean {
    if (
      Array.isArray(
        left
      )
    ) {
      return left.some(
        (value) =>
          this.valuesEqual(
            value,
            right
          )
      );
    }

    if (
      Array.isArray(
        right
      )
    ) {
      return right.some(
        (value) =>
          this.valuesEqual(
            left,
            value
          )
      );
    }

    return left === right;
  }

  private valueContains(
    left: SearchValue | undefined,
    right: SearchValue | undefined
  ): boolean {
    if (
      left === undefined ||
      left === null ||
      right === undefined ||
      right === null
    ) {
      return false;
    }

    const query =
      String(
        Array.isArray(
          right
        )
          ? right[0]
          : right
      ).toLowerCase();

    if (
      Array.isArray(
        left
      )
    ) {
      return left.some(
        (value) =>
          String(value)
            .toLowerCase()
            .includes(
              query
            )
      );
    }

    return String(left)
      .toLowerCase()
      .includes(query);
  }

  private valueStartsWith(
    left: SearchValue | undefined,
    right: SearchValue | undefined
  ): boolean {
    if (
      left === undefined ||
      left === null ||
      right === undefined ||
      right === null
    ) {
      return false;
    }

    const query =
      String(
        Array.isArray(
          right
        )
          ? right[0]
          : right
      ).toLowerCase();

    if (
      Array.isArray(
        left
      )
    ) {
      return left.some(
        (value) =>
          String(value)
            .toLowerCase()
            .startsWith(
              query
            )
      );
    }

    return String(left)
      .toLowerCase()
      .startsWith(query);
  }

  private valueIn(
    left: SearchValue | undefined,
    right: SearchValue | undefined
  ): boolean {
    if (
      right === undefined ||
      right === null
    ) {
      return false;
    }

    const values =
      Array.isArray(
        right
      )
        ? right
        : [right];

    return values.some(
      (value) =>
        this.valuesEqual(
          left,
          value
        )
    );
  }

  private compareValues(
    left: SearchValue | undefined,
    right: SearchValue | undefined
  ): number {
    if (
      left === undefined ||
      left === null ||
      right === undefined ||
      right === null
    ) {
      return -1;
    }

    const normalizedLeft =
      Array.isArray(
        left
      )
        ? left[0]
        : left;

    const normalizedRight =
      Array.isArray(
        right
      )
        ? right[0]
        : right;

    if (
      typeof normalizedLeft ===
        "number" &&
      typeof normalizedRight ===
        "number"
    ) {
      return (
        normalizedLeft -
        normalizedRight
      );
    }

    return String(
      normalizedLeft
    ).localeCompare(
      String(
        normalizedRight
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  SORTING                                 */
  /* ------------------------------------------------------------------------ */

  private compareHits(
    a: SearchHit,
    b: SearchHit,
    sorts: SearchSort[]
  ): number {
    for (
      const sort of sorts
    ) {
      const direction =
        sort.direction ??
        "asc";

      const left =
        this.getSortableValue(
          a,
          sort.field
        );

      const right =
        this.getSortableValue(
          b,
          sort.field
        );

      const comparison =
        this.compareSortableValues(
          left,
          right
        );

      if (
        comparison !== 0
      ) {
        return direction === "desc"
          ? -comparison
          : comparison;
      }
    }

    return a.id.localeCompare(
      b.id
    );
  }

  private getSortableValue(
    hit: SearchHit,
    field: string
  ): unknown {
    if (
      field === "_score"
    ) {
      return hit.score;
    }

    if (
      field === "id"
    ) {
      return hit.id;
    }

    if (
      field === "createdAt"
    ) {
      return hit.document.createdAt;
    }

    if (
      field === "updatedAt"
    ) {
      return hit.document.updatedAt;
    }

    return this.getFieldValue(
      hit.document,
      field
    );
  }

  private compareSortableValues(
    left: unknown,
    right: unknown
  ): number {
    if (
      left === right
    ) {
      return 0;
    }

    if (
      left === undefined ||
      left === null
    ) {
      return -1;
    }

    if (
      right === undefined ||
      right === null
    ) {
      return 1;
    }

    if (
      left instanceof Date &&
      right instanceof Date
    ) {
      return (
        left.getTime() -
        right.getTime()
      );
    }

    if (
      typeof left === "number" &&
      typeof right === "number"
    ) {
      return left - right;
    }

    return String(left)
      .localeCompare(
        String(right)
      );
  }

  /* ------------------------------------------------------------------------ */
  /*                                HIGHLIGHTS                                */
  /* ------------------------------------------------------------------------ */

  private createHighlights(
    document: SearchDocument,
    terms: string[],
    fields?: string[]
  ): SearchHighlight[] {
    const highlights:
      SearchHighlight[] =
        [];

    const availableFields =
      fields &&
      fields.length > 0
        ? fields
        : [
            "title",
            "content",
          ];

    for (
      const field of availableFields
    ) {
      const value =
        this.getFieldValue(
          document,
          field
        );

      if (
        value === undefined ||
        value === null ||
        Array.isArray(
          value
        )
      ) {
        continue;
      }

      const text =
        String(value);

      const fragments =
        this.createHighlightFragments(
          text,
          terms
        );

      if (
        fragments.length > 0
      ) {
        highlights.push({
          field,

          fragments,
        });
      }
    }

    return highlights;
  }

  private createHighlightFragments(
    text: string,
    terms: string[]
  ): string[] {
    const lower =
      text.toLowerCase();

    const fragments =
      new Set<string>();

    for (
      const term of terms
    ) {
      const index =
        lower.indexOf(
          term
        );

      if (
        index === -1
      ) {
        continue;
      }

      const start =
        Math.max(
          0,
          index -
            Math.floor(
              MAX_HIGHLIGHT_LENGTH /
                3
            )
        );

      const end =
        Math.min(
          text.length,
          start +
            MAX_HIGHLIGHT_LENGTH
        );

      let fragment =
        text.slice(
          start,
          end
        );

      fragment =
        this.highlightTerm(
          fragment,
          term
        );

      fragments.add(
        fragment
      );
    }

    return Array.from(
      fragments
    );
  }

  private highlightTerm(
    text: string,
    term: string
  ): string {
    const expression =
      new RegExp(
        this.escapeRegExp(
          term
        ),
        "gi"
      );

    return text.replace(
      expression,
      (match) =>
        `<mark>${match}</mark>`
    );
  }

  private escapeRegExp(
    value: string
  ): string {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  FACETS                                  */
  /* ------------------------------------------------------------------------ */

  private createFacets(
    hits: SearchHit[],
    fields?: string[]
  ): SearchFacet[] {
    if (
      !fields ||
      fields.length === 0
    ) {
      return [];
    }

    return fields.map(
      (field) => {
        const counts =
          new Map<
            string,
            number
          >();

        for (
          const hit of hits
        ) {
          const value =
            this.getFieldValue(
              hit.document,
              field
            );

          if (
            value === undefined ||
            value === null
          ) {
            continue;
          }

          const values =
            Array.isArray(
              value
            )
              ? value
              : [value];

          for (
            const item of values
          ) {
            const key =
              String(item);

            counts.set(
              key,
              (
                counts.get(
                  key
                ) ?? 0
              ) + 1
            );
          }
        }

        const buckets =
          Array.from(
            counts.entries()
          )
            .map(
              ([
                value,
                count,
              ]) => ({
                value,
                count,
              })
            )
            .sort(
              (a, b) => {
                if (
                  b.count !==
                  a.count
                ) {
                  return (
                    b.count -
                    a.count
                  );
                }

                return a.value.localeCompare(
                  b.value
                );
              }
            );

        return {
          field,

          buckets,
        };
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               VALIDATION                                 */
  /* ------------------------------------------------------------------------ */

  private normalizeQuery(
    input: SearchQuery
  ): Required<
    Pick<
      SearchQuery,
      | "page"
      | "limit"
      | "highlight"
    >
  > &
    SearchQuery {
    const errors: string[] =
      [];

    const rawQuery =
      input.query ?? "";

    if (
      rawQuery.length >
      MAX_SEARCH_QUERY_LENGTH
    ) {
      errors.push(
        `Search query exceeds maximum length of ${MAX_SEARCH_QUERY_LENGTH}.`
      );
    }

    if (
      input.filters &&
      input.filters.length >
        MAX_SEARCH_FILTERS
    ) {
      errors.push(
        `Too many search filters. Maximum is ${MAX_SEARCH_FILTERS}.`
      );
    }

    if (
      input.sort &&
      input.sort.length >
        MAX_SEARCH_SORTS
    ) {
      errors.push(
        `Too many sort fields. Maximum is ${MAX_SEARCH_SORTS}.`
      );
    }

    if (
      input.facetFields &&
      input.facetFields.length >
        MAX_SEARCH_FACETS
    ) {
      errors.push(
        `Too many facet fields. Maximum is ${MAX_SEARCH_FACETS}.`
      );
    }

    if (
      input.minScore !== undefined &&
      (
        !Number.isFinite(
          input.minScore
        ) ||
        input.minScore < 0
      )
    ) {
      errors.push(
        "Search minimum score must be a non-negative finite number."
      );
    }

    for (
      const filter of
      input.filters ?? []
    ) {
      if (
        !filter.field ||
        !filter.field.trim()
      ) {
        errors.push(
          "Search filter field is required."
        );
      }
    }

    for (
      const sort of
      input.sort ?? []
    ) {
      if (
        !sort.field ||
        !sort.field.trim()
      ) {
        errors.push(
          "Search sort field is required."
        );
      }
    }

    if (
      errors.length > 0
    ) {
      throw new SearchValidationError(
        errors
      );
    }

    const page =
      Number.isFinite(
        input.page
      ) &&
      (input.page ?? 0) > 0
        ? Math.floor(
            input.page!
          )
        : 1;

    const limit =
      Number.isFinite(
        input.limit
      ) &&
      (input.limit ?? 0) > 0
        ? Math.min(
            Math.floor(
              input.limit!
            ),
            MAX_SEARCH_LIMIT
          )
        : DEFAULT_SEARCH_LIMIT;

    return {
      ...input,

      query:
        rawQuery.trim(),

      page,

      limit,

      highlight:
        input.highlight ??
        false,
    };
  }

  private validateDocument(
    document: SearchDocument
  ): void {
    const errors: string[] =
      [];

    if (
      !document.id ||
      !document.id.trim()
    ) {
      errors.push(
        "Search document ID is required."
      );
    }

    if (
      errors.length > 0
    ) {
      throw new SearchValidationError(
        errors
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UTILS                                   */
  /* ------------------------------------------------------------------------ */

  private tokenize(
    value: string
  ): string[] {
    return value
      .toLowerCase()
      .split(
        /\s+/
      )
      .map(
        (term) =>
          term.trim()
      )
      .filter(
        Boolean
      );
  }

  private cloneDocument(
    document: SearchDocument
  ): SearchDocument {
    return {
      ...document,

      fields:
        document.fields
          ? {
              ...document.fields,
            }
          : undefined,

      metadata:
        document.metadata
          ? {
              ...document.metadata,
            }
          : undefined,

      createdAt:
        document.createdAt
          ? new Date(
              document.createdAt
            )
          : undefined,

      updatedAt:
        document.updatedAt
          ? new Date(
              document.updatedAt
            )
          : undefined,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                               SEARCH SERVICE                               */
/* -------------------------------------------------------------------------- */

export class SearchService {
  private provider:
    SearchProvider;

  constructor(
    provider: SearchProvider =
      new InMemorySearchProvider()
  ) {
    this.provider =
      provider;
  }

  setProvider(
    provider: SearchProvider
  ): void {
    this.provider =
      provider;
  }

  getProvider(): SearchProvider {
    return this.provider;
  }

  async index(
    document: SearchDocument
  ): Promise<void> {
    await this.provider.index(
      document
    );
  }

  async indexMany(
    documents: SearchDocument[]
  ): Promise<void> {
    await this.provider.indexMany(
      documents
    );
  }

  async remove(
    documentId: string
  ): Promise<void> {
    await this.provider.remove(
      documentId
    );
  }

  async removeMany(
    documentIds: string[]
  ): Promise<void> {
    await this.provider.removeMany(
      documentIds
    );
  }

  async get(
    documentId: string
  ): Promise<
    SearchDocument | undefined
  > {
    return this.provider.get(
      documentId
    );
  }

  async require(
    documentId: string
  ): Promise<SearchDocument> {
    const document =
      await this.get(
        documentId
      );

    if (!document) {
      throw new SearchDocumentNotFoundError(
        documentId
      );
    }

    return document;
  }

  async search(
    query: SearchQuery
  ): Promise<SearchResult> {
    return this.provider.search(
      query
    );
  }

  async suggest(
    query: string,
    limit = 10
  ): Promise<
    SearchSuggestion[]
  > {
    const result =
      await this.search({
        query,

        limit:
          Math.min(
            Math.max(
              1,
              limit
            ),
            MAX_SEARCH_LIMIT
          ),

        highlight:
          false,
      });

    const suggestions =
      new Map<
        string,
        number
      >();

    for (
      const hit of result.hits
    ) {
      const title =
        hit.document.title;

      if (
        !title ||
        !title.trim()
      ) {
        continue;
      }

      const existing =
        suggestions.get(
          title
        ) ?? 0;

      suggestions.set(
        title,
        Math.max(
          existing,
          hit.score
        )
      );
    }

    return Array.from(
      suggestions.entries()
    )
      .map(
        ([
          value,
          score,
        ]) => ({
          value,
          score,
        })
      )
      .sort(
        (a, b) => {
          if (
            b.score !==
            a.score
          ) {
            return (
              b.score -
              a.score
            );
          }

          return a.value.localeCompare(
            b.value
          );
        }
      )
      .slice(
        0,
        limit
      );
  }

  async clear(): Promise<void> {
    await this.provider.clear();
  }
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const searchService =
  new SearchService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function setSearchProvider(
  provider: SearchProvider
): void {
  searchService.setProvider(
    provider
  );
}

export function getSearchProvider(): SearchProvider {
  return searchService.getProvider();
}

export async function indexSearchDocument(
  document: SearchDocument
): Promise<void> {
  await searchService.index(
    document
  );
}

export async function indexSearchDocuments(
  documents: SearchDocument[]
): Promise<void> {
  await searchService.indexMany(
    documents
  );
}

export async function removeSearchDocument(
  documentId: string
): Promise<void> {
  await searchService.remove(
    documentId
  );
}

export async function removeSearchDocuments(
  documentIds: string[]
): Promise<void> {
  await searchService.removeMany(
    documentIds
  );
}

export async function getSearchDocument(
  documentId: string
): Promise<
  SearchDocument | undefined
> {
  return searchService.get(
    documentId
  );
}

export async function requireSearchDocument(
  documentId: string
): Promise<
  SearchDocument
> {
  return searchService.require(
    documentId
  );
}

export async function search(
  query: SearchQuery
): Promise<SearchResult> {
  return searchService.search(
    query
  );
}

export async function searchSuggestions(
  query: string,
  limit = 10
): Promise<
  SearchSuggestion[]
> {
  return searchService.suggest(
    query,
    limit
  );
}

export async function clearSearchIndex(): Promise<void> {
  await searchService.clear();
}

export default searchService;