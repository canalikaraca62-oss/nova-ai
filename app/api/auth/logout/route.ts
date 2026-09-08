import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/*
  SYRAVEN — Sign out

  WHY THIS ROUTE EXISTS

  There was no way to end a session server-side. `POST /api/auth/logout`
  returned 404, so a signed-in session could only be abandoned, never
  revoked: the refresh token stayed valid until it expired on its own,
  and anyone holding the cookies kept access.

  THIS INTRODUCES NO NEW AUTH MECHANISM

  It is the exact mirror of app/api/auth/login/route.ts — the same
  `createServerClient` + `cookies()` pattern from @supabase/ssr, on the
  same anon-key client. Login writes the session cookies; this clears
  them and revokes the refresh token through Supabase GoTrue. Nothing
  about verification changes and no service-role client is involved.

  AUTHORIZATION

  Deliberately NOT behind `withAuth`.

  Signing out must work even when the session is already invalid — an
  expired or malformed cookie is precisely when a user needs the state
  cleared. Requiring a valid session would answer 401 and leave the
  stale cookies in place, which is the opposite of what the request
  asks for.

  That is not a hole: this route grants nothing. It can only remove
  credentials the caller already presented, and a caller with no
  session simply gets a no-op success. It is therefore registered in
  PUBLIC_API_ROUTES for the same reason as login and register.

  IDEMPOTENT

  Signing out twice, or with no session at all, succeeds. A client
  should never have to reason about whether it was already signed out.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("SYRAVEN LOGOUT: Supabase environment is not configured.");

    return NextResponse.json(
      {
        success: false,
        error: "Sign-out is temporarily unavailable.",
        code: "SUPABASE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();

  /*
   * The same cookie-backed anon client the login route builds. `setAll`
   * is what actually clears the session: signOut() below asks the
   * client to remove its cookies, and they are written back through
   * this adapter.
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
           * ever refuses, the explicit deletion below still runs, so
           * the browser loses the session either way.
           */
        }
      },
    },
  });

  /*
   * Revokes the refresh token as well as clearing the local session, so
   * the credentials cannot be replayed. A failure here is logged but
   * not surfaced: the cookies are still cleared below, and a user who
   * asked to sign out must end up signed out locally regardless.
   */
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("SYRAVEN LOGOUT: sign-out reported an error.", {
      error: error.message,
    });
  }

  /*
   * Belt and braces. `signOut()` normally clears its own cookies
   * through `setAll`, but if the session was already invalid the client
   * may have nothing to clear — and a stale `sb-*` cookie left behind
   * would keep being sent. Deleting every Supabase auth cookie by name
   * guarantees the browser is left with no session material.
   *
   * Only `sb-`-prefixed cookies are touched; nothing else the
   * application stores is affected.
   */
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      try {
        cookieStore.delete(cookie.name);
      } catch {
        /* Same rationale as setAll above. */
      }
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

/*
  A GET here would let a third-party page sign a user out by embedding
  an image or a link. Sign-out is a state change and belongs on POST.
*/
export function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "This endpoint only supports POST requests.",
      code: "METHOD_NOT_ALLOWED",
    },
    { status: 405 },
  );
}
