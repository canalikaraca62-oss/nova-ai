/**
 * SYRAVEN Integrations - Shared Types
 *
 * Central type system for all third-party integrations.
 *
 * Supported providers:
 * - Gmail
 * - Google Calendar
 * - GitHub
 * - Slack
 * - Notion
 *
 * This file contains provider-independent contracts.
 * Provider-specific API types should remain inside
 * their respective integration service files.
 */

/* -------------------------------------------------------------------------- */
/*                               PROVIDERS                                    */
/* -------------------------------------------------------------------------- */

export type IntegrationProvider =
  | "gmail"
  | "calendar"
  | "github"
  | "slack"
  | "notion";

export const INTEGRATION_PROVIDERS = [
  "gmail",
  "calendar",
  "github",
  "slack",
  "notion",
] as const;

/* -------------------------------------------------------------------------- */
/*                                STATUS                                      */
/* -------------------------------------------------------------------------- */

export type IntegrationStatus =
  | "active"
  | "inactive"
  | "expired"
  | "revoked"
  | "error"
  | "pending";

export const INTEGRATION_STATUSES = [
  "active",
  "inactive",
  "expired",
  "revoked",
  "error",
  "pending",
] as const;

/* -------------------------------------------------------------------------- */
/*                              AUTH TYPES                                    */
/* -------------------------------------------------------------------------- */

export type IntegrationAuthType =
  | "oauth2"
  | "api_key"
  | "personal_access_token"
  | "bot_token"
  | "service_account"
  | "custom";

export const INTEGRATION_AUTH_TYPES = [
  "oauth2",
  "api_key",
  "personal_access_token",
  "bot_token",
  "service_account",
  "custom",
] as const;

/* -------------------------------------------------------------------------- */
/*                             PERMISSIONS                                    */
/* -------------------------------------------------------------------------- */

export type IntegrationPermission =
  | "read"
  | "write"
  | "delete"
  | "admin";

export interface IntegrationScope {
  id: string;
  name: string;
  description?: string;
}

/* -------------------------------------------------------------------------- */
/*                              CREDENTIALS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Base credential structure.
 *
 * Never expose sensitive credentials to the client.
 * Tokens should remain server-side only.
 */
export interface IntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;

  apiKey?: string;

  expiresAt?: string | Date;

  tokenType?: string;

  scopes?: string[];

  metadata?: Record<string, unknown>;
}

/**
 * OAuth credentials.
 */
export interface OAuthIntegrationCredentials
  extends IntegrationCredentials {
  accessToken: string;

  refreshToken?: string;

  expiresAt?: string | Date;

  tokenType?: string;

  scopes?: string[];
}

/**
 * API key credentials.
 */
export interface ApiKeyIntegrationCredentials
  extends IntegrationCredentials {
  apiKey: string;
}

/**
 * Bot token credentials.
 */
export interface BotTokenIntegrationCredentials
  extends IntegrationCredentials {
  accessToken: string;
}

/* -------------------------------------------------------------------------- */
/*                              CONNECTION                                    */
/* -------------------------------------------------------------------------- */

export interface IntegrationConnection {
  id: string;

  userId: string;

  provider: IntegrationProvider;

  status: IntegrationStatus;

  authType: IntegrationAuthType;

  displayName?: string;

  externalAccountId?: string;

  externalAccountEmail?: string;

  scopes?: string[];

  connectedAt: string;

  updatedAt?: string;

  expiresAt?: string;

  lastSyncedAt?: string;

  lastError?: IntegrationErrorInfo | null;

  metadata?: Record<string, unknown>;
}

/**
 * Internal connection including credentials.
 *
 * SERVER ONLY.
 */
export interface IntegrationConnectionWithCredentials
  extends IntegrationConnection {
  credentials: IntegrationCredentials;
}

/**
 * Safe connection representation.
 *
 * No tokens or secrets.
 */
export type PublicIntegrationConnection =
  IntegrationConnection;

/* -------------------------------------------------------------------------- */
/*                                 CONFIG                                     */
/* -------------------------------------------------------------------------- */

export interface IntegrationConfig {
  provider: IntegrationProvider;

  enabled: boolean;

  displayName: string;

  description?: string;

  authType: IntegrationAuthType;

  icon?: string;

  website?: string;

  documentationUrl?: string;

  requiredScopes?: string[];

  optionalScopes?: string[];

  metadata?: Record<string, unknown>;
}

export type IntegrationConfigs = Record<
  IntegrationProvider,
  IntegrationConfig
>;

/* -------------------------------------------------------------------------- */
/*                                  ERROR                                     */
/* -------------------------------------------------------------------------- */

export interface IntegrationErrorInfo {
  message: string;

  code?: string;

  status?: number;

  provider?: IntegrationProvider;

  retryable?: boolean;

  timestamp?: string;

  details?: Record<string, unknown>;
}

export class IntegrationError extends Error {
  public readonly provider?: IntegrationProvider;

  public readonly code?: string;

  public readonly status?: number;

  public readonly retryable: boolean;

  public readonly details?: Record<
    string,
    unknown
  >;

  constructor(
    message: string,
    options: {
      provider?: IntegrationProvider;
      code?: string;
      status?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = "IntegrationError";

    this.provider = options.provider;
    this.code = options.code;
    this.status = options.status;
    this.retryable =
      options.retryable ?? false;
    this.details = options.details;

    if (options.cause !== undefined) {
      (
        this as Error & {
          cause?: unknown;
        }
      ).cause = options.cause;
    }
  }

  toJSON(): IntegrationErrorInfo {
    return {
      message: this.message,
      code: this.code,
      status: this.status,
      provider: this.provider,
      retryable: this.retryable,
      timestamp: new Date().toISOString(),
      details: this.details,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                                RESULTS                                     */
/* -------------------------------------------------------------------------- */

export interface IntegrationResult<T> {
  success: boolean;

  data?: T;

  error?: IntegrationErrorInfo;

  metadata?: Record<string, unknown>;
}

export interface IntegrationListResult<T> {
  success: boolean;

  data: T[];

  nextCursor?: string | null;

  hasMore?: boolean;

  total?: number;

  error?: IntegrationErrorInfo;
}

export interface IntegrationActionResult<T = unknown> {
  success: boolean;

  data?: T;

  message?: string;

  error?: IntegrationErrorInfo;
}

/* -------------------------------------------------------------------------- */
/*                                PAGINATION                                  */
/* -------------------------------------------------------------------------- */

export interface IntegrationPagination {
  limit?: number;

  cursor?: string;

  page?: number;

  pageSize?: number;
}

export interface IntegrationPaginationResult {
  nextCursor?: string | null;

  previousCursor?: string | null;

  hasMore: boolean;

  total?: number;
}

/* -------------------------------------------------------------------------- */
/*                                  SYNC                                      */
/* -------------------------------------------------------------------------- */

export type IntegrationSyncStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export const INTEGRATION_SYNC_STATUSES = [
  "idle",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export interface IntegrationSyncOptions {
  fullSync?: boolean;

  force?: boolean;

  cursor?: string;

  since?: string;

  metadata?: Record<string, unknown>;
}

export interface IntegrationSyncResult {
  provider: IntegrationProvider;

  connectionId: string;

  status: IntegrationSyncStatus;

  startedAt?: string;

  completedAt?: string;

  itemsProcessed?: number;

  itemsCreated?: number;

  itemsUpdated?: number;

  itemsDeleted?: number;

  cursor?: string | null;

  error?: IntegrationErrorInfo;
}

/* -------------------------------------------------------------------------- */
/*                                EVENTS                                      */
/* -------------------------------------------------------------------------- */

export type IntegrationEventType =
  | "connection.created"
  | "connection.updated"
  | "connection.deleted"
  | "connection.expired"
  | "connection.revoked"
  | "sync.started"
  | "sync.completed"
  | "sync.failed"
  | "data.created"
  | "data.updated"
  | "data.deleted";

export interface IntegrationEvent<T = unknown> {
  id: string;

  type: IntegrationEventType;

  provider: IntegrationProvider;

  connectionId: string;

  userId: string;

  timestamp: string;

  data?: T;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               WEBHOOK                                      */
/* -------------------------------------------------------------------------- */

export interface IntegrationWebhookEvent<
  T = unknown
> {
  provider: IntegrationProvider;

  eventType: string;

  eventId?: string;

  timestamp?: string;

  connectionId?: string;

  data: T;

  raw?: unknown;
}

export interface IntegrationWebhookResult {
  success: boolean;

  event?: IntegrationWebhookEvent;

  error?: IntegrationErrorInfo;
}

/* -------------------------------------------------------------------------- */
/*                              HEALTH CHECK                                  */
/* -------------------------------------------------------------------------- */

export interface IntegrationHealth {
  provider: IntegrationProvider;

  healthy: boolean;

  status: IntegrationStatus;

  checkedAt: string;

  latencyMs?: number;

  message?: string;

  error?: IntegrationErrorInfo;
}

/* -------------------------------------------------------------------------- */
/*                             SERVICE CONTRACT                               */
/* -------------------------------------------------------------------------- */

/**
 * Generic integration service contract.
 *
 * Provider-specific services may implement
 * additional methods beyond this interface.
 */
export interface IntegrationService<
  TCredentials extends IntegrationCredentials =
    IntegrationCredentials
> {
  readonly provider: IntegrationProvider;

  connect?(
    credentials: TCredentials
  ): Promise<void>;

  disconnect?(): Promise<void>;

  healthCheck?(): Promise<IntegrationHealth>;
}

/* -------------------------------------------------------------------------- */
/*                            OAUTH CONTRACT                                  */
/* -------------------------------------------------------------------------- */

export interface OAuthAuthorizationOptions {
  state?: string;

  redirectUri?: string;

  scopes?: string[];

  prompt?: string;

  loginHint?: string;

  accessType?: "online" | "offline";

  metadata?: Record<string, unknown>;
}

export interface OAuthAuthorizationResult {
  authorizationUrl: string;

  state?: string;
}

export interface OAuthTokenExchangeInput {
  code: string;

  redirectUri?: string;

  codeVerifier?: string;
}

export interface OAuthTokenResult {
  accessToken: string;

  refreshToken?: string;

  expiresIn?: number;

  expiresAt?: string;

  tokenType?: string;

  scopes?: string[];
}

/* -------------------------------------------------------------------------- */
/*                              PROVIDER META                                 */
/* -------------------------------------------------------------------------- */

export interface IntegrationProviderMetadata {
  provider: IntegrationProvider;

  name: string;

  description?: string;

  authType: IntegrationAuthType;

  supportsOAuth: boolean;

  supportsWebhooks: boolean;

  supportsSync: boolean;

  website?: string;

  documentationUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*                               TYPE GUARDS                                  */
/* -------------------------------------------------------------------------- */

export function isIntegrationProvider(
  value: unknown
): value is IntegrationProvider {
  return (
    typeof value === "string" &&
    INTEGRATION_PROVIDERS.includes(
      value as IntegrationProvider
    )
  );
}

export function isIntegrationStatus(
  value: unknown
): value is IntegrationStatus {
  return (
    typeof value === "string" &&
    INTEGRATION_STATUSES.includes(
      value as IntegrationStatus
    )
  );
}

export function isIntegrationAuthType(
  value: unknown
): value is IntegrationAuthType {
  return (
    typeof value === "string" &&
    INTEGRATION_AUTH_TYPES.includes(
      value as IntegrationAuthType
    )
  );
}

export function isIntegrationError(
  value: unknown
): value is IntegrationError {
  return value instanceof IntegrationError;
}

/* -------------------------------------------------------------------------- */
/*                                HELPERS                                     */
/* -------------------------------------------------------------------------- */

export function createIntegrationResult<T>(
  data: T,
  metadata?: Record<string, unknown>
): IntegrationResult<T> {
  return {
    success: true,
    data,
    metadata,
  };
}

export function createIntegrationErrorResult<
  T = never
>(
  error:
    | IntegrationError
    | IntegrationErrorInfo
    | Error
): IntegrationResult<T> {
  if (error instanceof IntegrationError) {
    return {
      success: false,
      error: error.toJSON(),
    };
  }

  return {
    success: false,
    error: {
      message: error.message,
      code: "INTEGRATION_ERROR",
      retryable: false,
      timestamp: new Date().toISOString(),
    },
  };
}

export function isTokenExpired(
  expiresAt?: string | Date,
  bufferMs = 60_000
): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiration =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : new Date(expiresAt).getTime();

  if (!Number.isFinite(expiration)) {
    return true;
  }

  return Date.now() + bufferMs >= expiration;
}

export function sanitizeIntegrationConnection(
  connection: IntegrationConnectionWithCredentials
): PublicIntegrationConnection {
  const {
    credentials: _credentials,
    ...safeConnection
  } = connection;

  return safeConnection;
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default IntegrationProvider;