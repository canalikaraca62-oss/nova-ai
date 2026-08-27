import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origin = configuredUrl || request.headers.get("origin");

  return (origin || new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();

    if (!supabase) {
      return NextResponse.json(
        {
          error: "Sunucu yapılandırması eksik.",
          code: "SUPABASE_NOT_CONFIGURED",
        },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Oturum doğrulanamadı.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    const token = authorization.replace("Bearer ", "").trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Geçerli kullanıcı bulunamadı.",
          code: "INVALID_SESSION",
        },
        { status: 401 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error: "Ödeme sistemi henüz yapılandırılmadı.",
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
     * Güvenlik:
     * Kullanıcının portal dönüş adresini tamamen dışarıdan
     * kontrol etmesine izin vermiyoruz.
     */
    let returnUrl = `${baseUrl}/billing`;

    if (
      requestedReturnUrl &&
      requestedReturnUrl.startsWith(baseUrl)
    ) {
      returnUrl = requestedReturnUrl;
    }

    /*
     * Stripe customer ID'yi Supabase'deki billing/subscription
     * kaydından buluyoruz.
     *
     * Webhook route'u tamamlandığında subscription kayıtları
     * Stripe customer ID ile güncellenecek.
     */
    const { data: subscription, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        "SYRAVEN PORTAL ABONELİK SORGULAMA HATASI:",
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            "Abonelik bilgileri alınırken bir hata oluştu.",
          code: "SUBSCRIPTION_LOOKUP_FAILED",
        },
        { status: 500 }
      );
    }

    const stripeCustomerId =
      subscription?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "Bu kullanıcı için aktif bir ödeme müşterisi bulunamadı.",
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
      console.error(
        "SYRAVEN BILLING PORTAL HATASI:",
        portalData
      );

      return NextResponse.json(
        {
          error:
            portalData?.error?.message ||
            "Abonelik yönetim ekranı oluşturulamadı.",

          code: "STRIPE_PORTAL_ERROR",
        },
        {
          status: portalResponse.status || 500,
        }
      );
    }

    if (!portalData?.url) {
      return NextResponse.json(
        {
          error:
            "Abonelik yönetim bağlantısı oluşturulamadı.",

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
      "SYRAVEN BILLING PORTAL BEKLENMEYEN HATASI:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Abonelik yönetim ekranı açılırken beklenmeyen bir hata oluştu.",

        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}