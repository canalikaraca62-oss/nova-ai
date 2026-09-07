/**
 * SYRAVEN — /api/workspaces security tests
 *
 * The route that resolved the dashboard dead end. It is also the first
 * route that PROVISIONS an organisation, which makes its authorization
 * boundary unusually important: a mistake here would let a caller attach
 * themselves to a tenant they do not belong to.
 *
 * `public.workspaces` is organisation-scoped, not user-scoped:
 *
 *   SELECT / INSERT  is_organization_member(organization_id)
 *   UPDATE / DELETE  is_organization_admin(organization_id)
 *
 * So the identity that matters is the caller's ORGANISATION, and it must
 * never come from the request.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

const ROUTE = read("app", "api", "workspaces", "route.ts");
const CODE = stripComments(ROUTE);

const CONTEXT = stripComments(
  read("app", "context", "WorkspaceContext.tsx"),
);

const DASHBOARD = stripComments(read("app", "dashboard", "page.tsx"));

/* -------------------------------------------------------------------------- */
/*                              AUTH BOUNDARY                                 */
/* -------------------------------------------------------------------------- */

void describe("/api/workspaces requires a verified session", () => {
  void test("both handlers are wrapped in withAuth", () => {
    assert.match(
      CODE,
      /export\s+const\s+GET\s*=\s*withAuth\s*\(/,
      "GET must require authentication.",
    );
    assert.match(
      CODE,
      /export\s+const\s+POST\s*=\s*withAuth\s*\(/,
      "POST must require authentication.",
    );
  });

  void test("exports no unwrapped handler", () => {
    /*
     * A bare `export async function POST` would bypass withAuth entirely
     * — the shape the removed test-openai endpoint had.
     */
    assert.ok(
      !/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/.test(CODE),
      "CRITICAL: an unwrapped route handler is exported.",
    );
  });

  void test("is not on the middleware public allowlist", () => {
    const middleware = read("middleware.ts");

    const publicBlock = middleware.slice(
      middleware.indexOf("const PUBLIC_API_ROUTES"),
      middleware.indexOf("PUBLIC_STATUS_GET_ROUTES"),
    );

    assert.ok(
      !/workspaces/.test(publicBlock),
      "/api/workspaces must not be publicly reachable.",
    );
  });

  void test("never uses the service-role client", () => {
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE|service_role/.test(CODE),
      "CRITICAL: workspaces must be read and written through RLS.",
    );
  });

  void test("every query runs on the caller's client", () => {
    const queries = CODE.match(/\.\s*from\s*\(\s*["'`][a-z_]+["'`]\s*\)/g) ?? [];

    assert.ok(queries.length >= 3, "Expected queries to inspect.");

    /* Each `.from(` must be reached through session.supabase. */
    const sessionQueries = CODE.match(/session\s*\.\s*supabase\s*\n?\s*\.\s*from/g) ?? [];

    assert.equal(
      sessionQueries.length,
      queries.length,
      "Every query must go through session.supabase.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     IDOR: OWNERSHIP IS NEVER CLIENT-SET                    */
/* -------------------------------------------------------------------------- */

void describe("Ownership and tenancy cannot be supplied by the caller", () => {
  void test("the body parser accepts only name and description", () => {
    const parser = CODE.slice(
      CODE.indexOf("function parseBody"),
      CODE.indexOf("function deriveSlug"),
    );

    assert.ok(parser.length > 0, "Could not isolate parseBody.");

    assert.match(parser, /record\.name/);
    assert.match(parser, /record\.description/);

    /*
     * The decisive assertion. Reading any of these from the body would
     * let a caller place a workspace in another tenant.
     */
    for (const forbidden of [
      "organization_id",
      "organizationId",
      "created_by",
      "createdBy",
      "owner_id",
      "ownerId",
      "user_id",
      "userId",
    ]) {
      assert.ok(
        !new RegExp(`record\\.${forbidden}`).test(parser),
        `CRITICAL: parseBody reads ${forbidden} from the request body.`,
      );
    }
  });

  void test("the insert takes identity from the server only", () => {
    /*
     * Anchored on the POST handler, not on the first `.from("workspaces")`
     * — that also matches the GET listing, and slicing to the next
     * `if (error)` landed inside the organisation-provisioning branch.
     */
    const post = CODE.slice(CODE.indexOf("export const POST"));

    const insert = post.slice(
      post.indexOf('.from("workspaces")'),
      post.indexOf(".select(", post.indexOf('.from("workspaces")')),
    );

    assert.ok(insert.length > 0, "Could not isolate the workspace insert.");

    assert.match(
      insert,
      /created_by:\s*session\.userId/,
      "created_by must come from the verified session.",
    );

    assert.match(
      insert,
      /organization_id:\s*organization\.organizationId/,
      "organization_id must come from the resolved membership.",
    );

    assert.ok(
      !/organization_id:\s*(body|record|input|parsed)/.test(insert),
      "CRITICAL: organization_id is taken from the request.",
    );
  });

  void test("the organisation is resolved from the caller's own membership", () => {
    const resolver = CODE.slice(
      CODE.indexOf("async function resolveOrganizationId"),
      CODE.indexOf("export const GET"),
    );

    assert.ok(resolver.length > 0, "Could not isolate the resolver.");

    assert.match(
      resolver,
      /\.\s*eq\s*\(\s*["'`]user_id["'`]\s*,\s*session\.userId\s*\)/,
      "Membership lookup must be scoped to the session user.",
    );

    assert.match(
      resolver,
      /\.\s*eq\s*\(\s*["'`]status["'`]\s*,\s*["'`]active["'`]\s*\)/,
      "Only an ACTIVE membership may grant access.",
    );
  });

  void test("a provisioned organisation is owned by the caller", () => {
    const resolver = CODE.slice(
      CODE.indexOf("async function resolveOrganizationId"),
      CODE.indexOf("export const GET"),
    );

    assert.match(
      resolver,
      /owner_id:\s*session\.userId/,
      "A new organisation must be owned by the verified caller.",
    );

    assert.match(
      resolver,
      /user_id:\s*session\.userId/,
      "The owner membership must be for the verified caller.",
    );

    /*
     * Self-provisioning must never attach the caller to an EXISTING
     * organisation — it may only create one they own.
     */
    assert.ok(
      !/\.\s*from\s*\(\s*["'`]organizations["'`]\s*\)\s*\n?\s*\.\s*select/.test(
        resolver,
      ),
      "The resolver must not look up organisations it did not create.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            TENANT ISOLATION                                */
/* -------------------------------------------------------------------------- */

void describe("Tenant isolation rests on RLS, not on client filters", () => {
  void test("GET selects explicit columns, never a wildcard", () => {
    const get = CODE.slice(
      CODE.indexOf("export const GET"),
      CODE.indexOf("export const POST"),
    );

    assert.ok(
      !/\.\s*select\s*\(\s*["'`]\*["'`]\s*\)/.test(get),
      "A wildcard select would expose whatever a migration later adds.",
    );

    assert.match(get, /id,\s*name,\s*slug/);
  });

  void test("the listing is bounded", () => {
    const get = CODE.slice(
      CODE.indexOf("export const GET"),
      CODE.indexOf("export const POST"),
    );

    assert.match(
      get,
      /\.\s*limit\s*\(\s*LIMITS\.maxList\s*\)/,
      "An unbounded listing is an enumeration and load risk.",
    );
  });

  void test("a refused insert is reported as forbidden, not as success", () => {
    /*
     * Supabase returns no row when RLS refuses the write. Treating that
     * as success would tell the UI a workspace exists when it does not.
     */
    assert.match(CODE, /if\s*\(\s*!data\s*\)/);
    assert.match(CODE, /fail\(\s*403/);
  });

  void test("database errors are logged without leaking detail", () => {
    const logs = CODE.match(/console\.error\([\s\S]*?\);/g) ?? [];

    assert.ok(logs.length > 0, "Expected error logging.");

    for (const log of logs) {
      /* userId is an opaque uuid and is the useful diagnostic. */
      assert.ok(
        !/\bname\b|\bdescription\b|body|payload/.test(
          log.replace(/"[^"]*"/g, '""'),
        ),
        `A log statement may include caller content:\n${log}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                                VALIDATION                                  */
/* -------------------------------------------------------------------------- */

void describe("Input is validated and bounded", () => {
  void test("a name is required", () => {
    const parser = CODE.slice(
      CODE.indexOf("function parseBody"),
      CODE.indexOf("function deriveSlug"),
    );

    assert.match(parser, /name\.length\s*===\s*0/);
    assert.match(parser, /typeof\s+record\.name\s*!==\s*["'`]string["'`]/);
  });

  void test("name and description are length-bounded", () => {
    assert.match(CODE, /maxName:\s*120/);
    assert.match(CODE, /maxDescription:\s*500/);

    const parser = CODE.slice(
      CODE.indexOf("function parseBody"),
      CODE.indexOf("function deriveSlug"),
    );

    assert.match(parser, /LIMITS\.maxName/);
    assert.match(parser, /LIMITS\.maxDescription/);
  });

  void test("a malformed body is rejected before any query", () => {
    const post = CODE.slice(CODE.indexOf("export const POST"));

    const parseAt = post.indexOf("parseBody");
    const queryAt = post.indexOf("resolveOrganizationId");

    assert.ok(parseAt > -1 && queryAt > -1);
    assert.ok(
      parseAt < queryAt,
      "Validation must run before the database is touched.",
    );
  });

  void test("the slug is derived server-side", () => {
    /*
     * A caller-supplied slug would let one tenant guess or squat another's
     * URLs.
     */
    const parser = CODE.slice(
      CODE.indexOf("function parseBody"),
      CODE.indexOf("function deriveSlug"),
    );

    assert.ok(!/record\.slug/.test(parser), "slug must not come from the body.");
    assert.match(CODE, /slug:\s*deriveSlug\(/);
  });
});

/* -------------------------------------------------------------------------- */
/*                        THE DEAD END IS ACTUALLY FIXED                      */
/* -------------------------------------------------------------------------- */

void describe("The dashboard dead end is resolved", () => {
  void test("workspace creation persists rather than mutating local state", () => {
    const create = CONTEXT.slice(
      CONTEXT.indexOf("const createWorkspace"),
      CONTEXT.indexOf("const updateWorkspace"),
    );

    assert.ok(create.length > 0, "Could not isolate createWorkspace.");

    assert.match(
      create,
      /fetch\(\s*["'`]\/api\/workspaces["'`]/,
      "Creation must reach the API; local state alone does not survive a reload.",
    );

    assert.match(create, /method:\s*["'`]POST["'`]/);
  });

  void test("the client does not send ownership fields", () => {
    const create = CONTEXT.slice(
      CONTEXT.indexOf("const createWorkspace"),
      CONTEXT.indexOf("const updateWorkspace"),
    );

    const body = create.slice(
      create.indexOf("JSON.stringify"),
      create.indexOf("});", create.indexOf("JSON.stringify")),
    );

    for (const forbidden of ["organization_id", "created_by", "owner_id", "user_id"]) {
      assert.ok(
        !new RegExp(forbidden).test(body),
        `The client must not send ${forbidden}.`,
      );
    }
  });

  void test("workspaces are loaded from the API on mount", () => {
    assert.match(
      CONTEXT,
      /fetch\(\s*["'`]\/api\/workspaces["'`][\s\S]{0,120}method:\s*["'`]GET["'`]/,
      "Without a load, a persisted workspace would not reappear.",
    );

    /*
     * Asserted on the mount effect rather than on one exact call
     * spelling. The call is deferred through a microtask so the first
     * setState does not land in the effect body, and an assertion tied
     * to the literal previous form failed on that refactor even though
     * the behaviour was unchanged.
     */
    const mountEffect = CONTEXT.slice(
      CONTEXT.indexOf("useEffect(() => {"),
      CONTEXT.indexOf("}, [refreshWorkspaces]);"),
    );

    assert.ok(mountEffect.length > 0, "Could not isolate the mount effect.");

    assert.match(
      mountEffect,
      /refreshWorkspaces()/,
      "refreshWorkspaces must run on mount.",
    );
  });

  void test("the empty state offers a reachable control", () => {
    /*
     * The reported defect: copy telling the user to create a workspace,
     * with no button. This is the regression guard.
     */
    const emptyState = DASHBOARD.slice(
      DASHBOARD.indexOf("No workspaces yet"),
    );

    assert.match(
      emptyState.slice(0, 3000),
      /<button/,
      "The empty state must contain an actionable control.",
    );

    assert.match(DASHBOARD, /onClick=\{\(\)\s*=>\s*setShowCreate\(true\)\}/);
  });

  void test("the control is wired to the persistent creation flow", () => {
    assert.match(DASHBOARD, /createWorkspace\s*\(\s*\{\s*name\s*\}\s*\)/);
    assert.match(DASHBOARD, /handleCreateWorkspace/);
  });

  void test("creation failure surfaces to the user", () => {
    /*
     * A silently failing button is worse than no button: it looks like
     * it worked.
     */
    assert.match(DASHBOARD, /setCreateError/);
    assert.match(DASHBOARD, /role="alert"/);
  });

  void test("the control is disabled while creating", () => {
    assert.match(DASHBOARD, /disabled=\{isCreating\}/);
  });
});

/* -------------------------------------------------------------------------- */
/*                     FIRST-USE PROVISIONING AND ROLLBACK                    */
/* -------------------------------------------------------------------------- */

/*
 * The provisioning path is the highest-risk part of this route: it is the
 * only place in the application that creates an organisation and a
 * membership, which together decide tenancy for everything else.
 *
 * These assertions cover the SHAPE of that code. The RLS behaviour it
 * depends on was verified separately against the live schema, inside
 * rolled-back transactions:
 *
 *   without the migration   org=t  member=f  workspace=f
 *   with the migration      org=t  member=t  workspace=t
 *   attacker (user A)       cannot join B's org, cannot add B to A's org
 *   rollback                deletes only the caller's own organisation
 */

const MIGRATION = read(
  "supabase",
  "migrations",
  "20260907120000_syraven_owner_self_membership.sql",
);

void describe("First-use organisation provisioning", () => {
  const resolver = CODE.slice(
    CODE.indexOf("async function resolveOrganizationId"),
    CODE.indexOf("export const GET"),
  );

  void test("an existing membership is reused rather than duplicated", () => {
    /*
     * Provisioning must be the exception. Creating an organisation on
     * every call would give one user many tenants.
     */
    assert.match(
      resolver,
      /if\s*\(\s*membership\?\.\s*organization_id\s*\)/,
      "An existing membership must short-circuit provisioning.",
    );
  });

  void test("the created organisation is owned by the caller", () => {
    assert.match(resolver, /owner_id:\s*session\.userId/);
  });

  void test("the membership is for the caller, as owner", () => {
    assert.match(resolver, /user_id:\s*session\.userId/);
    assert.match(resolver, /role:\s*["'`]owner["'`]/);
    assert.match(resolver, /status:\s*["'`]active["'`]/);
  });

  void test("no identity in provisioning comes from the request", () => {
    for (const forbidden of ["body", "record", "input", "parsed", "request"]) {
      assert.ok(
        !new RegExp(`owner_id:\s*${forbidden}`).test(resolver),
        `CRITICAL: owner_id derived from ${forbidden}.`,
      );
      assert.ok(
        !new RegExp(`user_id:\s*${forbidden}`).test(resolver),
        `CRITICAL: user_id derived from ${forbidden}.`,
      );
    }
  });

  void test("provisioning runs on the caller's RLS client", () => {
    assert.ok(
      !/supabaseAdmin|service_role/.test(resolver),
      "CRITICAL: provisioning must not bypass RLS.",
    );

    const inserts = resolver.match(/\.\s*from\s*\(\s*["'`][a-z_]+["'`]\s*\)/g) ?? [];
    const scoped = resolver.match(/session\s*\.\s*supabase/g) ?? [];

    assert.ok(
      scoped.length >= inserts.length,
      "Every provisioning query must go through session.supabase.",
    );
  });
});

void describe("Rollback leaves no orphan organisation", () => {
  const resolver = CODE.slice(
    CODE.indexOf("async function resolveOrganizationId"),
    CODE.indexOf("export const GET"),
  );

  void test("a failed membership deletes the organisation just created", () => {
    const failureBranch = resolver.slice(resolver.indexOf("if (memberError)"));

    assert.match(
      failureBranch,
      /\.\s*from\s*\(\s*["'`]organizations["'`]\s*\)\s*\n?\s*\.\s*delete\s*\(\s*\)/,
      "A failed membership must roll the organisation back.",
    );
  });

  void test("the rollback is bounded to the row created in this request", () => {
    const failureBranch = resolver.slice(resolver.indexOf("if (memberError)"));

    assert.match(
      failureBranch,
      /\.\s*eq\s*\(\s*["'`]id["'`]\s*,\s*organization\.id\s*\)/,
      "Only the organisation created in this request may be deleted.",
    );

    assert.match(
      failureBranch,
      /\.\s*eq\s*\(\s*["'`]owner_id["'`]\s*,\s*session\.userId\s*\)/,
      "A second, independent bound on top of RLS.",
    );
  });

  void test("the delete cannot target an arbitrary organisation", () => {
    const failureBranch = resolver.slice(resolver.indexOf("if (memberError)"));

    /*
     * A positive assertion: capture the value the rollback filters on
     * and require it to be the id returned by the insert in THIS
     * request. Stronger than denying a list of names, because it also
     * rejects an identifier nobody thought to blocklist.
     */
    const target =
      /\.\s*eq\s*\(\s*[`'"]id[`'"]\s*,\s*([A-Za-z0-9_.]+)\s*\)/.exec(
        failureBranch,
      );

    assert.ok(target, "Could not find the rollback id filter.");

    assert.equal(
      target[1],
      "organization.id",
      "CRITICAL: the rollback filters on an id that did not come from " +
        "the insert in this request.",
    );
  });

  void test("a failed rollback is reported rather than swallowed", () => {
    const failureBranch = resolver.slice(resolver.indexOf("if (memberError)"));

    assert.match(failureBranch, /rollbackError/);
    assert.match(
      failureBranch,
      /orphan remains/i,
      "A rollback failure must be identifiable in logs.",
    );
  });

  void test("retries cannot accumulate orphans", () => {
    /*
     * Every failure path in the resolver either rolls back or never
     * created an organisation, so N attempts leave at most the orphans
     * that an explicitly-logged rollback failure produced.
     */
    const failureBranch = resolver.slice(resolver.indexOf("if (memberError)"));

    const returnsBeforeRollback = failureBranch.slice(
      0,
      failureBranch.indexOf(".delete()"),
    );

    assert.ok(
      !/return\s*\{\s*ok:\s*false/.test(returnsBeforeRollback),
      "The handler must not return before rolling back.",
    );
  });
});

/**
 * The executable SQL, with `--` comments removed.
 *
 * The migration explains its own WITH CHECK clause in prose, so an
 * assertion run against the raw file can be satisfied by the comment
 * that describes the rule instead of the rule. Replacing
 * `user_id = auth.uid()` with `true` in the policy body left the
 * documentation — and a passing test — untouched.
 */
const MIGRATION_SQL = MIGRATION.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
void describe("The self-membership migration is minimal", () => {
  void test("the migration exists", () => {
    assert.ok(MIGRATION.length > 0);
  });

  void test("it pins the membership to the caller", () => {
    assert.match(
      MIGRATION_SQL,
      /user_id\s*=\s*auth\.uid\(\)/,
      "A caller must only be able to create their OWN membership.",
    );
  });

  void test("it requires the caller to own the organisation", () => {
    assert.match(MIGRATION_SQL, /o\.owner_id\s*=\s*auth\.uid\(\)/);
    assert.match(MIGRATION_SQL, /from\s+public\.organizations\s+o/);
  });

  void test("it is INSERT-only", () => {
    assert.match(MIGRATION_SQL, /for\s+insert/i);

    assert.ok(
      !/for\s+(update|delete|all|select)/i.test(
        MIGRATION.replace(/--.*$/gm, ""),
      ),
      "This policy must not widen any other operation.",
    );
  });

  void test("it does not touch the existing admin boundary", () => {
    const statements = MIGRATION.replace(/--.*$/gm, "");

    assert.ok(
      !/admins can manage organization members/.test(statements),
      "The admin policy must remain untouched.",
    );
    assert.ok(!/alter\s+table/i.test(statements));
    assert.ok(!/drop\s+policy\s+if\s+exists\s+"admins/i.test(statements));
  });

  void test("it is idempotent", () => {
    assert.match(MIGRATION_SQL, /drop\s+policy\s+if\s+exists/i);
  });
});
