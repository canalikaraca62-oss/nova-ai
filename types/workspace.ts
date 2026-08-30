/**
 * SYRAVEN Workspace Types
 *
 * Enterprise-grade workspace domain model.
 *
 * Covers:
 * - Workspaces
 * - Members
 * - Roles
 * - Permissions
 * - Invitations
 * - Settings
 * - Limits
 * - Usage
 * - Audit metadata
 * - Workspace lifecycle
 *
 * Designed for strict TypeScript and large-scale multi-tenant systems.
 */

/* -------------------------------------------------------------------------- */
/*                               PRIMITIVE TYPES                              */
/* -------------------------------------------------------------------------- */

export type WorkspaceId = string;
export type WorkspaceSlug = string;
export type WorkspaceName = string;
export type WorkspaceMemberId = string;
export type WorkspaceInvitationId = string;
export type WorkspaceRoleId = string;
export type UserId = string;

/* -------------------------------------------------------------------------- */
/*                              WORKSPACE STATUS                              */
/* -------------------------------------------------------------------------- */

export type WorkspaceStatus =
  | "active"
  | "suspended"
  | "archived"
  | "deleted";

/* -------------------------------------------------------------------------- */
/*                               WORKSPACE PLAN                               */
/* -------------------------------------------------------------------------- */

export type WorkspacePlan =
  | "free"
  | "pro"
  | "business"
  | "enterprise"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              MEMBER STATUS                                 */
/* -------------------------------------------------------------------------- */

export type WorkspaceMemberStatus =
  | "active"
  | "invited"
  | "suspended"
  | "removed";

/* -------------------------------------------------------------------------- */
/*                                ROLE TYPES                                  */
/* -------------------------------------------------------------------------- */

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "manager"
  | "member"
  | "viewer"
  | "guest";

/* -------------------------------------------------------------------------- */
/*                              PERMISSION TYPES                              */
/* -------------------------------------------------------------------------- */

export type WorkspacePermission =
  | "workspace.read"
  | "workspace.update"
  | "workspace.delete"
  | "workspace.manage"
  | "workspace.billing"
  | "workspace.settings"
  | "workspace.members.read"
  | "workspace.members.invite"
  | "workspace.members.update"
  | "workspace.members.remove"
  | "workspace.roles.read"
  | "workspace.roles.manage"
  | "projects.read"
  | "projects.create"
  | "projects.update"
  | "projects.delete"
  | "projects.manage"
  | "tasks.read"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"
  | "tasks.manage"
  | "files.read"
  | "files.upload"
  | "files.update"
  | "files.delete"
  | "files.manage"
  | "knowledge.read"
  | "knowledge.create"
  | "knowledge.update"
  | "knowledge.delete"
  | "knowledge.manage"
  | "chat.read"
  | "chat.create"
  | "chat.manage"
  | "agents.read"
  | "agents.create"
  | "agents.update"
  | "agents.delete"
  | "agents.execute"
  | "agents.manage"
  | "integrations.read"
  | "integrations.manage"
  | "api.read"
  | "api.manage"
  | "audit.read"
  | "billing.read"
  | "billing.manage";

/* -------------------------------------------------------------------------- */
/*                           DEFAULT ROLE PERMISSIONS                         */
/* -------------------------------------------------------------------------- */

export const WORKSPACE_ROLE_PERMISSIONS: Record<
  WorkspaceRole,
  WorkspacePermission[]
> = {
  owner: [
    "workspace.read",
    "workspace.update",
    "workspace.delete",
    "workspace.manage",
    "workspace.billing",
    "workspace.settings",
    "workspace.members.read",
    "workspace.members.invite",
    "workspace.members.update",
    "workspace.members.remove",
    "workspace.roles.read",
    "workspace.roles.manage",
    "projects.read",
    "projects.create",
    "projects.update",
    "projects.delete",
    "projects.manage",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "tasks.manage",
    "files.read",
    "files.upload",
    "files.update",
    "files.delete",
    "files.manage",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "knowledge.delete",
    "knowledge.manage",
    "chat.read",
    "chat.create",
    "chat.manage",
    "agents.read",
    "agents.create",
    "agents.update",
    "agents.delete",
    "agents.execute",
    "agents.manage",
    "integrations.read",
    "integrations.manage",
    "api.read",
    "api.manage",
    "audit.read",
    "billing.read",
    "billing.manage",
  ],

  admin: [
    "workspace.read",
    "workspace.update",
    "workspace.settings",
    "workspace.members.read",
    "workspace.members.invite",
    "workspace.members.update",
    "workspace.members.remove",
    "workspace.roles.read",
    "projects.read",
    "projects.create",
    "projects.update",
    "projects.delete",
    "projects.manage",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "tasks.manage",
    "files.read",
    "files.upload",
    "files.update",
    "files.delete",
    "files.manage",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "knowledge.delete",
    "knowledge.manage",
    "chat.read",
    "chat.create",
    "chat.manage",
    "agents.read",
    "agents.create",
    "agents.update",
    "agents.delete",
    "agents.execute",
    "agents.manage",
    "integrations.read",
    "integrations.manage",
    "api.read",
    "audit.read",
    "billing.read",
  ],

  manager: [
    "workspace.read",
    "workspace.members.read",
    "projects.read",
    "projects.create",
    "projects.update",
    "projects.manage",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "tasks.manage",
    "files.read",
    "files.upload",
    "files.update",
    "files.delete",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "knowledge.delete",
    "chat.read",
    "chat.create",
    "chat.manage",
    "agents.read",
    "agents.create",
    "agents.update",
    "agents.execute",
  ],

  member: [
    "workspace.read",
    "workspace.members.read",
    "projects.read",
    "projects.create",
    "projects.update",
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "files.read",
    "files.upload",
    "files.update",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "chat.read",
    "chat.create",
    "agents.read",
    "agents.execute",
  ],

  viewer: [
    "workspace.read",
    "workspace.members.read",
    "projects.read",
    "tasks.read",
    "files.read",
    "knowledge.read",
    "chat.read",
    "agents.read",
  ],

  guest: [
    "workspace.read",
    "projects.read",
    "tasks.read",
    "files.read",
    "knowledge.read",
    "chat.read",
  ],
};

/* -------------------------------------------------------------------------- */
/*                              WORKSPACE LIMITS                              */
/* -------------------------------------------------------------------------- */

export interface WorkspaceLimits {
  maxMembers: number | null;

  maxProjects: number | null;

  maxTasks: number | null;

  maxFiles: number | null;

  maxStorageBytes: number | null;

  maxApiKeys: number | null;

  maxAgents: number | null;

  maxKnowledgeBases: number | null;

  maxIntegrations: number | null;

  maxMonthlyRequests: number | null;

  maxMonthlyTokens: number | null;

  maxMonthlyAiGenerations: number | null;

  custom?: Record<string, number | null>;
}

/* -------------------------------------------------------------------------- */
/*                              WORKSPACE USAGE                               */
/* -------------------------------------------------------------------------- */

export interface WorkspaceUsage {
  members: number;

  projects: number;

  tasks: number;

  files: number;

  storageBytes: number;

  apiKeys: number;

  agents: number;

  knowledgeBases: number;

  integrations: number;

  monthlyRequests: number;

  monthlyTokens: number;

  monthlyAiGenerations: number;

  custom?: Record<string, number>;
}

/* -------------------------------------------------------------------------- */
/*                            WORKSPACE BRANDING                              */
/* -------------------------------------------------------------------------- */

export interface WorkspaceBranding {
  logoUrl?: string;

  iconUrl?: string;

  primaryColor?: string;

  secondaryColor?: string;

  faviconUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*                            WORKSPACE SETTINGS                              */
/* -------------------------------------------------------------------------- */

export interface WorkspaceSecuritySettings {
  allowPublicSharing: boolean;

  requireTwoFactorAuth: boolean;

  allowExternalInvitations: boolean;

  allowGuestAccess: boolean;

  sessionTimeoutMinutes?: number;

  ipAllowlist?: string[];

  metadata?: Record<string, unknown>;
}

export interface WorkspaceAiSettings {
  enabled: boolean;

  allowCustomModels: boolean;

  allowExternalProviders: boolean;

  defaultModel?: string;

  maxTokensPerRequest?: number;

  metadata?: Record<string, unknown>;
}

export interface WorkspaceNotificationSettings {
  emailEnabled: boolean;

  pushEnabled: boolean;

  slackEnabled: boolean;

  webhookEnabled: boolean;

  metadata?: Record<string, unknown>;
}

export interface WorkspaceSettings {
  timezone?: string;

  locale?: string;

  dateFormat?: string;

  security: WorkspaceSecuritySettings;

  ai: WorkspaceAiSettings;

  notifications: WorkspaceNotificationSettings;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                WORKSPACE                                   */
/* -------------------------------------------------------------------------- */

export interface Workspace {
  id: WorkspaceId;

  name: WorkspaceName;

  slug: WorkspaceSlug;

  description?: string;

  ownerId: UserId;

  status: WorkspaceStatus;

  plan: WorkspacePlan;

  limits: WorkspaceLimits;

  usage?: WorkspaceUsage;

  branding?: WorkspaceBranding;

  settings: WorkspaceSettings;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;

  archivedAt?: Date;

  deletedAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                              WORKSPACE MEMBER                              */
/* -------------------------------------------------------------------------- */

export interface WorkspaceMember {
  id: WorkspaceMemberId;

  workspaceId: WorkspaceId;

  userId: UserId;

  role: WorkspaceRole;

  permissions?: WorkspacePermission[];

  status: WorkspaceMemberStatus;

  title?: string;

  department?: string;

  joinedAt?: Date;

  invitedAt?: Date;

  suspendedAt?: Date;

  removedAt?: Date;

  lastActiveAt?: Date;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                               CUSTOM ROLE                                  */
/* -------------------------------------------------------------------------- */

export interface WorkspaceCustomRole {
  id: WorkspaceRoleId;

  workspaceId: WorkspaceId;

  name: string;

  description?: string;

  permissions: WorkspacePermission[];

  isSystem: boolean;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            WORKSPACE INVITATION                            */
/* -------------------------------------------------------------------------- */

export type WorkspaceInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked";

export interface WorkspaceInvitation {
  id: WorkspaceInvitationId;

  workspaceId: WorkspaceId;

  email: string;

  role: WorkspaceRole;

  invitedBy: UserId;

  token: string;

  status: WorkspaceInvitationStatus;

  expiresAt: Date;

  acceptedAt?: Date;

  declinedAt?: Date;

  revokedAt?: Date;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                              CREATE INPUTS                                 */
/* -------------------------------------------------------------------------- */

export interface CreateWorkspaceInput {
  name: WorkspaceName;

  slug?: WorkspaceSlug;

  description?: string;

  ownerId: UserId;

  plan?: WorkspacePlan;

  branding?: Partial<WorkspaceBranding>;

  settings?: Partial<WorkspaceSettings>;

  metadata?: Record<string, unknown>;
}

export interface UpdateWorkspaceInput {
  name?: WorkspaceName;

  slug?: WorkspaceSlug;

  description?: string;

  status?: WorkspaceStatus;

  plan?: WorkspacePlan;

  branding?: Partial<WorkspaceBranding>;

  settings?: Partial<WorkspaceSettings>;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              MEMBER INPUTS                                 */
/* -------------------------------------------------------------------------- */

export interface AddWorkspaceMemberInput {
  workspaceId: WorkspaceId;

  userId: UserId;

  role?: WorkspaceRole;

  permissions?: WorkspacePermission[];

  title?: string;

  department?: string;

  metadata?: Record<string, unknown>;
}

export interface UpdateWorkspaceMemberInput {
  role?: WorkspaceRole;

  permissions?: WorkspacePermission[];

  status?: WorkspaceMemberStatus;

  title?: string;

  department?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            INVITATION INPUTS                               */
/* -------------------------------------------------------------------------- */

export interface CreateWorkspaceInvitationInput {
  workspaceId: WorkspaceId;

  email: string;

  role?: WorkspaceRole;

  invitedBy: UserId;

  expiresAt?: Date;

  metadata?: Record<string, unknown>;
}

export interface AcceptWorkspaceInvitationInput {
  invitationId: WorkspaceInvitationId;

  userId: UserId;
}

/* -------------------------------------------------------------------------- */
/*                               LIST OPTIONS                                 */
/* -------------------------------------------------------------------------- */

export interface WorkspaceListOptions {
  ownerId?: UserId;

  status?: WorkspaceStatus | WorkspaceStatus[];

  plan?: WorkspacePlan | WorkspacePlan[];

  search?: string;

  limit?: number;

  offset?: number;
}

export interface WorkspaceMemberListOptions {
  workspaceId: WorkspaceId;

  userId?: UserId;

  role?: WorkspaceRole | WorkspaceRole[];

  status?: WorkspaceMemberStatus | WorkspaceMemberStatus[];

  search?: string;

  limit?: number;

  offset?: number;
}

export interface WorkspaceInvitationListOptions {
  workspaceId: WorkspaceId;

  status?:
    | WorkspaceInvitationStatus
    | WorkspaceInvitationStatus[];

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                               LIST RESULTS                                 */
/* -------------------------------------------------------------------------- */

export interface WorkspaceListResult {
  workspaces: Workspace[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface WorkspaceMemberListResult {
  members: WorkspaceMember[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface WorkspaceInvitationListResult {
  invitations: WorkspaceInvitation[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                            ACCESS / PERMISSION                             */
/* -------------------------------------------------------------------------- */

export interface WorkspaceAccessContext {
  workspace: Workspace;

  member: WorkspaceMember;

  role: WorkspaceRole;

  permissions: WorkspacePermission[];

  isOwner: boolean;

  isAdmin: boolean;
}

export interface WorkspacePermissionCheck {
  workspaceId: WorkspaceId;

  userId: UserId;

  permission: WorkspacePermission;
}

export interface WorkspacePermissionResult {
  allowed: boolean;

  reason?: string;

  workspaceId: WorkspaceId;

  userId: UserId;

  permission: WorkspacePermission;

  role?: WorkspaceRole;
}

/* -------------------------------------------------------------------------- */
/*                               WORKSPACE EVENTS                             */
/* -------------------------------------------------------------------------- */

export type WorkspaceEventType =
  | "workspace.created"
  | "workspace.updated"
  | "workspace.archived"
  | "workspace.restored"
  | "workspace.deleted"
  | "workspace.member_added"
  | "workspace.member_updated"
  | "workspace.member_removed"
  | "workspace.member_suspended"
  | "workspace.invitation_created"
  | "workspace.invitation_accepted"
  | "workspace.invitation_declined"
  | "workspace.invitation_revoked"
  | "workspace.plan_changed"
  | "workspace.settings_updated";

export interface WorkspaceEvent<TData = unknown> {
  id: string;

  type: WorkspaceEventType;

  workspaceId: WorkspaceId;

  actorId?: UserId;

  data?: TData;

  metadata?: Record<string, unknown>;

  createdAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                            DEFAULT LIMITS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_WORKSPACE_LIMITS: Record<
  WorkspacePlan,
  WorkspaceLimits
> = {
  free: {
    maxMembers: 5,
    maxProjects: 10,
    maxTasks: 1_000,
    maxFiles: 1_000,
    maxStorageBytes: 1_073_741_824,
    maxApiKeys: 3,
    maxAgents: 3,
    maxKnowledgeBases: 3,
    maxIntegrations: 3,
    maxMonthlyRequests: 10_000,
    maxMonthlyTokens: 1_000_000,
    maxMonthlyAiGenerations: 1_000,
  },

  pro: {
    maxMembers: 25,
    maxProjects: 100,
    maxTasks: 50_000,
    maxFiles: 50_000,
    maxStorageBytes: 107_374_182_400,
    maxApiKeys: 20,
    maxAgents: 25,
    maxKnowledgeBases: 25,
    maxIntegrations: 25,
    maxMonthlyRequests: 1_000_000,
    maxMonthlyTokens: 100_000_000,
    maxMonthlyAiGenerations: 100_000,
  },

  business: {
    maxMembers: 250,
    maxProjects: 1_000,
    maxTasks: 1_000_000,
    maxFiles: 1_000_000,
    maxStorageBytes: 1_099_511_627_776,
    maxApiKeys: 100,
    maxAgents: 250,
    maxKnowledgeBases: 250,
    maxIntegrations: 100,
    maxMonthlyRequests: 10_000_000,
    maxMonthlyTokens: 1_000_000_000,
    maxMonthlyAiGenerations: 1_000_000,
  },

  enterprise: {
    maxMembers: null,
    maxProjects: null,
    maxTasks: null,
    maxFiles: null,
    maxStorageBytes: null,
    maxApiKeys: null,
    maxAgents: null,
    maxKnowledgeBases: null,
    maxIntegrations: null,
    maxMonthlyRequests: null,
    maxMonthlyTokens: null,
    maxMonthlyAiGenerations: null,
  },

  custom: {
    maxMembers: null,
    maxProjects: null,
    maxTasks: null,
    maxFiles: null,
    maxStorageBytes: null,
    maxApiKeys: null,
    maxAgents: null,
    maxKnowledgeBases: null,
    maxIntegrations: null,
    maxMonthlyRequests: null,
    maxMonthlyTokens: null,
    maxMonthlyAiGenerations: null,
  },
};

/* -------------------------------------------------------------------------- */
/*                           DEFAULT SETTINGS                                 */
/* -------------------------------------------------------------------------- */

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  timezone: "UTC",

  locale: "en",

  dateFormat: "YYYY-MM-DD",

  security: {
    allowPublicSharing: false,
    requireTwoFactorAuth: false,
    allowExternalInvitations: true,
    allowGuestAccess: true,
  },

  ai: {
    enabled: true,
    allowCustomModels: false,
    allowExternalProviders: false,
  },

  notifications: {
    emailEnabled: true,
    pushEnabled: true,
    slackEnabled: true,
    webhookEnabled: true,
  },
};

/* -------------------------------------------------------------------------- */
/*                              TYPE GUARDS                                   */
/* -------------------------------------------------------------------------- */

export function isWorkspaceStatus(
  value: unknown
): value is WorkspaceStatus {
  return (
    value === "active" ||
    value === "suspended" ||
    value === "archived" ||
    value === "deleted"
  );
}

export function isWorkspacePlan(
  value: unknown
): value is WorkspacePlan {
  return (
    value === "free" ||
    value === "pro" ||
    value === "business" ||
    value === "enterprise" ||
    value === "custom"
  );
}

export function isWorkspaceRole(
  value: unknown
): value is WorkspaceRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "member" ||
    value === "viewer" ||
    value === "guest"
  );
}

export function isWorkspaceMemberStatus(
  value: unknown
): value is WorkspaceMemberStatus {
  return (
    value === "active" ||
    value === "invited" ||
    value === "suspended" ||
    value === "removed"
  );
}

export function isWorkspaceInvitationStatus(
  value: unknown
): value is WorkspaceInvitationStatus {
  return (
    value === "pending" ||
    value === "accepted" ||
    value === "declined" ||
    value === "expired" ||
    value === "revoked"
  );
}

export function isWorkspacePermission(
  value: unknown
): value is WorkspacePermission {
  return (
    typeof value === "string" &&
    Object.values(
      WORKSPACE_ROLE_PERMISSIONS
    ).some(
      (permissions) =>
        permissions.includes(
          value as WorkspacePermission
        )
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                          PERMISSION HELPERS                                */
/* -------------------------------------------------------------------------- */

export function getRolePermissions(
  role: WorkspaceRole
): WorkspacePermission[] {
  return [
    ...WORKSPACE_ROLE_PERMISSIONS[
      role
    ],
  ];
}

export function hasWorkspacePermission(
  role: WorkspaceRole,
  permission: WorkspacePermission,
  customPermissions?: WorkspacePermission[]
): boolean {
  if (role === "owner") {
    return true;
  }

  const permissions = new Set<
    WorkspacePermission
  >([
    ...WORKSPACE_ROLE_PERMISSIONS[
      role
    ],
    ...(customPermissions ?? []),
  ]);

  return permissions.has(
    permission
  );
}

export function isWorkspaceOwner(
  member: Pick<
    WorkspaceMember,
    "role"
  >
): boolean {
  return member.role === "owner";
}

export function isWorkspaceAdmin(
  member: Pick<
    WorkspaceMember,
    "role"
  >
): boolean {
  return (
    member.role === "owner" ||
    member.role === "admin"
  );
}

/* -------------------------------------------------------------------------- */
/*                          DEFAULT VALUE HELPERS                             */
/* -------------------------------------------------------------------------- */

export function createDefaultWorkspaceLimits(
  plan: WorkspacePlan = "free"
): WorkspaceLimits {
  const limits =
    DEFAULT_WORKSPACE_LIMITS[
      plan
    ];

  return {
    ...limits,

    custom: limits.custom
      ? {
          ...limits.custom,
        }
      : undefined,
  };
}

export function createDefaultWorkspaceUsage(): WorkspaceUsage {
  return {
    members: 0,
    projects: 0,
    tasks: 0,
    files: 0,
    storageBytes: 0,
    apiKeys: 0,
    agents: 0,
    knowledgeBases: 0,
    integrations: 0,
    monthlyRequests: 0,
    monthlyTokens: 0,
    monthlyAiGenerations: 0,
  };
}

export function createDefaultWorkspaceSettings(): WorkspaceSettings {
  return {
    ...DEFAULT_WORKSPACE_SETTINGS,

    security: {
      ...DEFAULT_WORKSPACE_SETTINGS.security,
    },

    ai: {
      ...DEFAULT_WORKSPACE_SETTINGS.ai,
    },

    notifications: {
      ...DEFAULT_WORKSPACE_SETTINGS.notifications,
    },
  };
}