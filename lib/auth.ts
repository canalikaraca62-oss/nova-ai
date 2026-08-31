/**
 * SYRAVEN AI
 * lib/auth.ts
 *
 * Enterprise authentication and authorization foundation.
 *
 * Features:
 * - Strict TypeScript compatibility
 * - User and session types
 * - Authentication state management
 * - Role based access control
 * - Permission checks
 * - JWT payload parsing
 * - Session validation
 * - Authentication guards
 * - Browser and server compatibility
 * - Provider-agnostic architecture
 */

/* -------------------------------------------------------------------------- */
/*                                ID TYPES                                    */
/* -------------------------------------------------------------------------- */

export type UserId = string;

export type SessionId = string;

export type OrganizationId = string;

/* -------------------------------------------------------------------------- */
/*                                USER ROLES                                  */
/* -------------------------------------------------------------------------- */

export type UserRole =
  | "super_admin"
  | "admin"
  | "owner"
  | "manager"
  | "developer"
  | "analyst"
  | "member"
  | "viewer"
  | "guest";

/* -------------------------------------------------------------------------- */
/*                              AUTH PROVIDERS                                */
/* -------------------------------------------------------------------------- */

export type AuthProvider =
  | "email"
  | "password"
  | "google"
  | "github"
  | "microsoft"
  | "apple"
  | "magic_link"
  | "api_key"
  | "anonymous"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              AUTH STATUS                                   */
/* -------------------------------------------------------------------------- */

export type AuthStatus =
  | "authenticated"
  | "unauthenticated"
  | "loading"
  | "expired"
  | "error";

/* -------------------------------------------------------------------------- */
/*                               USER PROFILE                                 */
/* -------------------------------------------------------------------------- */

export interface AuthUser {
  id: UserId;

  email?: string;

  name?: string;

  username?: string;

  avatarUrl?: string;

  role: UserRole;

  organizationId?: OrganizationId;

  emailVerified?: boolean;

  phoneVerified?: boolean;

  isActive: boolean;

  createdAt?: string;

  updatedAt?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               AUTH SESSION                                 */
/* -------------------------------------------------------------------------- */

export interface AuthSession {
  id?: SessionId;

  accessToken: string;

  refreshToken?: string;

  tokenType?: string;

  /**
   * Unix timestamp in seconds.
   */
  expiresAt?: number;

  /**
   * Session lifetime in seconds.
   */
  expiresIn?: number;

  user: AuthUser;

  provider?: AuthProvider;

  createdAt?: string;

  updatedAt?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              AUTH STATE                                    */
/* -------------------------------------------------------------------------- */

export interface AuthState {
  status: AuthStatus;

  user: AuthUser | null;

  session: AuthSession | null;

  error: string | null;

  isLoading: boolean;

  initialized: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              AUTH RESULT                                   */
/* -------------------------------------------------------------------------- */

export interface AuthResult<T = AuthSession> {
  success: boolean;

  data?: T;

  error?: string;

  code?: string;
}

/* -------------------------------------------------------------------------- */
/*                              SIGN IN INPUT                                 */
/* -------------------------------------------------------------------------- */

export interface SignInInput {
  email?: string;

  password?: string;

  provider?: AuthProvider;

  redirectTo?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              SIGN UP INPUT                                 */
/* -------------------------------------------------------------------------- */

export interface SignUpInput {
  email: string;

  password?: string;

  name?: string;

  username?: string;

  role?: UserRole;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             PASSWORD RESET                                 */
/* -------------------------------------------------------------------------- */

export interface PasswordResetInput {
  email: string;

  redirectTo?: string;
}

export interface PasswordUpdateInput {
  password: string;
}

/* -------------------------------------------------------------------------- */
/*                              JWT PAYLOAD                                   */
/* -------------------------------------------------------------------------- */

export interface JwtPayload {
  sub?: string;

  email?: string;

  role?: string;

  exp?: number;

  iat?: number;

  iss?: string;

  aud?: string | string[];

  user_metadata?: Record<string, unknown>;

  app_metadata?: Record<string, unknown>;

  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*                           AUTH PROVIDER ADAPTER                            */
/* -------------------------------------------------------------------------- */

export interface AuthProviderAdapter {
  getSession(): Promise<AuthSession | null>;

  getUser(): Promise<AuthUser | null>;

  signIn(input: SignInInput): Promise<AuthResult>;

  signUp(input: SignUpInput): Promise<AuthResult>;

  signOut(): Promise<AuthResult<void>>;

  refreshSession(): Promise<AuthResult>;

  resetPassword(
    input: PasswordResetInput,
  ): Promise<AuthResult<void>>;

  updatePassword(
    input: PasswordUpdateInput,
  ): Promise<AuthResult<void>>;
}

/* -------------------------------------------------------------------------- */
/*                           AUTHORIZATION TYPES                              */
/* -------------------------------------------------------------------------- */

export interface AuthorizationContext {
  user: AuthUser | null;

  organizationId?: OrganizationId;

  requiredRole?: UserRole | UserRole[];

  requiredPermission?: string | string[];

  permissions?: readonly string[];
}

/* -------------------------------------------------------------------------- */
/*                             ROLE HIERARCHY                                 */
/* -------------------------------------------------------------------------- */

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  viewer: 1,
  member: 2,
  analyst: 3,
  developer: 4,
  manager: 5,
  owner: 6,
  admin: 7,
  super_admin: 8,
};

/* -------------------------------------------------------------------------- */
/*                              AUTH ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class AuthenticationError extends Error {
  public readonly code: string;

  constructor(
    message = "Authentication required",
    code = "AUTHENTICATION_REQUIRED",
  ) {
    super(message);

    this.name = "AuthenticationError";
    this.code = code;

    Object.setPrototypeOf(
      this,
      AuthenticationError.prototype,
    );
  }
}

export class AuthorizationError extends Error {
  public readonly code: string;

  constructor(
    message = "You are not authorized to perform this action",
    code = "AUTHORIZATION_DENIED",
  ) {
    super(message);

    this.name = "AuthorizationError";
    this.code = code;

    Object.setPrototypeOf(
      this,
      AuthorizationError.prototype,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              TYPE GUARDS                                   */
/* -------------------------------------------------------------------------- */

export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isUserRole(
  value: unknown,
): value is UserRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      ROLE_HIERARCHY,
      value,
    )
  );
}

export function isAuthProvider(
  value: unknown,
): value is AuthProvider {
  const providers: readonly AuthProvider[] = [
    "email",
    "password",
    "google",
    "github",
    "microsoft",
    "apple",
    "magic_link",
    "api_key",
    "anonymous",
    "custom",
  ];

  return (
    typeof value === "string" &&
    providers.includes(value as AuthProvider)
  );
}

/* -------------------------------------------------------------------------- */
/*                              AUTH HELPERS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Checks whether a user exists and is active.
 */
export function isAuthenticated(
  user: AuthUser | null | undefined,
): user is AuthUser {
  return Boolean(
    user &&
      typeof user.id === "string" &&
      user.id.trim().length > 0 &&
      user.isActive === true,
  );
}

/**
 * Checks whether a session has expired.
 */
export function isSessionExpired(
  session: AuthSession | null | undefined,
): boolean {
  if (!session) {
    return true;
  }

  if (
    typeof session.expiresAt !== "number" ||
    !Number.isFinite(session.expiresAt)
  ) {
    return false;
  }

  return Date.now() >= session.expiresAt * 1000;
}

/**
 * Checks whether a session is valid.
 */
export function isSessionValid(
  session: AuthSession | null | undefined,
): session is AuthSession {
  if (!session) {
    return false;
  }

  if (
    typeof session.accessToken !== "string" ||
    session.accessToken.trim().length === 0
  ) {
    return false;
  }

  if (!isAuthenticated(session.user)) {
    return false;
  }

  return !isSessionExpired(session);
}

/**
 * Checks whether a user has one of the required roles.
 */
export function hasRole(
  user: AuthUser | null | undefined,
  requiredRole: UserRole | readonly UserRole[],
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  const roles = Array.isArray(requiredRole)
    ? requiredRole
    : [requiredRole];

  return roles.includes(user.role);
}

/**
 * Checks whether a user has at least the specified role level.
 */
export function hasMinimumRole(
  user: AuthUser | null | undefined,
  minimumRole: UserRole,
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  return (
    ROLE_HIERARCHY[user.role] >=
    ROLE_HIERARCHY[minimumRole]
  );
}

/**
 * Checks whether a user belongs to an organization.
 */
export function belongsToOrganization(
  user: AuthUser | null | undefined,
  organizationId: OrganizationId,
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  return user.organizationId === organizationId;
}

/**
 * Checks whether a user has a permission.
 *
 * Permissions are read from user.metadata.permissions.
 */
export function hasPermission(
  user: AuthUser | null | undefined,
  requiredPermission: string | readonly string[],
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  const requiredPermissions = Array.isArray(
    requiredPermission,
  )
    ? requiredPermission
    : [requiredPermission];

  const metadata = user.metadata;

  if (!metadata) {
    return false;
  }

  const permissionsValue =
    metadata.permissions;

  if (!Array.isArray(permissionsValue)) {
    return false;
  }

  const userPermissions =
    permissionsValue.filter(
      (permission): permission is string =>
        typeof permission === "string",
    );

  return requiredPermissions.every((permission) =>
    userPermissions.includes(permission),
  );
}

/**
 * Requires an authenticated user.
 */
export function requireUser(
  user: AuthUser | null | undefined,
): AuthUser {
  if (!isAuthenticated(user)) {
    throw new AuthenticationError();
  }

  return user;
}

/**
 * Requires a valid session.
 */
export function requireSession(
  session: AuthSession | null | undefined,
): AuthSession {
  if (!isSessionValid(session)) {
    throw new AuthenticationError(
      "Valid authentication session required",
      "INVALID_SESSION",
    );
  }

  return session;
}

/**
 * Requires a specific role.
 */
export function requireRole(
  user: AuthUser | null | undefined,
  requiredRole: UserRole | readonly UserRole[],
): AuthUser {
  const authenticatedUser =
    requireUser(user);

  if (
    !hasRole(
      authenticatedUser,
      requiredRole,
    )
  ) {
    throw new AuthorizationError(
      "Insufficient role permissions",
      "INSUFFICIENT_ROLE",
    );
  }

  return authenticatedUser;
}

/**
 * Requires a minimum role.
 */
export function requireMinimumRole(
  user: AuthUser | null | undefined,
  minimumRole: UserRole,
): AuthUser {
  const authenticatedUser =
    requireUser(user);

  if (
    !hasMinimumRole(
      authenticatedUser,
      minimumRole,
    )
  ) {
    throw new AuthorizationError(
      "Insufficient role level",
      "INSUFFICIENT_ROLE_LEVEL",
    );
  }

  return authenticatedUser;
}

/**
 * Requires one or more permissions.
 */
export function requirePermission(
  user: AuthUser | null | undefined,
  requiredPermission:
    | string
    | readonly string[],
): AuthUser {
  const authenticatedUser =
    requireUser(user);

  if (
    !hasPermission(
      authenticatedUser,
      requiredPermission,
    )
  ) {
    throw new AuthorizationError(
      "Insufficient permissions",
      "INSUFFICIENT_PERMISSION",
    );
  }

  return authenticatedUser;
}

/* -------------------------------------------------------------------------- */
/*                              JWT HELPERS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Safely decodes Base64URL.
 *
 * Compatible with browser environments.
 */
function decodeBase64Url(
  value: string,
): string | null {
  try {
    const normalized = value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const remainder =
      normalized.length % 4;

    const padding =
      remainder === 0
        ? 0
        : 4 - remainder;

    const padded =
      normalized +
      "=".repeat(padding);

    if (typeof globalThis.atob !== "function") {
      return null;
    }

    return globalThis.atob(padded);
  } catch {
    return null;
  }
}

/**
 * Converts binary JWT data to UTF-8 safely.
 */
function decodeJwtPayloadString(
  value: string,
): string | null {
  try {
    const decoded =
      decodeBase64Url(value);

    if (decoded === null) {
      return null;
    }

    const bytes = Uint8Array.from(
      decoded,
      (character) =>
        character.charCodeAt(0),
    );

    if (
      typeof TextDecoder !==
      "undefined"
    ) {
      return new TextDecoder().decode(bytes);
    }

    let encoded = "";

    for (const byte of bytes) {
      encoded += `%${byte
        .toString(16)
        .padStart(2, "0")}`;
    }

    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Safely decodes a JWT payload.
 *
 * Important:
 * This function does NOT verify the JWT signature.
 * Signature verification must happen on the server
 * or through the authentication provider.
 */
export function decodeJwt(
  token: string | null | undefined,
): JwtPayload | null {
  if (
    typeof token !== "string" ||
    token.trim().length === 0
  ) {
    return null;
  }

  try {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const payloadPart = parts[1];

    if (
      typeof payloadPart !== "string" ||
      payloadPart.length === 0
    ) {
      return null;
    }

    const decoded =
      decodeJwtPayloadString(payloadPart);

    if (decoded === null) {
      return null;
    }

    const parsed: unknown =
      JSON.parse(decoded);

    if (!isRecord(parsed)) {
      return null;
    }

    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns JWT expiration timestamp in seconds.
 */
export function getTokenExpiration(
  token: string | null | undefined,
): number | null {
  const payload = decodeJwt(token);

  if (
    !payload ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return null;
  }

  return payload.exp;
}

/**
 * Checks whether a JWT is expired.
 */
export function isTokenExpired(
  token: string | null | undefined,
): boolean {
  const expiration =
    getTokenExpiration(token);

  if (expiration === null) {
    return false;
  }

  return Date.now() >= expiration * 1000;
}

/**
 * Returns remaining token lifetime in milliseconds.
 */
export function getTokenRemainingTime(
  token: string | null | undefined,
): number | null {
  const expiration =
    getTokenExpiration(token);

  if (expiration === null) {
    return null;
  }

  return Math.max(
    0,
    expiration * 1000 - Date.now(),
  );
}

/**
 * Returns the token subject.
 */
export function getTokenSubject(
  token: string | null | undefined,
): string | null {
  const payload = decodeJwt(token);

  if (
    !payload ||
    typeof payload.sub !== "string" ||
    payload.sub.trim().length === 0
  ) {
    return null;
  }

  return payload.sub;
}

/* -------------------------------------------------------------------------- */
/*                         USER NORMALIZATION                                 */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes unknown user data into AuthUser.
 */
export function normalizeAuthUser(
  value: unknown,
): AuthUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const id =
    typeof value.id === "string"
      ? value.id.trim()
      : "";

  if (id.length === 0) {
    return null;
  }

  const role: UserRole =
    isUserRole(value.role)
      ? value.role
      : "member";

  const metadata =
    isRecord(value.metadata)
      ? value.metadata
      : undefined;

  return {
    id,

    email:
      typeof value.email === "string"
        ? value.email
        : undefined,

    name:
      typeof value.name === "string"
        ? value.name
        : undefined,

    username:
      typeof value.username === "string"
        ? value.username
        : undefined,

    avatarUrl:
      typeof value.avatarUrl === "string"
        ? value.avatarUrl
        : typeof value.avatar_url ===
            "string"
          ? value.avatar_url
          : undefined,

    role,

    organizationId:
      typeof value.organizationId ===
      "string"
        ? value.organizationId
        : typeof value.organization_id ===
            "string"
          ? value.organization_id
          : undefined,

    emailVerified:
      typeof value.emailVerified ===
      "boolean"
        ? value.emailVerified
        : typeof value.email_verified ===
            "boolean"
          ? value.email_verified
          : undefined,

    phoneVerified:
      typeof value.phoneVerified ===
      "boolean"
        ? value.phoneVerified
        : typeof value.phone_verified ===
            "boolean"
          ? value.phone_verified
          : undefined,

    isActive:
      typeof value.isActive === "boolean"
        ? value.isActive
        : typeof value.is_active ===
            "boolean"
          ? value.is_active
          : true,

    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : typeof value.created_at ===
            "string"
          ? value.created_at
          : undefined,

    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.updated_at ===
            "string"
          ? value.updated_at
          : undefined,

    metadata,
  };
}

/* -------------------------------------------------------------------------- */
/*                        SESSION NORMALIZATION                               */
/* -------------------------------------------------------------------------- */

export function normalizeAuthSession(
  value: unknown,
): AuthSession | null {
  if (!isRecord(value)) {
    return null;
  }

  const accessToken =
    typeof value.accessToken === "string"
      ? value.accessToken
      : typeof value.access_token === "string"
        ? value.access_token
        : "";

  if (accessToken.trim().length === 0) {
    return null;
  }

  const user =
    normalizeAuthUser(value.user);

  if (!user) {
    return null;
  }

  const expiresAt =
    typeof value.expiresAt === "number"
      ? value.expiresAt
      : typeof value.expires_at === "number"
        ? value.expires_at
        : undefined;

  const expiresIn =
    typeof value.expiresIn === "number"
      ? value.expiresIn
      : typeof value.expires_in === "number"
        ? value.expires_in
        : undefined;

  return {
    id:
      typeof value.id === "string"
        ? value.id
        : undefined,

    accessToken,

    refreshToken:
      typeof value.refreshToken === "string"
        ? value.refreshToken
        : typeof value.refresh_token ===
            "string"
          ? value.refresh_token
          : undefined,

    tokenType:
      typeof value.tokenType === "string"
        ? value.tokenType
        : typeof value.token_type ===
            "string"
          ? value.token_type
          : undefined,

    expiresAt,

    expiresIn,

    user,

    provider:
      isAuthProvider(value.provider)
        ? value.provider
        : undefined,

    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : typeof value.created_at ===
            "string"
          ? value.created_at
          : undefined,

    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.updated_at ===
            "string"
          ? value.updated_at
          : undefined,

    metadata:
      isRecord(value.metadata)
        ? value.metadata
        : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                          DEFAULT AUTH STATE                                */
/* -------------------------------------------------------------------------- */

export const INITIAL_AUTH_STATE: AuthState = {
  status: "loading",
  user: null,
  session: null,
  error: null,
  isLoading: true,
  initialized: false,
};

/* -------------------------------------------------------------------------- */
/*                          AUTH STATE HELPERS                                */
/* -------------------------------------------------------------------------- */

export function createAuthenticatedState(
  session: AuthSession,
): AuthState {
  return {
    status: "authenticated",
    user: session.user,
    session,
    error: null,
    isLoading: false,
    initialized: true,
  };
}

export function createUnauthenticatedState(): AuthState {
  return {
    status: "unauthenticated",
    user: null,
    session: null,
    error: null,
    isLoading: false,
    initialized: true,
  };
}

export function createExpiredState(): AuthState {
  return {
    status: "expired",
    user: null,
    session: null,
    error: "Authentication session has expired",
    isLoading: false,
    initialized: true,
  };
}

export function createAuthErrorState(
  error: string,
): AuthState {
  return {
    status: "error",
    user: null,
    session: null,
    error,
    isLoading: false,
    initialized: true,
  };
}

/* -------------------------------------------------------------------------- */
/*                          AUTHORIZATION CHECK                               */
/* -------------------------------------------------------------------------- */

export function authorize(
  context: AuthorizationContext,
): boolean {
  const {
    user,
    organizationId,
    requiredRole,
    requiredPermission,
    permissions,
  } = context;

  if (!isAuthenticated(user)) {
    return false;
  }

  if (
    organizationId !== undefined &&
    user.organizationId !== organizationId
  ) {
    return false;
  }

  if (
    requiredRole !== undefined &&
    !hasRole(user, requiredRole)
  ) {
    return false;
  }

  if (
    requiredPermission !== undefined
  ) {
    const requiredPermissions =
      Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission];

    const availablePermissions =
      permissions ??
      (
        Array.isArray(
          user.metadata?.permissions,
        )
          ? user.metadata.permissions.filter(
              (
                permission,
              ): permission is string =>
                typeof permission === "string",
            )
          : []
      );

    const hasAllPermissions =
      requiredPermissions.every(
        (permission) =>
          availablePermissions.includes(
            permission,
          ),
      );

    if (!hasAllPermissions) {
      return false;
    }
  }

  return true;
}

/**
 * Throws when authorization fails.
 */
export function requireAuthorization(
  context: AuthorizationContext,
): AuthUser {
  if (!isAuthenticated(context.user)) {
    throw new AuthenticationError();
  }

  if (!authorize(context)) {
    throw new AuthorizationError();
  }

  return context.user;
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

const auth = {
  ROLE_HIERARCHY,

  INITIAL_AUTH_STATE,

  isRecord,

  isUserRole,

  isAuthProvider,

  isAuthenticated,

  isSessionExpired,

  isSessionValid,

  hasRole,

  hasMinimumRole,

  belongsToOrganization,

  hasPermission,

  requireUser,

  requireSession,

  requireRole,

  requireMinimumRole,

  requirePermission,

  decodeJwt,

  getTokenExpiration,

  isTokenExpired,

  getTokenRemainingTime,

  getTokenSubject,

  normalizeAuthUser,

  normalizeAuthSession,

  createAuthenticatedState,

  createUnauthenticatedState,

  createExpiredState,

  createAuthErrorState,

  authorize,

  requireAuthorization,
};

export default auth;