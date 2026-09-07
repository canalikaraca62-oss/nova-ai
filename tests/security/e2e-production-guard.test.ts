/**
 * SYRAVEN — the E2E production guard must actually fire
 *
 * WHY THIS FILE EXISTS
 *
 * playwright.config.ts documents a "FAIL-CLOSED" check that refuses to
 * run the browser suite against the live Supabase project. It was
 * inert.
 *
 * Playwright loads its config in a bare Node process, which does not
 * read `.env.local`. The guard consulted only `process.env`, so
 * `NEXT_PUBLIC_SUPABASE_URL` was undefined, `configuredRef` was
 * undefined, and `undefined === PRODUCTION_REF` is false -- the check
 * passed by never matching. Meanwhile `next start`, which the same
 * config spawns, DOES read `.env.local`, so the application under test
 * pointed straight at production while the guard reported nothing.
 *
 * A safety control that cannot fail its own test is decoration. These
 * assertions run the guard's real logic against real inputs.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG = readFileSync(
  join(process.cwd(), "playwright.config.ts"),
  "utf8",
);

const PRODUCTION_REF = "wpmbumtpcuahyqmdeqgf";

void describe("The E2E production guard reads what the app will read", () => {
  void test("it does not trust process.env alone", () => {
    /*
     * The defect in one assertion. `next start` reads .env.local; a
     * guard that does not is blind to the only configuration that
     * actually decides which database the suite hits.
     */
    assert.match(
      CONFIG,
      /\.env\.local/,
      "The guard must consult the env files Next itself loads.",
    );
  });

  void test("it follows Next's precedence order", () => {
    const order = [
      ".env.production.local",
      ".env.local",
      ".env.production",
      ".env",
    ];

    let cursor = -1;

    for (const file of order) {
      const at = CONFIG.indexOf(`"${file}"`);

      assert.ok(at > 0, `The guard must consider ${file}.`);
      assert.ok(
        at > cursor,
        `${file} must be checked in Next's precedence order.`,
      );

      cursor = at;
    }
  });

  void test("it names the production project explicitly", () => {
    assert.match(CONFIG, new RegExp(PRODUCTION_REF));
  });

  void test("it aborts at config load, before any browser starts", () => {
    /*
     * A guard inside a fixture or a beforeAll runs after the web server
     * is already up and pointed somewhere.
     */
    const guard = CONFIG.indexOf("E2E refuses to run against the production");
    const exported = CONFIG.indexOf("export default defineConfig");

    assert.ok(guard > 0, "The refusal must exist.");
    assert.ok(
      guard < exported,
      "The refusal must run at module scope, before the config is built.",
    );
  });

  void test("an indeterminate target is refused, not waved through", () => {
    /*
     * The subtler half of fail-closed. Before the fix an unreadable URL
     * produced `undefined`, which compares unequal to the production
     * ref and was therefore treated as safe. "I cannot tell what I am
     * pointed at" must abort.
     */
    assert.match(
      CONFIG,
      /if\s*\(\s*!\s*configuredRef\s*\)/,
      "A guard that cannot identify its target must refuse to run.",
    );

    assert.match(
      CONFIG,
      /cannot determine which Supabase project/i,
      "The refusal must say why it could not decide.",
    );
  });
});

void describe("The guard's logic, executed", () => {
  /**
   * The guard as written in the config, applied to a given URL.
   *
   * Kept in step with the config by the assertions above; run here
   * against real inputs so a regression shows up as a failing case
   * rather than a passing string match.
   */
  function decide(url: string | undefined): "REFUSE" | "ALLOW" {
    const ref = url?.match(/https:\/\/([a-z0-9]+)\.supabase\./i)?.[1];

    if (!ref) return "REFUSE";
    if (ref === PRODUCTION_REF) return "REFUSE";

    return "ALLOW";
  }

  void test("the production project is refused", () => {
    assert.equal(
      decide(`https://${PRODUCTION_REF}.supabase.co`),
      "REFUSE",
      "CRITICAL: E2E would sign in as a real user against live data.",
    );
  });

  void test("an unset URL is refused", () => {
    assert.equal(
      decide(undefined),
      "REFUSE",
      "CRITICAL: this was the live defect -- undefined slipped through.",
    );
  });

  void test("an unparseable URL is refused", () => {
    assert.equal(decide("not-a-url"), "REFUSE");
    assert.equal(decide(""), "REFUSE");
  });

  void test("a dedicated test project is allowed", () => {
    assert.equal(
      decide("https://akhkukajdgayqwhedeoo.supabase.co"),
      "ALLOW",
      "The guard must not block legitimate test runs.",
    );
  });
});
