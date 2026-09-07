import type { Page } from "@playwright/test";

import {
  test,
  expect,
  testCredentials,
  NO_CREDENTIALS,
  expectNoRuntimeErrors,
  expectNoHorizontalOverflow,
} from "./fixtures";

/**
 * SYRAVEN — Authenticated journey E2E
 *
 * SKIPS ENTIRELY without E2E_TEST_EMAIL / E2E_TEST_PASSWORD. A missing
 * credential is an environment gap, not a product defect, and a suite
 * that reports red for unconfigured tooling teaches people to ignore
 * red.
 *
 * READ-MOSTLY BY DESIGN
 *
 * These specs navigate and assert what renders. They deliberately do
 * NOT create projects, send chat messages, or trigger agent runs:
 *
 *   - creating records would leave data behind in whatever project the
 *     credentials point at;
 *   - AI requests spend real money on every run.
 *
 * Verifying that a page loads, is reachable, has no runtime error and
 * does not overflow is the part a browser is uniquely needed for.
 */

const credentials = testCredentials();

test.skip(credentials === null, NO_CREDENTIALS);

/** Signs in through the real form and waits for the dashboard. */
async function signIn(page: Page) {
  if (!credentials) throw new Error(NO_CREDENTIALS);

  await page.goto("/login");

  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);

  /*
   * 30s, not the 10s default. Supabase GoTrue on a cold free-tier
   * project answers a sign-in in roughly 9 seconds — measured, not
   * guessed — so the default sits right on the boundary and fails
   * intermittently for an entirely healthy route.
   */
  const pending = page.waitForResponse(
    (r) => r.url().includes("/api/auth/login"),
    { timeout: 30_000 },
  );

  await page.locator('button[type="submit"]').click();

  const response = await pending;

  expect(
    response.status(),
    "sign-in failed — check E2E_TEST_EMAIL / E2E_TEST_PASSWORD",
  ).toBe(200);

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/* -------------------------------------------------------------------------- */
/*                                  SIGN IN                                   */
/* -------------------------------------------------------------------------- */

test.describe("Authentication", () => {
  test("a valid credential establishes a session and reaches the dashboard", async ({
    page,
    problems,
  }) => {
    await signIn(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();

    expectNoRuntimeErrors(problems, "/dashboard after sign-in");
  });

  test("the session survives a reload", async ({ page }) => {
    await signIn(page);

    await page.reload();

    /*
     * A session held only in memory would bounce to /login here. This
     * confirms the HttpOnly cookies written by /api/auth/login are
     * actually read back by lib/auth/session.ts.
     */
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

/* -------------------------------------------------------------------------- */
/*                                 NAVIGATION                                 */
/* -------------------------------------------------------------------------- */

test.describe("Authenticated navigation", () => {
  const PAGES = [
    "/dashboard",
    "/projects",
    "/tasks",
    "/knowledge",
    "/chat",
    "/billing",
    "/settings",
  ] as const;

  for (const path of PAGES) {
    test(`${path} renders without runtime errors`, async ({ page, problems }) => {
      await signIn(page);

      const response = await page.goto(path);

      expect(response?.status(), `${path} HTTP status`).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();

      expectNoRuntimeErrors(problems, path);
    });
  }

  test("no page scrolls horizontally", async ({ page }) => {
    await signIn(page);

    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      await expectNoHorizontalOverflow(page, path);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                                  BILLING                                   */
/* -------------------------------------------------------------------------- */

test.describe("Billing page", () => {
  test("loads billing state without an error banner", async ({
    page,
    problems,
  }) => {
    await signIn(page);

    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    /*
     * /api/billing did not exist before the Step 6 remediation, so this
     * page threw "Unable to load billing information." on every visit.
     */
    const billingFailures = problems.failedRequests.filter((r) =>
      r.includes("/api/billing"),
    );

    expect(
      billingFailures,
      "billing status request failed",
    ).toEqual([]);

    expectNoRuntimeErrors(problems, "/billing");
  });

  test("payment buttons render with a visible label", async ({ page }) => {
    await signIn(page);

    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    /*
     * The Phase 12 brief called this out specifically: a payment button
     * must never be dark text on a dark background. Only a browser can
     * compare COMPUTED colours.
     */
    const buttons = page.locator("button:visible");
    const count = await buttons.count();

    expect(count, "billing page should render buttons").toBeGreaterThan(0);

    const unreadable: string[] = [];

    for (let i = 0; i < Math.min(count, 12); i += 1) {
      const button = buttons.nth(i);

      const info = await button.evaluate((el) => {
        const style = window.getComputedStyle(el);

        /* Walk up for the first non-transparent background. */
        let node: HTMLElement | null = el as HTMLElement;
        let background = "rgba(0, 0, 0, 0)";

        while (node && background === "rgba(0, 0, 0, 0)") {
          background = window.getComputedStyle(node).backgroundColor;
          node = node.parentElement;
        }

        return {
          text: (el.textContent ?? "").trim().slice(0, 40),
          color: style.color,
          background,
        };
      });

      if (info.text.length === 0) continue;

      /* Identical colour and background is the black-on-black failure. */
      if (info.color === info.background) {
        unreadable.push(`"${info.text}" ${info.color} on ${info.background}`);
      }
    }

    expect(unreadable, "buttons whose text matches their background").toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*                                   SEARCH                                   */
/* -------------------------------------------------------------------------- */

test.describe("Search", () => {
  test("the search API answers an authenticated caller", async ({ page }) => {
    await signIn(page);

    /*
     * Exercises the keyword search from Phase 10.1/10.2 through a real
     * session. Semantic search is NOT wired to any route and is not
     * tested here.
     */
    const response = await page.request.get("/api/search?q=test");

    expect(
      response.status(),
      "authenticated search should not be rejected",
    ).toBeLessThan(400);
  });
});

/* -------------------------------------------------------------------------- */
/*                                  SIGN OUT                                  */
/* -------------------------------------------------------------------------- */

test.describe("Sign out", () => {
  test("an unauthenticated caller cannot reach a protected API", async ({
    browser,
  }) => {
    /*
     * A fresh context has no cookies. This is the authorization boundary
     * verified from the browser's side rather than from source.
     */
    const context = await browser.newContext();

    const response = await context.request.get("/api/usage");

    expect(
      response.status(),
      "a protected API must reject an anonymous caller",
    ).toBe(401);

    await context.close();
  });
});
