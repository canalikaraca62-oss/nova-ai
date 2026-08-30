/**
 * SYRAVEN AI
 * lib/auth.ts
 *
 * Enterprise authentication foundation.
 *
 * Features:
 * - User and session types
 * - Authentication state management
 * - Role based access control
 * - Permission checks
 * - JWT payload parsing
 * - Session validation
 * - Authentication guards
 * - Safe browser/server compatibility
 * - Provider-agnostic architecture
 */

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

  expiresAt?: number;

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
/*                              AUTH ERROR                                    */
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
  }
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
  return Boolean(user && user.id && user.isActive);
}

/**
 * Checks whether the session has expired.
 */
export function isSessionExpired(
  session: AuthSession | null | undefined,
): boolean {
  if (!session) {
    return true;
  }

  if (!session.expiresAt) {
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

  if (!session.accessToken) {
    return false;
  }

  return !isSessionExpired(session);
}

/**
 * Checks whether a user has one of the required roles.
 */
export function hasRole(
  user: AuthUser | null | undefined,
  requiredRole: UserRole | UserRole[],
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

  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole];
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
 * Requires an authenticated user.
 *
 * Throws AuthenticationError if no authenticated user exists.
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
  requiredRole: UserRole | UserRole[],
): AuthUser {
  const authenticatedUser = requireUser(user);

  if (!hasRole(authenticatedUser, requiredRole)) {
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
  const authenticatedUser = requireUser(user);

  if (!hasMinimumRole(authenticatedUser, minimumRole)) {
    throw new AuthorizationError(
      "Insufficient role level",
      "INSUFFICIENT_ROLE_LEVEL",
    );
  }

  return authenticatedUser;
}

/* -------------------------------------------------------------------------- */
/*                              JWT HELPERS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Safely decodes a JWT payload.
 *
 * Does NOT verify the JWT signature.
 * Signature verification must happen at the authentication provider/server.
 */
export function decodeJwt(
  token: string | null | undefined,
): JwtPayload | null {
  if (!token) {
    return null;
  }

  try {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      "=",
    );

    if (typeof atob === "function") {
      const decoded = atob(padded);
      return JSON.parse(decoded) as JwtPayload;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Returns JWT expiration timestamp.
 */
export function getTokenExpiration(
  token: string | null | undefined,
): number | null {
  const payload = decodeJwt(token);

  if (!payload || typeof payload.exp !== "number") {
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
  const expiration = getTokenExpiration(token);

  if (!expiration) {
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
  const expiration = getTokenExpiration(token);

  if (!expiration) {
    return null;
  }

  return Math.max(0, expiration * 1000 - Date.now());
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
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (typeof source.id !== "string" || source.id.length === 0) {
    return null;
  }

  const role =
    typeof source.role === "string" &&
    source.role in ROLE_HIERARCHY
      ? (source.role as UserRole)
      : "member";

  return {
    id: source.id,

    email:
      typeof source.email === "string"
        ? source.email
        : undefined,

    name:
      typeof source.name === "string"
        ? source.name
        : undefined,

    username:
      typeof source.username === "string"
        ? source.username
        : undefined,

    avatarUrl:
      typeof source.avatarUrl === "string"
        ? source.avatarUrl
        : typeof source.avatar_url === "string"
          ? source.avatar_url
          : undefined,

    role,

    organizationId:
      typeof source.organizationId === "string"
        ? source.organizationId
        : typeof source.organization_id === "string"
          ? source.organization_id
          : undefined,

    emailVerified:
      typeof source.emailVerified === "boolean"
        ? source.emailVerified
        : undefined,

    phoneVerified:
      typeof source.phoneVerified === "boolean"
        ? source.phoneVerified
        : undefined,

    isActive:
      typeof source.isActive === "boolean"
        ? source.isActive
        : true,

    createdAt:
      typeof source.createdAt === "string"
        ? source.createdAt
        : undefined,

    updatedAt:
      typeof source.updatedAt === "string"
        ? source.updatedAt
        : undefined,

    metadata:
      source.metadata &&
      typeof source.metadata === "object"
        ? (source.metadata as Record<string, unknown>)
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
  const { user, organizationId, requiredRole } = context;

  if (!isAuthenticated(user)) {
    return false;
  }

  if (
    organizationId &&
    user.organizationId &&
    user.organizationId !== organizationId
  ) {
    return false;
  }

  if (requiredRole && !hasRole(user, requiredRole)) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

const auth = {
  ROLE_HIERARCHY,

  INITIAL_AUTH_STATE,

  isAuthenticated,

  isSessionExpired,

  isSessionValid,

  hasRole,

  hasMinimumRole,

  belongsToOrganization,

  requireUser,

  requireSession,

  requireRole,

  requireMinimumRole,

  decodeJwt,

  getTokenExpiration,

  isTokenExpired,

  getTokenRemainingTime,

  normalizeAuthUser,

  createAuthenticatedState,

  createUnauthenticatedState,

  createAuthErrorState,

  authorize,
};

export default auth;