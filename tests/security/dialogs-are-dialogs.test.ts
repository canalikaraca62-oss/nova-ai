/**
 * SYRAVEN — a dialog behaves like one, not merely looks like one
 * tests/security/dialogs-are-dialogs.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * Five reachable overlays -- Add memory, Create New Task, Create a new
 * team, Create new project, and the activity detail panel -- were
 * `fixed inset-0 z-50` divs. They looked like dialogs and behaved like
 * nothing: no role, no accessible name, no Escape on four of them, and
 * no focus management on any. Tab walked out of the panel into the page
 * it was covering, and dismissing one dropped focus to the top of the
 * document.
 *
 * WHY A GUARD RATHER THAN TRUST
 *
 * While wiring these I added role="dialog" and aria-labelledby to the
 * memory overlay and left the behaviour hook out. Typecheck passed --
 * an unused ref and an unused import are both type-legal -- so for a
 * few minutes that dialog CLAIMED semantics it did not implement,
 * which is worse than the honest div it replaced. Nothing but a guard
 * catches that shape.
 *
 * THE RULE
 *
 * If a surface presents itself as a dialog, it must carry all four:
 *
 *   role="dialog"        so a screen reader announces it
 *   aria-modal="true"    so the page behind leaves the reading order
 *   aria-labelledby      pointing at an id that EXISTS in the file
 *   useDialogBehaviour   Escape, focus trap, focus restoration
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/** Every page that renders a modal overlay of its own. */
const DIALOG_PAGES = [
  { name: "/memory", path: ["app", "memory", "page.tsx"] },
  { name: "/tasks", path: ["app", "tasks", "page.tsx"] },
  { name: "/teams", path: ["app", "teams", "page.tsx"] },
  { name: "/workspace", path: ["app", "workspace", "page.tsx"] },
  { name: "/activity", path: ["app", "activity", "page.tsx"] },
] as const;

/* -------------------------------------------------------------------------- */
/*                         THE FOUR THINGS A DIALOG OWES                      */
/* -------------------------------------------------------------------------- */

void describe("Every overlay that looks like a dialog is one", () => {
  for (const page of DIALOG_PAGES) {
    void test(`${page.name} announces itself as a dialog`, () => {
      const source = read(...page.path);

      /*
       * Anchored so an attribute PREFIX cannot satisfy it.
       *
       * The first version matched /role="dialog"/, which
       * `data-role="dialog"` contains -- so renaming the attribute to
       * something React renders as inert data left the guard green.
       * Verified by mutation, not reasoned about: this is the third
       * assertion in this suite to pass a defect because a substring
       * matched, and the other two were caught the same way.
       */
      assert.match(
        source,
        /(?<![\w-])role="dialog"/,
        `${page.name} renders a modal overlay with no dialog role, so ` +
          `a screen reader is never told one opened.`,
      );

      assert.match(
        source,
        /(?<![\w-])aria-modal="true"/,
        `${page.name} does not mark its dialog modal, so the page ` +
          `behind stays in the reading order underneath it.`,
      );
    });

    void test(`${page.name} gives its dialog a name that resolves`, () => {
      const source = read(...page.path);

      const labelled = /aria-labelledby="([^"]+)"/.exec(source);

      assert.ok(
        labelled,
        `${page.name}'s dialog has no accessible name.`,
      );

      const id = labelled?.[1] ?? "";

      /*
       * A dangling aria-labelledby is worse than none: the dialog
       * reports a name, the name resolves to nothing, and the user
       * hears an unnamed dialog with no indication anything is wrong.
       */
      assert.ok(
        source.includes(`id="${id}"`),
        `${page.name} points aria-labelledby at "${id}", which no ` +
          `element in the file defines.`,
      );
    });

    void test(`${page.name} implements the behaviour, not just the role`, () => {
      const source = read(...page.path);

      /*
       * Word-anchored for the same reason as the role attribute
       * above: `noopUseDialogBehaviour({` contains the bare name, so
       * an unanchored pattern would accept a stub that does nothing.
       */
      assert.match(
        source,
        /(?<![\w$])useDialogBehaviour\(\{/,
        `${page.name} declares dialog semantics without the keyboard ` +
          `contract behind them -- no Escape, no focus trap, no focus ` +
          `restoration. Claiming the role without the behaviour is ` +
          `worse than the plain div it replaced.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                        THE HOOK KEEPS ITS PROMISES                         */
/* -------------------------------------------------------------------------- */

void describe("The dialog hook does what its callers assume", () => {
  const HOOK = read(
    "app",
    "components",
    "ui",
    "useDialogBehaviour.ts",
  );

  void test("Escape closes", () => {
    assert.match(
      HOOK,
      /event\.key === "Escape"/,
      "Four of these overlays could not be closed from the keyboard " +
        "at all before this hook existed.",
    );
  });

  void test("Tab is trapped inside the panel", () => {
    assert.match(
      HOOK,
      /event\.key !== "Tab"/,
      "Without a trap, Tab leaves the dialog for the page it covers.",
    );

    assert.match(
      HOOK,
      /event\.shiftKey/,
      "Shift+Tab must cycle backwards inside the dialog too.",
    );
  });

  void test("focus returns to whatever opened it", () => {
    assert.match(
      HOOK,
      /(?<![\w$])previousActiveElementRef/,
      "Dismissing a dialog must not drop focus to the document.",
    );

    /*
     * Checked against the document because the trigger may have been
     * unmounted while the dialog was open -- deleting the row the
     * dialog was about, say -- and focusing a detached node silently
     * sends focus to the body instead.
     */
    assert.match(
      HOOK,
      /document\.contains\(previous\)/,
      "Restoring focus to a detached node sends it to the body.",
    );
  });

  void test("the page behind stops scrolling", () => {
    assert.match(
      HOOK,
      /document\.body\.style\.overflow = "hidden"/,
      "A dialog over a scrolling page scrolls the page behind it.",
    );
  });
});
