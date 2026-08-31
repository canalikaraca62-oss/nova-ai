import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN BILLING WEBHOOK
================================================== */

type SyravenPlan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unknown";

/* ==================================================
   STRIPE CLIENT
================================================== */

function getStripeClient(): Stripe | null {
  const secretKey =
    process.env.STRIPE_SECRET_KEY;

  if (
    typeof secretKey !== "string" ||
    secretKey.trim().length === 0
  ) {
    return null;
  }

  return new Stripe(secretKey);
}

/* ==================================================
   GENERIC TYPE HELPERS
================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getStringValue(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function getRecordString(
  value: unknown,
  key: string
): string | null {
  if (
    !isRecord(value)
  ) {
    return null;
  }

  return getStringValue(
    value[key]
  );
}

/* ==================================================
   STRIPE ID HELPERS
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

  if (
    typeof customer === "string"
  ) {
    return getStringValue(
      customer
    );
  }

  return getStringValue(
    customer.id
  );
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

  if (
    typeof subscription === "string"
  ) {
    return getStringValue(
      subscription
    );
  }

  return getStringValue(
    subscription.id
  );
}

/* ==================================================
   PLAN NORMALIZATION
================================================== */

function normalizePlan(
  value: unknown
): SyravenPlan {
  const normalized =
    getStringValue(value)
      ?.toLowerCase()
      .trim();

  switch (normalized) {
    case "premium":
    case "plus":
      return "premium";

    case "pro":
    case "vip":
      return "pro";

    case "business":
    case "team":
      return "business";

    case "enterprise":
      return "enterprise";

    case "free":
    default:
      return "free";
  }
}

/* ==================================================
   BILLING STATUS NORMALIZATION
================================================== */

function normalizeBillingStatus(
  value: unknown
): BillingStatus {
  const status =
    getStringValue(value)
      ?.toLowerCase()
      .trim();

  switch (status) {
    case "active":
      return "active";

    case "trialing":
      return "trialing";

    case "past_due":
      return "past_due";

    case "canceled":
      return "canceled";

    case "unpaid":
      return "unpaid";

    case "incomplete":
      return "incomplete";

    case "incomplete_expired":
      return "incomplete_expired";

    case "paused":
      return "paused";

    default:
      return "unknown";
  }
}

/* ==================================================
   GET PLAN FROM STRIPE PRICE
================================================== */

function getPlanFromPriceId(
  priceId: string | null | undefined
): SyravenPlan {
  const normalizedPriceId =
    getStringValue(priceId);

  if (!normalizedPriceId) {
    return "free";
  }

  const premiumPriceId =
    getStringValue(
      process.env.STRIPE_PRICE_PREMIUM
    );

  const proPriceId =
    getStringValue(
      process.env.STRIPE_PRICE_PRO
    );

  const businessPriceId =
    getStringValue(
      process.env.STRIPE_PRICE_BUSINESS
    );

  const enterprisePriceId =
    getStringValue(
      process.env.STRIPE_PRICE_ENTERPRISE
    );

  if (
    premiumPriceId &&
    normalizedPriceId === premiumPriceId
  ) {
    return "premium";
  }

  if (
    proPriceId &&
    normalizedPriceId === proPriceId
  ) {
    return "pro";
  }

  if (
    businessPriceId &&
    normalizedPriceId === businessPriceId
  ) {
    return "business";
  }

  if (
    enterprisePriceId &&
    normalizedPriceId === enterprisePriceId
  ) {
    return "enterprise";
  }

  return "free";
}

/* ==================================================
   GET PLAN FROM METADATA
================================================== */

function getPlanFromMetadata(
  metadata:
    | Stripe.Metadata
    | null
    | undefined
): SyravenPlan | null {
  if (!metadata) {
    return null;
  }

  const value =
    metadata.plan ??
    metadata.tier ??
    metadata.plan_name ??
    null;

  if (!value) {
    return null;
  }

  return normalizePlan(value);
}

/* ==================================================
   FIND USER BY STRIPE CUSTOMER ID
================================================== */

async function findUserIdByCustomerId(
  customerId: string
): Promise<string | null> {
  const normalizedCustomerId =
    getStringValue(customerId);

  if (!normalizedCustomerId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq(
      "stripe_customer_id",
      normalizedCustomerId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "SYRAVEN CUSTOMER LOOKUP ERROR:",
      {
        customerId:
          normalizedCustomerId,
        error,
      }
    );

    return null;
  }

  /*
    IMPORTANT:

    Supabase data types bazen generated
    type eksik olduğunda {} | null şeklinde
    algılanabilir.

    Bu nedenle id runtime'da doğrulanır.
  */

  return getRecordString(
    data,
    "id"
  );
}

/* ==================================================
   FIND USER BY SUBSCRIPTION ID
================================================== */

async function findUserIdBySubscriptionId(
  subscriptionId: string
): Promise<string | null> {
  const normalizedSubscriptionId =
    getStringValue(subscriptionId);

  if (!normalizedSubscriptionId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq(
      "stripe_subscription_id",
      normalizedSubscriptionId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "SYRAVEN SUBSCRIPTION LOOKUP ERROR:",
      {
        subscriptionId:
          normalizedSubscriptionId,
        error,
      }
    );

    return null;
  }

  return getRecordString(
    data,
    "id"
  );
}

/* ==================================================
   UPDATE BILLING PROFILE
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
  status: BillingStatus | string;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  const normalizedUserId =
    getStringValue(userId);

  if (!normalizedUserId) {
    throw new Error(
      "Cannot update billing without a valid user ID."
    );
  }

  const normalizedCustomerId =
    getStringValue(customerId);

  const normalizedSubscriptionId =
    getStringValue(subscriptionId);

  const normalizedStatus =
    normalizeBillingStatus(status);

  const {
    error,
  } = await supabaseAdmin
    .from("profiles")
    .update({
      plan,
      subscription_status:
        normalizedStatus,
      stripe_customer_id:
        normalizedCustomerId,
      stripe_subscription_id:
        normalizedSubscriptionId,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      normalizedUserId
    );

  if (error) {
    console.error(
      "SYRAVEN BILLING UPDATE ERROR:",
      {
        userId:
          normalizedUserId,
        plan,
        status:
          normalizedStatus,
        error,
      }
    );

    throw new Error(
      "Failed to update billing profile."
    );
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
    metadata.supabase_user_id ??
    null;

  return getStringValue(
    userId
  );
}

/* ==================================================
   RESOLVE USER ID
================================================== */

async function resolveUserId({
  customerId,
  subscriptionId,
  metadata,
  fallbackUserId,
}: {
  customerId?: string | null;
  subscriptionId?: string | null;
  metadata?:
    | Stripe.Metadata
    | null;
  fallbackUserId?: string | null;
}): Promise<string | null> {
  /*
    1. Explicit fallback ID
  */

  const directUserId =
    getStringValue(
      fallbackUserId
    );

  if (directUserId) {
    return directUserId;
  }

  /*
    2. Metadata
  */

  const metadataUserId =
    getUserIdFromMetadata(
      metadata
    );

  if (metadataUserId) {
    return metadataUserId;
  }

  /*
    3. Subscription lookup
  */

  const normalizedSubscriptionId =
    getStringValue(
      subscriptionId
    );

  if (normalizedSubscriptionId) {
    const userId =
      await findUserIdBySubscriptionId(
        normalizedSubscriptionId
      );

    if (userId) {
      return userId;
    }
  }

  /*
    4. Customer lookup
  */

  const normalizedCustomerId =
    getStringValue(
      customerId
    );

  if (normalizedCustomerId) {
    return await findUserIdByCustomerId(
      normalizedCustomerId
    );
  }

  return null;
}

/* ==================================================
   GET SUBSCRIPTION PLAN
================================================== */

function getSubscriptionPlan(
  subscription: Stripe.Subscription
): SyravenPlan {
  /*
    1. Subscription metadata
  */

  const subscriptionPlan =
    getPlanFromMetadata(
      subscription.metadata
    );

  if (
    subscriptionPlan &&
    subscriptionPlan !== "free"
  ) {
    return subscriptionPlan;
  }

  const firstItem =
    subscription.items.data[0];

  if (!firstItem) {
    return "free";
  }

  /*
    2. Price metadata
  */

  const priceMetadataPlan =
    getPlanFromMetadata(
      firstItem.price.metadata
    );

  if (
    priceMetadataPlan &&
    priceMetadataPlan !== "free"
  ) {
    return priceMetadataPlan;
  }

  /*
    3. Environment price mapping
  */

  return getPlanFromPriceId(
    firstItem.price.id
  );
}

/* ==================================================
   CHECKOUT COMPLETED
================================================== */

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const customerId =
    getStripeCustomerId(
      session.customer
    );

  const subscriptionId =
    getStripeSubscriptionId(
      session.subscription
    );

  const userId =
    await resolveUserId({
      customerId,
      subscriptionId,
      metadata:
        session.metadata,
      fallbackUserId:
        session.client_reference_id,
    });

  if (!userId) {
    console.error(
      "SYRAVEN CHECKOUT USER NOT FOUND:",
      {
        sessionId:
          session.id,
        customerId,
        subscriptionId,
      }
    );

    return;
  }

  const metadataPlan =
    getPlanFromMetadata(
      session.metadata
    );

  const plan =
    metadataPlan ??
    "free";

  /*
    Checkout payment status:
    paid / unpaid / no_payment_required
  */

  const status =
    session.payment_status === "paid"
      ? "active"
      : normalizeBillingStatus(
          session.payment_status
        );

  await updateBilling({
    userId,
    plan,
    status,
    customerId,
    subscriptionId,
  });

  console.log(
    "SYRAVEN CHECKOUT COMPLETED:",
    {
      event:
        "checkout.session.completed",
      sessionId:
        session.id,
      userId,
      plan,
      status,
      customerId,
      subscriptionId,
    }
  );
}

/* ==================================================
   ASYNC PAYMENT SUCCEEDED
================================================== */

async function handleAsyncPaymentSucceeded(
  session: Stripe.Checkout.Session
): Promise<void> {
  await handleCheckoutCompleted(
    session
  );

  console.log(
    "SYRAVEN ASYNC PAYMENT SUCCEEDED:",
    {
      sessionId:
        session.id,
    }
  );
}

/* ==================================================
   SUBSCRIPTION CREATED / UPDATED
================================================== */

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    getStripeCustomerId(
      subscription.customer
    );

  const subscriptionId =
    getStringValue(
      subscription.id
    );

  const userId =
    await resolveUserId({
      customerId,
      subscriptionId,
      metadata:
        subscription.metadata,
    });

  if (!userId) {
    console.error(
      "SYRAVEN SUBSCRIPTION USER NOT FOUND:",
      {
        subscriptionId,
        customerId,
      }
    );

    return;
  }

  const plan =
    getSubscriptionPlan(
      subscription
    );

  const status =
    normalizeBillingStatus(
      subscription.status
    );

  await updateBilling({
    userId,
    plan,
    status,
    customerId,
    subscriptionId,
  });

  console.log(
    "SYRAVEN SUBSCRIPTION UPDATED:",
    {
      subscriptionId,
      userId,
      plan,
      status,
    }
  );
}

/* ==================================================
   SUBSCRIPTION DELETED
================================================== */

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    getStripeCustomerId(
      subscription.customer
    );

  const subscriptionId =
    getStringValue(
      subscription.id
    );

  const userId =
    await resolveUserId({
      customerId,
      subscriptionId,
      metadata:
        subscription.metadata,
    });

  if (!userId) {
    console.error(
      "SYRAVEN CANCELED USER NOT FOUND:",
      {
        subscriptionId,
        customerId,
      }
    );

    return;
  }

  await updateBilling({
    userId,
    plan: "free",
    status: "canceled",
    customerId,
    subscriptionId: null,
  });

  console.log(
    "SYRAVEN SUBSCRIPTION CANCELED:",
    {
      userId,
      subscriptionId,
      customerId,
    }
  );
}

/* ==================================================
   PAYMENT FAILED
================================================== */

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    getStripeCustomerId(
      invoice.customer
    );

  if (!customerId) {
    console.error(
      "SYRAVEN INVOICE PAYMENT FAILED: CUSTOMER NOT FOUND",
      {
        invoiceId:
          invoice.id,
      }
    );

    return;
  }

  const userId =
    await findUserIdByCustomerId(
      customerId
    );

  if (!userId) {
    console.error(
      "SYRAVEN INVOICE PAYMENT FAILED: USER NOT FOUND",
      {
        invoiceId:
          invoice.id,
        customerId,
      }
    );

    return;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      "plan, stripe_subscription_id"
    )
    .eq(
      "id",
      userId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "SYRAVEN PROFILE LOOKUP ERROR:",
      error
    );

    return;
  }

  const currentPlan =
    normalizePlan(
      getRecordString(
        data,
        "plan"
      )
    );

  const subscriptionId =
    getRecordString(
      data,
      "stripe_subscription_id"
    );

  await updateBilling({
    userId,
    plan: currentPlan,
    status: "past_due",
    customerId,
    subscriptionId,
  });

  console.warn(
    "SYRAVEN PAYMENT FAILED:",
    {
      invoiceId:
        invoice.id,
      userId,
      customerId,
    }
  );
}

/* ==================================================
   RESPONSE HELPERS
================================================== */

function successResponse(
  data: Record<string, unknown>
) {
  return NextResponse.json(
    data,
    {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

/* ==================================================
   WEBHOOK POST
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const stripe =
      getStripeClient();

    const webhookSecret =
      getStringValue(
        process.env.STRIPE_WEBHOOK_SECRET
      );

    /*
      Development ortamında Stripe
      yapılandırılmamışsa uygulama
      crash etmez.

      Production ortamında ise
      environment configuration
      mutlaka yapılmalıdır.
    */

    if (
      !stripe ||
      !webhookSecret
    ) {
      console.warn(
        "SYRAVEN BILLING: Stripe is not configured."
      );

      return successResponse({
        received: true,
        configured: false,
        message:
          "Stripe billing is not configured.",
      });
    }

    const signature =
      request.headers.get(
        "stripe-signature"
      );

    if (!signature) {
      return errorResponse(
        "Missing Stripe signature.",
        400
      );
    }

    /*
      IMPORTANT:

      Stripe webhook signature validation
      için request body JSON.parse edilmeden
      raw text olarak alınmalıdır.
    */

    const rawBody =
      await request.text();

    if (
      rawBody.length === 0
    ) {
      return errorResponse(
        "Webhook body is empty.",
        400
      );
    }

    let event: Stripe.Event;

    try {
      event =
        stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
    } catch (error) {
      console.error(
        "SYRAVEN WEBHOOK SIGNATURE ERROR:",
        error
      );

      return errorResponse(
        "Invalid webhook signature.",
        400
      );
    }

    /*
      Event processing
    */

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );

        break;
      }

      case "checkout.session.async_payment_succeeded": {
        await handleAsyncPaymentSucceeded(
          event.data.object as Stripe.Checkout.Session
        );

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );

        break;
      }

      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );

        break;
      }

      case "invoice.payment_failed": {
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );

        break;
      }

      default: {
        /*
          Stripe birçok event gönderir.
          Desteklenmeyen eventler hata
          üretmeden acknowledge edilir.
        */

        console.log(
          "SYRAVEN WEBHOOK EVENT IGNORED:",
          {
            eventId:
              event.id,
            eventType:
              event.type,
          }
        );

        break;
      }
    }

    return successResponse({
      received: true,
      configured: true,
      eventId:
        event.id,
      eventType:
        event.type,
    });
  } catch (error) {
    console.error(
      "SYRAVEN BILLING WEBHOOK ERROR:",
      error
    );

    return errorResponse(
      "Webhook processing failed.",
      500
    );
  }
}

/* ==================================================
   METHOD NOT ALLOWED
================================================== */

export async function GET() {
  return errorResponse(
    "Method not allowed.",
    405
  );
}