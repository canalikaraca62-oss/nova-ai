import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import {
  decideApproval,
  listPendingApprovals,
} from "@/lib/orchestration/approvalStore";

/*
  SYRAVEN — Approval decisions

  WHY THIS ROUTE EXISTS

  The orchestrator stops a high-risk step at `awaiting_approval` and asks
  for a server-held approval record. Until now there was no way for a
  person to produce one: no endpoint, no UI, and a `loadApprovals()` that
  returned an empty map. Every high-risk plan stopped permanently.

  That was the correct failing direction with nothing behind it. This is
  the something.

  WHAT THE CALLER MAY DECIDE

    - which of THEIR OWN pending approvals to approve or reject

  WHAT THE CALLER MAY NOT DECIDE

    - who the approval was for      (RLS + an explicit ownership filter)
    - who decided it                (taken from the verified session)
    - whether it was still pending  (filtered in the update itself)
    - the risk, tool, or effect     (written when the request was made)

  A body field naming another user, another approval's id, or a decision
  on an already-decided row changes nothing. The update is filtered to
  rows that are the caller's AND still pending, so a second decision on
  the same row is a no-op rather than an overwrite -- the first decision
  is the one that stands.

  WHY THERE IS NO DELETE

  `public.agent_approvals` grants no delete policy to any authenticated
  caller. The table is the record of who authorized a destructive action,
  and a user who could remove rows could erase the evidence of the grant
  they used.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/* -------------------------------------------------------------------------- */
/*                            GET — what is waiting                           */
/* -------------------------------------------------------------------------- */

export const GET = withAuth(async (_request: NextRequest, session) => {
  try {
    /*
      Only the caller's own pending approvals, and only ones that have
      not expired. An approval whose fifteen minutes have passed is not
      a decision anybody can still make, so offering it would be a
      control that cannot act.
    */
    const approvals = await listPendingApprovals(session);

    return json({
      success: true,
      data: { approvals },
    });
  } catch (error) {
    console.error("SYRAVEN APPROVALS GET ERROR:", error);

    return json(
      {
        success: false,
        error: { message: "Approvals could not be loaded." },
      },
      500,
    );
  }
});

/* -------------------------------------------------------------------------- */
/*                           POST — decide one of them                        */
/* -------------------------------------------------------------------------- */

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const body = (await request.json().catch(() => null)) as unknown;

    if (!isRecord(body)) {
      return json(
        {
          success: false,
          error: { message: "A valid request body is required." },
        },
        400,
      );
    }

    const approvalId =
      typeof body.approvalId === "string" ? body.approvalId.trim() : "";

    if (approvalId.length === 0) {
      return json(
        {
          success: false,
          error: { message: "An approval id is required." },
        },
        400,
      );
    }

    const decision = body.decision;

    if (decision !== "approved" && decision !== "rejected") {
      /*
        Only two decisions exist. The remaining states -- pending,
        expired, used -- are reached by the system, not by a person:
        expiry is the clock, and 'used' is the orchestrator consuming a
        grant. Accepting them here would let a caller mark their own
        approval used, or resurrect an expired one.
      */
      return json(
        {
          success: false,
          error: {
            message: "A decision must be either approved or rejected.",
          },
        },
        400,
      );
    }

    const outcome = await decideApproval(session, {
      approvalId,
      decision,
    });

    if (!outcome.ok) {
      if (outcome.reason === "NOT_FOUND") {
        /*
          Absent, not the caller's, or no longer pending -- all answered
          identically. Distinguishing them would say whether an approval
          id exists, which is an id-probing oracle on an audit table.
        */
        return json(
          {
            success: false,
            error: { message: "That approval is no longer open." },
          },
          404,
        );
      }

      return json(
        {
          success: false,
          error: { message: "That decision could not be recorded." },
        },
        500,
      );
    }

    return json({
      success: true,
      data: { approvalId, status: outcome.status },
    });
  } catch (error) {
    console.error("SYRAVEN APPROVALS POST ERROR:", error);

    return json(
      {
        success: false,
        error: { message: "That decision could not be recorded." },
      },
      500,
    );
  }
});
