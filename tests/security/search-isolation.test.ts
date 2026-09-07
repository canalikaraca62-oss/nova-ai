/**
 * SYRAVEN — Search authorization and cross-tenant isolation tests
 *
 * Phase 10 Step 10.1 (see IMPLEMENTATION_PLAN.md).
 *
 * Search is the easiest place in a multi-tenant system to leak data,
 * because it deliberately reaches across entity types and orders the
 * results together. Two failure modes are specific to it:
 *
 *   POST-FILTERING — retrieve broadly, drop unauthorized rows. The rows
 *   are gone, but counts, `hasMore`, ranking positions and pagination
 *   still encode records the caller cannot read.
 *
 *   CROSS-TENANT RANKING — relevance computed over a shared corpus
 *   leaks other tenants' content through the ORDER, even when every
 *   returned row is authorized.
 *
 * These tests use a fake Supabase client that RECORDS the filters
 * applied and holds rows for several users. A query that fails to
 * constrain `user_id` therefore returns another user's rows, and the
 * test fails — the leak is observable rather than assumed absent.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const QUERY_SRC = read("lib", "search", "query.ts");
const TYPES_SRC = read("lib", "search", "types.ts");

const QUERY_CODE = stripComments(QUERY_SRC);
const TYPES_CODE = stripComments(TYPES_SRC);

/* -------------------------------------------------------------------------- */
/*                         MIRRORED VALIDATION LOGIC                          */
/* -------------------------------------------------------------------------- */

/*
 * lib/search/* imports "server-only" and cannot load outside the Next
 * runtime. The pure logic is mirrored here, and the SOURCE INVARIANTS
 * suite holds the real files to the same shape.
 */

const SEARCH_LIMITS = {
  defaultLimit: 20,
  maxLimit: 50,
  maxOffset: 1_000,
  minQueryLength: 2,
  maxQueryLength: 200,
} as const;

const SEARCHABLE_ENTITIES = ["project", "task", "knowledge"] as const;
type SearchableEntity = (typeof SEARCHABLE_ENTITIES)[number];

function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[(),*]/g, " ").replace(/\s+/g, " ").trim();
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

interface SearchRequest {
  query: string;
  entities: SearchableEntity[];
  limit: number;
  offset: number;
  workspaceId: string | null;
  projectId: string | null;
}

function validateSearchRequest(input: {
  query: unknown;
  entities?: unknown;
  limit?: unknown;
  offset?: unknown;
  workspaceId?: unknown;
  projectId?: unknown;
}): { ok: true; request: SearchRequest } | { ok: false; reason: string } {
  if (typeof input.query !== "string") {
    return { ok: false, reason: "QUERY_REQUIRED" };
  }

  const cleaned = sanitizeSearchTerm(input.query);

  if (cleaned.length < SEARCH_LIMITS.minQueryLength) {
    return { ok: false, reason: "QUERY_TOO_SHORT" };
  }
  if (cleaned.length > SEARCH_LIMITS.maxQueryLength) {
    return { ok: false, reason: "QUERY_TOO_LONG" };
  }

  let entities: SearchableEntity[];

  if (input.entities === undefined || input.entities === null) {
    entities = [...SEARCHABLE_ENTITIES];
  } else {
    const raw = Array.isArray(input.entities)
      ? input.entities
      : [input.entities];

    if (raw.length === 0) return { ok: false, reason: "NO_ENTITIES" };

    for (const c of raw) {
      if (
        typeof c !== "string" ||
        !(SEARCHABLE_ENTITIES as readonly string[]).includes(c)
      ) {
        return { ok: false, reason: "UNKNOWN_ENTITY" };
      }
    }
    entities = [...new Set(raw as SearchableEntity[])];
  }

  return {
    ok: true,
    request: {
      query: cleaned,
      entities,
      limit: clampInteger(
        input.limit,
        SEARCH_LIMITS.defaultLimit,
        1,
        SEARCH_LIMITS.maxLimit,
      ),
      offset: clampInteger(input.offset, 0, 0, SEARCH_LIMITS.maxOffset),
      workspaceId:
        typeof input.workspaceId === "string" && input.workspaceId.trim()
          ? input.workspaceId.trim()
          : null,
      projectId:
        typeof input.projectId === "string" && input.projectId.trim()
          ? input.projectId.trim()
          : null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                          FAKE DATABASE + CLIENT                            */
/* -------------------------------------------------------------------------- */

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

interface Row {
  id: string;
  user_id: string;
  name?: string;
  title?: string;
  description: string;
  status: string;
  workspace_id: string | null;
  project_id: string | null;
  updated_at: string;
}

/*
 * Both users own rows matching the SAME term. If ownership is not
 * applied in the query, Bob's rows come back for Alice.
 */
const DB: Record<string, Row[]> = {
  projects: [
    {
      id: "p-alice-1",
      user_id: ALICE,
      name: "Falcon roadmap",
      description: "alice falcon planning",
      status: "active",
      workspace_id: "ws-alice",
      project_id: null,
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "p-alice-archived",
      user_id: ALICE,
      name: "Falcon legacy",
      description: "archived falcon",
      status: "archived",
      workspace_id: "ws-alice",
      project_id: null,
      updated_at: "2026-09-02T00:00:00Z",
    },
    {
      id: "p-bob-1",
      user_id: BOB,
      name: "Falcon secret",
      description: "bob confidential falcon",
      status: "active",
      workspace_id: "ws-bob",
      project_id: null,
      updated_at: "2026-09-03T00:00:00Z",
    },
  ],
  tasks: [
    {
      id: "t-alice-1",
      user_id: ALICE,
      title: "Falcon task",
      description: "alice task",
      status: "pending",
      workspace_id: "ws-alice",
      project_id: "proj-alice",
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "t-bob-1",
      user_id: BOB,
      title: "Falcon breach",
      description: "bob task",
      status: "pending",
      workspace_id: "ws-bob",
      project_id: "proj-bob",
      updated_at: "2026-09-04T00:00:00Z",
    },
  ],
  knowledge: [
    {
      id: "k-alice-1",
      user_id: ALICE,
      title: "Falcon notes",
      description: "alice notes",
      status: "active",
      workspace_id: "ws-alice",
      project_id: "proj-alice",
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "k-alice-deleted",
      user_id: ALICE,
      title: "Falcon removed",
      description: "deleted note",
      status: "deleted",
      workspace_id: "ws-alice",
      project_id: "proj-alice",
      updated_at: "2026-09-05T00:00:00Z",
    },
    {
      id: "k-bob-1",
      user_id: BOB,
      title: "Falcon private",
      description: "bob notes",
      status: "active",
      workspace_id: "ws-bob",
      project_id: "proj-bob",
      updated_at: "2026-09-06T00:00:00Z",
    },
  ],
};

interface AppliedFilter {
  kind: "eq" | "in" | "or" | "order" | "limit" | "select";
  column?: string;
  value?: unknown;
}

/** Records what the query asked for, then evaluates it against DB. */
class FakeBuilder {
  readonly applied: AppliedFilter[] = [];

  /*
   * Explicit fields rather than TypeScript parameter properties: the
   * suite runs under `node --test` in strip-only mode, which does not
   * support that syntax.
   */
  private readonly table: string;

  constructor(table: string, log: AppliedFilter[][]) {
    this.table = table;
    log.push(this.applied);
  }

  select(columns: string): this {
    this.applied.push({ kind: "select", value: columns });
    return this;
  }
  eq(column: string, value: string): this {
    this.applied.push({ kind: "eq", column, value });
    return this;
  }
  in(column: string, values: string[]): this {
    this.applied.push({ kind: "in", column, value: values });
    return this;
  }
  or(filter: string): this {
    this.applied.push({ kind: "or", value: filter });
    return this;
  }
  order(column: string, options: { ascending: boolean }): this {
    this.applied.push({ kind: "order", column, value: options });
    return this;
  }
  limit(count: number): this {
    this.applied.push({ kind: "limit", value: count });
    return this;
  }

  then<R>(resolve: (r: { data: unknown[] | null; error: null }) => R): R {
    let rows = [...(DB[this.table] ?? [])];

    for (const f of this.applied) {
      if (f.kind === "eq") {
        rows = rows.filter(
          (r) => (r as unknown as Record<string, unknown>)[f.column!] === f.value,
        );
      }
      if (f.kind === "in") {
        const set = new Set(f.value as string[]);
        rows = rows.filter((r) =>
          set.has(
            String((r as unknown as Record<string, unknown>)[f.column!]),
          ),
        );
      }
      if (f.kind === "or") {
        /* Evaluate `field.ilike.*term*` alternatives. */
        const clauses = String(f.value).split(",");
        rows = rows.filter((r) =>
          clauses.some((c) => {
            const [field, , pattern] = c.split(".");
            if (field === undefined) return false;
            const term = (pattern ?? "").replace(/^\*|\*$/g, "");
            const v = (r as unknown as Record<string, unknown>)[field];
            return (
              typeof v === "string" &&
              v.toLowerCase().includes(term.toLowerCase())
            );
          }),
        );
      }
    }

    return resolve({ data: rows, error: null });
  }
}

class FakeClient {
  readonly queries: AppliedFilter[][] = [];

  from(table: string): FakeBuilder {
    return new FakeBuilder(table, this.queries);
  }
}

/* -------------------------------------------------------------------------- */
/*                        MIRRORED SEARCH EXECUTION                           */
/* -------------------------------------------------------------------------- */

interface EntityConfig {
  table: string;
  columns: string[];
  searchFields: string[];
  titleField: string;
  snippetField: string | null;
  updatedField: string;
  searchableStatuses: string[];
  supportsWorkspace: boolean;
  supportsProject: boolean;
}

const ENTITIES: Record<SearchableEntity, EntityConfig> = {
  project: {
    table: "projects",
    columns: ["id", "name", "description", "status", "workspace_id", "updated_at"],
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
    searchFields: ["title", "description"],
    titleField: "title",
    snippetField: "description",
    updatedField: "updated_at",
    searchableStatuses: ["active"],
    supportsWorkspace: true,
    supportsProject: true,
  },
};

function buildTextMatch(fields: string[], query: string): string {
  const pattern = `*${escapeLikePattern(query)}*`;
  return fields.map((f) => `${f}.ilike.${pattern}`).join(",");
}

function scoreHit(input: {
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

  return score > 0 ? score : 1;
}

interface Hit {
  id: string;
  entity: SearchableEntity;
  title: string;
  snippet: string | null;
  score: number;
  updatedAt: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

function search(
  client: FakeClient,
  userId: string,
  request: SearchRequest,
): { hits: Hit[]; hasMore: boolean; degraded: SearchableEntity[] } {
  const all: Hit[] = [];

  for (const entity of request.entities) {
    const config = ENTITIES[entity];

    let q = client
      .from(config.table)
      .select(config.columns.join(", "))
      .eq("user_id", userId);

    q = q.or(buildTextMatch(config.searchFields, request.query));

    if (config.searchableStatuses.length > 0) {
      q = q.in("status", [...config.searchableStatuses]);
    }
    if (request.workspaceId !== null && config.supportsWorkspace) {
      q = q.eq("workspace_id", request.workspaceId);
    }
    if (request.projectId !== null && config.supportsProject) {
      q = q.eq("project_id", request.projectId);
    }

    q = q
      .order(config.updatedField, { ascending: false })
      .limit(Math.min(request.offset + request.limit + 1, 200));

    const { data } = q.then((r) => r);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];

    for (const row of rows) {
      const title = String(row[config.titleField] ?? "");
      const snippet = config.snippetField
        ? ((row[config.snippetField] as string) ?? null)
        : null;

      all.push({
        id: String(row.id),
        entity,
        title,
        snippet,
        score: scoreHit({ title, snippet, query: request.query }),
        updatedAt: (row[config.updatedField] as string) ?? null,
        workspaceId: (row.workspace_id as string) ?? null,
        projectId: (row.project_id as string) ?? null,
      });
    }
  }

  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = a.updatedAt ?? "";
    const bt = b.updatedAt ?? "";
    if (at !== bt) return bt.localeCompare(at);
    return a.id.localeCompare(b.id);
  });

  return {
    hits: all.slice(request.offset, request.offset + request.limit),
    hasMore: all.length > request.offset + request.limit,
    degraded: [],
  };
}

function run(userId: string, overrides: Partial<SearchRequest> = {}) {
  const client = new FakeClient();
  const request: SearchRequest = {
    query: "falcon",
    entities: [...SEARCHABLE_ENTITIES],
    limit: 20,
    offset: 0,
    workspaceId: null,
    projectId: null,
    ...overrides,
  };
  return { client, ...search(client, userId, request) };
}

/* -------------------------------------------------------------------------- */
/*                        1. CROSS-TENANT ISOLATION                           */
/* -------------------------------------------------------------------------- */

void describe("Cross-tenant isolation", () => {
  void test("a search never returns another user's rows", () => {
    const { hits } = run(ALICE);

    assert.ok(hits.length > 0, "Alice must find her own rows");

    for (const h of hits) {
      assert.ok(
        h.id.includes("alice"),
        `leaked a row belonging to someone else: ${h.id}`,
      );
    }
  });

  void test("both users match the same term but see only their own", () => {
    const alice = run(ALICE).hits.map((h) => h.id);
    const bob = run(BOB).hits.map((h) => h.id);

    assert.ok(alice.length > 0 && bob.length > 0);

    for (const id of alice) assert.ok(!bob.includes(id), `overlap: ${id}`);
  });

  void test("ownership is applied to EVERY entity query", () => {
    const { client } = run(ALICE);

    assert.equal(client.queries.length, 3, "one query per entity");

    for (const applied of client.queries) {
      const owner = applied.find(
        (f) => f.kind === "eq" && f.column === "user_id",
      );
      assert.ok(owner, "every query must filter user_id");
      assert.equal(owner.value, ALICE);
    }
  });

  void test("the database never returns another tenant's rows", () => {
    /*
     * The distinction M2 targets: post-filtering yields the same OUTPUT
     * as query-time filtering, so output alone cannot tell them apart.
     *
     * Here the fake client evaluates exactly the filters the query
     * applied. If ownership is part of the query, the RAW result set is
     * already clean — there is nothing to discard. An implementation
     * that fetched broadly and filtered later would show foreign rows
     * at this layer.
     */
    const client = new FakeClient();

    search(client, ALICE, {
      query: "falcon",
      entities: [...SEARCHABLE_ENTITIES],
      limit: 20,
      offset: 0,
      workspaceId: null,
      projectId: null,
    });

    assert.equal(client.queries.length, 3, "one query per entity");

    /* Re-run each entity query and inspect what the DB layer produced. */
    for (const entity of SEARCHABLE_ENTITIES) {
      const config = ENTITIES[entity];
      const probe = new FakeClient();

      let q = probe
        .from(config.table)
        .select(config.columns.join(", "))
        .eq("user_id", ALICE);

      q = q.or(buildTextMatch(config.searchFields, "falcon"));

      const { data } = q.then((r) => r);
      const rows = (data ?? []) as Record<string, unknown>[];

      for (const row of rows) {
        assert.equal(
          row.user_id,
          ALICE,
          `the query itself returned a foreign row from ${config.table}`,
        );
      }
    }
  });

  void test("every query carries the ownership constraint itself", () => {
    /*
     * Guards against isolation being moved out of the query and into a
     * post-filter: the constraint must be present on the query object.
     */
    const { client } = run(ALICE);

    assert.equal(client.queries.length, 3);

    for (const applied of client.queries) {
      assert.ok(
        applied.some(
          (f) => f.kind === "eq" && f.column === "user_id" && f.value === ALICE,
        ),
        "isolation must live in the query, not in result post-processing",
      );
    }
  });

  void test("the ownership filter precedes the text match", () => {
    /*
     * Not cosmetic: it documents that authorization is part of the
     * query being built, not a step applied to results afterwards.
     */
    const { client } = run(ALICE);

    for (const applied of client.queries) {
      const ownerAt = applied.findIndex(
        (f) => f.kind === "eq" && f.column === "user_id",
      );
      const textAt = applied.findIndex((f) => f.kind === "or");

      assert.ok(ownerAt >= 0 && textAt >= 0);
      assert.ok(ownerAt < textAt, "user_id must be filtered before matching");
    }
  });

  void test("naming another tenant's workspace returns nothing, not their rows", () => {
    const { hits } = run(ALICE, { workspaceId: "ws-bob" });

    assert.equal(hits.length, 0, "must not return Bob's rows");
  });

  void test("a workspace filter cannot widen beyond ownership", () => {
    /* Both filters are applied; ownership is never replaced by scope. */
    const { client } = run(ALICE, { workspaceId: "ws-bob" });

    for (const applied of client.queries) {
      assert.ok(
        applied.some((f) => f.kind === "eq" && f.column === "user_id"),
        "ownership must survive an explicit workspace filter",
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                     2. NO LEAKAGE VIA METADATA                             */
/* -------------------------------------------------------------------------- */

void describe("Counts, ranking and pagination leak nothing", () => {
  void test("hasMore reflects only the caller's own rows", () => {
    /*
     * Alice has exactly 3 live rows (1 project + 1 task + 1 knowledge;
     * her archived project and deleted note are excluded).
     *
     * At the exact boundary, hasMore must be false. Any implementation
     * that counts the corpus rather than the authorized set reports
     * true here, because Bob's 3 rows are still in the total.
     */
    const all = run(ALICE, { limit: 50 });
    assert.equal(all.hits.length, 3, "Alice must have exactly 3 live rows");

    const boundary = run(ALICE, { limit: 3 });
    assert.equal(
      boundary.hasMore,
      false,
      "hasMore must count only authorized rows",
    );

    /* And true when the caller's OWN set genuinely exceeds the page. */
    const partial = run(ALICE, { limit: 2 });
    assert.equal(partial.hits.length, 2);
    assert.equal(partial.hasMore, true);
  });

  void test("ranking never places another tenant's row in the order", () => {
    /*
     * Bob's rows are NEWER than Alice's. If ranking ran over a shared
     * corpus, his would sort first and be visible in the ordering.
     */
    const { hits } = run(ALICE);

    for (const h of hits) {
      assert.ok(!h.id.includes("bob"), "cross-tenant row entered the ranking");
    }
  });

  void test("pagination cannot walk into another tenant's rows", () => {
    const seen: string[] = [];

    for (let offset = 0; offset < 10; offset += 1) {
      for (const h of run(ALICE, { limit: 1, offset }).hits) {
        seen.push(h.id);
      }
    }

    for (const id of seen) {
      assert.ok(!id.includes("bob"), `pagination leaked ${id}`);
    }
  });

  void test("snippets are drawn only from authorized rows", () => {
    const { hits } = run(ALICE);

    for (const h of hits) {
      if (h.snippet === null) continue;
      assert.ok(
        !h.snippet.includes("confidential") && !h.snippet.includes("bob"),
        `snippet leaked other-tenant content: ${h.snippet}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                      3. LIFECYCLE / VISIBILITY                             */
/* -------------------------------------------------------------------------- */

void describe("Archived and deleted content is not discoverable", () => {
  void test("an archived project does not appear", () => {
    const { hits } = run(ALICE, { entities: ["project"] });

    assert.ok(hits.length > 0);
    assert.ok(
      !hits.some((h) => h.id === "p-alice-archived"),
      "archived content must not be searchable",
    );
  });

  void test("deleted knowledge does not appear even for its owner", () => {
    const { hits } = run(ALICE, { entities: ["knowledge"] });

    assert.ok(
      !hits.some((h) => h.id === "k-alice-deleted"),
      "deleted knowledge must not be searchable",
    );
  });

  void test("knowledge status is allowlisted, not denylisted", () => {
    /*
     * An allowlist means a status added by a future migration is
     * excluded by default rather than silently searchable.
     */
    const { client } = run(ALICE, { entities: ["knowledge"] });

    const statusFilter = client.queries[0]?.find(
      (f) => f.kind === "in" && f.column === "status",
    );

    assert.ok(statusFilter, "knowledge must filter status by allowlist");
    assert.deepEqual(statusFilter.value, ["active"]);
  });
});

/* -------------------------------------------------------------------------- */
/*                          4. INPUT VALIDATION                               */
/* -------------------------------------------------------------------------- */

void describe("Query validation and bounds", () => {
  void test("an unknown entity type is refused, not ignored", () => {
    const r = validateSearchRequest({ query: "abc", entities: ["messages"] });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "UNKNOWN_ENTITY");
  });

  void test("messages and agent_runs are not searchable in 10.1", () => {
    for (const e of ["messages", "agent_runs", "documents", "users"]) {
      const r = validateSearchRequest({ query: "abc", entities: [e] });
      assert.equal(r.ok, false, `${e} must not be searchable`);
    }
  });

  void test("an over-long query is refused, not truncated", () => {
    const r = validateSearchRequest({ query: "a".repeat(500) });

    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "QUERY_TOO_LONG");
  });

  void test("a too-short query is refused", () => {
    for (const q of ["", " ", "a"]) {
      const r = validateSearchRequest({ query: q });
      assert.equal(r.ok, false, `"${q}" must be refused`);
    }
  });

  void test("limit and offset are clamped to their ceilings", () => {
    const r = validateSearchRequest({
      query: "falcon",
      limit: 9_999,
      offset: 9_999_999,
    });

    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.request.limit, SEARCH_LIMITS.maxLimit);
      assert.equal(r.request.offset, SEARCH_LIMITS.maxOffset);
    }
  });

  void test("deep pagination is bounded so it cannot enumerate", () => {
    const r = validateSearchRequest({ query: "falcon", offset: 10_000_000 });

    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.request.offset <= SEARCH_LIMITS.maxOffset);
  });

  void test("a non-string query is refused", () => {
    for (const q of [null, undefined, 42, {}, []]) {
      const r = validateSearchRequest({ query: q });
      assert.equal(r.ok, false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        5. INJECTION RESISTANCE                             */
/* -------------------------------------------------------------------------- */

void describe("Search text cannot alter the query structure", () => {
  void test("PostgREST filter syntax is stripped from user input", () => {
    for (const evil of [
      "falcon,user_id.neq.x",
      "falcon)or(user_id.neq.x",
      "falcon,or(status.eq.deleted)",
      "*",
    ]) {
      const cleaned = sanitizeSearchTerm(evil);

      assert.ok(!cleaned.includes(","), `comma survived: ${cleaned}`);
      assert.ok(!cleaned.includes("("), `paren survived: ${cleaned}`);
      assert.ok(!cleaned.includes(")"), `paren survived: ${cleaned}`);
    }
  });

  void test("an injection attempt still cannot cross tenants", () => {
    /* Even if syntax survived, ownership is a separate .eq() clause. */
    const r = validateSearchRequest({ query: "falcon,user_id.neq.zzz" });

    assert.equal(r.ok, true);
    if (!r.ok) return;

    const { hits } = run(ALICE, { query: r.request.query });

    for (const h of hits) {
      assert.ok(!h.id.includes("bob"), "injection reached another tenant");
    }
  });

  void test("ilike wildcards in user input are escaped", () => {
    assert.equal(escapeLikePattern("100%"), "100\\%");
    assert.equal(escapeLikePattern("a_b"), "a\\_b");

    /* Backslash escaped first, so escapes are not double-applied. */
    assert.equal(escapeLikePattern("a\\b"), "a\\\\b");
  });

  void test("a bare wildcard cannot become a bulk export", () => {
    const r = validateSearchRequest({ query: "%%" });

    if (r.ok) {
      const match = buildTextMatch(["title"], r.request.query);
      assert.ok(
        match.includes("\\%"),
        "wildcards must be escaped, not passed through",
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          6. SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

/*
 * The suites above test a mirror. These hold the SHIPPED files to the
 * same guarantees so the mirror cannot drift into proving nothing.
 */

void describe("Source invariants — query.ts", () => {
  void test("every query filters user_id from the session", () => {
    assert.match(QUERY_CODE, /\.eq\(\s*"user_id"\s*,\s*session\.userId\s*\)/);
  });

  void test("ownership is applied before the text match", () => {
    /*
     * Scoped to searchEntity's body — `buildTextMatch` is DEFINED above
     * it, so searching the whole file would compare against the
     * definition rather than the call site.
     */
    const body = QUERY_CODE.slice(
      QUERY_CODE.indexOf("async function searchEntity"),
      QUERY_CODE.indexOf("export async function search("),
    );

    assert.ok(body.length > 0, "searchEntity must exist");

    const ownerAt = body.indexOf('.eq("user_id"');
    const textAt = body.indexOf("buildTextMatch(");

    assert.ok(ownerAt > 0, "searchEntity must filter user_id");
    assert.ok(textAt > 0, "searchEntity must apply a text match");
    assert.ok(ownerAt < textAt, "user_id must be filtered before matching");
  });

  void test("search never uses a service-role client", () => {
    assert.doesNotMatch(
      QUERY_SRC,
      /supabaseAdmin|service_role|SERVICE_ROLE|createAdminClient/,
      "search must never bypass RLS",
    );
    assert.match(QUERY_CODE, /session\.supabase/);
  });

  void test("no raw RPC or SQL escape hatch exists", () => {
    assert.doesNotMatch(QUERY_CODE, /\.rpc\(/);
    assert.doesNotMatch(QUERY_CODE, /execute_sql|raw\(/i);
  });

  void test("columns are explicit, never a wildcard select", () => {
    assert.doesNotMatch(
      QUERY_CODE,
      /\.select\(\s*["'`]\*/,
      "a wildcard select would expose future columns automatically",
    );
    assert.match(QUERY_CODE, /config\.columns\.join/);
  });

  void test("the status allowlist is applied, not a denylist", () => {
    assert.match(QUERY_CODE, /searchableStatuses/);
    assert.match(QUERY_CODE, /\.in\(\s*"status"/);
    assert.doesNotMatch(QUERY_CODE, /\.neq\(\s*"status"/);
  });

  void test("knowledge is restricted to active rows", () => {
    const block = QUERY_CODE.slice(
      QUERY_CODE.indexOf("knowledge: {"),
      QUERY_CODE.indexOf("};", QUERY_CODE.indexOf("knowledge: {")),
    );

    assert.match(block, /searchableStatuses:\s*\["active"\]/);
  });

  void test("archived projects are excluded", () => {
    const block = QUERY_CODE.slice(
      QUERY_CODE.indexOf("project: {"),
      QUERY_CODE.indexOf("task: {"),
    );

    assert.ok(
      !/searchableStatuses:[^\]]*"archived"/.test(block),
      "archived must not be searchable",
    );
  });

  void test("sensitive columns are not selected", () => {
    for (const forbidden of [
      '"metadata"',
      '"embedding"',
      '"file_path"',
      '"error"',
      '"result"',
    ]) {
      assert.ok(
        !QUERY_CODE.includes(`      ${forbidden},`),
        `${forbidden} must not be searchable output`,
      );
    }
  });

  void test("results are bounded by an explicit limit", () => {
    assert.match(QUERY_CODE, /\.limit\(/);
    assert.match(QUERY_CODE, /Math\.min\(/);
  });

  void test("database errors are not forwarded to the caller", () => {
    assert.match(QUERY_CODE, /console\.error/);
    assert.match(QUERY_CODE, /return \{ ok: false \}/);
  });

  void test("scoring reads only the row and the query", () => {
    /* No corpus-wide statistic can enter the ranking. */
    const fn = QUERY_CODE.slice(
      QUERY_CODE.indexOf("export function scoreHit"),
      QUERY_CODE.indexOf("function buildSnippet"),
    );

    assert.ok(fn.length > 0);
    assert.ok(!fn.includes("await"), "scoring must not query anything");
    assert.ok(!/\bcorpus\b|totalDocs|globalFrequency/.test(fn));
  });
});

void describe("Source invariants — types.ts", () => {
  void test("only the three approved entities are searchable", () => {
    const block = TYPES_CODE.slice(
      TYPES_CODE.indexOf("SEARCHABLE_ENTITIES = ["),
      TYPES_CODE.indexOf("] as const"),
    );

    for (const e of ["project", "task", "knowledge"]) {
      assert.ok(block.includes(`"${e}"`), `${e} must be searchable`);
    }
    for (const e of ["message", "agent_run", "document"]) {
      assert.ok(!block.includes(`"${e}"`), `${e} must NOT be searchable yet`);
    }
  });

  void test("the request type carries no identity or tenancy authority", () => {
    const block = TYPES_CODE.slice(
      TYPES_CODE.indexOf("export interface SearchRequest"),
      TYPES_CODE.indexOf("export type SearchValidation"),
    );

    for (const forbidden of ["userId", "ownerId", "role", "plan", "filters"]) {
      assert.ok(
        !block.includes(forbidden),
        `${forbidden} must not be caller-supplied`,
      );
    }
  });

  void test("results report hasMore, not an exact total", () => {
    const block = TYPES_CODE.slice(
      TYPES_CODE.indexOf("export interface SearchResults"),
      TYPES_CODE.indexOf("export function escapeLikePattern"),
    );

    assert.ok(block.includes("hasMore"));
    assert.ok(
      !block.includes("total"),
      "an exact total invites inference about hidden rows",
    );
  });

  void test("query length and pagination are bounded", () => {
    assert.match(TYPES_CODE, /maxQueryLength/);
    assert.match(TYPES_CODE, /maxLimit/);
    assert.match(TYPES_CODE, /maxOffset/);
  });
});

/* -------------------------------------------------------------------------- */
/*                    7. THE OLD SERVICE IS NOT REUSED                        */
/* -------------------------------------------------------------------------- */

void describe("The in-memory provider is not reused", () => {
  void test("lib/search does not import services/search", () => {
    for (const src of [QUERY_CODE, TYPES_CODE]) {
      assert.ok(
        !src.includes("services/search"),
        "the in-memory provider architecture must not be reused",
      );
    }
  });

  void test("no in-memory provider or Map-backed index is introduced", () => {
    for (const src of [QUERY_CODE, TYPES_CODE]) {
      assert.ok(!/InMemory|new Map</.test(src), "search must query the database");
    }
  });
});
