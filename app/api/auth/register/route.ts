import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

/*
  SYRAVEN — Registration (Phase 3, Batch 2-D2)

  WHAT CHANGED AND WHY

  This route used to call `admin.auth.admin.createUser(..., email_confirm:
  true)` with the SERVICE ROLE, then insert an organization, an owner
  membership, a workspace and an audit row in four non-atomic steps, with
  best-effort compensating deletes, and finally sign the user in.

  Every part of that was a defect:

    - `email_confirm: true` created users who were ALREADY confirmed, so
      no confirmation email was ever sent and the address was never
      proven. It also skipped the `email_confirmed_at` transition, which
      is what starts the 14-day trial (20260917120000), so registered
      users silently got no trial.
    - The four inserts could half-succeed. A failure between them left an
      organization its owner could not use, and the compensating delete
      could itself fail.
    - It was a SECOND tenancy authority, competing with
      `provision_personal_account()` (20260917130000), which is atomic,
      safe to repeat and refuses unconfirmed users.
    - Registration was the one public route holding the RLS-bypassing
      client.

  NOW: this route only asks GoTrue to create an unconfirmed user and send
  a confirmation email. It writes NOTHING itself.

    profile        public.handle_new_user() on auth.users insert
                   (20260918120000) — one row, plan 'free', inactive
    trial          public.start_trial_on_email_confirmation() on the
                   email_confirmed_at transition (20260917120000)
    organization   provision_personal_account() through
    + workspace    lib/tenancy/personalAccount, at confirmation
                   (/api/auth/confirm) or at login (/api/auth/login)

  NO SERVICE ROLE. The anon-key client is used, exactly as the login
  route does, so this route can no longer bypass RLS at all. It is public
  by necessity (middleware.ts): a caller creating an account has no
  session by definition.

  CLIENT-SUPPLIED METADATA IS NOT TRUSTED

  Only the display name is forwarded. The old route copied plan,
  account_status, trial_active, trial_started_at, trial_ends_at and
  permanent_free_tier into user metadata; `handle_new_user()` ignores all
  of it (proven in B2-A2, D10 proofs 1-7), but sending it invited the
  belief that metadata decides entitlements. It does not, and now nothing
  in the request even reaches those fields.

  ACCOUNT ENUMERATION

  The reply is the SAME for a new address and one already registered.
  The old route returned 409 "An account with this email already exists",
  which let anyone test an address without a password. GoTrue itself
  sends the "someone tried to register your address" mail in that case;
  the API says nothing.
*/

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_LENGTH = 128;

const MIN_NAME_LENGTH = 2;

const MAX_NAME_LENGTH = 100;

const MAX_EMAIL_LENGTH = 320;

/**
 * The single reply for every accepted registration attempt.
 *
 * It states what the user must do next and reveals nothing about whether
 * the address was already registered.
 */
const CHECK_YOUR_EMAIL =
  "Check your email. If the address can be registered, a confirmation link is on its way.";

/* -------------------------------------------------------------------------- */
/* VALIDATION                                                                 */
/* -------------------------------------------------------------------------- */

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(MIN_NAME_LENGTH, "Your name must contain at least 2 characters.")
    .max(MAX_NAME_LENGTH, "Your name is too long."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(MAX_EMAIL_LENGTH, "Email address is too long."),

  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      "Your password must contain at least 8 characters.",
    )
    .max(MAX_PASSWORD_LENGTH, "Your password is too long."),
});

type RegisterInput = z.infer<typeof registerSchema>;

/* -------------------------------------------------------------------------- */
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  try {
    /* ---------------------------------------------------------------------- */
    /* REQUEST SAFETY                                                         */
    /* ---------------------------------------------------------------------- */

    const contentLength = request.headers.get("content-length");

    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return jsonError("Request body is too large.", 413);
    }

    const contentType = request.headers.get("content-type");

    if (
      contentType &&
      !contentType.toLowerCase().startsWith("application/json")
    ) {
      return jsonError("Request must use application/json.", 415);
    }

    /* ---------------------------------------------------------------------- */
    /* PARSE BODY                                                             */
    /* ---------------------------------------------------------------------- */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];

      return jsonError(
        firstIssue?.message ?? "Invalid registration data.",
        400,
      );
    }

    const input: RegisterInput = parsed.data;

    const passwordError = validatePassword(input.password);

    if (passwordError) {
      return jsonError(passwordError, 400);
    }

    /* ---------------------------------------------------------------------- */
    /* ENVIRONMENT                                                            */
    /* ---------------------------------------------------------------------- */

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[REGISTER] Supabase public configuration is missing.");

      return jsonError(
        "Authentication service is not configured correctly.",
        503,
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      /*
       * FAIL CLOSED. Without an absolute origin the confirmation link has
       * no destination, so the account would be created and never be
       * confirmable. Better to refuse than to strand a user.
       */
      console.error("[REGISTER] NEXT_PUBLIC_APP_URL is not configured.");

      return jsonError(
        "Registration is temporarily unavailable. Please try again later.",
        503,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* SIGN UP                                                                */
    /* ---------------------------------------------------------------------- */

    const cookieStore = await cookies();

    /*
     * The anon-key client, cookie-backed, as in the login route. The
     * cookie writer matters even though sign-up issues no session: the
     * PKCE code verifier is stored here, and /api/auth/confirm needs it
     * when GoTrue returns a `code` rather than a `token_hash`.
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
             * A runtime restriction on cookie writes does not invalidate
             * the sign-up; the token_hash confirmation path needs no
             * cookie at all.
             */
          }
        },
      },
    });

    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,

      options: {
        /*
         * WHITELIST. Only the display name travels. Nothing here grants
         * a plan, a trial, a role or a tenant: handle_new_user() reads
         * none of it.
         */
        data: {
          full_name: normalizeName(input.name),
          name: normalizeName(input.name),
        },

        emailRedirectTo: `${appUrl.replace(/\/$/, "")}/api/auth/confirm`,
      },
    });

    if (error) {
      /*
       * Logged, never returned. GoTrue distinguishes "already
       * registered" from a genuine fault, and forwarding that
       * distinction is the enumeration oracle this route must not be.
       *
       * The address is not logged either: a log of registration attempts
       * is a list of real email addresses.
       */
      console.error("[REGISTER] Sign-up rejected.", {
        status: error.status ?? null,
        name: error.name,
      });

      /*
       * A provider fault (5xx) is reported as temporarily unavailable so
       * a caller can tell "try again" from "your input was wrong". Rate
       * limiting (429) is passed through as such.
       */
      if (typeof error.status === "number" && error.status >= 500) {
        return jsonError(
          "Registration is temporarily unavailable. Please try again later.",
          503,
        );
      }

      if (error.status === 429) {
        return jsonError(
          "Too many attempts. Please wait a moment and try again.",
          429,
        );
      }

      /*
       * Everything else — including "already registered" — answers with
       * the SAME body as success. The caller learns nothing about the
       * address.
       */
      return jsonSuccess();
    }

    /*
     * No session is returned and none is created: the account is
     * unconfirmed until the link is followed. `data.user` is deliberately
     * not inspected — with confirmations enabled GoTrue returns an
     * obfuscated user for an address that already exists, and reading it
     * would re-introduce the oracle.
     */
    return jsonSuccess();
  } catch (error) {
    console.error("[REGISTER] Unexpected registration error:", error);

    return jsonError(
      "Unable to create your account right now. Please try again.",
      500,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Your password must contain fewer than ${MAX_PASSWORD_LENGTH + 1} characters.`;
  }

  /*
   * Length only, as before: the registration UI encourages uppercase and
   * digits through its strength indicator, and GoTrue enforces the
   * project's own policy.
   */
  return null;
}

/* -------------------------------------------------------------------------- */
/* RESPONSE HELPERS                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The single success shape.
 *
 * No user id, no email, no organization, no workspace, no trial dates:
 * nothing exists yet but an unconfirmed auth user, and echoing an id
 * would leak whether the address was already taken.
 */
function jsonSuccess() {
  return NextResponse.json(
    {
      success: true,
      confirmationRequired: true,
      message: CHECK_YOUR_EMAIL,
    },
    {
      status: 202,

      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,

      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
