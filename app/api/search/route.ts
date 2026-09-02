/**
 * SYRAVEN Search API
 *
 * Enterprise-grade global search endpoint.
 *
 * Features:
 * - Query validation
 * - Pagination
 * - Result limits
 * - Type filtering
 * - Safe error handling
 * - Request normalization
 * - Dynamic Next.js route
 * - Production-ready response format
 *
 * GET /api/search?q=hello
 */

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/*                               ROUTE CONFIG                                 */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type SearchEntityType =
  | "project"
  | "task"
  | "message"
  | "document"
  | "knowledge"
  | "user"
  | "file"
  | "all";

interface SearchResult {
  id: string;
  type: Exclude<SearchEntityType, "all">;
  title: string;
  description?: string;
  url?: string;
  score?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface SearchResponse {
  success: true;
  query: string;
  type: SearchEntityType;
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  meta: {
    tookMs: number;
    timestamp: string;
  };
}

interface SearchErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 500;

const ALLOWED_TYPES = new Set<SearchEntityType>([
  "project",
  "task",
  "message",
  "document",
  "knowledge",
  "user",
  "file",
  "all",
]);

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

class SearchApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 400,
    code = "SEARCH_ERROR"
  ) {
    super(message);

    this.name = "SearchApiError";
    this.status = status;
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*                              VALIDATION HELPERS                            */
/* -------------------------------------------------------------------------- */

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max?: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  if (max !== undefined) {
    return Math.min(parsed, max);
  }

  return parsed;
}

function normalizeQuery(
  value: string | null
): string {
  const query = value?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    throw new SearchApiError(
      "Search query is required.",
      400,
      "INVALID_QUERY"
    );
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new SearchApiError(
      `Search query cannot exceed ${MAX_QUERY_LENGTH} characters.`,
      400,
      "QUERY_TOO_LONG"
    );
  }

  return query;
}

function normalizeType(
  value: string | null
): SearchEntityType {
  if (!value) {
    return "all";
  }

  const normalized = value
    .trim()
    .toLowerCase() as SearchEntityType;

  if (!ALLOWED_TYPES.has(normalized)) {
    throw new SearchApiError(
      "Invalid search type.",
      400,
      "INVALID_SEARCH_TYPE"
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/*                              RESPONSE HELPERS                              */
/* -------------------------------------------------------------------------- */

function createErrorResponse(
  error: unknown
): NextResponse<SearchErrorResponse> {
  if (error instanceof SearchApiError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      {
        status: error.status,
      }
    );
  }

  console.error(
    "[SEARCH_API_ERROR]",
    error
  );

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          "An unexpected error occurred while processing the search request.",
      },
    },
    {
      status: 500,
    }
  );
}

/* -------------------------------------------------------------------------- */
/*                              SEARCH SERVICE                                */
/* -------------------------------------------------------------------------- */

/**
 * Temporary search adapter.
 *
 * Replace this implementation later with your actual
 * database / Supabase / vector / knowledge search layer.
 *
 * This function intentionally returns an empty array instead
 * of inventing data.
 */
async function executeSearch(
  _input: {
    query: string;
    type: SearchEntityType;
    page: number;
    limit: number;
  }
): Promise<{
  results: SearchResult[];
  total: number;
}> {
  /*
   * Future integration example:
   *
   * import { search } from "@/services/search";
   *
   * return search({
   *   query: input.query,
   *   type: input.type,
   *   page: input.page,
   *   limit: input.limit,
   * });
   */

  return {
    results: [],
    total: 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    GET                                     */
/* -------------------------------------------------------------------------- */

export async function GET(
  request: NextRequest
): Promise<
  NextResponse<
    SearchResponse | SearchErrorResponse
  >
> {
  const startedAt = Date.now();

  try {
    const searchParams =
      request.nextUrl.searchParams;

    const query = normalizeQuery(
      searchParams.get("q") ??
        searchParams.get("query")
    );

    const type = normalizeType(
      searchParams.get("type")
    );

    const page = parsePositiveInteger(
      searchParams.get("page"),
      DEFAULT_PAGE
    );

    const limit = parsePositiveInteger(
      searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const searchResult =
      await executeSearch({
        query,
        type,
        page,
        limit,
      });

    const totalPages =
      searchResult.total === 0
        ? 0
        : Math.ceil(
            searchResult.total / limit
          );

    const response: SearchResponse = {
      success: true,

      query,

      type,

      results:
        searchResult.results,

      pagination: {
        page,
        limit,

        total:
          searchResult.total,

        totalPages,

        hasNextPage:
          totalPages > 0 &&
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },

      meta: {
        tookMs:
          Date.now() - startedAt,

        timestamp:
          new Date().toISOString(),
      },
    };

    return NextResponse.json(
      response,
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return createErrorResponse(
      error
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                  OPTIONS                                   */
/* -------------------------------------------------------------------------- */

export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
    },
  });
}