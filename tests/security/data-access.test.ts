/**
 * SYRAVEN — Data access boundary tests
 *
 * Phase 4 (see IMPLEMENTATION_PLAN.md).
 *
 * ARCHITECTURE_AUDIT.md §8.6: the RLS-bypassing service-role client was
 * the DEFAULT data client, which is why the policies in
 * supabase/migrations never executed for application traffic, and why a
 * single missing ownership filter became a full breach (§8.1).
 *
 * Phase 4 inverts that: the caller's own RLS-enforced client is the
 * default, and every remaining elevated use must be a deliberate,
 * documented exception.
 *
 * These tests hold that line.
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
  return file.replace(process.cwd(), "").replace(/\\/g, "/").replace(/^\//, "");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ROUTE_FILES = findRouteFiles(API_DIR);

/* -------------------------------------------------------------------------- */
/*                    ELEVATED ACCESS IS AN ALLOWLIST                         */
/* -------------------------------------------------------------------------- */

/**
 * The ONLY routes permitted to use the RLS-bypassing client, each with
 * the reason it cannot use the caller's client.
 *
 * Adding an entry here is a security decision, not a convenience.
 */
const ELEVATED_ALLOWLIST: Record<string, string> = {
  "app/api/auth/register/route.ts":
    "No caller identity: creates the user and org before any session exists.",
  "app/api/billing/webhook/route.ts":
    "No caller identity: authenticated by Stripe signature, not a session.",
  "app/api/files/upload/route.ts":
    "Storage operations are governed by bucket policies, not table RLS.",
  "app/api/notifications/route.ts":
    "Create only: notifications have no insert policy by design.",
};

void describe("Service-role client is an allowlisted exception", () => {
  void test("no route outside the allowlist uses supabaseAdmin", () => {
    const offenders: string[] = [];

    for (const file of ROUTE_FILES) {
      const id = routeId(file);
      const code = stripComments(readFileSync(file, "utf8"));

      if (!/\bsupabaseAdmin\b/.test(code)) continue;
      if (id in ELEVATED_ALLOWLIST) continue;

      offenders.push(id);
    }

    assert.deepEqual(
      offenders,
      [],
      `These routes bypass RLS without being on the reviewed allowlist. Use the caller's client (session.supabase), or add an entry here with a written reason:\n${offenders.join("\n")}`,
    );
  });

  void test("every allowlisted route still actually uses it", () => {
    /*
     * Keeps the allowlist honest: an entry that no longer applies should
     * be removed rather than left as standing permission.
     */
    const stale: string[] = [];

    for (const id of Object.keys(ELEVATED_ALLOWLIST)) {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      if (!/\bsupabaseAdmin\b/.test(code)) stale.push(id);
    }

    assert.deepEqual(
      stale,
      [],
      `These routes no longer use supabaseAdmin. Remove them from ELEVATED_ALLOWLIST so it does not grant unused permission:\n${stale.join("\n")}`,
    );
  });

  void test("each elevated route documents the reason at the call site", () => {
    const undocumented: string[] = [];

    for (const id of Object.keys(ELEVATED_ALLOWLIST)) {
      const raw = readFileSync(join(process.cwd(), id), "utf8");

      const documented =
        /ELEVATED ACCESS —|SERVICE ROLE CLIENT —|DATA ACCESS \(Phase 4\)/.test(
          raw,
        );

      if (!documented) undocumented.push(id);
    }

    assert.deepEqual(undocumented, [], undocumented.join("\n"));
  });
});

/* -------------------------------------------------------------------------- */
/*                     MIGRATED ROUTES USE THE RLS CLIENT                     */
/* -------------------------------------------------------------------------- */

void describe("Migrated routes use the caller's RLS-enforced client", () => {
  /**
   * Routes moved off the service-role client in Phase 4. Each must bind
   * the session client and must not reacquire the admin client.
   */
  const MIGRATED = [
    "app/api/knowledge/route.ts",
    "app/api/knowledge/search/route.ts",
    "app/api/tasks/route.ts",
    "app/api/tasks/execute/route.ts",
    "app/api/usage/route.ts",
    "app/api/projects/route.ts",
  ];

  for (const id of MIGRATED) {
    void test(`${id} uses session.supabase`, () => {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      assert.match(
        code,
        /session\.supabase/,
        `${id} should read its data through the caller's RLS-enforced ` +
          `client.`,
      );
    });

    void test(`${id} does not use supabaseAdmin`, () => {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      assert.doesNotMatch(
        code,
        /\bsupabaseAdmin\b/,
        `${id} was migrated off the service-role client and must not ` +
          `reacquire it.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*             OWNERSHIP FILTERS SURVIVE THE CLIENT SWITCH                    */
/* -------------------------------------------------------------------------- */

void describe("RLS did not replace the explicit ownership filters", () => {
  /**
   * The whole point of Phase 4 is TWO controls, not one. Switching to the
   * RLS client must not become an excuse to drop the `user_id` filters —
   * if a policy is ever loosened, those filters are what still stand
   * between one tenant and another.
   */
  const OWNERSHIP_FILTERED = [
    "app/api/knowledge/route.ts",
    "app/api/notifications/route.ts",
    "app/api/projects/route.ts",
    "app/api/tasks/route.ts",
    "app/api/usage/route.ts",
  ];

  for (const id of OWNERSHIP_FILTERED) {
    void test(`${id} still filters by user_id`, () => {
      const code = stripComments(
        readFileSync(join(process.cwd(), id), "utf8"),
      );

      assert.match(
        code,
        /["']user_id["']/,
        `${id} lost its explicit ownership filter. RLS is defence in ` +
          `depth beneath these filters, not a replacement for them.`,
      );
    });
  }

  void test("no migrated route derives identity from client input", () => {
    /*
     * Re-asserts the Phase 1 invariant against the Phase 4 edits: the
     * client switch must not have reintroduced a client-supplied userId.
     */
    const offenders: string[] = [];

    for (const file of ROUTE_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));

      if (
        /searchParams\s*\.\s*get\(\s*["'`]userId["'`]\s*\)/.test(code) ||
        /\bbody\s*\.\s*userId\b/.test(code)
      ) {
        offenders.push(routeId(file));
      }
    }

    assert.deepEqual(offenders, [], offenders.join("\n"));
  });
});

/* -------------------------------------------------------------------------- */
/*                   PROJECTS OWNERSHIP RECONCILIATION                        */
/* -------------------------------------------------------------------------- */

void describe("projects ownership model", () => {
  const projectsRoute = readFileSync(
    join(process.cwd(), "app", "api", "projects", "route.ts"),
    "utf8",
  );

  const code = stripComments(projectsRoute);

  /**
   * public.projects RLS policies (20260901154222) predicate on owner_id.
   * A row created without it is invisible to its own creator through the
   * caller's client, and the route silently returns nothing.
   *
   * This is the invariant that made the RLS switch possible, so it is
   * asserted rather than assumed.
   */
  void test("insert populates owner_id, the canonical RLS column", () => {
    assert.match(
      code,
      /owner_id:\s*\n?\s*userId,/,
      "public.projects RLS predicates on owner_id. An insert that omits " +
        "it produces a row its own creator cannot read back through the " +
        "RLS client.",
    );
  });

  void test("insert also populates the user_id compatibility column", () => {
    assert.match(
      code,
      /user_id:\s*\n?\s*userId,/,
      "user_id backs projects_user_id_idx and the tasks route's project " +
        "validator. Both columns must stay populated and consistent.",
    );
  });

  void test("both ownership columns come from the verified session", () => {
    /*
     * If either column were ever taken from request input, the two could
     * diverge and one would no longer reflect the real owner.
     */
    assert.doesNotMatch(
      code,
      /owner_id:\s*\n?\s*body\./,
      "owner_id must come from the verified session, never the request.",
    );

    assert.doesNotMatch(
      code,
      /user_id:\s*\n?\s*body\./,
      "user_id must come from the verified session, never the request.",
    );
  });

  void test("the RLS policy column has not been changed to match the code", () => {
    /*
     * The reconciliation had to work in ONE direction: code populates the
     * column the policy already checks. Rewriting the policy to check
     * user_id instead would have widened access, since user_id was added
     * as a compatibility column with no membership semantics.
     */
    const migrations = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260901154222_syraven_enterprise_core.sql",
      ),
      "utf8",
    );

    const policyBlock = migrations.slice(
      migrations.indexOf('create policy "users can create projects"'),
    );

    const insertPolicy = policyBlock.slice(0, policyBlock.indexOf(");"));

    assert.match(
      insertPolicy,
      /owner_id\s*=\s*auth\.uid\(\)/,
      "The projects insert policy must keep predicating on owner_id.",
    );

    assert.doesNotMatch(
      insertPolicy,
      /user_id\s*=\s*auth\.uid\(\)/,
      "Loosening the policy to accept user_id would widen access instead " +
        "of reconciling the models.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    lib/data/client.ts INVARIANTS                           */
/* -------------------------------------------------------------------------- */

void describe("lib/data/client.ts invariants", () => {
  const source = readFileSync(
    join(process.cwd(), "lib", "data", "client.ts"),
    "utf8",
  );

  void test("is server-only", () => {
    assert.match(source, /import\s+["']server-only["']/);
  });

  void test("elevated access requires a written justification", () => {
    assert.match(
      source,
      /justification[\s\S]{0,200}?throw new Error/,
      "elevatedClient must reject a bare reason code with no explanation, " +
        "otherwise 'documented' decays into a rubber stamp.",
    );
  });

  void test("the reason codes stay a closed set", () => {
    for (const reason of [
      "NO_CALLER_IDENTITY",
      "UNFORGEABLE_RECORD",
      "STORAGE_OPERATION",
      "RLS_PREDICATE_MISMATCH",
    ]) {
      assert.match(
        source,
        new RegExp(`"${reason}"`),
        `ElevatedAccessReason must include ${reason}.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                  ORPHANED SERVICES STAY DISCONNECTED                       */
/* -------------------------------------------------------------------------- */

void describe("In-memory services are not wired into request paths", () => {
  /**
   * Phase 4's plan says to route logic through services/ — but every file
   * there is an in-memory Map store with no Supabase import. Reconnecting
   * one would replace working persistence with data that vanishes on
   * restart, and would silently drop the RLS enforcement this phase just
   * established.
   *
   * This test records that finding as an executable constraint: if a
   * service is ever reconnected, it must first gain real persistence.
   */
  const SERVICES_DIR = join(process.cwd(), "services");

  void test("no route imports a service that has no database access", () => {
    const offenders: string[] = [];

    for (const file of ROUTE_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));

      const imports = [
        ...code.matchAll(/from\s+["']@\/services\/([a-zA-Z0-9_.\-/]+)["']/g),
      ].map((m) => m[1]);

      for (const name of imports) {
        if (!name) continue;

        /* Type-only modules carry no data-access risk. */
        if (name.endsWith("-types") || name.endsWith("types")) continue;

        let serviceSource = "";
        try {
          serviceSource = readFileSync(
            join(SERVICES_DIR, `${name}.ts`),
            "utf8",
          );
        } catch {
          continue;
        }

        if (!/supabase|createClient/i.test(serviceSource)) {
          offenders.push(`${routeId(file)} imports services/${name}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `A route imports a service with no database access. Those services are in-memory stores; wiring one into a request path would lose persistence and bypass RLS:\n${offenders.join("\n")}`,
    );
  });
});
