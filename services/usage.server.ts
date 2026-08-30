/**
 * SYRAVEN Usage Service
 *
 * Enterprise-grade server-side usage tracking,
 * aggregation, analytics and quota infrastructure.
 *
 * Features:
 * - Usage event tracking
 * - Typed usage metrics
 * - User / organization / project scopes
 * - Time range queries
 * - Aggregation
 * - Usage summaries
 * - Quota checks
 * - Atomic in-memory consumption
 * - Metric registration
 * - Retention cleanup
 * - Pagination
 * - Strict TypeScript
 *
 * Production adapters can later include:
 * - PostgreSQL
 * - ClickHouse
 * - TimescaleDB
 * - Redis
 * - BigQuery
 * - Kafka
 * - OpenTelemetry
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type UsageScopeType =
  | "user"
  | "organization"
  | "project"
  | "workspace"
  | "team"
  | "api_key"
  | "system";

export type UsageAggregation =
  | "sum"
  | "count"
  | "average"
  | "minimum"
  | "maximum";

export type UsagePeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom";

export type UsageMetricName =
  | "requests"
  | "api_calls"
  | "tokens"
  | "input_tokens"
  | "output_tokens"
  | "ai_generations"
  | "agent_executions"
  | "document_reads"
  | "document_pages"
  | "storage_bytes"
  | "storage_objects"
  | "messages"
  | "projects"
  | "tasks"
  | "search_queries"
  | "integrations"
  | "uploads"
  | "downloads"
  | "compute_ms"
  | "custom";

export interface UsageMetricDefinition {
  name: string;

  description?: string;

  aggregation: UsageAggregation;

  unit?: string;

  active: boolean;

  metadata?: Record<string, unknown>;
}

export interface UsageScope {
  type: UsageScopeType;

  id: string;
}

export interface UsageEvent {
  id: string;

  metric: string;

  quantity: number;

  scope: UsageScope;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}

export interface RecordUsageInput {
  metric: UsageMetricName | string;

  quantity?: number;

  scope: UsageScope;

  timestamp?: Date;

  metadata?: Record<string, unknown>;
}

export interface UsageQuery {
  metric?: string | string[];

  scope?: UsageScope;

  scopeType?: UsageScopeType;

  scopeId?: string;

  start?: Date;

  end?: Date;

  limit?: number;

  offset?: number;

  sort?: "asc" | "desc";
}

export interface UsageQueryResult {
  events: UsageEvent[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface UsageSummary {
  metric: string;

  scope: UsageScope;

  value: number;

  eventCount: number;

  aggregation: UsageAggregation;

  unit?: string;

  start: Date;

  end: Date;
}

export interface UsageBucket {
  start: Date;

  end: Date;

  value: number;

  eventCount: number;
}

export interface UsageTimeSeries {
  metric: string;

  scope: UsageScope;

  aggregation: UsageAggregation;

  buckets: UsageBucket[];

  start: Date;

  end: Date;
}

export interface UsageQuota {
  metric: string;

  scope: UsageScope;

  limit: number;

  period: UsagePeriod;

  customPeriodStart?: Date;

  customPeriodEnd?: Date;

  enabled: boolean;

  metadata?: Record<string, unknown>;
}

export interface UsageQuotaStatus {
  metric: string;

  scope: UsageScope;

  limit: number;

  used: number;

  remaining: number | null;

  percentage: number | null;

  unlimited: boolean;

  exceeded: boolean;

  periodStart: Date;

  periodEnd: Date;
}

export interface UsagePermission {
  allowed: boolean;

  reason?: string;

  quota?: UsageQuotaStatus;
}

export interface UsageStats {
  totalEvents: number;

  totalMetrics: number;

  totalScopes: number;

  oldestEvent?: Date;

  newestEvent?: Date;
}

export interface UsageServiceOptions {
  maxEvents?: number;

  autoRegisterMetrics?: boolean;
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

export class UsageMetricNotFoundError
  extends UsageServiceError {
  constructor(
    metric: string
  ) {
    super(
      `Usage metric not found: ${metric}`
    );

    this.name =
      "UsageMetricNotFoundError";
  }
}

export class UsageQuotaExceededError
  extends UsageServiceError {
  constructor(
    metric: string,
    scope: UsageScope
  ) {
    super(
      `Usage quota exceeded for metric "${metric}" on ${scope.type}:${scope.id}.`
    );

    this.name =
      "UsageQuotaExceededError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_USAGE_QUERY_LIMIT =
  100;

export const MAX_USAGE_QUERY_LIMIT =
  10_000;

export const DEFAULT_MAX_USAGE_EVENTS =
  1_000_000;

export const UNLIMITED_USAGE =
  -1;

/* -------------------------------------------------------------------------- */
/*                            DEFAULT METRICS                                 */
/* -------------------------------------------------------------------------- */

export const DEFAULT_USAGE_METRICS:
  UsageMetricDefinition[] = [
    {
      name: "requests",
      description:
        "Total platform requests.",
      aggregation: "sum",
      unit: "requests",
      active: true,
    },

    {
      name: "api_calls",
      description:
        "Total API calls.",
      aggregation: "sum",
      unit: "calls",
      active: true,
    },

    {
      name: "tokens",
      description:
        "Total AI tokens consumed.",
      aggregation: "sum",
      unit: "tokens",
      active: true,
    },

    {
      name: "input_tokens",
      description:
        "Input AI tokens consumed.",
      aggregation: "sum",
      unit: "tokens",
      active: true,
    },

    {
      name: "output_tokens",
      description:
        "Output AI tokens generated.",
      aggregation: "sum",
      unit: "tokens",
      active: true,
    },

    {
      name: "ai_generations",
      description:
        "AI generations executed.",
      aggregation: "sum",
      unit: "generations",
      active: true,
    },

    {
      name: "agent_executions",
      description:
        "Agent executions.",
      aggregation: "sum",
      unit: "executions",
      active: true,
    },

    {
      name: "document_reads",
      description:
        "Documents processed.",
      aggregation: "sum",
      unit: "documents",
      active: true,
    },

    {
      name: "document_pages",
      description:
        "Document pages processed.",
      aggregation: "sum",
      unit: "pages",
      active: true,
    },

    {
      name: "storage_bytes",
      description:
        "Storage consumed.",
      aggregation: "sum",
      unit: "bytes",
      active: true,
    },

    {
      name: "storage_objects",
      description:
        "Stored objects.",
      aggregation: "sum",
      unit: "objects",
      active: true,
    },

    {
      name: "messages",
      description:
        "Messages processed.",
      aggregation: "sum",
      unit: "messages",
      active: true,
    },

    {
      name: "projects",
      description:
        "Projects created.",
      aggregation: "sum",
      unit: "projects",
      active: true,
    },

    {
      name: "tasks",
      description:
        "Tasks executed.",
      aggregation: "sum",
      unit: "tasks",
      active: true,
    },

    {
      name: "search_queries",
      description:
        "Search queries executed.",
      aggregation: "sum",
      unit: "queries",
      active: true,
    },

    {
      name: "integrations",
      description:
        "Integration operations.",
      aggregation: "sum",
      unit: "operations",
      active: true,
    },

    {
      name: "uploads",
      description:
        "Files uploaded.",
      aggregation: "sum",
      unit: "files",
      active: true,
    },

    {
      name: "downloads",
      description:
        "Files downloaded.",
      aggregation: "sum",
      unit: "files",
      active: true,
    },

    {
      name: "compute_ms",
      description:
        "Compute time consumed.",
      aggregation: "sum",
      unit: "milliseconds",
      active: true,
    },
  ];

/* -------------------------------------------------------------------------- */
/*                               USAGE SERVICE                                */
/* -------------------------------------------------------------------------- */

export class UsageService {
  private readonly events:
    UsageEvent[] = [];

  private readonly metrics =
    new Map<
      string,
      UsageMetricDefinition
    >();

  private readonly quotas =
    new Map<
      string,
      UsageQuota
    >();

  private readonly maxEvents:
    number;

  private readonly autoRegisterMetrics:
    boolean;

  constructor(
    options: UsageServiceOptions = {}
  ) {
    this.maxEvents =
      normalizeMaxEvents(
        options.maxEvents
      );

    this.autoRegisterMetrics =
      options.autoRegisterMetrics ??
      true;

    for (
      const metric of DEFAULT_USAGE_METRICS
    ) {
      this.registerMetric(
        metric
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                METRICS                                   */
  /* ------------------------------------------------------------------------ */

  registerMetric(
    definition: UsageMetricDefinition
  ): UsageMetricDefinition {
    const normalizedName =
      normalizeMetricName(
        definition.name
      );

    const metric:
      UsageMetricDefinition = {
        ...definition,

        name:
          normalizedName,

        active:
          definition.active !== false,

        metadata:
          definition.metadata
            ? cloneRecord(
                definition.metadata
              )
            : undefined,
      };

    this.metrics.set(
      normalizedName,
      metric
    );

    return this.cloneMetric(
      metric
    );
  }

  unregisterMetric(
    name: string
  ): boolean {
    return this.metrics.delete(
      normalizeMetricName(
        name
      )
    );
  }

  getMetric(
    name: string
  ): UsageMetricDefinition | undefined {
    const metric =
      this.metrics.get(
        normalizeMetricName(
          name
        )
      );

    return metric
      ? this.cloneMetric(
          metric
        )
      : undefined;
  }

  requireMetric(
    name: string
  ): UsageMetricDefinition {
    const metric =
      this.getMetric(
        name
      );

    if (!metric) {
      throw new UsageMetricNotFoundError(
        name
      );
    }

    return metric;
  }

  listMetrics():
    UsageMetricDefinition[] {
    return Array.from(
      this.metrics.values()
    ).map(
      (metric) =>
        this.cloneMetric(
          metric
        )
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              USAGE RECORDING                             */
  /* ------------------------------------------------------------------------ */

  record(
    input: RecordUsageInput
  ): UsageEvent {
    this.validateRecordInput(
      input
    );

    const metricName =
      normalizeMetricName(
        input.metric
      );

    let metric =
      this.metrics.get(
        metricName
      );

    if (!metric) {
      if (
        !this.autoRegisterMetrics
      ) {
        throw new UsageMetricNotFoundError(
          metricName
        );
      }

      metric =
        this.registerMetric({
          name:
            metricName,

          aggregation:
            "sum",

          active: true,
        });
    }

    if (!metric.active) {
      throw new UsageServiceError(
        `Usage metric "${metricName}" is inactive.`
      );
    }

    const event:
      UsageEvent = {
        id:
          generateUsageEventId(),

        metric:
          metricName,

        quantity:
          input.quantity ?? 1,

        scope:
          cloneScope(
            input.scope
          ),

        timestamp:
          input.timestamp
            ? new Date(
                input.timestamp
              )
            : new Date(),

        metadata:
          input.metadata
            ? cloneRecord(
                input.metadata
              )
            : undefined,
      };

    this.events.push(
      event
    );

    this.enforceMaxEvents();

    return this.cloneEvent(
      event
    );
  }

  recordMany(
    inputs: RecordUsageInput[]
  ): UsageEvent[] {
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
  /*                                 QUERIES                                  */
  /* ------------------------------------------------------------------------ */

  query(
    query: UsageQuery = {}
  ): UsageQueryResult {
    const limit =
      normalizeQueryLimit(
        query.limit
      );

    const offset =
      normalizeOffset(
        query.offset
      );

    let events =
      this.filterEvents(
        query
      );

    events.sort(
      (a, b) => {
        const difference =
          a.timestamp.getTime() -
          b.timestamp.getTime();

        return query.sort === "asc"
          ? difference
          : -difference;
      }
    );

    const total =
      events.length;

    const result =
      events
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
      events:
        result,

      total,

      limit,

      offset,

      hasMore:
        offset + limit <
        total,
    };
  }

  getEvents(
    query: UsageQuery = {}
  ): UsageEvent[] {
    return this.query(
      query
    ).events;
  }

  /* ------------------------------------------------------------------------ */
  /*                              AGGREGATION                                 */
  /* ------------------------------------------------------------------------ */

  summarize(
    metric: string,
    scope: UsageScope,
    options: {
      start?: Date;
      end?: Date;
      aggregation?: UsageAggregation;
    } = {}
  ): UsageSummary {
    const metricDefinition =
      this.getMetric(
        metric
      );

    const normalizedMetric =
      normalizeMetricName(
        metric
      );

    const now =
      new Date();

    const start =
      options.start
        ? new Date(
            options.start
          )
        : new Date(0);

    const end =
      options.end
        ? new Date(
            options.end
          )
        : now;

    const aggregation =
      options.aggregation ??
      metricDefinition?.aggregation ??
      "sum";

    const events =
      this.filterEvents({
        metric:
          normalizedMetric,

        scope,

        start,

        end,

        sort: "asc",

        limit:
          MAX_USAGE_QUERY_LIMIT,
      });

    const value =
      aggregateUsage(
        events,
        aggregation
      );

    return {
      metric:
        normalizedMetric,

      scope:
        cloneScope(
          scope
        ),

      value,

      eventCount:
        events.length,

      aggregation,

      unit:
        metricDefinition?.unit,

      start,

      end,
    };
  }

  getUsage(
    metric: string,
    scope: UsageScope,
    start?: Date,
    end?: Date
  ): number {
    return this.summarize(
      metric,
      scope,
      {
        start,
        end,
      }
    ).value;
  }

  /* ------------------------------------------------------------------------ */
  /*                              TIME SERIES                                 */
  /* ------------------------------------------------------------------------ */

  getTimeSeries(
    metric: string,
    scope: UsageScope,
    options: {
      start: Date;
      end: Date;
      period: Exclude<
        UsagePeriod,
        "custom"
      >;
      aggregation?: UsageAggregation;
    }
  ): UsageTimeSeries {
    const start =
      new Date(
        options.start
      );

    const end =
      new Date(
        options.end
      );

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      )
    ) {
      throw new UsageValidationError([
        "Time series start and end dates must be valid.",
      ]);
    }

    if (
      start.getTime() >
      end.getTime()
    ) {
      throw new UsageValidationError([
        "Time series start must be before end.",
      ]);
    }

    const metricDefinition =
      this.getMetric(
        metric
      );

    const aggregation =
      options.aggregation ??
      metricDefinition?.aggregation ??
      "sum";

    const normalizedMetric =
      normalizeMetricName(
        metric
      );

    const events =
      this.filterEvents({
        metric:
          normalizedMetric,

        scope,

        start,

        end,

        sort:
          "asc",

        limit:
          MAX_USAGE_QUERY_LIMIT,
      });

    const buckets =
      new Map<
        number,
        UsageEvent[]
      >();

    for (
      const event of events
    ) {
      const bucketStart =
        getPeriodStart(
          event.timestamp,
          options.period
        );

      const key =
        bucketStart.getTime();

      const bucket =
        buckets.get(
          key
        ) ?? [];

      bucket.push(
        event
      );

      buckets.set(
        key,
        bucket
      );
    }

    const result:
      UsageBucket[] = [];

    let cursor =
      getPeriodStart(
        start,
        options.period
      );

    while (
      cursor.getTime() <=
      end.getTime()
    ) {
      const bucketEnd =
        getNextPeriodStart(
          cursor,
          options.period
        );

      const eventsInBucket =
        buckets.get(
          cursor.getTime()
        ) ?? [];

      result.push({
        start:
          new Date(
            cursor
          ),

        end:
          new Date(
            bucketEnd
          ),

        value:
          aggregateUsage(
            eventsInBucket,
            aggregation
          ),

        eventCount:
          eventsInBucket.length,
      });

      cursor =
        bucketEnd;
    }

    return {
      metric:
        normalizedMetric,

      scope:
        cloneScope(
          scope
        ),

      aggregation,

      buckets:
        result,

      start,

      end,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                  QUOTAS                                  */
  /* ------------------------------------------------------------------------ */

  setQuota(
    quota: UsageQuota
  ): UsageQuota {
    this.validateQuota(
      quota
    );

    const normalized:
      UsageQuota = {
        ...quota,

        metric:
          normalizeMetricName(
            quota.metric
          ),

        scope:
          cloneScope(
            quota.scope
          ),

        enabled:
          quota.enabled !== false,

        customPeriodStart:
          quota.customPeriodStart
            ? new Date(
                quota.customPeriodStart
              )
            : undefined,

        customPeriodEnd:
          quota.customPeriodEnd
            ? new Date(
                quota.customPeriodEnd
              )
            : undefined,

        metadata:
          quota.metadata
            ? cloneRecord(
                quota.metadata
              )
            : undefined,
      };

    this.quotas.set(
      createQuotaKey(
        normalized.metric,
        normalized.scope
      ),
      normalized
    );

    return this.cloneQuota(
      normalized
    );
  }

  getQuota(
    metric: string,
    scope: UsageScope
  ): UsageQuota | undefined {
    const quota =
      this.quotas.get(
        createQuotaKey(
          normalizeMetricName(
            metric
          ),
          scope
        )
      );

    return quota
      ? this.cloneQuota(
          quota
        )
      : undefined;
  }

  removeQuota(
    metric: string,
    scope: UsageScope
  ): boolean {
    return this.quotas.delete(
      createQuotaKey(
        normalizeMetricName(
          metric
        ),
        scope
      )
    );
  }

  getQuotaStatus(
    metric: string,
    scope: UsageScope
  ): UsageQuotaStatus | undefined {
    const quota =
      this.getQuota(
        metric,
        scope
      );

    if (
      !quota ||
      !quota.enabled
    ) {
      return undefined;
    }

    const period =
      this.resolveQuotaPeriod(
        quota
      );

    const used =
      this.getUsage(
        quota.metric,
        quota.scope,
        period.start,
        period.end
      );

    const unlimited =
      quota.limit ===
      UNLIMITED_USAGE;

    const remaining =
      unlimited
        ? null
        : Math.max(
            0,
            quota.limit -
              used
          );

    const percentage =
      unlimited ||
      quota.limit <= 0
        ? null
        : Math.min(
            100,
            (used / quota.limit) *
              100
          );

    return {
      metric:
        quota.metric,

      scope:
        cloneScope(
          quota.scope
        ),

      limit:
        quota.limit,

      used,

      remaining,

      percentage,

      unlimited,

      exceeded:
        !unlimited &&
        used > quota.limit,

      periodStart:
        period.start,

      periodEnd:
        period.end,
    };
  }

  canConsume(
    input: RecordUsageInput
  ): UsagePermission {
    this.validateRecordInput(
      input
    );

    const quantity =
      input.quantity ?? 1;

    const metric =
      normalizeMetricName(
        input.metric
      );

    const quota =
      this.getQuotaStatus(
        metric,
        input.scope
      );

    if (!quota) {
      return {
        allowed: true,
      };
    }

    if (
      quota.unlimited
    ) {
      return {
        allowed: true,

        quota,
      };
    }

    if (
      quota.used +
        quantity >
      quota.limit
    ) {
      return {
        allowed: false,

        reason:
          `Usage quota exceeded for "${metric}".`,

        quota,
      };
    }

    return {
      allowed: true,

      quota,
    };
  }

  assertCanConsume(
    input: RecordUsageInput
  ): void {
    const permission =
      this.canConsume(
        input
      );

    if (
      !permission.allowed
    ) {
      throw new UsageQuotaExceededError(
        normalizeMetricName(
          input.metric
        ),
        input.scope
      );
    }
  }

  consume(
    input: RecordUsageInput
  ): UsageEvent {
    this.assertCanConsume(
      input
    );

    return this.record(
      input
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                STATISTICS                                */
  /* ------------------------------------------------------------------------ */

  getStats(): UsageStats {
    const scopeKeys =
      new Set<
        string
      >();

    for (
      const event of this.events
    ) {
      scopeKeys.add(
        createScopeKey(
          event.scope
        )
      );
    }

    let oldestEvent:
      Date | undefined;

    let newestEvent:
      Date | undefined;

    for (
      const event of this.events
    ) {
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

      totalMetrics:
        this.metrics.size,

      totalScopes:
        scopeKeys.size,

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
  /*                                CLEANUP                                   */
  /* ------------------------------------------------------------------------ */

  clearEvents(
    predicate?: (
      event: UsageEvent
    ) => boolean
  ): number {
    if (!predicate) {
      const count =
        this.events.length;

      this.events.length =
        0;

      return count;
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
        predicate(
          this.cloneEvent(
            event
          )
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

  clearScope(
    scope: UsageScope
  ): number {
    return this.clearEvents(
      (event) =>
        event.scope.type ===
          scope.type &&
        event.scope.id ===
          scope.id
    );
  }

  cleanupBefore(
    date: Date
  ): number {
    const threshold =
      new Date(
        date
      );

    if (
      Number.isNaN(
        threshold.getTime()
      )
    ) {
      throw new UsageValidationError([
        "Cleanup date must be valid.",
      ]);
    }

    return this.clearEvents(
      (event) =>
        event.timestamp.getTime() <
        threshold.getTime()
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  INTERNAL                                */
  /* ------------------------------------------------------------------------ */

  private filterEvents(
    query: UsageQuery
  ): UsageEvent[] {
    const metrics =
      query.metric
        ? new Set(
            (
              Array.isArray(
                query.metric
              )
                ? query.metric
                : [query.metric]
            ).map(
              (metric) =>
                normalizeMetricName(
                  metric
                )
            )
          )
        : undefined;

    const start =
      query.start
        ? new Date(
            query.start
          )
        : undefined;

    const end =
      query.end
        ? new Date(
            query.end
          )
        : undefined;

    return this.events.filter(
      (event) => {
        if (
          metrics &&
          !metrics.has(
            event.metric
          )
        ) {
          return false;
        }

        if (
          query.scope &&
          (
            event.scope.type !==
              query.scope.type ||
            event.scope.id !==
              query.scope.id
          )
        ) {
          return false;
        }

        if (
          query.scopeType &&
          event.scope.type !==
            query.scopeType
        ) {
          return false;
        }

        if (
          query.scopeId &&
          event.scope.id !==
            query.scopeId
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
    );
  }

  private validateRecordInput(
    input: RecordUsageInput
  ): void {
    const errors:
      string[] = [];

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
      ) ||
      quantity < 0
    ) {
      errors.push(
        "Usage quantity must be a non-negative finite number."
      );
    }

    if (
      !input.scope ||
      typeof input.scope !==
        "object"
    ) {
      errors.push(
        "Usage scope is required."
      );
    } else {
      if (
        !input.scope.type
      ) {
        errors.push(
          "Usage scope type is required."
        );
      }

      if (
        !input.scope.id ||
        !input.scope.id.trim()
      ) {
        errors.push(
          "Usage scope id is required."
        );
      }
    }

    if (
      input.timestamp &&
      Number.isNaN(
        new Date(
          input.timestamp
        ).getTime()
      )
    ) {
      errors.push(
        "Usage timestamp must be a valid date."
      );
    }

    if (
      errors.length > 0
    ) {
      throw new UsageValidationError(
        errors
      );
    }
  }

  private validateQuota(
    quota: UsageQuota
  ): void {
    const errors:
      string[] = [];

    if (
      !quota.metric ||
      !quota.metric.trim()
    ) {
      errors.push(
        "Quota metric is required."
      );
    }

    if (
      !quota.scope ||
      !quota.scope.id ||
      !quota.scope.type
    ) {
      errors.push(
        "Quota scope is required."
      );
    }

    if (
      !Number.isFinite(
        quota.limit
      ) ||
      quota.limit < -1
    ) {
      errors.push(
        "Quota limit must be -1 or a non-negative finite number."
      );
    }

    if (
      quota.period ===
        "custom"
    ) {
      if (
        !quota.customPeriodStart ||
        !quota.customPeriodEnd
      ) {
        errors.push(
          "Custom quota periods require start and end dates."
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

  private resolveQuotaPeriod(
    quota: UsageQuota
  ): {
    start: Date;
    end: Date;
  } {
    const now =
      new Date();

    if (
      quota.period ===
      "custom"
    ) {
      return {
        start:
          quota.customPeriodStart
            ? new Date(
                quota.customPeriodStart
              )
            : now,

        end:
          quota.customPeriodEnd
            ? new Date(
                quota.customPeriodEnd
              )
            : now,
      };
    }

    const start =
      getPeriodStart(
        now,
        quota.period
      );

    const end =
      getNextPeriodStart(
        start,
        quota.period
      );

    return {
      start,
      end,
    };
  }

  private enforceMaxEvents():
    void {
    if (
      this.events.length <=
      this.maxEvents
    ) {
      return;
    }

    const removeCount =
      this.events.length -
      this.maxEvents;

    this.events.splice(
      0,
      removeCount
    );
  }

  private cloneEvent(
    event: UsageEvent
  ): UsageEvent {
    return {
      ...event,

      scope:
        cloneScope(
          event.scope
        ),

      timestamp:
        new Date(
          event.timestamp
        ),

      metadata:
        event.metadata
          ? cloneRecord(
              event.metadata
            )
          : undefined,
    };
  }

  private cloneMetric(
    metric: UsageMetricDefinition
  ): UsageMetricDefinition {
    return {
      ...metric,

      metadata:
        metric.metadata
          ? cloneRecord(
              metric.metadata
            )
          : undefined,
    };
  }

  private cloneQuota(
    quota: UsageQuota
  ): UsageQuota {
    return {
      ...quota,

      scope:
        cloneScope(
          quota.scope
        ),

      customPeriodStart:
        quota.customPeriodStart
          ? new Date(
              quota.customPeriodStart
            )
          : undefined,

      customPeriodEnd:
        quota.customPeriodEnd
          ? new Date(
              quota.customPeriodEnd
            )
          : undefined,

      metadata:
        quota.metadata
          ? cloneRecord(
              quota.metadata
            )
          : undefined,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

function normalizeMetricName(
  value: string
): string {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new UsageValidationError([
      "Usage metric name is required.",
    ]);
  }

  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      "_"
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

  return Math.floor(
    maxEvents
  );
}

function normalizeQueryLimit(
  value?: number
): number {
  if (
    value === undefined
  ) {
    return DEFAULT_USAGE_QUERY_LIMIT;
  }

  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    throw new UsageValidationError([
      "Usage query limit must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(
      value
    ),
    MAX_USAGE_QUERY_LIMIT
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
      "Usage query offset must be a non-negative finite number.",
    ]);
  }

  return Math.floor(
    value
  );
}

function aggregateUsage(
  events: UsageEvent[],
  aggregation: UsageAggregation
): number {
  if (
    events.length === 0
  ) {
    return 0;
  }

  const quantities =
    events.map(
      (event) =>
        event.quantity
    );

  switch (
    aggregation
  ) {
    case "count":
      return events.length;

    case "average":
      return (
        quantities.reduce(
          (total, value) =>
            total + value,
          0
        ) / quantities.length
      );

    case "minimum":
      return Math.min(
        ...quantities
      );

    case "maximum":
      return Math.max(
        ...quantities
      );

    case "sum":
    default:
      return quantities.reduce(
        (total, value) =>
          total + value,
        0
      );
  }
}

function getPeriodStart(
  date: Date,
  period: Exclude<
    UsagePeriod,
    "custom"
  >
): Date {
  const result =
    new Date(
      date
    );

  switch (
    period
  ) {
    case "hour":
      result.setMinutes(
        0,
        0,
        0
      );
      break;

    case "day":
      result.setHours(
        0,
        0,
        0,
        0
      );
      break;

    case "week": {
      result.setHours(
        0,
        0,
        0,
        0
      );

      const day =
        result.getDay();

      const difference =
        day === 0
          ? -6
          : 1 - day;

      result.setDate(
        result.getDate() +
          difference
      );

      break;
    }

    case "month":
      result.setDate(
        1
      );

      result.setHours(
        0,
        0,
        0,
        0
      );

      break;

    case "year":
      result.setMonth(
        0,
        1
      );

      result.setHours(
        0,
        0,
        0,
        0
      );

      break;
  }

  return result;
}

function getNextPeriodStart(
  date: Date,
  period: Exclude<
    UsagePeriod,
    "custom"
  >
): Date {
  const result =
    new Date(
      date
    );

  switch (
    period
  ) {
    case "hour":
      result.setHours(
        result.getHours() + 1
      );
      break;

    case "day":
      result.setDate(
        result.getDate() + 1
      );
      break;

    case "week":
      result.setDate(
        result.getDate() + 7
      );
      break;

    case "month":
      result.setMonth(
        result.getMonth() + 1
      );
      break;

    case "year":
      result.setFullYear(
        result.getFullYear() + 1
      );
      break;
  }

  return result;
}

function createScopeKey(
  scope: UsageScope
): string {
  return `${scope.type}:${scope.id}`;
}

function createQuotaKey(
  metric: string,
  scope: UsageScope
): string {
  return `${metric}:${createScopeKey(
    scope
  )}`;
}

function cloneScope(
  scope: UsageScope
): UsageScope {
  return {
    type:
      scope.type,

    id:
      scope.id,
  };
}

function cloneRecord(
  value: Record<
    string,
    unknown
  >
): Record<
  string,
  unknown
> {
  return {
    ...value,
  };
}

function generateUsageEventId():
  string {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `usage_${Date.now()}_${random}`;
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const usageService =
  new UsageService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function registerUsageMetric(
  definition: UsageMetricDefinition
): UsageMetricDefinition {
  return usageService.registerMetric(
    definition
  );
}

export function getUsageMetric(
  name: string
): UsageMetricDefinition | undefined {
  return usageService.getMetric(
    name
  );
}

export function listUsageMetrics():
  UsageMetricDefinition[] {
  return usageService.listMetrics();
}

export function recordUsage(
  input: RecordUsageInput
): UsageEvent {
  return usageService.record(
    input
  );
}

export function recordUsageMany(
  inputs: RecordUsageInput[]
): UsageEvent[] {
  return usageService.recordMany(
    inputs
  );
}

export function consumeUsage(
  input: RecordUsageInput
): UsageEvent {
  return usageService.consume(
    input
  );
}

export function canConsumeUsage(
  input: RecordUsageInput
): UsagePermission {
  return usageService.canConsume(
    input
  );
}

export function assertCanConsumeUsage(
  input: RecordUsageInput
): void {
  usageService.assertCanConsume(
    input
  );
}

export function queryUsage(
  query?: UsageQuery
): UsageQueryResult {
  return usageService.query(
    query
  );
}

export function getUsageEvents(
  query?: UsageQuery
): UsageEvent[] {
  return usageService.getEvents(
    query
  );
}

export function getUsageSummary(
  metric: string,
  scope: UsageScope,
  start?: Date,
  end?: Date
): UsageSummary {
  return usageService.summarize(
    metric,
    scope,
    {
      start,
      end,
    }
  );
}

export function getUsageValue(
  metric: string,
  scope: UsageScope,
  start?: Date,
  end?: Date
): number {
  return usageService.getUsage(
    metric,
    scope,
    start,
    end
  );
}

export function getUsageTimeSeries(
  metric: string,
  scope: UsageScope,
  options: {
    start: Date;
    end: Date;
    period: Exclude<
      UsagePeriod,
      "custom"
    >;
    aggregation?: UsageAggregation;
  }
): UsageTimeSeries {
  return usageService.getTimeSeries(
    metric,
    scope,
    options
  );
}

export function setUsageQuota(
  quota: UsageQuota
): UsageQuota {
  return usageService.setQuota(
    quota
  );
}

export function getUsageQuota(
  metric: string,
  scope: UsageScope
): UsageQuota | undefined {
  return usageService.getQuota(
    metric,
    scope
  );
}

export function getUsageQuotaStatus(
  metric: string,
  scope: UsageScope
): UsageQuotaStatus | undefined {
  return usageService.getQuotaStatus(
    metric,
    scope
  );
}

export function removeUsageQuota(
  metric: string,
  scope: UsageScope
): boolean {
  return usageService.removeQuota(
    metric,
    scope
  );
}

export function getUsageStats():
  UsageStats {
  return usageService.getStats();
}

export function clearUsageEvents(
  predicate?: (
    event: UsageEvent
  ) => boolean
): number {
  return usageService.clearEvents(
    predicate
  );
}

export function clearUsageScope(
  scope: UsageScope
): number {
  return usageService.clearScope(
    scope
  );
}

export function cleanupUsageBefore(
  date: Date
): number {
  return usageService.cleanupBefore(
    date
  );
}

export default usageService;