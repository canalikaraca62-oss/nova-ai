/**
 * SYRAVEN API Types
 *
 * Shared enterprise-grade API contracts.
 *
 * Features:
 * - Standard API responses
 * - Typed success/error responses
 * - Pagination
 * - Cursor pagination
 * - API errors
 * - Validation errors
 * - Request metadata
 * - Authentication context
 * - Rate limit information
 * - Endpoint result helpers
 * - Strict TypeScript compatibility
 */

/* -------------------------------------------------------------------------- */
/*                                PRIMITIVES                                  */
/* -------------------------------------------------------------------------- */

export type ApiId = string;

export type ApiTimestamp = string;

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type HttpStatusCode =
  | 100
  | 101
  | 102
  | 103
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226
  | 300
  | 301
  | 302
  | 303
  | 304
  | 307
  | 308
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511;

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ALREADY_EXISTS"
  | "METHOD_NOT_ALLOWED"
  | "NOT_ACCEPTABLE"
  | "REQUEST_TIMEOUT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "PAYMENT_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "FEATURE_NOT_AVAILABLE"
  | "RESOURCE_LOCKED"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  | "DEPENDENCY_ERROR"
  | "DATABASE_ERROR"
  | "INTEGRATION_ERROR"
  | "AI_PROVIDER_ERROR"
  | "TASK_FAILED"
  | "DOCUMENT_PROCESSING_ERROR"
  | "UNKNOWN_ERROR"
  | (string & {});

/* -------------------------------------------------------------------------- */
/*                               API METADATA                                 */
/* -------------------------------------------------------------------------- */

export interface ApiResponseMeta {
  requestId?: string;

  timestamp?: ApiTimestamp;

  version?: string;

  traceId?: string;

  durationMs?: number;

  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*                                API ERROR                                   */
/* -------------------------------------------------------------------------- */

export interface ApiFieldError {
  field?: string;

  code?: string;

  message: string;

  value?: unknown;
}

export interface ApiError {
  code: ApiErrorCode;

  message: string;

  status?: HttpStatusCode;

  details?: unknown;

  fields?: ApiFieldError[];

  retryable?: boolean;

  retryAfter?: number;

  requestId?: string;

  timestamp?: ApiTimestamp;
}

export interface ApiErrorResponse {
  success: false;

  error: ApiError;

  meta?: ApiResponseMeta;
}

/* -------------------------------------------------------------------------- */
/*                              API SUCCESS                                   */
/* -------------------------------------------------------------------------- */

export interface ApiSuccessResponse<T = unknown> {
  success: true;

  data: T;

  meta?: ApiResponseMeta;
}

/* -------------------------------------------------------------------------- */
/*                               API RESPONSE                                 */
/* -------------------------------------------------------------------------- */

export type ApiResponse<T = unknown> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;

export type ApiResult<T = unknown> =
  | {
      ok: true;

      data: T;

      meta?: ApiResponseMeta;
    }
  | {
      ok: false;

      error: ApiError;

      meta?: ApiResponseMeta;
    };

/* -------------------------------------------------------------------------- */
/*                               PAGINATION                                   */
/* -------------------------------------------------------------------------- */

export interface PaginationParams {
  page?: number;

  limit?: number;
}

export interface PaginationMeta {
  page: number;

  limit: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];

  pagination: PaginationMeta;
}

export interface PaginatedApiResponse<T>
  extends ApiSuccessResponse<
    PaginatedData<T>
  > {
  success: true;
}

/* -------------------------------------------------------------------------- */
/*                            CURSOR PAGINATION                               */
/* -------------------------------------------------------------------------- */

export interface CursorPaginationParams {
  cursor?: string;

  limit?: number;
}

export interface CursorPaginationMeta {
  cursor?: string;

  nextCursor?: string;

  previousCursor?: string;

  limit: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
}

export interface CursorPaginatedData<T> {
  items: T[];

  pagination: CursorPaginationMeta;
}

export interface CursorPaginatedApiResponse<T>
  extends ApiSuccessResponse<
    CursorPaginatedData<T>
  > {
  success: true;
}

/* -------------------------------------------------------------------------- */
/*                               SORTING                                      */
/* -------------------------------------------------------------------------- */

export type SortDirection =
  | "asc"
  | "desc";

export interface SortParams {
  sortBy?: string;

  sortOrder?: SortDirection;
}

/* -------------------------------------------------------------------------- */
/*                               FILTERING                                    */
/* -------------------------------------------------------------------------- */

export type ApiFilterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export interface ApiFilters {
  [key: string]: ApiFilterValue | undefined;
}

/* -------------------------------------------------------------------------- */
/*                              LIST PARAMETERS                               */
/* -------------------------------------------------------------------------- */

export interface ApiListParams
  extends PaginationParams,
    SortParams {
  filters?: ApiFilters;
}

export interface CursorApiListParams
  extends CursorPaginationParams,
    SortParams {
  filters?: ApiFilters;
}

/* -------------------------------------------------------------------------- */
/*                             REQUEST CONTEXT                                */
/* -------------------------------------------------------------------------- */

export interface ApiRequestContext {
  requestId?: string;

  traceId?: string;

  method?: HttpMethod;

  path?: string;

  ip?: string;

  userAgent?: string;

  locale?: string;

  timezone?: string;

  headers?: Record<
    string,
    string | undefined
  >;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                           AUTHENTICATION CONTEXT                           */
/* -------------------------------------------------------------------------- */

export type ApiAuthType =
  | "none"
  | "session"
  | "bearer"
  | "api_key"
  | "service"
  | "internal";

export interface ApiAuthContext {
  authenticated: boolean;

  type: ApiAuthType;

  userId?: string;

  workspaceId?: string;

  organizationId?: string;

  sessionId?: string;

  apiKeyId?: string;

  scopes?: string[];

  roles?: string[];

  permissions?: string[];
}

/* -------------------------------------------------------------------------- */
/*                              REQUEST CONTEXT                               */
/* -------------------------------------------------------------------------- */

export interface ApiContext {
  request: ApiRequestContext;

  auth: ApiAuthContext;

  metadata?: Record<
    string,
    unknown
  >;
}

/* -------------------------------------------------------------------------- */
/*                               RATE LIMIT                                   */
/* -------------------------------------------------------------------------- */

export interface ApiRateLimit {
  limit: number;

  remaining: number;

  reset: number;

  retryAfter?: number;
}

export interface ApiRateLimitedResponse
  extends ApiErrorResponse {
  success: false;

  error: ApiError & {
    code:
      | "RATE_LIMITED"
      | "TOO_MANY_REQUESTS"
      | (string & {});
  };

  rateLimit?: ApiRateLimit;
}

/* -------------------------------------------------------------------------- */
/*                              ENDPOINT TYPES                                */
/* -------------------------------------------------------------------------- */

export type ApiEndpointHandler<
  TInput = unknown,
  TOutput = unknown
> = (
  input: TInput,
  context: ApiContext
) =>
  | Promise<ApiResponse<TOutput>>
  | ApiResponse<TOutput>;

export type ApiServiceHandler<
  TInput = unknown,
  TOutput = unknown
> = (
  input: TInput,
  context?: ApiContext
) =>
  | Promise<TOutput>
  | TOutput;

/* -------------------------------------------------------------------------- */
/*                              API REQUEST                                   */
/* -------------------------------------------------------------------------- */

export interface ApiRequest<
  TBody = unknown,
  TQuery extends Record<
    string,
    unknown
  > = Record<string, unknown>,
  TParams extends Record<
    string,
    string
  > = Record<string, string>
> {
  body?: TBody;

  query?: TQuery;

  params?: TParams;

  context?: ApiContext;
}

/* -------------------------------------------------------------------------- */
/*                              BULK OPERATIONS                               */
/* -------------------------------------------------------------------------- */

export interface ApiBulkRequest<T> {
  items: T[];

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ApiBulkItemResult<
  T = unknown
> {
  index: number;

  success: boolean;

  data?: T;

  error?: ApiError;
}

export interface ApiBulkResult<T = unknown> {
  success: boolean;

  total: number;

  succeeded: number;

  failed: number;

  results: Array<
    ApiBulkItemResult<T>
  >;
}

/* -------------------------------------------------------------------------- */
/*                                DELETE                                      */
/* -------------------------------------------------------------------------- */

export interface ApiDeleteResult {
  id: string;

  deleted: boolean;

  deletedAt?: ApiTimestamp;
}

/* -------------------------------------------------------------------------- */
/*                                HEALTH                                      */
/* -------------------------------------------------------------------------- */

export type ApiHealthStatus =
  | "healthy"
  | "degraded"
  | "unhealthy";

export interface ApiHealthCheck {
  name: string;

  status: ApiHealthStatus;

  message?: string;

  latencyMs?: number;

  details?: Record<
    string,
    unknown
  >;
}

export interface ApiHealthResponse {
  status: ApiHealthStatus;

  timestamp: ApiTimestamp;

  version?: string;

  uptime?: number;

  checks?: ApiHealthCheck[];
}

/* -------------------------------------------------------------------------- */
/*                             RESPONSE HELPERS                               */
/* -------------------------------------------------------------------------- */

export function createApiMeta(
  meta: ApiResponseMeta = {}
): ApiResponseMeta {
  return {
    timestamp:
      meta.timestamp ??
      new Date().toISOString(),

    ...meta,
  };
}

export function apiSuccess<T>(
  data: T,
  meta?: ApiResponseMeta
): ApiSuccessResponse<T> {
  return {
    success: true,

    data,

    meta: meta
      ? createApiMeta(meta)
      : undefined,
  };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options: Partial<ApiError> = {},
  meta?: ApiResponseMeta
): ApiErrorResponse {
  const error: ApiError = {
    code,

    message,

    status:
      options.status,

    details:
      options.details,

    fields:
      options.fields,

    retryable:
      options.retryable,

    retryAfter:
      options.retryAfter,

    requestId:
      options.requestId,

    timestamp:
      options.timestamp ??
      new Date().toISOString(),
  };

  return {
    success: false,

    error,

    meta: meta
      ? createApiMeta(meta)
      : undefined,
  };
}

export function apiValidationError(
  fields: ApiFieldError[],
  message = "Validation failed.",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "VALIDATION_ERROR",
    message,
    {
      status: 422,
      fields,
      retryable: false,
    },
    meta
  );
}

export function apiNotFound(
  resource = "Resource",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "NOT_FOUND",
    `${resource} not found.`,
    {
      status: 404,
      retryable: false,
    },
    meta
  );
}

export function apiUnauthorized(
  message = "Authentication required.",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "UNAUTHORIZED",
    message,
    {
      status: 401,
      retryable: false,
    },
    meta
  );
}

export function apiForbidden(
  message = "You do not have permission to perform this action.",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "FORBIDDEN",
    message,
    {
      status: 403,
      retryable: false,
    },
    meta
  );
}

export function apiConflict(
  message = "Resource conflict.",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "CONFLICT",
    message,
    {
      status: 409,
      retryable: false,
    },
    meta
  );
}

export function apiRateLimited(
  retryAfter?: number,
  meta?: ApiResponseMeta
): ApiRateLimitedResponse {
  const response = apiError(
    "RATE_LIMITED",
    "Too many requests. Please try again later.",
    {
      status: 429,
      retryable: true,
      retryAfter,
    },
    meta
  );

  return {
    ...response,

    rateLimit:
      retryAfter !== undefined
        ? {
            limit: 0,
            remaining: 0,
            reset:
              Date.now() +
              retryAfter * 1000,
            retryAfter,
          }
        : undefined,
  };
}

export function apiInternalError(
  message = "An unexpected internal error occurred.",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "INTERNAL_ERROR",
    message,
    {
      status: 500,
      retryable: false,
    },
    meta
  );
}

export function apiServiceUnavailable(
  message = "Service is temporarily unavailable.",
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return apiError(
    "SERVICE_UNAVAILABLE",
    message,
    {
      status: 503,
      retryable: true,
    },
    meta
  );
}

/* -------------------------------------------------------------------------- */
/*                          PAGINATION HELPERS                                */
/* -------------------------------------------------------------------------- */

export function normalizePagination(
  params: PaginationParams = {},
  defaults: {
    page?: number;
    limit?: number;
    maxLimit?: number;
  } = {}
): Required<PaginationParams> {
  const defaultPage =
    defaults.page ?? 1;

  const defaultLimit =
    defaults.limit ?? 50;

  const maxLimit =
    defaults.maxLimit ?? 100;

  const rawPage =
    params.page ?? defaultPage;

  const rawLimit =
    params.limit ?? defaultLimit;

  const page =
    Number.isFinite(rawPage) &&
    rawPage > 0
      ? Math.floor(rawPage)
      : defaultPage;

  const limit =
    Number.isFinite(rawLimit) &&
    rawLimit > 0
      ? Math.min(
          Math.floor(rawLimit),
          maxLimit
        )
      : defaultLimit;

  return {
    page,
    limit,
  };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const safePage =
    Math.max(
      1,
      Math.floor(page)
    );

  const safeLimit =
    Math.max(
      1,
      Math.floor(limit)
    );

  const safeTotal =
    Math.max(
      0,
      Math.floor(total)
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        safeTotal / safeLimit
      )
    );

  return {
    page: safePage,

    limit: safeLimit,

    total: safeTotal,

    totalPages,

    hasNextPage:
      safePage < totalPages,

    hasPreviousPage:
      safePage > 1,
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  options: {
    page: number;
    limit: number;
    total: number;
    meta?: ApiResponseMeta;
  }
): PaginatedApiResponse<T> {
  return apiSuccess(
    {
      items,

      pagination:
        createPaginationMeta(
          options.page,
          options.limit,
          options.total
        ),
    },
    options.meta
  );
}

export function createCursorPaginatedResponse<T>(
  items: T[],
  pagination: CursorPaginationMeta,
  meta?: ApiResponseMeta
): CursorPaginatedApiResponse<T> {
  return apiSuccess(
    {
      items,

      pagination,
    },
    meta
  );
}

/* -------------------------------------------------------------------------- */
/*                              RESULT HELPERS                                */
/* -------------------------------------------------------------------------- */

export function apiOk<T>(
  data: T,
  meta?: ApiResponseMeta
): ApiResult<T> {
  return {
    ok: true,

    data,

    meta,
  };
}

export function apiFail(
  error: ApiError,
  meta?: ApiResponseMeta
): ApiResult<never> {
  return {
    ok: false,

    error,

    meta,
  };
}

export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

export function isApiError<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return response.success === false;
}

export function isApiResultOk<T>(
  result: ApiResult<T>
): result is {
  ok: true;
  data: T;
  meta?: ApiResponseMeta;
} {
  return result.ok === true;
}

export function isApiResultError<T>(
  result: ApiResult<T>
): result is {
  ok: false;
  error: ApiError;
  meta?: ApiResponseMeta;
} {
  return result.ok === false;
}

/* -------------------------------------------------------------------------- */
/*                            STATUS CODE HELPERS                             */
/* -------------------------------------------------------------------------- */

export function getHttpStatusForError(
  code: ApiErrorCode
): HttpStatusCode {
  switch (code) {
    case "BAD_REQUEST":
    case "VALIDATION_ERROR":
      return 400;

    case "UNAUTHORIZED":
      return 401;

    case "PAYMENT_REQUIRED":
    case "SUBSCRIPTION_REQUIRED":
      return 402;

    case "FORBIDDEN":
    case "FEATURE_NOT_AVAILABLE":
      return 403;

    case "NOT_FOUND":
      return 404;

    case "METHOD_NOT_ALLOWED":
      return 405;

    case "NOT_ACCEPTABLE":
      return 406;

    case "REQUEST_TIMEOUT":
      return 408;

    case "CONFLICT":
    case "ALREADY_EXISTS":
      return 409;

    case "PAYLOAD_TOO_LARGE":
      return 413;

    case "UNSUPPORTED_MEDIA_TYPE":
      return 415;

    case "RESOURCE_LOCKED":
      return 423;

    case "RATE_LIMITED":
    case "TOO_MANY_REQUESTS":
    case "QUOTA_EXCEEDED":
      return 429;

    case "SERVICE_UNAVAILABLE":
    case "DEPENDENCY_ERROR":
    case "AI_PROVIDER_ERROR":
    case "INTEGRATION_ERROR":
      return 503;

    case "GATEWAY_TIMEOUT":
      return 504;

    case "INTERNAL_ERROR":
    case "DATABASE_ERROR":
    case "TASK_FAILED":
    case "DOCUMENT_PROCESSING_ERROR":
    case "UNKNOWN_ERROR":
    default:
      return 500;
  }
}

/* -------------------------------------------------------------------------- */
/*                              ERROR NORMALIZER                              */
/* -------------------------------------------------------------------------- */

export function normalizeApiError(
  error: unknown,
  fallbackCode: ApiErrorCode =
    "INTERNAL_ERROR"
): ApiError {
  if (
    error &&
    typeof error === "object"
  ) {
    const candidate =
      error as Partial<ApiError>;

    if (
      typeof candidate.code ===
        "string" &&
      typeof candidate.message ===
        "string"
    ) {
      return {
        code: candidate.code,

        message:
          candidate.message,

        status:
          candidate.status ??
          getHttpStatusForError(
            candidate.code
          ),

        details:
          candidate.details,

        fields:
          candidate.fields,

        retryable:
          candidate.retryable,

        retryAfter:
          candidate.retryAfter,

        requestId:
          candidate.requestId,

        timestamp:
          candidate.timestamp ??
          new Date().toISOString(),
      };
    }
  }

  if (
    error instanceof Error
  ) {
    return {
      code: fallbackCode,

      message: error.message,

      status:
        getHttpStatusForError(
          fallbackCode
        ),

      details: {
        name: error.name,
      },

      retryable: false,

      timestamp:
        new Date().toISOString(),
    };
  }

  if (
    typeof error === "string"
  ) {
    return {
      code: fallbackCode,

      message: error,

      status:
        getHttpStatusForError(
          fallbackCode
        ),

      retryable: false,

      timestamp:
        new Date().toISOString(),
    };
  }

  return {
    code: fallbackCode,

    message:
      "An unexpected error occurred.",

    status:
      getHttpStatusForError(
        fallbackCode
      ),

    retryable: false,

    timestamp:
      new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

export const DEFAULT_API_PAGE =
  1;

export const DEFAULT_API_LIMIT =
  50;

export const MAX_API_LIMIT =
  100;

export const API_SUCCESS_STATUS =
  200 as const;

export const API_CREATED_STATUS =
  201 as const;

export const API_NO_CONTENT_STATUS =
  204 as const;

export const API_BAD_REQUEST_STATUS =
  400 as const;

export const API_UNAUTHORIZED_STATUS =
  401 as const;

export const API_FORBIDDEN_STATUS =
  403 as const;

export const API_NOT_FOUND_STATUS =
  404 as const;

export const API_CONFLICT_STATUS =
  409 as const;

export const API_VALIDATION_STATUS =
  422 as const;

export const API_RATE_LIMIT_STATUS =
  429 as const;

export const API_INTERNAL_ERROR_STATUS =
  500 as const;

export const API_SERVICE_UNAVAILABLE_STATUS =
  503 as const;