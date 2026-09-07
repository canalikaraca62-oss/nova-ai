import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/*
  SYRAVEN — Sign in

  WHY THIS ROUTE EXISTS

  app/login/page.tsx has always POSTed to "/api/auth/login", but the
  route did not exist: app/api/auth/ contained only `register`. The
  fetch returned a 404 HTML page, `response.json()` threw, and the page
  showed its generic "Unable to sign in" error.

  Sign-in was therefore non-functional, and because every other page is
  behind the session, the whole authenticated product was unreachable
  through the UI. `app/context/AuthContext.tsx` references sign-in,
  sign-out and session endpoints, but it makes no live calls and is not
  mounted in any layout — it is scaffolding and is NOT the auth path.

  THIS INTRODUCES NO NEW AUTH MECHANISM

  It is the mirror image of the session establishment already performed
  at the end of app/api/auth/register/route.ts: the same
  `createServerClient` + `cookies()` pattern from @supabase/ssr, writing
  the same Supabase session cookies that lib/auth/session.ts later reads.
  Nothing about verification changes; this only lets an existing user
  obtain the session a new user already receives on registration.

  AUTHORIZATION

  Public by necessity — a caller signing in has no session by
  definition. Registered in PUBLIC_API_ROUTES in middleware.ts, alongside
  /api/auth/register, for exactly that reason.

  Credentials are verified by Supabase GoTrue via
  signInWithPassword(); this route never compares a password itself and
  never touches the service-role client.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/**
 * Response shape expected by app/login/page.tsx (`LoginResponse`).
 *
 * Deliberately minimal: `success` and an optional `error`. No token, no
 * user object, no session payload is returned in the body — the session
 * travels as HttpOnly cookies, so putting it in JSON would expose it to
 * any script on the page for no benefit.
 */
interface LoginResponseBody {
  success: boolean;
  error?: string;
}

/**
 * The single message returned for every credential failure.
 *
 * Wrong password, unknown email and unconfirmed account all produce THIS
 * string. Distinguishing them would turn the login form into an account
 * enumeration oracle: an attacker could confirm which addresses are
 * registered without ever guessing a password.
 */
const INVALID_CREDENTIALS = "Invalid email or password.";

function fail(
  status: number,
  error: string,
): NextResponse<LoginResponseBody> {
  return NextResponse.json({ success: false, error }, { status });
}

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

interface LoginInput {
  email: string;
  password: string;
}

/**
 * Extracts credentials from the request body.
 *
 * Shape-only. It deliberately does NOT apply password policy: rules such
 * as minimum length belong at registration, and enforcing them here
 * would reject a legitimate existing password if the policy ever
 * changed — locking users out of their own accounts.
 */
function parseCredentials(body: unknown): LoginInput | null {
  if (typeof body !== "object" || body === null) return null;

  const record = body as Record<string, unknown>;

  const email = record.email;
  const password = record.password;

  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail.length === 0 || normalizedEmail.length > 320) {
    return null;
  }

  /*
   * Bounded to keep an unbounded string from reaching the auth provider.
   * The ceiling is far above any real password.
   */
  if (password.length === 0 || password.length > 512) return null;

  return { email: normalizedEmail, password };
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
): Promise<NextResponse<LoginResponseBody>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    /*
     * A deployment misconfiguration, never the caller's fault, so it
     * must not surface as an auth failure — that would tell a user their
     * password is wrong when the server is simply unconfigured.
     */
    console.error("SYRAVEN AUTH LOGIN: Supabase environment is incomplete.");

    return fail(503, "Sign in is temporarily unavailable.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail(400, "A valid request body is required.");
  }

  const credentials = parseCredentials(body);

  if (credentials === null) {
    /*
     * Malformed input reports the SAME message as bad credentials.
     * A distinct "email is malformed" reply would let an attacker probe
     * address validity without attempting a password.
     */
    return fail(400, INVALID_CREDENTIALS);
  }

  const cookieStore = await cookies();

  /*
   * The anon-key client, cookie-backed. This is the same construction
   * used by lib/auth/session.ts and by the register route: on a
   * successful sign-in, @supabase/ssr writes the session cookies through
   * `setAll`, and every later request is authenticated by reading them
   * back. There is no service-role client anywhere in this file.
   */
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
           * Route handlers can normally mutate cookies. If a runtime
           * restriction prevents it, the sign-in itself still succeeded
           * and the client can retry.
           */
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    /*
     * The provider's own message is logged, never returned: it
     * distinguishes "invalid password" from "email not confirmed", which
     * is precisely the distinction that enables enumeration.
     *
     * The email is not logged either — it is a personal identifier, and
     * a log of failed attempts is a list of real addresses.
     */
    console.error("SYRAVEN AUTH LOGIN: sign-in rejected.", {
      status: error.status ?? null,
      name: error.name,
    });

    /*
     * 401 for a genuine credential rejection; 503 when the provider
     * itself is unavailable, so a client can tell "try again" from
     * "check your password".
     */
    const status = typeof error.status === "number" && error.status >= 500
      ? 503
      : 401;

    return fail(
      status,
      status === 503
        ? "Sign in is temporarily unavailable."
        : INVALID_CREDENTIALS,
    );
  }

  if (!data.session || !data.user) {
    /*
     * Defensive: a non-error response with no session should not happen,
     * but returning success without a session would send the client to a
     * dashboard it cannot load.
     */
    console.error("SYRAVEN AUTH LOGIN: no session returned.");

    return fail(503, "Sign in is temporarily unavailable.");
  }

  /*
   * Success. No token, no user id, no email in the body — the session is
   * already in HttpOnly cookies, and the page only needs to know it may
   * navigate.
   */
  return NextResponse.json({ success: true }, { status: 200 });
}
