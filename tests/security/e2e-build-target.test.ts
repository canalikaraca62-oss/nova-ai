/**
 * SYRAVEN — the browser suite cannot drive a production build
 * tests/security/e2e-build-target.test.ts
 *
 * SECURITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * playwright.config.ts refuses a production Supabase URL when it loads.
 * That guard reads configuration, and configuration is not what a
 * Next.js server talks to: NEXT_PUBLIC_* values are inlined when the app
 * is BUILT. With `reuseExistingServer`, Playwright will drive whatever is
 * already listening on the E2E port -- including a server built from
 * .env.local, which is production.
 *
 * That happened. A seeded run sent every sign-in to the live project's
 * auth endpoint (401, no session, nothing written) because the build it
 * reused had the production ref compiled into 19 server files.
 *
 * tests/e2e/buildTarget.ts checks the build artefacts themselves. These
 * tests run it against real directories on disk rather than matching
 * its source, so a regression shows up as a failing case.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertBuildIsNotProduction,
  PRODUCTION_PROJECT_REF,
} from "../e2e/buildTarget.ts";

const ROOT = process.cwd();

const TEST_REF = "akhkukajdgayqwhedeoo";

/** Makes a fake checkout whose .next/server holds one compiled file. */
function fakeBuild(content: string, file = "app/login/page.js"): string {
  const root = mkdtempSync(join(tmpdir(), "syraven-build-"));
  const full = join(root, ".next", "server", file);

  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);

  return root;
}

const made: string[] = [];

function track(root: string): string {
  made.push(root);
  return root;
}

after(() => {
  for (const root of made) rmSync(root, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/*                          THE CHECK, EXECUTED                               */
/* -------------------------------------------------------------------------- */

void describe("A build with production compiled in is refused", () => {
  void test("the production ref in a server chunk throws", () => {
    const root = track(
      fakeBuild(
        `const u="https://${PRODUCTION_PROJECT_REF}.supabase.co";export{u}`,
      ),
    );

    assert.throws(
      () => assertBuildIsNotProduction({ root, baseUrl: undefined }),
      /refuses to run[\s\S]*compiled into/,
      "CRITICAL: a production build would be driven by the browser suite.",
    );
  });

  void test("it is found however deep the chunk sits", () => {
    const root = track(
      fakeBuild(
        `"${PRODUCTION_PROJECT_REF}"`,
        "chunks/ssr/deeply/nested/route.js",
      ),
    );

    assert.throws(() =>
      assertBuildIsNotProduction({ root, baseUrl: undefined }),
    );
  });

  void test("prerendered HTML is scanned too", () => {
    const root = track(
      fakeBuild(`<a href="https://${PRODUCTION_PROJECT_REF}.supabase.co">`, "app/index.html"),
    );

    assert.throws(() =>
      assertBuildIsNotProduction({ root, baseUrl: undefined }),
    );
  });

  void test("a local base URL is still checked", () => {
    const root = track(fakeBuild(`"${PRODUCTION_PROJECT_REF}"`));

    assert.throws(() =>
      assertBuildIsNotProduction({ root, baseUrl: "http://127.0.0.1:3100" }),
    );
  });

  void test("an unparseable base URL is checked, not waved through", () => {
    const root = track(fakeBuild(`"${PRODUCTION_PROJECT_REF}"`));

    assert.throws(() =>
      assertBuildIsNotProduction({ root, baseUrl: "not a url" }),
    );
  });
});

void describe("A legitimate target is allowed", () => {
  void test("a build made for the test project passes", () => {
    const root = track(
      fakeBuild(`const u="https://${TEST_REF}.supabase.co";export{u}`),
    );

    assert.doesNotThrow(() =>
      assertBuildIsNotProduction({ root, baseUrl: undefined }),
    );
  });

  void test("no local build means nothing local to have built wrongly", () => {
    const root = track(mkdtempSync(join(tmpdir(), "syraven-nobuild-")));

    assert.doesNotThrow(() =>
      assertBuildIsNotProduction({ root, baseUrl: undefined }),
    );
  });

  void test("a remote target is not judged by local artefacts", () => {
    const root = track(fakeBuild(`"${PRODUCTION_PROJECT_REF}"`));

    assert.doesNotThrow(
      () =>
        assertBuildIsNotProduction({
          root,
          baseUrl: "https://staging.example.com",
        }),
      "A remote server is not built from this checkout.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         IT IS ACTUALLY WIRED IN                            */
/* -------------------------------------------------------------------------- */

void describe("Every browser run passes through the check", () => {
  let FIXTURES = "";
  let CONFIG = "";

  before(() => {
    FIXTURES = readFileSync(join(ROOT, "tests", "e2e", "fixtures.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    CONFIG = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
  });

  void test("the fixtures import the check", () => {
    assert.match(
      FIXTURES,
      /import \{ assertBuildIsNotProduction \} from "\.\/buildTarget"/,
      "A check nothing imports protects nothing.",
    );
  });

  void test("it runs as an automatic worker fixture", () => {
    /*
     * Automatic, so no spec can forget to request it; worker-scoped, so
     * it runs once per worker before the first test touches a page.
     */
    assert.match(
      FIXTURES,
      /assertBuildIsNotProduction\(\);[\s\S]{0,120}?\{ scope: "worker", auto: true \}/,
      "The check must run automatically for every worker, or a spec " +
        "that does not ask for it drives a production build unchecked.",
    );
  });

  void test("it names the same production project as the config", () => {
    assert.ok(
      CONFIG.includes(`PRODUCTION_PROJECT_REF = "${PRODUCTION_PROJECT_REF}"`),
      "playwright.config.ts and tests/e2e/buildTarget.ts disagree about " +
        "which project is production. One of them is guarding the wrong " +
        "thing.",
    );
  });
});
