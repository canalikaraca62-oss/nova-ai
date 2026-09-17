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

    /* GET list + POST insert. Organisation resolution is an RPC (B2-D1). */
    assert.ok(queries.length >= 2, "Expected queries to inspect.");

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

  void test("the organisation is resolved by the provisioning authority for the verified session", () => {
    const resolver = CODE.slice(
      CODE.indexOf("async function resolveOrganizationId"),
      CODE.indexOf("export const GET"),
    );

    assert.ok(resolver.length > 0, "Could not isolate the resolver.");

    assert.match(
      resolver,
      /ensurePersonalAccount\(\s*session\.supabase as unknown as PersonalAccountClient,?\s*\)/,
      "The organisation must come from provision_personal_account(), bound to auth.uid().",
    );

    for (const forbidden of ["body", "record", "input", "parsed", "request"]) {
      assert.ok(
        !new RegExp(`\\b${forbidden}\\b`).test(resolver),
        `CRITICAL: organisation resolution reads ${forbidden}.`,
      );
    }
  });

  void test("the route cannot look up or create an organisation itself", () => {
    assert.ok(
      !/\.\s*from\s*\(\s*["'`](?:organizations|organization_members)["'`]\s*\)/.test(CODE),
      "A second provisioning path would bypass the atomic, owner-bound authority.",
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
 * Organisation provisioning used to live in this route: a membership
 * lookup, an organisation insert, an owner-membership insert and a
 * compensating delete. Batch 2-D1 moved it to the single authority,
 * provision_personal_account() (20260917130000), which is atomic,
 * idempotent under a per-user lock, owner-bound to auth.uid() and refuses
 * an unconfirmed email. Its SQL is pinned by
 * tests/schema/personal-account-provisioning-migration.test.ts and its
 * behaviour was verified on TEST. What remains here is the route's side of
 * that contract.
 */

const MIGRATION = read(
  "supabase",
  "migrations",
  "20260907120000_syraven_owner_self_membership.sql",
);

const PROVISIONING_SQL = read(
  "supabase",
  "migrations",
  "20260917130000_syraven_personal_account_provisioning.sql",
)
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

void describe("Organisation resolution uses the single provisioning authority", () => {
  const resolver = CODE.slice(
    CODE.indexOf("async function resolveOrganizationId"),
    CODE.indexOf("export const GET"),
  );

  void test("an existing organisation is reused, never duplicated", () => {
    /* Enforced in the function: it creates only when the owner lookup finds none. */
    assert.match(PROVISIONING_SQL, /if org_id is null then\s+insert into public\.organizations/);
  });

  void test("a refusal is 403, any other failure 503, and nothing is inserted", () => {
    assert.match(resolver, /return \{ ok: false, status: account\.reason === "FORBIDDEN" \? 403 : 503 \};/);

    const post = CODE.slice(CODE.indexOf("export const POST"));

    assert.ok(post.indexOf("if (!organization.ok)") < post.indexOf('.from("workspaces")'));
  });

  void test("the resolved id is the one the authority returned", () => {
    assert.match(resolver, /return \{ ok: true, organizationId: account\.organizationId \};/);
  });

  void test("provisioning runs on the caller's RLS client, never the service role", () => {
    assert.ok(!/supabaseAdmin|service_role/.test(resolver), "CRITICAL: provisioning must not bypass RLS.");
    assert.match(resolver, /session\.supabase/);
  });
});

void describe("Provisioning is atomic: the route has nothing to roll back", () => {
  void test("the route deletes nothing", () => {
    assert.ok(!/\.\s*delete\s*\(\s*\)/.test(CODE), "A compensating delete means a non-atomic provisioning path is back.");
  });

  void test("the authority commits all rows together or none", () => {
    assert.ok(!/\bexception\s+when\b|\bcommit\b|\brollback\b/i.test(PROVISIONING_SQL), "A handler or transaction control would allow a partial provisioning.");
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

/* -------------------------------------------------------------------------- */
/*                THE CREATE CONTROL MUST BE STATE-INDEPENDENT                */
/* -------------------------------------------------------------------------- */

/*
 * The first fix put a Create workspace control in the dashboard's EMPTY
 * state. That branch never renders for a real user: registration
 * provisions an organisation and a workspace, so a new account always
 * lands on the populated view. The dead end had simply moved one state
 * over, and only a browser run against production caught it -- every
 * source-level assertion still passed.
 */

void describe("Creating a workspace is reachable in every state", () => {
  const panel = DASHBOARD.slice(
    DASHBOARD.indexOf("Recent Workspaces"),
    DASHBOARD.indexOf("No workspaces yet"),
  );

  void test("a create control exists outside the empty state", () => {
    assert.ok(
      panel.length > 0,
      "Could not isolate the populated workspace panel.",
    );

    assert.match(
      panel,
      /setShowCreate/,
      "CRITICAL: a user who already has a workspace has no way to " +
        "create another -- the original dead end, one state over.",
    );
  });

  void test("the control is a real button, not text", () => {
    assert.match(panel, /<button/);
    assert.match(panel, /onClick=/);
  });

  void test("the form it opens is not nested in the empty state", () => {
    /*
      If the only input lives inside the `No workspaces yet` branch,
      the button above opens nothing for a populated account.
    */
    const beforeEmpty = DASHBOARD.slice(
      0, DASHBOARD.indexOf("No workspaces yet"),
    );

    assert.match(
      beforeEmpty,
      /newWorkspaceName/,
      "The create form must render for accounts that already have a " +
        "workspace.",
    );
  });

  void test("the workspace name input has exactly one id", () => {
    /* Two copies of the form would duplicate a DOM id. */
    const ids =
      DASHBOARD.match(/id="[a-z-]*new-workspace[a-z-]*"/g) ?? [];

    assert.equal(
      ids.length,
      1,
      `Duplicate create forms produce a duplicate id: ${ids.join(", ")}`,
    );
  });
});
