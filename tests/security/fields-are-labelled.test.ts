/**
 * SYRAVEN — a label a screen reader can follow
 * tests/security/fields-are-labelled.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * /settings renders its fields through a FieldGroup wrapper that took a
 * `label` string and rendered it as a bare <label> SIBLING of the
 * control:
 *
 *     <label>Workspace name</label>
 *     <p>description</p>
 *     <div>{children}</div>
 *
 * Every field looked labelled and none of them was. A <label> with no
 * htmlFor, wrapping nothing, names no control -- so all five settings
 * fields announced as unlabelled: workspace name, language, timezone,
 * display name and email address.
 *
 * WHY NOTHING ELSE CAUGHT IT
 *
 * Typecheck cannot: a sibling label is valid TSX. Lint's a11y rules
 * check that a <label> has text, not that its text reaches a field.
 * And four separate greps of my own missed it, because the association
 * is absent rather than wrong -- there is no incorrect string to find,
 * only a missing attribute.
 *
 * Reading the component was the only thing that found it, which is
 * exactly the kind of defect that needs a guard rather than vigilance.
 *
 * THE RULE
 *
 *   - FieldGroup must render htmlFor on its label
 *   - every FieldGroup usage must pass fieldId
 *   - every fieldId passed must match an id that exists in the file
 *
 * The third assertion is the one that matters. The first two can both
 * hold while the id points at nothing, and a label pointing at a
 * missing control is no better than no label at all.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Source with comments removed.
 *
 * This file's own explanation quotes `<label>` and `htmlFor`, and a
 * guard that reads raw source would match its own prose -- which has
 * happened three times in this codebase already.
 */
function executable(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*"))
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const SETTINGS = executable(
  readFileSync(join(ROOT, "app", "settings", "page.tsx"), "utf8"),
);

/* -------------------------------------------------------------------------- */
/*                        THE WRAPPER NAMES ITS FIELD                         */
/* -------------------------------------------------------------------------- */

void describe("A settings label names the control beneath it", () => {
  void test("FieldGroup associates its label with a field", () => {
    /*
     * Sliced from the declaration rather than matched to a closing
     * brace, after two failures at exactly that:
     *
     *   `[\s\S]*?\n\}`   stopped at the destructuring pattern's own
     *                    close, 75 characters in, long before the JSX
     *                    body where htmlFor lives.
     *
     *   `[\s\S]*?\n\}\n` matched nothing: this file is CRLF, so the
     *                    brace is followed by \r\n and the pattern
     *                    never closed.
     *
     * A fixed slice cannot be defeated by either. It is coarse, and
     * coarse is the right trade for a check that only needs to see
     * whether one attribute appears inside one small function.
     */
    const start = SETTINGS.indexOf("function FieldGroup(");

    const definition =
      start === -1 ? "" : SETTINGS.slice(start, start + 1200);

    assert.ok(
      definition.length > 0,
      "FieldGroup is gone. If the settings fields were rewritten, this " +
        "guard needs rewriting with them rather than deleting.",
    );

    assert.match(
      definition,
      /htmlFor=\{fieldId\}/,
      "FieldGroup renders a bare <label> again. A label that is a " +
        "sibling of the control names nothing, and every field under " +
        "it announces as unlabelled while looking labelled on screen.",
    );
  });

  void test("fieldId is required, not optional", () => {
    /*
     * Sliced from the declaration rather than matched to a closing
     * brace, after two failures at exactly that:
     *
     *   `[\s\S]*?\n\}`   stopped at the destructuring pattern's own
     *                    close, 75 characters in, long before the JSX
     *                    body where htmlFor lives.
     *
     *   `[\s\S]*?\n\}\n` matched nothing: this file is CRLF, so the
     *                    brace is followed by \r\n and the pattern
     *                    never closed.
     *
     * A fixed slice cannot be defeated by either. It is coarse, and
     * coarse is the right trade for a check that only needs to see
     * whether one attribute appears inside one small function.
     */
    const start = SETTINGS.indexOf("function FieldGroup(");

    const definition =
      start === -1 ? "" : SETTINGS.slice(start, start + 1200);

    /*
     * `fieldId?: string` would let a caller omit it and silently
     * restore the defect, with the type system reporting nothing.
     */
    assert.ok(
      !/fieldId\?\s*:/.test(definition),
      "fieldId is optional. An optional association is one forgotten " +
        "prop away from reverting, and nothing would say so.",
    );
  });

  void test("every FieldGroup passes an id that exists", () => {
    const usages = [
      ...SETTINGS.matchAll(/<FieldGroup([\s\S]*?)>/g),
    ];

    assert.ok(
      usages.length >= 5,
      `Only ${usages.length} FieldGroup usages found. The scan is ` +
        `broken, and the assertions below it are passing on an empty ` +
        `set.`,
    );

    for (const usage of usages) {
      const attributes = usage[1] ?? "";

      const fieldId = /fieldId="([^"]+)"/.exec(attributes)?.[1];

      assert.ok(
        fieldId,
        `A FieldGroup renders without fieldId:\n${attributes.trim().slice(0, 120)}`,
      );

      /*
       * The association must resolve. A label pointing at an id no
       * element carries is indistinguishable, to a screen reader, from
       * no label at all -- except that it looks correct in review.
       */
      assert.ok(
        SETTINGS.includes(`id="${fieldId}"`),
        `FieldGroup points htmlFor at "${fieldId}", which no control ` +
          `in the file defines.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                     SEARCH FIELDS CARRY THEIR OWN NAME                     */
/* -------------------------------------------------------------------------- */

void describe("A search field is named, not merely placeheld", () => {
  /*
   * A placeholder is not an accessible name. It disappears the moment
   * the field has content, and screen readers treat it inconsistently
   * -- some announce it, some do not, and none should be relied on.
   *
   * These search inputs had a decorative magnifying-glass icon and a
   * placeholder, and nothing else. A third, on /privacy/activity, left
   * with that page when Phase 2 retired it (PURIFICATION_EVIDENCE.md
   * P2-P03).
   */
  const SEARCH_PAGES = [
    { name: "/marketplace", path: ["app", "marketplace", "page.tsx"] },
    { name: "/studio", path: ["app", "studio", "page.tsx"] },
  ] as const;

  for (const page of SEARCH_PAGES) {
    void test(`${page.name} names its search field`, () => {
      const source = executable(
        readFileSync(join(ROOT, ...page.path), "utf8"),
      );

      /*
       * Anchored on the search input's own attributes rather than on a
       * self-closing tag.
       *
       * The first version required `/>` within 400 characters of
       * type="search". The real markup carries a className string that
       * pushes the close past 500, so the pattern matched nothing and
       * the assertion reported "no search input" on three pages that
       * each have one. That is a guard failing on correct code, which
       * is the same class of defect it exists to prevent.
       */
      const searchInput =
        /<input\b[^>]*?type="(?:search|text)"[^>]*/.exec(source)?.[0] ??
        "";

      assert.ok(
        searchInput.length > 0,
        `${page.name} has no search input to check.`,
      );

      assert.match(
        searchInput,
        /aria-label="[^"]+"/,
        `${page.name}'s search field has only a placeholder. A ` +
          `placeholder vanishes on input and is not an accessible name.`,
      );
    });
  }
});
