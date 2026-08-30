/**
 * SYRA AI - Enterprise Security Audit System
 * lib/ai/security/audit.ts
 *
 * Production-grade audit logging for enterprise AI operations.
 */

export type AuditSeverity =
  | "debug"
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AuditOutcome =
  | "success"
  | "failure"
  | "blocked"
  | "warning"
  | "pending";

export type AuditCategory =
  | "authentication"
  | "authorization"
  | "security"
  | "agent"
  | "ai"
  | "billing"
  | "data"
  | "system"
  | "user"
  | "api"
  | "automation"
  | "knowledge"
  | "other";

export interface AuditActor {
  id?: string;
  type?: "user" | "agent" | "system" | "service" | "anonymous";
  name?: string;
  email?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditTarget {
  id?: string;
  type?: string;
  name?: string;
}

export interface AuditMetadata {
  [key: string]: unknown;
}

export interface AuditEvent {
  id: string;

  timestamp: string;

  category: AuditCategory;

  action: string;

  description: string;

  severity: AuditSeverity;

  outcome: AuditOutcome;

  actor?: AuditActor;

  target?: AuditTarget;

  metadata?: AuditMetadata;

  requestId?: string;

  sessionId?: string;

  traceId?: string;

  duration?: number;

  source?: string;

  environment?: string;
}

export interface CreateAuditEventInput {
  category: AuditCategory;

  action: string;

  description?: string;

  severity?: AuditSeverity;

  outcome?: AuditOutcome;

  actor?: AuditActor;

  target?: AuditTarget;

  metadata?: AuditMetadata;

  requestId?: string;

  sessionId?: string;

  traceId?: string;

  duration?: number;

  source?: string;

  environment?: string;
}

export interface AuditQuery {
  category?: AuditCategory;

  severity?: AuditSeverity;

  outcome?: AuditOutcome;

  action?: string;

  actorId?: string;

  targetId?: string;

  requestId?: string;

  sessionId?: string;

  traceId?: string;

  from?: Date | string;

  to?: Date | string;

  limit?: number;
}

export interface AuditStats {
  total: number;

  success: number;

  failure: number;

  blocked: number;

  warning: number;

  pending: number;

  critical: number;

  high: number;

  medium: number;

  low: number;

  info: number;

  debug: number;

  categories: Record<string, number>;

  actions: Record<string, number>;
}

export interface AuditServiceOptions {
  maxEvents?: number;

  environment?: string;

  enabled?: boolean;
}

const DEFAULT_MAX_EVENTS = 10000;

const DEFAULT_OPTIONS: Required<AuditServiceOptions> = {
  maxEvents: DEFAULT_MAX_EVENTS,
  environment: "production",
  enabled: true,
};

/**
 * Generates a secure unique audit ID.
 *
 * Uses crypto.randomUUID when available.
 * Falls back safely for environments where it is unavailable.
 */
function generateAuditId(): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const timestamp = Date.now().toString(36);

  const random = Math.random()
    .toString(36)
    .slice(2, 12);

  return `audit_${timestamp}_${random}`;
}

/**
 * Converts Date or string into timestamp.
 */
function normalizeDate(value?: Date | string): number | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return timestamp;
}

/**
 * Creates an immutable-safe copy of metadata.
 */
function cloneMetadata(
  metadata?: AuditMetadata,
): AuditMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  try {
    return structuredClone(metadata);
  } catch {
    return { ...metadata };
  }
}

/**
 * Enterprise Audit Service.
 *
 * Provides:
 * - Structured audit events
 * - Security event tracking
 * - Authentication logging
 * - Authorization logging
 * - Agent execution tracking
 * - AI request auditing
 * - Failure monitoring
 * - Blocked operation tracking
 * - In-memory event history
 * - Querying and statistics
 */
export class AuditService {
  private events: AuditEvent[] = [];

  private readonly options: Required<AuditServiceOptions>;

  constructor(options: AuditServiceOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Create and store an audit event.
   */
  async log(
    input: CreateAuditEventInput,
  ): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: generateAuditId(),

      timestamp: new Date().toISOString(),

      category: input.category,

      action: input.action,

      description:
        input.description ??
        `${input.category}:${input.action}`,

      severity: input.severity ?? "info",

      outcome: input.outcome ?? "success",

      actor: input.actor
        ? { ...input.actor }
        : undefined,

      target: input.target
        ? { ...input.target }
        : undefined,

      metadata: cloneMetadata(input.metadata),

      requestId: input.requestId,

      sessionId: input.sessionId,

      traceId: input.traceId,

      duration: input.duration,

      source: input.source ?? "syra-ai",

      environment:
        input.environment ??
        this.options.environment,
    };

    if (!this.options.enabled) {
      return event;
    }

    this.events.push(event);

    this.enforceEventLimit();

    return event;
  }

  /**
   * Alias for log().
   */
  async create(
    input: CreateAuditEventInput,
  ): Promise<AuditEvent> {
    return this.log(input);
  }

  /**
   * Log successful operation.
   */
  async success(
    input: Omit<CreateAuditEventInput, "outcome">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      outcome: "success",
    });
  }

  /**
   * Log failed operation.
   */
  async failure(
    input: Omit<CreateAuditEventInput, "outcome">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      outcome: "failure",
      severity:
        input.severity ?? "high",
    });
  }

  /**
   * Log blocked operation.
   */
  async blocked(
    input: Omit<CreateAuditEventInput, "outcome">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      outcome: "blocked",
      severity:
        input.severity ?? "high",
    });
  }

  /**
   * Log warning.
   */
  async warning(
    input: Omit<CreateAuditEventInput, "outcome">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      outcome: "warning",
      severity:
        input.severity ?? "medium",
    });
  }

  /**
   * Log authentication event.
   */
  async authentication(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "authentication",
    });
  }

  /**
   * Log authorization event.
   */
  async authorization(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "authorization",
    });
  }

  /**
   * Log security event.
   */
  async security(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "security",
    });
  }

  /**
   * Log AI event.
   */
  async ai(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "ai",
    });
  }

  /**
   * Log AI agent event.
   */
  async agent(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "agent",
    });
  }

  /**
   * Log billing event.
   */
  async billing(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "billing",
    });
  }

  /**
   * Log data event.
   */
  async data(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "data",
    });
  }

  /**
   * Log system event.
   */
  async system(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "system",
    });
  }

  /**
   * Log user event.
   */
  async user(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "user",
    });
  }

  /**
   * Log API event.
   */
  async api(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "api",
    });
  }

  /**
   * Log automation event.
   */
  async automation(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "automation",
    });
  }

  /**
   * Log knowledge event.
   */
  async knowledge(
    input: Omit<CreateAuditEventInput, "category">,
  ): Promise<AuditEvent> {
    return this.log({
      ...input,
      category: "knowledge",
    });
  }

  /**
   * Get all audit events.
   */
  getAll(): AuditEvent[] {
    return [...this.events];
  }

  /**
   * Get event by ID.
   */
  getById(
    eventId: string,
  ): AuditEvent | null {
    return (
      this.events.find(
        (event) => event.id === eventId,
      ) ?? null
    );
  }

  /**
   * Query audit events.
   */
  query(
    query: AuditQuery = {},
  ): AuditEvent[] {
    const from = normalizeDate(query.from);
    const to = normalizeDate(query.to);

    let results = this.events.filter((event) => {
      if (
        query.category &&
        event.category !== query.category
      ) {
        return false;
      }

      if (
        query.severity &&
        event.severity !== query.severity
      ) {
        return false;
      }

      if (
        query.outcome &&
        event.outcome !== query.outcome
      ) {
        return false;
      }

      if (
        query.action &&
        event.action !== query.action
      ) {
        return false;
      }

      if (
        query.actorId &&
        event.actor?.id !== query.actorId
      ) {
        return false;
      }

      if (
        query.targetId &&
        event.target?.id !== query.targetId
      ) {
        return false;
      }

      if (
        query.requestId &&
        event.requestId !== query.requestId
      ) {
        return false;
      }

      if (
        query.sessionId &&
        event.sessionId !== query.sessionId
      ) {
        return false;
      }

      if (
        query.traceId &&
        event.traceId !== query.traceId
      ) {
        return false;
      }

      const eventTimestamp = new Date(
        event.timestamp,
      ).getTime();

      if (
        from !== undefined &&
        eventTimestamp < from
      ) {
        return false;
      }

      if (
        to !== undefined &&
        eventTimestamp > to
      ) {
        return false;
      }

      return true;
    });

    results = results.sort((a, b) => {
      return (
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime()
      );
    });

    if (
      typeof query.limit === "number" &&
      query.limit > 0
    ) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get events for actor.
   */
  getByActor(
    actorId: string,
    limit = 100,
  ): AuditEvent[] {
    return this.query({
      actorId,
      limit,
    });
  }

  /**
   * Get events for target.
   */
  getByTarget(
    targetId: string,
    limit = 100,
  ): AuditEvent[] {
    return this.query({
      targetId,
      limit,
    });
  }

  /**
   * Get failed events.
   */
  getFailures(
    limit = 100,
  ): AuditEvent[] {
    return this.query({
      outcome: "failure",
      limit,
    });
  }

  /**
   * Get blocked events.
   */
  getBlocked(
    limit = 100,
  ): AuditEvent[] {
    return this.query({
      outcome: "blocked",
      limit,
    });
  }

  /**
   * Get critical events.
   */
  getCritical(
    limit = 100,
  ): AuditEvent[] {
    return this.query({
      severity: "critical",
      limit,
    });
  }

  /**
   * Calculate audit statistics.
   */
  getStats(): AuditStats {
    const stats: AuditStats = {
      total: this.events.length,

      success: 0,

      failure: 0,

      blocked: 0,

      warning: 0,

      pending: 0,

      critical: 0,

      high: 0,

      medium: 0,

      low: 0,

      info: 0,

      debug: 0,

      categories: {},

      actions: {},
    };

    for (const event of this.events) {
      switch (event.outcome) {
        case "success":
          stats.success++;
          break;

        case "failure":
          stats.failure++;
          break;

        case "blocked":
          stats.blocked++;
          break;

        case "warning":
          stats.warning++;
          break;

        case "pending":
          stats.pending++;
          break;
      }

      switch (event.severity) {
        case "critical":
          stats.critical++;
          break;

        case "high":
          stats.high++;
          break;

        case "medium":
          stats.medium++;
          break;

        case "low":
          stats.low++;
          break;

        case "info":
          stats.info++;
          break;

        case "debug":
          stats.debug++;
          break;
      }

      stats.categories[event.category] =
        (stats.categories[event.category] ?? 0) + 1;

      stats.actions[event.action] =
        (stats.actions[event.action] ?? 0) + 1;
    }

    return stats;
  }

  /**
   * Clear audit events.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Remove events older than a date.
   */
  clearBefore(
    date: Date | string,
  ): number {
    const timestamp = normalizeDate(date);

    if (timestamp === undefined) {
      return 0;
    }

    const previousCount = this.events.length;

    this.events = this.events.filter((event) => {
      return (
        new Date(event.timestamp).getTime() >=
        timestamp
      );
    });

    return previousCount - this.events.length;
  }

  /**
   * Get current event count.
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Check whether audit service is enabled.
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Enforce maximum in-memory event count.
   */
  private enforceEventLimit(): void {
    const maxEvents = this.options.maxEvents;

    if (this.events.length <= maxEvents) {
      return;
    }

    const excess =
      this.events.length - maxEvents;

    this.events.splice(0, excess);
  }
}

/**
 * Global audit service instance.
 */
export const auditService = new AuditService({
  maxEvents: 10000,
  environment:
    process.env.NODE_ENV ?? "development",
  enabled: true,
});

/**
 * Convenience function for generic audit events.
 */
export async function audit(
  input: CreateAuditEventInput,
): Promise<AuditEvent> {
  return auditService.log(input);
}

/**
 * Convenience function for successful events.
 */
export async function auditSuccess(
  input: Omit<CreateAuditEventInput, "outcome">,
): Promise<AuditEvent> {
  return auditService.success(input);
}

/**
 * Convenience function for blocked events.
 */
export async function auditBlocked(
  input: Omit<CreateAuditEventInput, "outcome">,
): Promise<AuditEvent> {
  return auditService.blocked(input);
}

/**
 * Convenience function for failures.
 */
export async function auditFailure(
  input: Omit<
    CreateAuditEventInput,
    "outcome"
  >,
): Promise<AuditEvent> {
  return auditService.failure(input);
}

export default auditService;