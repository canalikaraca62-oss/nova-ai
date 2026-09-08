/**
 * SYRAVEN — regressions for the defects found by the final production test
 *
 * Each block pins one confirmed, reproduced defect.
 *
 *   D1  Knowledge was invisible to /api/search. lib/search/query.ts
 *       allowed only status "active"; the knowledge route writes
 *       draft | processing | ready | failed | archived and defaults to
 *       "ready". Verified in production: all rows were "ready", none
 *       "active", and search returned 0 results for a title that
 *       existed and listed fine through /api/knowledge.
 *
 *   D2  /api/knowledge/search returned 500 for every caller. It
 *       selected `source_type` and `source_id`, neither of which exists
 *       on public.knowledge, so Postgres rejected the query with 42703
 *       and the handler's catch-all reported a generic 500. This was
 *       NOT an embeddings or provider problem -- that path performs no
 *       provider call at all.
 *
 *   D3  /api/chat reported a provider auth failure as 502 "could not
 *       complete this request", describing a configuration problem as
 *       an upstream outage.
 *
 *   D4  There was no way to end a session server-side; POST
 *       /api/auth/logout returned 404.
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

/** Strips comments so prose about a defect cannot satisfy a test for it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const QUERY = stripComments(read("lib", "search", "query.ts"));
const KSEARCH = stripComments(read("app", "api", "knowledge", "search", "route.ts"));
const CHAT = stripComments(read("app", "api", "chat", "route.ts"));
const LOGOUT = stripComments(read("app", "api", "auth", "logout", "route.ts"));
const MIDDLEWARE = stripComments(read("middleware.ts"));

/** The statuses app/api/knowledge/route.ts can actually write. */
const KNOWLEDGE_STATUSES = ["draft", "processing", "ready", "failed", "archived"];

/* -------------------------------------------------------------------------- */
/*                      D1 — knowledge must be searchable                     */
/* -------------------------------------------------------------------------- */

/** The `searchableStatuses` array for one entity in SEARCHABLE_ENTITIES. */
function statusesFor(entity: string): string[] {
  const at = QUERY.indexOf(`${entity}: {`);

  assert.ok(at > 0, `${entity} entry not found.`);

  const block = QUERY.slice(at, at + 1400);
  const m = block.match(/searchableStatuses:\s*\[([^\]]*)\]/);

  assert.ok(m, `${entity} has no searchableStatuses.`);

  return [...(m[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!);
}

void describe("D1: knowledge search matches the statuses actually written", () => {
  void test('"ready" is searchable', () => {
    /*
     * The exact defect. "ready" is the route's DEFAULT, so this single
     * omission hid every knowledge record a user ever created.
     */
    assert.ok(
      statusesFor("knowledge").includes("ready"),
      'CRITICAL: "ready" is the default status for new knowledge, so ' +
        "excluding it makes every record invisible to search.",
    );
  });

  void test("only statuses the route can write are listed", () => {
    /* Guards the reverse drift: a status search expects but nothing sets. */
    const allowed = new Set([...KNOWLEDGE_STATUSES, "active"]);

    for (const s of statusesFor("knowledge")) {
      assert.ok(
        allowed.has(s),
        `"${s}" is searchable but app/api/knowledge/route.ts never writes it.`,
      );
    }
  });

  void test("archived and failed stay excluded", () => {
    const listed = statusesFor("knowledge");

    for (const excluded of ["archived", "failed", "processing"]) {
      assert.ok(
        !listed.includes(excluded),
        `"${excluded}" must not be searchable: it has no usable content.`,
      );
    }
  });

  void test("the status filter is still applied", () => {
    /* Fixing visibility must not become "search everything". */
    assert.match(
      QUERY,
      /query\s*=\s*query\.in\(\s*"status",/,
      "The allowlist must still narrow the query.",
    );
  });

  void test("the ownership filter is untouched", () => {
    /*
     * D1 is a visibility fix. If it had widened access instead, this is
     * where that would show.
     */
    /*
      The actual predicate, not the word in a comment: stripComments
      removes the prose, so matching /ownership/i tested nothing.
    */
    assert.match(
      QUERY,
      /\.\eq\(\s*"user_id",\s*session\.userId\s*\)/,
      "CRITICAL: every search query must be scoped to the caller.",
    );

    assert.ok(
      !/service_role|supabaseAdmin/.test(QUERY),
      "CRITICAL: search must run on the caller's RLS client.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    D2 — knowledge/search must not 500                      */
/* -------------------------------------------------------------------------- */

void describe("D2: /api/knowledge/search queries columns that exist", () => {
  /** Columns on public.knowledge, read from the live schema. */
  const REAL = new Set([
    "id", "user_id", "workspace_id", "project_id", "team_id", "title",
    "description", "content", "type", "status", "visibility", "source_url",
    "file_name", "file_path", "file_type", "file_size", "metadata", "tags",
    "embedding", "created_at", "updated_at",
  ]);

  void test("no phantom columns are selected", () => {
    for (const phantom of ["source_type", "source_id"]) {
      assert.ok(
        !new RegExp(`\\b${phantom}\\b`).test(KSEARCH),
        `CRITICAL: ${phantom} does not exist on public.knowledge; ` +
          `selecting it makes Postgres reject the query with 42703, ` +
          `which the handler reports as a generic 500.`,
      );
    }
  });

  void test("every selected column exists", () => {
    const at = KSEARCH.indexOf(".select(");

    assert.ok(at > 0, "select call not found.");

    const block = KSEARCH.slice(at, KSEARCH.indexOf("`", KSEARCH.indexOf("`", at) + 1));

    for (const col of [...block.matchAll(/^\s*([a-z_]+),\s*$/gm)].map((m) => m[1]!)) {
      assert.ok(REAL.has(col), `"${col}" is not a column on public.knowledge.`);
    }
  });

  void test("it still runs on the caller's client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE/.test(KSEARCH),
      "CRITICAL: knowledge search must not bypass RLS.",
    );
  });

  void test("tenant guards are still applied", () => {
    assert.match(KSEARCH, /requireOptionalWorkspaceAccess/);
    assert.match(KSEARCH, /requireOptionalProjectAccess/);
  });
});

/* -------------------------------------------------------------------------- */
/*                D3 — a bad credential is not an upstream outage             */
/* -------------------------------------------------------------------------- */

void describe("D3: /api/chat classifies provider failures", () => {
  void test("401/403 from the provider is a 503 configuration error", () => {
    assert.match(
      CHAT,
      /response\.status === 401[\s\S]{0,80}response\.status === 403/,
      "A provider auth failure must be detected.",
    );

    assert.match(
      CHAT,
      /PROVIDER_NOT_CONFIGURED/,
      "CRITICAL: an invalid API key reported as 502 sends operators " +
        "looking for an upstream outage that is not happening.",
    );
  });

  void test("rate limiting is distinguishable too", () => {
    assert.match(CHAT, /PROVIDER_RATE_LIMITED/);
  });

  void test("a genuine upstream failure is still 502", () => {
    /* The fix must not flatten every failure into a config error. */
    /*
      Tests the STATUS, not one message spelling. The message now
      carries the upstream status so a production failure is
      diagnosable from the response; pinning the old literal made a
      diagnostic improvement look like a regression.
    */
    assert.match(
      CHAT,
      /could not complete this request[\s\S]{0,220}?502/,
      "Non-auth provider failures must remain 502.",
    );

    assert.match(
      CHAT,
      /PROVIDER_REQUEST_FAILED/,
      "The generic provider failure needs a code too, so a caller can " +
        "tell it from a configuration problem.",
    );
  });

  void test("no API key or secret is echoed to the caller", () => {
    const handler = CHAT.slice(CHAT.indexOf("PROVIDER_NOT_CONFIGURED") - 900);

    assert.ok(
      !/apiKey|API_KEY|process\.env\.[A-Z_]*KEY/.test(handler.slice(0, 900)),
      "CRITICAL: the response must name the variable, never a value.",
    );
  });

  void test("auth and usage enforcement are untouched", () => {
    assert.match(CHAT, /withAuth\(/);
    assert.match(CHAT, /enforceUsage|guard\.denied/);
  });
});

/* -------------------------------------------------------------------------- */
/*                          D4 — sign-out must exist                          */
/* -------------------------------------------------------------------------- */

void describe("D4: /api/auth/logout ends a session", () => {
  void test("POST is exported", () => {
    assert.match(LOGOUT, /export\s+async\s+function\s+POST/);
  });

  void test("GET is refused", () => {
    /*
     * A GET would let a third-party page sign a user out through an
     * embedded image or link.
     */
    assert.match(LOGOUT, /405/);
  });

  void test("it revokes the session, not just the cookie", () => {
    assert.match(
      LOGOUT,
      /supabase\.auth\.signOut\(\)/,
      "Clearing cookies alone leaves the refresh token replayable.",
    );
  });

  void test("it clears Supabase cookies explicitly", () => {
    /* An already-invalid session may leave signOut() nothing to clear. */
    assert.match(LOGOUT, /startsWith\("sb-"\)/);
    assert.match(LOGOUT, /cookieStore\.delete/);
  });

  void test("it touches only sb- cookies", () => {
    const loop = LOGOUT.slice(LOGOUT.indexOf("for (const cookie of"));

    assert.match(
      loop.slice(0, 300),
      /startsWith\("sb-"\)/,
      "Deleting unrelated cookies would sign the user out of more than " +
        "they asked.",
    );
  });

  void test("it uses the anon client, never service-role", () => {
    assert.ok(
      !/SERVICE_ROLE|supabaseAdmin/.test(LOGOUT),
      "CRITICAL: sign-out must not use an elevated client.",
    );

    assert.match(LOGOUT, /createServerClient/);
  });

  void test("it is reachable without a valid session", () => {
    /*
     * Behind withAuth it would answer 401 for an expired session and
     * leave the stale cookies in place -- the opposite of the request.
     */
    assert.ok(
      !/withAuth/.test(LOGOUT),
      "Sign-out must work when the session is already invalid.",
    );

    assert.match(
      MIDDLEWARE,
      /"\/api\/auth\/logout"/,
      "It must be allowlisted, or the gate refuses it before it runs.",
    );
  });

  void test("allowlisting logout did not open anything else", () => {
    const block = MIDDLEWARE.slice(
      MIDDLEWARE.indexOf("PUBLIC_API_ROUTES"),
      MIDDLEWARE.indexOf("PUBLIC_STATUS_GET_ROUTES"),
    );

    const routes = [...block.matchAll(/"(\/api\/[a-z/-]+)"/g)].map((m) => m[1]!);

    assert.deepEqual(
      routes.sort(),
      [
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/register",
        "/api/auth/reset-password",
        "/api/billing/webhook",
      ].sort(),
      "The public allowlist gained something other than logout.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     D6 — project links must resolve                        */
/* -------------------------------------------------------------------------- */

/*
 * app/projects/[id]/page.tsx linked to /edit, /new, /intelligence and
 * /settings under the project id. None of those routes exist -- the
 * directory contains only page.tsx -- so every one 404d when clicked,
 * and Next.js prefetched them on hover, which is how they surfaced as
 * failed network requests during the production browser run.
 */

void describe("D6: the project detail page has no dead links", () => {
  const DETAIL = stripComments(read("app", "projects", "[id]", "page.tsx"));

  void test("it links to no nonexistent project subroute", () => {
    const dead = [
      ...DETAIL.matchAll(
        /href=\{`\/projects\/\$\{project\.id\}\/([a-z]+)`\}/g,
      ),
    ].map((m) => m[1]);

    assert.deepEqual(
      dead,
      [],
      `CRITICAL: /projects/<id>/${dead.join(", ")} do not exist and ` +
        "404 when clicked or prefetched.",
    );
  });

  void test("the hero CTA reaches a real page", () => {
    assert.match(
      DETAIL,
      /href="\/tasks"/,
      "Add task must lead somewhere that exists.",
    );
  });
});
