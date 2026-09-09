import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/*
  The canonical vocabulary from lib/plans.ts.

  This route used to speak free | pro | premium | vip, a legacy set
  that matched nothing else in the product: "premium" resolved to
  `starter` and "vip" was a second alias for `pro`, so two different
  price ids could grant the same plan while `business` could not be
  sold at all. Enterprise stays out on purpose -- it is quoted, not
  self-served.
*/
type BillingPlan = "free" | "starter" | "pro" | "business";

interface CheckoutRequest {
  plan?: BillingPlan;
  interval?: "monthly" | "yearly";
  successUrl?: string;
  cancelUrl?: string;
}

const VALID_PLANS: BillingPlan[] = [
  "free",
  "starter",
  "pro",
  "business",
];

const VALID_INTERVALS = ["monthly", "yearly"] as const;

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBaseUrl(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    new URL(request.url).origin;

  return origin.replace(/\/$/, "");
}

function normalizePlan(plan: unknown): BillingPlan | null {
  if (typeof plan !== "string") {
    return null;
  }

  const normalized = plan.toLowerCase() as BillingPlan;

  return VALID_PLANS.includes(normalized) ? normalized : null;
}

/**
 * Canonicalises the billing interval.
 *
 * app/billing/page.tsx sent "month"/"year" while this route accepted
 * only "monthly"/"yearly", so every upgrade click returned 400
 * INVALID_INTERVAL -- checkout was unreachable from the UI even with
 * Stripe fully configured.
 *
 * The caller is fixed too, but both spellings are accepted here: the
 * short forms are what Stripe itself uses for a recurring interval,
 * so a future caller reaching for them is a reasonable mistake to
 * absorb rather than reject. Anything else is still refused.
 */
function normalizeInterval(
  interval: unknown
): "monthly" | "yearly" | null {
  if (typeof interval !== "string") {
    return null;
  }

  switch (interval.toLowerCase()) {
    case "monthly":
    case "month":
      return "monthly";

    case "yearly":
    case "year":
    case "annual":
      return "yearly";

    default:
      return null;
  }
}

/**
 * Resolves the Stripe price id for a plan and interval.
 *
 * SERVER-AUTHORITATIVE. The price id is looked up from the
 * environment by (plan, interval); it is never read from the request,
 * so a caller cannot name a cheaper price for a richer plan.
 *
 * Returns null when the pair has no configured price, which the
 * handler turns into a 503 rather than a silent downgrade.
 */
function getPriceId(
  plan: BillingPlan,
  interval: "monthly" | "yearly"
) {
  const priceMap: Record<
    Exclude<BillingPlan, "free">,
    Record<"monthly" | "yearly", string | undefined>
  > = {
    starter: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    },

    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },

    business: {
      monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    },
  };

  if (plan === "free") {
    return null;
  }

  return priceMap[plan][interval] || null;
}

export const POST = withAuth(async (request, session) => {
  try {
    const supabase = getSupabaseServer();

    if (!supabase) {
      return NextResponse.json(
        {
          error: "Sunucu yapılandırması eksik.",
          code: "SUPABASE_NOT_CONFIGURED",
        },
        {
          status: 500,
        }
      );
    }

    /*
      Authentication is performed by withAuth (lib/api/withAuth.ts)
      before this handler runs. The inline Bearer check this replaced
      accepted Bearer only, so a browser cookie session could not reach
      this route; withAuth accepts both.
    */
    const user = {
      id: session.userId,
      email: session.email,
    };

    let body: CheckoutRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Geçersiz istek verisi.",
          code: "INVALID_BODY",
        },
        {
          status: 400,
        }
      );
    }

    const plan = normalizePlan(body.plan);
    const interval = normalizeInterval(body.interval);

    if (!plan) {
      return NextResponse.json(
        {
          error: "Geçerli bir plan seçilmedi.",
          code: "INVALID_PLAN",
        },
        {
          status: 400,
        }
      );
    }

    if (plan === "free") {
      return NextResponse.json(
        {
          error: "Free plan için ödeme işlemi gerekmez.",
          code: "FREE_PLAN",
        },
        {
          status: 400,
        }
      );
    }

    if (!interval) {
      return NextResponse.json(
        {
          error: "Geçerli bir ödeme dönemi seçilmedi.",
          code: "INVALID_INTERVAL",
        },
        {
          status: 400,
        }
      );
    }

    const priceId = getPriceId(plan, interval);

    if (!priceId) {
      return NextResponse.json(
        {
          error: "Bu plan için ödeme yapılandırması henüz tamamlanmadı.",
          code: "PRICE_NOT_CONFIGURED",
        },
        {
          status: 503,
        }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error: "Ödeme sistemi henüz yapılandırılmadı.",
          code: "BILLING_NOT_CONFIGURED",
        },
        {
          status: 503,
        }
      );
    }

    const baseUrl = getBaseUrl(request);

    const successUrl =
      body.successUrl ||
      `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      body.cancelUrl ||
      `${baseUrl}/billing/cancel`;

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams({
          mode: "subscription",

          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",

          success_url: successUrl,
          cancel_url: cancelUrl,

          customer_email: user.email || "",

          client_reference_id: user.id,

          "metadata[user_id]": user.id,
          "metadata[plan]": plan,
          "metadata[interval]": interval,

          "subscription_data[metadata][user_id]": user.id,
          "subscription_data[metadata][plan]": plan,
          "subscription_data[metadata][interval]": interval,

          allow_promotion_codes: "true",

          billing_address_collection: "auto",
        }).toString(),
      }
    );

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error(
        "SYRAVEN CHECKOUT HATASI:",
        stripeData
      );

      return NextResponse.json(
        {
          error:
            stripeData?.error?.message ||
            "Ödeme oturumu oluşturulamadı.",

          code: "STRIPE_CHECKOUT_ERROR",
        },
        {
          status: stripeResponse.status || 500,
        }
      );
    }

    if (!stripeData?.url || !stripeData?.id) {
      return NextResponse.json(
        {
          error: "Ödeme oturumu geçersiz oluşturuldu.",
          code: "INVALID_CHECKOUT_SESSION",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        checkout: {
          id: stripeData.id,
          url: stripeData.url,
        },

        plan,
        interval,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN BILLING CHECKOUT HATASI:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ödeme işlemi başlatılırken beklenmeyen bir hata oluştu.",

        code: "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
})