import { randomUUID } from "node:crypto";

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
 * These fixtures never sign up. Registration would write a real
 * `auth.users` row plus an organization, and a cleanup bug would then
 * delete production data. The account is provisioned OUT OF BAND by
 * whoever runs the suite, against a non-production project, and the
 * tests only sign in as it.
 *
 * WHAT THEY DO WRITE
 *
 * Rows the run created itself, and only those. `seeded.project()` and
 * `seeded.task()` create through the product's own authorized routes —
 * no service-role key exists in the E2E environment, so every write is
 * an ordinary user's write under RLS — and teardown deletes each id
 * back.
 *
 * Three properties make that safe rather than merely tidy:
 *
 *   1. playwright.config.ts refuses to start against the production
 *      project at all, so seeded rows cannot land there.
 *   2. DELETE /api/projects and /api/tasks scope by `id` AND `user_id`
 *      server-side. Teardown cannot reach a row it did not create even
 *      if the bookkeeping here were wrong.
 *   3. Teardown ASSERTS the outcome. A delete that quietly 404s would
 *      otherwise leave data behind while reporting success — cleanup
 *      and the appearance of cleanup are different things.
 *
 * AI requests are still not made: they would spend money on every run.
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
/*                                  SEEDING                                   */
/* -------------------------------------------------------------------------- */

/**
 * A tag unique to this process.
 *
 * Every seeded row carries it, so rows are identifiable as this run's
 * even if a crash prevents teardown, and so a UI assertion can look for
 * text that no other row in the project could contain. There are no
 * `data-testid` attributes in the product — /projects renders
 * `project.name` and /tasks renders `task.title` — so the tag IS the
 * selector.
 */
export const RUN_TAG = `e2e-${randomUUID().slice(0, 8)}`;

/** Rows created by one test, newest first for dependency-safe teardown. */
interface SeededRow {
  readonly kind: "project" | "task";
  readonly id: string;
  readonly label: string;
}

/**
 * Creates rows through the product's own authorized routes and removes
 * them afterwards.
 *
 * Requests go through `page.request`, which shares the browser context's
 * cookie jar: the session established by signing in through the real
 * form authorizes these calls. No service-role key is involved — there
 * is none in the E2E environment — so every write is an ordinary user's
 * write, subject to the same RLS as a real one.
 */
export class Seeded {
  private readonly created: SeededRow[] = [];

  constructor(private readonly page: Page) {}

  /** Creates a project whose name carries this run's tag. */
  async project(suffix = "project"): Promise<{ id: string; name: string }> {
    const name = `${RUN_TAG} ${suffix}`;

    const response = await this.page.request.post("/api/projects", {
      data: { name },
    });

    expect(
      response.status(),
      `seeding a project failed: ${await response.text()}`,
    ).toBe(201);

    const body = (await response.json()) as { data?: { id?: string } };
    const id = body.data?.id;

    expect(id, "created project returned no id").toBeTruthy();

    this.created.unshift({ kind: "project", id: id as string, label: name });

    return { id: id as string, name };
  }

  /** Creates a task whose title carries this run's tag. */
  async task(
    suffix = "task",
    projectId?: string,
  ): Promise<{ id: string; title: string }> {
    const title = `${RUN_TAG} ${suffix}`;

    const response = await this.page.request.post("/api/tasks", {
      data: projectId ? { title, projectId } : { title },
    });

    expect(
      response.status(),
      `seeding a task failed: ${await response.text()}`,
    ).toBe(201);

    const body = (await response.json()) as { task?: { id?: string } };
    const id = body.task?.id;

    expect(id, "created task returned no id").toBeTruthy();

    this.created.unshift({ kind: "task", id: id as string, label: title });

    return { id: id as string, title };
  }

  /**
   * Deletes everything this test created, and VERIFIES each deletion.
   *
   * The verification is the point. Both routes answer 404 when the row
   * is not the caller's and `deleted: true` when it is, so a teardown
   * that ignored the response would leave rows behind while reporting
   * success. Cleanup and the appearance of cleanup are different things,
   * and only one of them is checkable.
   *
   * Newest first, so a task is removed before the project it references.
   * Failures are collected rather than thrown one at a time: one
   * undeletable row must not hide the others still needing removal.
   */
  async cleanup(): Promise<void> {
    const failures: string[] = [];

    for (const row of this.created) {
      const path = row.kind === "project" ? "/api/projects" : "/api/tasks";

      try {
        const response = await this.page.request.delete(
          `${path}?id=${encodeURIComponent(row.id)}`,
        );

        if (response.status() !== 200) {
          failures.push(
            `${row.kind} "${row.label}" (${row.id}) not deleted: ` +
              `HTTP ${response.status()}`,
          );

          continue;
        }

        const body = (await response.json()) as { deleted?: boolean };

        if (body.deleted !== true) {
          failures.push(
            `${row.kind} "${row.label}" (${row.id}) reported no deletion`,
          );
        }
      } catch (error) {
        failures.push(`${row.kind} ${row.id} cleanup threw: ${String(error)}`);
      }
    }

    this.created.length = 0;

    expect(
      failures,
      `Seeded rows survived teardown in ${RUN_TAG}. They carry that tag ` +
        `and can be removed by hand.`,
    ).toEqual([]);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  FIXTURE                                   */
/* -------------------------------------------------------------------------- */

/**
 * `test` with problem capture and seeding wired in automatically.
 *
 * `seeded` tears down after the test body regardless of outcome, so a
 * failing assertion still removes the rows it created.
 */
export const test = base.extend<{
  problems: PageProblems;
  seeded: Seeded;
}>({
  problems: async ({ page }, use) => {
    const problems = watchForProblems(page);
    await use(problems);
  },

  seeded: async ({ page }, use) => {
    const seeded = new Seeded(page);

    try {
      await use(seeded);
    } finally {
      await seeded.cleanup();
    }
  },
});

export { expect };
