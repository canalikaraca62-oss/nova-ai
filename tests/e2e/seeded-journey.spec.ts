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
/*                                   BRAIN                                    */
/* -------------------------------------------------------------------------- */

test.describe("The Brain stores and serves real rows", () => {
  test("a created knowledge record appears in /knowledge", async ({
    page,
    problems,
    seeded,
  }: {
    page: Page;
    problems: PageProblems;
    seeded: Seeded;
  }) => {
    await signIn(page);

    const record = await seeded.knowledge("record");

    await page.goto("/knowledge");
    await page.waitForLoadState("networkidle");

    /* /knowledge renders item.title and filters by type, not status. */
    await expect(
      page.getByText(record.title, { exact: false }).first(),
      "a record created through /api/knowledge did not appear in /knowledge",
    ).toBeVisible();

    expectNoRuntimeErrors(problems, "/knowledge with a seeded row");
  });
});

/* -------------------------------------------------------------------------- */
/*                                   SEARCH                                   */
/* -------------------------------------------------------------------------- */

test.describe("Search reaches what the Brain stored", () => {
  test("a seeded record is findable by its tag", async ({
    page,
    seeded,
  }: {
    page: Page;
    seeded: Seeded;
  }) => {
    await signIn(page);

    const record = await seeded.knowledge("findable");

    /*
     * THE DEFECT THIS EXISTS TO CATCH.
     *
     * lib/search/query.ts filters knowledge on a status allowlist. It
     * once read ["active"] -- a value no row has ever carried, because
     * /api/knowledge writes draft | processing | ready and defaults to
     * "ready". The column default is 'active' but the route always
     * supplies a value, so it is never reached. There is no CHECK
     * constraint to catch the divergence.
     *
     * The result was that EVERY knowledge record was invisible to
     * search while listing perfectly through /api/knowledge. Source
     * inspection cannot see this: the writer and the reader are
     * separately correct and disagree only at runtime. It takes a real
     * row, written by the real route, read back through the real query.
     */
    const response = await page.request.get(
      `/api/search?q=${encodeURIComponent(RUN_TAG)}`,
    );

    expect(response.status(), "authenticated search was rejected").toBe(200);

    const body = (await response.json()) as {
      success?: boolean;
      results?: { id: string; title: string; type: string }[];
    };

    expect(body.success, "search reported failure").toBe(true);

    const hit = (body.results ?? []).find((r) => r.id === record.id);

    expect(
      hit,
      `A knowledge record written by /api/knowledge was not returned by ` +
        `/api/search for its own title. This is the status-allowlist ` +
        `divergence: the writer and the reader disagree about which ` +
        `status values are searchable.`,
    ).toBeTruthy();
  });

  test("search matches on title, and returns only the caller's rows", async ({
    page,
    seeded,
  }: {
    page: Page;
    seeded: Seeded;
  }) => {
    await signIn(page);

    await seeded.knowledge("scoped");

    const response = await page.request.get(
      `/api/search?q=${encodeURIComponent(RUN_TAG)}`,
    );

    const body = (await response.json()) as {
      results?: { title: string }[];
    };

    const results = body.results ?? [];

    expect(results.length, "the seeded row should be found").toBeGreaterThan(0);

    /*
     * Every hit carries this run's tag. A result that does not is a row
     * this run never created -- which, given the tag is a per-process
     * UUID fragment, would mean the query returned something outside
     * the caller's own seeded data.
     */
    for (const result of results) {
      expect(
        result.title,
        `search returned a row that does not carry this run's tag`,
      ).toContain(RUN_TAG);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          HUMAN APPROVAL BOUNDARY                           */
/* -------------------------------------------------------------------------- */

test.describe("The approval boundary refuses what it cannot verify", () => {
  /*
   * Deliberately NOT driving /api/agents/run or /api/action.
   *
   * Both call runOrchestration, which reaches a paid provider and
   * meters against the caller's quota. Every E2E run would spend real
   * money, which this suite has refused from the start.
   *
   * The approval surface itself costs nothing and is where the security
   * boundary actually lives, so that is what is exercised here.
   */
  test("pending approvals are listed for the caller", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signIn(page);

    const response = await page.request.get("/api/agents/approvals");

    expect(
      response.status(),
      "an authenticated caller must be able to read their approvals",
    ).toBe(200);
  });

  test("an unknown approval id cannot be decided", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signIn(page);

    const response = await page.request.post("/api/agents/approvals", {
      data: {
        approvalId: "00000000-0000-4000-8000-000000000000",
        decision: "approved",
      },
    });

    expect(
      response.status(),
      "deciding an approval that is not the caller's must not succeed",
    ).toBe(404);
  });

  test("only approved or rejected are accepted as decisions", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signIn(page);

    /*
     * pending, expired and consumed are states the SERVER reaches, not
     * decisions a client may assert. Accepting one would let a caller
     * park an approval in a state the lifecycle never produces.
     */
    const response = await page.request.post("/api/agents/approvals", {
      data: {
        approvalId: "00000000-0000-4000-8000-000000000000",
        decision: "pending",
      },
    });

    expect(
      response.status(),
      "a decision outside {approved, rejected} must be refused",
    ).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/*                              WORKSPACE READ                                */
/* -------------------------------------------------------------------------- */

test.describe("Workspaces are readable by their owner", () => {
  /*
   * Read-only on purpose. /api/workspaces exposes GET and POST but no
   * DELETE, so a seeded workspace could not be removed afterwards --
   * and this suite does not create what it cannot clean up.
   */
  test("the workspace list answers an authenticated caller", async ({
    page,
  }: {
    page: Page;
  }) => {
    await signIn(page);

    const response = await page.request.get("/api/workspaces");

    expect(response.status(), "workspace list was rejected").toBe(200);

    const body = (await response.json()) as {
      success?: boolean;
      workspaces?: unknown[];
    };

    expect(body.success, "workspace list reported failure").toBe(true);
    expect(
      Array.isArray(body.workspaces),
      "workspaces must be an array, even when empty",
    ).toBe(true);
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
