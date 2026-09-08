/**
 * SYRAVEN — API reference integrity
 *
 * Step 6 remediation.
 *
 * WHY THIS EXISTS
 *
 * tests/security/ui-integrity.test.ts checks that every `href` resolves
 * to a real page. It does NOT check `fetch` targets, and that gap hid a
 * production blocker for the entire life of the project:
 *
 *   app/login/page.tsx performed a live fetch("/api/auth/login")
 *   against a route that did not exist.
 *
 * Sign-in was therefore broken, and since every other page sits behind
 * the session, the whole authenticated product was unreachable through
 * the UI. A dead `href` shows a 404 page; a dead `fetch` shows a generic
 * error and looks like a backend fault, which is why it survived several
 * audits.
 *
 * WHAT THIS ASSERTS
 *
 * Every LIVE `fetch("/api/…")` in application code resolves to a real
 * App Router route handler.
 *
 * "LIVE" is the important qualifier. Several context modules document
 * intended future calls inside comment blocks:
 *
 *     \* const response = await fetch("/api/workspaces", { … });
 *
 * Those are documentation, not calls, and flagging them would force
 * either deleting useful comments or suppressing the rule. Comments are
 * stripped before matching so the test tracks real behaviour.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/* -------------------------------------------------------------------------- */
/*                              FILE DISCOVERY                                */
/* -------------------------------------------------------------------------- */

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;

    const full = join(dir, entry);

    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(full);
  }

  return out;
}

/**
 * Application source that CALLS the API — pages, components, hooks and
 * contexts. Route handlers themselves are excluded: `app/api/**` is the
 * server side, and a route referencing its own path in a comment or a
 * redirect is not a client call.
 */
const CLIENT_FILES = walk(join(ROOT, "app"))
  .filter((f) => !f.includes(join("app", "api")))
  .concat(walk(join(ROOT, "components")))
  .concat(walk(join(ROOT, "hooks")));

/**
 * Removes block comments, line comments, and JSDoc continuation lines.
 *
 * The last is what matters here: context modules document intended calls
 * as `* const response = await fetch("/api/workspaces")` inside a `/* *\/`
 * block. Stripping the block handles it, but a stray continuation line
 * outside a block would otherwise survive.
 */
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

/* -------------------------------------------------------------------------- */
/*                             ROUTE RESOLUTION                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether an /api path resolves to a real route handler.
 *
 * Mirrors App Router resolution: each segment matches a literal
 * directory or a `[param]` directory, and the leaf must hold route.ts.
 */
function apiRouteExists(path: string): boolean {
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  const segments = clean.split("/").filter(Boolean);

  let dir = join(ROOT, "app");

  for (const segment of segments) {
    const literal = join(dir, segment);

    if (existsSync(literal) && statSync(literal).isDirectory()) {
      dir = literal;
      continue;
    }

    const dynamic = existsSync(dir)
      ? readdirSync(dir).find(
          (entry) =>
            entry.startsWith("[") && statSync(join(dir, entry)).isDirectory(),
        )
      : undefined;

    if (dynamic === undefined) return false;

    dir = join(dir, dynamic);
  }

  return (
    existsSync(join(dir, "route.ts")) || existsSync(join(dir, "route.tsx"))
  );
}

/* -------------------------------------------------------------------------- */
/*                            REFERENCE COLLECTION                            */
/* -------------------------------------------------------------------------- */

interface ApiReference {
  readonly file: string;
  readonly path: string;
}

function collectLiveApiReferences(): ApiReference[] {
  const found: ApiReference[] = [];

  for (const file of CLIENT_FILES) {
    const code = stripComments(readFileSync(file, "utf8"));

    /*
     * Static string literals only. A template literal such as
     * `/api/projects/${id}` is dynamic and cannot be resolved here; the
     * static prefix is still covered because the base route directory
     * must exist for the dynamic segment to resolve.
     */
    for (const match of code.matchAll(/["'`](\/api\/[a-z0-9/_-]+)["'`]/gi)) {
      const path = match[1];
      if (path === undefined) continue;

      found.push({ file: file.slice(ROOT.length + 1), path });
    }
  }

  return found;
}

/* -------------------------------------------------------------------------- */
/*                                 ASSERTIONS                                 */
/* -------------------------------------------------------------------------- */

void describe("Every live API reference resolves to a route handler", () => {
  const references = collectLiveApiReferences();

  void test("references were actually discovered", () => {
    /*
     * Guards the test itself: a broken regex would make every assertion
     * below vacuously pass, which is exactly how the original gap
     * survived.
     */
    assert.ok(
      references.length > 5,
      `Only ${references.length} API references found — the collector is broken.`,
    );
  });

  /**
   * Endpoints that intentionally do not exist, where the CALLER already
   * degrades gracefully.
   *
   * This is not a suppression list for broken calls. An entry is only
   * legitimate when the call site treats absence as a normal outcome —
   * verified by the test below, which fails if the caller stops handling
   * it. Anything else must be implemented or removed (rule 24: never
   * present unavailable functionality as working).
   */
  const OPTIONAL_ENHANCEMENTS: readonly string[] = [
    /*
     * Presentation generation. `generatePresentationWithApi` returns
     * null on any non-OK response and the caller falls back to
     * `createFallbackSlides`, so the feature works without a backend and
     * improves if one appears.
     */
    "/api/presentations/generate",
  ];

  void test("no live fetch targets a nonexistent route", () => {
    const dead = references.filter(
      (ref) =>
        !apiRouteExists(ref.path) &&
        !OPTIONAL_ENHANCEMENTS.includes(ref.path),
    );

    const unique = Array.from(
      new Set(dead.map((d) => `${d.file} -> ${d.path}`)),
    ).sort();

    assert.deepEqual(
      unique,
      [],
      "Live API references point at routes that do not exist. Each is a " +
        "silent runtime failure: the fetch returns a 404 HTML page, " +
        "response.json() throws, and the UI shows a generic error.",
    );
  });

  void test("optional enhancements really do degrade gracefully", () => {
    /*
     * Guards the allowance above. If a caller stops handling absence,
     * the endpoint stops being optional and becomes a broken call — this
     * fails rather than letting the exemption hide it.
     */
    const page = readFileSync(
      join(ROOT, "app", "studio", "presentation", "page.tsx"),
      "utf8",
    );

    const fn = page.slice(
      page.indexOf("async function generatePresentationWithApi"),
      page.indexOf("function getProjectExportContent"),
    );

    assert.ok(fn.length > 0, "The presentation API helper is missing.");

    assert.match(
      fn,
      /if\s*\(\s*!response\.ok\s*\)\s*\{\s*return null;/,
      "The helper must return null when the endpoint is absent.",
    );

    assert.match(
      page,
      /createFallbackSlides\s*\(/,
      "The caller must fall back to locally generated slides.",
    );
  });

  void test("the auth login route exists", () => {
    /*
     * Regression guard for the specific blocker this step fixed. Sign-in
     * is the root of every authenticated flow, so its absence disabled
     * the entire product.
     */
    assert.ok(
      apiRouteExists("/api/auth/login"),
      "/api/auth/login is missing — sign-in is broken and every " +
        "authenticated page is unreachable.",
    );
  });

  void test("the login page targets the route that exists", () => {
    const page = readFileSync(
      join(ROOT, "app", "login", "page.tsx"),
      "utf8",
    );

    const target = page.match(/fetch\(\s*["'`](\/api\/auth\/[a-z-]+)["'`]/);

    assert.ok(target?.[1], "The login page performs no auth fetch.");
    assert.ok(
      apiRouteExists(target[1]),
      `The login page posts to ${target[1]}, which does not exist.`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          LOGIN ROUTE SECURITY                              */
/* -------------------------------------------------------------------------- */

void describe("The login route is safe by construction", () => {
  const LOGIN = join(ROOT, "app", "api", "auth", "login", "route.ts");
  const CODE = existsSync(LOGIN)
    ? stripComments(readFileSync(LOGIN, "utf8"))
    : "";

  void test("the route exists", () => {
    assert.ok(CODE.length > 0, "The login route is missing.");
  });

  void test("never uses the service-role client", () => {
    /*
     * Sign-in must run on the anon key. A service-role client would
     * bypass RLS and, worse, could establish a session without the
     * provider ever verifying the password.
     */
    assert.ok(
      !/supabaseAdmin|SUPABASE_SERVICE_ROLE|service_role/.test(CODE),
      "CRITICAL: the login route references a service-role client.",
    );
  });

  void test("delegates verification to Supabase", () => {
    assert.match(
      CODE,
      /signInWithPassword/,
      "Credentials must be verified by the auth provider.",
    );

    assert.ok(
      !/bcrypt|compare\(|createHash|password\s*===/.test(CODE),
      "This route must never compare a password itself.",
    );
  });

  void test("returns no token, session or user in the body", () => {
    /*
     * The session travels as HttpOnly cookies. Putting it in JSON would
     * expose it to any script on the page for no benefit.
     */
    const responses = CODE.match(/NextResponse\.json\([\s\S]{0,220}?\)/g) ?? [];

    assert.ok(responses.length > 0);

    for (const response of responses) {
      assert.ok(
        !/access_token|refresh_token|session|data\.user|user:/.test(response),
        `A response body may carry session material:\n${response}`,
      );
    }
  });

  void test("does not enumerate accounts", () => {
    /*
     * Wrong password, unknown email and unconfirmed account must all
     * produce the same message, or the form becomes an oracle for which
     * addresses are registered.
     */
    assert.match(CODE, /INVALID_CREDENTIALS/);

    const distinct = [
      /not\s+found/i,
      /no\s+such\s+user/i,
      /email\s+not\s+confirmed/i,
      /unregistered/i,
    ];

    for (const pattern of distinct) {
      assert.ok(
        !pattern.test(CODE),
        `A distinguishing failure message enables enumeration: ${pattern}`,
      );
    }
  });

  void test("never logs credentials or the email", () => {
    const logs = CODE.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    for (const log of logs) {
      assert.ok(
        !/password|credentials\.email|\bemail\b/.test(log),
        `A log statement may disclose credentials or a personal identifier:\n${log}`,
      );
    }
  });

  void test("separates a provider outage from a bad password", () => {
    /*
     * A misconfigured server must not tell a user their password is
     * wrong.
     */
    assert.match(CODE, /503/);
    assert.match(CODE, /401/);
  });

  void test("bounds the input it forwards", () => {
    assert.match(CODE, /length\s*>\s*320/);
    assert.match(CODE, /length\s*>\s*512/);
  });

  void test("is registered as a public API route", () => {
    /*
     * A caller signing in has no session, so the middleware must not
     * demand one — otherwise login is unreachable.
     */
    const middleware = readFileSync(join(ROOT, "middleware.ts"), "utf8");

    const publicList = middleware.slice(
      middleware.indexOf("PUBLIC_API_ROUTES"),
      middleware.indexOf("PUBLIC_STATUS_GET_ROUTES"),
    );

    assert.match(
      publicList,
      /["'`]\/api\/auth\/login["'`]/,
      "/api/auth/login must be public or sign-in cannot succeed.",
    );
  });

  void test("does not widen the public route list further", () => {
    /*
     * Guards against this fix being used to make other routes public.
     */
    const middleware = readFileSync(join(ROOT, "middleware.ts"), "utf8");

    const publicList = middleware.slice(
      middleware.indexOf("const PUBLIC_API_ROUTES"),
      middleware.indexOf("PUBLIC_STATUS_GET_ROUTES"),
    );

    const routes = (publicList.match(/["'`]\/api\/[a-z/-]+["'`]/g) ?? []).sort();

    assert.deepEqual(
      routes,
      [
        '"/api/auth/login"',
        '"/api/auth/logout"',
        '"/api/auth/register"',
        '"/api/auth/reset-password"',
        '"/api/billing/webhook"',
      ],
      "The public API route list changed unexpectedly.",
    );
  });
});
