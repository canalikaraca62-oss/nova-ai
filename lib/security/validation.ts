/**
 * SYRAVEN AI SECURITY VALIDATION
 * Enterprise-grade validation layer
 *
 * Designed for:
 * - Runtime validation
 * - Type-safe validation results
 * - API request validation
 * - Security input validation
 * - SQL / NoSQL injection detection
 * - XSS detection
 * - UUID / URL / email validation
 * - Generic schema validation
 *
 * The validation result architecture intentionally uses a discriminated union.
 * A validation failure is independent of T, preventing:
 *
 * ValidationResult<undefined>
 * not assignable to
 * ValidationResult<string | number | boolean | T>
 */

export type ValidationErrorCode =
  | "REQUIRED"
  | "INVALID_TYPE"
  | "INVALID_FORMAT"
  | "INVALID_LENGTH"
  | "OUT_OF_RANGE"
  | "INVALID_VALUE"
  | "INVALID_EMAIL"
  | "INVALID_URL"
  | "INVALID_UUID"
  | "INVALID_IDENTIFIER"
  | "INVALID_ENUM"
  | "INVALID_ARRAY"
  | "INVALID_OBJECT"
  | "INVALID_JSON"
  | "INVALID_DATE"
  | "INVALID_REQUEST"
  | "SECURITY_VIOLATION"
  | "SQL_INJECTION"
  | "NOSQL_INJECTION"
  | "XSS_ATTEMPT"
  | "DANGEROUS_CONTENT"
  | "SUSPICIOUS_INPUT"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "NOT_FINITE"
  | "UNKNOWN";

export interface ValidationIssue {
  code: ValidationErrorCode;
  message: string;
  path?: string;
  value?: unknown;
}

export interface ValidationSuccess<T> {
  success: true;
  valid: true;
  data: T;
  value: T;
  error?: never;
  errors?: never;
  issues?: never;
}

export interface ValidationFailure {
  success: false;
  valid: false;
  data?: never;
  value?: never;
  error: string;
  errors: string[];
  issues: ValidationIssue[];
}

export type ValidationResult<T> =
  | ValidationSuccess<T>
  | ValidationFailure;

export interface ValidationOptions {
  required?: boolean;
  nullable?: boolean;
  trim?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowEmpty?: boolean;
  fieldName?: string;
}

export interface StringValidationOptions extends ValidationOptions {
  allowWhitespace?: boolean;
}

export interface NumberValidationOptions extends ValidationOptions {
  integer?: boolean;
  positive?: boolean;
  negative?: boolean;
  finite?: boolean;
}

export interface ArrayValidationOptions extends ValidationOptions {
  minItems?: number;
  maxItems?: number;
}

export interface ObjectValidationOptions extends ValidationOptions {
  allowArrays?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              RESULT HELPERS                                */
/* -------------------------------------------------------------------------- */

export function validationSuccess<T>(value: T): ValidationSuccess<T> {
  return {
    success: true,
    valid: true,
    data: value,
    value,
  };
}

export function validationFailure(
  error: string,
  options: {
    code?: ValidationErrorCode;
    path?: string;
    value?: unknown;
    errors?: string[];
    issues?: ValidationIssue[];
  } = {},
): ValidationFailure {
  const issue: ValidationIssue = {
    code: options.code ?? "INVALID_VALUE",
    message: error,
    ...(options.path !== undefined ? { path: options.path } : {}),
    ...(options.value !== undefined ? { value: options.value } : {}),
  };

  return {
    success: false,
    valid: false,
    error,
    errors: options.errors ?? [error],
    issues: options.issues ?? [issue],
  };
}

export const success = validationSuccess;
export const failure = validationFailure;

export function isValidationSuccess<T>(
  result: ValidationResult<T>,
): result is ValidationSuccess<T> {
  return result.success === true;
}

export function isValidationFailure<T>(
  result: ValidationResult<T>,
): result is ValidationFailure {
  return result.success === false;
}

/* -------------------------------------------------------------------------- */
/*                               CORE HELPERS                                 */
/* -------------------------------------------------------------------------- */

function getFieldName(
  options?: ValidationOptions,
  fallback = "Value",
): string {
  return options?.fieldName ?? fallback;
}

function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* -------------------------------------------------------------------------- */
/*                              REQUIRED VALUE                                */
/* -------------------------------------------------------------------------- */

export function validateRequired<T>(
  value: T | null | undefined,
  fieldName = "Value",
): ValidationResult<T> {
  if (value === null || value === undefined) {
    return validationFailure(`${fieldName} is required`, {
      code: "REQUIRED",
      value,
    });
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return validationFailure(`${fieldName} is required`, {
      code: "REQUIRED",
      value,
    });
  }

  return validationSuccess(value);
}

/* -------------------------------------------------------------------------- */
/*                              STRING VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateString(
  value: unknown,
  options: StringValidationOptions = {},
): ValidationResult<string> {
  const fieldName = getFieldName(options);

  if (isNullOrUndefined(value)) {
    if (options.required === false || options.nullable === true) {
      return validationFailure(`${fieldName} must be a string`, {
        code: "INVALID_TYPE",
        value,
      });
    }

    return validationFailure(`${fieldName} is required`, {
      code: "REQUIRED",
      value,
    });
  }

  if (typeof value !== "string") {
    return validationFailure(`${fieldName} must be a string`, {
      code: "INVALID_TYPE",
      value,
    });
  }

  const result = options.trim === true ? value.trim() : value;

  if (options.allowEmpty === false && result.length === 0) {
    return validationFailure(`${fieldName} cannot be empty`, {
      code: "REQUIRED",
      value,
    });
  }

  if (options.allowWhitespace === false && result.trim().length === 0) {
    return validationFailure(`${fieldName} cannot contain only whitespace`, {
      code: "INVALID_VALUE",
      value,
    });
  }

  if (
    typeof options.minLength === "number" &&
    result.length < options.minLength
  ) {
    return validationFailure(
      `${fieldName} must contain at least ${options.minLength} characters`,
      {
        code: "TOO_SHORT",
        value,
      },
    );
  }

  if (
    typeof options.maxLength === "number" &&
    result.length > options.maxLength
  ) {
    return validationFailure(
      `${fieldName} cannot exceed ${options.maxLength} characters`,
      {
        code: "TOO_LONG",
        value,
      },
    );
  }

  if (options.pattern && !options.pattern.test(result)) {
    return validationFailure(`${fieldName} has an invalid format`, {
      code: "INVALID_FORMAT",
      value,
    });
  }

  return validationSuccess(result);
}

export function validateNonEmptyString(
  value: unknown,
  fieldName = "Value",
): ValidationResult<string> {
  return validateString(value, {
    required: true,
    trim: true,
    allowEmpty: false,
    allowWhitespace: false,
    fieldName,
  });
}

export function validateSafeString(
  value: unknown,
  options: StringValidationOptions = {},
): ValidationResult<string> {
  const result = validateString(value, {
    ...options,
    trim: options.trim ?? true,
  });

  if (!result.success) {
    return result;
  }

  const dangerousResult = validateSecurityInput(result.value);

  if (!dangerousResult.success) {
    return dangerousResult;
  }

  return validationSuccess(result.value);
}

/* -------------------------------------------------------------------------- */
/*                              NUMBER VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateNumber(
  value: unknown,
  options: NumberValidationOptions = {},
): ValidationResult<number> {
  const fieldName = getFieldName(options);

  if (isNullOrUndefined(value)) {
    return validationFailure(`${fieldName} is required`, {
      code: "REQUIRED",
      value,
    });
  }

  if (typeof value !== "number") {
    return validationFailure(`${fieldName} must be a number`, {
      code: "INVALID_TYPE",
      value,
    });
  }

  if (options.finite !== false && !Number.isFinite(value)) {
    return validationFailure(`${fieldName} must be a finite number`, {
      code: "NOT_FINITE",
      value,
    });
  }

  if (options.integer === true && !Number.isInteger(value)) {
    return validationFailure(`${fieldName} must be an integer`, {
      code: "INVALID_VALUE",
      value,
    });
  }

  if (options.positive === true && value <= 0) {
    return validationFailure(`${fieldName} must be positive`, {
      code: "OUT_OF_RANGE",
      value,
    });
  }

  if (options.negative === true && value >= 0) {
    return validationFailure(`${fieldName} must be negative`, {
      code: "OUT_OF_RANGE",
      value,
    });
  }

  if (typeof options.min === "number" && value < options.min) {
    return validationFailure(
      `${fieldName} must be greater than or equal to ${options.min}`,
      {
        code: "OUT_OF_RANGE",
        value,
      },
    );
  }

  if (typeof options.max === "number" && value > options.max) {
    return validationFailure(
      `${fieldName} must be less than or equal to ${options.max}`,
      {
        code: "OUT_OF_RANGE",
        value,
      },
    );
  }

  return validationSuccess(value);
}

export function validateInteger(
  value: unknown,
  options: NumberValidationOptions = {},
): ValidationResult<number> {
  return validateNumber(value, {
    ...options,
    integer: true,
  });
}

/* -------------------------------------------------------------------------- */
/*                             BOOLEAN VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateBoolean(
  value: unknown,
  fieldName = "Value",
): ValidationResult<boolean> {
  if (typeof value !== "boolean") {
    return validationFailure(`${fieldName} must be a boolean`, {
      code: "INVALID_TYPE",
      value,
    });
  }

  return validationSuccess(value);
}

/* -------------------------------------------------------------------------- */
/*                               ARRAY VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateArray<T = unknown>(
  value: unknown,
  options: ArrayValidationOptions = {},
): ValidationResult<T[]> {
  const fieldName = getFieldName(options);

  if (!Array.isArray(value)) {
    return validationFailure(`${fieldName} must be an array`, {
      code: "INVALID_ARRAY",
      value,
    });
  }

  if (
    typeof options.minItems === "number" &&
    value.length < options.minItems
  ) {
    return validationFailure(
      `${fieldName} must contain at least ${options.minItems} items`,
      {
        code: "INVALID_LENGTH",
        value,
      },
    );
  }

  if (
    typeof options.maxItems === "number" &&
    value.length > options.maxItems
  ) {
    return validationFailure(
      `${fieldName} cannot contain more than ${options.maxItems} items`,
      {
        code: "INVALID_LENGTH",
        value,
      },
    );
  }

  return validationSuccess(value as T[]);
}

/* -------------------------------------------------------------------------- */
/*                              OBJECT VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateObject(
  value: unknown,
  options: ObjectValidationOptions = {},
): ValidationResult<Record<string, unknown>> {
  const fieldName = getFieldName(options);

  if (
    typeof value !== "object" ||
    value === null ||
    (Array.isArray(value) && options.allowArrays !== true)
  ) {
    return validationFailure(`${fieldName} must be an object`, {
      code: "INVALID_OBJECT",
      value,
    });
  }

  return validationSuccess(value as Record<string, unknown>);
}

/* -------------------------------------------------------------------------- */
/*                                EMAIL VALIDATION                            */
/* -------------------------------------------------------------------------- */

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function validateEmail(
  value: unknown,
  fieldName = "Email",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    trim: true,
    allowEmpty: false,
    maxLength: 254,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  if (!EMAIL_PATTERN.test(result.value)) {
    return validationFailure(`${fieldName} has an invalid format`, {
      code: "INVALID_EMAIL",
      value,
    });
  }

  return validationSuccess(result.value.toLowerCase());
}

/* -------------------------------------------------------------------------- */
/*                                 URL VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateUrl(
  value: unknown,
  options: {
    protocols?: string[];
    fieldName?: string;
  } = {},
): ValidationResult<string> {
  const fieldName = options.fieldName ?? "URL";

  const result = validateString(value, {
    required: true,
    trim: true,
    allowEmpty: false,
    maxLength: 2048,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  try {
    const parsed = new URL(result.value);

    const allowedProtocols = options.protocols ?? [
      "http:",
      "https:",
    ];

    if (!allowedProtocols.includes(parsed.protocol)) {
      return validationFailure(
        `${fieldName} protocol is not allowed`,
        {
          code: "INVALID_URL",
          value,
        },
      );
    }

    return validationSuccess(parsed.toString());
  } catch {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_URL",
      value,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                UUID VALIDATION                             */
/* -------------------------------------------------------------------------- */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(
  value: unknown,
  fieldName = "UUID",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    trim: true,
    allowEmpty: false,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  if (!UUID_PATTERN.test(result.value)) {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_UUID",
      value,
    });
  }

  return validationSuccess(result.value.toLowerCase());
}

export const validateUUID = validateUuid;

/* -------------------------------------------------------------------------- */
/*                            IDENTIFIER VALIDATION                           */
/* -------------------------------------------------------------------------- */

const IDENTIFIER_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function validateIdentifier(
  value: unknown,
  options: {
    fieldName?: string;
    minLength?: number;
    maxLength?: number;
  } = {},
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    trim: true,
    allowEmpty: false,
    minLength: options.minLength ?? 1,
    maxLength: options.maxLength ?? 128,
    fieldName: options.fieldName ?? "Identifier",
  });

  if (!result.success) {
    return result;
  }

  if (!IDENTIFIER_PATTERN.test(result.value)) {
    return validationFailure(
      `${options.fieldName ?? "Identifier"} has an invalid format`,
      {
        code: "INVALID_IDENTIFIER",
        value,
      },
    );
  }

  return validationSuccess(result.value);
}

/* -------------------------------------------------------------------------- */
/*                                ENUM VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateEnum<T extends string | number>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName = "Value",
): ValidationResult<T> {
  if (!allowedValues.includes(value as T)) {
    return validationFailure(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
      {
        code: "INVALID_ENUM",
        value,
      },
    );
  }

  return validationSuccess(value as T);
}

/* -------------------------------------------------------------------------- */
/*                                DATE VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateDate(
  value: unknown,
  fieldName = "Date",
): ValidationResult<Date> {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return validationFailure(`${fieldName} is invalid`, {
        code: "INVALID_DATE",
        value,
      });
    }

    return validationSuccess(value);
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_DATE",
      value,
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_DATE",
      value,
    });
  }

  return validationSuccess(date);
}

/* -------------------------------------------------------------------------- */
/*                                JSON VALIDATION                             */
/* -------------------------------------------------------------------------- */

export function validateJson<T = unknown>(
  value: unknown,
  fieldName = "JSON",
): ValidationResult<T> {
  if (typeof value !== "string") {
    return validationFailure(`${fieldName} must be a JSON string`, {
      code: "INVALID_TYPE",
      value,
    });
  }

  try {
    const parsed = JSON.parse(value) as T;
    return validationSuccess(parsed);
  } catch {
    return validationFailure(`${fieldName} is invalid JSON`, {
      code: "INVALID_JSON",
      value,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                          SECURITY / INJECTION CHECKS                       */
/* -------------------------------------------------------------------------- */

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\bunion\b.*\bselect\b)/i,
  /(\bselect\b.*\bfrom\b)/i,
  /(\binsert\b.*\binto\b)/i,
  /(\bdelete\b.*\bfrom\b)/i,
  /(\bdrop\b.*\btable\b)/i,
  /(\bupdate\b.*\bset\b)/i,
  /(--)/,
  /(\/\*)/,
  /(\*\/)/,
  /(;.*\b(drop|delete|update|insert|select)\b)/i,
  /('\s*or\s*')/i,
  /("\s*or\s*")/i,
  /(\bor\s+1\s*=\s*1)/i,
];

const NOSQL_INJECTION_PATTERNS: RegExp[] = [
  /\$where/i,
  /\$ne/i,
  /\$gt/i,
  /\$gte/i,
  /\$lt/i,
  /\$lte/i,
  /\$regex/i,
  /\$expr/i,
  /\$function/i,
  /\$accumulator/i,
];

const XSS_PATTERNS: RegExp[] = [
  /<script\b[^>]*>/i,
  /<\/script>/i,
  /javascript:/i,
  /vbscript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /onclick\s*=/i,
  /onmouseover\s*=/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
];

export function containsSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) =>
    pattern.test(value),
  );
}

export function containsNoSqlInjection(value: string): boolean {
  return NOSQL_INJECTION_PATTERNS.some((pattern) =>
    pattern.test(value),
  );
}

export function containsXss(value: string): boolean {
  return XSS_PATTERNS.some((pattern) =>
    pattern.test(value),
  );
}

export function containsDangerousContent(value: unknown): boolean {
  if (typeof value === "string") {
    return (
      containsSqlInjection(value) ||
      containsNoSqlInjection(value) ||
      containsXss(value)
    );
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsDangerousContent(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(
      ([key, item]) =>
        containsDangerousContent(key) ||
        containsDangerousContent(item),
    );
  }

  return false;
}

export function containsSuspiciousInjection(
  value: unknown,
): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const suspiciousPatterns = [
    /\$\{/,
    /\{\{/,
    /\}\}/,
    /<%/,
    /%>/,
    /\bexec\b/i,
    /\beval\b/i,
    /\bconstructor\b/i,
    /__proto__/i,
    /prototype\s*\[/i,
  ];

  return suspiciousPatterns.some((pattern) =>
    pattern.test(value),
  );
}

export function validateNoSqlInjection(
  value: unknown,
  fieldName = "Value",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  if (containsNoSqlInjection(result.value)) {
    return validationFailure(
      `${fieldName} contains a potential NoSQL injection attempt`,
      {
        code: "NOSQL_INJECTION",
        value,
      },
    );
  }

  return validationSuccess(result.value);
}

export const validateNoSQLInjection =
  validateNoSqlInjection;

export function validateSqlInjection(
  value: unknown,
  fieldName = "Value",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  if (containsSqlInjection(result.value)) {
    return validationFailure(
      `${fieldName} contains a potential SQL injection attempt`,
      {
        code: "SQL_INJECTION",
        value,
      },
    );
  }

  return validationSuccess(result.value);
}

export function validateSecurityInput(
  value: unknown,
  fieldName = "Input",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    trim: true,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  if (containsSqlInjection(result.value)) {
    return validationFailure(
      `${fieldName} contains a potential SQL injection attempt`,
      {
        code: "SQL_INJECTION",
        value,
      },
    );
  }

  if (containsNoSqlInjection(result.value)) {
    return validationFailure(
      `${fieldName} contains a potential NoSQL injection attempt`,
      {
        code: "NOSQL_INJECTION",
        value,
      },
    );
  }

  if (containsXss(result.value)) {
    return validationFailure(
      `${fieldName} contains potentially dangerous script content`,
      {
        code: "XSS_ATTEMPT",
        value,
      },
    );
  }

  if (containsSuspiciousInjection(result.value)) {
    return validationFailure(
      `${fieldName} contains suspicious input patterns`,
      {
        code: "SUSPICIOUS_INPUT",
        value,
      },
    );
  }

  return validationSuccess(result.value);
}

/* -------------------------------------------------------------------------- */
/*                           GENERIC CUSTOM VALIDATION                        */
/* -------------------------------------------------------------------------- */

export type TypeGuard<T> = (value: unknown) => value is T;

export function validateValue<T>(
  value: unknown,
  validator: TypeGuard<T>,
  fieldName = "Value",
): ValidationResult<T> {
  if (!validator(value)) {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_VALUE",
      value,
    });
  }

  return validationSuccess(value);
}

export function validateWith<T>(
  value: unknown,
  validator: (
    value: unknown,
  ) => ValidationResult<T>,
): ValidationResult<T> {
  return validator(value);
}

/* -------------------------------------------------------------------------- */
/*                          REQUEST / API VALIDATION                          */
/* -------------------------------------------------------------------------- */

export interface RequestValidationOptions {
  requireObject?: boolean;
  maxKeys?: number;
  rejectDangerousContent?: boolean;
  fieldName?: string;
}

export function validateRequest(
  value: unknown,
  options: RequestValidationOptions = {},
): ValidationResult<Record<string, unknown>> {
  const fieldName = options.fieldName ?? "Request";

  const objectResult = validateObject(value, {
    fieldName,
  });

  if (!objectResult.success) {
    return objectResult;
  }

  const request = objectResult.value;

  if (
    typeof options.maxKeys === "number" &&
    Object.keys(request).length > options.maxKeys
  ) {
    return validationFailure(
      `${fieldName} contains too many properties`,
      {
        code: "INVALID_REQUEST",
        value,
      },
    );
  }

  if (
    options.rejectDangerousContent !== false &&
    containsDangerousContent(request)
  ) {
    return validationFailure(
      `${fieldName} contains dangerous content`,
      {
        code: "DANGEROUS_CONTENT",
        value,
      },
    );
  }

  return validationSuccess(request);
}

/* -------------------------------------------------------------------------- */
/*                         VALIDATION RESULT COMBINERS                        */
/* -------------------------------------------------------------------------- */

export function combineValidationResults<T>(
  results: readonly ValidationResult<T>[],
): ValidationResult<T[]> {
  const values: T[] = [];
  const errors: string[] = [];
  const issues: ValidationIssue[] = [];

  for (const result of results) {
    if (result.success) {
      values.push(result.value);
    } else {
      errors.push(...result.errors);
      issues.push(...result.issues);
    }
  }

  if (errors.length > 0) {
    return validationFailure(errors[0] ?? "Validation failed", {
      code: issues[0]?.code ?? "INVALID_VALUE",
      errors,
      issues,
    });
  }

  return validationSuccess(values);
}

export function combineValidationResult<T extends Record<string, unknown>>(
  results: Record<string, ValidationResult<unknown>>,
): ValidationResult<T> {
  const output: Record<string, unknown> = {};
  const errors: string[] = [];
  const issues: ValidationIssue[] = [];

  for (const [key, result] of Object.entries(results)) {
    if (result.success) {
      output[key] = result.value;
    } else {
      errors.push(...result.errors);
      issues.push(
        ...result.issues.map((issue) => ({
          ...issue,
          path: issue.path ?? key,
        })),
      );
    }
  }

  if (errors.length > 0) {
    return validationFailure(errors[0] ?? "Validation failed", {
      code: issues[0]?.code ?? "INVALID_VALUE",
      errors,
      issues,
    });
  }

  return validationSuccess(output as T);
}

/* -------------------------------------------------------------------------- */
/*                              ASSERTION HELPERS                             */
/* -------------------------------------------------------------------------- */

export function assertValid<T>(
  result: ValidationResult<T>,
): T {
  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}

export function assertValidation<T>(
  result: ValidationResult<T>,
  message?: string,
): asserts result is ValidationSuccess<T> {
  if (!result.success) {
    throw new Error(message ?? result.error);
  }
}

/* -------------------------------------------------------------------------- */
/*                               SANITIZATION                                 */
/* -------------------------------------------------------------------------- */

export function sanitizeString(value: string): string {
  return value
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008]/g, "")
    .replace(/[\u000B-\u000C]/g, "")
    .replace(/[\u000E-\u001F]/g, "")
    .trim();
}

export function sanitizeHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

export function sanitizeObject<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeObject(item),
    ) as T;
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
        continue;
      }

      output[key] = sanitizeObject(item);
    }

    return output as T;
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/*                              SPECIAL VALIDATORS                            */
/* -------------------------------------------------------------------------- */

export function validatePort(
  value: unknown,
): ValidationResult<number> {
  return validateNumber(value, {
    fieldName: "Port",
    integer: true,
    min: 1,
    max: 65535,
  });
}

export function validatePercentage(
  value: unknown,
  fieldName = "Percentage",
): ValidationResult<number> {
  return validateNumber(value, {
    fieldName,
    min: 0,
    max: 100,
  });
}

export function validatePositiveNumber(
  value: unknown,
  fieldName = "Value",
): ValidationResult<number> {
  return validateNumber(value, {
    fieldName,
    positive: true,
  });
}

export function validateSlug(
  value: unknown,
  fieldName = "Slug",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    trim: true,
    minLength: 1,
    maxLength: 128,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  const slugPattern =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugPattern.test(result.value)) {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_FORMAT",
      value,
    });
  }

  return validationSuccess(result.value);
}

export function validateIpAddress(
  value: unknown,
  fieldName = "IP address",
): ValidationResult<string> {
  const result = validateString(value, {
    required: true,
    trim: true,
    fieldName,
  });

  if (!result.success) {
    return result;
  }

  const ipv4Pattern =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  const ipv6Pattern =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

  if (
    !ipv4Pattern.test(result.value) &&
    !ipv6Pattern.test(result.value)
  ) {
    return validationFailure(`${fieldName} is invalid`, {
      code: "INVALID_FORMAT",
      value,
    });
  }

  return validationSuccess(result.value);
}

/* -------------------------------------------------------------------------- */
/*                            VALIDATION SCHEMA                               */
/* -------------------------------------------------------------------------- */

export type ValidationSchema<T extends Record<string, unknown>> = {
  [K in keyof T]: (
    value: unknown,
  ) => ValidationResult<T[K]>;
};

export function validateSchema<T extends Record<string, unknown>>(
  value: unknown,
  schema: ValidationSchema<T>,
): ValidationResult<T> {
  const objectResult = validateObject(value);

  if (!objectResult.success) {
    return objectResult;
  }

  const source = objectResult.value;
  const output: Partial<T> = {};
  const errors: string[] = [];
  const issues: ValidationIssue[] = [];

  for (const key of Object.keys(schema) as Array<keyof T>) {
    const validator = schema[key];
    const result = validator(source[key as string]);

    if (result.success) {
      output[key] = result.value;
    } else {
      errors.push(...result.errors);

      issues.push(
        ...result.issues.map((issue) => ({
          ...issue,
          path: issue.path ?? String(key),
        })),
      );
    }
  }

  if (errors.length > 0) {
    return validationFailure(
      errors[0] ?? "Schema validation failed",
      {
        code: issues[0]?.code ?? "INVALID_VALUE",
        errors,
        issues,
      },
    );
  }

  return validationSuccess(output as T);
}

/* -------------------------------------------------------------------------- */
/*                              UTILITY HELPERS                               */
/* -------------------------------------------------------------------------- */

export function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);

  return Object.keys(value).every((key) =>
    allowed.has(key),
  );
}

export function validateAllowedKeys(
  value: unknown,
  allowedKeys: readonly string[],
  fieldName = "Object",
): ValidationResult<Record<string, unknown>> {
  const objectResult = validateObject(value, {
    fieldName,
  });

  if (!objectResult.success) {
    return objectResult;
  }

  if (
    !hasOnlyAllowedKeys(
      objectResult.value,
      allowedKeys,
    )
  ) {
    const invalidKeys = Object.keys(
      objectResult.value,
    ).filter(
      (key) => !allowedKeys.includes(key),
    );

    return validationFailure(
      `${fieldName} contains unknown properties: ${invalidKeys.join(", ")}`,
      {
        code: "INVALID_OBJECT",
        value,
      },
    );
  }

  return validationSuccess(objectResult.value);
}

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

export const validation = {
  success: validationSuccess,
  failure: validationFailure,

  validateRequired,

  validateString,
  validateNonEmptyString,
  validateSafeString,

  validateNumber,
  validateInteger,
  validatePositiveNumber,
  validatePercentage,

  validateBoolean,
  validateArray,
  validateObject,

  validateEmail,
  validateUrl,
  validateUuid,
  validateUUID,
  validateIdentifier,
  validateEnum,
  validateDate,
  validateJson,

  validateSqlInjection,
  validateNoSqlInjection,
  validateNoSQLInjection,
  validateSecurityInput,

  validateValue,
  validateWith,

  validateRequest,

  validatePort,
  validateSlug,
  validateIpAddress,

  validateSchema,
  validateAllowedKeys,

  containsSqlInjection,
  containsNoSqlInjection,
  containsXss,
  containsDangerousContent,
  containsSuspiciousInjection,

  combineValidationResults,
  combineValidationResult,

  sanitizeString,
  sanitizeHtml,
  sanitizeObject,

  assertValid,
  assertValidation,

  isValidationSuccess,
  isValidationFailure,
};

export default validation;