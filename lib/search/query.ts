/**
 * SYRAVEN — Authorization-filtered search execution
 * lib/search/query.ts
 *
 * Phase 10 Step 10.1 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY. This is the highest-risk file in the codebase.
 *
 * WHY SEARCH IS DIFFERENT
 *
 * Every prior phase guarded one resource at a time. Search deliberately
 * reaches across entity types at once and orders the results together.
 * Two failure modes are specific to it:
 *
 *   1. POST-FILTERING. Retrieve broadly, then drop unauthorized rows.
 *      The rows are gone but the evidence is not: counts, "has more",
 *      ranking positions and pagination all still encode the existence
 *      and relevance of records the caller cannot read.
 *
 *   2. CROSS-TENANT RANKING. If relevance is computed over a corpus
 *      spanning tenants, the ORDER leaks other tenants' content even
 *      when every returned row is authorized.
 *
 * THE RULE THIS FILE FOLLOWS
 *
 *   Ownership is applied as a WHERE clause on every query, before the
 *   database has produced a single row. Nothing is filtered afterwards,
 *   because nothing unauthorized is ever fetched.
 *
 * Each entity is queried separately, scored within its own authorized
 * result set, and merged. There is no shared corpus to rank across.
 *
 * DATA ACCESS
 *
 * Every query runs on the CALLER'S RLS-scoped client. There is no
 * service-role path here, and there must never be one: search is
 * precisely where a service-role client would turn one wrong filter
 * into a full-database disclosure.
 *
 * NOTE ON public.projects
 *
 * `projects` has RLS neither enabled nor policied (it was missed by
 * 20260904122000). For `tasks` and `knowledge` the explicit filter is
 * the FIRST of two layers; for `projects` it is currently the ONLY
 * layer. It is written identically for all three so the code does not
 * depend on which — but this is why the filter is not optional, and why
 * the mutation tests treat its removal as critical.
 */

import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";
import {
  escapeLikePattern,
  type SearchHit,
  type SearchRequest,
  type SearchResults,
  type SearchableEntity,
} from "./types";

/* -------------------------------------------------------------------------- */
/*                             ENTITY DEFINITIONS                             */
/* -------------------------------------------------------------------------- */

interface EntityConfig {
  readonly table: string;
  /**
   * Columns selected. Explicit, never `*`.
   *
   * A wildcard select would place whatever a future migration adds —
   * a token, an internal note, an embedding — into search output
   * without anyone deciding it should be searchable.
   */
  readonly columns: readonly string[];
  /** Text columns matched against. Kept narrow deliberately. */
  readonly searchFields: readonly string[];
  readonly titleField: string;
  readonly snippetField: string | null;
  readonly updatedField: string;
  /**
   * Values of `status` that ARE searchable. An allowlist, not a denylist.
   *
   * Archived and deleted content stays retrievable by direct id but must
   * not surface in discovery — otherwise "deleted" means "still findable
   * by anyone who guesses a word in it".
   *
   * Allowlisting matches the Phase 8 retrieval convention
   * (lib/memory/retrieval.ts) and fails safe: a status value added by a
   * future migration is excluded until someone deliberately lists it,
   * whereas a denylist would silently expose it.
   */
  readonly searchableStatuses: readonly string[];
  readonly supportsWorkspace: boolean;
  readonly supportsProject: boolean;
}

/**
 * What each entity exposes to search.
 *
 * Fields are chosen for usefulness AND safety. Notably absent:
 * `metadata` and `result` (jsonb that may hold internal state),
 * `error` (may carry provider or database detail), `file_path`
 * (storage layout), and `embedding`.
 */
const ENTITIES: Readonly<Record<SearchableEntity, EntityConfig>> = {
  project: {
    table: "projects",
    columns: [
      "id",
      "name",
      "description",
      "status",
      "workspace_id",
      "updated_at",
    ],
    searchFields: ["name", "description"],
    titleField: "name",
    snippetField: "description",
    updatedField: "updated_at",
    searchableStatuses: ["draft", "active", "completed"],
    supportsWorkspace: true,
    supportsProject: false,
  },

  task: {
    table: "tasks",
    columns: [
      "id",
      "title",
      "description",
      "status",
      "workspace_id",
      "project_id",
      "updated_at",
    ],
    searchFields: ["title", "description"],
    titleField: "title",
    snippetField: "description",
    updatedField: "updated_at",
    /*
     * Empty ON PURPOSE — the one entity with no status filter.
     *
     * `tasks.status` is a WORKFLOW state (pending, in_progress, done…),
     * not a lifecycle flag: the table has no archived or deleted
     * concept. An allowlist here would silently stop returning tasks as
     * new workflow states are added, which is a correctness bug rather
     * than a safety improvement.
     *
     * If `tasks` ever gains a real lifecycle column, it must be added
     * here — see the `knowledge` entry for the pattern.
     */
    searchableStatuses: [],
    supportsWorkspace: true,
    supportsProject: true,
  },

  knowledge: {
    table: "knowledge",
    columns: [
      "id",
      "title",
      "description",
      "status",
      "workspace_id",
      "project_id",
      "updated_at",
    ],
    /*
     * `content` is intentionally NOT searched in 10.1. Matching full
     * document bodies with ilike is a sequential scan over unbounded
     * text, and returning a snippet from it needs care that belongs
     * with the semantic-search work, not here.
     */
    searchFields: ["title", "description"],
    titleField: "title",
    snippetField: "description",
    updatedField: "updated_at",
    searchableStatuses: ["active"],
    supportsWorkspace: true,
    supportsProject: true,
  },
};

/** Bounds the snippet returned to the caller. */
const MAX_SNIPPET_CHARS = 200;

/* -------------------------------------------------------------------------- */
/*                              TYPED ACCESSOR                                */
/* -------------------------------------------------------------------------- */

/**
 * The subset of the PostgREST builder this module uses.
 *
 * The generated Supabase types require a literal table name, and search
 * necessarily selects its table from a registry at runtime. Rather than
 * spread `any` through the query path, the surface is declared once and
 * the cast is confined to `searchTable()` below — the same pattern used
 * for the billing idempotency store in Phase 6.
 *
 * NOTE: every method here NARROWS a result set. There is deliberately no
 * `or` escape hatch beyond the one text-match clause, and no `rpc`, so
 * this accessor cannot express a query that widens access.
 */
interface SearchQueryBuilder extends PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}> {
  select(columns: string): SearchQueryBuilder;
  eq(column: string, value: string): SearchQueryBuilder;
  in(column: string, values: string[]): SearchQueryBuilder;
  or(filter: string): SearchQueryBuilder;
  order(column: string, options: { ascending: boolean }): SearchQueryBuilder;
  limit(count: number): SearchQueryBuilder;
}

interface SearchCapableClient {
  from(table: string): SearchQueryBuilder;
}

/**
 * Narrows the caller's client to the read-only search surface.
 *
 * The cast is sound because `ENTITIES` names only tables that exist in
 * the schema, and a test asserts each table/column pair is real. It is
 * still the CALLER'S RLS-scoped client — narrowing the TypeScript
 * surface changes no runtime privilege.
 */
function searchTable(
  session: AuthenticatedSession,
  table: string,
): SearchQueryBuilder {
  return (session.supabase as unknown as SearchCapableClient).from(table);
}

/* -------------------------------------------------------------------------- */
/*                                  SCORING                                   */
/* -------------------------------------------------------------------------- */

/**
 * Scores a hit WITHIN its own authorized result set.
 *
 * Deliberately simple and local: it reads only the row's own fields and
 * the query. It never consults corpus-wide statistics — no global term
 * frequency, no cross-entity normalisation — because any such statistic
 * would be computed over rows the caller may not read, and would encode
 * them in the ordering.
 */
export function scoreHit(input: {
  title: string;
  snippet: string | null;
  query: string;
}): number {
  const q = input.query.toLowerCase();
  const title = input.title.toLowerCase();
  const snippet = (input.snippet ?? "").toLowerCase();

  let score = 0;

  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 60;
  else if (title.includes(q)) score += 40;

  if (snippet.includes(q)) score += 10;

  /* Every returned row matched the WHERE clause, so nothing scores 0. */
  return score > 0 ? score : 1;
}

function buildSnippet(value: unknown, query: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  const idx = value.toLowerCase().indexOf(query.toLowerCase());

  if (idx === -1) return value.slice(0, MAX_SNIPPET_CHARS);

  /* Centre the window on the match, clamped to the string. */
  const start = Math.max(0, idx - 60);

  return (
    (start > 0 ? "…" : "") +
    value.slice(start, start + MAX_SNIPPET_CHARS).trim()
  );
}

/* -------------------------------------------------------------------------- */
/*                              QUERY EXECUTION                               */
/* -------------------------------------------------------------------------- */

/**
 * Builds the PostgREST `or` clause for a text match.
 *
 * The term is escaped for `ilike` wildcards, and the caller's text has
 * already had PostgREST structural characters stripped by
 * `sanitizeSearchTerm`. Both are required: escaping alone would leave
 * commas able to terminate the clause.
 */
export function buildTextMatch(
  fields: readonly string[],
  query: string,
): string {
  const pattern = `*${escapeLikePattern(query)}*`;

  return fields.map((f) => `${f}.ilike.${pattern}`).join(",");
}

async function searchEntity(
  session: AuthenticatedSession,
  entity: SearchableEntity,
  request: SearchRequest,
): Promise<{ ok: true; hits: SearchHit[] } | { ok: false }> {
  const config = ENTITIES[entity];

  /*
   * AUTHORIZATION — applied here, as part of the query.
   *
   * `.eq("user_id", …)` is the first statement in the chain, not an
   * afterthought appended later. The database never produces a row this
   * caller does not own, so there is nothing to filter out afterwards
   * and nothing unauthorized can reach counts, ranking or snippets.
   */
  let query = searchTable(session, config.table)
    .select(config.columns.join(", "))
    .eq("user_id", session.userId);

  /* Text match, over a narrow set of safe fields. */
  query = query.or(buildTextMatch(config.searchFields, request.query));

  /*
   * LIFECYCLE FILTER — allowlist.
   *
   * Only statuses explicitly declared searchable are returned, so
   * archived and deleted content cannot surface in discovery. An empty
   * list means the entity has no lifecycle concept (see `task`) and is
   * the one case where no status filter applies.
   */
  if (config.searchableStatuses.length > 0) {
    query = query.in("status", [...config.searchableStatuses]);
  }

  /*
   * Optional NARROWING. These only ever reduce the result set — the
   * ownership filter above is already applied, so a workspace id cannot
   * widen access. The route proves the caller can reach them.
   */
  if (request.workspaceId !== null && config.supportsWorkspace) {
    query = query.eq("workspace_id", request.workspaceId);
  }

  if (request.projectId !== null && config.supportsProject) {
    query = query.eq("project_id", request.projectId);
  }

  /*
   * Fetch one extra row to determine `hasMore` without a count.
   *
   * A COUNT would be computed over the same authorized set and so would
   * be safe, but it is a second aggregate over the same scan for
   * information the UI does not need precisely.
   */
  const window = request.offset + request.limit + 1;

  query = query
    .order(config.updatedField, { ascending: false })
    .limit(Math.min(window, 200));

  const { data, error } = await query;

  if (error) {
    /*
     * Logged, never surfaced: a database message can carry column names
     * and constraint details. The caller is told only that this entity
     * type degraded.
     */
    console.error("SYRAVEN SEARCH: entity query failed.", {
      entity,
      userId: session.userId,
      error: error.message,
    });

    return { ok: false };
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const hits = rows.map((row): SearchHit => {
    const title = String(row[config.titleField] ?? "");

    const snippet = config.snippetField
      ? buildSnippet(row[config.snippetField], request.query)
      : null;

    return {
      id: String(row.id),
      entity,
      title,
      snippet,
      score: scoreHit({ title, snippet, query: request.query }),
      updatedAt:
        typeof row[config.updatedField] === "string"
          ? (row[config.updatedField] as string)
          : null,
      workspaceId:
        typeof row.workspace_id === "string" ? row.workspace_id : null,
      projectId: typeof row.project_id === "string" ? row.project_id : null,
    };
  });

  return { ok: true, hits };
}

/* -------------------------------------------------------------------------- */
/*                                   SEARCH                                   */
/* -------------------------------------------------------------------------- */

/**
 * Runs an authorization-filtered search.
 *
 * Each entity is queried independently against the caller's own rows,
 * scored within that set, then merged. The merge sorts already-authorized
 * hits — it is presentation, not filtering.
 */
export async function search(
  session: AuthenticatedSession,
  request: SearchRequest,
): Promise<SearchResults> {
  const settled = await Promise.all(
    request.entities.map(async (entity) => ({
      entity,
      result: await searchEntity(session, entity, request),
    })),
  );

  const hits: SearchHit[] = [];
  const degraded: SearchableEntity[] = [];

  for (const { entity, result } of settled) {
    if (result.ok) hits.push(...result.hits);
    else degraded.push(entity);
  }

  /*
   * Merge ordering. Every hit here is already authorized, so this
   * decides presentation only — it cannot expose anything, because
   * there is nothing unauthorized in the list to expose.
   */
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const at = a.updatedAt ?? "";
    const bt = b.updatedAt ?? "";
    if (at !== bt) return bt.localeCompare(at);

    /* Stable tie-break so pagination does not reshuffle. */
    return a.id.localeCompare(b.id);
  });

  const page = hits.slice(request.offset, request.offset + request.limit);

  return {
    hits: page,
    hasMore: hits.length > request.offset + request.limit,
    entities: request.entities,
    degraded,
  };
}
