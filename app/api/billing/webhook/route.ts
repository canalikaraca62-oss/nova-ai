import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN BILLING PLANS
================================================== */

type SyravenPlan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

/* ==================================================
   STRIPE CLIENT
================================================== */

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

/* ==================================================
   HELPERS
================================================== */

function getStripeCustomerId(
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
    | undefined
): string | null {
  if (!customer) {
    return null;
  }

  if (typeof customer === "string") {
    return customer;
  }

  return customer.id || null;
}

function getStripeSubscriptionId(
  subscription:
    | string
    | Stripe.Subscription
    | null
    | undefined
): string | null {
  if (!subscription) {
    return null;
  }

  if (typeof subscription === "string") {
    return subscription;
  }

  return subscription.id || null;
}

/* ==================================================
   PLAN NORMALIZATION
================================================== */

function normalizePlan(
  value: string | null | undefined
): SyravenPlan {
  const plan = value?.trim().toLowerCase();

  switch (plan) {
    case "premium":
    case "plus":
      return "premium";

    case "pro":
    case "vip":
      return "pro";

    case "business":
      return "business";

    case "enterprise":
      return "enterprise";

    default:
      return "free";
  }
}

/* ==================================================
   GET PLAN FROM PRICE
================================================== */

function getPlanFromPriceId(
  priceId: string | null | undefined
): SyravenPlan {
  if (!priceId) {
    return "free";
  }

  if (
    priceId === process.env.STRIPE_PRICE_PREMIUM
  ) {
    return "premium";
  }

  if (
    priceId === process.env.STRIPE_PRICE_PRO
  ) {
    return "pro";
  }

  if (
    priceId === process.env.STRIPE_PRICE_BUSINESS
  ) {
    return "business";
  }

  if (
    priceId === process.env.STRIPE_PRICE_ENTERPRISE
  ) {
    return "enterprise";
  }

  return "free";
}

/* ==================================================
   FIND USER
================================================== */

async function findUserIdByCustomerId(
  customerId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq(
      "stripe_customer_id",
      customerId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "SYRAVEN CUSTOMER LOOKUP ERROR:",
      error
    );

    return null;
  }

  return data?.id ?? null;
}

/* ==================================================
   UPDATE BILLING
================================================== */

async function updateBilling({
  userId,
  plan,
  status,
  customerId,
  subscriptionId,
}: {
  userId: string;
  plan: SyravenPlan;
  status: string;
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan,
      subscription_status: status,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id:
        subscriptionId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error(
      "SYRAVEN BILLING UPDATE ERROR:",
      error
    );

    throw error;
  }
}

/* ==================================================
   GET USER ID FROM METADATA
================================================== */

function getUserIdFromMetadata(
  metadata:
    | Stripe.Metadata
    | null
    | undefined
): string | null {
  if (!metadata) {
    return null;
  }

  const userId =
    metadata.user_id ??
    metadata.userId ??
    null;

  return userId || null;
}

/* ==================================================
   CHECKOUT COMPLETED
================================================== */

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  const customerId = getStripeCustomerId(
    session.customer
  );

  const subscriptionId =
    getStripeSubscriptionId(
      session.subscription
    );

  let userId =
    session.client_reference_id ??
    getUserIdFromMetadata(
      session.metadata
    );

  if (!userId && customerId) {
    userId =
      await findUserIdByCustomerId(
        customerId
      );
  }

  if (!userId) {
    console.error(
      "SYRAVEN WEBHOOK USER NOT FOUND:",
      session.id
    );

    return;
  }

  const plan = normalizePlan(
    session.metadata?.plan ??
      session.metadata?.tier ??
      null
  );

  await updateBilling({
    userId,
    plan,
    status:
      session.payment_status ??
      "active",
    customerId,
    subscriptionId,
  });

  console.log(
    "SYRAVEN CHECKOUT COMPLETED:",
    {
      userId,
      plan,
      subscriptionId,
    }
  );
}

/* ==================================================
   SUBSCRIPTION UPDATE
================================================== */

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const customerId = getStripeCustomerId(
    subscription.customer
  );

  let userId = getUserIdFromMetadata(
    subscription.metadata
  );

  if (!userId && customerId) {
    userId =
      await findUserIdByCustomerId(
        customerId
      );
  }

  if (!userId) {
    console.error(
      "SYRAVEN SUBSCRIPTION USER NOT FOUND:",
      subscription.id
    );

    return;
  }

  const firstItem =
    subscription.items.data[0];

  const priceId =
    firstItem?.price?.id ?? null;

  const metadataPlan =
    subscription.metadata?.plan ??
    subscription.metadata?.tier ??
    firstItem?.price?.metadata?.plan ??
    firstItem?.price?.metadata?.tier ??
    null;

  const plan =
    metadataPlan
      ? normalizePlan(metadataPlan)
      : getPlanFromPriceId(priceId);

  await updateBilling({
    userId,
    plan,
    status: subscription.status,
    customerId,
    subscriptionId:
      subscription.id,
  });

  console.log(
    "SYRAVEN SUBSCRIPTION UPDATED:",
    {
      userId,
      plan,
      status:
        subscription.status,
    }
  );
}

/* ==================================================
   SUBSCRIPTION DELETED
================================================== */

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const customerId = getStripeCustomerId(
    subscription.customer
  );

  let userId = getUserIdFromMetadata(
    subscription.metadata
  );

  if (!userId && customerId) {
    userId =
      await findUserIdByCustomerId(
        customerId
      );
  }

  if (!userId) {
    console.error(
      "SYRAVEN CANCELED USER NOT FOUND:",
      subscription.id
    );

    return;
  }

  await updateBilling({
    userId,
    plan: "free",
    status: "canceled",
    customerId,
    subscriptionId:
      subscription.id,
  });

  console.log(
    "SYRAVEN SUBSCRIPTION CANCELED:",
    {
      userId,
      subscriptionId:
        subscription.id,
    }
  );
}

/* ==================================================
   WEBHOOK
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const stripe =
      getStripeClient();

    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET;

    /*
      Stripe henüz yapılandırılmadıysa
      development ortamında uygulama
      crash olmaz.
    */

    if (!stripe || !webhookSecret) {
      console.warn(
        "SYRAVEN BILLING: Stripe is not configured."
      );

      return NextResponse.json(
        {
          received: true,
          configured: false,
          message:
            "Stripe billing is not configured yet.",
        },
        {
          status: 200,
        }
      );
    }

    const signature =
      request.headers.get(
        "stripe-signature"
      );

    if (!signature) {
      return NextResponse.json(
        {
          error:
            "Missing Stripe signature.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.text();

    let event: Stripe.Event;

    try {
      event =
        stripe.webhooks.constructEvent(
          body,
          signature,
          webhookSecret
        );
    } catch (error) {
      console.error(
        "SYRAVEN WEBHOOK SIGNATURE ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Invalid webhook signature.",
        },
        {
          status: 400,
        }
      );
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      default:
        console.log(
          "SYRAVEN WEBHOOK EVENT IGNORED:",
          event.type
        );
    }

    return NextResponse.json(
      {
        received: true,
        configured: true,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN BILLING WEBHOOK ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}