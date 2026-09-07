/**
 * SYRAVEN — the projects route must speak the database's vocabulary
 *
 * WHY THIS FILE EXISTS
 *
 * POST /api/projects returned 500 for every request that omitted
 * `status`, which is every request the UI would send. The route's
 * normalizeStatus() defaulted to "planning", a value
 * projects_status_check does not permit:
 *
 *   projects_status_check
 *     CHECK (status = ANY (ARRAY['draft','active','archived','completed']))
 *
 * The insert was rejected by Postgres, the route logged and returned
 * "Project could not be created.", and project creation was broken in
 * production. Verified live before the fix (500) and after (201).
 *
 * A type union is not a constraint. These assertions pin the route's
 * accepted values to the CHECK constraints they must satisfy, so
 * widening one without a migration fails here instead of at runtime.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = readFileSync(
  join(process.cwd(), "app", "api", "projects", "route.ts"),
  "utf8",
);

/**
 * The CHECK constraints as they exist in production.
 *
 * Read from the live database during this work:
 *   select conname, pg_get_constraintdef(oid) from pg_constraint
 *   where conrelid = 'public.projects'::regclass and contype = 'c';
 */
const DB_STATUS = ["draft", "active", "archived", "completed"];
const DB_VISIBILITY = ["private", "organization", "public"];

/** The column defaults, which the route's fallbacks must match. */
const DB_DEFAULTS = { status: "active", visibility: "private", priority: "medium" };

/** Extracts the `case "x":` labels inside a named function. */
function casesIn(fn: string): string[] {
  const start = ROUTE.indexOf(`function ${fn}(`);

  assert.ok(start > 0, `${fn} not found.`);

  /* Walk braces so the slice ends at the real function end. */
  let depth = 0;
  let started = false;
  let end = start;

  for (; end < ROUTE.length; end += 1) {
    const ch = ROUTE[end];
    if (ch === "{") { depth += 1; started = true; }
    else if (ch === "}") { depth -= 1; }
    if (started && depth === 0) break;
  }

  const body = ROUTE.slice(start, end + 1);

  return [...body.matchAll(/case\s+"([a-z_]+)"\s*:/g)].map((m) => m[1]!);
}

/** The value a normalizer falls back to. */
function fallbackOf(fn: string): string {
  const start = ROUTE.indexOf(`function ${fn}(`);
  const body = ROUTE.slice(start, ROUTE.indexOf("\n}", start));
  const m = body.match(/default:[\s\S]*?return\s+"([a-z_]+)"/);

  assert.ok(m, `${fn} has no default return.`);

  return m![1]!;
}

void describe("normalizeStatus matches projects_status_check", () => {
  void test("it accepts exactly the permitted values", () => {
    assert.deepEqual(
      casesIn("normalizeStatus").sort(),
      [...DB_STATUS].sort(),
      "The route's status vocabulary has drifted from the CHECK constraint.",
    );
  });

  void test("its fallback is a value the database permits", () => {
    const fallback = fallbackOf("normalizeStatus");

    assert.ok(
      DB_STATUS.includes(fallback),
      `CRITICAL: the default status "${fallback}" violates ` +
        `projects_status_check, so every create that omits status fails. ` +
        `This was the live defect.`,
    );

    assert.equal(fallback, DB_DEFAULTS.status, "Match the column default.");
  });

  void test('"planning" is gone', () => {
    /* The exact value that broke production. */
    assert.ok(
      !casesIn("normalizeStatus").includes("planning"),
      'CRITICAL: "planning" is not permitted by projects_status_check.',
    );
  });
});

void describe("normalizeVisibility matches projects_visibility_check", () => {
  void test("it accepts exactly the permitted values", () => {
    assert.deepEqual(
      casesIn("normalizeVisibility").sort(),
      [...DB_VISIBILITY].sort(),
      "The route's visibility vocabulary has drifted from the constraint.",
    );
  });

  void test("its fallback is permitted", () => {
    const fallback = fallbackOf("normalizeVisibility");

    assert.ok(DB_VISIBILITY.includes(fallback));
    assert.equal(fallback, DB_DEFAULTS.visibility);
  });

  void test('"workspace" is gone', () => {
    /*
     * Accepted by the old union, rejected by the constraint: a caller
     * passing it got a 500 rather than a 400.
     */
    assert.ok(
      !casesIn("normalizeVisibility").includes("workspace"),
      'CRITICAL: "workspace" violates projects_visibility_check.',
    );
  });
});

void describe("normalizePriority matches the column default", () => {
  void test("its fallback is the column default", () => {
    assert.equal(
      fallbackOf("normalizePriority"),
      DB_DEFAULTS.priority,
      "priority has no CHECK, but the fallback should match the schema.",
    );
  });

  void test('"normal" is replaced by "medium"', () => {
    assert.ok(casesIn("normalizePriority").includes("medium"));
  });
});

void describe("Ownership is still server-derived", () => {
  void test("owner_id and user_id come from the session", () => {
    /* Guarding the fix above did not loosen the authorization boundary. */
    assert.match(ROUTE, /owner_id:\s*\n?\s*userId/);
    assert.match(ROUTE, /const\s+userId\s*=\s*\n?\s*session\.userId/);
  });

  void test("the route never uses the service-role client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE/.test(ROUTE),
      "CRITICAL: projects must be written through the caller's RLS client.",
    );
  });
});
