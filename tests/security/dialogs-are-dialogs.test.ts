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
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/**
 * Source with every comment removed.
 *
 * Both the scan and the assertions below read this rather than the raw
 * file, so neither a note quoting `role="dialog"` nor a commented-out
 * aria-modal can satisfy a check about live markup.
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

/*
  DISCOVERED, NOT LISTED.

  This was a hardcoded list of the five overlays I happened to be
  wiring when the guard was written. Three more reachable dialogs --
  the edit dialog on /tasks/[id], and rename and delete on
  /teams/[id] -- carried role="dialog" with no keyboard contract at
  all, and the guard reported green because their files were not on
  the list. I had written those three pages myself, earlier in the
  same session.

  A list maintained by hand covers what its author remembered. Scanning
  for the role covers what exists, including whatever is added next.
*/
function pagesDeclaringDialogs(
  dir: string,
  found: string[] = [],
): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      pagesDeclaringDialogs(full, found);
      continue;
    }

    if (!entry.endsWith(".tsx")) continue;

    /*
      Stripped before testing.

      A comment EXPLAINING why something is not a dialog quotes the
      role verbatim, so scanning raw source keeps discovering the file
      the comment was written to excuse. TopBar sat in this scan after
      its role changed to `search`, purely because the note above it
      mentioned the old one.

      This is the third time in this session a guard matched its own
      subject's prose. The sibling guards already strip; this one now
      strips too.
    */
    if (/(?<![\w-])role="dialog"/.test(executable(readFileSync(full, "utf8")))) {
      found.push(full);
    }
  }

  return found;
}

/*
  Components excused from the useDialogBehaviour requirement, each for
  a stated reason rather than because it was inconvenient.

  Dialog.tsx and Modal.tsx ARE the primitives: Modal implements the
  same focus trap this hook extracted, and requiring a component to
  call a hook carved out of itself is circular.

  CommandPalette owns its own keyboard model -- it is opened BY a key,
  moves selection with arrows, and manages its own focus and Escape. It
  also names itself with aria-label rather than aria-labelledby, which
  is equally valid and which an early version of my own browser probe
  wrongly reported as unlabelled.

  UpgradeModal, ShareChatDialog and TopBar have no importers. They are
  excused from the behaviour requirement, not from existing: if one is
  ever mounted, it fails this guard the same day.
*/
const BEHAVIOUR_EXEMPT = new Set([
  "Dialog.tsx",
  "Modal.tsx",
  "CommandPalette.tsx",
  "UpgradeModal.tsx",
  "ShareChatDialog.tsx",
  "TopBar.tsx",
]);

const DIALOG_PAGES = pagesDeclaringDialogs(join(ROOT, "app")).map(
  (path) => ({
    name: path.replace(ROOT, "").replace(/\\/g, "/"),
    file: path,
    exempt: BEHAVIOUR_EXEMPT.has(path.split(/[\\/]/).at(-1) ?? ""),
  }),
);

/* -------------------------------------------------------------------------- */
/*                         THE FOUR THINGS A DIALOG OWES                      */
/* -------------------------------------------------------------------------- */

void describe("Every overlay that looks like a dialog is one", () => {
  void test("at least one dialog was discovered", () => {
    /*
     * A scan that silently finds nothing would make every test below
     * vacuously pass -- the classic way a derived guard stops
     * guarding.
     */
    assert.ok(
      DIALOG_PAGES.length >= 5,
      `Only ${DIALOG_PAGES.length} dialogs found. The scan is broken, ` +
        `and every assertion below it is passing on an empty set.`,
    );
  });

  for (const page of DIALOG_PAGES) {
    void test(`${page.name} announces itself as a dialog`, () => {
      const source = executable(readFileSync(page.file, "utf8"));

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
      const source = executable(readFileSync(page.file, "utf8"));

      const labelled = /aria-labelledby="([^"]+)"/.exec(source);

      /*
       * aria-label is equally valid and is what CommandPalette uses.
       * Only a labelledby that points nowhere is a defect.
       */
      if (!labelled) {
        assert.match(
          source,
          /aria-label="[^"]+"/,
          `${page.name}'s dialog has no accessible name.`,
        );

        return;
      }

      const id = labelled[1] ?? "";

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
      /*
       * The primitives and the palette own their own keyboard model;
       * the unreachable components are excused until something mounts
       * them. Each exemption is named and reasoned at BEHAVIOUR_EXEMPT
       * rather than being a quiet hole in the scan.
       */
      if (page.exempt) return;

      const source = executable(readFileSync(page.file, "utf8"));

      /*
       * COUNTED, NOT MERELY PRESENT.
       *
       * The first version asserted that useDialogBehaviour appeared
       * somewhere in the file. /teams/[id] holds TWO dialogs -- rename
       * and delete -- so unwiring either one left the other's call
       * behind and the assertion still matched. Verified by mutation:
       * both single-dialog mutations passed a guard that was supposed
       * to catch exactly them.
       *
       * A file with N dialogs needs N calls. Word-anchored because
       * `noopUseDialogBehaviour({` contains the bare name.
       */
      const dialogCount = (
        source.match(/(?<![\w-])role="dialog"/g) ?? []
      ).length;

      const wiredCount = (
        source.match(/(?<![\w$])useDialogBehaviour\(\{/g) ?? []
      ).length;

      assert.ok(
        wiredCount >= dialogCount,
        `${page.name} declares ${dialogCount} dialog(s) but wires ` +
          `${wiredCount}. A dialog with the role and no keyboard ` +
          `contract -- no Escape, no focus trap, no focus restoration ` +
          `-- is worse than the plain div it replaced.`,
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
