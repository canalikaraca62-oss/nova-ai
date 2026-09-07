import { defineConfig, devices } from "@playwright/test";

/**
 * SYRAVEN — Playwright configuration
 *
 * Step 6: browser/E2E validation.
 *
 * SCOPE — DELIBERATELY MINIMAL
 *
 * Chromium only. Firefox and WebKit are not installed: they triple the
 * download and CI time, and the defects this suite exists to find —
 * dead buttons, hydration errors, console exceptions, overflow — are
 * not engine-specific. Cross-browser coverage is worth adding once the
 * suite is green and running in CI, not before.
 *
 * WHY IT BUILDS RATHER THAN RUNNING `next dev`
 *
 * `webServer` runs the PRODUCTION build. Dev mode papers over exactly
 * the class of problem this suite hunts: it tolerates hydration
 * mismatches with a console warning, serves unminified code, and skips
 * the static generation that surfaced page-level errors during Phase 12.
 * Testing dev would verify something users never run.
 *
 * NO DATABASE FIXTURES
 *
 * Nothing here seeds, mutates or deletes data. Tests that need a session
 * read credentials from the environment and are SKIPPED when absent (see
 * tests/e2e/fixtures.ts). A suite that silently creates users would be a
 * production data risk disguised as test infrastructure.
 */

/* -------------------------------------------------------------------------- */
/*                          PRODUCTION SAFETY GUARD                           */
/* -------------------------------------------------------------------------- */

/**
 * The live SYRAVEN project. E2E must never run against it.
 *
 * These tests sign in as a real user and drive the real application. On
 * the production project that means authenticating against an account
 * belonging to an actual person, and any future spec that writes data
 * would write it into live tables.
 *
 * The check is FAIL-CLOSED and runs at config load, before any browser
 * starts: a misconfigured environment aborts the run rather than
 * producing results that look valid. Conventions — a separate env file,
 * omitting paid keys — are good practice, but only this one refuses.
 */
const PRODUCTION_PROJECT_REF = "wpmbumtpcuahyqmdeqgf";

const configuredRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/([a-z0-9]+)\.supabase\./i,
)?.[1];

if (configuredRef === PRODUCTION_PROJECT_REF) {
  throw new Error(
    `E2E refuses to run against the production Supabase project ` +
      `(${PRODUCTION_PROJECT_REF}). Point NEXT_PUBLIC_SUPABASE_URL at the ` +
      `dedicated test project — see tests/e2e/README.md.`,
  );
}

const PORT = Number(process.env.E2E_PORT ?? 3100);

const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",

  /* Node's built-in runner owns tests/**\/*.test.ts; keep the two apart. */
  testMatch: "**/*.spec.ts",

  /*
   * Serial by default. These tests share one server and one test
   * account; parallel sign-ins against a single account produce
   * cross-talk that looks like a product bug.
   */
  fullyParallel: false,
  workers: 1,

  /* A flaky suite is worse than none: it trains people to ignore red. */
  retries: 0,

  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,

    /* Evidence for failures, without bloating a green run. */
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",

    /*
     * Generous relative to page render, which is fast (measured: 0.03s
     * to 0.43s for the HTML). The budget is for the CLIENT-SIDE data
     * fetches an authenticated page makes on mount: Supabase auth on a
     * cold free-tier project answers in roughly 9 seconds, and a page
     * that issues two sequential calls exceeds a 15s navigation budget
     * while being perfectly healthy.
     */
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      /*
       * Mobile viewport, same engine. Catches overflow and clipping —
       * the responsive defects Phase 12 could not check — without
       * installing a second browser.
       */
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    /* A cold production build is slow; do not mistake that for a hang. */
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
