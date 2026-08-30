/**
 * SYRAVEN
 * lib/permissions.ts
 *
 * Enterprise Role Based Access Control (RBAC)
 * and Permission Management System.
 */

import {
  type AuthUser,
  type UserRole,
  isAuthenticated,
  hasRole,
  hasMinimumRole,
} from "./auth";

/* -------------------------------------------------------------------------- */
/*                               PERMISSIONS                                  */
/* -------------------------------------------------------------------------- */

export type Permission =
  /* Dashboard */
  | "dashboard.view"

  /* Projects */
  | "projects.view"
  | "projects.create"
  | "projects.update"
  | "projects.delete"

  /* AI */
  | "ai.use"
  | "ai.models.view"
  | "ai.models.manage"

  /* Agents */
  | "agents.view"
  | "agents.create"
  | "agents.update"
  | "agents.delete"
  | "agents.execute"
  | "agents.manage"

  /* Tasks */
  | "tasks.view"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"
  | "tasks.execute"
  | "tasks.manage"

  /* Workflows */
  | "workflows.view"
  | "workflows.create"
  | "workflows.update"
  | "workflows.delete"
  | "workflows.execute"

  /* Files */
  | "files.view"
  | "files.upload"
  | "files.update"
  | "files.delete"

  /* Data */
  | "data.view"
  | "data.create"
  | "data.update"
  | "data.delete"
  | "data.export"

  /* Research */
  | "research.view"
  | "research.create"
  | "research.execute"

  /* Coding */
  | "coding.view"
  | "coding.create"
  | "coding.execute"

  /* Design */
  | "design.view"
  | "design.create"
  | "design.execute"

  /* Writing */
  | "writing.view"
  | "writing.create"
  | "writing.execute"

  /* Presentations */
  | "presentations.view"
  | "presentations.create"
  | "presentations.update"
  | "presentations.delete"
  | "presentations.export"

  /* Websites */
  | "websites.view"
  | "websites.create"
  | "websites.update"
  | "websites.delete"
  | "websites.publish"

  /* Analytics */
  | "analytics.view"
  | "analytics.export"

  /* Billing */
  | "billing.view"
  | "billing.manage"

  /* Team */
  | "team.view"
  | "team.invite"
  | "team.update"
  | "team.remove"

  /* Organization */
  | "organization.view"
  | "organization.update"
  | "organization.delete"

  /* Settings */
  | "settings.view"
  | "settings.update"

  /* Security */
  | "security.view"
  | "security.manage"
  | "audit.view"

  /* Administration */
  | "admin.view"
  | "admin.manage"

  /* System */
  | "system.view"
  | "system.manage";

/* -------------------------------------------------------------------------- */
/*                           PERMISSION GROUPS                                */
/* -------------------------------------------------------------------------- */

export const PERMISSION_GROUPS = {
  dashboard: ["dashboard.view"],

  projects: [
    "projects.view",
    "projects.create",
    "projects.update",
    "projects.delete",
  ],

  ai: [
    "ai.use",
    "ai.models.view",
    "ai.models.manage",
  ],

  agents: [
    "agents.view",
    "agents.create",
    "agents.update",
    "agents.delete",
    "agents.execute",
    "agents.manage",
  ],

  tasks: [
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "tasks.execute",
    "tasks.manage",
  ],

  workflows: [
    "workflows.view",
    "workflows.create",
    "workflows.update",
    "workflows.delete",
    "workflows.execute",
  ],

  files: [
    "files.view",
    "files.upload",
    "files.update",
    "files.delete",
  ],

  data: [
    "data.view",
    "data.create",
    "data.update",
    "data.delete",
    "data.export",
  ],

  research: [
    "research.view",
    "research.create",
    "research.execute",
  ],

  coding: [
    "coding.view",
    "coding.create",
    "coding.execute",
  ],

  design: [
    "design.view",
    "design.create",
    "design.execute",
  ],

  writing: [
    "writing.view",
    "writing.create",
    "writing.execute",
  ],

  presentations: [
    "presentations.view",
    "presentations.create",
    "presentations.update",
    "presentations.delete",
    "presentations.export",
  ],

  websites: [
    "websites.view",
    "websites.create",
    "websites.update",
    "websites.delete",
    "websites.publish",
  ],

  analytics: [
    "analytics.view",
    "analytics.export",
  ],

  billing: [
    "billing.view",
    "billing.manage",
  ],

  team: [
    "team.view",
    "team.invite",
    "team.update",
    "team.remove",
  ],

  organization: [
    "organization.view",
    "organization.update",
    "organization.delete",
  ],

  settings: [
    "settings.view",
    "settings.update",
  ],

  security: [
    "security.view",
    "security.manage",
    "audit.view",
  ],

  admin: [
    "admin.view",
    "admin.manage",
  ],

  system: [
    "system.view",
    "system.manage",
  ],
} as const satisfies Record<string, readonly Permission[]>;

/* -------------------------------------------------------------------------- */
/*                           ALL PERMISSIONS                                  */
/* -------------------------------------------------------------------------- */

export const ALL_PERMISSIONS = [
  ...PERMISSION_GROUPS.dashboard,
  ...PERMISSION_GROUPS.projects,
  ...PERMISSION_GROUPS.ai,
  ...PERMISSION_GROUPS.agents,
  ...PERMISSION_GROUPS.tasks,
  ...PERMISSION_GROUPS.workflows,
  ...PERMISSION_GROUPS.files,
  ...PERMISSION_GROUPS.data,
  ...PERMISSION_GROUPS.research,
  ...PERMISSION_GROUPS.coding,
  ...PERMISSION_GROUPS.design,
  ...PERMISSION_GROUPS.writing,
  ...PERMISSION_GROUPS.presentations,
  ...PERMISSION_GROUPS.websites,
  ...PERMISSION_GROUPS.analytics,
  ...PERMISSION_GROUPS.billing,
  ...PERMISSION_GROUPS.team,
  ...PERMISSION_GROUPS.organization,
  ...PERMISSION_GROUPS.settings,
  ...PERMISSION_GROUPS.security,
  ...PERMISSION_GROUPS.admin,
  ...PERMISSION_GROUPS.system,
] as Permission[];

/* -------------------------------------------------------------------------- */
/*                         ROLE PERMISSION MATRIX                             */
/* -------------------------------------------------------------------------- */

const VIEWER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "projects.view",
  "ai.models.view",
  "agents.view",
  "tasks.view",
  "workflows.view",
  "files.view",
  "data.view",
  "research.view",
  "coding.view",
  "design.view",
  "writing.view",
  "presentations.view",
  "websites.view",
  "analytics.view",
  "settings.view",
];

const MEMBER_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,

  "ai.use",

  "projects.create",
  "projects.update",

  "agents.create",
  "agents.execute",

  "tasks.create",
  "tasks.execute",

  "workflows.create",
  "workflows.execute",

  "files.upload",

  "data.create",

  "research.create",
  "research.execute",

  "coding.create",
  "coding.execute",

  "design.create",
  "design.execute",

  "writing.create",
  "writing.execute",

  "presentations.create",
  "presentations.update",
  "presentations.export",

  "websites.create",
  "websites.update",
];

const ANALYST_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,

  "analytics.export",
  "data.export",
];

const DEVELOPER_PERMISSIONS: Permission[] = [
  ...ANALYST_PERMISSIONS,

  "coding.create",
  "coding.execute",

  "ai.models.view",

  "agents.update",

  "tasks.update",
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...DEVELOPER_PERMISSIONS,

  "projects.delete",

  "agents.update",
  "agents.delete",

  "tasks.update",
  "tasks.delete",

  "workflows.update",
  "workflows.delete",

  "files.update",
  "files.delete",

  "data.update",
  "data.delete",

  "presentations.delete",

  "websites.delete",

  "team.view",
  "team.invite",
  "team.update",

  "organization.view",

  "analytics.view",
  "analytics.export",

  "billing.view",
];

const OWNER_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,

  "billing.manage",

  "team.remove",

  "organization.update",

  "security.view",
  "audit.view",

  "admin.view",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...OWNER_PERMISSIONS,

  "agents.manage",
  "tasks.manage",

  "ai.models.manage",

  "security.manage",

  "admin.manage",

  "system.view",
];

const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  ...ALL_PERMISSIONS,
];

/* -------------------------------------------------------------------------- */
/*                        ROLE PERMISSION MAP                                 */
/* -------------------------------------------------------------------------- */

export const ROLE_PERMISSIONS: Record<
  UserRole,
  readonly Permission[]
> = {
  guest: [],

  viewer: VIEWER_PERMISSIONS,

  member: MEMBER_PERMISSIONS,

  analyst: ANALYST_PERMISSIONS,

  developer: DEVELOPER_PERMISSIONS,

  manager: MANAGER_PERMISSIONS,

  owner: OWNER_PERMISSIONS,

  admin: ADMIN_PERMISSIONS,

  super_admin: SUPER_ADMIN_PERMISSIONS,
};

/* -------------------------------------------------------------------------- */
/*                          PERMISSION CONTEXT                                */
/* -------------------------------------------------------------------------- */

export interface PermissionContext {
  user: AuthUser | null | undefined;

  permission: Permission | Permission[];

  requireAll?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                          PERMISSION RESULT                                 */
/* -------------------------------------------------------------------------- */

export interface PermissionResult {
  allowed: boolean;

  granted: Permission[];

  missing: Permission[];

  reason?: string;
}

/* -------------------------------------------------------------------------- */
/*                         GET USER PERMISSIONS                               */
/* -------------------------------------------------------------------------- */

export function getUserPermissions(
  user: AuthUser | null | undefined,
): Permission[] {
  if (!isAuthenticated(user)) {
    return [];
  }

  return [...ROLE_PERMISSIONS[user.role]];
}

/* -------------------------------------------------------------------------- */
/*                           HAS PERMISSION                                   */
/* -------------------------------------------------------------------------- */

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: Permission,
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  if (user.role === "super_admin") {
    return true;
  }

  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/* -------------------------------------------------------------------------- */
/*                        HAS ANY PERMISSION                                  */
/* -------------------------------------------------------------------------- */

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: Permission[],
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  return permissions.some((permission) =>
    hasPermission(user, permission),
  );
}

/* -------------------------------------------------------------------------- */
/*                        HAS ALL PERMISSIONS                                 */
/* -------------------------------------------------------------------------- */

export function hasAllPermissions(
  user: AuthUser | null | undefined,
  permissions: Permission[],
): boolean {
  if (!isAuthenticated(user)) {
    return false;
  }

  return permissions.every((permission) =>
    hasPermission(user, permission),
  );
}

/* -------------------------------------------------------------------------- */
/*                        CHECK PERMISSIONS                                  */
/* -------------------------------------------------------------------------- */

export function checkPermissions(
  context: PermissionContext,
): PermissionResult {
  const {
    user,
    permission,
    requireAll = false,
  } = context;

  const permissions = Array.isArray(permission)
    ? permission
    : [permission];

  if (!isAuthenticated(user)) {
    return {
      allowed: false,
      granted: [],
      missing: permissions,
      reason: "User is not authenticated",
    };
  }

  const granted = permissions.filter((item) =>
    hasPermission(user, item),
  );

  const missing = permissions.filter(
    (item) => !hasPermission(user, item),
  );

  const allowed = requireAll
    ? missing.length === 0
    : granted.length > 0;

  return {
    allowed,
    granted,
    missing,
    reason: allowed
      ? undefined
      : "Insufficient permissions",
  };
}

/* -------------------------------------------------------------------------- */
/*                        REQUIRE PERMISSION                                  */
/* -------------------------------------------------------------------------- */

export class PermissionDeniedError extends Error {
  public readonly code = "PERMISSION_DENIED";

  public readonly permissions: Permission[];

  constructor(
    permissions: Permission | Permission[],
    message = "You do not have permission to perform this action",
  ) {
    super(message);

    this.name = "PermissionDeniedError";

    this.permissions = Array.isArray(permissions)
      ? permissions
      : [permissions];
  }
}

export function requirePermission(
  user: AuthUser | null | undefined,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export function requireAnyPermission(
  user: AuthUser | null | undefined,
  permissions: Permission[],
): void {
  if (!hasAnyPermission(user, permissions)) {
    throw new PermissionDeniedError(
      permissions,
      "None of the required permissions are available",
    );
  }
}

export function requireAllPermissions(
  user: AuthUser | null | undefined,
  permissions: Permission[],
): void {
  if (!hasAllPermissions(user, permissions)) {
    throw new PermissionDeniedError(
      permissions,
      "One or more required permissions are missing",
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                           ROLE HELPERS                                     */
/* -------------------------------------------------------------------------- */

export function canAccessRole(
  user: AuthUser | null | undefined,
  role: UserRole | UserRole[],
): boolean {
  return hasRole(user, role);
}

export function canAccessMinimumRole(
  user: AuthUser | null | undefined,
  role: UserRole,
): boolean {
  return hasMinimumRole(user, role);
}

/* -------------------------------------------------------------------------- */
/*                           PERMISSION VALIDATION                            */
/* -------------------------------------------------------------------------- */

export function isValidPermission(
  value: string,
): value is Permission {
  return ALL_PERMISSIONS.includes(value as Permission);
}

/* -------------------------------------------------------------------------- */
/*                           DEFAULT EXPORT                                   */
/* -------------------------------------------------------------------------- */

const permissions = {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_PERMISSIONS,

  getUserPermissions,

  hasPermission,
  hasAnyPermission,
  hasAllPermissions,

  checkPermissions,

  requirePermission,
  requireAnyPermission,
  requireAllPermissions,

  canAccessRole,
  canAccessMinimumRole,

  isValidPermission,
};

export default permissions;