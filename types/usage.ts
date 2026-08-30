/**
 * SYRAVEN Usage Types
 *
 * Shared usage tracking and analytics contracts.
 *
 * Supports:
 * - Usage events
 * - Usage metrics
 * - Aggregation
 * - Period summaries
 * - Limits
 * - Quotas
 * - Cost tracking
 * - AI token usage
 * - API usage
 * - Storage usage
 * - Feature usage
 * - Billing integration
 * - Analytics
 */

/* -------------------------------------------------------------------------- */
/*                                METRICS                                     */
/* -------------------------------------------------------------------------- */

export type UsageMetric =
  | "requests"
  | "api_calls"
  | "tokens"
  | "input_tokens"
  | "output_tokens"
  | "ai_generations"
  | "agent_executions"
  | "document_reads"
  | "storage_bytes"
  | "messages"
  | "searches"
  | "uploads"
  | "downloads"
  | "voice_minutes"
  | "vision_requests"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              PERIOD TYPES                                  */
/* -------------------------------------------------------------------------- */

export type UsagePeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              EVENT TYPES                                   */
/* -------------------------------------------------------------------------- */

export type UsageEventType =
  | "recorded"
  | "consumed"
  | "adjusted"
  | "refunded"
  | "reset";

/* -------------------------------------------------------------------------- */
/*                              USAGE EVENT                                   */
/* -------------------------------------------------------------------------- */

export interface UsageEvent {
  id: string;

  userId: string;

  metric: UsageMetric | string;

  quantity: number;

  eventType: UsageEventType;

  timestamp: Date;

  source?: string;

  resourceId?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              USAGE RECORD                                  */
/* -------------------------------------------------------------------------- */

export interface UsageRecord {
  id: string;

  userId: string;

  metric: UsageMetric | string;

  quantity: number;

  timestamp: Date;

  source?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                           CREATE USAGE INPUT                               */
/* -------------------------------------------------------------------------- */

export interface CreateUsageInput {
  userId: string;

  metric: UsageMetric | string;

  quantity?: number;

  timestamp?: Date;

  source?: string;

  resourceId?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            USAGE PERIOD                                    */
/* -------------------------------------------------------------------------- */

export interface UsagePeriodRange {
  type: UsagePeriod;

  start: Date;

  end: Date;
}

/* -------------------------------------------------------------------------- */
/*                            USAGE SUMMARY                                   */
/* -------------------------------------------------------------------------- */

export interface UsageSummary {
  userId: string;

  metric: UsageMetric | string;

  used: number;

  limit: number | null;

  remaining: number | null;

  percentage: number | null;

  periodStart: Date;

  periodEnd: Date;

  updatedAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                           USAGE AGGREGATION                                */
/* -------------------------------------------------------------------------- */

export interface UsageAggregation {
  metric: UsageMetric | string;

  total: number;

  count: number;

  average: number;

  minimum: number;

  maximum: number;

  periodStart: Date;

  periodEnd: Date;
}

/* -------------------------------------------------------------------------- */
/*                             USAGE LIMIT                                    */
/* -------------------------------------------------------------------------- */

export interface UsageLimit {
  metric: UsageMetric | string;

  limit: number | null;

  period: UsagePeriod;

  warningThreshold?: number;

  enabled: boolean;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             USAGE QUOTA                                    */
/* -------------------------------------------------------------------------- */

export interface UsageQuota {
  userId: string;

  metric: UsageMetric | string;

  limit: number | null;

  used: number;

  remaining: number | null;

  percentage: number | null;

  exceeded: boolean;

  periodStart: Date;

  periodEnd: Date;
}

/* -------------------------------------------------------------------------- */
/*                           USAGE PERMISSION                                 */
/* -------------------------------------------------------------------------- */

export interface UsagePermission {
  allowed: boolean;

  reason?: string;

  metric: UsageMetric | string;

  requested: number;

  used?: number;

  limit?: number | null;

  remaining?: number | null;
}

/* -------------------------------------------------------------------------- */
/*                              USAGE COST                                    */
/* -------------------------------------------------------------------------- */

export interface UsageCost {
  metric: UsageMetric | string;

  quantity: number;

  unitCost: number;

  totalCost: number;

  currency: string;

  timestamp?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                           USAGE COST SUMMARY                               */
/* -------------------------------------------------------------------------- */

export interface UsageCostSummary {
  userId: string;

  totalCost: number;

  currency: string;

  periodStart: Date;

  periodEnd: Date;

  costs: UsageCost[];
}

/* -------------------------------------------------------------------------- */
/*                            AI TOKEN USAGE                                  */
/* -------------------------------------------------------------------------- */

export interface TokenUsage {
  inputTokens: number;

  outputTokens: number;

  totalTokens: number;

  model?: string;

  provider?: string;

  timestamp?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             API USAGE                                      */
/* -------------------------------------------------------------------------- */

export interface ApiUsage {
  requests: number;

  successfulRequests: number;

  failedRequests: number;

  averageLatencyMs?: number;

  periodStart: Date;

  periodEnd: Date;
}

/* -------------------------------------------------------------------------- */
/*                           STORAGE USAGE                                    */
/* -------------------------------------------------------------------------- */

export interface StorageUsage {
  bytesUsed: number;

  bytesLimit?: number | null;

  remainingBytes?: number | null;

  fileCount?: number;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                           USAGE LIST OPTIONS                               */
/* -------------------------------------------------------------------------- */

export interface UsageListOptions {
  userId?: string;

  metric?: UsageMetric | string;

  start?: Date;

  end?: Date;

  source?: string;

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                           USAGE LIST RESULT                                */
/* -------------------------------------------------------------------------- */

export interface UsageListResult {
  records: UsageRecord[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                            USAGE STATISTICS                                */
/* -------------------------------------------------------------------------- */

export interface UsageStats {
  totalRecords: number;

  totalUsers: number;

  totalQuantity: number;

  metrics: Record<string, number>;

  periodStart?: Date;

  periodEnd?: Date;
}

/* -------------------------------------------------------------------------- */
/*                         USAGE SERVICE OPTIONS                              */
/* -------------------------------------------------------------------------- */

export interface UsageServiceOptions {
  defaultPeriod?: UsagePeriod;

  maxRecordsPerUser?: number;

  maxListLimit?: number;

  enableCostTracking?: boolean;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                           USAGE SERVICE STATE                              */
/* -------------------------------------------------------------------------- */

export interface UsageServiceState {
  totalRecords: number;

  totalUsers: number;

  metricsTracked: number;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                              CONSTANTS                                     */
/* -------------------------------------------------------------------------- */

export const DEFAULT_USAGE_LIST_LIMIT = 100;

export const MAX_USAGE_LIST_LIMIT = 1_000;

export const DEFAULT_USAGE_PERIOD: UsagePeriod =
  "month";

/**
 * A limit value of -1 means unlimited.
 */
export const UNLIMITED_USAGE = -1;

/* -------------------------------------------------------------------------- */
/*                          HELPER TYPE GUARDS                                */
/* -------------------------------------------------------------------------- */

export function isUnlimitedUsage(
  limit: number | null | undefined
): boolean {
  return limit === UNLIMITED_USAGE;
}

export function hasUsageLimit(
  limit: number | null | undefined
): limit is number {
  return (
    typeof limit === "number" &&
    limit >= 0
  );
}

export function isValidUsageQuantity(
  quantity: number
): boolean {
  return (
    Number.isFinite(quantity) &&
    quantity >= 0
  );
}