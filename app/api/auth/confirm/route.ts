import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import {
  ensurePersonalAccount,
  type PersonalAccountClient,
} from "@/lib/tenancy/personalAccount";

/*
  SYRAVEN — Email confirmation landing (Phase 3, Batch 2-D2)

  WHY THIS ROUTE EXISTS

  Registration no longer pre-confirms anyone (Batch 2-D2). GoTrue now
  sends a confirmation email, and the link in it has to land somewhere
  that completes the verification. Nothing in the application did: before
  this route, app/api/auth/ held only register, login, logout and
  reset-password, and no page read a token from the URL.

  IT ACCEPTS BOTH LINK SHAPES

  Which one arrives is decided by the Supabase email template, which is a
  dashboard setting (B2-F2) and is NOT verified yet. Supporting both means
  the code does not have to be changed once that decision is made:

    token_hash + type   the template uses {{ .TokenHash }}; verified with
                        verifyOtp(). No cookie is needed, so it survives
                        the link being opened in another browser.
    code                the template uses {{ .ConfirmationURL }}; GoTrue
                        verifies, then redirects here with a PKCE code,
                        exchanged with exchangeCodeForSession(). This one
                        requires the code-verifier cookie written at
                        sign-up, so it only works in the same browser.

  Anything else is refused. No other parameter is read, and neither the
  token nor the code is ever logged.

  WHAT HAPPENS ON SUCCESS

  Confirmation sets auth.users.email_confirmed_at, which fires
  start_trial_on_email_confirmation() (20260917120000): exactly one
  14-day trial, once, in the database — this route never writes a trial.

  The verification also yields a session. Rather than leave a confirmed
  user with an account that has no tenancy, the route calls the SINGLE
  provisioning authority on that session — the same
  ensurePersonalAccount() that login and /api/account/provision use
  (Batch 2-D1). It passes no identity: the function reads auth.uid().

  FAIL CLOSED (D-B2D-1, carried into this route)

  If provisioning fails, the new session is signed out (local scope: this
  session only) and the user is sent to /login with an error marker, so
  nobody reaches a dashboard their account cannot use. The failure is
  never reported as success.

  THIS ROUTE WRITES NOTHING ITSELF

  No organization, membership, workspace, audit row or profile is written
  here. It verifies, delegates, and redirects.
*/

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** Only these OTP types may be confirmed here. */
const ALLOWED_TYPES = new Set(["signup", "email", "email_change"] as const);

type AllowedType = "signup" | "email" | "email_change";

function isAllowedType(value: string | null): value is AllowedType {
  return value !== null && ALLOWED_TYPES.has(value as AllowedType);
}

/**
 * Redirect targets. Relative paths only, resolved against this request's
 * own origin: an absolute destination taken from the query string would
 * be an open redirect, so no parameter can influence where a caller lands.
 */
const DESTINATION = {
  confirmed: "/dashboard",
  invalid: "/login?error=confirmation_invalid",
  setupFailed: "/login?error=setup_unavailable",
  forbidden: "/login?error=confirmation_forbidden",
} as const;

function redirect(request: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin), {
    status: 303,
  });

  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("SYRAVEN AUTH CONFIRM: Supabase environment is incomplete.");

    return redirect(request, DESTINATION.setupFailed);
  }

  const params = request.nextUrl.searchParams;

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");

  const cookieStore = await cookies();

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
           * If the runtime refuses the cookie write the session is not
           * established; the user can still sign in, which provisions
           * through the same authority.
           */
        }
      },
    },
  });

  /* ------------------------------------------------------------------------ */
  /* VERIFY                                                                   */
  /* ------------------------------------------------------------------------ */

  let verified = false;

  if (tokenHash && isAllowedType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      /* Status and name only: the token itself is never logged. */
      console.error("SYRAVEN AUTH CONFIRM: verification failed.", {
        status: error.status ?? null,
        name: error.name,
      });
    } else {
      verified = true;
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("SYRAVEN AUTH CONFIRM: code exchange failed.", {
        status: error.status ?? null,
        name: error.name,
      });
    } else {
      verified = true;
    }
  }

  if (!verified) {
    /*
     * An expired, reused, forged or absent token all land here, with one
     * message. Distinguishing them would tell an attacker which tokens
     * exist.
     */
    return redirect(request, DESTINATION.invalid);
  }

  /* ------------------------------------------------------------------------ */
  /* PROVISION                                                                */
  /* ------------------------------------------------------------------------ */

  const account = await ensurePersonalAccount(
    supabase as unknown as PersonalAccountClient,
  );

  if (!account.ok) {
    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        console.error(
          "SYRAVEN AUTH CONFIRM: sign-out after failed provisioning failed.",
          { name: signOutError.name, status: signOutError.status ?? null },
        );
      }
    } catch {
      console.error(
        "SYRAVEN AUTH CONFIRM: sign-out after failed provisioning threw.",
      );
    }

    return redirect(
      request,
      account.reason === "FORBIDDEN"
        ? DESTINATION.forbidden
        : DESTINATION.setupFailed,
    );
  }

  return redirect(request, DESTINATION.confirmed);
}
