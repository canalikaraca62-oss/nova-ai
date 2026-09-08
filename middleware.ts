/**
 * SYRAVEN — Edge middleware
 *
 * SECURITY BOUNDARY (defense in depth).
 *
 * Two responsibilities:
 *
 *   1. Refresh the Supabase auth session cookie so server components and
 *      route handlers observe a current session.
 *
 *   2. Fail closed for API routes. Any route under /api that is not on the
 *      explicit public allowlist requires a credential. Route handlers still
 *      perform their own verification via `withAuth` — this layer exists so
 *      that a newly added route is protected by default rather than exposed
 *      by omission, which is how ARCHITECTURE_AUDIT.md 8.1 and 8.2 arose.
 *
 * IMPORTANT:
 * Middleware only checks that a credential is *present*. It never decides
 * identity. Verification is always performed server-side by
 * `lib/auth/session.ts`.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* -------------------------------------------------------------------------- */
/*                              PUBLIC API ROUTES                             */
/* -------------------------------------------------------------------------- */

/**
 * API routes that must remain reachable without a session.
 *
 * Keep this list minimal and justify each entry.
 */
const PUBLIC_API_ROUTES: readonly string[] = [
  /* Account creation — the caller has no session yet by definition. */
  "/api/auth/register",

  /*
   * Sign in — likewise, the caller has no session; obtaining one is the
   * entire purpose of the request. Credentials are verified by Supabase
   * GoTrue inside the route, so "public" here means "no session
   * required", not "unauthenticated access to data".
   */
  "/api/auth/login",

  /*
   * Sign out — must work even when the session is ALREADY invalid,
   * which is exactly when a user needs their cookies cleared. Behind
   * the gate it would answer 401 and leave the stale session in
   * place. The route grants nothing: it can only remove credentials
   * the caller already presented.
   */
  "/api/auth/logout",

  /*
   * Password recovery — a user who cannot sign in has no session, so
   * requiring one would make recovery unreachable. The route issues no
   * session and replies identically for every address (see its
   * non-enumeration note).
   */
  "/api/auth/reset-password",

  /*
   * Stripe webhook — authenticated by request signature, not by a user
   * session. See app/api/billing/webhook/route.ts.
   */
  "/api/billing/webhook",
];

/**
 * API routes whose GET is a public service-status probe exposing no user
 * data. Only GET is public; other methods still require a credential.
 */
const PUBLIC_STATUS_GET_ROUTES: readonly string[] = [
  "/api/chat",
  "/api/canvas",
  "/api/action",
  "/api/voice/speak",
  "/api/files/analyze",
];

function isPublicApiRoute(
  pathname: string,
  method: string,
): boolean {
  if (
    PUBLIC_API_ROUTES.some(
      (route) =>
        pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return true;
  }

  if (
    method === "GET" &&
    PUBLIC_STATUS_GET_ROUTES.includes(pathname)
  ) {
    return true;
  }

  /* Preflight carries no credentials by design. */
  return method === "OPTIONS";
}

/* -------------------------------------------------------------------------- */
/*                             CREDENTIAL PRESENCE                            */
/* -------------------------------------------------------------------------- */

/**
 * Reports whether the request carries something that could be a credential.
 *
 * This is intentionally shallow: it prevents wholly anonymous traffic from
 * reaching handlers, while real verification happens in the handler.
 */
function hasCredential(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization");

  if (
    typeof authorization === "string" &&
    /^Bearer\s+\S/i.test(authorization.trim())
  ) {
    return true;
  }

  /*
   * Supabase stores its session in cookies prefixed `sb-`, chunked as
   * `sb-<ref>-auth-token[.<n>]`.
   */
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("auth-token") &&
        cookie.value.length > 0,
    );
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "private, no-store",
        "WWW-Authenticate": "Bearer",
        Vary: "Authorization, Cookie",
      },
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                                 MIDDLEWARE                                 */
/* -------------------------------------------------------------------------- */

export async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api/");

  if (
    isApiRoute &&
    !isPublicApiRoute(pathname, request.method) &&
    !hasCredential(request)
  ) {
    return unauthorized();
  }

  /*
   * Session refresh.
   *
   * Reading the user causes @supabase/ssr to rotate an expiring token and
   * queue the updated cookies onto the response.
   */
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }

            response = NextResponse.next({
              request,
            });

            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    await supabase.auth.getUser();
  } catch {
    /*
     * A refresh failure must not break the request: handlers perform their
     * own verification and will reject an invalid session.
     */
  }

  return response;
}

/* -------------------------------------------------------------------------- */
/*                                  MATCHER                                   */
/* -------------------------------------------------------------------------- */

export const config = {
  matcher: [
    /*
     * Run on everything except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
