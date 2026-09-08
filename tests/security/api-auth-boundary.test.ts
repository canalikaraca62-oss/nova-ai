/**
 * SYRAVEN — API authentication boundary tests
 *
 * These are enforcement tests, not documentation. They read the actual route
 * sources and fail if a route regresses to an unauthenticated or
 * client-trusting state.
 *
 * They exist because ARCHITECTURE_AUDIT.md 8.1 and 8.2 both reached `main`
 * unnoticed in a repository with no tests.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "app", "api");

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function findRouteFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts") {
      found.push(full);
    }
  }

  return found;
}

function routeId(file: string): string {
  return file
    .replace(process.cwd(), "")
    .replace(/\\/g, "/")
    .replace(/^\//, "");
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/**
 * Strips comments so assertions test real code, not prose in a comment.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ROUTE_FILES = findRouteFiles(API_DIR);

/**
 * Routes intentionally reachable without a user session.
 *
 * Any addition here is a security decision and must carry a reason.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  "app/api/auth/register/route.ts":
    "Account creation: the caller has no session yet by definition.",
  "app/api/billing/webhook/route.ts":
    "Stripe webhook: authenticated by request signature, not a user session.",
  "app/api/auth/login/route.ts":
    "Sign in: obtaining a session is the purpose of the request, so a " +
    "session cannot be required. Credentials are verified by Supabase " +
    "GoTrue via signInWithPassword(); the route compares no password " +
    "itself and never uses the service-role client.",
  "app/api/auth/reset-password/route.ts":
    "Password recovery: a user who cannot sign in has no session. The " +
    "route issues no session, writes no credential, and replies " +
    "identically for every address so it cannot enumerate accounts.",
  "app/api/auth/logout/route.ts":
    "Sign out: must work when the session is ALREADY invalid, which " +
    "is exactly when a user needs their cookies cleared. Behind the " +
    "gate it would answer 401 and leave the stale session in place. " +
    "The route grants nothing -- it can only remove credentials the " +
    "caller already presented -- issues no session, and uses the anon " +
    "client, never service-role.",
};

/**
 * Routes that spend money against a paid AI provider. Every one of these
 * must require a verified session (ARCHITECTURE_AUDIT.md 8.2).
 */
const AI_SPENDING_ROUTES = [
  "app/api/chat/route.ts",
  "app/api/agents/execute/route.ts",
  "app/api/stream/route.ts",
  "app/api/files/analyze/route.ts",
  "app/api/voice/speak/route.ts",
  "app/api/voice/transcribe/route.ts",
  "app/api/canvas/route.ts",
];

/**
 * Routes that previously derived tenant identity from client input
 * (ARCHITECTURE_AUDIT.md 8.1).
 */
const FORMERLY_IDOR_ROUTES = [
  "app/api/projects/route.ts",
  "app/api/notifications/route.ts",
  "app/api/knowledge/route.ts",
];

const MUTATING_METHODS = ["POST", "PATCH", "PUT", "DELETE"] as const;

/* -------------------------------------------------------------------------- */
/*                       IDOR: NO CLIENT-SUPPLIED IDENTITY                    */
/* -------------------------------------------------------------------------- */

void describe("IDOR: caller identity is never taken from client input", () => {
  for (const file of ROUTE_FILES) {
    const id = routeId(file);

    void test(`${id} does not read userId from the query string`, () => {
      const code = stripComments(read(file));

      const matches = code.match(
        /searchParams\s*\.\s*get\(\s*["'`]userId["'`]\s*\)/g,
      );

      assert.equal(
        matches,
        null,
        `${id} reads "userId" from the query string. Tenant identity must ` +
          `come from the verified session (session.userId), never from ` +
          `client input — this is the IDOR in ARCHITECTURE_AUDIT.md 8.1.`,
      );
    });

    void test(`${id} does not read userId from the request body`, () => {
      const code = stripComments(read(file));

      const matches = code.match(/\bbody\s*\.\s*userId\b/g);

      assert.equal(
        matches,
        null,
        `${id} reads "userId" from the request body. Ownership must be ` +
          `assigned from the verified session.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                    EVERY MUTATING HANDLER IS AUTHENTICATED                 */
/* -------------------------------------------------------------------------- */

void describe("Every mutating route handler requires authentication", () => {
  for (const file of ROUTE_FILES) {
    const id = routeId(file);

    if (id in PUBLIC_ROUTES) continue;

    const code = stripComments(read(file));

    for (const method of MUTATING_METHODS) {
      const wrapped = new RegExp(
        `export\\s+const\\s+${method}\\s*=\\s*withAuth\\s*\\(`,
      ).test(code);

      const plain = new RegExp(
        `export\\s+(async\\s+)?function\\s+${method}\\s*\\(`,
      ).test(code);

      if (!wrapped && !plain) continue;

      void test(`${id} ${method} is authenticated`, () => {
        if (wrapped) {
          assert.ok(true);
          return;
        }

        /*
         * A handler that takes no request and only returns 405 Method Not
         * Allowed exposes no data and reaches no provider, so it needs no
         * session of its own.
         *
         * Two spellings are accepted:
         *   - the 405 literal inline in the handler body
         *   - a delegation to a local methodNotAllowed() helper, which is
         *     itself verified below to return 405
         *
         * The zero-argument signature is the load-bearing part: a handler
         * that cannot see the request cannot act on caller input.
         */
        const stubBody = new RegExp(
          `export\\s+(async\\s+)?function\\s+${method}\\s*\\(\\s*\\)` +
            `\\s*\\{([\\s\\S]{0,400}?)\\n\\}`,
        ).exec(code);

        if (stubBody) {
          const body = stubBody[2] ?? "";

          const returns405Inline = /\b405\b/.test(body);

          const delegatesToHelper =
            /\breturn\s+methodNotAllowed\s*\(\s*\)/.test(body) &&
            /function methodNotAllowed[\s\S]{0,600}?\b405\b/.test(code);

          if (returns405Inline || delegatesToHelper) {
            assert.ok(true);
            return;
          }
        }

        /*
         * A route may authenticate with its own in-file helper instead of
         * withAuth. That is acceptable so long as it genuinely verifies a
         * credential against Supabase and can reject the request.
         */
        const hasVerification =
          /auth\s*\.\s*getUser\s*\(/.test(code) ||
          /getAuthenticatedUser\s*\(/.test(code) ||
          /authenticateRequest\s*\(/.test(code);

        const canReject = /\b401\b/.test(code) || /\b405\b/.test(code);

        assert.ok(
          hasVerification && canReject,
          `${id} exports ${method} without an authentication boundary. ` +
            `Wrap it with withAuth from lib/api/withAuth.`,
        );
      });
    }
  }
});

/* -------------------------------------------------------------------------- */
/*                        AI SPEND REQUIRES A SESSION                         */
/* -------------------------------------------------------------------------- */

void describe("AI-spending endpoints require a verified session", () => {
  for (const id of AI_SPENDING_ROUTES) {
    const file = join(process.cwd(), id);

    void test(`${id} exists and wraps POST in withAuth`, () => {
      assert.ok(
        existsSync(file),
        `${id} is missing. If it was intentionally removed, update ` +
          `AI_SPENDING_ROUTES in this test.`,
      );

      const code = stripComments(read(file));

      assert.match(
        code,
        /export\s+const\s+POST\s*=\s*withAuth\s*\(/,
        `${id} must require a session before calling a paid AI provider ` +
          `(ARCHITECTURE_AUDIT.md 8.2).`,
      );
    });
  }

  void test("the unauthenticated test-openai debug endpoint is gone", () => {
    assert.equal(
      existsSync(join(API_DIR, "test-openai", "route.ts")),
      false,
      "app/api/test-openai exposed a live provider key with no auth and " +
        "must not be reintroduced.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        OWNERSHIP FILTERS ON MUTATIONS                      */
/* -------------------------------------------------------------------------- */

void describe("Formerly-IDOR routes scope every mutation to the session owner", () => {
  for (const id of FORMERLY_IDOR_ROUTES) {
    const code = stripComments(read(join(process.cwd(), id)));

    void test(`${id} scopes update/delete by user_id`, () => {
      /*
       * Each .update()/.delete() chain must carry a user_id filter bound to
       * the session. Without it, an id alone is enough to modify another
       * user's row.
       */
      const chains = code.match(
        /\.\s*(update|delete)\s*\([\s\S]{0,1200}?maybeSingle\s*\(\s*\)/g,
      );

      assert.ok(
        chains && chains.length > 0,
        `${id}: expected at least one update/delete chain to inspect.`,
      );

      for (const chain of chains) {
        assert.match(
          chain,
          /["'`]user_id["'`][\s\S]{0,80}(session\s*\.\s*userId|\buserId\b)/,
          `${id} has an update/delete not scoped to session.userId:\n${chain.slice(0, 300)}`,
        );
      }
    });

    void test(`${id} derives every userId binding from the session`, () => {
      /*
       * The ownership assertion above accepts a local `userId`. That is only
       * safe while every such local is assigned from session.userId, so it
       * is asserted separately here rather than assumed.
       */
      const assignments = code.match(/\bconst\s+userId\s*=\s*[\s\S]{0,120}?;/g);

      assert.ok(
        assignments && assignments.length > 0,
        `${id}: expected at least one userId assignment.`,
      );

      for (const assignment of assignments) {
        assert.match(
          assignment,
          /session\s*\.\s*userId/,
          `${id} assigns userId from something other than the verified ` +
            `session:\n${assignment}`,
        );
      }
    });

    void test(`${id} binds every handler to the session`, () => {
      const handlers = code.match(
        /export\s+const\s+(GET|POST|PATCH|DELETE)\s*=\s*withAuth/g,
      );

      assert.ok(
        handlers && handlers.length >= 4,
        `${id} should expose GET/POST/PATCH/DELETE via withAuth; found ` +
          `${handlers ? handlers.length : 0}.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                         MIDDLEWARE FAILS CLOSED                            */
/* -------------------------------------------------------------------------- */

void describe("Middleware fails closed for API routes", () => {
  const middlewarePath = join(process.cwd(), "middleware.ts");

  void test("middleware.ts exists", () => {
    assert.ok(
      existsSync(middlewarePath),
      "middleware.ts provides defense in depth so a newly added API route " +
        "is protected by default.",
    );
  });

  void test("its public allowlist stays minimal and intentional", () => {
    const code = read(middlewarePath);

    const block = code.match(
      /const PUBLIC_API_ROUTES[\s\S]*?\];/,
    );

    assert.ok(block, "PUBLIC_API_ROUTES allowlist not found.");

    const entries = block[0].match(/"\/api\/[^"]+"/g) ?? [];

    /*
     * Derived from PUBLIC_ROUTES rather than hard-coded.
     *
     * That map requires a written justification per route, so a new
     * public entry cannot pass this test by being added to a name list —
     * it must also be justified where the exemption is granted. Keeping
     * two literal lists in step would otherwise drift, and the weaker
     * one would silently become the real policy.
     */
    const justified = new Set(
      Object.keys(PUBLIC_ROUTES).map((file) =>
        file.replace(/^app/, "").replace(/\/route\.ts$/, ""),
      ),
    );

    for (const entry of entries) {
      const route = entry.replace(/"/g, "");

      assert.ok(
        justified.has(route),
        `Unexpected public API route ${route}. Every entry must be a ` +
          `deliberate, justified security decision, recorded with its ` +
          `reason in PUBLIC_ROUTES.`,
      );
    }

    /*
     * And the reverse: a route justified as public must actually be in
     * the middleware allowlist, or the justification is describing
     * something that is not true.
     */
    const listed = new Set(entries.map((e) => e.replace(/"/g, "")));

    for (const route of justified) {
      assert.ok(
        listed.has(route),
        `${route} is justified as public in PUBLIC_ROUTES but is not in ` +
          `the middleware allowlist.`,
      );
    }
  });
});
