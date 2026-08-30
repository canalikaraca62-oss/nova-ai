/**
 * SYRAVEN Billing Types
 *
 * Shared billing domain contracts.
 *
 * Covers:
 * - Plans
 * - Subscriptions
 * - Usage
 * - Entitlements
 * - Billing permissions
 * - Customers
 * - Invoices
 * - Payments
 * - Checkout
 * - Billing events
 * - Enterprise billing metadata
 *
 * Strict TypeScript.
 */

/* -------------------------------------------------------------------------- */
/*                                   IDS                                      */
/* -------------------------------------------------------------------------- */

export type BillingPlanId = string;

export type BillingCustomerId = string;

export type BillingSubscriptionId = string;

export type BillingInvoiceId = string;

export type BillingPaymentId = string;

export type BillingUsageId = string;

export type BillingEventId = string;

export type BillingCurrency = string;

/* -------------------------------------------------------------------------- */
/*                              SUBSCRIPTIONS                                 */
/* -------------------------------------------------------------------------- */

export type BillingInterval =
  | "month"
  | "year";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  | "incomplete"
  | "incomplete_expired";

/* -------------------------------------------------------------------------- */
/*                                  PLANS                                     */
/* -------------------------------------------------------------------------- */

export interface BillingPlan {
  id: BillingPlanId;

  name: string;

  description?: string;

  active: boolean;

  priceMonthly: number;

  priceYearly?: number;

  currency: BillingCurrency;

  limits: Record<
    string,
    number
  >;

  features: string[];

  metadata?: Record<
    string,
    unknown
  >;

  createdAt?: Date;

  updatedAt?: Date;
}

export interface CreateBillingPlanInput {
  id: BillingPlanId;

  name: string;

  description?: string;

  active?: boolean;

  priceMonthly: number;

  priceYearly?: number;

  currency?: BillingCurrency;

  limits?: Record<
    string,
    number
  >;

  features?: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

export interface UpdateBillingPlanInput {
  name?: string;

  description?: string;

  active?: boolean;

  priceMonthly?: number;

  priceYearly?: number;

  currency?: BillingCurrency;

  limits?: Record<
    string,
    number
  >;

  features?: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              SUBSCRIPTION                                  */
/* -------------------------------------------------------------------------- */

export interface BillingSubscription {
  id: BillingSubscriptionId;

  userId: string;

  customerId?: BillingCustomerId;

  planId: BillingPlanId;

  status: SubscriptionStatus;

  interval: BillingInterval;

  currentPeriodStart: Date;

  currentPeriodEnd: Date;

  cancelAtPeriodEnd: boolean;

  cancelledAt?: Date;

  trialStart?: Date;

  trialEnd?: Date;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface CreateSubscriptionInput {
  userId: string;

  customerId?: BillingCustomerId;

  planId: BillingPlanId;

  interval?: BillingInterval;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface UpdateSubscriptionInput {
  planId?: BillingPlanId;

  status?: SubscriptionStatus;

  interval?: BillingInterval;

  cancelAtPeriodEnd?: boolean;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                                   USAGE                                    */
/* -------------------------------------------------------------------------- */

export type UsageMetric =
  | "requests"
  | "tokens"
  | "input_tokens"
  | "output_tokens"
  | "ai_generations"
  | "agent_executions"
  | "document_reads"
  | "storage_bytes"
  | "api_calls"
  | "messages"
  | "search_queries"
  | "voice_minutes"
  | "vision_requests"
  | "custom";

export interface BillingUsageRecord {
  id: BillingUsageId;

  userId: string;

  workspaceId?: string;

  metric: UsageMetric | string;

  quantity: number;

  timestamp: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface RecordUsageInput {
  userId: string;

  workspaceId?: string;

  metric: UsageMetric | string;

  quantity?: number;

  timestamp?: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface UsageSummary {
  userId: string;

  metric: string;

  used: number;

  limit: number | null;

  remaining: number | null;

  percentage: number | null;

  periodStart: Date;

  periodEnd: Date;
}

/* -------------------------------------------------------------------------- */
/*                               ENTITLEMENTS                                 */
/* -------------------------------------------------------------------------- */

export interface BillingPermission {
  allowed: boolean;

  reason?: string;

  limit?: number | null;

  used?: number;

  remaining?: number | null;

  retryAfter?: number;
}

export interface BillingEntitlement {
  key: string;

  enabled: boolean;

  limit?: number | null;

  usage?: number;

  remaining?: number | null;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                                CUSTOMERS                                   */
/* -------------------------------------------------------------------------- */

export interface BillingCustomer {
  userId: string;

  customerId?: BillingCustomerId;

  email?: string;

  name?: string;

  company?: string;

  metadata?: Record<
    string,
    unknown
  >;

  createdAt?: Date;

  updatedAt?: Date;
}

export interface CreateBillingCustomerInput {
  userId: string;

  email?: string;

  name?: string;

  company?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface UpdateBillingCustomerInput {
  email?: string;

  name?: string;

  company?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                                 INVOICES                                   */
/* -------------------------------------------------------------------------- */

export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "overdue";

export interface BillingInvoiceLine {
  id: string;

  description?: string;

  quantity: number;

  unitAmount: number;

  amount: number;

  currency: BillingCurrency;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface BillingInvoice {
  id: BillingInvoiceId;

  customerId: BillingCustomerId;

  subscriptionId?: BillingSubscriptionId;

  status: InvoiceStatus;

  currency: BillingCurrency;

  subtotal: number;

  tax: number;

  total: number;

  amountPaid: number;

  amountDue: number;

  dueDate?: Date;

  paidAt?: Date;

  periodStart?: Date;

  periodEnd?: Date;

  lines: BillingInvoiceLine[];

  metadata?: Record<
    string,
    unknown
  >;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                                 PAYMENTS                                   */
/* -------------------------------------------------------------------------- */

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "refunded"
  | "partially_refunded";

export type PaymentMethodType =
  | "card"
  | "bank_transfer"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "invoice"
  | "crypto"
  | "custom";

export interface BillingPayment {
  id: BillingPaymentId;

  customerId: BillingCustomerId;

  invoiceId?: BillingInvoiceId;

  status: PaymentStatus;

  method?: PaymentMethodType;

  amount: number;

  currency: BillingCurrency;

  failureReason?: string;

  providerPaymentId?: string;

  metadata?: Record<
    string,
    unknown
  >;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                                 CHECKOUT                                   */
/* -------------------------------------------------------------------------- */

export interface BillingCheckoutInput {
  userId: string;

  planId: BillingPlanId;

  interval: BillingInterval;

  successUrl: string;

  cancelUrl: string;

  customerEmail?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface BillingCheckoutSession {
  id: string;

  url: string;

  expiresAt?: Date;

  customerId?: BillingCustomerId;

  subscriptionId?: BillingSubscriptionId;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              BILLING EVENTS                                */
/* -------------------------------------------------------------------------- */

export type BillingEventType =
  | "customer.created"
  | "customer.updated"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "subscription.deleted"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "payment.succeeded"
  | "payment.failed"
  | "usage.recorded"
  | "usage.limit_reached"
  | "plan.changed"
  | "checkout.completed"
  | "unknown";

export interface BillingEvent<
  TData = unknown
> {
  id: BillingEventId;

  type: BillingEventType | string;

  data: TData;

  timestamp: Date;

  provider?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              BILLING PROVIDER                              */
/* -------------------------------------------------------------------------- */

export type BillingProviderName =
  | "stripe"
  | "paddle"
  | "adyen"
  | "paypal"
  | "internal"
  | "custom";

export interface BillingProviderConfig {
  provider: BillingProviderName | string;

  enabled: boolean;

  environment?: "development" | "test" | "production";

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              SERVICE OPTIONS                               */
/* -------------------------------------------------------------------------- */

export interface BillingServiceOptions {
  defaultPlanId?: BillingPlanId;

  autoCreateFreeSubscription?: boolean;

  usageRetentionDays?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                              BILLING STATS                                 */
/* -------------------------------------------------------------------------- */

export interface BillingStats {
  totalCustomers: number;

  totalSubscriptions: number;

  activeSubscriptions: number;

  canceledSubscriptions: number;

  trialingSubscriptions: number;

  monthlyRecurringRevenue?: number;

  annualRecurringRevenue?: number;

  currency?: BillingCurrency;

  generatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                              TYPE GUARDS                                   */
/* -------------------------------------------------------------------------- */

export function isActiveSubscription(
  subscription: BillingSubscription
): boolean {
  return (
    subscription.status === "active" ||
    subscription.status === "trialing"
  );
}

export function isUnlimitedLimit(
  limit: number | null | undefined
): boolean {
  return limit === -1;
}

export function hasBillingPermission(
  permission: BillingPermission
): permission is BillingPermission & {
  allowed: true;
} {
  return permission.allowed === true;
}

export function isBillingEvent<T = unknown>(
  value: unknown
): value is BillingEvent<T> {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Partial<BillingEvent<T>>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    candidate.timestamp instanceof Date
  );
}

/* -------------------------------------------------------------------------- */
/*                              TYPE ALIASES                                  */
/* -------------------------------------------------------------------------- */

/**
 * Backwards-compatible aliases.
 * These match services/billing.ts naming.
 */

export type PlanId =
  BillingPlanId;

export type Subscription =
  BillingSubscription;

export type UsageRecord =
  BillingUsageRecord;