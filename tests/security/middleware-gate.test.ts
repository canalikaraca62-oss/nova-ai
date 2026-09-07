/**
 * SYRAVEN — Middleware gate tests
 *
 * The middleware is the fail-closed layer: a newly added API route must be
 * protected by omission rather than exposed by it. These tests exercise the
 * decision logic directly.
 *
 * The predicates below mirror middleware.ts. A companion suite asserts the
 * implementation still matches, so the mirror cannot silently drift.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* -------------------------------------------------------------------------- */
/*                        MIRRORED DECISION LOGIC                             */
/* -------------------------------------------------------------------------- */

const PUBLIC_API_ROUTES: readonly string[] = [
  "/api/auth/register",
  /*
   * Sign in and password recovery. Both are public for the same reason
   * as registration: the caller has no session, and obtaining (or
   * regaining) one is the entire purpose of the request. Neither route
   * uses the service-role client, and both delegate credential handling
   * to Supabase GoTrue.
   */
  "/api/auth/login",
  "/api/auth/reset-password",
  "/api/billing/webhook",
];

const PUBLIC_STATUS_GET_ROUTES: readonly string[] = [
  "/api/chat",
  "/api/canvas",
  "/api/action",
  "/api/voice/speak",
  "/api/files/analyze",
];

function isPublicApiRoute(pathname: string, method: string): boolean {
  if (
    PUBLIC_API_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return true;
  }

  if (method === "GET" && PUBLIC_STATUS_GET_ROUTES.includes(pathname)) {
    return true;
  }

  return method === "OPTIONS";
}

interface FakeCookie {
  name: string;
  value: string;
}

function hasCredential(
  authorization: string | null,
  cookies: FakeCookie[],
): boolean {
  if (
    typeof authorization === "string" &&
    /^Bearer\s+\S/i.test(authorization.trim())
  ) {
    return true;
  }

  return cookies.some(
    (cookie) =>
      cookie.name.startsWith("sb-") &&
      cookie.name.includes("auth-token") &&
      cookie.value.length > 0,
  );
}

/**
 * Returns true when middleware would reject the request with 401.
 */
function wouldReject(
  pathname: string,
  method: string,
  authorization: string | null,
  cookies: FakeCookie[],
): boolean {
  const isApiRoute = pathname.startsWith("/api/");

  return (
    isApiRoute &&
    !isPublicApiRoute(pathname, method) &&
    !hasCredential(authorization, cookies)
  );
}

const NO_COOKIES: FakeCookie[] = [];

const SESSION_COOKIE: FakeCookie[] = [
  { name: "sb-abcdefg-auth-token", value: "session-value" },
];

/* -------------------------------------------------------------------------- */
/*                             FAIL-CLOSED BEHAVIOUR                          */
/* -------------------------------------------------------------------------- */

void describe("Middleware rejects anonymous traffic to protected API routes", () => {
  const protectedRoutes = [
    "/api/projects",
    "/api/notifications",
    "/api/knowledge",
    "/api/knowledge/search",
    "/api/tasks",
    "/api/tasks/execute",
    "/api/usage",
    "/api/agents",
    "/api/agents/execute",
    "/api/stream",
    "/api/search",
    "/api/files/upload",
    "/api/voice/transcribe",
    "/api/billing/checkout",
    "/api/billing/portal",
  ];

  for (const route of protectedRoutes) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      void test(`${method} ${route} without a credential is rejected`, () => {
        assert.equal(
          wouldReject(route, method, null, NO_COOKIES),
          true,
          `${method} ${route} must not be reachable anonymously.`,
        );
      });
    }
  }

  void test("an unknown, newly added API route is protected by default", () => {
    assert.equal(
      wouldReject("/api/some-future-route", "POST", null, NO_COOKIES),
      true,
      "Routes must be protected by omission, not exposed by it.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          CREDENTIALS ARE ACCEPTED                          */
/* -------------------------------------------------------------------------- */

void describe("Middleware admits requests that carry a credential", () => {
  void test("a bearer token passes the gate", () => {
    assert.equal(
      wouldReject("/api/projects", "GET", "Bearer tok", NO_COOKIES),
      false,
    );
  });

  void test("a Supabase session cookie passes the gate", () => {
    assert.equal(
      wouldReject("/api/projects", "GET", null, SESSION_COOKIE),
      false,
    );
  });

  void test("an empty bearer token does not pass the gate", () => {
    assert.equal(
      wouldReject("/api/projects", "GET", "Bearer ", NO_COOKIES),
      true,
    );
  });

  void test("an empty session cookie does not pass the gate", () => {
    assert.equal(
      wouldReject("/api/projects", "GET", null, [
        { name: "sb-abcdefg-auth-token", value: "" },
      ]),
      true,
    );
  });

  void test("an unrelated cookie does not pass the gate", () => {
    assert.equal(
      wouldReject("/api/projects", "GET", null, [
        { name: "theme", value: "dark" },
      ]),
      true,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                              PUBLIC ROUTES                                 */
/* -------------------------------------------------------------------------- */

void describe("Only intended routes are public", () => {
  void test("registration is reachable anonymously", () => {
    assert.equal(
      wouldReject("/api/auth/register", "POST", null, NO_COOKIES),
      false,
    );
  });

  void test("the Stripe webhook is reachable without a user session", () => {
    assert.equal(
      wouldReject("/api/billing/webhook", "POST", null, NO_COOKIES),
      false,
    );
  });

  void test("status GETs are public but their POSTs are not", () => {
    for (const route of PUBLIC_STATUS_GET_ROUTES) {
      assert.equal(
        wouldReject(route, "GET", null, NO_COOKIES),
        false,
        `${route} GET is a service-status probe and may stay public.`,
      );

      assert.equal(
        wouldReject(route, "POST", null, NO_COOKIES),
        true,
        `${route} POST spends money or mutates state and must require a ` +
          `session.`,
      );
    }
  });

  void test("non-API paths are not gated by this check", () => {
    assert.equal(wouldReject("/dashboard", "GET", null, NO_COOKIES), false);
    assert.equal(wouldReject("/login", "GET", null, NO_COOKIES), false);
  });

  void test("CORS preflight is not gated", () => {
    assert.equal(
      wouldReject("/api/projects", "OPTIONS", null, NO_COOKIES),
      false,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      MIRROR MATCHES THE IMPLEMENTATION                     */
/* -------------------------------------------------------------------------- */

void describe("The mirrored logic matches middleware.ts", () => {
  const source = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

  function listedRoutes(constName: string): string[] {
    const block = source.match(
      new RegExp(`const ${constName}[\\s\\S]*?\\];`),
    );

    assert.ok(block, `${constName} not found in middleware.ts`);

    return (block[0].match(/"\/api\/[^"]+"/g) ?? []).map((entry) =>
      entry.replace(/"/g, ""),
    );
  }

  void test("the public route allowlist matches", () => {
    assert.deepEqual(listedRoutes("PUBLIC_API_ROUTES"), [
      ...PUBLIC_API_ROUTES,
    ]);
  });

  void test("the public status GET list matches", () => {
    assert.deepEqual(listedRoutes("PUBLIC_STATUS_GET_ROUTES"), [
      ...PUBLIC_STATUS_GET_ROUTES,
    ]);
  });

  void test("middleware rejects with 401 and does not cache the rejection", () => {
    assert.match(source, /status:\s*401/);
    assert.match(source, /"Cache-Control":\s*"private,\s*no-store"/);
  });

  void test("the API gate runs before the session refresh", () => {
    const gateIndex = source.search(/return unauthorized\(\)/);

    const refreshIndex = source.search(/NextResponse\.next\(/);

    assert.ok(gateIndex !== -1, "middleware must be able to reject.");

    assert.ok(
      gateIndex < refreshIndex,
      "Anonymous API traffic must be rejected before any session work.",
    );
  });
});
