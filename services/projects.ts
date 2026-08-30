/**
 * SYRAVEN Projects Service
 *
 * Enterprise-grade project management service.
 *
 * Features:
 * - Project CRUD
 * - Project members
 * - Role management
 * - Ownership
 * - Project lifecycle
 * - Status management
 * - Progress tracking
 * - Archiving
 * - Filtering
 * - Pagination
 * - Search
 * - Metadata
 * - In-memory implementation
 *
 * Production note:
 * This service is storage agnostic.
 * The in-memory implementation can later be replaced with
 * Supabase/PostgreSQL without changing the public API.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "archived";

export type ProjectPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type ProjectMemberRole =
  | "owner"
  | "admin"
  | "manager"
  | "editor"
  | "member"
  | "viewer";

export interface ProjectMember {
  userId: string;

  role: ProjectMemberRole;

  joinedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface Project {
  id: string;

  name: string;

  description?: string;

  ownerId: string;

  status: ProjectStatus;

  priority: ProjectPriority;

  progress: number;

  startDate?: Date;

  dueDate?: Date;

  completedAt?: Date;

  archivedAt?: Date;

  members: ProjectMember[];

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;

  ownerId: string;

  description?: string;

  status?: ProjectStatus;

  priority?: ProjectPriority;

  progress?: number;

  startDate?: Date;

  dueDate?: Date;

  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;

  description?: string;

  status?: ProjectStatus;

  priority?: ProjectPriority;

  progress?: number;

  startDate?: Date;

  dueDate?: Date;

  metadata?: Record<string, unknown>;
}

export interface AddProjectMemberInput {
  userId: string;

  role?: ProjectMemberRole;

  metadata?: Record<string, unknown>;
}

export interface UpdateProjectMemberInput {
  role?: ProjectMemberRole;

  metadata?: Record<string, unknown>;
}

export interface ProjectListOptions {
  ownerId?: string;

  memberId?: string;

  status?: ProjectStatus;

  priority?: ProjectPriority;

  includeArchived?: boolean;

  search?: string;

  limit?: number;

  offset?: number;
}

export interface ProjectListResult {
  projects: Project[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface ProjectStats {
  ownerId?: string;

  total: number;

  planning: number;

  active: number;

  onHold: number;

  completed: number;

  cancelled: number;

  archived: number;

  averageProgress: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class ProjectServiceError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "ProjectServiceError";
  }
}

export class ProjectNotFoundError
  extends ProjectServiceError {
  constructor(
    projectId: string
  ) {
    super(
      `Project not found: ${projectId}`
    );

    this.name =
      "ProjectNotFoundError";
  }
}

export class ProjectMemberNotFoundError
  extends ProjectServiceError {
  constructor(
    projectId: string,
    userId: string
  ) {
    super(
      `Project member not found: ${userId} in project ${projectId}`
    );

    this.name =
      "ProjectMemberNotFoundError";
  }
}

export class ProjectValidationError
  extends ProjectServiceError {
  readonly errors: string[];

  constructor(
    errors: string[]
  ) {
    super(
      errors.join(" ")
    );

    this.name =
      "ProjectValidationError";

    this.errors =
      errors;
  }
}

export class ProjectPermissionError
  extends ProjectServiceError {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "ProjectPermissionError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_PROJECT_LIMIT =
  50;

export const MAX_PROJECT_LIMIT =
  500;

export const MAX_PROJECT_NAME_LENGTH =
  500;

export const MAX_PROJECT_DESCRIPTION_LENGTH =
  100_000;

/* -------------------------------------------------------------------------- */
/*                             PROJECTS SERVICE                               */
/* -------------------------------------------------------------------------- */

export class ProjectsService {
  private readonly projects =
    new Map<
      string,
      Project
    >();

  /* ------------------------------------------------------------------------ */
  /*                                  CREATE                                  */
  /* ------------------------------------------------------------------------ */

  create(
    input: CreateProjectInput
  ): Project {
    this.validateCreateInput(
      input
    );

    const now =
      new Date();

    const status =
      input.status ??
      "planning";

    const progress =
      this.normalizeProgress(
        input.progress ?? 0
      );

    const project: Project = {
      id:
        this.generateId(
          "project"
        ),

      name:
        input.name.trim(),

      description:
        this.normalizeOptionalText(
          input.description
        ),

      ownerId:
        input.ownerId.trim(),

      status,

      priority:
        input.priority ??
        "normal",

      progress,

      startDate:
        input.startDate
          ? new Date(
              input.startDate
            )
          : undefined,

      dueDate:
        input.dueDate
          ? new Date(
              input.dueDate
            )
          : undefined,

      completedAt:
        status === "completed"
          ? now
          : undefined,

      archivedAt:
        status === "archived"
          ? now
          : undefined,

      members: [
        {
          userId:
            input.ownerId.trim(),

          role:
            "owner",

          joinedAt:
            now,
        },
      ],

      metadata:
        this.cloneMetadata(
          input.metadata
        ),

      createdAt:
        now,

      updatedAt:
        now,
    };

    this.validateProjectDates(
      project.startDate,
      project.dueDate
    );

    this.projects.set(
      project.id,
      project
    );

    return this.cloneProject(
      project
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                   READ                                   */
  /* ------------------------------------------------------------------------ */

  get(
    projectId: string
  ): Project | undefined {
    const project =
      this.projects.get(
        projectId
      );

    if (!project) {
      return undefined;
    }

    return this.cloneProject(
      project
    );
  }

  require(
    projectId: string
  ): Project {
    const project =
      this.get(
        projectId
      );

    if (!project) {
      throw new ProjectNotFoundError(
        projectId
      );
    }

    return project;
  }

  list(
    options: ProjectListOptions = {}
  ): ProjectListResult {
    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    let items =
      Array.from(
        this.projects.values()
      );

    if (
      options.ownerId !== undefined
    ) {
      items =
        items.filter(
          (project) =>
            project.ownerId ===
            options.ownerId
        );
    }

    if (
      options.memberId !== undefined
    ) {
      items =
        items.filter(
          (project) =>
            project.members.some(
              (member) =>
                member.userId ===
                options.memberId
            )
        );
    }

    if (
      options.status !== undefined
    ) {
      items =
        items.filter(
          (project) =>
            project.status ===
            options.status
        );
    }

    if (
      options.priority !== undefined
    ) {
      items =
        items.filter(
          (project) =>
            project.priority ===
            options.priority
        );
    }

    if (
      !options.includeArchived
    ) {
      items =
        items.filter(
          (project) =>
            project.status !==
            "archived"
        );
    }

    if (
      options.search &&
      options.search.trim()
    ) {
      const query =
        options.search
          .trim()
          .toLowerCase();

      items =
        items.filter(
          (project) =>
            project.name
              .toLowerCase()
              .includes(query) ||
            project.description
              ?.toLowerCase()
              .includes(query)
        );
    }

    items.sort(
      (a, b) =>
        b.updatedAt.getTime() -
        a.updatedAt.getTime()
    );

    const total =
      items.length;

    const projects =
      items
        .slice(
          offset,
          offset + limit
        )
        .map(
          (project) =>
            this.cloneProject(
              project
            )
        );

    return {
      projects,

      total,

      limit,

      offset,

      hasMore:
        offset +
          projects.length <
        total,
    };
  }

  getProjectsForUser(
    userId: string,
    options: Omit<
      ProjectListOptions,
      "memberId"
    > = {}
  ): ProjectListResult {
    return this.list({
      ...options,

      memberId:
        userId,
    });
  }

  getProjectsForOwner(
    ownerId: string,
    options: Omit<
      ProjectListOptions,
      "ownerId"
    > = {}
  ): ProjectListResult {
    return this.list({
      ...options,

      ownerId,
    });
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UPDATE                                  */
  /* ------------------------------------------------------------------------ */

  update(
    projectId: string,
    input: UpdateProjectInput
  ): Project {
    const existing =
      this.require(
        projectId
      );

    this.validateUpdateInput(
      input
    );

    const nextStatus =
      input.status ??
      existing.status;

    const nextProgress =
      input.progress !== undefined
        ? this.normalizeProgress(
            input.progress
          )
        : existing.progress;

    const nextStartDate =
      input.startDate !== undefined
        ? new Date(
            input.startDate
          )
        : existing.startDate;

    const nextDueDate =
      input.dueDate !== undefined
        ? new Date(
            input.dueDate
          )
        : existing.dueDate;

    this.validateProjectDates(
      nextStartDate,
      nextDueDate
    );

    const now =
      new Date();

    const updated: Project = {
      ...existing,

      name:
        input.name !== undefined
          ? input.name.trim()
          : existing.name,

      description:
        input.description !== undefined
          ? this.normalizeOptionalText(
              input.description
            )
          : existing.description,

      status:
        nextStatus,

      priority:
        input.priority ??
        existing.priority,

      progress:
        nextProgress,

      startDate:
        nextStartDate,

      dueDate:
        nextDueDate,

      completedAt:
        this.resolveCompletedAt(
          existing,
          nextStatus,
          now
        ),

      archivedAt:
        this.resolveArchivedAt(
          existing,
          nextStatus,
          now
        ),

      metadata:
        input.metadata !== undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        now,
    };

    this.projects.set(
      projectId,
      updated
    );

    return this.cloneProject(
      updated
    );
  }

  updateProgress(
    projectId: string,
    progress: number
  ): Project {
    return this.update(
      projectId,
      {
        progress,
      }
    );
  }

  updateStatus(
    projectId: string,
    status: ProjectStatus
  ): Project {
    return this.update(
      projectId,
      {
        status,
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              PROJECT STATE                               */
  /* ------------------------------------------------------------------------ */

  complete(
    projectId: string
  ): Project {
    return this.update(
      projectId,
      {
        status:
          "completed",

        progress:
          100,
      }
    );
  }

  archive(
    projectId: string
  ): Project {
    return this.update(
      projectId,
      {
        status:
          "archived",
      }
    );
  }

  restore(
    projectId: string
  ): Project {
    const project =
      this.require(
        projectId
      );

    const restoredStatus =
      project.progress >= 100
        ? "completed"
        : "active";

    return this.update(
      projectId,
      {
        status:
          restoredStatus,
      }
    );
  }

  cancel(
    projectId: string
  ): Project {
    return this.update(
      projectId,
      {
        status:
          "cancelled",
      }
    );
  }

  putOnHold(
    projectId: string
  ): Project {
    return this.update(
      projectId,
      {
        status:
          "on_hold",
      }
    );
  }

  activate(
    projectId: string
  ): Project {
    return this.update(
      projectId,
      {
        status:
          "active",
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  MEMBERS                                 */
  /* ------------------------------------------------------------------------ */

  getMembers(
    projectId: string
  ): ProjectMember[] {
    const project =
      this.require(
        projectId
      );

    return project.members.map(
      (member) =>
        this.cloneMember(
          member
        )
    );
  }

  getMember(
    projectId: string,
    userId: string
  ): ProjectMember | undefined {
    const project =
      this.require(
        projectId
      );

    const member =
      project.members.find(
        (item) =>
          item.userId ===
          userId
      );

    if (!member) {
      return undefined;
    }

    return this.cloneMember(
      member
    );
  }

  requireMember(
    projectId: string,
    userId: string
  ): ProjectMember {
    const member =
      this.getMember(
        projectId,
        userId
      );

    if (!member) {
      throw new ProjectMemberNotFoundError(
        projectId,
        userId
      );
    }

    return member;
  }

  addMember(
    projectId: string,
    input: AddProjectMemberInput
  ): Project {
    const project =
      this.require(
        projectId
      );

    const userId =
      input.userId.trim();

    if (!userId) {
      throw new ProjectValidationError(
        [
          "Project member user ID is required.",
        ]
      );
    }

    const existing =
      project.members.find(
        (member) =>
          member.userId ===
          userId
      );

    if (existing) {
      throw new ProjectValidationError(
        [
          `User is already a member of project: ${userId}`,
        ]
      );
    }

    if (
      input.role === "owner"
    ) {
      throw new ProjectValidationError(
        [
          "Use transferOwnership to assign project ownership.",
        ]
      );
    }

    const now =
      new Date();

    const updated: Project = {
      ...project,

      members: [
        ...project.members,

        {
          userId,

          role:
            input.role ??
            "member",

          joinedAt:
            now,

          metadata:
            this.cloneMetadata(
              input.metadata
            ),
        },
      ],

      updatedAt:
        now,
    };

    this.projects.set(
      projectId,
      updated
    );

    return this.cloneProject(
      updated
    );
  }

  updateMember(
    projectId: string,
    userId: string,
    input: UpdateProjectMemberInput
  ): Project {
    const project =
      this.require(
        projectId
      );

    const member =
      project.members.find(
        (item) =>
          item.userId ===
          userId
      );

    if (!member) {
      throw new ProjectMemberNotFoundError(
        projectId,
        userId
      );
    }

    if (
      member.role === "owner" &&
      input.role !== undefined &&
      input.role !== "owner"
    ) {
      throw new ProjectValidationError(
        [
          "Project owner role cannot be changed directly. Use transferOwnership.",
        ]
      );
    }

    if (
      input.role === "owner" &&
      member.role !== "owner"
    ) {
      throw new ProjectValidationError(
        [
          "Use transferOwnership to assign project ownership.",
        ]
      );
    }

    const now =
      new Date();

    const updated: Project = {
      ...project,

      members:
        project.members.map(
          (item) => {
            if (
              item.userId !==
              userId
            ) {
              return item;
            }

            return {
              ...item,

              role:
                input.role ??
                item.role,

              metadata:
                input.metadata !==
                undefined
                  ? this.cloneMetadata(
                      input.metadata
                    )
                  : item.metadata,
            };
          }
        ),

      updatedAt:
        now,
    };

    this.projects.set(
      projectId,
      updated
    );

    return this.cloneProject(
      updated
    );
  }

  removeMember(
    projectId: string,
    userId: string
  ): Project {
    const project =
      this.require(
        projectId
      );

    const member =
      project.members.find(
        (item) =>
          item.userId ===
          userId
      );

    if (!member) {
      throw new ProjectMemberNotFoundError(
        projectId,
        userId
      );
    }

    if (
      member.role === "owner"
    ) {
      throw new ProjectValidationError(
        [
          "Project owner cannot be removed. Transfer ownership first.",
        ]
      );
    }

    const now =
      new Date();

    const updated: Project = {
      ...project,

      members:
        project.members.filter(
          (item) =>
            item.userId !==
            userId
        ),

      updatedAt:
        now,
    };

    this.projects.set(
      projectId,
      updated
    );

    return this.cloneProject(
      updated
    );
  }

  transferOwnership(
    projectId: string,
    newOwnerId: string
  ): Project {
    const project =
      this.require(
        projectId
      );

    const newOwner =
      project.members.find(
        (member) =>
          member.userId ===
          newOwnerId
      );

    if (!newOwner) {
      throw new ProjectMemberNotFoundError(
        projectId,
        newOwnerId
      );
    }

    if (
      newOwner.role === "owner"
    ) {
      return project;
    }

    const oldOwnerId =
      project.ownerId;

    const now =
      new Date();

    const updated: Project = {
      ...project,

      ownerId:
        newOwnerId,

      members:
        project.members.map(
          (member) => {
            if (
              member.userId ===
              newOwnerId
            ) {
              return {
                ...member,

                role:
                  "owner",
              };
            }

            if (
              member.userId ===
              oldOwnerId
            ) {
              return {
                ...member,

                role:
                  "admin",
              };
            }

            return member;
          }
        ),

      updatedAt:
        now,
    };

    this.projects.set(
      projectId,
      updated
    );

    return this.cloneProject(
      updated
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               PERMISSIONS                                */
  /* ------------------------------------------------------------------------ */

  isMember(
    projectId: string,
    userId: string
  ): boolean {
    return Boolean(
      this.getMember(
        projectId,
        userId
      )
    );
  }

  getMemberRole(
    projectId: string,
    userId: string
  ): ProjectMemberRole | undefined {
    return this.getMember(
      projectId,
      userId
    )?.role;
  }

  canAccess(
    projectId: string,
    userId: string
  ): boolean {
    return this.isMember(
      projectId,
      userId
    );
  }

  canManage(
    projectId: string,
    userId: string
  ): boolean {
    const role =
      this.getMemberRole(
        projectId,
        userId
      );

    return (
      role === "owner" ||
      role === "admin" ||
      role === "manager"
    );
  }

  canEdit(
    projectId: string,
    userId: string
  ): boolean {
    const role =
      this.getMemberRole(
        projectId,
        userId
      );

    return (
      role === "owner" ||
      role === "admin" ||
      role === "manager" ||
      role === "editor"
    );
  }

  assertAccess(
    projectId: string,
    userId: string
  ): void {
    if (
      !this.canAccess(
        projectId,
        userId
      )
    ) {
      throw new ProjectPermissionError(
        "User does not have access to this project."
      );
    }
  }

  assertCanManage(
    projectId: string,
    userId: string
  ): void {
    if (
      !this.canManage(
        projectId,
        userId
      )
    ) {
      throw new ProjectPermissionError(
        "User does not have permission to manage this project."
      );
    }
  }

  assertCanEdit(
    projectId: string,
    userId: string
  ): void {
    if (
      !this.canEdit(
        projectId,
        userId
      )
    ) {
      throw new ProjectPermissionError(
        "User does not have permission to edit this project."
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                   STATS                                  */
  /* ------------------------------------------------------------------------ */

  getStats(
    ownerId?: string
  ): ProjectStats {
    const projects =
      Array.from(
        this.projects.values()
      ).filter(
        (project) =>
          ownerId === undefined ||
          project.ownerId ===
            ownerId
      );

    const total =
      projects.length;

    const progressTotal =
      projects.reduce(
        (sum, project) =>
          sum +
          project.progress,
        0
      );

    return {
      ownerId,

      total,

      planning:
        projects.filter(
          (project) =>
            project.status ===
            "planning"
        ).length,

      active:
        projects.filter(
          (project) =>
            project.status ===
            "active"
        ).length,

      onHold:
        projects.filter(
          (project) =>
            project.status ===
            "on_hold"
        ).length,

      completed:
        projects.filter(
          (project) =>
            project.status ===
            "completed"
        ).length,

      cancelled:
        projects.filter(
          (project) =>
            project.status ===
            "cancelled"
        ).length,

      archived:
        projects.filter(
          (project) =>
            project.status ===
            "archived"
        ).length,

      averageProgress:
        total === 0
          ? 0
          : Number(
              (
                progressTotal /
                total
              ).toFixed(2)
            ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                  DELETE                                  */
  /* ------------------------------------------------------------------------ */

  delete(
    projectId: string
  ): void {
    this.require(
      projectId
    );

    this.projects.delete(
      projectId
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  ADMIN                                   */
  /* ------------------------------------------------------------------------ */

  clear(): void {
    this.projects.clear();
  }

  /* ------------------------------------------------------------------------ */
  /*                             PRIVATE HELPERS                              */
  /* ------------------------------------------------------------------------ */

  private validateCreateInput(
    input: CreateProjectInput
  ): void {
    const errors: string[] =
      [];

    if (
      !input.name ||
      !input.name.trim()
    ) {
      errors.push(
        "Project name is required."
      );
    }

    if (
      input.name &&
      input.name.length >
        MAX_PROJECT_NAME_LENGTH
    ) {
      errors.push(
        `Project name exceeds maximum length of ${MAX_PROJECT_NAME_LENGTH}.`
      );
    }

    if (
      !input.ownerId ||
      !input.ownerId.trim()
    ) {
      errors.push(
        "Project owner ID is required."
      );
    }

    if (
      input.description &&
      input.description.length >
        MAX_PROJECT_DESCRIPTION_LENGTH
    ) {
      errors.push(
        `Project description exceeds maximum length of ${MAX_PROJECT_DESCRIPTION_LENGTH}.`
      );
    }

    if (
      input.progress !== undefined &&
      (
        !Number.isFinite(
          input.progress
        ) ||
        input.progress < 0 ||
        input.progress > 100
      )
    ) {
      errors.push(
        "Project progress must be between 0 and 100."
      );
    }

    if (
      errors.length > 0
    ) {
      throw new ProjectValidationError(
        errors
      );
    }

    this.validateProjectDates(
      input.startDate,
      input.dueDate
    );
  }

  private validateUpdateInput(
    input: UpdateProjectInput
  ): void {
    const errors: string[] =
      [];

    if (
      input.name !== undefined &&
      !input.name.trim()
    ) {
      errors.push(
        "Project name cannot be empty."
      );
    }

    if (
      input.name !== undefined &&
      input.name.length >
        MAX_PROJECT_NAME_LENGTH
    ) {
      errors.push(
        `Project name exceeds maximum length of ${MAX_PROJECT_NAME_LENGTH}.`
      );
    }

    if (
      input.description !== undefined &&
      input.description.length >
        MAX_PROJECT_DESCRIPTION_LENGTH
    ) {
      errors.push(
        `Project description exceeds maximum length of ${MAX_PROJECT_DESCRIPTION_LENGTH}.`
      );
    }

    if (
      input.progress !== undefined &&
      (
        !Number.isFinite(
          input.progress
        ) ||
        input.progress < 0 ||
        input.progress > 100
      )
    ) {
      errors.push(
        "Project progress must be between 0 and 100."
      );
    }

    if (
      errors.length > 0
    ) {
      throw new ProjectValidationError(
        errors
      );
    }
  }

  private validateProjectDates(
    startDate?: Date,
    dueDate?: Date
  ): void {
    if (
      startDate &&
      dueDate &&
      startDate >
        dueDate
    ) {
      throw new ProjectValidationError(
        [
          "Project start date must be before the due date.",
        ]
      );
    }
  }

  private normalizeProgress(
    progress: number
  ): number {
    if (
      !Number.isFinite(
        progress
      )
    ) {
      throw new ProjectValidationError(
        [
          "Project progress must be a finite number.",
        ]
      );
    }

    return Math.max(
      0,
      Math.min(
        100,
        progress
      )
    );
  }

  private normalizeOptionalText(
    value?: string
  ): string | undefined {
    if (
      value === undefined
    ) {
      return undefined;
    }

    const trimmed =
      value.trim();

    return trimmed || undefined;
  }

  private resolveCompletedAt(
    existing: Project,
    nextStatus: ProjectStatus,
    now: Date
  ): Date | undefined {
    if (
      nextStatus ===
      "completed"
    ) {
      return (
        existing.completedAt ??
        now
      );
    }

    if (
      existing.status ===
      "completed"
    ) {
      return undefined;
    }

    return existing.completedAt;
  }

  private resolveArchivedAt(
    existing: Project,
    nextStatus: ProjectStatus,
    now: Date
  ): Date | undefined {
    if (
      nextStatus ===
      "archived"
    ) {
      return (
        existing.archivedAt ??
        now
      );
    }

    if (
      existing.status ===
      "archived"
    ) {
      return undefined;
    }

    return existing.archivedAt;
  }

  private normalizeLimit(
    limit?: number
  ): number {
    if (
      limit === undefined ||
      !Number.isFinite(
        limit
      )
    ) {
      return DEFAULT_PROJECT_LIMIT;
    }

    return Math.max(
      1,
      Math.min(
        Math.floor(
          limit
        ),
        MAX_PROJECT_LIMIT
      )
    );
  }

  private normalizeOffset(
    offset?: number
  ): number {
    if (
      offset === undefined ||
      !Number.isFinite(
        offset
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(
        offset
      )
    );
  }

  private cloneProject(
    project: Project
  ): Project {
    return {
      ...project,

      startDate:
        project.startDate
          ? new Date(
              project.startDate
            )
          : undefined,

      dueDate:
        project.dueDate
          ? new Date(
              project.dueDate
            )
          : undefined,

      completedAt:
        project.completedAt
          ? new Date(
              project.completedAt
            )
          : undefined,

      archivedAt:
        project.archivedAt
          ? new Date(
              project.archivedAt
            )
          : undefined,

      createdAt:
        new Date(
          project.createdAt
        ),

      updatedAt:
        new Date(
          project.updatedAt
        ),

      members:
        project.members.map(
          (member) =>
            this.cloneMember(
              member
            )
        ),

      metadata:
        this.cloneMetadata(
          project.metadata
        ),
    };
  }

  private cloneMember(
    member: ProjectMember
  ): ProjectMember {
    return {
      ...member,

      joinedAt:
        new Date(
          member.joinedAt
        ),

      metadata:
        this.cloneMetadata(
          member.metadata
        ),
    };
  }

  private cloneMetadata(
    metadata?: Record<
      string,
      unknown
    >
  ): Record<
    string,
    unknown
  > | undefined {
    if (!metadata) {
      return undefined;
    }

    return {
      ...metadata,
    };
  }

  private generateId(
    prefix: string
  ): string {
    const timestamp =
      Date.now()
        .toString(36);

    const random =
      Math.random()
        .toString(36)
        .slice(2, 14);

    return `${prefix}_${timestamp}_${random}`;
  }
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const projectsService =
  new ProjectsService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function createProject(
  input: CreateProjectInput
): Project {
  return projectsService.create(
    input
  );
}

export function getProject(
  projectId: string
): Project | undefined {
  return projectsService.get(
    projectId
  );
}

export function requireProject(
  projectId: string
): Project {
  return projectsService.require(
    projectId
  );
}

export function listProjects(
  options: ProjectListOptions = {}
): ProjectListResult {
  return projectsService.list(
    options
  );
}

export function getProjectsForUser(
  userId: string,
  options: Omit<
    ProjectListOptions,
    "memberId"
  > = {}
): ProjectListResult {
  return projectsService.getProjectsForUser(
    userId,
    options
  );
}

export function getProjectsForOwner(
  ownerId: string,
  options: Omit<
    ProjectListOptions,
    "ownerId"
  > = {}
): ProjectListResult {
  return projectsService.getProjectsForOwner(
    ownerId,
    options
  );
}

export function updateProject(
  projectId: string,
  input: UpdateProjectInput
): Project {
  return projectsService.update(
    projectId,
    input
  );
}

export function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Project {
  return projectsService.updateStatus(
    projectId,
    status
  );
}

export function updateProjectProgress(
  projectId: string,
  progress: number
): Project {
  return projectsService.updateProgress(
    projectId,
    progress
  );
}

export function completeProject(
  projectId: string
): Project {
  return projectsService.complete(
    projectId
  );
}

export function archiveProject(
  projectId: string
): Project {
  return projectsService.archive(
    projectId
  );
}

export function restoreProject(
  projectId: string
): Project {
  return projectsService.restore(
    projectId
  );
}

export function activateProject(
  projectId: string
): Project {
  return projectsService.activate(
    projectId
  );
}

export function cancelProject(
  projectId: string
): Project {
  return projectsService.cancel(
    projectId
  );
}

export function putProjectOnHold(
  projectId: string
): Project {
  return projectsService.putOnHold(
    projectId
  );
}

export function addProjectMember(
  projectId: string,
  input: AddProjectMemberInput
): Project {
  return projectsService.addMember(
    projectId,
    input
  );
}

export function updateProjectMember(
  projectId: string,
  userId: string,
  input: UpdateProjectMemberInput
): Project {
  return projectsService.updateMember(
    projectId,
    userId,
    input
  );
}

export function removeProjectMember(
  projectId: string,
  userId: string
): Project {
  return projectsService.removeMember(
    projectId,
    userId
  );
}

export function transferProjectOwnership(
  projectId: string,
  newOwnerId: string
): Project {
  return projectsService.transferOwnership(
    projectId,
    newOwnerId
  );
}

export function getProjectMembers(
  projectId: string
): ProjectMember[] {
  return projectsService.getMembers(
    projectId
  );
}

export function isProjectMember(
  projectId: string,
  userId: string
): boolean {
  return projectsService.isMember(
    projectId,
    userId
  );
}

export function canAccessProject(
  projectId: string,
  userId: string
): boolean {
  return projectsService.canAccess(
    projectId,
    userId
  );
}

export function canManageProject(
  projectId: string,
  userId: string
): boolean {
  return projectsService.canManage(
    projectId,
    userId
  );
}

export function canEditProject(
  projectId: string,
  userId: string
): boolean {
  return projectsService.canEdit(
    projectId,
    userId
  );
}

export function getProjectStats(
  ownerId?: string
): ProjectStats {
  return projectsService.getStats(
    ownerId
  );
}

export function deleteProject(
  projectId: string
): void {
  projectsService.delete(
    projectId
  );
}

export default projectsService;