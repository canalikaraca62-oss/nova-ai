import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/knowledge/search is retired

  WHAT THIS ROUTE USED TO DO

  A second keyword search over public.knowledge, beside /api/search. It
  filtered on the memory hierarchy's retrievable statuses, which no
  knowledge record carries (records are written "ready"), so for real
  data it answered with an empty list -- a search that looked like it
  worked and found nothing. Nothing in the product called it.

  WHY IT IS NOT REBUILT HERE

  Keyword search already has one path: /api/search (lib/search/query.ts),
  which the /search page uses, with its own entity allowlist, tenancy
  proof and rate limit. Knowledge that feeds AI context is read through
  lib/memory/retrieval.ts, not through a search route
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-G04).

  It now answers 410 and reads, writes and spends nothing. It stays
  behind the session requirement, so the retired path tells an
  anonymous caller nothing.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function retired() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "ROUTE_RETIRED",
        message:
          "This endpoint is retired. Search knowledge through /api/search.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export const GET = withAuth(async () => {
  return retired();
});

export const POST = withAuth(async () => {
  return retired();
});
