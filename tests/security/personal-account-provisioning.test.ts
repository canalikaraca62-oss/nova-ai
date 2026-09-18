/**
 * SYRAVEN — login-time personal account provisioning (B2-D1)
 * tests/security/personal-account-provisioning.test.ts
 *
 * Phase 3, Batch 2-D1 (docs/engineering/SECURITY_EVIDENCE.md). Founder
 * decisions: D-B2D-1 (provisioning failure -> signOut + 403/503),
 * D-B2D-2 (existing sessions -> POST /api/account/provision; GET
 * /api/workspaces stays read-only), D-B2D-3 (B2-D1 only).
 *
 * Two layers:
 *   - unit tests of the pure classifier that decides whether a
 *     provisioning response counts as success;
 *   - static guards on the helper, its three callers and the dashboard
 *     provider.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { interpretProvisioning } from "../../lib/tenancy/personalAccountResult.ts";

const ROOT = process.cwd();

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(join(ROOT, dir))) {
    const full = join(ROOT, dir, entry);

    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(relative(ROOT, full)));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(relative(ROOT, full).replace(/\\/g, "/"));
    }
  }

  return out;
}

const APP_FILES = [...sourceFiles("app"), ...sourceFiles("lib")];

const HELPER = "lib/tenancy/personalAccount.ts";
const LOGIN = "app/api/auth/login/route.ts";
const PROVISION = "app/api/account/provision/route.ts";
const WORKSPACES = "app/api/workspaces/route.ts";
/* Batch 2-D2 added the fourth caller: the email-confirmation landing. */
const CONFIRM = "app/api/auth/confirm/route.ts";
const CONTEXT = "app/context/WorkspaceContext.tsx";

const code = (file: string) => stripComments(read(file));

const ORG = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const WS = "9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b";

/* -------------------------------------------------------------------------- */
/*                       UNIT: WHAT COUNTS AS SUCCESS                         */
/* -------------------------------------------------------------------------- */

void describe("interpretProvisioning: only the exact contract is success", () => {
  void test("a created account is success", () => {
    assert.deepEqual(interpretProvisioning({ organization_id: ORG, workspace_id: WS, created: true }, null), {
      ok: true,
      organizationId: ORG,
      workspaceId: WS,
      created: true,
    });
  });

  void test("an existing account is success with created false", () => {
    const result = interpretProvisioning({ organization_id: ORG, workspace_id: WS, created: false }, null);

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.created, false);
  });

  void test("upper-case uuids are accepted", () => {
    assert.equal(
      interpretProvisioning({ organization_id: ORG.toUpperCase(), workspace_id: WS.toUpperCase(), created: false }, null).ok,
      true,
    );
  });

  void test("42501 (unconfirmed email, no identity, no EXECUTE) is FORBIDDEN", () => {
    assert.deepEqual(interpretProvisioning(null, { code: "42501" }), { ok: false, reason: "FORBIDDEN" });
  });

  const unavailable: Array<[string, unknown, { code?: unknown } | null | undefined]> = [
    ["function missing (PGRST202)", null, { code: "PGRST202" }],
    ["a 5xx-shaped error", null, { code: "XX000" }],
    ["an error without a code", null, {}],
    ["an error even with a valid-looking body", { organization_id: ORG, workspace_id: WS, created: true }, { code: "PGRST116" }],
    ["null data", null, null],
    ["undefined data", undefined, undefined],
    ["an array", [{ organization_id: ORG, workspace_id: WS, created: true }], null],
    ["a string", "ok", null],
    ["a missing workspace_id", { organization_id: ORG, created: true }, null],
    ["an extra field", { organization_id: ORG, workspace_id: WS, created: true, role: "owner" }, null],
    ["created as a string", { organization_id: ORG, workspace_id: WS, created: "true" }, null],
    ["created missing", { organization_id: ORG, workspace_id: WS }, null],
    ["a non-uuid organization_id", { organization_id: "not-a-uuid", workspace_id: WS, created: true }, null],
    ["an empty workspace_id", { organization_id: ORG, workspace_id: "", created: true }, null],
    ["a numeric id", { organization_id: 1, workspace_id: WS, created: true }, null],
    ["a null id", { organization_id: null, workspace_id: WS, created: true }, null],
    ["a uuid with trailing text", { organization_id: `${ORG}x`, workspace_id: WS, created: true }, null],
  ];

  for (const [name, data, error] of unavailable) {
    void test(`${name} is UNAVAILABLE, never success`, () => {
      assert.deepEqual(interpretProvisioning(data, error), { ok: false, reason: "UNAVAILABLE" });
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                        ONE AUTHORITY, ONE HELPER                           */
/* -------------------------------------------------------------------------- */

void describe("provision_personal_account() has exactly one application caller", () => {
  void test("only the helper calls the RPC, with no arguments", () => {
    const callers = APP_FILES.filter((file) => /provision_personal_account/.test(code(file)));

    assert.deepEqual(callers, [HELPER]);
    assert.match(code(HELPER), /\.rpc\("provision_personal_account"\)/);
    assert.ok(!/\.rpc\("provision_personal_account"\s*,/.test(code(HELPER)), "An argument is a client-supplied identity or target.");
  });

  void test("the helper is server-only and never uses the service role", () => {
    assert.match(code(HELPER), /^import "server-only";$/m);

    for (const file of [HELPER, LOGIN, PROVISION, WORKSPACES, CONFIRM]) {
      assert.ok(
        !/supabaseAdmin|getSupabaseAdminClient|SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY|service_role/.test(code(file)),
        `${file} must provision on the caller's RLS client.`,
      );
    }
  });

  void test("the helper accepts a client, never an id", () => {
    assert.match(code(HELPER), /export async function ensurePersonalAccount\(\s*client: PersonalAccountClient,?\s*\): Promise<PersonalAccountResult>/);
  });

  void test("the helper never lets an exception or a failure out as success", () => {
    const helper = code(HELPER);

    assert.match(helper, /const result = interpretProvisioning\(data, error\);/);
    assert.match(helper, /catch \{[\s\S]*?return \{ ok: false, reason: "UNAVAILABLE" \};/);
  });

  void test("exactly four files call ensurePersonalAccount, each with its own RLS client", () => {
    /*
     * Batch 2-D1 pinned three callers. Batch 2-D2 added /api/auth/confirm,
     * which provisions on the session that email confirmation produced,
     * through the same helper and with no identity passed. The count is
     * pinned so a fifth caller cannot appear unnoticed.
     */
    const callers = APP_FILES.filter((file) => file !== HELPER && /ensurePersonalAccount\(/.test(code(file))).sort();

    assert.deepEqual(callers, [PROVISION, LOGIN, WORKSPACES, CONFIRM].sort());

    for (const file of callers) {
      const calls = [...code(file).matchAll(/ensurePersonalAccount\(\s*([^)]*?)\s*\)/g)].map((match) => match[1]?.trim());

      assert.ok(calls.length > 0);

      for (const argument of calls) {
        assert.match(
          argument ?? "",
          /^(?:session\.supabase|supabase) as unknown as PersonalAccountClient,?$/,
          `${file} must pass its own RLS client, nothing else.`,
        );
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                      D-B2D-1: LOGIN IS STRICTLY FAIL-CLOSED                */
/* -------------------------------------------------------------------------- */

void describe("D-B2D-1: login succeeds only after provisioning succeeds", () => {
  const login = code(LOGIN);
  const signInAt = login.indexOf("signInWithPassword(");
  const provisionAt = login.indexOf("ensurePersonalAccount(");
  const failureAt = login.indexOf("if (!account.ok)");
  const successAt = login.indexOf("NextResponse.json({ success: true }");

  void test("provisioning runs after sign-in and before the only success response", () => {
    assert.ok(signInAt !== -1 && provisionAt > signInAt, "Provisioning must use the session just created.");
    assert.ok(failureAt > provisionAt, "The provisioning result must be checked.");
    assert.ok(successAt > failureAt, "Success may only be returned after the failure branch.");
    assert.equal([...login.matchAll(/success: true/g)].length, 1, "There must be exactly one success response.");
  });

  const failure = login.slice(failureAt, successAt);

  void test("a failed provisioning signs the new session out (this session only)", () => {
    assert.match(failure, /supabase\.auth\.signOut\(\{ scope: "local" \}\)/);

    const signOutAt = failure.indexOf("signOut(");
    const returnAt = failure.search(/return account\.reason/);

    assert.ok(signOutAt !== -1 && returnAt > signOutAt, "The session must be removed before the error is returned.");
    assert.ok(!/if\s*\(\s*account\.reason[^)]*\)\s*\{[\s\S]*?signOut/.test(failure), "Sign-out must not depend on the failure reason.");
  });

  void test("FORBIDDEN answers 403, everything else 503, both with an error", () => {
    assert.match(
      failure,
      /return account\.reason === "FORBIDDEN"\s*\?\s*fail\(403,[^)]*\)\s*:\s*fail\(503,[^)]*\);/,
    );
  });

  void test("a sign-out failure is logged and does not change the error response", () => {
    assert.match(failure, /signOutError/);
    assert.match(failure, /catch \{/);
    assert.ok(!/return[^;]*success:\s*true/.test(failure));
  });

  void test("the login response still carries no token, id or email", () => {
    assert.ok(!/organizationId|workspaceId|access_token|user\.id|email:/.test(login.slice(successAt, successAt + 200)));
  });
});

/* -------------------------------------------------------------------------- */
/*              D-B2D-2: EXISTING SESSIONS THROUGH ONE POST ENDPOINT          */
/* -------------------------------------------------------------------------- */

void describe("D-B2D-2: POST /api/account/provision", () => {
  const route = code(PROVISION);

  void test("only POST is exported, wrapped in withAuth", () => {
    assert.match(route, /export const POST = withAuth\(/);
    assert.ok(!/export (?:async function|const) (?:GET|PUT|PATCH|DELETE)\b/.test(route));
    assert.ok(!/export async function POST/.test(route));
  });

  void test("nothing is read from the request", () => {
    assert.match(route, /async \(_request: NextRequest, session: AuthenticatedSession\)/);
    assert.ok(!/_request\.|request\.(?:json|text|formData|headers|nextUrl|url|body)/.test(route));
  });

  void test("the body names no organisation or workspace id", () => {
    assert.match(route, /\{ success: true, created: result\.created \}/);
    assert.ok(!/organizationId|workspaceId|organization_id|workspace_id/.test(route));
  });

  void test("failures are 403 / 503 and never success", () => {
    assert.match(route, /status: 403/);
    assert.match(route, /status: 503/);
    assert.ok(route.indexOf("if (!result.ok)") < route.indexOf("success: true"));
  });

  void test("it is not on the middleware public allowlist", () => {
    const middleware = read("middleware.ts");
    const publicBlock = middleware.slice(middleware.indexOf("const PUBLIC_API_ROUTES"), middleware.indexOf("PUBLIC_STATUS_GET_ROUTES"));

    assert.ok(!/account/.test(publicBlock));
  });
});

void describe("D-B2D-2: GET /api/workspaces stays read-only", () => {
  const route = code(WORKSPACES);
  const get = route.slice(route.indexOf("export const GET"), route.indexOf("export const POST"));

  void test("GET neither provisions nor resolves an organisation", () => {
    assert.ok(get.length > 0);
    assert.ok(!/ensurePersonalAccount|resolveOrganizationId|\.insert\(|\.rpc\(/.test(get));
  });

  void test("the route no longer writes organisations or memberships itself", () => {
    assert.ok(!/\.from\("organizations"\)|\.from\("organization_members"\)|\.delete\(\)/.test(route));
  });

  void test("organisation resolution delegates to the authority and fails closed", () => {
    const resolver = route.slice(route.indexOf("async function resolveOrganizationId"), route.indexOf("export const GET"));

    assert.match(resolver, /const account = await ensurePersonalAccount\(\s*session\.supabase as unknown as PersonalAccountClient,?\s*\);/);
    assert.match(resolver, /if \(!account\.ok\) \{\s*return \{ ok: false, status: account\.reason === "FORBIDDEN" \? 403 : 503 \};/);
    assert.match(resolver, /return \{ ok: true, organizationId: account\.organizationId \};/);
  });
});

void describe("D-B2D-2: the dashboard provider provisions once, never in a loop", () => {
  const context = code(CONTEXT);
  const refresh = context.slice(context.indexOf("const refreshWorkspaces"), context.indexOf("const createWorkspace"));
  const provisionAt = refresh.indexOf('fetch("/api/account/provision"');

  void test("provisioning is requested only for an empty list, once per mount", () => {
    assert.ok(provisionAt !== -1);

    const guard = refresh.slice(0, provisionAt);

    /* The flag is set inside the guard, before the request is started. */
    assert.match(
      guard,
      /if \(\(payload\.workspaces \?\? \[\]\)\.length === 0 && !provisionAttemptedRef\.current\) \{\s*provisionAttemptedRef\.current = true;\s*const provision = await $/,
    );
    assert.match(context, /const provisionAttemptedRef = useRef\(false\);/);
  });

  void test("the provisioning request sends no body and no identity", () => {
    const call = refresh.slice(provisionAt, refresh.indexOf("});", provisionAt));

    assert.match(call, /method: "POST"/);
    assert.ok(!/body:|organization|user|workspace_id/.test(call));
  });

  void test("a failed provisioning throws; only success reloads the list", () => {
    const after = refresh.slice(provisionAt);
    const failAt = after.indexOf("if (!provision.ok)");
    const throwAt = after.indexOf("throw new Error(", failAt);
    const reloadAt = after.indexOf('fetch("/api/workspaces"');

    assert.ok(failAt !== -1 && throwAt > failAt && reloadAt > throwAt);
  });

  void test("the 401 path does not provision", () => {
    const unauthorized = refresh.slice(refresh.indexOf("response.status === 401"), refresh.indexOf("if (!response.ok)"));

    assert.ok(unauthorized.length > 0 && !/provision/.test(unauthorized));
  });
});
