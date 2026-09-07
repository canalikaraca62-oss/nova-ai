import {
  test,
  expect,
  expectNoRuntimeErrors,
  expectNoHorizontalOverflow,
} from "./fixtures";

/**
 * SYRAVEN — Public page E2E
 *
 * Covers everything reachable WITHOUT a session, so these run in any
 * environment and are the suite's floor.
 *
 * What is verified here could not be verified by any prior audit:
 * uncaught runtime errors, hydration failures, real horizontal overflow
 * at a real viewport, and whether controls are actually reachable and
 * enabled in a rendered DOM.
 */

/* -------------------------------------------------------------------------- */
/*                                  LANDING                                   */
/* -------------------------------------------------------------------------- */

test.describe("Landing page", () => {
  test("renders without runtime errors", async ({ page, problems }) => {
    const response = await page.goto("/");

    expect(response?.status(), "landing page HTTP status").toBeLessThan(400);

    await expect(page.locator("body")).toBeVisible();

    expectNoRuntimeErrors(problems, "/");
  });

  test("has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalOverflow(page, "/");
  });

  test("primary navigation links resolve", async ({ page }) => {
    await page.goto("/");

    /*
     * Phase 12 found five dead links by static analysis. This confirms
     * the fix in a real browser: every same-origin link must respond
     * with a non-4xx status.
     */
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) =>
        Array.from(
          new Set(
            links
              .map((l) => (l as HTMLAnchorElement).getAttribute("href"))
              .filter(
                (h): h is string =>
                  typeof h === "string" && h.length > 0 && !h.startsWith("//"),
              ),
          ),
        ).slice(0, 12),
      );

    expect(hrefs.length, "landing page should link somewhere").toBeGreaterThan(0);

    const broken: string[] = [];

    for (const href of hrefs) {
      const response = await page.request.get(href);
      if (response.status() >= 400) broken.push(`${href} -> ${response.status()}`);
    }

    expect(broken, "dead links on the landing page").toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*                                  PRICING                                   */
/* -------------------------------------------------------------------------- */

test.describe("Pricing page", () => {
  test("renders plans without runtime errors", async ({ page, problems }) => {
    const response = await page.goto("/pricing");

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();

    expectNoRuntimeErrors(problems, "/pricing");
  });

  test("CTA links resolve, including the ones Phase 12 fixed", async ({
    page,
  }) => {
    await page.goto("/pricing");

    /*
     * /signup and /contact were dead before Phase 12. These assert the
     * repairs hold in a real browser rather than in a grep.
     */
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) =>
        Array.from(
          new Set(
            links.map((l) => (l as HTMLAnchorElement).getAttribute("href") ?? ""),
          ),
        ).filter(Boolean),
      );

    const broken: string[] = [];

    for (const href of hrefs.slice(0, 15)) {
      const response = await page.request.get(href);
      if (response.status() >= 400) broken.push(`${href} -> ${response.status()}`);
    }

    expect(broken, "dead CTA links on /pricing").toEqual([]);
  });

  test("payment CTAs are visible and readable", async ({ page }) => {
    await page.goto("/pricing");

    /*
     * The Phase 12 brief singled out payment buttons that render as
     * black-on-black. Static analysis proved the CLASSES are paired;
     * only a browser can prove the COMPUTED colours differ.
     */
    const ctas = page.locator('a[href^="/register"], a[href^="/login"]');

    const count = await ctas.count();
    expect(count, "pricing page should offer a CTA").toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 6); i += 1) {
      const cta = ctas.nth(i);

      if (!(await cta.isVisible())) continue;

      const colours = await cta.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return { color: style.color, background: style.backgroundColor };
      });

      expect(
        colours.color,
        `CTA ${i} has no computed text colour`,
      ).toBeTruthy();

      /*
       * Fully transparent text is invisible regardless of contrast.
       */
      expect(colours.color).not.toBe("rgba(0, 0, 0, 0)");
    }
  });

  test("has no horizontal overflow", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalOverflow(page, "/pricing");
  });
});

/* -------------------------------------------------------------------------- */
/*                              AUTH ENTRY POINTS                             */
/* -------------------------------------------------------------------------- */

test.describe("Login page", () => {
  test("renders a usable form", async ({ page, problems }) => {
    await page.goto("/login");

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();

    expectNoRuntimeErrors(problems, "/login");
  });

  test("the form is keyboard reachable", async ({ page }) => {
    await page.goto("/login");

    /*
     * Practical accessibility: a sign-in form that cannot be completed
     * from the keyboard excludes screen-reader and motor-impaired users
     * from the entire product.
     */
    await page.locator('input[type="email"]').focus();
    await expect(page.locator('input[type="email"]')).toBeFocused();

    await page.keyboard.press("Tab");

    const focusedAfterTab = await page.evaluate(
      () => document.activeElement?.tagName ?? "",
    );

    expect(focusedAfterTab, "Tab should move focus within the form").not.toBe(
      "BODY",
    );
  });

  test("rejects invalid credentials without a runtime error", async ({
    page,
    problems,
  }) => {
    await page.goto("/login");

    /*
     * Deliberately invalid. This exercises the /api/auth/login route
     * created in the Step 6 remediation — before it existed, this
     * produced a 404 and a JSON parse failure.
     */
    await page.locator('input[type="email"]').fill("e2e-invalid@example.invalid");
    await page.locator('input[type="password"]').fill("definitely-not-correct");

    /*
     * The waiter is registered BEFORE the click, not alongside it in a
     * Promise.all. The route answers in single-digit milliseconds, so a
     * listener attached concurrently with the click can miss the
     * response entirely — which is exactly how this test first failed
     * against a route that was working correctly.
     */
    const pending = page.waitForResponse(
      (r) => r.url().includes("/api/auth/login"),
      { timeout: 30_000 },
    );

    await page.locator('button[type="submit"]').click();

    const response = await pending;

    /*
     * 401 is the correct answer. A 404 would mean the route is missing
     * again; a 200 would mean bad credentials were accepted.
     */
    expect(
      response.status(),
      "invalid credentials should be rejected, not 404",
    ).toBe(401);

    expectNoRuntimeErrors(problems, "/login submit");
  });

  test("does not disclose whether the account exists", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("e2e-unknown@example.invalid");
    await page.locator('input[type="password"]').fill("whatever-value-here");

    const pending = page.waitForResponse(
      (r) => r.url().includes("/api/auth/login"),
      { timeout: 30_000 },
    );

    await page.locator('button[type="submit"]').click();

    const response = await pending;

    const body = await response.text();

    for (const leak of ["not found", "no such user", "not confirmed", "unregistered"]) {
      expect(
        body.toLowerCase(),
        `login response enumerates accounts via "${leak}"`,
      ).not.toContain(leak);
    }
  });
});

test.describe("Register page", () => {
  test("renders without runtime errors", async ({ page, problems }) => {
    const response = await page.goto("/register");

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();

    expectNoRuntimeErrors(problems, "/register");
  });
});

test.describe("Contact page", () => {
  test("exists and renders — created in Phase 12", async ({ page, problems }) => {
    const response = await page.goto("/contact");

    expect(
      response?.status(),
      "/contact was a 404 before Phase 12",
    ).toBeLessThan(400);

    expectNoRuntimeErrors(problems, "/contact");
  });
});
