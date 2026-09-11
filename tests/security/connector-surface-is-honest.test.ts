/**
 * SYRAVEN — the connector page says what is true
 * tests/security/connector-surface-is-honest.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * /connectors lists five providers and everything SYRAVEN could do in
 * each one. Nothing is connected, and nothing CAN be connected in this
 * deployment: the connection table's migration is written but not
 * applied, and OAuth client credentials are secrets that are not
 * present.
 *
 * A page in that position has two failure modes, and they pull in
 * opposite directions:
 *
 *   1. Offer a Connect button anyway. It would be the thirteenth dead
 *      control in a product that has spent this session removing
 *      twelve, and the most convincing one — a user has every reason
 *      to expect that button to work.
 *
 *   2. Hardcode "unavailable" beside each capability. That reads as
 *      honest and is not: it would keep saying unavailable after a
 *      connection existed, and it would say it for reasons the
 *      resolver never gave.
 *
 * So the rule is narrow. The page must ASK resolveAvailability and
 * render what it returns, and it must not invent a control that cannot
 * act. If a connection ever exists, the same code tells the truth about
 * that without being edited.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/**
 * Strips commentary.
 *
 * The page explains at length why there is no Connect button, naming
 * the very thing forbidden below. A substring check against commented
 * source would match that explanation rather than any code.
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

const PAGE = executable(read("app", "connectors", "page.tsx"));

const SIDEBAR = executable(
  read("app", "components", "layout", "DesktopSidebar.tsx"),
);

const MOBILE_NAV = executable(
  read("app", "components", "layout", "MobileNav.tsx"),
);

/* -------------------------------------------------------------------------- */
/*                        AVAILABILITY IS ASKED, NOT TOLD                     */
/* -------------------------------------------------------------------------- */

void describe("The page reports what the resolver decides", () => {
  void test("it calls resolveAvailability", () => {
    assert.match(
      PAGE,
      /resolveAvailability\(/,
      "Availability must come from the resolver the server uses, not " +
        "from a literal on the page.",
    );
  });

  void test("the message shown is the resolver's own", () => {
    /*
     * `availability.message` is written by resolveAvailability for a
     * person, and is guaranteed to carry no token, account id or
     * provider error body. A sentence composed here instead could drift
     * from what the server would actually do.
     */
    assert.match(
      PAGE,
      /availability\.message/,
      "The reason shown must be the one the resolver produced.",
    );

    assert.match(
      PAGE,
      /availability\.available/,
      "The page must branch on the resolver's verdict.",
    );
  });

  void test("the catalogue comes from the capability definitions", () => {
    /*
     * Anchored on the CALL SITE, not the identifier.
     *
     * The first version matched /INTEGRATION_PROVIDERS/, which the
     * import line satisfies on its own. Replacing the actual iteration
     * with a local ["gmail"] array left the guard green — verified by
     * mutation, not assumed. A guard that a defect walks past is worse
     * than no guard, because it certifies the walk.
     */
    for (const [name, pattern] of [
      ["the provider list", /INTEGRATION_PROVIDERS\.map\(/],
      ["each provider's capabilities", /capabilitiesForProvider\(/],
      ["provider names", /providerLabel\(/],
    ] as const) {
      assert.match(
        PAGE,
        pattern,
        `${name} must come from lib/integrations, not a local array.`,
      );
    }
  });

  void test("no connection is fabricated", () => {
    /*
     * The resolver takes a ConnectionSnapshot or null. Null is the
     * truthful argument here — no table, therefore no connection — and
     * building a snapshot object on this page would be inventing one.
     */
    assert.ok(
      !/status:\s*["']active["']/.test(PAGE),
      "A connection cannot be constructed on the page; none exists.",
    );

    assert.ok(
      !/grantedScopes\s*:/.test(PAGE),
      "Granted scopes are a property of a real connection.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        NO CONTROL THAT CANNOT ACT                          */
/* -------------------------------------------------------------------------- */

void describe("Nothing offers to connect what cannot be connected", () => {
  void test("there is no connect control", () => {
    /*
     * Not a button, not a link, not a form. Connecting needs a table
     * that is not applied and credentials that are not present, so any
     * affordance for it is a promise the deployment cannot keep.
     */
    assert.ok(
      !/<button/.test(PAGE),
      "A button on this page could not do anything.",
    );

    assert.ok(
      !/<form/.test(PAGE),
      "There is nothing to submit.",
    );

    for (const forbidden of [
      /href=["'][^"']*oauth/i,
      /href=["'][^"']*\/connect/i,
      /signIn\(|authorize\(/,
    ]) {
      assert.ok(
        !forbidden.test(PAGE),
        `The page offers ${String(forbidden)}, which cannot complete.`,
      );
    }
  });

  void test("the missing pieces are named rather than implied", () => {
    assert.match(
      PAGE,
      /Nothing is connected yet/,
      "The state must be stated, not left for the user to infer from " +
        "a page of greyed rows.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            IT CAN BE REACHED                               */
/* -------------------------------------------------------------------------- */

void describe("The page is reachable", () => {
  /*
     A page nobody can navigate to is the same defect as a dead link,
     arrived at from the other side. /teams/[id] sat unreachable in this
     codebase for exactly that reason.
  */
  void test("both navigations link to it", () => {
    assert.match(
      SIDEBAR,
      /href:\s*["']\/connectors["']/,
      "The desktop sidebar must offer /connectors.",
    );

    assert.match(
      MOBILE_NAV,
      /href:\s*["']\/connectors["']/,
      "The mobile navigation must offer /connectors.",
    );
  });
});
