import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/agents/execute is retired

  WHAT THIS ROUTE USED TO DO

  One chat completion with an agent-flavoured system message. It ran no
  tools and changed nothing, but it accepted the caller's own system
  prompt and placed it in the SYSTEM message, with no context budget and
  no untrusted-content fence -- the protection /api/chat applies. Nothing
  in the product called it.

  WHY IT IS NOT REBUILT HERE

  Agent work already has one path: /api/agents/run, where a plan is
  validated against the registry, high-risk steps wait for a claimed
  approval and tools run on the caller's own client. Conversation has
  one path too: /api/chat. A third route answering "as an agent" is a
  second place for those guarantees to drift
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-G02).

  It now answers 410 and reads, writes and spends nothing. It stays
  behind the session requirement, so the retired path tells an
  anonymous caller nothing.
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
          "This endpoint is retired. Run agents through /api/agents/run; chat through /api/chat.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
