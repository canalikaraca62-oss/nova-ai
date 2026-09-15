import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/files/analyze is retired

  WHAT THIS ROUTE USED TO DO

  It sent a document to a model for a summary, key points and risks --
  through its own provider transport: a vendor chosen by the request, a
  model named by an environment variable, its own key handling and
  hardcoded endpoints, and a fallback on any failure. It also echoed a
  workspace and project id it never proved. Nothing in the product
  called it.

  WHY IT IS NOT REBUILT HERE

  Model calls already have one path: the registry chooses the model and
  its provider, fallbacks are re-checked against the caller's plan, and
  every call is metered -- the path /api/chat takes. File analysis, when
  a product surface needs it, is built on that path
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-G05).

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
        message: "This endpoint is retired. File analysis is not available.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
