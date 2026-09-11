/**
 * SYRAVEN — One main landmark per page
 * tests/security/one-main-landmark.test.ts
 *
 * ACCESSIBILITY REGRESSION SUITE.
 *
 * WHAT THIS PINS
 *
 * A section that mounts AppChrome gets its `<main>` from the shell. A
 * page inside that section must therefore render a plain container, not
 * a second `<main>`: two main landmarks is invalid HTML and leaves a
 * screen reader with an ambiguous document — "skip to main content"
 * stops meaning one thing.
 *
 * WHY IT IS TESTED RATHER THAN JUST FIXED
 *
 * The conversion that mounted the shell was scripted, and the script
 * replaced only the FIRST `<main>` in each file. Three pages —
 * knowledge/[id], settings and tasks/[id] — render an early-return
 * branch with its own `<main>`, so they ended up nesting one landmark
 * inside another.
 *
 * Nothing caught it. Typecheck passed. The production build passed. The
 * whole suite passed. It compiled because the orphaned `</main>` still
 * closed *a* `<main>` — the markup was well-formed and wrong, which is
 * precisely the shape of defect that survives every automated gate a
 * project normally has.
 *
 * A browser check found it, and this test is what makes finding it
 * repeatable.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Sections whose layout mounts AppChrome.
 *
 * Derived from the filesystem rather than hardcoded, so mounting the
 * chrome on a new section automatically brings that section under this
 * rule instead of silently escaping it.
 */
function chromeMountedSections(): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(APP)) {
    const layout = join(APP, entry, "layout.tsx");

    if (!existsSync(layout)) continue;

    if (readFileSync(layout, "utf8").includes("AppChrome")) {
      found.push(entry);
    }
  }

  return found;
}

/** Every page.tsx beneath a directory. */
function pagesUnder(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      found.push(...pagesUnder(full));
      continue;
    }

    if (entry === "page.tsx") found.push(full);
  }

  return found;
}

/**
 * Strips comments so a note *describing* the rule is never mistaken for
 * a violation of it. Every converted page carries such a note.
 */
function stripComments(source: string): string {
  /*
   * Strips JSX comments and line comments — but NOT bare block
   * comments.
   *
   * This distinction cost a broken build. A scripted conversion
   * inserted an explanatory note as a bare block comment inside JSX
   * children, where it is literal text rather than a comment, and the
   * word "main" written as a tag inside that prose was parsed as a real
   * element. Thirty-one files stopped compiling.
   *
   * This guard reported 36 of 36 passing throughout, because it stripped
   * bare block comments before scanning — it deleted the very text that
   * was breaking the pages. A check that removes the evidence before
   * looking is worse than no check at all, because it is trusted.
   *
   * Only a real JSX comment is removed now. That form cannot contain a
   * parsed element, so nothing meaningful is lost by ignoring it, and a
   * bare block comment sitting where it does not belong stays visible to
   * the assertions below.
   */
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/*                                  THE RULE                                  */
/* -------------------------------------------------------------------------- */

void describe("A page under AppChrome emits no main of its own", () => {
  const sections = chromeMountedSections();

  void test("the chrome is actually mounted somewhere", () => {
    /*
     * Guards the guard. If no section mounted AppChrome, every
     * assertion below would pass vacuously and this suite would prove
     * nothing.
     */
    assert.ok(
      sections.length > 0,
      "No section mounts AppChrome — this suite would assert nothing.",
    );
  });

  for (const section of sections) {
    for (const page of pagesUnder(join(APP, section))) {
      const relative = page.slice(ROOT.length + 1).replace(/\\/g, "/");

      void test(`${relative} renders no <main>`, () => {
        const source = stripComments(readFileSync(page, "utf8"));

        /*
          Matched as a TAG, not as the string "<main>" anywhere.

          A real element opens a line (indented or not). The word can
          also appear mid-sentence inside an explanatory comment — every
          converted page carries one — and an earlier version of this
          check counted those, failing eighteen correct pages.

          The opposite mistake was worse and came first: stripping bare
          block comments before scanning hid a genuine break, because
          a bare block comment inside JSX children is literal text and
          the tag written in its prose really was parsed as an element.
          So prose is no longer deleted, and the match is anchored
          instead.
        */
        const opens = (source.match(/^[ \t]*<main[\s/>]/gm) ?? []).length;
        const closes = (source.match(/^[ \t]*<\/main>/gm) ?? []).length;

        assert.equal(
          opens,
          0,
          `${relative} opens ${opens} <main> element(s) while its ` +
            `section mounts AppChrome, which already provides one. ` +
            `Two main landmarks is invalid HTML. Use a plain container.`,
        );

        assert.equal(
          closes,
          0,
          `${relative} has ${closes} orphaned </main> closer(s).`,
        );
      });
    }
  }
});

/* -------------------------------------------------------------------------- */
/*                           THE SHELL STILL PROVIDES ONE                     */
/* -------------------------------------------------------------------------- */

void describe("The shell provides the landmark it took over", () => {
  void test("AppShell renders a main element", () => {
    /*
     * The other half of the rule. Removing `<main>` from every page is
     * only correct while the shell supplies one — otherwise the fix
     * would leave these pages with no main landmark at all, which is
     * worse than having two.
     */
    const shell = readFileSync(
      join(APP, "components", "layout", "AppShell.tsx"),
      "utf8",
    );

    assert.match(
      shell,
      /<main[\s>]/,
      "AppShell no longer renders <main>, so every page mounted under " +
        "it now has no main landmark at all.",
    );
  });

  void test("AppChrome mounts AppShell", () => {
    const chrome = readFileSync(
      join(APP, "components", "layout", "AppChrome.tsx"),
      "utf8",
    );

    assert.match(chrome, /<AppShell/);
  });
});
