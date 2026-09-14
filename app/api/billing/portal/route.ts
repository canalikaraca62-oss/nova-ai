import { type NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";

/*
  The Stripe customer id is read from the caller's own profile, through
  the caller's RLS-scoped client -- the row the webhook writes it to and
  the same read /api/billing makes.

  This route used to build its own anon client and read a
  `subscriptions` table that does not exist, so every call ended in a
  500 and the "Manage subscription" button never opened the portal
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-F02).
*/

function getBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origin = configuredUrl || request.headers.get("origin");

  return (origin || new URL(request.url).origin).replace(/\/$/, "");
}

export const POST = withAuth(async (request, session) => {
  try {
    /*
      Authentication is performed by withAuth (lib/api/withAuth.ts)
      before this handler runs. The inline Bearer check this replaced
      accepted Bearer only, so a browser cookie session could not reach
      this route; withAuth accepts both.
    */
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error: "Payments are not configured yet.",
          code: "BILLING_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const body = await request
      .json()
      .catch(() => ({} as Record<string, unknown>));

    const requestedReturnUrl =
      typeof body.returnUrl === "string"
        ? body.returnUrl
        : null;

    const baseUrl = getBaseUrl(request);

    /*
     * SECURITY: the caller does not control where the portal returns
     * to. Only a URL on this application's own origin is accepted.
     */
    let returnUrl = `${baseUrl}/billing`;

    if (
      requestedReturnUrl &&
      requestedReturnUrl.startsWith(baseUrl)
    ) {
      returnUrl = requestedReturnUrl;
    }

    const { data: profile, error: profileError } =
      await session.supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", session.userId)
        .maybeSingle();

    if (profileError) {
      console.error(
        "SYRAVEN PORTAL PROFILE LOOKUP ERROR:",
        { userId: session.userId, code: profileError.code }
      );

      return NextResponse.json(
        {
          error:
            "Your subscription details could not be loaded.",
          code: "SUBSCRIPTION_LOOKUP_FAILED",
        },
        { status: 500 }
      );
    }

    const stripeCustomerId =
      profile?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No active billing customer was found for this account.",
          code: "CUSTOMER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const portalResponse = await fetch(
      "https://api.stripe.com/v1/billing_portal/sessions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams({
          customer: stripeCustomerId,
          return_url: returnUrl,
        }).toString(),
      }
    );

    const portalData = await portalResponse.json();

    if (!portalResponse.ok) {
      /*
        Stripe's message stays in the server log. It can name the
        customer, the configuration or the account, none of which is the
        caller's to read.
      */
      console.error(
        "SYRAVEN BILLING PORTAL ERROR:",
        portalData
      );

      return NextResponse.json(
        {
          error:
            "The subscription management page could not be opened.",

          code: "STRIPE_PORTAL_ERROR",
        },
        {
          status: 502,
        }
      );
    }

    if (!portalData?.url) {
      return NextResponse.json(
        {
          error:
            "The subscription management link could not be created.",

          code: "INVALID_PORTAL_SESSION",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,

        portal: {
          url: portalData.url,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "SYRAVEN BILLING PORTAL UNEXPECTED ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while opening subscription management.",

        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
})
