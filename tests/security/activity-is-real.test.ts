/**
 * SYRAVEN — activity reports what the rows prove, and only the caller's
 * tests/security/activity-is-real.test.ts
 *
 * SECURITY / PRODUCT-INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * /activity went from eight invented events, to an honest empty feed,
 * to this: events derived from the caller's own projects, tasks, Brain
 * records and approvals. Two things can go wrong, and they are opposite
 * failures of the same promise:
 *
 *   1. The timeline says something the data does not -- an "update"
 *      that was really the insert, a "completed" task that was
 *      reopened, an approval "waiting on you" that already expired.
 *
 *   2. The timeline shows someone else's rows. public.projects has no
 *      row level security, so the route's explicit ownership filter is
 *      the only thing keeping one user's project names from another.
 *
 * The derivation is executed directly (it has no server imports); the
 * route and page are checked at source because they run inside Next.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  deriveActivity,
  UPDATE_THRESHOLD_MS,
  type ActivitySources,
} from "../../lib/activity/events.ts";

const ROOT = process.cwd();

function code(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const NOW = new Date("2026-09-13T12:00:00.000Z");

const EMPTY: ActivitySources = {
  projects: [],
  tasks: [],
  knowledge: [],
  approvals: [],
};

function titles(sources: Partial<ActivitySources>): string[] {
  return deriveActivity({ ...EMPTY, ...sources }, { now: NOW }).map((e) => e.title);
}

/* -------------------------------------------------------------------------- */
/*                   ONLY WHAT THE TIMESTAMPS PROVE                           */
/* -------------------------------------------------------------------------- */

void describe("An event is a fact a column records", () => {
  void test("an insert is not reported as an edit", () => {
    const created = "2026-09-13T10:00:00.000Z";
    const sameStatement = "2026-09-13T10:00:00.250Z";

    assert.deepEqual(
      titles({
        projects: [{ id: "p1", name: "Launch", created_at: created, updated_at: sameStatement }],
      }),
      ["Project created"],
      "created_at and updated_at are both stamped at insert; calling that an update invents an edit.",
    );
  });

  void test("a later change is reported as an update, at its own time", () => {
    const events = deriveActivity(
      {
        ...EMPTY,
        projects: [
          {
            id: "p1",
            name: "Launch",
            created_at: "2026-09-13T10:00:00.000Z",
            updated_at: new Date(Date.parse("2026-09-13T10:00:00.000Z") + UPDATE_THRESHOLD_MS + 1000).toISOString(),
          },
        ],
      },
      { now: NOW },
    );

    assert.deepEqual(events.map((e) => e.title), ["Project updated", "Project created"]);
  });

  void test("a task is completed only while it is still completed", () => {
    const base = {
      id: "t1",
      title: "Ship",
      created_at: "2026-09-12T10:00:00.000Z",
      updated_at: "2026-09-13T09:00:00.000Z",
      completed_at: "2026-09-13T08:00:00.000Z",
    };

    assert.ok(
      titles({ tasks: [{ ...base, status: "completed" }] }).includes("Task completed"),
    );

    assert.ok(
      !titles({ tasks: [{ ...base, status: "in_progress" }] }).includes("Task completed"),
      "A reopened task can keep a stale completed_at; reporting it done would be false.",
    );
  });

  void test("an approval past its expiry is not waiting on anyone", () => {
    const events = deriveActivity(
      {
        ...EMPTY,
        approvals: [
          {
            id: "a1",
            tool_id: "email.send",
            agent_id: "communicator",
            status: "pending",
            created_at: "2026-09-13T11:00:00.000Z",
            decided_at: null,
            expires_at: "2026-09-13T11:15:00.000Z",
          },
        ],
      },
      { now: NOW },
    );

    assert.ok(
      events.every((e) => e.tone !== "pending"),
      "An expired approval is refused by the store; offering it would be a control that cannot act.",
    );

    assert.ok(events.some((e) => e.title === "Approval expired unanswered"));
    assert.ok(events.every((e) => e.href !== "/approvals"));
  });

  void test("a live approval links to where it can be decided", () => {
    const events = deriveActivity(
      {
        ...EMPTY,
        approvals: [
          {
            id: "a1",
            tool_id: "email.send",
            agent_id: "communicator",
            status: "pending",
            created_at: "2026-09-13T11:55:00.000Z",
            decided_at: null,
            expires_at: "2026-09-13T12:10:00.000Z",
          },
        ],
      },
      { now: NOW },
    );

    assert.equal(events[0]?.tone, "pending");
    assert.equal(events[0]?.href, "/approvals");
  });

  void test("rows with unreadable timestamps produce no event", () => {
    assert.deepEqual(
      titles({ projects: [{ id: "p1", name: "X", created_at: "not a date", updated_at: null }] }),
      [],
    );
  });

  void test("the timeline is newest first and bounded", () => {
    const projects = Array.from({ length: 80 }, (_, index) => ({
      id: `p${index}`,
      name: `P${index}`,
      created_at: new Date(Date.parse("2026-09-01T00:00:00.000Z") + index * 60_000).toISOString(),
      updated_at: null,
    }));

    const events = deriveActivity({ ...EMPTY, projects }, { now: NOW, limit: 10 });

    assert.equal(events.length, 10);
    assert.equal(events[0]?.detail, "P79");
    assert.ok(
      events.every((e, i) => i === 0 || Date.parse(events[i - 1]!.occurredAt) >= Date.parse(e.occurredAt)),
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         ONLY THE CALLER'S ROWS                             */
/* -------------------------------------------------------------------------- */

void describe("The route reads only the caller's rows", () => {
  const ROUTE = code("app", "api", "activity", "route.ts");

  void test("it is behind withAuth", () => {
    assert.match(ROUTE, /export const GET = withAuth\(/);
  });

  void test("it uses the caller's RLS client, never service role", () => {
    assert.match(ROUTE, /const db = session\.supabase;/);
    assert.ok(!/supabaseAdmin|service_role/.test(ROUTE));
  });

  void test("projects, tasks and knowledge are each filtered by the caller", () => {
    /*
     * Counted, not merely present. public.projects has no RLS, so a
     * missing filter on that one query would return every user's
     * project names.
     */
    const filters = ROUTE.match(/\.eq\("user_id", session\.userId\)/g) ?? [];

    assert.equal(
      filters.length,
      3,
      `Expected an ownership filter on projects, tasks and knowledge; found ${filters.length}.`,
    );

    for (const table of ["projects", "tasks", "knowledge"]) {
      assert.match(
        ROUTE,
        new RegExp(`from\\("${table}"\\)[\\s\\S]{0,160}?\\.eq\\("user_id", session\\.userId\\)`),
        `${table} must be filtered by the caller before anything else.`,
      );
    }
  });

  void test("approvals are the caller's own requests", () => {
    assert.match(
      ROUTE,
      /from\("agent_approvals"\)[\s\S]{0,200}?\.eq\("requested_for_user_id", session\.userId\)/,
    );
  });

  void test("nothing is read from the request", () => {
    assert.ok(
      !/searchParams|request\.json|_request\.(url|nextUrl)/.test(ROUTE),
      "No filter, id or scope may come from the caller.",
    );
  });

  void test("a failing source is named, not silently dropped", () => {
    assert.match(ROUTE, /degraded\.push\("projects"\)/);
    assert.match(ROUTE, /data: \{ events, degraded \}/);
  });
});

/* -------------------------------------------------------------------------- */
/*                     THE PAGE CLAIMS NOTHING IT CANNOT KNOW                 */
/* -------------------------------------------------------------------------- */

void describe("The page shows derived events and nothing invented", () => {
  const PAGE = code("app", "activity", "page.tsx");

  void test("it loads from /api/activity", () => {
    assert.match(PAGE, /fetch\("\/api\/activity"/);
  });

  void test("it does not claim to be live", () => {
    assert.ok(!/Live activity feed/i.test(PAGE));
    assert.ok(!/animate-pulse/.test(PAGE), "A pulsing dot implies a live feed that does not exist.");
  });

  void test("it reports no state it has no source for", () => {
    for (const invented of ['"Healthy"', '"Active"', "Automations", "NEXT LEVEL"]) {
      assert.ok(!PAGE.includes(invented), `${invented} describes nothing this page measures.`);
    }
  });

  void test("it offers no read state nothing stores", () => {
    assert.ok(!/markAllAsRead|unread/i.test(PAGE), "Read state is not recorded anywhere.");
  });

  void test("relative times are taken from the load, not a render-time clock", () => {
    assert.match(PAGE, /setLoadedAt\(Date\.now\(\)\)/);
    assert.ok(
      !/formatWhen\([^)]*Date\.now\(\)/.test(PAGE),
      "Reading the clock during render risks a hydration mismatch.",
    );
  });
});
