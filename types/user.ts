/**
 * SYRAVEN User Types
 *
 * Shared contracts for:
 * - Users
 * - Profiles
 * - Preferences
 * - Roles
 * - Permissions
 * - Authentication identities
 * - Sessions
 * - Security state
 * - Organizations
 * - User activity
 */

/* -------------------------------------------------------------------------- */
/*                                    IDS                                     */
/* -------------------------------------------------------------------------- */

export type UserId = string;

export type OrganizationId = string;

export type RoleId = string;

export type PermissionId = string;

export type SessionId = string;

/* -------------------------------------------------------------------------- */
/*                                USER STATUS                                 */
/* -------------------------------------------------------------------------- */

export type UserStatus =
  | "active"
  | "inactive"
  | "pending"
  | "suspended"
  | "blocked"
  | "deleted";

/* -------------------------------------------------------------------------- */
/*                                 USER ROLE                                  */
/* -------------------------------------------------------------------------- */

export type UserRole =
  | "owner"
  | "admin"
  | "manager"
  | "member"
  | "viewer"
  | "guest";

/* -------------------------------------------------------------------------- */
/*                               AUTH PROVIDER                                */
/* -------------------------------------------------------------------------- */

export type AuthProvider =
  | "email"
  | "google"
  | "github"
  | "microsoft"
  | "apple"
  | "sso"
  | "api_key"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                                USER THEME                                  */
/* -------------------------------------------------------------------------- */

export type UserTheme =
  | "light"
  | "dark"
  | "system";

/* -------------------------------------------------------------------------- */
/*                              USER PREFERENCES                              */
/* -------------------------------------------------------------------------- */

export interface UserPreferences {
  theme?: UserTheme;

  language?: string;

  timezone?: string;

  emailNotifications?: boolean;

  pushNotifications?: boolean;

  desktopNotifications?: boolean;

  soundEnabled?: boolean;

  compactMode?: boolean;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               USER PROFILE                                 */
/* -------------------------------------------------------------------------- */

export interface UserProfile {
  firstName?: string;

  lastName?: string;

  displayName?: string;

  username?: string;

  avatarUrl?: string;

  bio?: string;

  jobTitle?: string;

  company?: string;

  website?: string;

  location?: string;

  phone?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                   USER                                     */
/* -------------------------------------------------------------------------- */

export interface User {
  id: UserId;

  email: string;

  status: UserStatus;

  role: UserRole;

  profile: UserProfile;

  preferences: UserPreferences;

  emailVerified: boolean;

  phoneVerified?: boolean;

  lastLoginAt?: Date;

  createdAt: Date;

  updatedAt: Date;

  deletedAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               USER IDENTITY                                */
/* -------------------------------------------------------------------------- */

export interface UserIdentity {
  id: string;

  userId: UserId;

  provider: AuthProvider;

  providerAccountId?: string;

  providerEmail?: string;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            USER ORGANIZATION                               */
/* -------------------------------------------------------------------------- */

export interface UserOrganizationMembership {
  id: string;

  userId: UserId;

  organizationId: OrganizationId;

  role: UserRole;

  joinedAt: Date;

  invitedAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                PERMISSION                                  */
/* -------------------------------------------------------------------------- */

export interface Permission {
  id: PermissionId;

  name: string;

  description?: string;

  resource?: string;

  action?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                   ROLE                                     */
/* -------------------------------------------------------------------------- */

export interface Role {
  id: RoleId;

  name: string;

  description?: string;

  permissions: PermissionId[];

  system?: boolean;

  createdAt?: Date;

  updatedAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              USER PERMISSION                               */
/* -------------------------------------------------------------------------- */

export type PermissionSource =
  | "role"
  | "direct"
  | "organization"
  | "system";

export interface UserPermission {
  userId: UserId;

  permission: PermissionId | string;

  allowed: boolean;

  source?: PermissionSource;

  expiresAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             CREATE USER INPUT                              */
/* -------------------------------------------------------------------------- */

export interface CreateUserInput {
  email: string;

  password?: string;

  firstName?: string;

  lastName?: string;

  displayName?: string;

  username?: string;

  avatarUrl?: string;

  role?: UserRole;

  status?: UserStatus;

  provider?: AuthProvider;

  preferences?: Partial<UserPreferences>;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             UPDATE USER INPUT                              */
/* -------------------------------------------------------------------------- */

export interface UpdateUserInput {
  email?: string;

  status?: UserStatus;

  role?: UserRole;

  profile?: Partial<UserProfile>;

  preferences?: Partial<UserPreferences>;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                          UPDATE PROFILE INPUT                              */
/* -------------------------------------------------------------------------- */

export interface UpdateUserProfileInput
  extends Partial<UserProfile> {
  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                        UPDATE PREFERENCES INPUT                            */
/* -------------------------------------------------------------------------- */

export interface UpdateUserPreferencesInput
  extends Partial<UserPreferences> {
  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                PUBLIC USER                                 */
/* -------------------------------------------------------------------------- */

/**
 * Safe representation intended for API/client exposure.
 */
export interface PublicUser {
  id: UserId;

  email?: string;

  status: UserStatus;

  role: UserRole;

  profile: UserProfile;

  createdAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                               USER SUMMARY                                 */
/* -------------------------------------------------------------------------- */

export interface UserSummary {
  id: UserId;

  email: string;

  displayName: string;

  avatarUrl?: string;

  status: UserStatus;

  role: UserRole;
}

/* -------------------------------------------------------------------------- */
/*                                USER SESSION                                */
/* -------------------------------------------------------------------------- */

export interface UserSession {
  id: SessionId;

  userId: UserId;

  createdAt: Date;

  expiresAt: Date;

  lastActiveAt?: Date;

  ipAddress?: string;

  userAgent?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               USER SECURITY                                */
/* -------------------------------------------------------------------------- */

export interface UserSecurityState {
  userId: UserId;

  emailVerified: boolean;

  phoneVerified?: boolean;

  twoFactorEnabled?: boolean;

  lastPasswordChangeAt?: Date;

  lastLoginAt?: Date;

  failedLoginAttempts?: number;

  lockedUntil?: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                              USER ACTIVITY                                 */
/* -------------------------------------------------------------------------- */

export type UserActivityType =
  | "login"
  | "logout"
  | "created"
  | "updated"
  | "deleted"
  | "password_changed"
  | "email_verified"
  | "permission_changed"
  | "profile_updated"
  | "custom";

export interface UserActivity {
  id: string;

  userId: UserId;

  type: UserActivityType | string;

  timestamp: Date;

  ipAddress?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              USER LIST OPTIONS                             */
/* -------------------------------------------------------------------------- */

export interface UserListOptions {
  status?: UserStatus | UserStatus[];

  role?: UserRole | UserRole[];

  search?: string;

  organizationId?: OrganizationId;

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                              USER LIST RESULT                              */
/* -------------------------------------------------------------------------- */

export interface UserListResult {
  users: User[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                USER STATS                                  */
/* -------------------------------------------------------------------------- */

export interface UserStats {
  total: number;

  active: number;

  inactive: number;

  pending: number;

  suspended: number;

  blocked: number;

  deleted: number;

  createdToday?: number;

  createdThisMonth?: number;
}

/* -------------------------------------------------------------------------- */
/*                           USER SERVICE OPTIONS                             */
/* -------------------------------------------------------------------------- */

export interface UserServiceOptions {
  defaultRole?: UserRole;

  defaultStatus?: UserStatus;

  allowRegistration?: boolean;

  requireEmailVerification?: boolean;

  maxListLimit?: number;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_USER_ROLE: UserRole =
  "member";

export const DEFAULT_USER_STATUS: UserStatus =
  "active";

export const DEFAULT_USER_LIST_LIMIT = 100;

export const MAX_USER_LIST_LIMIT = 1_000;

/* -------------------------------------------------------------------------- */
/*                               TYPE GUARDS                                  */
/* -------------------------------------------------------------------------- */

export function isActiveUser(
  user: Pick<User, "status">
): boolean {
  return user.status === "active";
}

export function isDeletedUser(
  user: Pick<User, "status">
): boolean {
  return user.status === "deleted";
}

export function isAdminRole(
  role: UserRole
): boolean {
  return (
    role === "owner" ||
    role === "admin"
  );
}

export function canManageUsers(
  role: UserRole
): boolean {
  return isAdminRole(role);
}

/* -------------------------------------------------------------------------- */
/*                            USER DISPLAY NAME                               */
/* -------------------------------------------------------------------------- */

export function getUserDisplayName(
  user: Pick<
    User,
    "email" | "profile"
  >
): string {
  const displayName =
    user.profile.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const username =
    user.profile.username?.trim();

  if (username) {
    return username;
  }

  const fullName = [
    user.profile.firstName,
    user.profile.lastName,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0
    )
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  return user.email;
}

/* -------------------------------------------------------------------------- */
/*                           USER TRANSFORMATION                              */
/* -------------------------------------------------------------------------- */

export function toPublicUser(
  user: User
): PublicUser {
  return {
    id: user.id,

    email: user.email,

    status: user.status,

    role: user.role,

    profile: {
      ...user.profile,
    },

    createdAt: new Date(
      user.createdAt
    ),
  };
}

export function toUserSummary(
  user: User
): UserSummary {
  return {
    id: user.id,

    email: user.email,

    displayName:
      getUserDisplayName(
        user
      ),

    avatarUrl:
      user.profile.avatarUrl,

    status: user.status,

    role: user.role,
  };
}