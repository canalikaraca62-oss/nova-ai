/**
 * SYRAVEN Search API
 * app/api/search/route.ts
 *
 * Phase 10 Step 10.2 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * GET /api/search?q=hello
 *
 * WHAT CHANGED IN 10.2
 *
 * This route previously returned a hardcoded empty array. It is now
 * backed by lib/search, which filters by ownership AT QUERY TIME.
 *
 * Three things the old shell got wrong for a real implementation, and
 * why they are not carried forward:
 *
 *   1. `ALLOWED_TYPES` accepted `message`, `document`, `user` and
 *      `file`. Those are NOT searchable: `messages` has a nullable
 *      `user_id` with no FK, `agent_runs` has no owner column at all,
 *      and no `documents` table exists. Accepting them while returning
 *      nothing would be a promise the system cannot keep; they are
 *      refused explicitly instead.
 *
 *   2. `pagination.total` exposed an exact count. A precise total
 *      invites inference about rows behind the filter, so the response
 *      reports `hasMore` instead.
 *
 *   3. Pagination was page-based over an unbounded page number. Deep
 *      pagination is an enumeration primitive, so it is converted to a
 *      bounded offset by lib/search.
 *
 * WHAT THE CALLER MAY DECIDE
 *
 *   the query text, which entity types, pagination, and an optional
 *   workspace/project to NARROW to (proven by the tenant guards).
 *
 * WHAT THE CALLER MAY NOT DECIDE
 *
 *   identity, ownership, tenancy, or which rows are visible. Those come
 *   from the verified session and the database.
 */

import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import {
  requireOptionalProjectAccess,
  requireOptionalWorkspaceAccess,
} from "@/lib/api/tenantGuard";
import { checkRateLimit, recordRateLimitEvent } from "@/lib/usage/meter";
import { search } from "@/lib/search/query";
import {
  SEARCHABLE_ENTITIES,
  type SearchableEntity,
  validateSearchRequest,
} from "@/lib/search/types";

/* -------------------------------------------------------------------------- */
/*                               ROUTE CONFIG                                 */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

interface SearchResultItem {
  id: string;
  type: SearchableEntity;
  title: string;
  snippet: string | null;
  score: number;
  updatedAt: string | null;
}

interface SearchResponse {
  success: true;
  query: string;
  types: readonly SearchableEntity[];
  results: SearchResultItem[];
  pagination: {
    limit: number;
    offset: number;
    /*
     * Deliberately NOT an exact total. See the header note: a precise
     * count is an inference channel about rows the caller cannot read.
     */
    hasMore: boolean;
  };
  meta: {
    tookMs: number;
    timestamp: string;
    /** Entity types that failed to query, so partial results are honest. */
    degraded: readonly SearchableEntity[];
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
/*                              RESPONSE HELPERS                              */
/* -------------------------------------------------------------------------- */

function errorResponse(
  code: string,
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): NextResponse<SearchErrorResponse> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...extraHeaders,
      },
    },
  );
}

/**
 * Maps a validation reason to a caller-safe message.
 *
 * The reason codes are stable and safe to expose — they describe the
 * REQUEST, never the data. `UNKNOWN_ENTITY` deliberately does not name
 * which types exist beyond the supported set.
 */
function validationMessage(reason: string): string {
  switch (reason) {
    case "QUERY_REQUIRED":
      return "A search query is required.";
    case "QUERY_TOO_SHORT":
      return "The search query is too short.";
    case "QUERY_TOO_LONG":
      return "The search query is too long.";
    case "NO_ENTITIES":
      return "At least one search type is required.";
    case "UNKNOWN_ENTITY":
      return `Supported search types are: ${SEARCHABLE_ENTITIES.join(", ")}.`;
    default:
      return "The search request is invalid.";
  }
}

/**
 * Reads the requested entity types from the query string.
 *
 * `type=all` and an absent parameter both mean "every SUPPORTED type" —
 * which is the three from Step 10.1, not the wider set the previous
 * shell advertised. Anything else is passed through to the validator,
 * which refuses unknown values rather than ignoring them.
 */
function readEntities(raw: string | null): unknown {
  if (raw === null) return undefined;

  const trimmed = raw.trim().toLowerCase();

  if (trimmed.length === 0 || trimmed === "all") return undefined;

  return trimmed.split(",").map((t) => t.trim());
}

/* -------------------------------------------------------------------------- */
/*                                    GET                                     */
/* -------------------------------------------------------------------------- */

export const GET = withAuth(async (request, session) => {
  const startedAt = Date.now();

  try {
    const params = request.nextUrl.searchParams;

    /* ---------------------------------------------------------------- */
    /* 1. Rate limit — before any database work                          */
    /* ---------------------------------------------------------------- */

    /*
     * Search is rate limited but NOT quota metered: it calls no paid
     * provider, so charging it against a plan allowance would be wrong.
     * The limit is here because search is cheap to issue, expensive to
     * serve, and the natural surface for term-by-term probing.
     */
    const limit = await checkRateLimit(
      session.supabase,
      session.userId,
      "search:query",
    );

    if (!limit.allowed) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many search requests. Please slow down.",
        429,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    /* ---------------------------------------------------------------- */
    /* 2. Validate — bounds, entity allowlist, injection-safe text       */
    /* ---------------------------------------------------------------- */

    const validation = validateSearchRequest({
      query: params.get("q") ?? params.get("query"),
      entities: readEntities(params.get("type")),
      limit: params.get("limit"),
      offset: params.get("offset"),
      workspaceId: params.get("workspaceId"),
      projectId: params.get("projectId"),
    });

    if (!validation.ok) {
      return errorResponse(
        validation.reason,
        validationMessage(validation.reason),
        400,
      );
    }

    const searchRequest = validation.request;

    /* ---------------------------------------------------------------- */
    /* 3. Tenancy — PROVEN, never taken from the query string            */
    /* ---------------------------------------------------------------- */

    /*
     * A workspace/project id can only NARROW results — ownership is
     * already filtered in every query. It is still proven here so an
     * unauthorized id is refused outright rather than silently matching
     * nothing, which would let a caller probe for existence by
     * distinguishing "no access" from "no results".
     */
    const workspaceAccess = await requireOptionalWorkspaceAccess(
      session,
      searchRequest.workspaceId,
    );

    if (workspaceAccess?.denied) {
      return workspaceAccess.response;
    }

    const projectAccess = await requireOptionalProjectAccess(
      session,
      searchRequest.projectId,
    );

    if (projectAccess?.denied) {
      return projectAccess.response;
    }

    /* ---------------------------------------------------------------- */
    /* 4. Search — ownership filtered at query time (lib/search)         */
    /* ---------------------------------------------------------------- */

    const results = await search(session, searchRequest);

    /* Recorded after the work is admitted, so refusals do not count. */
    await recordRateLimitEvent(
      session.supabase,
      session.userId,
      "search:query",
    );

    const response: SearchResponse = {
      success: true,
      query: searchRequest.query,
      types: searchRequest.entities,

      results: results.hits.map((hit) => ({
        id: hit.id,
        type: hit.entity,
        title: hit.title,
        snippet: hit.snippet,
        score: hit.score,
        updatedAt: hit.updatedAt,
      })),

      pagination: {
        limit: searchRequest.limit,
        offset: searchRequest.offset,
        hasMore: results.hasMore,
      },

      meta: {
        tookMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        degraded: results.degraded,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        /*
         * Private: results are caller-specific by construction, so a
         * shared cache holding them would serve one user's rows to
         * another.
         */
        "Cache-Control": "private, no-store",
        Vary: "Authorization, Cookie",
      },
    });
  } catch (error) {
    /*
     * Logged, never surfaced: a database or provider message can carry
     * column names and constraint details.
     */
    console.error("[SYRAVEN_SEARCH_API_ERROR]", {
      userId: session.userId,
      name: error instanceof Error ? error.name : "unknown",
    });

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred while processing the search request.",
      500,
    );
  }
});

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
