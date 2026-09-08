/**
 * SYRAVEN — canvas edits must survive a reload
 *
 * WHY THIS FILE EXISTS
 *
 * Canvas is reachable from the desktop sidebar, the mobile nav, the
 * command palette, universal search and /apps, and it has a full editor
 * with a Save button and a 1.2s debounced autosave. None of it
 * persisted, because there was no canvas table at all.
 *
 *   PATCH /api/canvas   not exported -- Next.js answered 405
 *   GET   /api/canvas   ignored ?id= and returned a static service blob,
 *                       so every canvas opened as "Untitled Canvas"
 *
 * The autosave ran with `silent = true`, so both failures were
 * invisible: the editor reported the canvas as saved while discarding
 * the work.
 *
 * The fix adds public.canvases (owner-scoped RLS) plus /api/canvases,
 * kept separate from /api/canvas -- that route is an AI GENERATION
 * endpoint that enforces usage quota, and folding persistence into it
 * would make every autosave a metered, billable event.
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

const ROUTE = stripComments(read("app", "api", "canvases", "route.ts"));
const PAGE = stripComments(read("app", "canvas", "[id]", "page.tsx"));

const MIGRATION = read(
  "supabase",
  "migrations",
  "20260908120000_syraven_canvases.sql",
);

/** The migration's executable SQL, with `--` comments removed. */
const SQL = MIGRATION.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/* -------------------------------------------------------------------------- */
/*                                  THE TABLE                                 */
/* -------------------------------------------------------------------------- */

void describe("public.canvases is owner-scoped", () => {
  void test("row level security is enabled", () => {
    assert.match(
      SQL,
      /alter\s+table\s+public\.canvases\s+enable\s+row\s+level\s+security/i,
      "CRITICAL: without RLS every canvas is readable by every user.",
    );
  });

  void test("all four operations are policied", () => {
    for (const op of ["select", "insert", "update", "delete"]) {
      assert.match(
        SQL,
        new RegExp(`for\\s+${op}\\b`, "i"),
        `${op.toUpperCase()} has no policy, so it is denied or unguarded.`,
      );
    }
  });

  void test("every policy is pinned to the owner", () => {
    /*
     * Counted rather than merely present: one policy missing the
     * predicate is the whole breach, and a single matching clause
     * elsewhere would hide it.
     */
    const policies = (SQL.match(/create\s+policy/gi) ?? []).length;
    const pins = (SQL.match(/auth\.uid\(\)\s*=\s*user_id/g) ?? []).length;

    assert.equal(policies, 4, `Expected 4 policies, found ${policies}.`);

    assert.ok(
      pins >= policies,
      `CRITICAL: ${policies} policies but only ${pins} owner predicates.`,
    );
  });

  void test("membership of a workspace does not grant access", () => {
    /*
     * workspace_id exists for grouping, but a canvas is private to its
     * author. Policying on membership would silently share every
     * teammate's canvas.
     */
    assert.ok(
      !/is_organization_member|is_organization_admin/.test(SQL),
      "A canvas must not be readable through workspace membership.",
    );
  });

  void test("deleting a workspace does not destroy canvases", () => {
    assert.match(
      SQL,
      /workspace_id[\s\S]{0,120}on\s+delete\s+set\s+null/i,
      "A canvas must outlive the workspace it was grouped under.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                                  THE ROUTE                                 */
/* -------------------------------------------------------------------------- */

void describe("/api/canvases is session-scoped", () => {
  void test("every handler requires authentication", () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      assert.match(
        ROUTE,
        new RegExp(`export\\s+const\\s+${method}\\s*=\\s*withAuth\\(`),
        `${method} must be wrapped in withAuth.`,
      );
    }
  });

  void test("no unwrapped handler is exported", () => {
    assert.ok(
      !/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/.test(ROUTE),
      "CRITICAL: an unwrapped handler bypasses authentication.",
    );
  });

  void test("it never uses the service-role client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE|createClient/.test(ROUTE),
      "CRITICAL: canvases must be read and written through RLS.",
    );
  });

  void test("ownership comes from the session, never the request", () => {
    assert.match(ROUTE, /user_id:\s*session\.userId/);

    for (const forbidden of ["record", "body", "input", "parsed"]) {
      assert.ok(
        !new RegExp(`user_id:\\s*${forbidden}`).test(ROUTE),
        `CRITICAL: user_id taken from ${forbidden}.`,
      );
    }
  });

  void test("a body-supplied workspace id is authorized", () => {
    /* The same omission that let rows be planted in another tenant. */
    assert.match(
      ROUTE,
      /requireOptionalWorkspaceAccess/,
      "CRITICAL: an unchecked workspaceId places a canvas in a tenant " +
        "the caller does not belong to.",
    );
  });

  void test("a missing canvas is indistinguishable from a forbidden one", () => {
    /*
     * RLS filters another user's canvas out of the result set, so the
     * route cannot tell "not yours" from "does not exist" -- and must
     * not try, or ids become enumerable.
     */
    assert.match(ROUTE, /404,\s*"This canvas could not be found\."/);
  });

  void test("document size is bounded", () => {
    /* jsonb accepts anything that parses; this is the only bound. */
    assert.match(ROUTE, /maxNodes/);
    assert.match(ROUTE, /maxEdges/);
    assert.match(ROUTE, /maxDocumentBytes/);
  });
});

/* -------------------------------------------------------------------------- */
/*                              THE EDITOR                                    */
/* -------------------------------------------------------------------------- */

void describe("The canvas editor talks to the persistence route", () => {
  void test("it no longer PATCHes the AI generation endpoint", () => {
    /*
     * The exact defect: PATCH /api/canvas, a route exporting only POST
     * and GET, answered 405 on every save.
     */
    assert.ok(
      !/["'`]\/api\/canvas["'`]/.test(PAGE),
      "CRITICAL: /api/canvas is the AI generation endpoint; saving " +
        "through it returns 405 and bills the user for autosaves.",
    );
  });

  void test("load and save both use /api/canvases", () => {
    const calls = PAGE.match(/\/api\/canvases/g) ?? [];

    assert.ok(
      calls.length >= 3,
      `Expected load, save and create to reach /api/canvases; saw ${calls.length}.`,
    );
  });

  void test("a first save creates the canvas", () => {
    /* A brand-new id has no row, so PATCH alone would 404 forever. */
    assert.match(PAGE, /response\.status === 404/);
    assert.match(PAGE, /method:\s*["'`]POST["'`]/);
  });

  void test("a new canvas opens empty rather than erroring", () => {
    const load = PAGE.slice(0, PAGE.indexOf("const payload"));

    assert.match(
      load,
      /404/,
      "Opening a canvas that has no row yet must not show a failure.",
    );
  });

  void test("a failed autosave is visible and stays dirty", () => {
    /*
     * `silent` previously suppressed the message entirely, which is how
     * a 405 on every save went unnoticed.
     */
    const handler = PAGE.slice(PAGE.indexOf("catch (saveError)"));

    assert.match(
      handler,
      /setError\(/,
      "CRITICAL: a silent save failure is how the original defect hid.",
    );

    assert.match(
      handler,
      /setIsDirty\(true\)/,
      "Unsaved work must not be marked clean.",
    );

    assert.ok(
      !/if\s*\(\s*!silent\s*\)\s*\{\s*\n?\s*setError/.test(handler),
      "The error must not be gated on the save being non-silent.",
    );
  });

  void test("the editor sends the column name the API expects", () => {
    /* The column is `title`; the editor's field is `name`. */
    assert.match(PAGE, /title:\s*target\.name/);
  });
});
