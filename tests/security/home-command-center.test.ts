/**
 * SYRAVEN — Home shows what needs you, from sources that exist
 * tests/security/home-command-center.test.ts
 *
 * PRODUCT-INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * /dashboard is where login lands. It used to open on four workspace
 * counters. It now answers "what needs me, what changed, where do I
 * start" -- and a command center is exactly where the temptation to
 * decorate is strongest: a pulsing "agents running" badge, a health
 * score, a count of "insights". None of those have a source here.
 *
 * These assertions pin the three live panels to real endpoints, keep
 * every quick start pointed at a route that exists, and forbid the
 * decoration.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const HOME = readFileSync(join(ROOT, "app", "dashboard", "page.tsx"), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

void describe("Every panel reads a real source", () => {
  void test("'Needs you' reads the caller's pending approvals", () => {
    assert.match(
      HOME,
      /fetch\("\/api\/agents\/approvals"/,
      "The approval panel must come from the approval store, or it is " +
        "a claim about agents nobody checked.",
    );
  });

  void test("'Recent activity' reads the derived timeline", () => {
    assert.match(HOME, /fetch\("\/api\/activity"/);
  });

  void test("one failing source does not blank the other", () => {
    assert.match(
      HOME,
      /Promise\.allSettled\(/,
      "With Promise.all, an approvals outage would also hide activity.",
    );

    assert.match(HOME, /setApprovalsFailed\(true\)/);
    assert.match(HOME, /setActivityFailed\(true\)/);
  });
});

void describe("Every way forward leads somewhere", () => {
  void test("each quick start is a route that exists", () => {
    const hrefs = [...HOME.matchAll(/\{ href: "(\/[a-z/-]*)"/g)].map((m) => m[1] ?? "");

    assert.ok(hrefs.length >= 3, `Only ${hrefs.length} quick starts found.`);

    for (const href of hrefs) {
      assert.ok(
        existsSync(join(ROOT, "app", ...href.split("/").filter(Boolean), "page.tsx")),
        `Quick start ${href} leads to a page that does not exist.`,
      );
    }
  });
});

void describe("Nothing on Home is decoration", () => {
  void test("no liveness is implied without a live source", () => {
    assert.ok(!/animate-pulse|animate-ping/.test(HOME), "A pulse implies live state this page does not have.");
  });

  void test("no score, health or count is invented", () => {
    for (const invented of ["healthScore", "insights", "productivity", "Healthy", "% complete"]) {
      assert.ok(!HOME.includes(invented), `${invented} has no source on this page.`);
    }
  });

  void test("times are relative to the load, not a render-time clock", () => {
    assert.match(HOME, /setLoadedAt\(Date\.now\(\)\)/);
    assert.ok(
      !/format(Ago|Left)\([^)]*Date\.now\(\)/.test(HOME),
      "Reading the clock during render risks a hydration mismatch.",
    );
  });
});
