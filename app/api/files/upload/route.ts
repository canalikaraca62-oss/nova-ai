import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/files/upload is retired

  WHAT THIS ROUTE USED TO DO

  It wrote up to 50 MB per request to the `files` storage bucket through
  the service-role client and returned a signed URL -- with no usage
  metering and no rate limit, so any signed-in account could fill storage
  at the operator's cost. Nothing in the product called it.

  WHY IT IS NOT REBUILT HERE

  There is no upload surface in the product today. When one is built it
  starts from the controls this route skipped: the `fileUpload` usage
  metric the plans already define, a burst rate limit, and the narrowest
  storage access that works (docs/engineering/PURIFICATION_EVIDENCE.md
  P2-G06).

  It now answers 410 and reads, writes and spends nothing. It no longer
  holds service-role access, and stays behind the session requirement.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async () => {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "ROUTE_RETIRED",
        message: "This endpoint is retired. File upload is not available.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
