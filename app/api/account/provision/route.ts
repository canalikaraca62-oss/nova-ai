import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import type { AuthenticatedSession } from "@/lib/auth/session";
import {
  ensurePersonalAccount,
  type PersonalAccountClient,
} from "@/lib/tenancy/personalAccount";

/*
  SYRAVEN — Personal account provisioning for an existing session

  Phase 3, Batch 2-D1 (docs/engineering/SECURITY_EVIDENCE.md).

  WHY THIS ROUTE EXISTS

  Login provisions the caller's organisation and workspace
  (app/api/auth/login). A user who already holds a valid session never
  signs in again, so login alone would leave them — including the
  production accounts found without an organisation (T-B2-1) — without
  one indefinitely. The dashboard calls this route once, when the
  caller's workspace list loads empty.

  WHAT IT DOES

  Exactly one call to ensurePersonalAccount on the caller's own RLS
  client. provision_personal_account() derives identity from auth.uid(),
  refuses an unconfirmed email, serialises per user, and writes nothing
  when the organisation and workspace already exist.

  WHAT IT ACCEPTS

  Nothing from the request: no body, query or header is read. Identity is
  the verified session only (withAuth).

  RESPONSE

  200 { success: true, created }   provisioned now, or already existed
  403                              email not confirmed / not permitted
  503                              provisioning unavailable

  No organisation or workspace id is returned; the dashboard reads them
  through GET /api/workspaces, under RLS.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export const POST = withAuth(
  async (_request: NextRequest, session: AuthenticatedSession) => {
    const result = await ensurePersonalAccount(
      session.supabase as unknown as PersonalAccountClient,
    );

    if (!result.ok) {
      return result.reason === "FORBIDDEN"
        ? NextResponse.json(
            {
              success: false,
              error: "Confirm your email address to set up your workspace.",
            },
            { status: 403, headers: NO_STORE },
          )
        : NextResponse.json(
            {
              success: false,
              error: "Your workspace could not be set up. Please try again.",
            },
            { status: 503, headers: NO_STORE },
          );
    }

    return NextResponse.json(
      { success: true, created: result.created },
      { status: 200, headers: NO_STORE },
    );
  },
);
