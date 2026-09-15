import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/stream is retired

  WHAT THIS ROUTE USED TO DO

  It was a second streaming chat transport beside /api/chat: Groq only,
  with its own key handling, a hardcoded endpoint, a model named by an
  environment variable and its own model allowlist -- and it placed the
  client's `memoryContext` verbatim in the SYSTEM prompt, outside the
  memory retrieval and the untrusted-content fence that /api/chat
  applies. Nothing in the product called it.

  WHY IT IS NOT REBUILT HERE

  Streaming chat already has one path: /api/chat with `stream: true`,
  where the registry chooses the model, retrieved context is fenced as
  untrusted data and every message is metered. A second transport is a
  second place for those guarantees to drift
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-G01).

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
          "This endpoint is retired. Stream chat through /api/chat with stream: true.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
