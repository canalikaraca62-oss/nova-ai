/**
 * SYRAVEN — Search types and validation
 * lib/search/types.ts
 *
 * Phase 10 Step 10.1 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Defines what a caller may ask for. The shape of this type IS a
 * security control: it is deliberately narrow.
 *
 * WHAT IS NOT HERE, AND WHY
 *
 * `services/search.ts` modelled a query as `filters`, `sorts`, `facets`
 * and arbitrary field selection. Every one of those is caller-supplied,
 * so a permission expressed as a filter would be a permission the caller
 * controls. That design cannot be made safe by adding an auth filter to
 * it — the filter would sit in the same list the caller can rewrite.
 *
 * Here, a caller may choose only:
 *
 *   - the text to look for
 *   - which entity types to look in
 *   - how many results, and how far in
 *   - optionally, a workspace/project to NARROW to (proven separately)
 *
 * Identity, tenancy and ownership are NOT part of this type. They come
 * from the verified session at execution time and cannot be named,
 * overridden, or widened by a request.
 *
 * The validation constants are carried over from services/search.ts —
 * the one genuinely reusable part of that file.
 */

import "server-only";

/* -------------------------------------------------------------------------- */
/*                                  LIMITS                                    */
/* -------------------------------------------------------------------------- */

/**
 * Bounds on any single search.
 *
 * `maxOffset` exists to stop deep pagination being used as an
 * enumeration primitive: without it, a caller could walk an unbounded
 * offset to probe how much data exists behind the filter.
 */
export const SEARCH_LIMITS = {
  defaultLimit: 20,
  maxLimit: 50,
  maxOffset: 1_000,

  minQueryLength: 2,
  maxQueryLength: 200,
} as const;

/* -------------------------------------------------------------------------- */
/*                               ENTITY TYPES                                 */
/* -------------------------------------------------------------------------- */

/**
 * Entities that can be searched.
 *
 * Step 10.1 scope. `messages` and `agent_runs` are deliberately absent:
 * their ownership is inferred rather than owned (nullable `user_id` with
 * no FK, and no `user_id` at all, respectively), so they need dedicated
 * isolation tests before they can be searched safely.
 *
 * There is no `documents` entity — no such table exists.
 */
export const SEARCHABLE_ENTITIES = [
  "project",
  "task",
  "knowledge",
] as const;

export type SearchableEntity = (typeof SEARCHABLE_ENTITIES)[number];

export function isSearchableEntity(
  value: unknown,
): value is SearchableEntity {
  return (
    typeof value === "string" &&
    (SEARCHABLE_ENTITIES as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/*                                  REQUEST                                   */
/* -------------------------------------------------------------------------- */

export interface SearchRequest {
  readonly query: string;
  readonly entities: readonly SearchableEntity[];
  readonly limit: number;
  readonly offset: number;

  /**
   * Optional NARROWING scope. Never a widening one.
   *
   * The caller's own rows are the ceiling regardless of what is passed
   * here; naming a workspace can only ever return fewer results, never
   * more. The route must still prove access to it (Phase 3/4 tenant
   * guards) so an unauthorized id is refused rather than silently
   * matching nothing.
   */
  readonly workspaceId: string | null;
  readonly projectId: string | null;
}

export type SearchValidation =
  | { ok: true; request: SearchRequest }
  | { ok: false; reason: string };

/* -------------------------------------------------------------------------- */
/*                                  RESULTS                                   */
/* -------------------------------------------------------------------------- */

export interface SearchHit {
  readonly id: string;
  readonly entity: SearchableEntity;
  readonly title: string;
  /** Short excerpt. Bounded, and drawn only from authorized rows. */
  readonly snippet: string | null;
  readonly score: number;
  readonly updatedAt: string | null;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
}

export interface SearchResults {
  readonly hits: readonly SearchHit[];
  /**
   * Whether more results exist FOR THIS CALLER.
   *
   * Deliberately a boolean, not a total count. An exact total computed
   * before authorization would leak how much data exists behind the
   * filter; even computed after, a precise count across entity types
   * invites inference. "There is more" is what a UI actually needs.
   */
  readonly hasMore: boolean;
  readonly entities: readonly SearchableEntity[];
  /** Entity types that failed to query, so partial results are honest. */
  readonly degraded: readonly SearchableEntity[];
}

/* -------------------------------------------------------------------------- */
/*                                VALIDATION                                  */
/* -------------------------------------------------------------------------- */

/**
 * Escapes PostgREST `ilike` pattern metacharacters.
 *
 * `%` and `_` are wildcards. Left unescaped, a query of `%` matches
 * every row the caller owns — not a cross-tenant leak, but it turns
 * search into a bulk export and makes ranking meaningless.
 *
 * The backslash is escaped FIRST; doing it last would double-escape the
 * escapes introduced for the wildcards.
 */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Removes PostgREST filter syntax from user text.
 *
 * Commas and parentheses are structural in PostgREST's `or=(...)`
 * grammar. A query containing them could otherwise terminate the
 * intended clause and append another — the injection risk specific to
 * this client. They are stripped rather than escaped because no
 * legitimate search term needs them.
 */
export function sanitizeSearchTerm(value: string): string {
  return value.replace(/[(),*]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Validates a raw search request.
 *
 * Refuses rather than coerces where the intent is ambiguous, and clamps
 * only where the intent is clear (a limit of 5,000 obviously means "as
 * many as allowed", while an unknown entity type means the caller is
 * asking for something that does not exist).
 */
export function validateSearchRequest(input: {
  query: unknown;
  entities?: unknown;
  limit?: unknown;
  offset?: unknown;
  workspaceId?: unknown;
  projectId?: unknown;
}): SearchValidation {
  if (typeof input.query !== "string") {
    return { ok: false, reason: "QUERY_REQUIRED" };
  }

  const cleaned = sanitizeSearchTerm(input.query);

  if (cleaned.length < SEARCH_LIMITS.minQueryLength) {
    return { ok: false, reason: "QUERY_TOO_SHORT" };
  }

  if (cleaned.length > SEARCH_LIMITS.maxQueryLength) {
    /*
     * Refused, not truncated. A truncated query silently searches for
     * something other than what was asked.
     */
    return { ok: false, reason: "QUERY_TOO_LONG" };
  }

  /* Entities: absent means all; an unknown value is refused. */
  let entities: SearchableEntity[];

  if (input.entities === undefined || input.entities === null) {
    entities = [...SEARCHABLE_ENTITIES];
  } else {
    const raw = Array.isArray(input.entities)
      ? input.entities
      : [input.entities];

    if (raw.length === 0) {
      return { ok: false, reason: "NO_ENTITIES" };
    }

    for (const candidate of raw) {
      if (!isSearchableEntity(candidate)) {
        return { ok: false, reason: "UNKNOWN_ENTITY" };
      }
    }

    entities = [...new Set(raw as SearchableEntity[])];
  }

  /* Pagination: clamped, because intent is unambiguous. */
  const limit = clampInteger(
    input.limit,
    SEARCH_LIMITS.defaultLimit,
    1,
    SEARCH_LIMITS.maxLimit,
  );

  const offset = clampInteger(input.offset, 0, 0, SEARCH_LIMITS.maxOffset);

  const workspaceId = readOptionalId(input.workspaceId);
  const projectId = readOptionalId(input.projectId);

  return {
    ok: true,
    request: { query: cleaned, entities, limit, offset, workspaceId, projectId },
  };
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function readOptionalId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
