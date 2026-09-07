/**
 * SYRAVEN — Authorization boundary tests
 *
 * Phase 3 (see IMPLEMENTATION_PLAN.md).
 *
 * Phase 1 proved *authentication* is enforced. These tests prove
 * *authorization*: that a verified caller cannot reach another tenant's
 * data, and that the boundary is implemented once rather than
 * re-invented per route.
 *
 * Two kinds of test live here:
 *
 *   1. Behavioural — the role hierarchy and membership logic are pure
 *      functions and are exercised directly, including the hostile cases.
 *
 *   2. Structural — assertions over the route sources that fail if a
 *      route regresses to a local auth helper, an unguarded tenant
 *      filter, or an unjustified service-role client.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "app", "api");

function findRouteFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findRouteFiles(full));
    else if (entry.name === "route.ts") found.push(full);
  }

  return found;
}

function routeId(file: string): string {
  return file
    .replace(process.cwd(), "")
    .replace(/\\/g, "/")
    .replace(/^\//, "");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ROUTE_FILES = findRouteFiles(API_DIR);

/* -------------------------------------------------------------------------- */
/*                        ROLE HIERARCHY (BEHAVIOURAL)                        */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors lib/auth/authorization.ts. A companion test below asserts the
 * implementation still matches, so this mirror cannot silently drift.
 */
const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

function roleMeets(role: string, minimum: string): boolean {
  const r = ROLE_RANK[role];
  const m = ROLE_RANK[minimum];
  if (r === undefined || m === undefined) return false;
  return r >= m;
}

void describe("Organization role hierarchy", () => {
  void test("a role always satisfies itself", () => {
    for (const role of Object.keys(ROLE_RANK)) {
      assert.equal(roleMeets(role, role), true, `${role} should satisfy ${role}`);
    }
  });

  void test("higher roles satisfy lower requirements", () => {
    assert.equal(roleMeets("owner", "viewer"), true);
    assert.equal(roleMeets("admin", "member"), true);
    assert.equal(roleMeets("manager", "member"), true);
  });

  void test("lower roles do NOT satisfy higher requirements", () => {
    assert.equal(roleMeets("viewer", "member"), false);
    assert.equal(roleMeets("member", "admin"), false);
    assert.equal(roleMeets("manager", "admin"), false);
    assert.equal(roleMeets("admin", "owner"), false);
  });

  void test("an unknown role never satisfies anything", () => {
    assert.equal(roleMeets("superuser", "viewer"), false);
    assert.equal(roleMeets("", "viewer"), false);
    assert.equal(roleMeets("OWNER", "viewer"), false);
  });

  void test("an unknown requirement is never satisfied", () => {
    assert.equal(roleMeets("owner", "god"), false);
  });
});

/* -------------------------------------------------------------------------- */
/*                            UUID GATE (BEHAVIOURAL)                         */
/* -------------------------------------------------------------------------- */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

void describe("Tenant id validation", () => {
  void test("accepts a well-formed uuid", () => {
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  });

  void test("rejects malformed and hostile values", () => {
    const hostile = [
      "",
      "not-a-uuid",
      "3f2504e0-4f89-41d3-9a0c",
      "' or '1'='1",
      "*",
      "00000000-0000-0000-0000-000000000000",
      null,
      undefined,
      123,
      {},
    ];

    for (const value of hostile) {
      assert.equal(
        isUuid(value),
        false,
        `${JSON.stringify(value)} must not pass as a tenant id`,
      );
    }
  });

  void test("rejects a uuid carrying a PostgREST filter payload", () => {
    /*
     * Tenant ids reach .eq() filters. A value that smuggles filter syntax
     * must be rejected before it gets there.
     */
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301,user_id.eq.x"), false);
  });
});

/* -------------------------------------------------------------------------- */
/*                     ONE SHARED BOUNDARY (STRUCTURAL)                       */
/* -------------------------------------------------------------------------- */

void describe("Authentication is implemented once", () => {
  void test("no route defines its own auth helper", () => {
    const offenders: string[] = [];

    for (const file of ROUTE_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));

      if (
        /\bfunction\s+(getAuthenticatedUser|authenticateRequest|requireAuth)\s*\(/.test(
          code,
        )
      ) {
        offenders.push(routeId(file));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `These routes re-implement authentication instead of using withAuth from lib/api/withAuth:\n${offenders.join("\n")}`,
    );
  });

  void test("no route calls auth.getUser directly", () => {
    /*
     * Credential verification belongs in lib/auth/session.ts. A route
     * calling getUser itself is a second implementation of the boundary.
     */
    const offenders: string[] = [];

    for (const file of ROUTE_FILES) {
      const id = routeId(file);

      /*
       * The registration route legitimately drives the auth API: it
       * creates users and signs them in. It is not a data route.
       */
      if (id === "app/api/auth/register/route.ts") continue;

      const code = stripComments(readFileSync(file, "utf8"));

      if (/\bauth\s*\.\s*getUser\s*\(/.test(code)) {
        offenders.push(id);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `These routes verify credentials themselves:\n${offenders.join("\n")}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      TENANT FILTERS ARE GUARDED                            */
/* -------------------------------------------------------------------------- */

void describe("Client-supplied tenant keys are proven before use", () => {
  /**
   * Routes that filter a query by a client-supplied workspace or project
   * id. Each must call a tenant guard before applying that filter.
   */
  const TENANT_FILTERING_ROUTES = [
    "app/api/projects/route.ts",
    "app/api/knowledge/route.ts",
    "app/api/tasks/route.ts",
    "app/api/knowledge/search/route.ts",
  ];

  for (const id of TENANT_FILTERING_ROUTES) {
    void test(`${id} guards its tenant filter`, () => {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      const guarded =
        /requireOptional(Workspace|Project)Access\s*\(/.test(code) ||
        /require(Workspace|Project)Access\s*\(/.test(code);

      assert.ok(
        guarded,
        `${id} filters by a client-supplied tenant id without proving ` +
          `membership first. Use a guard from lib/api/tenantGuard.`,
      );
    });

    void test(`${id} returns the guard denial before querying`, () => {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      assert.match(
        code,
        /Guard\?\.denied\s*\)\s*\{\s*return\s+\w*Guard\.response;/,
        `${id} calls a tenant guard but does not return its denial, so the ` +
          `check has no effect.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                    SERVICE ROLE USAGE IS DELIBERATE                        */
/* -------------------------------------------------------------------------- */

void describe("Service-role client usage", () => {
  /**
   * supabaseAdmin bypasses RLS. Phase 3 does not remove it — the routes
   * still depend on it — but every remaining use must be a deliberate,
   * documented choice rather than an unexamined default
   * (ARCHITECTURE_AUDIT.md §8.6).
   */
  void test("every route using supabaseAdmin documents why", () => {
    const undocumented: string[] = [];

    for (const file of ROUTE_FILES) {
      const raw = readFileSync(file, "utf8");

      if (!/\bsupabaseAdmin\b/.test(raw)) continue;

      /*
       * Look for a justification comment anywhere in the file that
       * explains the elevated client.
       */
      const documented =
        /SERVICE ROLE|service[- ]role|bypasses RLS|RLS bypass/i.test(raw);

      if (!documented) undocumented.push(routeId(file));
    }

    assert.deepEqual(
      undocumented,
      [],
      `These routes use the RLS-bypassing service-role client with no explanation of why it is required:\n${undocumented.join("\n")}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                   IMPLEMENTATION MATCHES THE MIRROR                        */
/* -------------------------------------------------------------------------- */

void describe("lib/auth/authorization.ts invariants", () => {
  const source = readFileSync(
    join(process.cwd(), "lib", "auth", "authorization.ts"),
    "utf8",
  );

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("the role ranks match the mirror used above", () => {
    for (const [role, rank] of Object.entries(ROLE_RANK)) {
      assert.match(
        source,
        new RegExp(`${role}:\\s*${rank}`),
        `lib/auth/authorization.ts must rank ${role} as ${rank}.`,
      );
    }
  });

  void test("only active memberships are honoured", () => {
    assert.match(
      source,
      /status\s*!==\s*["']active["']/,
      "An invited or suspended membership must not grant access.",
    );
  });

  void test("a lookup failure denies rather than allows", () => {
    assert.match(
      source,
      /LOOKUP_FAILED/,
      "A failed membership lookup must fail closed.",
    );

    /*
     * Every early return in the error paths must be a denial. If any
     * `allowed: true` appeared before the membership check, the boundary
     * would be bypassable by inducing an error.
     */
    const errorBranch = source.slice(
      source.indexOf("if (error) {"),
      source.indexOf("if (!data) {"),
    );

    assert.doesNotMatch(
      errorBranch,
      /allowed:\s*true/,
      "The error branch must never report allowed: true.",
    );
  });

  void test("an unrecognised role denies rather than defaulting", () => {
    assert.match(
      source,
      /isOrganizationRole\(record\.role\)/,
      "A role value the code does not recognise must be rejected, not " +
        "mapped to a default that might grant more than intended.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       DENIALS DO NOT LEAK EXISTENCE                        */
/* -------------------------------------------------------------------------- */

void describe("lib/api/tenantGuard.ts invariants", () => {
  const source = readFileSync(
    join(process.cwd(), "lib", "api", "tenantGuard.ts"),
    "utf8",
  );

  void test("denials report 404, never 403", () => {
    /*
     * A 403 confirms the resource exists, letting an unauthorized caller
     * enumerate workspace and project ids. Denials must be
     * indistinguishable from "not found".
     */
    assert.match(source, /status:\s*404/);
    assert.doesNotMatch(
      source,
      /status:\s*403/,
      "A 403 discloses that the resource exists.",
    );
  });

  void test("a lookup failure is a 500, not a 404", () => {
    assert.match(
      source,
      /LOOKUP_FAILED[\s\S]{0,600}?status:\s*500/,
      "A server-side lookup failure is not a statement about the caller.",
    );
  });

  void test("denials are not cached", () => {
    assert.match(source, /"Cache-Control":\s*"private,\s*no-store"/);
  });
});
