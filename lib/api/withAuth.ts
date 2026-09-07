/**
 * SYRAVEN — Authenticated route boundary
 * lib/api/withAuth.ts
 *
 * SECURITY BOUNDARY.
 *
 * Wraps a route handler so that it only ever runs for a verified caller.
 * The handler receives an `AuthenticatedSession` whose `userId` is derived
 * from a verified Supabase session.
 *
 * Usage:
 *
 *   export const GET = withAuth(async (request, session) => {
 *     // session.userId is trustworthy
 *   });
 *
 * Rules for handlers using this wrapper:
 *
 *   - Never read caller identity from query parameters or the request body.
 *     Use `session.userId`.
 *   - Prefer `session.supabase` (RLS enforced) over `supabaseAdmin`.
 *     Where the admin client is genuinely required, justify it in a comment
 *     at the call site.
 */

import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import {
  type AuthFailureCode,
  type AuthenticatedSession,
  resolveSession,
} from "@/lib/auth/session";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AuthenticatedHandler = (
  request: NextRequest,
  session: AuthenticatedSession,
) => Promise<Response> | Response;

/* -------------------------------------------------------------------------- */
/*                              ERROR RESPONSES                               */
/* -------------------------------------------------------------------------- */

/**
 * Maps an authentication failure to an HTTP status.
 *
 * Configuration problems surface as 503 so they are not mistaken for a
 * caller error, while every credential problem is a 401.
 */
function statusForFailure(code: AuthFailureCode): number {
  return code === "AUTH_UNAVAILABLE" ? 503 : 401;
}

function unauthorizedResponse(
  code: AuthFailureCode,
  message: string,
): NextResponse {
  const status = statusForFailure(code);

  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    Vary: "Authorization, Cookie",
  };

  if (status === 401) {
    headers["WWW-Authenticate"] = "Bearer";
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers,
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                                  WRAPPER                                   */
/* -------------------------------------------------------------------------- */

/**
 * Requires a verified session before invoking the handler.
 */
export function withAuth(
  handler: AuthenticatedHandler,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest): Promise<Response> => {
    const result = await resolveSession(request);

    if (!result.success) {
      return unauthorizedResponse(result.code, result.error);
    }

    return handler(request, result.session);
  };
}
