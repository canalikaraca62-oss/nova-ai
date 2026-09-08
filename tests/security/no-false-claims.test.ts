/**
 * SYRAVEN — the UI must not claim what it does not do
 *
 * WHY THIS FILE EXISTS
 *
 * A control that reports success while doing nothing is worse than a
 * missing feature: the user believes their data is saved, their account
 * is protected, or their request was sent. Several did exactly that.
 *
 *   Two-factor authentication  a toggle wrote a boolean to localStorage
 *                              and the UI reported 2FA as enabled. There
 *                              is no MFA enrolment, no TOTP and no
 *                              sign-in challenge anywhere in the repo.
 *
 *   Delete account             a live-looking destructive button with no
 *                              handler at all.
 *
 *   Change password /          four ActionCards whose component had no
 *   Active sessions /          onClick in its signature, so every
 *   Payment methods /          instance was inert by construction.
 *   Invoices
 *
 *   Profile "Save changes"     awaited a 700ms timeout and then said
 *                              "Changes saved successfully." Nothing was
 *                              written -- public.profiles holds billing
 *                              columns only, with nowhere to put a name,
 *                              bio or avatar.
 *
 * These assertions pin the honest state. Where a feature genuinely
 * cannot be implemented within the existing schema, the requirement is
 * that the UI says so -- not that it pretends.
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

/**
 * Strips comments so prose describing a fixed defect cannot satisfy
 * -- or fail -- a test about the defect itself.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const SETTINGS = stripComments(read("app", "settings", "page.tsx"));
const PROFILE = stripComments(read("app", "profile", "page.tsx"));

void describe("Two-factor authentication does not claim protection", () => {
  void test("the toggle is marked unavailable", () => {
    const row = SETTINGS.slice(
      SETTINGS.indexOf('title="Two-factor authentication"'),
      SETTINGS.indexOf('title="Two-factor authentication"') + 1200,
    );

    assert.match(
      row,
      /unavailable=/,
      "CRITICAL: the 2FA toggle reports a security state that does not " +
        "exist. No MFA enrolment is implemented anywhere.",
    );
  });

  void test("ToggleRow can actually be made non-interactive", () => {
    /* A prop the switch ignores would be decoration. */
    assert.match(
      SETTINGS,
      /disabled=\{Boolean\(unavailable\)\}/,
      "The unavailable state must disable the control.",
    );

    assert.match(
      SETTINGS,
      /if\s*\(\s*!unavailable\s*\)\s*onChange/,
      "An unavailable toggle must not mutate state when clicked.",
    );
  });
});

void describe("Destructive controls do not pretend to work", () => {
  void test("Delete account is disabled and explained", () => {
    const idx = SETTINGS.indexOf("Delete account");

    assert.ok(idx > 0, "Delete account not found.");

    const block = SETTINGS.slice(Math.max(0, idx - 700), idx + 400);

    assert.match(
      block,
      /disabled/,
      "CRITICAL: a destructive control with no handler tells the user " +
        "their data was deleted when nothing happened.",
    );

    assert.match(
      block,
      /not available yet/i,
      "The user must be told why the control does nothing.",
    );
  });
});

void describe("ActionCards perform a real action or say they cannot", () => {
  void test("the component accepts an onClick", () => {
    const start = SETTINGS.indexOf("function ActionCard({");

    assert.ok(start > 0, "ActionCard not found.");

    const signature = SETTINGS.slice(start, start + 600);

    assert.match(
      signature,
      /onClick\?:\s*\(\)\s*=>\s*void/,
      "CRITICAL: without onClick in the signature every instance is " +
        "inert by construction.",
    );

    assert.match(
      signature,
      /disabledReason\?:\s*string/,
      "A card with nothing to do must be able to say so.",
    );
  });

  void test("the button is actually wired", () => {
    assert.match(SETTINGS, /onClick=\{onClick\}/);
    assert.match(SETTINGS, /disabled=\{Boolean\(disabledReason\)\s*\|\|\s*busy\}/);
  });

  void test("every card either acts or declares itself unavailable", () => {
    /*
     * Walks each <ActionCard …/> and requires one of the two. A card
     * with neither is the original defect.
     */
    /*
      Only RENDER sites. `<ActionCard` also appears in the component
      definition; matching the JSX open tag followed by whitespace
      excludes it, and works whatever the file's line endings are.
    */
    const cards = SETTINGS
      .split(/<ActionCard\s/)
      .slice(1)
      .filter((chunk) => chunk.includes("title="));

    assert.ok(cards.length >= 4, `Expected at least 4 cards, saw ${cards.length}.`);

    for (const card of cards) {
      /*
        Cut at the CARD's closing tag. `indexOf("/>")` stopped at the
        self-closing icon element inside it, so the slice ended before
        the props and every card appeared untitled.
      */
      const end = card.search(/^\s*\/>/m);
      const body = end < 0 ? card : card.slice(0, end);
      const title = body.match(/title="([^"]+)"/)?.[1] ?? "(untitled)";

      assert.ok(
        /onClick=/.test(body) || /disabledReason=/.test(body),
        `"${title}" neither acts nor declares itself unavailable.`,
      );
    }
  });

  void test("password change uses the real reset route", () => {
    assert.match(
      SETTINGS,
      /fetch\(\s*["'`]\/api\/auth\/reset-password["'`]/,
      "Change password must send a real recovery email.",
    );
  });

  void test("billing cards open the real portal", () => {
    assert.match(
      SETTINGS,
      /fetch\(\s*["'`]\/api\/billing\/portal["'`]/,
      "Payment methods and Invoices must reach Stripe.",
    );
  });
});

void describe("Profile does not claim a save that cannot happen", () => {
  void test("the fake timeout save is gone", () => {
    assert.ok(
      !/setTimeout\(\s*resolve/.test(PROFILE),
      "CRITICAL: a simulated delay standing in for persistence.",
    );
  });

  void test('it no longer says "Changes saved successfully"', () => {
    assert.ok(
      !/Changes saved successfully/.test(PROFILE),
      "CRITICAL: the page claimed a save that never occurred.",
    );
  });

  void test("it states that editing is unavailable", () => {
    assert.match(
      PROFILE,
      /not available yet/i,
      "The user must be told the fields cannot be saved.",
    );
  });

  void test("the save button cannot be pressed", () => {
    const idx = PROFILE.indexOf("Save changes");
    const block = PROFILE.slice(Math.max(0, idx - 600), idx + 100);

    assert.match(block, /disabled/);
  });
});
