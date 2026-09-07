import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/*
  SYRAVEN — Password recovery request

  WHY THIS ROUTE EXISTS

  app/reset-password/page.tsx makes TWO live POSTs to
  "/api/auth/reset-password" — the initial request and a "resend" — and
  the route did not exist. Both failed, so password recovery was
  non-functional. Combined with the missing sign-in route, a user who
  forgot their password had no way back into their account at all.

  THIS INTRODUCES NO NEW AUTH MECHANISM

  Recovery is delegated to Supabase GoTrue via resetPasswordForEmail(),
  the counterpart of the signInWithPassword() call in the sibling login
  route. This route never generates a token, never writes a credential,
  and never touches the service-role client.

  NON-ENUMERATION IS THE POINT

  The page already documents the requirement:

      Security:
      Always show the same success state.
      Do not reveal whether an account exists.

  This route upholds it on the server, which is where it actually
  matters — a page can be bypassed by calling the endpoint directly.
  An unknown address and a registered one produce an IDENTICAL 200
  response. Anything else turns password recovery into a membership
  oracle: an attacker submits addresses and learns which are registered
  without ever attempting a password.

  That is also why a provider error is swallowed rather than surfaced.
  Reporting "no account found" would defeat the whole control.

  AUTHORIZATION

  Public by necessity — a user who cannot sign in has no session. Listed
  in PUBLIC_API_ROUTES in middleware.ts for that reason.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/**
 * Response shape the page consumes: it reads `message` only on a
 * non-OK response, and otherwise shows a fixed success state.
 */
interface ResetResponseBody {
  success: boolean;
  message?: string;
}

/**
 * The single reply for every outcome that is not a malformed request.
 *
 * Deliberately says "if an account exists" rather than confirming one
 * does.
 */
const NEUTRAL_MESSAGE =
  "If an account exists for that address, a recovery email has been sent.";

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

function parseEmail(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;

  const email = (body as Record<string, unknown>).email;

  if (typeof email !== "string") return null;

  const normalized = email.trim().toLowerCase();

  /*
   * Shape only, and bounded. A stricter format check would let a caller
   * distinguish "malformed" from "unknown", which is a weaker version of
   * the same enumeration leak.
   */
  if (
    normalized.length === 0 ||
    normalized.length > 320 ||
    !normalized.includes("@")
  ) {
    return null;
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ResetResponseBody>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("SYRAVEN AUTH RESET: Supabase environment is incomplete.");

    return NextResponse.json(
      { success: false, message: "Password recovery is temporarily unavailable." },
      { status: 503 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "A valid request body is required." },
      { status: 400 },
    );
  }

  const email = parseEmail(body);

  if (email === null) {
    return NextResponse.json(
      { success: false, message: "A valid email address is required." },
      { status: 400 },
    );
  }

  /*
   * Cookie-free client. Recovery establishes no session — it sends an
   * email — so this deliberately does not participate in cookie storage,
   * unlike the login route.
   */
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* Recovery issues no session. */
      },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl ? `${appUrl}/reset-password` : undefined,
  });

  if (error) {
    /*
     * Logged, NEVER surfaced. The provider distinguishes "user not
     * found" from a genuine fault, and forwarding that distinction is
     * exactly the enumeration leak this route exists to prevent.
     *
     * The email is not logged either: a log of recovery attempts would
     * be a list of real addresses.
     */
    console.error("SYRAVEN AUTH RESET: recovery request failed.", {
      status: error.status ?? null,
      name: error.name,
    });
  }

  /*
   * The SAME 200 response regardless of outcome — unknown address,
   * registered address, or provider error. The caller learns only that
   * the request was accepted.
   */
  return NextResponse.json(
    { success: true, message: NEUTRAL_MESSAGE },
    { status: 200 },
  );
}
