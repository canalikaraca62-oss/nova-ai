/**
 * SYRAVEN — No unreachable state layer
 * tests/security/no-unreachable-state.test.ts
 *
 * MAINTAINABILITY REGRESSION SUITE.
 *
 * WHAT WAS REMOVED
 *
 * app/context/ held seven providers and app/hooks/ twelve hooks —
 * 14,879 lines. Exactly one of them, WorkspaceContext, was ever mounted
 * or imported. The other eighteen files were unreachable: no page
 * imported them, nothing rendered their providers, and no dynamic
 * import referenced them. A third of the app directory.
 *
 * WHY IT MATTERED MORE THAN ITS SIZE
 *
 * ProjectContext was the clearest case. It was a complete, careful,
 * 1,406-line project store — create, update, archive, members, tags —
 * persisting everything to localStorage under "syraven-projects", with
 * the real fetch to /api/projects sitting commented out inside
 * refreshProjects(). A reader finding it would reasonably conclude that
 * projects were browser-local by design, when in fact a secure,
 * RLS-enforced /api/projects had existed all along and /workspace was
 * wired straight to it.
 *
 * Dead code that contradicts live code is worse than dead code. It
 * makes the wrong thing look like the intended thing.
 *
 * WHAT THIS TEST PINS
 *
 * A state module has to be reachable from something that renders. The
 * rule is not "no contexts" — WorkspaceContext is legitimate and used —
 * it is that adding one obliges you to wire it up.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

/** Every .ts/.tsx file under app/, lib/ and services/. */
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      found.push(full);
    }
  }

  return found;
}

const ALL_SOURCES = [
  ...sourceFiles(join(ROOT, "app")),
  ...sourceFiles(join(ROOT, "lib")),
  ...sourceFiles(join(ROOT, "services")),
];

/* -------------------------------------------------------------------------- */
/*                             REACHABILITY RULE                              */
/* -------------------------------------------------------------------------- */

void describe("Every state module is reachable", () => {
  const CONTEXT_DIR = join(ROOT, "app", "context");

  const contexts = existsSync(CONTEXT_DIR)
    ? readdirSync(CONTEXT_DIR).filter((f) => f.endsWith(".tsx"))
    : [];

  void test("there is at least one context, and it is not assumed", () => {
    /*
     * Guards the guard: if app/context/ were emptied entirely, the loop
     * below would vacuously pass and this suite would prove nothing.
     */
    assert.ok(
      contexts.length > 0,
      "app/context/ is empty — this suite would assert nothing.",
    );
  });

  for (const file of contexts) {
    const name = file.replace(/\.tsx$/, "");

    void test(`${name} is imported by something that renders`, () => {
      const importers = ALL_SOURCES.filter((source) => {
        if (source.startsWith(CONTEXT_DIR)) {
          /*
           * A context importing a sibling does not make either
           * reachable — that is how a mutually-referential island of
           * dead code survives a naive check.
           */
          return false;
        }

        return new RegExp(
          `from\\s+["'][^"']*context/${name}["']`,
        ).test(readFileSync(source, "utf8"));
      });

      assert.ok(
        importers.length > 0,
        `app/context/${file} is imported by nothing. Either wire it to ` +
          `a page or provider, or delete it: an unreachable state layer ` +
          `reads as the intended way to do something it does not do. ` +
          `ProjectContext persisted projects to localStorage with the ` +
          `real /api/projects call commented out inside it.`,
      );
    });
  }

  void test("app/hooks does not return as an unreachable island", () => {
    const HOOKS_DIR = join(ROOT, "app", "hooks");

    if (!existsSync(HOOKS_DIR)) {
      /* The expected state: the directory was removed entirely. */
      return;
    }

    const hooks = readdirSync(HOOKS_DIR).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
    );

    for (const hook of hooks) {
      const name = hook.replace(/\.tsx?$/, "");

      const importers = ALL_SOURCES.filter((source) => {
        if (source.startsWith(HOOKS_DIR)) {
          return false;
        }

        return new RegExp(`from\\s+["'][^"']*hooks/${name}["']`).test(
          readFileSync(source, "utf8"),
        );
      });

      assert.ok(
        importers.length > 0,
        `app/hooks/${hook} is imported by nothing outside app/hooks. ` +
          `All twelve hooks were unreachable before they were removed.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          NO PARALLEL PERSISTENCE                           */
/* -------------------------------------------------------------------------- */

void describe("Durable data does not live in the browser", () => {
  /**
   * Keys that would indicate a client-side store standing in for the
   * database. Per-viewer conveniences are fine; a projects table is not.
   */
  const FORBIDDEN = [
    "syraven-projects",
    "syraven-tasks",
    "syraven-knowledge",
    "syraven-notifications",
    "syraven-chats",
  ];

  void test("no page or context keeps records in localStorage", () => {
    const offenders: string[] = [];

    for (const source of ALL_SOURCES) {
      const content = readFileSync(source, "utf8");

      for (const key of FORBIDDEN) {
        if (content.includes(key)) {
          offenders.push(`${source.replace(ROOT, "")} -> ${key}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "A browser store is standing in for the database. Records kept " +
        "this way do not survive a different device, are invisible to " +
        "the server, and cannot be reached by an agent acting on the " +
        "user's behalf.",
    );
  });

  void test("no live API call is commented out beside a local fallback", () => {
    /*
     * The specific shape that made ProjectContext misleading: a real
     * fetch preserved in a comment, with a localStorage read running in
     * its place. It reads as a decision rather than an omission.
     */
    const offenders: string[] = [];

    for (const source of ALL_SOURCES) {
      const content = readFileSync(source, "utf8");

      const commentedFetch =
        /^\s*\*\s*(const\s+\w+\s*=\s*)?await\s+fetch\(/m.test(content);

      if (commentedFetch && /localStorage/.test(content)) {
        offenders.push(source.replace(ROOT, ""));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "A commented-out fetch sits beside a localStorage read. Either " +
        "call the endpoint or say plainly that the data is local.",
    );
  });
});
