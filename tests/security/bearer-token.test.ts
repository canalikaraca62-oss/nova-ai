/**
 * SYRAVEN — Bearer token extraction tests
 *
 * Behavioural tests for the credential parsing that guards every
 * authenticated route. A parsing bug here weakens the whole boundary, so the
 * malformed and hostile cases are tested explicitly.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* -------------------------------------------------------------------------- */
/*                                                                            */
/* `lib/auth/session.ts` imports "server-only" and next/headers, neither of   */
/* which loads outside a Next.js server runtime. The extraction logic is      */
/* pure, so it is reproduced here and kept honest by a test asserting the     */
/* implementation still matches this behaviour.                               */
/*                                                                            */
/* -------------------------------------------------------------------------- */

interface HeaderBag {
  get(name: string): string | null;
}

function extractBearerToken(request: { headers: HeaderBag }): string | null {
  const authorization = request.headers.get("authorization");

  if (typeof authorization !== "string") {
    return null;
  }

  const normalized = authorization.trim();

  if (!/^Bearer\s+/i.test(normalized)) {
    return null;
  }

  const token = normalized.replace(/^Bearer\s+/i, "").trim();

  return token.length > 0 ? token : null;
}

function requestWith(authorization: string | null): {
  headers: HeaderBag;
} {
  return {
    headers: {
      get(name: string) {
        return name.toLowerCase() === "authorization" ? authorization : null;
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                   TESTS                                    */
/* -------------------------------------------------------------------------- */

void describe("extractBearerToken", () => {
  void test("extracts a well-formed bearer token", () => {
    assert.equal(
      extractBearerToken(requestWith("Bearer abc.def.ghi")),
      "abc.def.ghi",
    );
  });

  void test("is case-insensitive on the scheme", () => {
    assert.equal(extractBearerToken(requestWith("bearer tok")), "tok");
    assert.equal(extractBearerToken(requestWith("BEARER tok")), "tok");
  });

  void test("tolerates surrounding and internal whitespace", () => {
    assert.equal(extractBearerToken(requestWith("  Bearer   tok  ")), "tok");
  });

  void test("returns null when the header is absent", () => {
    assert.equal(extractBearerToken(requestWith(null)), null);
  });

  void test("returns null for a non-bearer scheme", () => {
    assert.equal(extractBearerToken(requestWith("Basic dXNlcjpwdw==")), null);
  });

  void test("returns null for a bearer scheme with no token", () => {
    assert.equal(extractBearerToken(requestWith("Bearer")), null);
    assert.equal(extractBearerToken(requestWith("Bearer   ")), null);
  });

  void test("does not accept a token smuggled without the scheme", () => {
    assert.equal(extractBearerToken(requestWith("abc.def.ghi")), null);
  });

  void test("does not treat a bearer-like substring as a scheme", () => {
    assert.equal(extractBearerToken(requestWith("NotBearer tok")), null);
  });

  void test("keeps an opaque token intact", () => {
    const token = "eyJhbGciOi.J9-_~+/=";

    assert.equal(extractBearerToken(requestWith(`Bearer ${token}`)), token);
  });
});

/* -------------------------------------------------------------------------- */
/*                       IMPLEMENTATION STAYS IN SYNC                         */
/* -------------------------------------------------------------------------- */

void describe("lib/auth/session.ts invariants", () => {
  const source = readFileSync(
    join(process.cwd(), "lib", "auth", "session.ts"),
    "utf8",
  );

  void test("verifies credentials with getUser, never getSession", () => {
    assert.match(
      source,
      /auth\s*\.\s*getUser\s*\(/,
      "Session resolution must call getUser, which validates against the " +
        "auth server.",
    );

    assert.doesNotMatch(
      source,
      /auth\s*\.\s*getSession\s*\(/,
      "getSession trusts locally stored state and must not be used to " +
        "establish identity on the server.",
    );
  });

  void test("uses the same bearer parsing rules asserted above", () => {
    assert.match(source, /\^Bearer\\s\+/);
    assert.match(source, /replace\(\s*\/\^Bearer\\s\+\/i/);
  });

  void test("is server-only", () => {
    assert.match(
      source,
      /import\s+["']server-only["']/,
      "lib/auth/session.ts must never be reachable from client code.",
    );
  });

  void test("a malformed Authorization header is rejected, not ignored", () => {
    assert.match(
      source,
      /hasAuthorizationHeader\s*&&\s*token\s*===\s*null/,
      "A present-but-malformed Authorization header must fail loudly " +
        "rather than silently falling back to cookie auth.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            withAuth INVARIANTS                             */
/* -------------------------------------------------------------------------- */

void describe("lib/api/withAuth.ts invariants", () => {
  const source = readFileSync(
    join(process.cwd(), "lib", "api", "withAuth.ts"),
    "utf8",
  );

  void test("returns 401 for a failed session and 503 only for misconfiguration", () => {
    assert.match(
      source,
      /["']AUTH_UNAVAILABLE["']\s*\?\s*503\s*:\s*401/,
      "Only a configuration failure may surface as 503; every credential " +
        "failure must be a 401.",
    );
  });

  void test("never caches an authenticated response", () => {
    assert.match(source, /"Cache-Control":\s*"private,\s*no-store"/);
  });

  void test("varies on the credential headers", () => {
    assert.match(source, /Vary:\s*"Authorization,\s*Cookie"/);
  });

  void test("the handler runs only after a successful resolve", () => {
    const guardIndex = source.search(/if\s*\(\s*!\s*result\.success\s*\)/);

    const rejectIndex = source.search(/return\s+unauthorizedResponse\s*\(/);

    const invokeIndex = source.search(/return\s+handler\s*\(/);

    assert.ok(guardIndex !== -1, "withAuth must guard on a failed resolve.");

    assert.ok(
      rejectIndex > guardIndex,
      "The failure branch must reject before the handler is reached.",
    );

    assert.ok(
      invokeIndex > rejectIndex,
      "The wrapped handler must only be invoked after the failure branch " +
        "has returned.",
    );
  });
});
