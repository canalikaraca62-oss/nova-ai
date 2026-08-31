/**
 * SYRAVEN Usage Service
 *
 * Enterprise-grade usage tracking, metering and analytics.
 *
 * Strict TypeScript compatible:
 * - strict
 * - noImplicitAny
 * - strictNullChecks
 * - noUncheckedIndexedAccess
 * - exactOptionalPropertyTypes
 * - useUnknownInCatchVariables
 *
 * Features:
 * - Usage event tracking
 * - Batch recording
 * - Metric aggregation
 * - Time-based queries
 * - User/project/workspace summaries
 * - Custom dimensions
 * - Metadata support
 * - Period aggregation
 * - Time series
 * - Capacity limits
 * - Safe cloning
 * - Strict validation
 * - In-memory implementation
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

  metric: string;

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

export class UsageServiceError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "UsageServiceError";

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

export class UsageValidationError extends UsageServiceError {
  readonly errors: readonly string[];

  constructor(errors: string[]) {
    super(errors.join(" "));

    this.name = "UsageValidationError";

    this.errors = [...errors];

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

export class UsageEventNotFoundError extends UsageServiceError {
  constructor(eventId: string) {
    super(
      `Usage event not found: ${eventId}`
    );

    this.name = "UsageEventNotFoundError";

    Object.setPrototypeOf(
      this,
      new.target.prototype
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_USAGE_LIST_LIMIT = 100;

export const MAX_USAGE_LIST_LIMIT = 1_000;

export const DEFAULT_MAX_USAGE_EVENTS = 100_000;

export const MAX_USAGE_EVENTS = 1_000_000;

/* -------------------------------------------------------------------------- */
/*                               USAGE SERVICE                                */
/* -------------------------------------------------------------------------- */

export class UsageService {
  private readonly events: UsageEvent[] = [];

  private readonly maxEvents: number;

  constructor(
    options: UsageServiceOptions = {}
  ) {
    this.maxEvents = normalizeMaxEvents(
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
    this.validateRecordInput(input);

    this.ensureCapacity();

    const timestamp =
      input.timestamp !== undefined
        ? normalizeDate(
            input.timestamp,
            "Usage timestamp"
          )
        : new Date();

    const event: UsageEvent<TMetadata> = {
      id: generateUsageEventId(),

      metric: normalizeMetric(
        input.metric
      ),

      quantity: normalizeQuantity(
        input.quantity
      ),

      timestamp,

      dimensions: cloneDimensions(
        input.dimensions ?? {}
      ),
    };

    if (input.metadata !== undefined) {
      event.metadata = cloneValue(
        input.metadata
      );
    }

    this.events.push(
      event as UsageEvent
    );

    return this.cloneEvent(event);
  }

  recordMany<
    TMetadata = Record<string, unknown>
  >(
    inputs: readonly RecordUsageInput<TMetadata>[]
  ): UsageEvent<TMetadata>[] {
    if (!Array.isArray(inputs)) {
      throw new UsageValidationError([
        "Usage inputs must be an array.",
      ]);
    }

    const results: UsageEvent<TMetadata>[] = [];

    for (const input of inputs) {
      results.push(
        this.record(input)
      );
    }

    return results;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  READ                                    */
  /* ------------------------------------------------------------------------ */

  get(
    eventId: string
  ): UsageEvent | undefined {
    validateEventId(eventId);

    const event = this.events.find(
      (item) => item.id === eventId
    );

    if (!event) {
      return undefined;
    }

    return this.cloneEvent(event);
  }

  require(
    eventId: string
  ): UsageEvent {
    const event = this.get(eventId);

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
    const limit = normalizeListLimit(
      query.limit
    );

    const offset = normalizeOffset(
      query.offset
    );

    const filtered = this.filterEvents(
      query
    );

    const total = filtered.length;

    const events = filtered
      .slice(
        offset,
        offset + limit
      )
      .map((event) =>
        this.cloneEvent(event)
      );

    return {
      events,
      total,
      limit,
      offset,
      hasMore:
        offset + limit < total,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                               AGGREGATION                                */
  /* ------------------------------------------------------------------------ */

  getTotal(
    query: UsageQuery = {}
  ): number {
    let total = 0;

    for (const event of this.filterEvents(query)) {
      total += event.quantity;
    }

    return total;
  }

  count(
    query: UsageQuery = {}
  ): number {
    return this.filterEvents(query).length;
  }

  summarize(
    query: UsageQuery = {}
  ): UsageSummary {
    const events = this.filterEvents(query);

    const metricMap = new Map<
      string,
      UsageAggregate
    >();

    let totalQuantity = 0;

    for (const event of events) {
      totalQuantity += event.quantity;

      const existing = metricMap.get(
        event.metric
      );

      if (!existing) {
        metricMap.set(event.metric, {
          metric: event.metric,
          quantity: event.quantity,
          count: 1,
          firstTimestamp: new Date(
            event.timestamp.getTime()
          ),
          lastTimestamp: new Date(
            event.timestamp.getTime()
          ),
        });

        continue;
      }

      existing.quantity += event.quantity;
      existing.count += 1;

      if (
        existing.firstTimestamp !== undefined &&
        event.timestamp < existing.firstTimestamp
      ) {
        existing.firstTimestamp = new Date(
          event.timestamp.getTime()
        );
      }

      if (
        existing.lastTimestamp !== undefined &&
        event.timestamp > existing.lastTimestamp
      ) {
        existing.lastTimestamp = new Date(
          event.timestamp.getTime()
        );
      }
    }

    const range = resolveQueryRange(
      events,
      query
    );

    const metrics = Array.from(
      metricMap.values()
    )
      .sort(
        (a, b) =>
          b.quantity - a.quantity
      )
      .map((aggregate) => {
        const result: UsageAggregate = {
          metric: aggregate.metric,
          quantity: aggregate.quantity,
          count: aggregate.count,
        };

        if (
          aggregate.firstTimestamp !== undefined
        ) {
          result.firstTimestamp = new Date(
            aggregate.firstTimestamp.getTime()
          );
        }

        if (
          aggregate.lastTimestamp !== undefined
        ) {
          result.lastTimestamp = new Date(
            aggregate.lastTimestamp.getTime()
          );
        }

        return result;
      });

    return {
      totalQuantity,
      totalEvents: events.length,
      metrics,
      start: range.start,
      end: range.end,
    };
  }

  aggregateBy(
    groupBy: UsageGroupBy,
    query: UsageQuery = {}
  ): UsageGroupedResult[] {
    const groups = new Map<
      string,
      UsageGroupedResult
    >();

    const events = this.filterEvents(
      query
    );

    for (const event of events) {
      const key = getGroupKey(
        event,
        groupBy
      );

      const existing = groups.get(key);

      if (existing) {
        existing.quantity += event.quantity;
        existing.count += 1;

        continue;
      }

      groups.set(key, {
        key,
        quantity: event.quantity,
        count: 1,
      });
    }

    return Array.from(groups.values())
      .sort(
        (a, b) =>
          b.quantity - a.quantity
      )
      .map((item) => ({
        key: item.key,
        quantity: item.quantity,
        count: item.count,
      }));
  }

  /* ------------------------------------------------------------------------ */
  /*                              TIME SERIES                                 */
  /* ------------------------------------------------------------------------ */

  getTimeSeries(
    period: UsagePeriod,
    query: UsageQuery = {}
  ): UsageTimeSeries {
    const events = this.filterEvents(
      query
    );

    const buckets = new Map<
      string,
      UsageTimeSeriesPoint
    >();

    for (const event of events) {
      const bucket = getPeriodStart(
        event.timestamp,
        period
      );

      const key = bucket.toISOString();

      const existing = buckets.get(key);

      if (existing) {
        existing.quantity += event.quantity;
        existing.count += 1;

        continue;
      }

      buckets.set(key, {
        timestamp: bucket,
        quantity: event.quantity,
        count: 1,
      });
    }

    const range = resolveQueryRange(
      events,
      query
    );

    const result: UsageTimeSeries = {
      period,
      start: range.start,
      end: range.end,
      points: Array.from(
        buckets.values()
      )
        .sort(
          (a, b) =>
            a.timestamp.getTime() -
            b.timestamp.getTime()
        )
        .map((point) => ({
          timestamp: new Date(
            point.timestamp.getTime()
          ),
          quantity: point.quantity,
          count: point.count,
        })),
    };

    if (query.metric !== undefined) {
      result.metric = normalizeMetric(
        query.metric
      );
    }

    return result;
  }

  /* ------------------------------------------------------------------------ */
  /*                                 STATS                                    */
  /* ------------------------------------------------------------------------ */

  getStats(): UsageStats {
    const metrics = new Set<string>();
    const users = new Set<string>();

    let totalQuantity = 0;

    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;

    for (const event of this.events) {
      metrics.add(event.metric);

      totalQuantity += event.quantity;

      const userId =
        event.dimensions.userId;

      if (
        userId !== undefined &&
        userId.length > 0
      ) {
        users.add(userId);
      }

      if (
        oldestEvent === undefined ||
        event.timestamp < oldestEvent
      ) {
        oldestEvent = event.timestamp;
      }

      if (
        newestEvent === undefined ||
        event.timestamp > newestEvent
      ) {
        newestEvent = event.timestamp;
      }
    }

    const result: UsageStats = {
      totalEvents: this.events.length,
      totalQuantity,
      uniqueMetrics: metrics.size,
      uniqueUsers: users.size,
    };

    if (oldestEvent !== undefined) {
      result.oldestEvent = new Date(
        oldestEvent.getTime()
      );
    }

    if (newestEvent !== undefined) {
      result.newestEvent = new Date(
        newestEvent.getTime()
      );
    }

    return result;
  }

  /* ------------------------------------------------------------------------ */
  /*                                DELETE                                    */
  /* ------------------------------------------------------------------------ */

  delete(
    eventId: string
  ): boolean {
    validateEventId(eventId);

    const index =
      this.events.findIndex(
        (event) =>
          event.id === eventId
      );

    if (index < 0) {
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
    if (query === undefined) {
      const count = this.events.length;

      this.events.length = 0;

      return count;
    }

    const matchingIds = new Set(
      this.filterEvents(query).map(
        (event) => event.id
      )
    );

    if (matchingIds.size === 0) {
      return 0;
    }

    let removed = 0;

    for (
      let index = this.events.length - 1;
      index >= 0;
      index -= 1
    ) {
      const event = this.events[index];

      if (
        event !== undefined &&
        matchingIds.has(event.id)
      ) {
        this.events.splice(index, 1);

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
    const metric =
      query.metric !== undefined
        ? normalizeMetric(query.metric)
        : undefined;

    const metrics =
      query.metrics !== undefined
        ? new Set(
            query.metrics.map((item) =>
              normalizeMetric(item)
            )
          )
        : undefined;

    const start =
      query.start !== undefined
        ? normalizeDate(
            query.start,
            "Usage query start"
          )
        : undefined;

    const end =
      query.end !== undefined
        ? normalizeDate(
            query.end,
            "Usage query end"
          )
        : undefined;

    if (
      start !== undefined &&
      end !== undefined &&
      start.getTime() > end.getTime()
    ) {
      throw new UsageValidationError([
        "Usage query start must be before or equal to end.",
      ]);
    }

    return this.events
      .filter((event) => {
        if (
          metric !== undefined &&
          event.metric !== metric
        ) {
          return false;
        }

        if (
          metrics !== undefined &&
          !metrics.has(event.metric)
        ) {
          return false;
        }

        if (
          query.userId !== undefined &&
          event.dimensions.userId !==
            query.userId
        ) {
          return false;
        }

        if (
          query.projectId !== undefined &&
          event.dimensions.projectId !==
            query.projectId
        ) {
          return false;
        }

        if (
          query.workspaceId !== undefined &&
          event.dimensions.workspaceId !==
            query.workspaceId
        ) {
          return false;
        }

        if (
          query.organizationId !== undefined &&
          event.dimensions.organizationId !==
            query.organizationId
        ) {
          return false;
        }

        if (
          start !== undefined &&
          event.timestamp < start
        ) {
          return false;
        }

        if (
          end !== undefined &&
          event.timestamp > end
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          b.timestamp.getTime() -
          a.timestamp.getTime()
      );
  }

  private ensureCapacity(): void {
    if (
      this.events.length <
      this.maxEvents
    ) {
      return;
    }

    const removeCount =
      this.events.length -
      this.maxEvents +
      1;

    if (removeCount > 0) {
      this.events.splice(
        0,
        removeCount
      );
    }
  }

  private validateRecordInput<
    TMetadata
  >(
    input: RecordUsageInput<TMetadata>
  ): void {
    if (
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new UsageValidationError([
        "Usage input is required.",
      ]);
    }

    const errors: string[] = [];

    if (
      typeof input.metric !== "string" ||
      input.metric.trim().length === 0
    ) {
      errors.push(
        "Usage metric is required."
      );
    }

    if (
      input.quantity !== undefined &&
      (
        !Number.isFinite(input.quantity) ||
        input.quantity < 0
      )
    ) {
      errors.push(
        "Usage quantity must be a non-negative finite number."
      );
    }

    if (
      input.timestamp !== undefined
    ) {
      const timestamp = new Date(
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
      input.dimensions !== undefined
    ) {
      if (
        input.dimensions === null ||
        typeof input.dimensions !==
          "object" ||
        Array.isArray(
          input.dimensions
        )
      ) {
        errors.push(
          "Usage dimensions must be an object."
        );
      } else {
        for (
          const [
            key,
            value,
          ] of Object.entries(
            input.dimensions
          )
        ) {
          if (
            typeof key !== "string" ||
            key.trim().length === 0
          ) {
            errors.push(
              "Usage dimension keys must be non-empty strings."
            );
          }

          if (
            value !== undefined &&
            typeof value !== "string"
          ) {
            errors.push(
              `Usage dimension "${key}" must be a string.`
            );
          }
        }
      }
    }

    if (errors.length > 0) {
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
    const cloned: UsageEvent<TMetadata> = {
      id: event.id,
      metric: event.metric,
      quantity: event.quantity,
      timestamp: new Date(
        event.timestamp.getTime()
      ),
      dimensions: cloneDimensions(
        event.dimensions
      ),
    };

    if (
      event.metadata !== undefined
    ) {
      cloned.metadata = cloneValue(
        event.metadata
      );
    }

    return cloned;
  }
}

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

function normalizeMetric(
  value: UsageMetric | string
): string {
  if (
    typeof value !== "string"
  ) {
    throw new UsageValidationError([
      "Usage metric is required.",
    ]);
  }

  const metric = value.trim();

  if (metric.length === 0) {
    throw new UsageValidationError([
      "Usage metric is required.",
    ]);
  }

  return metric;
}

function normalizeQuantity(
  value?: number
): number {
  const quantity = value ?? 1;

  if (
    !Number.isFinite(quantity) ||
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
  if (
    !(value instanceof Date)
  ) {
    throw new UsageValidationError([
      `${label} must be a Date instance.`,
    ]);
  }

  const timestamp = value.getTime();

  if (Number.isNaN(timestamp)) {
    throw new UsageValidationError([
      `${label} must be a valid date.`,
    ]);
  }

  return new Date(timestamp);
}

function normalizeListLimit(
  value?: number
): number {
  if (value === undefined) {
    return DEFAULT_USAGE_LIST_LIMIT;
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new UsageValidationError([
      "Usage list limit must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(value),
    MAX_USAGE_LIST_LIMIT
  );
}

function normalizeOffset(
  value?: number
): number {
  if (value === undefined) {
    return 0;
  }

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new UsageValidationError([
      "Usage offset must be a non-negative finite number.",
    ]);
  }

  return Math.floor(value);
}

function normalizeMaxEvents(
  value?: number
): number {
  const maxEvents =
    value ?? DEFAULT_MAX_USAGE_EVENTS;

  if (
    !Number.isFinite(maxEvents) ||
    maxEvents <= 0
  ) {
    throw new UsageValidationError([
      "Maximum usage events must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(maxEvents),
    MAX_USAGE_EVENTS
  );
}

function validateEventId(
  eventId: string
): void {
  if (
    typeof eventId !== "string" ||
    eventId.trim().length === 0
  ) {
    throw new UsageValidationError([
      "Usage event ID is required.",
    ]);
  }
}

function generateUsageEventId(): string {
  const timestamp = Date.now()
    .toString(36);

  const random =
    typeof globalThis.crypto !==
      "undefined" &&
    typeof globalThis.crypto.randomUUID ===
      "function"
      ? globalThis.crypto
          .randomUUID()
          .replace(/-/g, "")
      : createFallbackRandomId();

  return `usage_${timestamp}_${random}`;
}

function createFallbackRandomId(): string {
  const partOne = Math.random()
    .toString(36)
    .slice(2);

  const partTwo = Math.random()
    .toString(36)
    .slice(2);

  return `${partOne}${partTwo}`;
}

function cloneDimensions(
  dimensions: UsageDimensions
): UsageDimensions {
  const result: UsageDimensions = {};

  for (
    const [key, value] of Object.entries(
      dimensions
    )
  ) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
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

  if (value instanceof Date) {
    return new Date(
      value.getTime()
    ) as T;
  }

  if (value instanceof Uint8Array) {
    return new Uint8Array(
      value
    ) as T;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      cloneValue(item)
    ) as T;
  }

  if (
    typeof value === "object"
  ) {
    const result: Record<
      string,
      unknown
    > = {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      result[key] = cloneValue(item);
    }

    return result as T;
  }

  return value;
}

function getGroupKey(
  event: UsageEvent,
  groupBy: UsageGroupBy
): string {
  switch (groupBy) {
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

    default: {
      const exhaustiveCheck: never =
        groupBy;

      return exhaustiveCheck;
    }
  }
}

function getPeriodStart(
  date: Date,
  period: UsagePeriod
): Date {
  const value = new Date(
    date.getTime()
  );

  switch (period) {
    case "hour":
      value.setMinutes(0, 0, 0);
      return value;

    case "day":
      value.setHours(0, 0, 0, 0);
      return value;

    case "week": {
      value.setHours(0, 0, 0, 0);

      const day = value.getDay();

      const diff =
        day === 0
          ? -6
          : 1 - day;

      value.setDate(
        value.getDate() + diff
      );

      return value;
    }

    case "month":
      value.setDate(1);
      value.setHours(0, 0, 0, 0);

      return value;

    case "year":
      value.setMonth(0, 1);
      value.setHours(0, 0, 0, 0);

      return value;

    case "custom":
      return value;

    default: {
      const exhaustiveCheck: never =
        period;

      return exhaustiveCheck;
    }
  }
}

function formatDay(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatHour(
  date: Date
): string {
  const day = formatDay(date);

  const hour = String(
    date.getHours()
  ).padStart(2, "0");

  return `${day}T${hour}:00`;
}

function resolveQueryRange(
  events: readonly UsageEvent[],
  query: UsageQuery
): {
  start: Date;
  end: Date;
} {
  const explicitStart =
    query.start !== undefined
      ? normalizeDate(
          query.start,
          "Usage query start"
        )
      : undefined;

  const explicitEnd =
    query.end !== undefined
      ? normalizeDate(
          query.end,
          "Usage query end"
        )
      : undefined;

  if (
    explicitStart !== undefined &&
    explicitEnd !== undefined
  ) {
    return {
      start: explicitStart,
      end: explicitEnd,
    };
  }

  if (events.length === 0) {
    const now = new Date();

    return {
      start:
        explicitStart ??
        new Date(now.getTime()),

      end:
        explicitEnd ??
        new Date(now.getTime()),
    };
  }

  let oldest = events[0]?.timestamp;
  let newest = events[0]?.timestamp;

  if (
    oldest === undefined ||
    newest === undefined
  ) {
    const now = new Date();

    return {
      start:
        explicitStart ??
        new Date(now.getTime()),

      end:
        explicitEnd ??
        new Date(now.getTime()),
    };
  }

  for (const event of events) {
    if (event.timestamp < oldest) {
      oldest = event.timestamp;
    }

    if (event.timestamp > newest) {
      newest = event.timestamp;
    }
  }

  return {
    start:
      explicitStart ??
      new Date(oldest.getTime()),

    end:
      explicitEnd ??
      new Date(newest.getTime()),
  };
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
  return usageService.record(input);
}

export function recordUsageMany<
  TMetadata = Record<string, unknown>
>(
  inputs: readonly RecordUsageInput<TMetadata>[]
): UsageEvent<TMetadata>[] {
  return usageService.recordMany(inputs);
}

export function getUsageEvent(
  eventId: string
): UsageEvent | undefined {
  return usageService.get(eventId);
}

export function requireUsageEvent(
  eventId: string
): UsageEvent {
  return usageService.require(eventId);
}

export function listUsage(
  query: UsageQuery = {}
): UsageListResult {
  return usageService.list(query);
}

export function getUsageTotal(
  query: UsageQuery = {}
): number {
  return usageService.getTotal(query);
}

export function countUsage(
  query: UsageQuery = {}
): number {
  return usageService.count(query);
}

export function summarizeUsage(
  query: UsageQuery = {}
): UsageSummary {
  return usageService.summarize(query);
}

export function aggregateUsageBy(
  groupBy: UsageGroupBy,
  query: UsageQuery = {}
): UsageGroupedResult[] {
  return usageService.aggregateBy(
    groupBy,
    query
  );
}

export function getUsageTimeSeries(
  period: UsagePeriod,
  query: UsageQuery = {}
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
  return usageService.delete(eventId);
}

export function clearUsage(
  query?: UsageQuery
): number {
  return usageService.clear(query);
}

export default usageService;