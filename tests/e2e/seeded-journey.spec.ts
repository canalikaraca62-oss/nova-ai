import {
  test,
  expect,
  testCredentials,
  NO_CREDENTIALS,
  RUN_TAG,
  expectNoRuntimeErrors,
  type Seeded,
  type PageProblems,
} from "./fixtures";

import type { Page } from "@playwright/test";

/**
 * SYRAVEN — seeded create → read → delete journey
 *
 * WHAT THIS COVERS THAT NOTHING ELSE DID
 *
 * Every other spec here navigates and reads. That leaves the paths a
 * user actually depends on — create a project, create a task, see them
 * appear — verified only by source inspection, which cannot tell
 * whether a row written by the API ever reaches the page that is
 * supposed to list it.
 *
 * WHY THIS IS SAFE TO WRITE
 *
 *   1. playwright.config.ts refuses to start against the production
 *      project. Seeded rows cannot land there.
 *   2. Writes go through the product's own authorized routes as an
 *      ordinary signed-in user. There is no service-role key in the E2E
 *      environment, so RLS applies exactly as it does in production.
 *   3. DELETE scopes by `id` AND `user_id` server-side, so teardown
 *      cannot reach a row it did not create.
 *   4. Every row carries RUN_TAG, so anything a crash leaves behind is
 *      identifiable rather than anonymous.
 *   5. Teardown asserts each deletion instead of assuming it.
 *
 * AI requests are still not made here: they cost money on every run.
 */

const credentials = testCredentials();

test.skip(credentials === null, NO_CREDENTIALS);

/** Signs in through the real form and waits for the dashboard. */
async function signIn(page: Page) {
  if (!credentials) throw new Error(NO_CREDENTIALS);

  await page.goto("/login");

  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);

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
/*                                  PROJECTS                                  */
/* -------------------------------------------------------------------------- */

test.describe("A created project reaches the page that lists it", () => {
  test("appears in /projects after creation", async ({
    page,
    problems,
    seeded,
  }: {
    page: Page;
    problems: PageProblems;
    seeded: Seeded;
  }) => {
    await signIn(page);

    const project = await seeded.project("visible");

    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    /*
     * /projects renders `project.name` and carries no data-testid, so
     * the run tag embedded in the name is the only stable selector.
     */
    await expect(
      page.getByText(project.name, { exact: false }).first(),
      `a project created through /api/projects did not appear in /projects`,
    ).toBeVisible();

    expectNoRuntimeErrors(problems, "/projects with a seeded row");
  });
});

/* -------------------------------------------------------------------------- */
/*                                   TASKS                                    */
/* -------------------------------------------------------------------------- */

test.describe("A created task reaches the page that lists it", () => {
  test("appears in /tasks after creation", async ({
    page,
    problems,
    seeded,
  }: {
    page: Page;
    problems: PageProblems;
    seeded: Seeded;
  }) => {
    await signIn(page);

    const task = await seeded.task("visible");

    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    /* /tasks renders `task.title`. */
    await expect(
      page.getByText(task.title, { exact: false }).first(),
      `a task created through /api/tasks did not appear in /tasks`,
    ).toBeVisible();

    expectNoRuntimeErrors(problems, "/tasks with a seeded row");
  });

  test("a task can be attached to a project the caller owns", async ({
    page,
    seeded,
  }: {
    page: Page;
    seeded: Seeded;
  }) => {
    await signIn(page);

    const project = await seeded.project("parent");

    /*
     * POST /api/tasks validates project access before accepting
     * projectId — a project belonging to someone else answers 403. This
     * is the accepting half; the refusing half is asserted below.
     */
    const task = await seeded.task("child", project.id);

    expect(task.id, "an owned project must be an acceptable parent").toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/*                            THE BOUNDARY HOLDS                              */
/* -------------------------------------------------------------------------- */

test.describe("Ownership is enforced on write paths", () => {
  test("a task cannot be attached to a project that does not exist", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signIn(page);

    /*
     * A well-formed id that belongs to nobody. The route must refuse it
     * rather than create an orphan: the same code path that refuses
     * ANOTHER user's project, exercised without needing a second
     * account.
     */
    const response = await page.request.post("/api/tasks", {
      data: {
        title: `${RUN_TAG} orphan`,
        projectId: "00000000-0000-4000-8000-000000000000",
      },
    });

    expect(
      response.status(),
      "a task pointing at an unreachable project must be refused, not created",
    ).toBe(403);

    /*
     * No cleanup entry: nothing was created. If this ever returns 201
     * the assertion above fails first, and the row is findable by its
     * RUN_TAG.
     */
  });

  test("deleting a row that is not the caller's answers 404", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signIn(page);

    /*
     * The property teardown depends on. DELETE scopes by id AND
     * user_id, so an id the caller does not own must report "not
     * found" — never a successful deletion of someone else's row.
     */
    const response = await page.request.delete(
      "/api/projects?id=00000000-0000-4000-8000-000000000000",
    );

    expect(
      response.status(),
      "DELETE must not report success for a row the caller does not own",
    ).toBe(404);
  });
});
