/**
 * SYRAVEN — AI activity must be driven, never self-driving
 * tests/security/ai-activity-is-driven.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * AiActivity renders what the system is doing. Its honesty rests on one
 * property: every state comes from a prop, so the only thing that can
 * move it from "working" to "completed" is a caller reacting to a real
 * response.
 *
 * WHY IT NEEDS A TEST
 *
 * This product shipped eleven surfaces that claimed work the system
 * never performed — a stock photograph presented as a generated image,
 * a 700ms sleep ending in "Installed", eight invented activity events.
 * The common shape was always the same: a timer advancing a visual that
 * nothing real was behind.
 *
 * A progress indicator that advances by itself is indistinguishable
 * from one reporting genuine work. So the component must not be able to
 * do that, and this is what keeps it that way.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const SOURCE = readFileSync(
  join(ROOT, "app", "components", "ui", "AiActivity.tsx"),
  "utf8",
);

/**
 * Strips JSX comments and line comments, leaving bare block comments in
 * place.
 *
 * Deliberate: a sibling guard once stripped bare block comments before
 * scanning and thereby deleted the very text that was breaking a build,
 * reporting green throughout. Here the risk runs the other way — the
 * explanatory prose mentions `setTimeout` by name — so assertions below
 * are anchored to code shapes rather than to bare substrings.
 */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const CODE = code(SOURCE);

/* -------------------------------------------------------------------------- */
/*                              NO SELF-DRIVING                               */
/* -------------------------------------------------------------------------- */

void describe("AiActivity cannot advance itself", () => {
  void test("it owns no timer", () => {
    /*
     * Anchored to a CALL, not the word. The file's own comments discuss
     * setTimeout to explain why it is absent, and a substring match
     * would fail on the explanation rather than on the defect.
     */
    for (const call of [
      /\bsetTimeout\s*\(/,
      /\bsetInterval\s*\(/,
      /\brequestAnimationFrame\s*\(/,
    ]) {
      assert.ok(
        !call.test(CODE),
        `AiActivity calls ${String(call)}. A timer is how a visual ` +
          `advances without anything real behind it, which is exactly ` +
          `the defect this component exists to avoid.`,
      );
    }
  });

  void test("it holds no state of its own", () => {
    /*
     * No useState / useReducer / useEffect. With no internal state
     * there is nothing for a timer or a transition to mutate, so the
     * rendered state can only be the prop it was given.
     */
    for (const hook of [
      /\buseState\s*[(<]/,
      /\buseReducer\s*[(<]/,
      /\buseEffect\s*\(/,
    ]) {
      assert.ok(
        !hook.test(CODE),
        `AiActivity uses ${String(hook)}. Internal state lets the ` +
          `component change what it reports without the caller — and ` +
          `without anything having happened.`,
      );
    }
  });

  void test("the state is a required prop", () => {
    assert.match(
      CODE,
      /state:\s*AiActivityState/,
      "The rendered state must be supplied by the caller.",
    );

    assert.ok(
      !/state\s*=\s*["']/.test(CODE),
      "A defaulted state would let the component render an activity " +
        "claim the caller never made.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          ONLY LIVE WORK ANIMATES                           */
/* -------------------------------------------------------------------------- */

void describe("Motion is reserved for work in flight", () => {
  void test("exactly one state animates", () => {
    /*
     * A settled state that still pulses implies activity that has
     * already stopped. Only `thinking` corresponds to an open request.
     */
    const animated = [...CODE.matchAll(/animated:\s*(true|false)/g)].map(
      (m) => m[1],
    );

    assert.ok(
      animated.length >= 4,
      `Expected every state to declare whether it animates; found ${animated.length}.`,
    );

    assert.equal(
      animated.filter((value) => value === "true").length,
      1,
      "Exactly one state — the in-flight one — may animate.",
    );
  });

  void test("it reuses the product's motion vocabulary", () => {
    /*
     * The existing utility, not a new keyframe. globals.css already
     * carries a global prefers-reduced-motion block covering
     * `*, *::before, *::after`, so reusing it inherits that.
     */
    assert.match(
      CODE,
      /animate-syraven-pulse/,
      "Use the existing motion utility rather than inventing a second " +
        "vocabulary.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        NO STATE WITHOUT A REAL SOURCE                      */
/* -------------------------------------------------------------------------- */

void describe("Every state corresponds to something real", () => {
  void test("there is no streaming state", () => {
    /*
     * app/chat/page.tsx has no client-side token streaming — no reader,
     * no decoder, no event source. A token-by-token visual there would
     * be theatre, so the vocabulary deliberately omits it until
     * streaming is actually wired.
     */
    /*
      Anchored to the state VOCABULARY, not to the word anywhere.

      The first version asserted the string "streaming" was absent from
      the file — and failed on the component's own comment explaining
      why the state is deliberately omitted. The code was correct and
      the test was wrong, which is the same mistake a sibling guard made
      by matching a bare substring instead of a code shape.

      A real state would appear as a union member and as a key in
      STATES. Both are checked; prose is not.
    */
    const union = CODE.slice(
      CODE.indexOf("export type AiActivityState"),
      CODE.indexOf("interface StateStyle"),
    );

    assert.ok(union.length > 0, "The state union is missing.");

    assert.ok(
      !/\|\s*"streaming"/.test(union),
      "A streaming state would have nothing real behind it today: the " +
        "chat page has no client-side token streaming.",
    );

    assert.ok(
      !/^\s*streaming:\s*\{/m.test(CODE),
      "A streaming entry in STATES would render an activity claim with " +
        "no source.",
    );
  });

  void test("idle renders nothing", () => {
    assert.match(
      CODE,
      /state === "idle"[\s\S]{0,200}return null/,
      "Idle must render nothing — a quiet indicator still suggests " +
        "something is running.",
    );
  });

  void test("approval is not styled as a failure", () => {
    /*
     * A plan stopping for a human is the safeguard working. Showing it
     * in the failure colour teaches users to dismiss it.
     */
    const approval = CODE.slice(
      CODE.indexOf("approval: {"),
      CODE.indexOf("done: {"),
    );

    assert.ok(approval.length > 0, "The approval state is missing.");

    assert.ok(
      !/destructive/.test(approval),
      "Approval must be visually distinct from failure.",
    );
  });
});
