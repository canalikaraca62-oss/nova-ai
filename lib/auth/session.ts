/**
 * SYRAVEN — Server-side session resolution
 * lib/auth/session.ts
 *
 * SECURITY BOUNDARY.
 *
 * This module is the single authoritative source of caller identity for
 * server-side code. Identity is derived ONLY from a verified Supabase
 * session, never from client-supplied input.
 *
 * Two transports are supported, in priority order:
 *
 *   1. `Authorization: Bearer <access_token>` — used by existing API clients.
 *   2. Supabase auth cookies — used by browser/SSR requests.
 *
 * Both are verified against Supabase before any identity is returned.
 *
 * IMPORTANT:
 * Never accept a user id from a query parameter, request body, or header
 * other than a verified credential. Doing so reintroduces the IDOR class of
 * vulnerability documented in ARCHITECTURE_AUDIT.md §8.1.
 */

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AuthFailureCode =
  | "MISSING_AUTHORIZATION"
  | "INVALID_AUTHORIZATION"
  | "UNAUTHORIZED"
  | "AUTH_UNAVAILABLE";

export interface AuthenticatedSession {
  /**
   * The verified Supabase user id. Safe to use as a tenant key.
   */
  userId: string;

  email: string | null;

  /**
   * Supabase client scoped to the caller's credentials.
   *
   * Queries made through this client are subject to Row Level Security,
   * which provides defense in depth alongside explicit ownership filters.
   */
  supabase: SupabaseClient<Database>;
}

export type SessionResult =
  | {
      success: true;
      session: AuthenticatedSession;
    }
  | {
      success: false;
      code: AuthFailureCode;
      error: string;
    };

/* -------------------------------------------------------------------------- */
/*                               ENVIRONMENT                                  */
/* -------------------------------------------------------------------------- */

function getSupabaseEnvironment(): {
  url: string;
  anonKey: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    typeof url !== "string" ||
    url.trim().length === 0 ||
    typeof anonKey !== "string" ||
    anonKey.trim().length === 0
  ) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

/* -------------------------------------------------------------------------- */
/*                              TOKEN EXTRACTION                              */
/* -------------------------------------------------------------------------- */

/**
 * Extracts a bearer token from an Authorization header.
 *
 * Returns null when the header is absent or not bearer-formatted, so the
 * caller can fall back to cookie-based authentication.
 */
export function extractBearerToken(
  request: NextRequest,
): string | null {
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

/* -------------------------------------------------------------------------- */
/*                              CLIENT CREATION                               */
/* -------------------------------------------------------------------------- */

/**
 * Creates a Supabase client bound to a bearer token.
 *
 * The token travels on every PostgREST request, so RLS policies evaluate
 * against the caller rather than a privileged role.
 */
function createTokenScopedClient(
  url: string,
  anonKey: string,
  token: string,
): SupabaseClient<Database> {
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },

      setAll() {
        /* Token-scoped clients do not participate in cookie storage. */
      },
    },

    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },

    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Creates a Supabase client bound to the request's auth cookies.
 */
async function createCookieScopedClient(
  url: string,
  anonKey: string,
): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /*
           * Route handlers may run in contexts where cookies are immutable.
           * Session refresh is handled by middleware, so this is safe to
           * ignore here.
           */
        }
      },
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                            SESSION RESOLUTION                              */
/* -------------------------------------------------------------------------- */

/**
 * Resolves and verifies the caller's session.
 *
 * This performs a real verification round-trip against Supabase. A decoded
 * but unverified JWT is never sufficient.
 */
export async function resolveSession(
  request: NextRequest,
): Promise<SessionResult> {
  const environment = getSupabaseEnvironment();

  if (!environment) {
    console.error(
      "SYRAVEN AUTH: Supabase environment is not configured.",
    );

    return {
      success: false,
      code: "AUTH_UNAVAILABLE",
      error: "Authentication is not available.",
    };
  }

  const token = extractBearerToken(request);

  const hasAuthorizationHeader =
    request.headers.get("authorization") !== null;

  /*
   * A malformed Authorization header is an explicit failure rather than a
   * silent fallback, so misconfigured clients fail loudly.
   */
  if (hasAuthorizationHeader && token === null) {
    return {
      success: false,
      code: "INVALID_AUTHORIZATION",
      error: "Authorization header must use Bearer authentication.",
    };
  }

  try {
    const supabase =
      token !== null
        ? createTokenScopedClient(
            environment.url,
            environment.anonKey,
            token,
          )
        : await createCookieScopedClient(
            environment.url,
            environment.anonKey,
          );

    /*
     * getUser() validates the credential with the Supabase auth server.
     * getSession() must not be used here: it trusts local storage.
     */
    const { data, error } = await supabase.auth.getUser(
      token ?? undefined,
    );

    if (error || !data.user) {
      return {
        success: false,
        code: "UNAUTHORIZED",
        error: "Authentication required.",
      };
    }

    return {
      success: true,
      session: {
        userId: data.user.id,
        email: data.user.email ?? null,
        supabase,
      },
    };
  } catch (error) {
    console.error("SYRAVEN AUTH: Session resolution failed.", error);

    return {
      success: false,
      code: "UNAUTHORIZED",
      error: "Authentication required.",
    };
  }
}
