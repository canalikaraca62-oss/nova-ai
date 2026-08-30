/**
 * SYRAVEN Project Types
 *
 * Shared project domain contracts.
 *
 * Supports:
 * - Projects
 * - Members
 * - Roles
 * - Status management
 * - Project settings
 * - Project metadata
 * - Tags
 * - Resources
 * - Activity
 * - Statistics
 * - Filtering
 * - Pagination
 *
 * Designed for strict TypeScript and large-scale systems.
 */

/* -------------------------------------------------------------------------- */
/*                                PROJECT STATUS                              */
/* -------------------------------------------------------------------------- */

export type ProjectStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived"
  | "completed"
  | "cancelled";

/* -------------------------------------------------------------------------- */
/*                                PROJECT VISIBILITY                          */
/* -------------------------------------------------------------------------- */

export type ProjectVisibility =
  | "private"
  | "workspace"
  | "public";

/* -------------------------------------------------------------------------- */
/*                                PROJECT PRIORITY                            */
/* -------------------------------------------------------------------------- */

export type ProjectPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

/* -------------------------------------------------------------------------- */
/*                                MEMBER ROLE                                 */
/* -------------------------------------------------------------------------- */

export type ProjectMemberRole =
  | "owner"
  | "admin"
  | "manager"
  | "editor"
  | "member"
  | "viewer";

/* -------------------------------------------------------------------------- */
/*                              PROJECT RESOURCE TYPE                         */
/* -------------------------------------------------------------------------- */

export type ProjectResourceType =
  | "file"
  | "document"
  | "task"
  | "knowledge"
  | "conversation"
  | "agent"
  | "integration"
  | "canvas"
  | "link"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              PROJECT ACTIVITY TYPE                         */
/* -------------------------------------------------------------------------- */

export type ProjectActivityType =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "project.archived"
  | "project.restored"
  | "project.completed"
  | "project.member_added"
  | "project.member_removed"
  | "project.member_role_updated"
  | "project.resource_added"
  | "project.resource_removed"
  | "project.status_changed"
  | "project.priority_changed"
  | "project.settings_updated"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                                PROJECT MEMBER                              */
/* -------------------------------------------------------------------------- */

export interface ProjectMember {
  id: string;

  projectId: string;

  userId: string;

  role: ProjectMemberRole;

  joinedAt: Date;

  invitedBy?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               PROJECT TAG                                  */
/* -------------------------------------------------------------------------- */

export interface ProjectTag {
  id: string;

  name: string;

  color?: string;

  createdAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            PROJECT RESOURCE                                */
/* -------------------------------------------------------------------------- */

export interface ProjectResource {
  id: string;

  projectId: string;

  type: ProjectResourceType;

  resourceId: string;

  title?: string;

  url?: string;

  createdAt: Date;

  createdBy?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              PROJECT SETTINGS                              */
/* -------------------------------------------------------------------------- */

export interface ProjectSettings {
  allowMemberInvites: boolean;

  allowExternalSharing: boolean;

  allowPublicAccess: boolean;

  notificationsEnabled: boolean;

  aiEnabled: boolean;

  integrationsEnabled: boolean;

  autoArchiveCompleted: boolean;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                  PROJECT                                   */
/* -------------------------------------------------------------------------- */

export interface Project {
  id: string;

  workspaceId?: string;

  ownerId: string;

  name: string;

  slug?: string;

  description?: string;

  status: ProjectStatus;

  visibility: ProjectVisibility;

  priority: ProjectPriority;

  tags: ProjectTag[];

  settings: ProjectSettings;

  startDate?: Date;

  dueDate?: Date;

  completedAt?: Date;

  archivedAt?: Date;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              CREATE PROJECT INPUT                          */
/* -------------------------------------------------------------------------- */

export interface CreateProjectInput {
  workspaceId?: string;

  ownerId: string;

  name: string;

  slug?: string;

  description?: string;

  status?: ProjectStatus;

  visibility?: ProjectVisibility;

  priority?: ProjectPriority;

  tags?: ProjectTag[];

  settings?: Partial<ProjectSettings>;

  startDate?: Date;

  dueDate?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              UPDATE PROJECT INPUT                          */
/* -------------------------------------------------------------------------- */

export interface UpdateProjectInput {
  name?: string;

  slug?: string;

  description?: string;

  status?: ProjectStatus;

  visibility?: ProjectVisibility;

  priority?: ProjectPriority;

  tags?: ProjectTag[];

  settings?: Partial<ProjectSettings>;

  startDate?: Date;

  dueDate?: Date;

  completedAt?: Date;

  archivedAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                          ADD PROJECT MEMBER INPUT                          */
/* -------------------------------------------------------------------------- */

export interface AddProjectMemberInput {
  userId: string;

  role?: ProjectMemberRole;

  invitedBy?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                        UPDATE PROJECT MEMBER INPUT                         */
/* -------------------------------------------------------------------------- */

export interface UpdateProjectMemberInput {
  role?: ProjectMemberRole;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                        ADD PROJECT RESOURCE INPUT                          */
/* -------------------------------------------------------------------------- */

export interface AddProjectResourceInput {
  type: ProjectResourceType;

  resourceId: string;

  title?: string;

  url?: string;

  createdBy?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                          PROJECT ACTIVITY ACTOR                            */
/* -------------------------------------------------------------------------- */

export interface ProjectActivityActor {
  id: string;

  type:
    | "user"
    | "agent"
    | "system"
    | "service"
    | "integration";

  name?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             PROJECT ACTIVITY                               */
/* -------------------------------------------------------------------------- */

export interface ProjectActivity {
  id: string;

  projectId: string;

  type: ProjectActivityType;

  actor?: ProjectActivityActor;

  title: string;

  description?: string;

  resourceId?: string;

  resourceType?: ProjectResourceType;

  createdAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              PROJECT FILTERS                               */
/* -------------------------------------------------------------------------- */

export interface ProjectListOptions {
  workspaceId?: string;

  ownerId?: string;

  memberId?: string;

  status?: ProjectStatus | ProjectStatus[];

  visibility?: ProjectVisibility | ProjectVisibility[];

  priority?: ProjectPriority | ProjectPriority[];

  tagId?: string;

  search?: string;

  createdAfter?: Date;

  createdBefore?: Date;

  dueAfter?: Date;

  dueBefore?: Date;

  limit?: number;

  offset?: number;
}

/* -------------------------------------------------------------------------- */
/*                             PROJECT LIST RESULT                            */
/* -------------------------------------------------------------------------- */

export interface ProjectListResult {
  projects: Project[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                             PROJECT MEMBER LIST                            */
/* -------------------------------------------------------------------------- */

export interface ProjectMemberListResult {
  members: ProjectMember[];

  total: number;
}

/* -------------------------------------------------------------------------- */
/*                            PROJECT RESOURCE LIST                           */
/* -------------------------------------------------------------------------- */

export interface ProjectResourceListResult {
  resources: ProjectResource[];

  total: number;
}

/* -------------------------------------------------------------------------- */
/*                            PROJECT ACTIVITY LIST                           */
/* -------------------------------------------------------------------------- */

export interface ProjectActivityListOptions {
  type?:
    | ProjectActivityType
    | ProjectActivityType[];

  actorId?: string;

  limit?: number;

  offset?: number;

  createdAfter?: Date;

  createdBefore?: Date;
}

export interface ProjectActivityListResult {
  activities: ProjectActivity[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              PROJECT STATISTICS                            */
/* -------------------------------------------------------------------------- */

export interface ProjectStats {
  projectId: string;

  members: number;

  resources: number;

  files: number;

  documents: number;

  tasks: number;

  completedTasks: number;

  pendingTasks: number;

  knowledgeItems: number;

  conversations: number;

  agents: number;

  activities: number;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                              PROJECT SUMMARY                               */
/* -------------------------------------------------------------------------- */

export interface ProjectSummary {
  project: Project;

  memberCount: number;

  resourceCount: number;

  activityCount: number;

  stats?: ProjectStats;
}

/* -------------------------------------------------------------------------- */
/*                             PROJECT PERMISSION                             */
/* -------------------------------------------------------------------------- */

export interface ProjectPermission {
  allowed: boolean;

  role?: ProjectMemberRole;

  reason?: string;
}

/* -------------------------------------------------------------------------- */
/*                          PROJECT SERVICE OPTIONS                           */
/* -------------------------------------------------------------------------- */

export interface ProjectServiceOptions {
  defaultListLimit?: number;

  maxListLimit?: number;

  defaultVisibility?: ProjectVisibility;

  defaultPriority?: ProjectPriority;

  enableActivities?: boolean;

  maxActivitiesPerProject?: number;
}

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

export const DEFAULT_PROJECT_STATUS:
  ProjectStatus = "active";

export const DEFAULT_PROJECT_VISIBILITY:
  ProjectVisibility = "private";

export const DEFAULT_PROJECT_PRIORITY:
  ProjectPriority = "normal";

export const DEFAULT_PROJECT_MEMBER_ROLE:
  ProjectMemberRole = "member";

export const DEFAULT_PROJECT_LIST_LIMIT =
  50;

export const MAX_PROJECT_LIST_LIMIT =
  1_000;

export const DEFAULT_PROJECT_SETTINGS:
  ProjectSettings = {
    allowMemberInvites: true,

    allowExternalSharing: false,

    allowPublicAccess: false,

    notificationsEnabled: true,

    aiEnabled: true,

    integrationsEnabled: true,

    autoArchiveCompleted: false,
  };

/* -------------------------------------------------------------------------- */
/*                            ROLE HIERARCHY                                  */
/* -------------------------------------------------------------------------- */

export const PROJECT_ROLE_PRIORITY:
  Record<ProjectMemberRole, number> = {
    viewer: 1,

    member: 2,

    editor: 3,

    manager: 4,

    admin: 5,

    owner: 6,
  };