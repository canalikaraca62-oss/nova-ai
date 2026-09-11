/**
 * SYRAVEN — no control lies about what it can do
 * tests/security/no-dead-controls.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * A button with no handler is not a neutral placeholder. It tells the
 * user a capability exists, accepts their click, and does nothing —
 * which is indistinguishable, from the outside, from a feature that is
 * silently broken. On a security surface it is worse: a dead "Set up"
 * beside "Two-factor authentication" implies an account is protectable
 * in a way it is not.
 *
 * Ten such controls were found in one sweep, including 2FA setup, a
 * password change, and a privacy-export request. An earlier audit had
 * passed over all of them, because it only looked for dead *links*.
 *
 * THE RULE
 *
 * Every <button> under app/ must either:
 *
 *   - do something: onClick, onSubmit, type="submit", or form=
 *   - or be honestly unavailable: `disabled` AND an explanation the
 *     user can actually reach (aria-describedby, aria-label, or title)
 *
 * "Disabled with no explanation" is not acceptable either. A greyed
 * control with no reason given is a dead end the user cannot reason
 * about.
 *
 * WHY aria-describedby AND NOT title
 *
 * `title` is not announced by most screen readers and never appears on
 * touch. It is accepted here only because two controls predate this
 * guard; new work should use aria-describedby pointing at visible text.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** Every .tsx under app/, excluding nothing — coverage is the point. */
function pageFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      pageFiles(full, found);
      continue;
    }

    if (entry.endsWith(".tsx")) found.push(full);
  }

  return found;
}

/**
 * Strips comments so prose describing a dead button is not mistaken
 * for one. Several files explain, in comments, exactly what was removed
 * and why — that text must not satisfy or trip this guard.
 */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/**
 * Returns each <button ...> opening tag, attributes only.
 *
 * Deliberately not a parser: it matches from `<button` to the closing
 * `>` of the opening tag, tolerating the multi-line attribute style
 * used throughout this codebase.
 */
function buttonTags(source: string): string[] {
  const tags: string[] = [];
  const pattern = /<button\b/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    let depth = 0;
    let index = match.index;

    /* Walk to the '>' that closes this opening tag, skipping the
       '>' that can appear inside a {() => ...} attribute value. */
    for (; index < source.length; index += 1) {
      const char = source[index];

      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }

    tags.push(source.slice(match.index, index + 1));
  }

  return tags;
}

function isAlive(tag: string): boolean {
  return (
    /\bonClick\b/.test(tag) ||
    /\bonSubmit\b/.test(tag) ||
    /\bonPointerDown\b/.test(tag) ||
    /type=["']submit["']/.test(tag) ||
    /\bform=/.test(tag)
  );
}

/**
 * True for a reusable primitive that takes its behaviour from a caller.
 *
 * `<button {...props} ref={ref}>` inside Button.tsx is not a dead
 * control — it is a correctly built component whose handler arrives
 * from whoever renders it. The first version of this guard could not
 * tell the difference and reported five such primitives as defects,
 * which is the same mistake an earlier guard in this repo made when it
 * flagged eighteen correct pages.
 *
 * Note this is narrow on purpose: only a spread or a forwarded ref
 * counts. A button in app/components/ui/ with neither is still judged
 * like any other, so a genuinely dead control cannot hide by living in
 * the primitives directory.
 */
function forwardsBehaviour(tag: string): boolean {
  return /\{\.\.\.\w+\}/.test(tag) || /\bref=\{/.test(tag);
}

function isHonestlyDisabled(tag: string): boolean {
  const disabled = /\bdisabled\b/.test(tag);
  if (!disabled) return false;

  return (
    /\baria-describedby=/.test(tag) ||
    /\btitle=/.test(tag) ||
    /\baria-label=/.test(tag)
  );
}

/* -------------------------------------------------------------------------- */
/*                             NO DEAD CONTROLS                               */
/* -------------------------------------------------------------------------- */

void describe("Every button either acts or says why it cannot", () => {
  void test("no button under app/ is inert and unexplained", () => {
    const offenders: string[] = [];

    for (const file of pageFiles(APP)) {
      const source = stripComments(read(file));

      for (const tag of buttonTags(source)) {
        if (isAlive(tag)) continue;
        if (forwardsBehaviour(tag)) continue;
        if (isHonestlyDisabled(tag)) continue;

        const label = tag.replace(/\s+/g, " ").slice(0, 100);
        offenders.push(`${relative(ROOT, file)}: ${label}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `These buttons accept a click and do nothing, with no explanation ` +
        `of why:\n  ${offenders.join("\n  ")}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      THE PALETTE TRIGGER STAYS WIRED                       */
/* -------------------------------------------------------------------------- */

void describe("The command palette trigger is connected", () => {
  const SIDEBAR = stripComments(
    read(join(APP, "components", "layout", "DesktopSidebar.tsx")),
  );

  const CHROME = stripComments(
    read(join(APP, "components", "layout", "AppChrome.tsx")),
  );

  void test("the sidebar trigger has a handler", () => {
    assert.match(
      SIDEBAR,
      /onClick=\{onOpenCommandPalette\}/,
      "The visible Cmd/Ctrl+K affordance must actually open the palette.",
    );
  });

  void test("the chrome supplies that handler", () => {
    /*
     * The prop is optional, so the sidebar compiles perfectly well
     * without it and the button goes quietly dead again. This is the
     * assertion that catches that — the type alone cannot.
     */
    assert.match(
      CHROME,
      /onOpenCommandPalette=\{/,
      "AppChrome must pass a palette opener, or the trigger is inert.",
    );
  });

  void test("the palette is controlled by the chrome", () => {
    assert.match(
      CHROME,
      /open=\{[A-Za-z]+\}/,
      "The palette's open state must be lifted so two things can open it.",
    );

    assert.match(
      CHROME,
      /onOpenChange=\{/,
      "Without onOpenChange the palette could open but never close.",
    );
  });

  void test("the trigger is not faked with a synthetic keystroke", () => {
    /*
     * Dispatching a fake keydown would have worked, and would have been
     * a lie about how the button and the shortcut relate.
     */
    assert.ok(
      !/new KeyboardEvent|dispatchEvent/.test(SIDEBAR),
      "The trigger must call the opener, not simulate a key press.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     SECURITY SURFACES STATE THE TRUTH                      */
/* -------------------------------------------------------------------------- */

void describe("Unavailable security features say so", () => {
  const PROFILE = stripComments(read(join(APP, "profile", "page.tsx")));

  void test("no invented claim about when the password changed", () => {
    /*
     * "Last updated recently" sat under a dead button. The page has no
     * password metadata of any kind, so that sentence was invented —
     * the same defect class as the fabricated activity logs removed
     * elsewhere, on the surface where it matters most.
     */
    assert.ok(
      !/Last updated recently/.test(PROFILE),
      "The profile page claims a password age it has no source for.",
    );
  });

  void test("2FA and password controls are disabled, not merely inert", () => {
    for (const id of [
      "profile-2fa-availability",
      "profile-password-availability",
      "profile-photo-availability",
    ]) {
      assert.ok(
        PROFILE.includes(id),
        `${id} must exist so the disabled control explains itself.`,
      );
    }
  });
});
