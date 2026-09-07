/**
 * SYRAVEN — Structured server-side logging
 * lib/observability/logger.ts
 *
 * Phase 11 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY. A logger is an exfiltration path: everything it
 * touches is written somewhere durable, usually to a third-party log
 * sink, usually with a longer retention than the data itself.
 *
 * WHY THIS EXISTS
 *
 * Before Phase 11 there were 114 bare `console.*` calls across
 * `app/api/**`, each choosing its own shape and its own view of what was
 * safe to include. Two were writing data they should not: one logged the
 * model's analysis OF A USER'S UPLOADED DOCUMENT verbatim, and one
 * logged an untruncated provider error body, which can echo the prompt.
 *
 * The problem is not that those two were careless. It is that "is this
 * field safe to log?" was re-decided at every call site, so the answer
 * was only ever as good as the least careful one.
 *
 * WHAT THIS MODULE DOES
 *
 * It makes the safe shape the DEFAULT one:
 *
 *   - fields are redacted by key, so a field named `content`,
 *     `embedding`, `apiKey` or `email` cannot be logged by accident
 *   - long strings are truncated, so no single field can flood a log
 *   - a request id ties the lines of one request together
 *   - errors are classified rather than dumped with stacks
 *
 * WHAT THIS MODULE DELIBERATELY IS NOT
 *
 * It is not an observability framework. There is no transport, no
 * sampling, no async buffer, no dependency. It writes JSON to
 * `console`, which is what a Next.js server already collects, because
 * AGENTS.md forbids abstractions the repository does not need. If a
 * platform sink is adopted later, this is the one place to change.
 *
 * RELATIONSHIP TO lib/security/audit.ts
 *
 * `audit.ts` records SECURITY events for review — who did what to which
 * resource. This records OPERATIONAL events for debugging — what failed
 * and how long it took. They answer different questions and are kept
 * separate; audit.ts is currently unwired scaffolding and is not
 * modified by this phase.
 */

import "server-only";

/* -------------------------------------------------------------------------- */
/*                                   LEVELS                                   */
/* -------------------------------------------------------------------------- */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Minimum level emitted, from `LOG_LEVEL`.
 *
 * Defaults to `info`. An unrecognised value falls back to `info` rather
 * than silencing the logger: a typo in an env var must never be the
 * reason production has no logs.
 */
function activeLevel(env: NodeJS.ProcessEnv = process.env): LogLevel {
  const declared = env.LOG_LEVEL?.trim().toLowerCase();

  if (declared === "debug" || declared === "info") return declared;
  if (declared === "warn" || declared === "error") return declared;

  return "info";
}

/* -------------------------------------------------------------------------- */
/*                                 REDACTION                                  */
/* -------------------------------------------------------------------------- */

/**
 * Field names never written to a log, matched case-insensitively as a
 * SUBSTRING of the key.
 *
 * Substring matching is deliberate: it catches `apiKey`,
 * `OPENAI_API_KEY`, `stripeSecretKey` and `user_api_key` from one entry.
 * It over-matches occasionally — a field named `keyboard` would be
 * redacted — and that is the correct direction to err.
 *
 * Grouped by what each entry protects against:
 */
export const REDACTED_KEYS: readonly string[] = [
  /* Credentials. */
  "key",
  "secret",
  "token",
  "password",
  "authorization",
  "cookie",
  "credential",
  "signature",

  /* User content — the document-disclosure class. */
  "content",
  "body",
  "prompt",
  "message",
  "transcript",
  "text",
  "input",

  /* Vectors. Never useful in a log, and they reconstruct corpus geometry. */
  "embedding",
  "vector",

  /* Direct personal identifiers. */
  "email",
  "phone",
  "address",
];

export const REDACTED_PLACEHOLDER = "[redacted]";

/** Longest string value written for any single field. */
export const MAX_FIELD_LENGTH = 300;

function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase();

  return REDACTED_KEYS.some((needle) => lower.includes(needle));
}

/**
 * Makes one value safe to write.
 *
 * Strings are truncated with a marker so a reader can tell truncation
 * from a genuinely short value. Objects recurse, with a depth bound —
 * an unbounded walk over an unexpected shape (a Supabase error carrying
 * a request, say) is itself a way to leak.
 */
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > MAX_FIELD_LENGTH
      ? `${value.slice(0, MAX_FIELD_LENGTH)}…[truncated ${value.length}]`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  /* Depth bound. Deeper structures are summarised, not walked. */
  if (depth >= 3) return "[nested]";

  if (Array.isArray(value)) {
    /*
     * Arrays are summarised by length rather than element-wise. A logged
     * array is almost always a payload or a vector, and neither belongs
     * in a log; the length is the diagnostic part.
     */
    return `[array(${value.length})]`;
  }

  if (typeof value === "object") {
    return sanitizeFields(value as Record<string, unknown>, depth + 1);
  }

  /* Functions, symbols, bigints. */
  return `[${typeof value}]`;
}

/**
 * Redacts and truncates a field map.
 *
 * Exported for tests: the redaction rules are a security control and are
 * asserted directly rather than inferred from log output.
 */
export function sanitizeFields(
  fields: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    safe[key] = isRedactedKey(key)
      ? REDACTED_PLACEHOLDER
      : sanitizeValue(value, depth);
  }

  return safe;
}

/* -------------------------------------------------------------------------- */
/*                             ERROR CLASSIFICATION                           */
/* -------------------------------------------------------------------------- */

export type ErrorClass =
  | "timeout"
  | "upstream_unavailable"
  | "upstream_rejected"
  | "not_authorized"
  | "invalid_input"
  | "internal";

/**
 * Classifies a thrown value without disclosing it.
 *
 * Returns a stable label plus the error's NAME — never its message,
 * which routinely carries interpolated user input, connection strings or
 * provider detail, and never its stack, which carries file paths.
 *
 * The label is what makes failures countable: "how many timeouts in the
 * last hour" is answerable from these, and is the question an operator
 * actually asks.
 */
export function classifyError(cause: unknown): {
  errorClass: ErrorClass;
  errorName: string;
} {
  if (cause instanceof Error) {
    if (cause.name === "TimeoutError" || cause.name === "AbortError") {
      return { errorClass: "timeout", errorName: cause.name };
    }

    if (cause.name === "TypeError") {
      /*
       * `fetch` rejects with TypeError for DNS/connection failures —
       * the upstream was unreachable, not misbehaving.
       */
      return { errorClass: "upstream_unavailable", errorName: cause.name };
    }

    return { errorClass: "internal", errorName: cause.name };
  }

  return { errorClass: "internal", errorName: "unknown" };
}

/**
 * Classifies an upstream HTTP status.
 *
 * Mirrors the mapping in `lib/ai/provider.ts` so an operator reading
 * logs and a caller reading an error code see the same taxonomy.
 */
export function classifyStatus(status: number): ErrorClass {
  if (status === 401 || status === 403) return "not_authorized";
  if (status === 400 || status === 422) return "invalid_input";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "upstream_unavailable";
  if (status === 429) return "upstream_unavailable";

  return "upstream_rejected";
}

/* -------------------------------------------------------------------------- */
/*                                REQUEST IDS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Correlation id for one request.
 *
 * Prefers an inbound `x-request-id` so a trace survives across a proxy,
 * but only when it looks like an id — an arbitrary header value would
 * otherwise be attacker-controlled text written into every log line for
 * that request, which is log injection.
 *
 * Falls back to a generated UUID.
 */
export function resolveRequestId(headers: Headers): string {
  const inbound = headers.get("x-request-id");

  if (
    typeof inbound === "string" &&
    inbound.length > 0 &&
    inbound.length <= 200 &&
    /^[A-Za-z0-9_-]+$/.test(inbound)
  ) {
    return inbound;
  }

  return crypto.randomUUID();
}

/* -------------------------------------------------------------------------- */
/*                                   LOGGER                                   */
/* -------------------------------------------------------------------------- */

export interface LogContext {
  /** Correlation id. */
  readonly requestId?: string;
  /**
   * Verified user id. Safe: it is an opaque uuid, already the tenant key
   * throughout the codebase, and is what makes a report actionable.
   */
  readonly userId?: string;
  /** Logical operation, e.g. "billing.webhook" or "search.semantic". */
  readonly operation?: string;
}

function emit(
  level: LogLevel,
  message: string,
  context: LogContext,
  fields: Record<string, unknown>,
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[activeLevel()]) return;

  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...context,
    ...sanitizeFields(fields),
  };

  /*
   * One JSON object per line, on stderr.
   *
   * The repository's ESLint config permits only `console.warn` and
   * `console.error` (`no-console`), which is a deliberate rule: stdout
   * in a Next.js server is shared with framework output, so structured
   * lines written there are easily lost or interleaved. Everything is
   * therefore routed to stderr, and the `level` field in the JSON — not
   * the stream — is what distinguishes severity.
   */
  const serialized = JSON.stringify(line);

  if (level === "error") console.error(serialized);
  else console.warn(serialized);
}

/**
 * A logger bound to one request's context.
 *
 * Created per request so `requestId` and `userId` do not have to be
 * threaded through every call — the common reason correlation ids get
 * dropped in practice.
 */
export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** Logs a caught value by classification, never by message. */
  exception(message: string, cause: unknown, fields?: Record<string, unknown>): void;
  /** Derives a child logger with additional bound context. */
  child(context: LogContext): Logger;
}

export function createLogger(context: LogContext = {}): Logger {
  return {
    debug: (message, fields = {}) => emit("debug", message, context, fields),
    info: (message, fields = {}) => emit("info", message, context, fields),
    warn: (message, fields = {}) => emit("warn", message, context, fields),
    error: (message, fields = {}) => emit("error", message, context, fields),

    exception: (message, cause, fields = {}) => {
      emit("error", message, context, {
        ...fields,
        ...classifyError(cause),
      });
    },

    child: (extra) => createLogger({ ...context, ...extra }),
  };
}

/* -------------------------------------------------------------------------- */
/*                                   TIMING                                   */
/* -------------------------------------------------------------------------- */

/**
 * Times an operation and logs its outcome.
 *
 * Duration is recorded for BOTH paths. Timing only successes is the
 * common mistake: a call that fails after 30 seconds is the interesting
 * one, and a success-only timer hides exactly the latency that matters.
 *
 * The original error is rethrown unchanged — this observes, it does not
 * alter control flow.
 */
export async function timed<T>(
  logger: Logger,
  operation: string,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await work();

    logger.info(`${operation} succeeded`, {
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (cause) {
    logger.exception(`${operation} failed`, cause, {
      durationMs: Date.now() - startedAt,
    });

    throw cause;
  }
}
