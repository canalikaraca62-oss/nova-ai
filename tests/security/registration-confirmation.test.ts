import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
  SYRAVEN — Registration and email confirmation (Phase 3, Batch 2-D2)

  WHAT THIS PINS

  Registration used to create users with `email_confirm: true` through the
  SERVICE ROLE, then build an organization, membership, workspace and
  audit row in four non-atomic steps. Batch 2-D2 removed all of it: the
  route now asks GoTrue for an UNCONFIRMED user and writes nothing.

  These are source-as-text guards. They cannot prove runtime behaviour —
  the TEST-environment proofs do that — but they catch the specific
  regressions that would silently restore the old, broken flow:

    - pre-confirming a user again (no email, and no trial, because the
      trial only starts on the email_confirmed_at transition);
    - giving registration the RLS-bypassing client again;
    - creating tenancy from the register route instead of the single
      provisioning authority;
    - turning the reply into an account-enumeration oracle;
    - forwarding client-supplied plan/trial/role metadata;
    - letting the confirmation route succeed without verifying a token,
      or report a failed provisioning as success.
*/

const ROOT = process.cwd();

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

/** Source with comments removed: a guard must read code, not prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const REGISTER_RAW = read("app", "api", "auth", "register", "route.ts");
const REGISTER = stripComments(REGISTER_RAW);

const CONFIRM_RAW = read("app", "api", "auth", "confirm", "route.ts");
const CONFIRM = stripComments(CONFIRM_RAW);

const MIDDLEWARE = read("middleware.ts");

const REGISTER_PAGE = stripComments(read("app", "register", "page.tsx"));

/* -------------------------------------------------------------------------- */
/*                 A. REGISTRATION CREATES AN UNCONFIRMED USER                */
/* -------------------------------------------------------------------------- */

void describe("A. registration goes through GoTrue signUp, unconfirmed", () => {
  void test("it calls signUp and nothing else creates the user", () => {
    assert.match(
      REGISTER,
      /supabase\.auth\.signUp\(/,
      "Registration must use the normal signUp path.",
    );

    assert.ok(
      !/admin\.auth\.admin\.createUser|auth\.admin\.createUser/.test(REGISTER),
      "CRITICAL: admin.createUser is back. It creates users directly and can pre-confirm them.",
    );
  });

  void test("nothing pre-confirms the address", () => {
    assert.ok(
      !/email_confirm\s*:/.test(REGISTER),
      "CRITICAL: email_confirm pre-confirms the user, so no email is sent and no trial ever starts.",
    );
  });

  void test("the confirmation link is sent to this application's confirm route", () => {
    assert.match(
      REGISTER,
      /emailRedirectTo:\s*`\$\{appUrl[^`]*\}\/api\/auth\/confirm`/,
      "The confirmation link must land on /api/auth/confirm.",
    );
  });

  void test("a missing app URL fails closed rather than stranding an account", () => {
    const guard = REGISTER.slice(
      REGISTER.indexOf("NEXT_PUBLIC_APP_URL"),
      REGISTER.indexOf("SIGN UP") > 0
        ? REGISTER.indexOf("supabase.auth.signUp")
        : REGISTER.length,
    );

    assert.match(guard, /if\s*\(!appUrl\)/);
    assert.match(guard, /503/);
  });

  void test("registration never uses the service role", () => {
    assert.ok(
      !/supabaseAdmin|getSupabaseAdminClient|SERVICE_ROLE/.test(REGISTER),
      "CRITICAL: the RLS-bypassing client is back in the public registration route.",
    );
  });

  void test("registration issues no session", () => {
    assert.ok(
      !/signInWithPassword/.test(REGISTER),
      "Registration must not sign the user in: the address is unproven until confirmation.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    B. REGISTRATION CREATES NO TENANCY                      */
/* -------------------------------------------------------------------------- */

void describe("B. the register route writes nothing", () => {
  void test("it inserts no organization, membership, workspace or audit row", () => {
    for (const table of [
      "organizations",
      "organization_members",
      "workspaces",
      "audit_logs",
      "profiles",
    ]) {
      assert.ok(
        !new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]`).test(REGISTER),
        `CRITICAL: the register route writes ${table} again. Tenancy has one authority: provision_personal_account().`,
      );
    }
  });

  void test("it has no compensating delete, because it creates nothing to roll back", () => {
    assert.ok(
      !/\.delete\(\)|deleteUser\(/.test(REGISTER),
      "A cleanup path means the route created something it should not have.",
    );
  });

  void test("it writes no trial dates", () => {
    assert.ok(
      !/trial_started_at|trial_ends_at|trial_active|TRIAL_DURATION_DAYS/.test(
        REGISTER,
      ),
      "The trial is started by start_trial_on_email_confirmation(), never by this route.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      C. CLIENT METADATA IS NOT TRUSTED                     */
/* -------------------------------------------------------------------------- */

void describe("C. only a display name reaches user metadata", () => {
  void test("the metadata whitelist carries no entitlement field", () => {
    const options = REGISTER.slice(
      REGISTER.indexOf("options:"),
      REGISTER.indexOf("emailRedirectTo"),
    );

    assert.match(options, /full_name/);
    assert.match(options, /name:/);

    for (const forbidden of [
      "plan",
      "account_plan",
      "account_status",
      "trial",
      "permanent_free_tier",
      "role",
      "organization",
      "owner",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(options),
        `CRITICAL: ${forbidden} is forwarded into user metadata from a request nobody has verified.`,
      );
    }
  });

  void test("the body schema accepts only name, email and password", () => {
    const schema = REGISTER.slice(
      REGISTER.indexOf("registerSchema = z.object("),
      REGISTER.indexOf("type RegisterInput"),
    );

    const fields = (schema.match(/^\s{2}([a-z_]+):/gm) ?? []).map((line) =>
      line.trim().replace(":", ""),
    );

    assert.deepEqual(
      fields.sort(),
      ["email", "name", "password"],
      "The registration body must accept nothing else.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        D. NO ACCOUNT ENUMERATION                           */
/* -------------------------------------------------------------------------- */

void describe("D. the reply reveals nothing about the address", () => {
  void test("no 409 and no 'already exists' message", () => {
    assert.ok(
      !/409/.test(REGISTER),
      "CRITICAL: a 409 for an existing address is an enumeration oracle.",
    );

    assert.ok(
      !/already (registered|exists)/i.test(REGISTER),
      "CRITICAL: the reply must not say the address is taken.",
    );
  });

  void test("a sign-up error answers with the same success body", () => {
    const branch = REGISTER.slice(
      REGISTER.indexOf("if (error)"),
      REGISTER.indexOf("return jsonSuccess();", REGISTER.indexOf("if (error)")) +
        "return jsonSuccess();".length,
    );

    assert.match(
      branch,
      /return jsonSuccess\(\);\s*$/,
      "An unexpected sign-up error must fall through to the same reply as success.",
    );
  });

  void test("the success body carries no identifier", () => {
    const success = REGISTER.slice(REGISTER.indexOf("function jsonSuccess"));

    for (const leaked of ["user", "id", "email", "organization", "workspace"]) {
      assert.ok(
        !new RegExp(`${leaked}\\s*:`, "i").test(success),
        `The success body must not echo ${leaked}.`,
      );
    }
  });

  void test("the address is never logged", () => {
    const logs = REGISTER.match(/console\.(error|warn|log)\([\s\S]*?\);/g) ?? [];

    for (const call of logs) {
      assert.ok(
        !/input\.email|normalizedEmail|\bemail\b/.test(call),
        `A log line carries the email address: ${call.slice(0, 80)}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        E. THE CONFIRMATION ROUTE                           */
/* -------------------------------------------------------------------------- */

void describe("E. confirmation verifies before it trusts anything", () => {
  void test("only GET is exported", () => {
    assert.match(CONFIRM, /export async function GET\(/);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(
        !new RegExp(`export (async )?function ${method}\\(`).test(CONFIRM),
        `${method} must not be exported from the confirmation route.`,
      );
    }
  });

  void test("it verifies a token_hash or exchanges a code, and nothing else", () => {
    assert.match(CONFIRM, /verifyOtp\(\{/);
    assert.match(CONFIRM, /exchangeCodeForSession\(code\)/);

    assert.ok(
      !/setSession\(|admin|service_role/i.test(CONFIRM),
      "CRITICAL: a session must come from verification, never be constructed here.",
    );
  });

  void test("the OTP type is restricted to an allowlist", () => {
    assert.match(CONFIRM, /ALLOWED_TYPES = new Set\(\[/);
    assert.match(CONFIRM, /isAllowedType\(type\)/);
  });

  void test("an unverified request never provisions and never lands on the dashboard", () => {
    const body = CONFIRM.slice(CONFIRM.indexOf("let verified = false"));

    const guardAt = body.indexOf("if (!verified)");
    const provisionAt = body.indexOf("ensurePersonalAccount(");

    assert.ok(guardAt > 0, "The verification guard is missing.");
    assert.ok(
      guardAt < provisionAt,
      "CRITICAL: provisioning must come after the verification check.",
    );

    assert.match(
      body.slice(guardAt, provisionAt),
      /DESTINATION\.invalid/,
      "An unverified request must be redirected away.",
    );
  });

  void test("provisioning goes through the single authority, with no identity passed", () => {
    assert.match(
      CONFIRM,
      /ensurePersonalAccount\(\s*supabase as unknown as PersonalAccountClient,?\s*\)/,
    );

    assert.ok(
      !/\.rpc\(/.test(CONFIRM),
      "The route must not call the RPC directly; the helper is the only caller.",
    );
  });

  void test("a failed provisioning signs the session out locally and never reaches the dashboard", () => {
    const failure = CONFIRM.slice(
      CONFIRM.indexOf("if (!account.ok)"),
      CONFIRM.indexOf("return redirect(request, DESTINATION.confirmed)"),
    );

    assert.match(failure, /signOut\(\{\s*scope:\s*"local"/);
    assert.match(failure, /DESTINATION\.forbidden/);
    assert.match(failure, /DESTINATION\.setupFailed/);
    assert.ok(
      !/DESTINATION\.confirmed/.test(failure),
      "CRITICAL: a failed provisioning must not land on the dashboard.",
    );
  });

  void test("it writes no table itself", () => {
    for (const table of [
      "organizations",
      "organization_members",
      "workspaces",
      "audit_logs",
      "profiles",
    ]) {
      assert.ok(
        !new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]`).test(CONFIRM),
        `The confirmation route must not write ${table}.`,
      );
    }
  });

  void test("redirect destinations are relative, so no parameter can retarget them", () => {
    const destinations = CONFIRM.slice(
      CONFIRM.indexOf("const DESTINATION"),
      CONFIRM.indexOf("function redirect"),
    );

    assert.ok(
      !/https?:\/\//.test(destinations),
      "CRITICAL: an absolute redirect target invites an open redirect.",
    );

    assert.match(
      CONFIRM,
      /new URL\(path, request\.nextUrl\.origin\)/,
      "Redirects must resolve against this request's own origin.",
    );

    /*
     * Pin the CONSTRUCTION, not one spelling of the read. A mutation that
     * redirected to `params.get("redirect_to")` passed an earlier version
     * of this guard, because it only looked for `searchParams.get`. There
     * is exactly one redirect in this route and it resolves a relative
     * path against this request's own origin; anything else fails here.
     */
    const redirects = CONFIRM.match(/NextResponse\.redirect\(/g) ?? [];

    assert.equal(
      redirects.length,
      1,
      "CRITICAL: every redirect must go through the single helper that resolves against this origin.",
    );

    assert.match(
      CONFIRM,
      /NextResponse\.redirect\(new URL\(path, request\.nextUrl\.origin\)/,
      "The only redirect must be built from a relative path and this request's origin.",
    );

    assert.ok(
      !/\b(params|searchParams)\.get\(\s*["'`](redirect|redirect_to|next|return|returnTo|url|continue)["'`]/.test(
        CONFIRM,
      ),
      "CRITICAL: a caller-supplied redirect target is an open redirect.",
    );
  });

  void test("neither the token nor the code is logged", () => {
    const logs = CONFIRM.match(/console\.(error|warn|log)\([\s\S]*?\);/g) ?? [];

    for (const call of logs) {
      /*
       * The message TEXT may say "code exchange failed"; what matters is
       * whether the VALUE is passed. String literals are removed first so
       * the guard reads the arguments, not the prose.
       */
      const args = call
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``");

      assert.ok(
        !/\b(tokenHash|token_hash|code)\b/.test(args),
        `A log line carries the confirmation secret: ${call.slice(0, 80)}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                         F. THE PUBLIC ROUTE DECISION                       */
/* -------------------------------------------------------------------------- */

void describe("F. confirmation is public, deliberately", () => {
  void test("it is on the middleware allowlist with a reason", () => {
    const list = MIDDLEWARE.slice(
      MIDDLEWARE.indexOf("const PUBLIC_API_ROUTES"),
      MIDDLEWARE.indexOf("PUBLIC_STATUS_GET_ROUTES"),
    );

    assert.match(list, /"\/api\/auth\/confirm"/);
    assert.match(list, /Batch 2-D2/);
  });

  void test("the allowlist grew by exactly this one route", () => {
    const list = MIDDLEWARE.slice(
      MIDDLEWARE.indexOf("const PUBLIC_API_ROUTES"),
      MIDDLEWARE.indexOf("PUBLIC_STATUS_GET_ROUTES"),
    );

    const routes = (list.match(/"\/api\/[a-z/-]+"/g) ?? []).sort();

    assert.deepEqual(routes, [
      '"/api/auth/confirm"',
      '"/api/auth/login"',
      '"/api/auth/logout"',
      '"/api/auth/register"',
      '"/api/auth/reset-password"',
      '"/api/billing/webhook"',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*                      G. THE REGISTRATION PAGE AGREES                       */
/* -------------------------------------------------------------------------- */

void describe("G. the page tells the truth about what happened", () => {
  void test("it no longer navigates to the dashboard after registering", () => {
    assert.ok(
      !/router\.push\(\s*["'`]\/dashboard/.test(REGISTER_PAGE),
      "There is no session after registration, so the dashboard cannot load.",
    );
  });

  void test("the success state asks the user to check their email", () => {
    assert.match(REGISTER_PAGE, /Check your email/i);
  });
});

/* -------------------------------------------------------------------------- */
/*                    H. BATCH 2-D1 CONTRACTS STAY INTACT                     */
/* -------------------------------------------------------------------------- */

void describe("H. B2-D1 is unchanged by this batch", () => {
  const LOGIN = stripComments(read("app", "api", "auth", "login", "route.ts"));
  const PROVISION = stripComments(
    read("app", "api", "account", "provision", "route.ts"),
  );
  const HELPER = stripComments(read("lib", "tenancy", "personalAccount.ts"));

  void test("login still provisions and still fails closed", () => {
    assert.match(LOGIN, /ensurePersonalAccount\(/);
    assert.match(LOGIN, /signOut\(\{\s*scope:\s*"local"/);
    assert.match(LOGIN, /403/);
    assert.match(LOGIN, /503/);
  });

  void test("the provision endpoint is unchanged in shape", () => {
    assert.match(PROVISION, /export const POST = withAuth\(/);
    assert.match(PROVISION, /ensurePersonalAccount\(/);
  });

  void test("the helper is still the only caller of the RPC", () => {
    assert.match(HELPER, /\.rpc\("provision_personal_account"\)/);

    const callers = (
      [
        ["login", LOGIN],
        ["provision", PROVISION],
        ["confirm", CONFIRM],
        ["register", REGISTER],
      ] as const
    ).filter(([, code]) =>
      /\.rpc\(\s*["'`]provision_personal_account/.test(code),
    );

    assert.deepEqual(
      callers.map(([name]) => name),
      [],
      "Only lib/tenancy/personalAccount may call the RPC.",
    );
  });

  void test("no route passes an identity to the helper", () => {
    for (const [name, code] of [
      ["login", LOGIN],
      ["provision", PROVISION],
      ["confirm", CONFIRM],
    ] as const) {
      const calls = code.match(/ensurePersonalAccount\([\s\S]*?\)/g) ?? [];

      for (const call of calls) {
        assert.ok(
          !/userId|user_id|session\.userId|email/.test(call),
          `${name} passes an identity to the provisioning helper: ${call}`,
        );
      }
    }
  });
});
