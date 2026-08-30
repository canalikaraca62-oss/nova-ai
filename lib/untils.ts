/**
 * SYRAVEN
 * lib/utils.ts
 *
 * Core utility functions.
 *
 * This module contains dependency-free helpers used across:
 *
 * - AI systems
 * - Agents
 * - API routes
 * - Database operations
 * - Billing
 * - Security
 * - Tasks
 * - UI
 */

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Maybe<T> = T | null | undefined;

export type AsyncResult<T> = Promise<T>;

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

/* -------------------------------------------------------------------------- */
/*                              TYPE HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function isDefined<T>(
  value: T | null | undefined
): value is T {
  return value !== null && value !== undefined;
}

export function isString(
  value: unknown
): value is string {
  return typeof value === "string";
}

export function isNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

export function isBoolean(
  value: unknown
): value is boolean {
  return typeof value === "boolean";
}

export function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isArray(
  value: unknown
): value is unknown[] {
  return Array.isArray(value);
}

/* -------------------------------------------------------------------------- */
/*                              STRING HELPERS                                */
/* -------------------------------------------------------------------------- */

export function truncate(
  value: string,
  maxLength: number,
  suffix = "..."
): string {
  if (maxLength <= 0) {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= suffix.length) {
    return value.slice(0, maxLength);
  }

  return (
    value.slice(
      0,
      maxLength - suffix.length
    ) + suffix
  );
}

export function capitalize(
  value: string
): string {
  if (!value) {
    return "";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export function slugify(
  value: string
): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeWhitespace(
  value: string
): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

/* -------------------------------------------------------------------------- */
/*                              NUMBER HELPERS                                */
/* -------------------------------------------------------------------------- */

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    Math.max(value, min),
    max
  );
}

export function round(
  value: number,
  decimals = 2
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}

export function percentage(
  value: number,
  total: number
): number {
  if (total === 0) {
    return 0;
  }

  return (
    value / total
  ) * 100;
}

/* -------------------------------------------------------------------------- */
/*                              ARRAY HELPERS                                 */
/* -------------------------------------------------------------------------- */

export function unique<T>(
  values: readonly T[]
): T[] {
  return Array.from(
    new Set(values)
  );
}

export function uniqueBy<T, K>(
  values: readonly T[],
  getKey: (value: T) => K
): T[] {
  const seen = new Set<K>();

  return values.filter(
    (value) => {
      const key =
        getKey(value);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

export function chunk<T>(
  values: readonly T[],
  size: number
): T[][] {
  if (size <= 0) {
    throw new Error(
      "Chunk size must be greater than zero."
    );
  }

  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

/* -------------------------------------------------------------------------- */
/*                              OBJECT HELPERS                                */
/* -------------------------------------------------------------------------- */

export function omit<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  object: T,
  keys: readonly K[]
): Omit<T, K> {
  const result =
    { ...object };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}

export function pick<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  object: T,
  keys: readonly K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in object) {
      result[key] =
        object[key];
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                              ASYNC HELPERS                                 */
/* -------------------------------------------------------------------------- */

export function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const {
    attempts = 3,
    delay = 500,
    backoff = true,
  } = options;

  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < attempts;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt =
        attempt === attempts - 1;

      if (isLastAttempt) {
        break;
      }

      const waitTime =
        backoff
          ? delay * 2 ** attempt
          : delay;

      await sleep(waitTime);
    }
  }

  throw lastError;
}

/* -------------------------------------------------------------------------- */
/*                              RESULT HELPERS                                */
/* -------------------------------------------------------------------------- */

export function success<T>(
  data: T
): Result<T> {
  return {
    success: true,
    data,
  };
}

export function failure<E = Error>(
  error: E
): Result<never, E> {
  return {
    success: false,
    error,
  };
}

/* -------------------------------------------------------------------------- */
/*                              SAFE PARSING                                  */
/* -------------------------------------------------------------------------- */

export function safeJsonParse<T = unknown>(
  value: string,
  fallback: T | null = null
): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(
  value: unknown,
  fallback = "{}"
): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/*                              ID GENERATION                                 */
/* -------------------------------------------------------------------------- */

export function generateId(
  prefix = "id"
): string {
  const random =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random()
          .toString(36)
          .slice(2);

  return `${prefix}_${random}`;
}

/* -------------------------------------------------------------------------- */
/*                              DATE HELPERS                                  */
/* -------------------------------------------------------------------------- */

export function now(): Date {
  return new Date();
}

export function toISOString(
  value: Date | string | number
): string {
  return new Date(
    value
  ).toISOString();
}

export function isValidDate(
  value: unknown
): value is Date {
  return (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                              ERROR HELPERS                                 */
/* -------------------------------------------------------------------------- */

export function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown error occurred.";
}

export function toError(
  error: unknown
): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(
    getErrorMessage(error)
  );
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

const utils = {
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,

  truncate,
  capitalize,
  slugify,
  normalizeWhitespace,

  clamp,
  round,
  percentage,

  unique,
  uniqueBy,
  chunk,

  omit,
  pick,

  sleep,
  retry,

  success,
  failure,

  safeJsonParse,
  safeJsonStringify,

  generateId,

  now,
  toISOString,
  isValidDate,

  getErrorMessage,
  toError,
};

export default utils;