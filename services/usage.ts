/**
 * SYRAVEN Usage Service
 *
 * Enterprise-grade usage tracking, metering and analytics.
 *
 * Features:
 * - Usage event tracking
 * - Metric aggregation
 * - Time-based queries
 * - User usage summaries
 * - Project usage summaries
 * - Workspace usage summaries
 * - Custom dimensions
 * - Metadata support
 * - Period aggregation
 * - Usage limits compatibility
 * - In-memory implementation
 * - Strict TypeScript
 *
 * Production adapters can later include:
 * - PostgreSQL
 * - ClickHouse
 * - BigQuery
 * - Redis
 * - Kafka
 * - OpenTelemetry
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
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
  | "file_uploads"
  | "file_downloads"
  | "task_executions"
  | "custom";

export type UsagePeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom";

export type UsageGroupBy =
  | "metric"
  | "user"
  | "project"
  | "workspace"
  | "day"
  | "hour";

export interface UsageDimensions {
  userId?: string;

  projectId?: string;

  workspaceId?: string;

  organizationId?: string;

  sessionId?: string;

  agentId?: string;

  model?: string;

  provider?: string;

  region?: string;

  [key: string]: string | undefined;
}

export interface UsageEvent<
  TMetadata = Record<string, unknown>
> {
  id: string;

  metric: UsageMetric | string;

  quantity: number;

  timestamp: Date;

  dimensions: UsageDimensions;

  metadata?: TMetadata;
}

export interface RecordUsageInput<
  TMetadata = Record<string, unknown>
> {
  metric: UsageMetric | string;

  quantity?: number;

  timestamp?: Date;

  dimensions?: UsageDimensions;

  metadata?: TMetadata;
}

export interface UsageQuery {
  metric?: UsageMetric | string;

  metrics?: Array<UsageMetric | string>;

  userId?: string;

  projectId?: string;

  workspaceId?: string;

  organizationId?: string;

  start?: Date;

  end?: Date;

  limit?: number;

  offset?: number;
}

export interface UsageAggregate {
  metric: string;

  quantity: number;

  count: number;

  firstTimestamp?: Date;

  lastTimestamp?: Date;
}

export interface UsageSummary {
  totalQuantity: number;

  totalEvents: number;

  metrics: UsageAggregate[];

  start: Date;

  end: Date;
}

export interface UsageTimeSeriesPoint {
  timestamp: Date;

  quantity: number;

  count: number;
}

export interface UsageTimeSeries {
  metric?: string;

  period: UsagePeriod;

  start: Date;

  end: Date;

  points: UsageTimeSeriesPoint[];
}

export interface UsageGroupedResult {
  key: string;

  quantity: number;

  count: number;
}

export interface UsageListResult {
  events: UsageEvent[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface UsageStats {
  totalEvents: number;

  totalQuantity: number;

  uniqueMetrics: number;

  uniqueUsers: number;

  oldestEvent?: Date;

  newestEvent?: Date;
}

export interface UsageServiceOptions {
  maxEvents?: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class UsageServiceError
  extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "UsageServiceError";
  }
}

export class UsageValidationError
  extends UsageServiceError {
  readonly errors: string[];

  constructor(
    errors: string[]
  ) {
    super(
      errors.join(" ")
    );

    this.name =
      "UsageValidationError";

    this.errors =
      errors;
  }
}

export class UsageEventNotFoundError
  extends UsageServiceError {
  constructor(
    eventId: string
  ) {
    super(
      `Usage event not found: ${eventId}`
    );

    this.name =
      "UsageEventNotFoundError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_USAGE_LIST_LIMIT =
  100;

export const MAX_USAGE_LIST_LIMIT =
  1_000;

export const DEFAULT_MAX_USAGE_EVENTS =
  100_000;

export const MAX_USAGE_EVENTS =
  1_000_000;

/* -------------------------------------------------------------------------- */
/*                               USAGE SERVICE                                */
/* -------------------------------------------------------------------------- */

export class UsageService {
  private readonly events:
    UsageEvent[] = [];

  private readonly maxEvents:
    number;

  constructor(
    options: UsageServiceOptions = {}
  ) {
    this.maxEvents =
      normalizeMaxEvents(
        options.maxEvents
      );
  }

  /* ------------------------------------------------------------------------ */
  /*                                RECORDING                                 */
  /* ------------------------------------------------------------------------ */

  record<
    TMetadata = Record<string, unknown>
  >(
    input: RecordUsageInput<TMetadata>
  ): UsageEvent<TMetadata> {
    this.validateRecordInput(
      input
    );

    const event: UsageEvent<TMetadata> = {
      id:
        generateUsageEventId(),

      metric:
        normalizeMetric(
          input.metric
        ),

      quantity:
        normalizeQuantity(
          input.quantity
        ),

      timestamp:
        input.timestamp
          ? new Date(
              input.timestamp
            )
          : new Date(),

      dimensions:
        input.dimensions
          ? cloneDimensions(
              input.dimensions
            )
          : {},

      metadata:
        input.metadata ===
        undefined
          ? undefined
          : cloneValue(
              input.metadata
            ),
    };

    this.ensureCapacity();

    this.events.push(
      event as UsageEvent
    );

    return this.cloneEvent(
      event
    );
  }

  recordMany<
    TMetadata = Record<string, unknown>
  >(
    inputs: Array<
      RecordUsageInput<TMetadata>
    >
  ): Array<
    UsageEvent<TMetadata>
  > {
    if (
      !Array.isArray(
        inputs
      )
    ) {
      throw new UsageValidationError([
        "Usage inputs must be an array.",
      ]);
    }

    return inputs.map(
      (input) =>
        this.record(
          input
        )
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  READ                                    */
  /* ------------------------------------------------------------------------ */

  get(
    eventId: string
  ): UsageEvent | undefined {
    const event =
      this.events.find(
        (item) =>
          item.id === eventId
      );

    return event
      ? this.cloneEvent(
          event
        )
      : undefined;
  }

  require(
    eventId: string
  ): UsageEvent {
    const event =
      this.get(
        eventId
      );

    if (!event) {
      throw new UsageEventNotFoundError(
        eventId
      );
    }

    return event;
  }

  list(
    query: UsageQuery = {}
  ): UsageListResult {
    const limit =
      normalizeListLimit(
        query.limit
      );

    const offset =
      normalizeOffset(
        query.offset
      );

    const filtered =
      this.filterEvents(
        query
      );

    const total =
      filtered.length;

    const events =
      filtered
        .slice(
          offset,
          offset + limit
        )
        .map(
          (event) =>
            this.cloneEvent(
              event
            )
        );

    return {
      events,

      total,

      limit,

      offset,

      hasMore:
        offset + limit <
        total,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                               AGGREGATION                                */
  /* ------------------------------------------------------------------------ */

  getTotal(
    query: UsageQuery = {}
  ): number {
    return this.filterEvents(
      query
    ).reduce(
      (
        total,
        event
      ) =>
        total +
        event.quantity,
      0
    );
  }

  count(
    query: UsageQuery = {}
  ): number {
    return this.filterEvents(
      query
    ).length;
  }

  summarize(
    query: UsageQuery = {}
  ): UsageSummary {
    const events =
      this.filterEvents(
        query
      );

    const metricMap =
      new Map<
        string,
        UsageAggregate
      >();

    let totalQuantity =
      0;

    for (
      const event of events
    ) {
      totalQuantity +=
        event.quantity;

      const existing =
        metricMap.get(
          event.metric
        );

      if (!existing) {
        metricMap.set(
          event.metric,
          {
            metric:
              event.metric,

            quantity:
              event.quantity,

            count: 1,

            firstTimestamp:
              new Date(
                event.timestamp
              ),

            lastTimestamp:
              new Date(
                event.timestamp
              ),
          }
        );

        continue;
      }

      existing.quantity +=
        event.quantity;

      existing.count +=
        1;

      if (
        existing.firstTimestamp &&
        event.timestamp <
          existing.firstTimestamp
      ) {
        existing.firstTimestamp =
          new Date(
            event.timestamp
          );
      }

      if (
        existing.lastTimestamp &&
        event.timestamp >
          existing.lastTimestamp
      ) {
        existing.lastTimestamp =
          new Date(
            event.timestamp
          );
      }
    }

    const now =
      new Date();

    const start =
      query.start
        ? new Date(
            query.start
          )
        : events.length > 0
          ? new Date(
              events[
                events.length - 1
              ].timestamp
            )
          : now;

    const end =
      query.end
        ? new Date(
            query.end
          )
        : events.length > 0
          ? new Date(
              events[0].timestamp
            )
          : now;

    return {
      totalQuantity,

      totalEvents:
        events.length,

      metrics:
        Array.from(
          metricMap.values()
        )
          .sort(
            (a, b) =>
              b.quantity -
              a.quantity
          )
          .map(
            (aggregate) => ({
              ...aggregate,

              firstTimestamp:
                aggregate.firstTimestamp
                  ? new Date(
                      aggregate.firstTimestamp
                    )
                  : undefined,

              lastTimestamp:
                aggregate.lastTimestamp
                  ? new Date(
                      aggregate.lastTimestamp
                    )
                  : undefined,
            })
          ),

      start,

      end,
    };
  }

  aggregateBy(
    groupBy: UsageGroupBy,
    query: UsageQuery = {}
  ): UsageGroupedResult[] {
    const groups =
      new Map<
        string,
        UsageGroupedResult
      >();

    const events =
      this.filterEvents(
        query
      );

    for (
      const event of events
    ) {
      const key =
        getGroupKey(
          event,
          groupBy
        );

      const existing =
        groups.get(
          key
        );

      if (
        existing
      ) {
        existing.quantity +=
          event.quantity;

        existing.count +=
          1;
      } else {
        groups.set(
          key,
          {
            key,

            quantity:
              event.quantity,

            count: 1,
          }
        );
      }
    }

    return Array.from(
      groups.values()
    ).sort(
      (a, b) =>
        b.quantity -
        a.quantity
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              TIME SERIES                                 */
  /* ------------------------------------------------------------------------ */

  getTimeSeries(
    period: UsagePeriod,
    query: UsageQuery = {}
  ): UsageTimeSeries {
    const events =
      this.filterEvents(
        query
      );

    const buckets =
      new Map<
        string,
        UsageTimeSeriesPoint
      >();

    for (
      const event of events
    ) {
      const bucket =
        getPeriodStart(
          event.timestamp,
          period
        );

      const key =
        bucket.toISOString();

      const existing =
        buckets.get(
          key
        );

      if (
        existing
      ) {
        existing.quantity +=
          event.quantity;

        existing.count +=
          1;
      } else {
        buckets.set(
          key,
          {
            timestamp:
              bucket,

            quantity:
              event.quantity,

            count: 1,
          }
        );
      }
    }

    const now =
      new Date();

    const start =
      query.start
        ? new Date(
            query.start
          )
        : events.length > 0
          ? new Date(
              events[
                events.length - 1
              ].timestamp
            )
          : now;

    const end =
      query.end
        ? new Date(
            query.end
          )
        : events.length > 0
          ? new Date(
              events[0].timestamp
            )
          : now;

    return {
      metric:
        query.metric,

      period,

      start,

      end,

      points:
        Array.from(
          buckets.values()
        )
          .sort(
            (a, b) =>
              a.timestamp.getTime() -
              b.timestamp.getTime()
          )
          .map(
            (point) => ({
              ...point,

              timestamp:
                new Date(
                  point.timestamp
                ),
            })
          ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                 STATS                                    */
  /* ------------------------------------------------------------------------ */

  getStats(): UsageStats {
    const metrics =
      new Set<string>();

    const users =
      new Set<string>();

    let totalQuantity =
      0;

    let oldestEvent:
      Date | undefined;

    let newestEvent:
      Date | undefined;

    for (
      const event of this.events
    ) {
      metrics.add(
        event.metric
      );

      totalQuantity +=
        event.quantity;

      if (
        event.dimensions.userId
      ) {
        users.add(
          event.dimensions.userId
        );
      }

      if (
        !oldestEvent ||
        event.timestamp <
          oldestEvent
      ) {
        oldestEvent =
          event.timestamp;
      }

      if (
        !newestEvent ||
        event.timestamp >
          newestEvent
      ) {
        newestEvent =
          event.timestamp;
      }
    }

    return {
      totalEvents:
        this.events.length,

      totalQuantity,

      uniqueMetrics:
        metrics.size,

      uniqueUsers:
        users.size,

      oldestEvent:
        oldestEvent
          ? new Date(
              oldestEvent
            )
          : undefined,

      newestEvent:
        newestEvent
          ? new Date(
              newestEvent
            )
          : undefined,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                DELETE                                    */
  /* ------------------------------------------------------------------------ */

  delete(
    eventId: string
  ): boolean {
    const index =
      this.events.findIndex(
        (event) =>
          event.id === eventId
      );

    if (
      index === -1
    ) {
      return false;
    }

    this.events.splice(
      index,
      1
    );

    return true;
  }

  clear(
    query?: UsageQuery
  ): number {
    if (!query) {
      const count =
        this.events.length;

      this.events.length =
        0;

      return count;
    }

    const matchingIds =
      new Set(
        this.filterEvents(
          query
        ).map(
          (event) =>
            event.id
        )
      );

    if (
      matchingIds.size === 0
    ) {
      return 0;
    }

    let removed =
      0;

    for (
      let index =
        this.events.length - 1;
      index >= 0;
      index -= 1
    ) {
      const event =
        this.events[index];

      if (
        event &&
        matchingIds.has(
          event.id
        )
      ) {
        this.events.splice(
          index,
          1
        );

        removed += 1;
      }
    }

    return removed;
  }

  /* ------------------------------------------------------------------------ */
  /*                                INTERNAL                                  */
  /* ------------------------------------------------------------------------ */

  private filterEvents(
    query: UsageQuery
  ): UsageEvent[] {
    const metrics =
      query.metrics
        ? new Set(
            query.metrics.map(
              (metric) =>
                normalizeMetric(
                  metric
                )
            )
          )
        : undefined;

    const metric =
      query.metric
        ? normalizeMetric(
            query.metric
          )
        : undefined;

    const start =
      query.start
        ? normalizeDate(
            query.start,
            "Usage query start"
          )
        : undefined;

    const end =
      query.end
        ? normalizeDate(
            query.end,
            "Usage query end"
          )
        : undefined;

    if (
      start &&
      end &&
      start > end
    ) {
      throw new UsageValidationError([
        "Usage query start must be before end.",
      ]);
    }

    return this.events
      .filter(
        (event) => {
          if (
            metric &&
            event.metric !==
              metric
          ) {
            return false;
          }

          if (
            metrics &&
            !metrics.has(
              event.metric
            )
          ) {
            return false;
          }

          if (
            query.userId &&
            event.dimensions.userId !==
              query.userId
          ) {
            return false;
          }

          if (
            query.projectId &&
            event.dimensions.projectId !==
              query.projectId
          ) {
            return false;
          }

          if (
            query.workspaceId &&
            event.dimensions.workspaceId !==
              query.workspaceId
          ) {
            return false;
          }

          if (
            query.organizationId &&
            event.dimensions.organizationId !==
              query.organizationId
          ) {
            return false;
          }

          if (
            start &&
            event.timestamp <
              start
          ) {
            return false;
          }

          if (
            end &&
            event.timestamp >
              end
          ) {
            return false;
          }

          return true;
        }
      )
      .sort(
        (a, b) =>
          b.timestamp.getTime() -
          a.timestamp.getTime()
      );
  }

  private ensureCapacity(): void {
    while (
      this.events.length >=
      this.maxEvents
    ) {
      this.events.shift();
    }
  }

  private validateRecordInput<
    TMetadata
  >(
    input: RecordUsageInput<TMetadata>
  ): void {
    const errors: string[] =
      [];

    if (
      !input ||
      typeof input !==
        "object"
    ) {
      throw new UsageValidationError([
        "Usage input is required.",
      ]);
    }

    if (
      !input.metric ||
      typeof input.metric !==
        "string" ||
      !input.metric.trim()
    ) {
      errors.push(
        "Usage metric is required."
      );
    }

    const quantity =
      input.quantity ?? 1;

    if (
      !Number.isFinite(
        quantity
      )
    ) {
      errors.push(
        "Usage quantity must be a finite number."
      );
    }

    if (
      quantity < 0
    ) {
      errors.push(
        "Usage quantity cannot be negative."
      );
    }

    if (
      input.timestamp !==
      undefined
    ) {
      const timestamp =
        new Date(
          input.timestamp
        );

      if (
        Number.isNaN(
          timestamp.getTime()
        )
      ) {
        errors.push(
          "Usage timestamp must be a valid date."
        );
      }
    }

    if (
      input.dimensions !==
      undefined
    ) {
      if (
        typeof input.dimensions !==
          "object" ||
        input.dimensions === null ||
        Array.isArray(
          input.dimensions
        )
      ) {
        errors.push(
          "Usage dimensions must be an object."
        );
      }
    }

    if (
      errors.length > 0
    ) {
      throw new UsageValidationError(
        errors
      );
    }
  }

  private cloneEvent<
    TMetadata = Record<string, unknown>
  >(
    event: UsageEvent<TMetadata>
  ): UsageEvent<TMetadata> {
    return {
      ...event,

      timestamp:
        new Date(
          event.timestamp
        ),

      dimensions:
        cloneDimensions(
          event.dimensions
        ),

      metadata:
        event.metadata ===
        undefined
          ? undefined
          : cloneValue(
              event.metadata
            ),
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

function normalizeMetric(
  value: UsageMetric | string
): string {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new UsageValidationError([
      "Usage metric is required.",
    ]);
  }

  return value.trim();
}

function normalizeQuantity(
  value?: number
): number {
  const quantity =
    value ?? 1;

  if (
    !Number.isFinite(
      quantity
    ) ||
    quantity < 0
  ) {
    throw new UsageValidationError([
      "Usage quantity must be a non-negative finite number.",
    ]);
  }

  return quantity;
}

function normalizeDate(
  value: Date,
  label: string
): Date {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new UsageValidationError([
      `${label} must be a valid date.`,
    ]);
  }

  return date;
}

function normalizeListLimit(
  value?: number
): number {
  if (
    value === undefined
  ) {
    return DEFAULT_USAGE_LIST_LIMIT;
  }

  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    throw new UsageValidationError([
      "Usage list limit must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(
      value
    ),
    MAX_USAGE_LIST_LIMIT
  );
}

function normalizeOffset(
  value?: number
): number {
  if (
    value === undefined
  ) {
    return 0;
  }

  if (
    !Number.isFinite(
      value
    ) ||
    value < 0
  ) {
    throw new UsageValidationError([
      "Usage offset must be a non-negative finite number.",
    ]);
  }

  return Math.floor(
    value
  );
}

function normalizeMaxEvents(
  value?: number
): number {
  const maxEvents =
    value ??
    DEFAULT_MAX_USAGE_EVENTS;

  if (
    !Number.isFinite(
      maxEvents
    ) ||
    maxEvents <= 0
  ) {
    throw new UsageValidationError([
      "Maximum usage events must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(
      maxEvents
    ),
    MAX_USAGE_EVENTS
  );
}

function generateUsageEventId(): string {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `usage_${Date.now()}_${random}`;
}

function cloneDimensions(
  dimensions: UsageDimensions
): UsageDimensions {
  return {
    ...dimensions,
  };
}

function cloneValue<T>(
  value: T
): T {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    value instanceof Date
  ) {
    return new Date(
      value.getTime()
    ) as T;
  }

  if (
    value instanceof Uint8Array
  ) {
    return new Uint8Array(
      value
    ) as T;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      (item) =>
        cloneValue(
          item
        )
    ) as T;
  }

  if (
    typeof value ===
    "object"
  ) {
    return {
      ...(value as Record<
        string,
        unknown
      >),
    } as T;
  }

  return value;
}

function getGroupKey(
  event: UsageEvent,
  groupBy: UsageGroupBy
): string {
  switch (
    groupBy
  ) {
    case "metric":
      return event.metric;

    case "user":
      return (
        event.dimensions.userId ??
        "unknown"
      );

    case "project":
      return (
        event.dimensions.projectId ??
        "unknown"
      );

    case "workspace":
      return (
        event.dimensions.workspaceId ??
        "unknown"
      );

    case "day":
      return formatDay(
        event.timestamp
      );

    case "hour":
      return formatHour(
        event.timestamp
      );

    default:
      return "unknown";
  }
}

function getPeriodStart(
  date: Date,
  period: UsagePeriod
): Date {
  const value =
    new Date(
      date
    );

  switch (
    period
  ) {
    case "hour":
      value.setMinutes(
        0,
        0,
        0
      );
      return value;

    case "day":
      value.setHours(
        0,
        0,
        0,
        0
      );
      return value;

    case "week": {
      value.setHours(
        0,
        0,
        0,
        0
      );

      const day =
        value.getDay();

      const diff =
        day === 0
          ? -6
          : 1 - day;

      value.setDate(
        value.getDate() +
          diff
      );

      return value;
    }

    case "month":
      value.setDate(
        1
      );

      value.setHours(
        0,
        0,
        0,
        0
      );

      return value;

    case "year":
      value.setMonth(
        0,
        1
      );

      value.setHours(
        0,
        0,
        0,
        0
      );

      return value;

    case "custom":
    default:
      return value;
  }
}

function formatDay(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function formatHour(
  date: Date
): string {
  const day =
    formatDay(
      date
    );

  const hour =
    String(
      date.getHours()
    ).padStart(
      2,
      "0"
    );

  return `${day}T${hour}:00`;
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const usageService =
  new UsageService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function recordUsage<
  TMetadata = Record<string, unknown>
>(
  input: RecordUsageInput<TMetadata>
): UsageEvent<TMetadata> {
  return usageService.record(
    input
  );
}

export function recordUsageMany<
  TMetadata = Record<string, unknown>
>(
  inputs: Array<
    RecordUsageInput<TMetadata>
  >
): Array<
  UsageEvent<TMetadata>
> {
  return usageService.recordMany(
    inputs
  );
}

export function getUsageEvent(
  eventId: string
): UsageEvent | undefined {
  return usageService.get(
    eventId
  );
}

export function requireUsageEvent(
  eventId: string
): UsageEvent {
  return usageService.require(
    eventId
  );
}

export function listUsage(
  query?: UsageQuery
): UsageListResult {
  return usageService.list(
    query
  );
}

export function getUsageTotal(
  query?: UsageQuery
): number {
  return usageService.getTotal(
    query
  );
}

export function countUsage(
  query?: UsageQuery
): number {
  return usageService.count(
    query
  );
}

export function summarizeUsage(
  query?: UsageQuery
): UsageSummary {
  return usageService.summarize(
    query
  );
}

export function aggregateUsageBy(
  groupBy: UsageGroupBy,
  query?: UsageQuery
): UsageGroupedResult[] {
  return usageService.aggregateBy(
    groupBy,
    query
  );
}

export function getUsageTimeSeries(
  period: UsagePeriod,
  query?: UsageQuery
): UsageTimeSeries {
  return usageService.getTimeSeries(
    period,
    query
  );
}

export function getUsageStats(): UsageStats {
  return usageService.getStats();
}

export function deleteUsageEvent(
  eventId: string
): boolean {
  return usageService.delete(
    eventId
  );
}

export function clearUsage(
  query?: UsageQuery
): number {
  return usageService.clear(
    query
  );
}

export default usageService;