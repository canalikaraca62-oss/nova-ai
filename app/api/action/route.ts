import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/action is retired

  WHAT THIS ROUTE USED TO DO

  It classified an action and never ran it: "nothing to do" for "none",
  "pending confirmation" for a high-risk type, 409 "not executed" for a
  registered low-risk type, "unsupported" for anything else. It still
  charged the caller's agent-run quota for each call, and its risk rule
  was a second copy of the one in lib/orchestration/registry.ts. Nothing
  in the product called it.

  WHY IT IS NOT REBUILT HERE

  Actions run in one place: /api/agents/run, where every step is
  validated against the registry (lib/orchestration/planValidation.ts),
  high-risk steps wait for a claimed approval, and the orchestrator
  re-checks each step's risk before it runs
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-G03).

  It now answers 410 and reads, writes and spends nothing. Its public
  status GET is gone with it, and the middleware no longer exempts the
  path.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async () => {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "ROUTE_RETIRED",
        message:
          "This endpoint is retired. Actions run through an agent at /api/agents/run, where each step is classified, approved and executed.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
