/**
 * SYRAVEN — the profile shows the account that is signed in, or nothing
 * tests/security/profile-is-real.test.ts
 *
 * PRODUCT-INTEGRITY REGRESSION SUITE.
 *
 * /profile used to open on "SYRAVEN User", "user@syraven.ai", the handle
 * "syraven-user" and an invented bio -- editable, and presented as the
 * caller's own details. Its notification switches flipped in memory and
 * were forgotten on reload while looking like saved preferences.
 *
 * The schema stores exactly one personal field, the sign-in email. These
 * assertions keep the page to that: the email from the verified auth
 * user, every other field empty and explained, no preference drawn as
 * on or off.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(join(process.cwd(), "app", "profile", "page.tsx"), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

void describe("The profile shows only the real account", () => {
  void test("no invented identity is shown as the caller's", () => {
    for (const invented of [
      "SYRAVEN User",
      "user@syraven.ai",
      "syraven-user",
      "Building the future",
    ]) {
      assert.ok(!PAGE.includes(invented), `"${invented}" is nobody's data.`);
    }
  });

  void test("the email comes from the verified auth user", () => {
    assert.match(PAGE, /getCurrentUser\(\)/);
    assert.match(PAGE, /user\?\.email/);
  });

  void test("fields with no storage are disabled and empty", () => {
    assert.match(PAGE, /disabled\s+value=""/);
    assert.match(PAGE, /aria-describedby="profile-storage-availability"/);
  });

  void test("no preference is drawn as on or off", () => {
    assert.ok(
      !/role="switch"/.test(PAGE),
      "A switch shows a state; nothing stores one.",
    );
    assert.ok(!/aria-checked/.test(PAGE));
  });

  void test("the plan link opens billing, not the public price list", () => {
    assert.match(PAGE, /href="\/billing"/);
    assert.ok(!/href="\/pricing"/.test(PAGE));
  });
});
