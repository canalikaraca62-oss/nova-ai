/**
 * SYRAVEN — pages that mutate data must talk to the server
 *
 * WHY THIS FILE EXISTS
 *
 * The dominant defect in this codebase is a page that renders a
 * hardcoded array and mutates it with setState, while a complete,
 * working CRUD API sits unused. The user creates something, sees it
 * appear, reloads, and it is gone — or deletes something and it comes
 * back.
 *
 * Confirmed and fixed here:
 *
 *   /tasks           create / status change / delete were setState-only,
 *                    with an id minted by crypto.randomUUID() that
 *                    matched no row. /api/tasks supports the full cycle
 *                    (verified live: POST 201, PATCH 200, DELETE 200).
 *
 *   /notifications   mark read, mark all read, delete and clear read
 *                    were all setState-only over four fabricated items.
 *
 * A type checker cannot see this, and neither can an API-level test.
 * These assertions tie each page to the endpoint it must call.
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

const TASKS = stripComments(read("app", "tasks", "page.tsx"));
const NOTIFICATIONS = stripComments(read("app", "notifications", "page.tsx"));

/** Pages whose mutations must reach a named endpoint. */
const WIRED: ReadonlyArray<{
  name: string;
  source: string;
  endpoint: string;
  methods: readonly string[];
}> = [
  {
    name: "/tasks",
    source: TASKS,
    endpoint: "/api/tasks",
    methods: ["POST", "PATCH", "DELETE"],
  },
  {
    name: "/notifications",
    source: NOTIFICATIONS,
    endpoint: "/api/notifications",
    methods: ["PATCH", "DELETE"],
  },
];

void describe("Mutating pages call their API", () => {
  for (const page of WIRED) {
    void test(`${page.name} loads from ${page.endpoint}`, () => {
      assert.ok(
        page.source.includes(`fetch("${page.endpoint}"`) ||
          page.source.includes(`fetch(\n        "${page.endpoint}"`) ||
          new RegExp(`fetch\\(\\s*\`?${page.endpoint.replace(/\//g, "\\/")}`).test(
            page.source,
          ),
        `${page.name} never calls ${page.endpoint}, so nothing it shows is real.`,
      );
    });

    for (const method of page.methods) {
      void test(`${page.name} issues a ${method}`, () => {
        assert.match(
          page.source,
          new RegExp(`method:\\s*["'\`]${method}["'\`]`),
          `${page.name} cannot persist without a ${method}.`,
        );
      });
    }

    void test(`${page.name} has no fabricated seed data`, () => {
      /*
       * A seeded array is what made the pages look populated: four
       * invented notifications and six invented tasks that no user ever
       * created, indistinguishable from real rows.
       */
      assert.ok(
        !/const\s+(initialTasks|INITIAL_NOTIFICATIONS)\s*[:=]/.test(page.source),
        `${page.name} still renders hardcoded rows as if they were the ` +
          `user's own data.`,
      );
    });

    void test(`${page.name} surfaces a failure`, () => {
      /* A silent rollback looks identical to a click that did nothing. */
      assert.match(
        page.source,
        /role="alert"/,
        `${page.name} must tell the user when a write fails.`,
      );
    });

    void test(`${page.name} reports loading`, () => {
      assert.match(
        page.source,
        /isLoading/,
        `${page.name} must distinguish "empty" from "not loaded yet".`,
      );
    });
  }
});

void describe("Optimistic updates roll back", () => {
  /*
   * Updating local state and never telling the server is the original
   * defect. Updating local state, failing the request, and KEEPING the
   * optimistic value is the same lie with extra steps.
   */
  for (const page of WIRED) {
    void test(`${page.name} restores previous state on failure`, () => {
      /*
        Counted, not merely present.

        A single `setX(previous)` anywhere satisfied the earlier check
        even after one was deleted, because the other handlers still
        had theirs -- so a mutation that silently kept an optimistic
        value survived. Every handler that captures `previous` must
        also restore it.
      */
      const captures = (page.source.match(/const\s+previous\s*=/g) ?? [])
        .length;

      const restores = (
        page.source.match(/set(?:Tasks|Notifications)\(previous\)/g) ?? []
      ).length;

      assert.ok(
        captures > 0,
        `${page.name} must capture state before an optimistic update.`,
      );

      assert.equal(
        restores,
        captures,
        `${page.name} captures ${captures} optimistic snapshots but ` +
          `rolls back ${restores}: a failed write would keep a value ` +
          `the server rejected.`,
      );
    });
  }
});

void describe("Ids come from the server", () => {
  void test("/tasks does not mint its own task id", () => {
    /*
     * createTask used crypto.randomUUID() and pushed the result into
     * local state, so the task existed only in that browser tab and its
     * id matched no row — a later PATCH or DELETE could never find it.
     */
    const create = TASKS.slice(
      TASKS.indexOf("const createTask"),
      TASKS.indexOf("const createTask") + 2500,
    );

    assert.ok(
      !/crypto\.randomUUID/.test(create),
      "CRITICAL: a client-minted id belongs to no database row.",
    );

    assert.match(
      create,
      /created\.id/,
      "The created task must adopt the id the server returned.",
    );
  });
});
