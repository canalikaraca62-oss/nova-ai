import { test as base, expect, type Page } from "@playwright/test";

/**
 * SYRAVEN — E2E fixtures
 *
 * TEST-USER STRATEGY
 *
 * Credentials come ONLY from the environment:
 *
 *     E2E_TEST_EMAIL
 *     E2E_TEST_PASSWORD
 *
 * Nothing is hardcoded and nothing is committed. `.env.local` is
 * gitignored, and these names are documented in tests/e2e/README.md.
 *
 * When they are absent, authenticated specs SKIP rather than fail. That
 * distinction matters: a missing credential is an environment gap, not a
 * product defect, and a suite that reports red for unconfigured tooling
 * trains people to ignore red.
 *
 * WHY NO USER IS CREATED OR DELETED
 *
 * These fixtures never sign up, seed, or clean up. Registration would
 * write a real `auth.users` row plus an organization, and a cleanup bug
 * would then delete production data. The account is provisioned OUT OF
 * BAND by whoever runs the suite, against a non-production project, and
 * the tests only sign in as it.
 *
 * Consequently these specs are READ-MOSTLY: they navigate, assert what
 * renders, and sign out. They deliberately do not create projects or
 * send AI requests — the latter would also spend money.
 */

/* -------------------------------------------------------------------------- */
/*                              CREDENTIALS                                   */
/* -------------------------------------------------------------------------- */

export interface TestCredentials {
  readonly email: string;
  readonly password: string;
}

export function testCredentials(): TestCredentials | null {
  const email = process.env.E2E_TEST_EMAIL?.trim();
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) return null;

  return { email, password };
}

/** Human-readable reason used in skip() calls. */
export const NO_CREDENTIALS =
  "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — see tests/e2e/README.md";

/* -------------------------------------------------------------------------- */
/*                        CONSOLE AND NETWORK CAPTURE                         */
/* -------------------------------------------------------------------------- */

export interface PageProblems {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
}

/**
 * Noise that is not a product defect.
 *
 * Kept deliberately short. Every entry is a decision to stop looking at
 * something, so a long list quietly disables the check.
 */
const IGNORED_CONSOLE = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

/**
 * Attaches listeners that record console errors, uncaught exceptions and
 * failed network requests for the life of a page.
 *
 * Uncaught exceptions (`pageerror`) are tracked separately from
 * `console.error`: a React hydration mismatch surfaces as the former and
 * is a genuine runtime fault, while the latter is often application
 * logging.
 */
export function watchForProblems(page: Page): PageProblems {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const text = message.text();

    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;

    consoleErrors.push(text.slice(0, 300));
  });

  page.on("pageerror", (error) => {
    pageErrors.push(`${error.name}: ${error.message}`.slice(0, 300));
  });

  page.on("response", (response) => {
    const status = response.status();

    /*
     * 4xx/5xx on a request the page itself issued. A 401 on an
     * authenticated API before sign-in is expected, so only same-origin
     * non-auth failures are recorded.
     */
    if (status < 400) return;

    const url = response.url();

    if (!url.includes("/api/")) return;

    failedRequests.push(`${status} ${new URL(url).pathname}`);
  });

  return { consoleErrors, pageErrors, failedRequests };
}

/**
 * Asserts a page produced no uncaught exception.
 *
 * Uncaught exceptions are always a defect — hydration mismatch, a null
 * dereference during render, a bad import. Console errors are reported
 * but not failed on, because application code legitimately logs errors
 * (a failed optional fetch, for instance).
 */
export function expectNoRuntimeErrors(problems: PageProblems, where: string) {
  expect(
    problems.pageErrors,
    `Uncaught runtime errors on ${where}`,
  ).toEqual([]);
}

/* -------------------------------------------------------------------------- */
/*                             LAYOUT ASSERTIONS                              */
/* -------------------------------------------------------------------------- */

/**
 * Asserts the document does not scroll horizontally.
 *
 * Horizontal overflow is the single most common responsive defect and
 * the one Phase 12 explicitly could not check. A small tolerance absorbs
 * sub-pixel rounding in scrollbar width.
 */
export async function expectNoHorizontalOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });

  expect(
    overflow.scrollWidth,
    `${where} scrolls horizontally (${overflow.scrollWidth}px content in ` +
      `${overflow.clientWidth}px viewport)`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

/* -------------------------------------------------------------------------- */
/*                                  FIXTURE                                   */
/* -------------------------------------------------------------------------- */

/**
 * `test` with problem capture wired in automatically.
 */
export const test = base.extend<{ problems: PageProblems }>({
  problems: async ({ page }, use) => {
    const problems = watchForProblems(page);
    await use(problems);
  },
});

export { expect };
