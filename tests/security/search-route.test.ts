/**
 * SYRAVEN — /api/search route security tests
 *
 * Phase 10 Step 10.2 (see IMPLEMENTATION_PLAN.md).
 *
 * Step 10.1 proved the QUERY layer isolates tenants. This suite covers
 * the ROUTE: that authentication is required, that the query layer is
 * actually reached (rather than a stub still returning []), that tenant
 * scope is proven before searching, and that the response shape leaks
 * nothing about rows the caller cannot read.
 *
 * The route imports "server-only" transitively and cannot load outside
 * the Next runtime, so behavioural tests run against a mirror of the
 * handler's control flow, and the SOURCE INVARIANTS suite holds the
 * shipped route to the same shape.
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

const ROUTE_SRC = read("app", "api", "search", "route.ts");
const ROUTE = stripComments(ROUTE_SRC);
const METER = stripComments(read("lib", "usage", "meter.ts"));

/* -------------------------------------------------------------------------- */
/*                        MIRRORED ROUTE CONTROL FLOW                         */
/* -------------------------------------------------------------------------- */

const SEARCHABLE_ENTITIES = ["project", "task", "knowledge"] as const;
type SearchableEntity = (typeof SEARCHABLE_ENTITIES)[number];

const SEARCH_LIMITS = {
  defaultLimit: 20,
  maxLimit: 50,
  maxOffset: 1_000,
  minQueryLength: 2,
  maxQueryLength: 200,
} as const;

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

interface Row {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  workspace_id: string | null;
  updated_at: string;
}

const DB: Record<SearchableEntity, Row[]> = {
  project: [
    {
      id: "p-alice",
      user_id: ALICE,
      title: "Falcon roadmap",
      description: "alice",
      status: "active",
      workspace_id: "ws-alice",
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "p-bob",
      user_id: BOB,
      title: "Falcon secret",
      description: "bob confidential",
      status: "active",
      workspace_id: "ws-bob",
      updated_at: "2026-09-09T00:00:00Z",
    },
  ],
  task: [
    {
      id: "t-alice",
      user_id: ALICE,
      title: "Falcon task",
      description: "alice",
      status: "pending",
      workspace_id: "ws-alice",
      updated_at: "2026-09-02T00:00:00Z",
    },
    {
      id: "t-bob",
      user_id: BOB,
      title: "Falcon breach",
      description: "bob",
      status: "pending",
      workspace_id: "ws-bob",
      updated_at: "2026-09-08T00:00:00Z",
    },
  ],
  knowledge: [
    {
      id: "k-alice",
      user_id: ALICE,
      title: "Falcon notes",
      description: "alice",
      status: "active",
      workspace_id: "ws-alice",
      updated_at: "2026-09-03T00:00:00Z",
    },
    {
      id: "k-alice-deleted",
      user_id: ALICE,
      title: "Falcon removed",
      description: "alice",
      status: "deleted",
      workspace_id: "ws-alice",
      updated_at: "2026-09-07T00:00:00Z",
    },
    {
      id: "k-bob",
      user_id: BOB,
      title: "Falcon private",
      description: "bob",
      status: "active",
      workspace_id: "ws-bob",
      updated_at: "2026-09-06T00:00:00Z",
    },
  ],
};

const SEARCHABLE_STATUS: Record<SearchableEntity, string[]> = {
  project: ["draft", "active", "completed"],
  task: [],
  knowledge: ["active"],
};

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

/** Mirrors readEntities() in the route. */
function readEntities(raw: string | null): unknown {
  if (raw === null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed === "all") return undefined;
  return trimmed.split(",").map((t) => t.trim());
}

interface RouteResponse {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

interface Options {
  authenticated?: boolean;
  rateLimited?: boolean;
  /** Workspace ids the caller can actually reach. */
  allowedWorkspaces?: string[];
}

/**
 * Mirrors the GET handler's control flow, in order:
 * auth -> rate limit -> validate -> tenant guard -> search.
 */
function handleSearch(
  userId: string,
  params: Record<string, string | undefined>,
  options: Options = {},
): RouteResponse {
  const headers = { "Cache-Control": "private, no-store" };

  /* 1. withAuth */
  if (options.authenticated === false) {
    return {
      status: 401,
      body: { success: false, error: { code: "UNAUTHENTICATED" } },
      headers,
    };
  }

  /* 2. rate limit */
  if (options.rateLimited) {
    return {
      status: 429,
      body: { success: false, error: { code: "RATE_LIMITED" } },
      headers,
    };
  }

  /* 3. validate */
  const rawQuery = params.q ?? params.query;

  if (typeof rawQuery !== "string") {
    return {
      status: 400,
      body: { success: false, error: { code: "QUERY_REQUIRED" } },
      headers,
    };
  }

  const cleaned = sanitizeSearchTerm(rawQuery);

  if (cleaned.length < SEARCH_LIMITS.minQueryLength) {
    return {
      status: 400,
      body: { success: false, error: { code: "QUERY_TOO_SHORT" } },
      headers,
    };
  }
  if (cleaned.length > SEARCH_LIMITS.maxQueryLength) {
    return {
      status: 400,
      body: { success: false, error: { code: "QUERY_TOO_LONG" } },
      headers,
    };
  }

  const requested = readEntities(params.type ?? null);
  let entities: SearchableEntity[];

  if (requested === undefined) {
    entities = [...SEARCHABLE_ENTITIES];
  } else {
    const raw = requested as string[];
    if (raw.length === 0) {
      return {
        status: 400,
        body: { success: false, error: { code: "NO_ENTITIES" } },
        headers,
      };
    }
    for (const c of raw) {
      if (!(SEARCHABLE_ENTITIES as readonly string[]).includes(c)) {
        return {
          status: 400,
          body: { success: false, error: { code: "UNKNOWN_ENTITY" } },
          headers,
        };
      }
    }
    entities = [...new Set(raw as SearchableEntity[])];
  }

  const limit = clampInteger(
    params.limit,
    SEARCH_LIMITS.defaultLimit,
    1,
    SEARCH_LIMITS.maxLimit,
  );
  const offset = clampInteger(params.offset, 0, 0, SEARCH_LIMITS.maxOffset);

  const workspaceId = params.workspaceId ?? null;

  /* 4. tenant guard — an unreachable workspace is REFUSED, not empty */
  if (workspaceId !== null) {
    const allowed = options.allowedWorkspaces ?? [`ws-${userId}`];
    if (!allowed.includes(workspaceId)) {
      return {
        status: 404,
        body: { success: false, error: { code: "NOT_FOUND" } },
        headers,
      };
    }
  }

  /* 5. search — ownership filtered at query time */
  const hits: {
    id: string;
    type: SearchableEntity;
    title: string;
    updatedAt: string;
  }[] = [];

  for (const entity of entities) {
    for (const row of DB[entity]) {
      if (row.user_id !== userId) continue;

      const statuses = SEARCHABLE_STATUS[entity];
      if (statuses.length > 0 && !statuses.includes(row.status)) continue;

      if (
        !row.title.toLowerCase().includes(cleaned.toLowerCase()) &&
        !row.description.toLowerCase().includes(cleaned.toLowerCase())
      ) {
        continue;
      }

      if (workspaceId !== null && row.workspace_id !== workspaceId) continue;

      hits.push({
        id: row.id,
        type: entity,
        title: row.title,
        updatedAt: row.updated_at,
      });
    }
  }

  hits.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const page = hits.slice(offset, offset + limit);

  return {
    status: 200,
    body: {
      success: true,
      query: cleaned,
      types: entities,
      results: page,
      pagination: {
        limit,
        offset,
        hasMore: hits.length > offset + limit,
      },
      meta: { degraded: [] },
    },
    headers,
  };
}

/* -------------------------------------------------------------------------- */
/*                          1. AUTHENTICATION                                 */
/* -------------------------------------------------------------------------- */

void describe("Authentication is required", () => {
  void test("an unauthenticated request is rejected", () => {
    const res = handleSearch(ALICE, { q: "falcon" }, { authenticated: false });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  void test("an unauthenticated request returns no results at all", () => {
    const res = handleSearch(ALICE, { q: "falcon" }, { authenticated: false });

    assert.equal(res.body.results, undefined);
    assert.equal(res.body.pagination, undefined);
  });

  void test("the route is wrapped in withAuth", () => {
    assert.match(ROUTE, /export const GET = withAuth\(/);
  });

  void test("the handler uses the session, not a request-supplied id", () => {
    assert.match(ROUTE, /search\(\s*session\s*,/);
    assert.doesNotMatch(ROUTE, /params\.get\(\s*["']userId["']\s*\)/);
  });
});

/* -------------------------------------------------------------------------- */
/*                        2. CROSS-TENANT ISOLATION                           */
/* -------------------------------------------------------------------------- */

void describe("Cross-tenant results cannot appear", () => {
  void test("a search returns only the caller's own rows", () => {
    const res = handleSearch(ALICE, { q: "falcon" });

    assert.equal(res.status, 200);

    const results = res.body.results as { id: string }[];
    assert.ok(results.length > 0, "Alice must find her own rows");

    for (const r of results) {
      assert.ok(r.id.includes("alice"), `leaked foreign row: ${r.id}`);
    }
  });

  void test("two users searching the same term see disjoint results", () => {
    const alice = (handleSearch(ALICE, { q: "falcon" }).body.results as {
      id: string;
    }[]).map((r) => r.id);

    const bob = (handleSearch(BOB, { q: "falcon" }).body.results as {
      id: string;
    }[]).map((r) => r.id);

    assert.ok(alice.length > 0 && bob.length > 0);
    for (const id of alice) assert.ok(!bob.includes(id));
  });

  void test("another tenant's workspace is refused, not silently empty", () => {
    /*
     * Returning 200-with-no-results would let a caller distinguish
     * "exists but not mine" from "does not exist" by timing or by
     * contrast with a known-bad id. The tenant guard refuses instead.
     */
    const res = handleSearch(ALICE, { q: "falcon", workspaceId: "ws-bob" }, {
      allowedWorkspaces: ["ws-alice"],
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.results, undefined);
  });

  void test("a newer foreign row never outranks the caller's own", () => {
    /* Bob's rows are newer; if ranking were shared they would sort first. */
    const results = handleSearch(ALICE, { q: "falcon" }).body.results as {
      id: string;
    }[];

    for (const r of results) {
      assert.ok(!r.id.includes("bob"), "foreign row entered the ranking");
    }
  });

  void test("the route proves tenant access before searching", () => {
    const wsAt = ROUTE.indexOf("requireOptionalWorkspaceAccess(");
    const projAt = ROUTE.indexOf("requireOptionalProjectAccess(");
    const searchAt = ROUTE.indexOf("await search(");

    assert.ok(wsAt > 0 && wsAt < searchAt, "workspace proven before search");
    assert.ok(projAt > 0 && projAt < searchAt, "project proven before search");
    assert.match(ROUTE, /workspaceAccess\?\.denied/);
    assert.match(ROUTE, /projectAccess\?\.denied/);
  });
});

/* -------------------------------------------------------------------------- */
/*                        3. ENTITY TYPE ALLOWLIST                            */
/* -------------------------------------------------------------------------- */

void describe("Unsupported entity types are rejected", () => {
  void test("types excluded in 10.1 are refused", () => {
    for (const type of ["message", "agent_run", "document", "user", "file"]) {
      const res = handleSearch(ALICE, { q: "falcon", type });

      assert.equal(res.status, 400, `${type} must be refused`);
      assert.equal(
        (res.body.error as { code: string }).code,
        "UNKNOWN_ENTITY",
      );
    }
  });

  void test("an unknown type is refused, never silently ignored", () => {
    const res = handleSearch(ALICE, { q: "falcon", type: "everything" });

    assert.equal(res.status, 400);
    assert.equal(res.body.results, undefined);
  });

  void test("a mixed list containing one bad type refuses the whole request", () => {
    const res = handleSearch(ALICE, { q: "falcon", type: "task,message" });

    assert.equal(res.status, 400);
    assert.equal(res.body.results, undefined);
  });

  void test("type=all means only the SUPPORTED three", () => {
    const res = handleSearch(ALICE, { q: "falcon", type: "all" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.types, ["project", "task", "knowledge"]);
  });

  void test("the supported types are exactly the 10.1 set", () => {
    const res = handleSearch(ALICE, { q: "falcon" });

    assert.deepEqual(res.body.types, ["project", "task", "knowledge"]);
  });

  void test("the route does not advertise unsupported types", () => {
    /* The old shell's ALLOWED_TYPES must not survive. */
    for (const gone of ['"message"', '"document"', '"user"', '"file"']) {
      assert.ok(
        !ROUTE.includes(`  ${gone},`),
        `${gone} must not be an accepted search type`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        4. PAGINATION AND BOUNDS                            */
/* -------------------------------------------------------------------------- */

void describe("Pagination and limits stay bounded", () => {
  void test("limit is clamped to the ceiling", () => {
    const res = handleSearch(ALICE, { q: "falcon", limit: "99999" });

    const pagination = res.body.pagination as { limit: number };
    assert.equal(pagination.limit, SEARCH_LIMITS.maxLimit);
  });

  void test("offset is clamped so it cannot enumerate", () => {
    const res = handleSearch(ALICE, { q: "falcon", offset: "99999999" });

    const pagination = res.body.pagination as { offset: number };
    assert.ok(pagination.offset <= SEARCH_LIMITS.maxOffset);
  });

  void test("a negative limit falls back rather than inverting the query", () => {
    const res = handleSearch(ALICE, { q: "falcon", limit: "-5" });

    const pagination = res.body.pagination as { limit: number };
    assert.ok(pagination.limit >= 1);
  });

  void test("a non-numeric limit falls back to the default", () => {
    const res = handleSearch(ALICE, { q: "falcon", limit: "; DROP TABLE" });

    const pagination = res.body.pagination as { limit: number };
    assert.equal(pagination.limit, SEARCH_LIMITS.defaultLimit);
  });

  void test("an over-long query is refused", () => {
    const res = handleSearch(ALICE, { q: "a".repeat(500) });

    assert.equal(res.status, 400);
    assert.equal(
      (res.body.error as { code: string }).code,
      "QUERY_TOO_LONG",
    );
  });

  void test("a missing query is refused", () => {
    const res = handleSearch(ALICE, {});

    assert.equal(res.status, 400);
  });

  void test("paging cannot reach another tenant's rows", () => {
    for (let offset = 0; offset < 8; offset += 1) {
      const results = handleSearch(ALICE, {
        q: "falcon",
        limit: "1",
        offset: String(offset),
      }).body.results as { id: string }[];

      for (const r of results) {
        assert.ok(!r.id.includes("bob"), `pagination leaked ${r.id}`);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                      5. NO UNAUTHORIZED COUNT EXPOSED                      */
/* -------------------------------------------------------------------------- */

void describe("No exact or unauthorized total is exposed", () => {
  void test("the response reports hasMore, not a total", () => {
    const res = handleSearch(ALICE, { q: "falcon" });

    const pagination = res.body.pagination as Record<string, unknown>;

    assert.ok("hasMore" in pagination);
    assert.ok(!("total" in pagination), "an exact total invites inference");
    assert.ok(!("totalPages" in pagination));
  });

  void test("hasMore counts only the caller's own rows", () => {
    /* Alice has exactly 3 live rows; Bob has 3 more matching the term. */
    const all = handleSearch(ALICE, { q: "falcon", limit: "50" });
    assert.equal((all.body.results as unknown[]).length, 3);

    const boundary = handleSearch(ALICE, { q: "falcon", limit: "3" });
    assert.equal(
      (boundary.body.pagination as { hasMore: boolean }).hasMore,
      false,
      "hasMore must not count Bob's rows",
    );

    const partial = handleSearch(ALICE, { q: "falcon", limit: "2" });
    assert.equal(
      (partial.body.pagination as { hasMore: boolean }).hasMore,
      true,
    );
  });

  void test("the route type declares no total field", () => {
    const block = ROUTE.slice(
      ROUTE.indexOf("interface SearchResponse"),
      ROUTE.indexOf("interface SearchErrorResponse"),
    );

    assert.ok(block.length > 0);
    assert.ok(!block.includes("total"), "no total may be returned");
    assert.ok(block.includes("hasMore"));
  });

  void test("deleted content is not discoverable even by its owner", () => {
    const results = handleSearch(ALICE, { q: "falcon", type: "knowledge" })
      .body.results as { id: string }[];

    assert.ok(
      !results.some((r) => r.id === "k-alice-deleted"),
      "deleted knowledge must not be searchable",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          6. RATE LIMITING                                  */
/* -------------------------------------------------------------------------- */

void describe("Rate limiting", () => {
  void test("a rate-limited request is refused before any search", () => {
    const res = handleSearch(ALICE, { q: "falcon" }, { rateLimited: true });

    assert.equal(res.status, 429);
    assert.equal(res.body.results, undefined);
  });

  void test("the limit is checked before the database is touched", () => {
    const limitAt = ROUTE.indexOf("checkRateLimit(");
    const searchAt = ROUTE.indexOf("await search(");

    assert.ok(limitAt > 0 && limitAt < searchAt);
    assert.match(ROUTE, /if\s*\(\s*!limit\.allowed\s*\)/);
  });

  void test("a search rate-limit rule exists and is bounded", () => {
    assert.match(METER, /"search:query":\s*\{\s*max:\s*\d+/);

    const rule = METER.match(
      /"search:query":\s*\{\s*max:\s*(\d+),\s*windowSeconds:\s*(\d+)/,
    );

    assert.ok(rule, "the rule must be parseable");
    assert.ok(Number(rule[1]) > 0 && Number(rule[1]) <= 120);
    assert.ok(Number(rule[2]) > 0);
  });

  void test("a 429 carries Retry-After", () => {
    assert.match(ROUTE, /"Retry-After"/);
  });
});

/* -------------------------------------------------------------------------- */
/*                          7. SOURCE INVARIANTS                              */
/* -------------------------------------------------------------------------- */

void describe("Source invariants — route", () => {
  void test("the stub is gone and lib/search is wired in", () => {
    assert.match(ROUTE, /from "@\/lib\/search\/query"/);
    assert.match(ROUTE, /await search\(/);

    assert.ok(
      !/results:\s*\[\]/.test(ROUTE),
      "the hardcoded empty result must be gone",
    );
    assert.ok(
      !ROUTE.includes("executeSearch"),
      "the stub adapter must be removed",
    );
  });

  void test("the route never uses a service-role client", () => {
    assert.doesNotMatch(
      ROUTE_SRC,
      /supabaseAdmin|service_role|SERVICE_ROLE|createAdminClient/,
      "search must never bypass RLS",
    );
  });

  void test("validation runs before the search", () => {
    const validateAt = ROUTE.indexOf("validateSearchRequest(");
    const searchAt = ROUTE.indexOf("await search(");

    assert.ok(validateAt > 0 && validateAt < searchAt);
    assert.match(ROUTE, /if\s*\(\s*!validation\.ok\s*\)/);
  });

  void test("the full control order holds: auth, limit, validate, tenant, search", () => {
    const order = [
      "withAuth(",
      "checkRateLimit(",
      "validateSearchRequest(",
      "requireOptionalWorkspaceAccess(",
      "await search(",
    ].map((needle) => ({ needle, at: ROUTE.indexOf(needle) }));

    for (const step of order) {
      assert.ok(step.at > 0, `${step.needle} must be present`);
    }

    /* Pairwise, so indexed access stays narrowed under strict mode. */
    order.reduce((previous, current) => {
      assert.ok(
        previous.at < current.at,
        `${previous.needle} must precede ${current.needle}`,
      );
      return current;
    });
  });

  void test("responses are private and not cached", () => {
    assert.match(ROUTE, /"private, no-store"/);
    assert.match(ROUTE, /Vary: "Authorization, Cookie"/);
    assert.ok(
      !ROUTE.includes("public, max-age"),
      "search results must never be shared-cached",
    );
  });

  void test("internal errors are not forwarded to the caller", () => {
    assert.match(ROUTE, /console\.error/);
    assert.match(ROUTE, /INTERNAL_SERVER_ERROR/);

    /*
     * Any expression deriving text from the caught error is forbidden,
     * not just the literal `error.message` shape — a cast such as
     * `(error as Error).message` leaks exactly the same schema detail.
     */
    assert.ok(
      !/\berror\s*\)?\s*(as\s+\w+\s*\)?\s*)?\.message\b/.test(ROUTE),
      "a raw error message may carry schema detail",
    );
    assert.ok(
      !/String\(\s*error\s*\)|error\.toString\(|error\.stack/.test(ROUTE),
      "the error must not be stringified into the response",
    );

    /* The 500 body must be the fixed string, not derived from the error. */
    const catchBlock = ROUTE.slice(ROUTE.lastIndexOf("} catch ("));

    assert.ok(
      catchBlock.includes(
        '"An unexpected error occurred while processing the search request."',
      ),
      "the 500 response must use a fixed, caller-safe message",
    );
  });

  void test("no semantic or vector search was introduced", () => {
    for (const forbidden of [
      "embedding",
      "vector",
      "ai_knowledge_chunks",
      "cosine",
    ]) {
      assert.ok(
        !ROUTE.toLowerCase().includes(forbidden),
        `${forbidden} is out of scope for 10.2`,
      );
    }
  });
});
