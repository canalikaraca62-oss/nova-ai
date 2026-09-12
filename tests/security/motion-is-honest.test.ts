/**
 * SYRAVEN — motion that means something, and stops when asked
 * tests/security/motion-is-honest.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * Two things, and the second is the one that matters.
 *
 * 1. The motion vocabulary stays a system. Before this, globals.css
 *    held six keyframes and seven utilities with ONE consumer between
 *    them, beside 400-odd hand-rolled Tailwind transitions. A scale
 *    nobody reaches for is not a design system; it is dead CSS that
 *    makes the stylesheet look like one. So the utilities must be
 *    built from the duration and easing tokens rather than literals --
 *    a utility with a hardcoded 240ms has quietly left the system.
 *
 * 2. Reduced motion is honoured, universally and with !important.
 *    This is not a preference about polish. Vestibular disorders make
 *    unexpected movement genuinely unpleasant, and a product that
 *    animates anyway has decided its own taste outranks that. The
 *    block covers every element and pseudo-element deliberately: a
 *    per-utility opt-out would be one forgotten class away from
 *    failing the people who asked.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED
 *
 * That any particular surface animates. Motion is not owed everywhere,
 * and a guard demanding it would push toward decoration. What is owed
 * is that whatever moves, moves from the same vocabulary and stops
 * when the reader asks it to.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(
  join(process.cwd(), "app", "globals.css"),
  "utf8",
);

/* -------------------------------------------------------------------------- */
/*                            REDUCED MOTION FIRST                            */
/* -------------------------------------------------------------------------- */

void describe("A request not to be moved is honoured", () => {
  void test("the reduced-motion block exists and is universal", () => {
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
        CSS,
      );

    assert.ok(
      block,
      "The reduced-motion block is gone. Every animation in the " +
        "product now runs for people who asked it not to.",
    );

    const body = block?.[1] ?? "";

    /*
     * The universal selector is the point. Scoping this to a list of
     * classes means the next animation added outside that list
     * silently ignores the preference.
     */
    assert.match(
      body,
      /\*,\s*\*::before,\s*\*::after/,
      "The block must cover every element and pseudo-element, not a " +
        "list of known animations.",
    );
  });

  void test("it cannot be overridden by specificity", () => {
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
        CSS,
      );

    const body = block?.[1] ?? "";

    for (const property of [
      "animation-duration",
      "transition-duration",
      "animation-iteration-count",
    ]) {
      const declaration = new RegExp(
        `${property}:[^;]*!important`,
      );

      assert.match(
        body,
        declaration,
        `${property} must carry !important, or a more specific rule ` +
          `anywhere in the product silently wins over the reader's ` +
          `stated preference.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        THE VOCABULARY IS A SYSTEM                          */
/* -------------------------------------------------------------------------- */

void describe("Motion is built from tokens, not literals", () => {
  void test("the duration and easing scales are defined", () => {
    for (const token of [
      "--duration-instant",
      "--duration-quick",
      "--duration-settle",
      "--duration-consider",
      "--ease-enter",
      "--ease-exit",
      "--ease-move",
    ]) {
      /*
       * Anchored on the declaration rather than the substring: a
       * property named `--x--duration-instant` contains
       * `--duration-instant:` and would satisfy a bare includes().
       * The same substring hole let a renamed role attribute past the
       * dialog guard until a mutation caught it.
       */
      const declared = new RegExp(
        `(?<![\\w-])${token.replace(/-/g, "\\-")}\\s*:`,
      );

      assert.match(
        CSS,
        declared,
        `${token} is missing. The scale is what makes four hundred ` +
          `scattered transitions cohere instead of multiplying.`,
      );
    }
  });

  void test("the motion utilities reach for the tokens", () => {
    /*
     * Anchored on each utility's own declaration rather than the file
     * as a whole: a literal duration inside one utility would
     * otherwise hide behind the tokens used by its neighbours.
     */
    /*
     * ONLY THE UTILITIES THAT ARE ACTUALLY USED.
     *
     * Six were defined. Four -- enter, rise, pop and press -- had zero
     * consumers, which is the exact dead-CSS defect this file's own
     * header describes and which the previous vocabulary died of: a
     * scale nobody reaches for is not a design system.
     *
     * They are deleted rather than force-adopted. An entrance
     * animation is only honest where content genuinely arrives, and
     * every candidate list page here filters on keystroke, so the
     * entrance would replay as the user types. There were no
     * bg-primary buttons for press feedback either.
     *
     * If a real entrance appears later, the keyframes are still here
     * and the utility is three lines.
     */
    const utilities = ["motion-dialog", "motion-backdrop"];

    for (const utility of utilities) {
      const rule = new RegExp(`\\.${utility}\\s*\\{([^}]*)\\}`);
      const match = rule.exec(CSS);

      assert.ok(match, `.${utility} is missing from globals.css.`);

      const body = match?.[1] ?? "";

      assert.match(
        body,
        /var\(--duration-/,
        `.${utility} hardcodes a duration instead of using the scale.`,
      );

      assert.match(
        body,
        /var\(--ease-/,
        `.${utility} hardcodes an easing instead of using the scale.`,
      );
    }
  });

  void test("no motion utility claims an AI state", () => {
    /*
     * AiActivity owns the states that mean something -- thinking,
     * approval, done, failed -- and each is driven by a real open
     * request. A CSS class named for one of them would be a second,
     * decorative source of the same claim, animating whether or not
     * anything is happening.
     */
    for (const forbidden of [
      "motion-thinking",
      "motion-working",
      "motion-processing",
      "motion-generating",
    ]) {
      assert.ok(
        !CSS.includes(forbidden),
        `.${forbidden} would animate a claim about AI activity that ` +
          `no request backs.`,
      );
    }
  });
});
