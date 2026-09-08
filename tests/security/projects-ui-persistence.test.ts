/**
 * SYRAVEN — the project UI must persist, and must not invent data
 *
 * WHY THIS FILE EXISTS
 *
 * Two defects of the same class as the workspace dead end:
 *
 * 1. /projects/new awaited a 700ms timeout and then redirected. It
 *    called no API. The user saw a success animation and nothing was
 *    written -- while POST /api/projects existed and worked.
 *
 * 2. /projects/[id] read a hardcoded record and, on a miss, rendered a
 *    fallback with the id title-cased into a name. Every real project
 *    therefore opened as invented content -- 0% progress, 0 tasks --
 *    contradicting whatever the user had just typed.
 *
 * Both are invisible to a type checker and to any test that only
 * inspects the API. These assertions pin the UI to the API.
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

/** Strips comments so prose about a rule cannot satisfy a test for it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const NEW_PAGE = stripComments(read("app", "projects", "new", "page.tsx"));
const DETAIL = stripComments(read("app", "projects", "[id]", "page.tsx"));
const ROUTE = stripComments(read("app", "api", "projects", "route.ts"));

void describe("/projects/new persists through the API", () => {
  void test("it POSTs to /api/projects", () => {
    assert.match(
      NEW_PAGE,
      /fetch\(\s*["'`]\/api\/projects["'`]/,
      "The form must call the API rather than simulate success.",
    );

    assert.match(NEW_PAGE, /method:\s*["'`]POST["'`]/);
  });

  void test("the fake delay is gone", () => {
    /*
     * The exact shape of the defect: a timeout standing in for a
     * request. Its presence next to a redirect is what made the page
     * look like it worked.
     */
    assert.ok(
      !/setTimeout\(\s*resolve/.test(NEW_PAGE),
      "CRITICAL: a simulated delay is still standing in for persistence.",
    );
  });

  void test("it navigates by the id the server returned", () => {
    assert.match(
      NEW_PAGE,
      /router\.push\(\s*`\/projects\/\$\{\s*payload\.data\.id\s*\}`\s*\)/,
      "Navigating by a client-derived slug lands on a project that does " +
        "not exist.",
    );
  });

  void test("it does not send ownership", () => {
    /* The route derives owner from the session; sending it invites IDOR. */
    for (const forbidden of ["owner_id", "ownerId", "user_id", "userId"]) {
      assert.ok(
        !new RegExp(`${forbidden}\s*:`).test(NEW_PAGE),
        `CRITICAL: the form sends ${forbidden}.`,
      );
    }
  });

  void test("a failure is shown to the user", () => {
    assert.match(NEW_PAGE, /submitError/);
    assert.match(
      NEW_PAGE,
      /role="alert"/,
      "A rejected create must be announced, not silently swallowed.",
    );
  });

  void test("the status it sends is one the database accepts", () => {
    /*
     * public.projects is constrained to draft|active|archived|completed.
     * The form previously offered "planning", which the database
     * rejects -- so wiring it up without this would have replaced a fake
     * success with a real 500.
     */
    assert.ok(
      !/"planning"/.test(NEW_PAGE),
      'CRITICAL: "planning" violates projects_status_check.',
    );

    assert.match(NEW_PAGE, /"draft"/);
  });
});

void describe("/projects/[id] shows the real project", () => {
  void test("it fetches by id", () => {
    assert.match(
      DETAIL,
      /fetch\(\s*\n?\s*`\/api\/projects\?id=\$\{encodeURIComponent\(projectId\)\}`/,
      "The detail page must ask the API for the project it is showing.",
    );
  });

  void test("the API supports that lookup", () => {
    /*
     * Pins the two halves together: a page fetching ?id= against a route
     * that ignores it is the canvas defect, which returned a static
     * service blob for every canvas.
     */
    assert.match(
      ROUTE,
      /searchParams\.get\(\s*["'`]id["'`]\s*\)/,
      "GET /api/projects must read the id parameter.",
    );

    assert.match(
      ROUTE,
      /query\s*=\s*query\.eq\(\s*\n?\s*["'`]id["'`]/,
      "The id must actually filter the query.",
    );
  });

  void test("loaded data takes precedence over the sample record", () => {
    assert.match(
      DETAIL,
      /loaded\s*\?\?/,
      "A real project must win over the hardcoded demo content.",
    );
  });

  void test("a missing project is not disguised as a real one", () => {
    /*
     * The fallback previously title-cased the URL id into a name, so a
     * UUID rendered as a plausible-looking project.
     */
    assert.ok(
      !/word\.charAt\(0\)\.toUpperCase\(\)/.test(DETAIL),
      "CRITICAL: the id is being cosmetically converted into a name.",
    );
  });

  void test("load failures are visible", () => {
    assert.match(DETAIL, /loadError/);
    assert.match(DETAIL, /role="alert"/);
  });

  void test("statuses the database stores all have labels", () => {
    /* Otherwise a draft project silently displays as "Planning". */
    for (const status of ["draft", "archived", "active", "completed"]) {
      assert.ok(
        new RegExp(`case\\s+"${status}"`).test(DETAIL),
        `"${status}" is stored by the database but has no label.`,
      );
    }
  });
});

void describe("The id lookup did not weaken authorization", () => {
  void test("the ownership predicate is still applied", () => {
    /*
      Anchored to the GET query specifically.

      A bare search for .eq("user_id", userId) passes even when the
      GET filter is deleted, because PATCH and DELETE contain the same
      call -- so the assertion survived a mutation that turned ?id=
      into a way to read any project. It now slices the GET handler and
      requires the predicate on the query builder itself.
    */
    const get = ROUTE.slice(
      ROUTE.indexOf("export const GET"),
      ROUTE.indexOf("export const POST"),
    );

    assert.ok(get.length > 0, "Could not isolate the GET handler.");

    assert.match(
      get,
      /let\s+query\s*=\s*db[\s\S]{0,400}?\.eq\(\s*\n?\s*"user_id",\s*\n?\s*userId/,
      "CRITICAL: GET must be scoped to the caller, or ?id= reads any " +
        "project.",
    );
  });

  void test("the route still uses the caller's client", () => {
    assert.ok(!/supabaseAdmin|SUPABASE_SERVICE_ROLE/.test(ROUTE));
    assert.match(ROUTE, /const\s+db\s*=\s*\n?\s*session\.supabase/);
  });
});
