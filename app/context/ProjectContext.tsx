"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

export type ProjectStatus =
  | "active"
  | "archived"
  | "completed"
  | "paused";

export type ProjectVisibility =
  | "private"
  | "team"
  | "public";

export type ProjectPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ProjectMemberRole =
  | "owner"
  | "admin"
  | "member"
  | "viewer";

export interface ProjectMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: ProjectMemberRole;
  joinedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;

  status: ProjectStatus;
  visibility: ProjectVisibility;
  priority: ProjectPriority;

  createdAt: string;
  updatedAt: string;

  archivedAt?: string | null;
  completedAt?: string | null;

  ownerId?: string;

  members: ProjectMember[];
  tags: string[];

  metadata?: Record<string, unknown>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  visibility?: ProjectVisibility;
  priority?: ProjectPriority;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  priority?: ProjectPriority;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProjectResult<T = undefined> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ProjectContextValue {
  projects: Project[];

  activeProjectId: string | null;

  activeProject: Project | null;

  isLoading: boolean;

  isInitialized: boolean;

  error: string | null;

  createProject: (
    input: CreateProjectInput
  ) => Promise<ProjectResult<Project>>;

  updateProject: (
    projectId: string,
    input: UpdateProjectInput
  ) => Promise<ProjectResult<Project>>;

  deleteProject: (
    projectId: string
  ) => Promise<ProjectResult>;

  archiveProject: (
    projectId: string
  ) => Promise<ProjectResult>;

  restoreProject: (
    projectId: string
  ) => Promise<ProjectResult>;

  completeProject: (
    projectId: string
  ) => Promise<ProjectResult>;

  pauseProject: (
    projectId: string
  ) => Promise<ProjectResult>;

  setActiveProject: (
    projectId: string | null
  ) => void;

  addMember: (
    projectId: string,
    member: ProjectMember
  ) => Promise<ProjectResult<Project>>;

  removeMember: (
    projectId: string,
    memberId: string
  ) => Promise<ProjectResult<Project>>;

  addTag: (
    projectId: string,
    tag: string
  ) => Promise<ProjectResult<Project>>;

  removeTag: (
    projectId: string,
    tag: string
  ) => Promise<ProjectResult<Project>>;

  getProject: (
    projectId: string
  ) => Project | null;

  refreshProjects: () => Promise<void>;

  clearError: () => void;
}

export interface ProjectProviderProps {
  children: React.ReactNode;
}

/* =========================================================
   CONTEXT
========================================================= */

const ProjectContext = createContext<
  ProjectContextValue | undefined
>(undefined);

/* =========================================================
   CONSTANTS
========================================================= */

const PROJECT_STORAGE_KEY = "nova-projects";

/* =========================================================
   HELPERS
========================================================= */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function readStorage<T>(
  key: string,
  fallback: T
): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const storedValue =
      window.localStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    return JSON.parse(storedValue) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(
  key: string,
  value: T
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    // Storage failure should never crash the application.
  }
}

function sortProjects(
  projects: Project[]
): Project[] {
  return [...projects].sort(
    (a, b) =>
      new Date(
        b.updatedAt
      ).getTime() -
      new Date(
        a.updatedAt
      ).getTime()
  );
}

function normalizeTags(
  tags: string[]
): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

/* =========================================================
   PROVIDER
========================================================= */

export function ProjectProvider({
  children,
}: ProjectProviderProps): React.ReactElement {
  const [projects, setProjects] =
    useState<Project[]>([]);

  const [
    activeProjectId,
    setActiveProjectId,
  ] = useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isInitialized, setIsInitialized] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  /* =======================================================
     ACTIVE PROJECT
  ======================================================= */

  const activeProject = useMemo(() => {
    if (!activeProjectId) {
      return null;
    }

    return (
      projects.find(
        (project) =>
          project.id === activeProjectId
      ) ?? null
    );
  }, [
    projects,
    activeProjectId,
  ]);

  /* =======================================================
     PERSIST PROJECTS
  ======================================================= */

  const persistProjects =
    useCallback(
      (
        nextProjects: Project[]
      ): void => {
        const sortedProjects =
          sortProjects(nextProjects);

        setProjects(sortedProjects);

        writeStorage(
          PROJECT_STORAGE_KEY,
          sortedProjects
        );
      },
      []
    );

  /* =======================================================
     CLEAR ERROR
  ======================================================= */

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /* =======================================================
     REFRESH PROJECTS
  ======================================================= */

  const refreshProjects =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Future production API integration:
         *
         * const response = await fetch(
         *   "/api/projects",
         *   {
         *     credentials: "include",
         *   }
         * );
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to load projects"
         *   );
         * }
         *
         * const data =
         *   (await response.json()) as Project[];
         *
         * persistProjects(data);
         */

        const storedProjects =
          readStorage<Project[]>(
            PROJECT_STORAGE_KEY,
            []
          );

        setProjects(
          sortProjects(storedProjects)
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load projects";

        setError(message);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  /* =======================================================
     CREATE PROJECT
  ======================================================= */

  const createProject =
    useCallback(
      async (
        input: CreateProjectInput
      ): Promise<ProjectResult<Project>> => {
        setError(null);

        try {
          const name = input.name.trim();

          if (!name) {
            throw new Error(
              "Project name cannot be empty"
            );
          }

          const now =
            new Date().toISOString();

          const project: Project = {
            id: createId("project"),

            name,

            description:
              input.description?.trim() ||
              undefined,

            status: "active",

            visibility:
              input.visibility ?? "private",

            priority:
              input.priority ?? "medium",

            createdAt: now,

            updatedAt: now,

            archivedAt: null,

            completedAt: null,

            members: [],

            tags: normalizeTags(
              input.tags ?? []
            ),

            metadata:
              input.metadata,
          };

          const nextProjects = [
            project,
            ...projects,
          ];

          persistProjects(nextProjects);

          setActiveProjectId(
            project.id
          );

          return {
            success: true,
            data: project,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to create project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     GET PROJECT
  ======================================================= */

  const getProject =
    useCallback(
      (
        projectId: string
      ): Project | null => {
        return (
          projects.find(
            (project) =>
              project.id === projectId
          ) ?? null
        );
      },
      [projects]
    );

  /* =======================================================
     SET ACTIVE PROJECT
  ======================================================= */

  const setActiveProject =
    useCallback(
      (
        projectId: string | null
      ): void => {
        setActiveProjectId(projectId);
      },
      []
    );

  /* =======================================================
     UPDATE PROJECT
  ======================================================= */

  const updateProject =
    useCallback(
      async (
        projectId: string,
        input: UpdateProjectInput
      ): Promise<ProjectResult<Project>> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          if (
            input.name !== undefined &&
            !input.name.trim()
          ) {
            throw new Error(
              "Project name cannot be empty"
            );
          }

          const now =
            new Date().toISOString();

          const updatedProject: Project = {
            ...existingProject,

            name:
              input.name !== undefined
                ? input.name.trim()
                : existingProject.name,

            description:
              input.description !== undefined
                ? input.description.trim() ||
                  undefined
                : existingProject.description,

            status:
              input.status ??
              existingProject.status,

            visibility:
              input.visibility ??
              existingProject.visibility,

            priority:
              input.priority ??
              existingProject.priority,

            tags:
              input.tags !== undefined
                ? normalizeTags(input.tags)
                : existingProject.tags,

            metadata:
              input.metadata ??
              existingProject.metadata,

            updatedAt: now,
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
            data: updatedProject,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to update project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     DELETE PROJECT
  ======================================================= */

  const deleteProject =
    useCallback(
      async (
        projectId: string
      ): Promise<ProjectResult> => {
        setError(null);

        try {
          const exists =
            projects.some(
              (project) =>
                project.id === projectId
            );

          if (!exists) {
            throw new Error(
              "Project not found"
            );
          }

          const nextProjects =
            projects.filter(
              (project) =>
                project.id !== projectId
            );

          persistProjects(nextProjects);

          if (
            activeProjectId === projectId
          ) {
            setActiveProjectId(null);
          }

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to delete project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
        activeProjectId,
      ]
    );

  /* =======================================================
     ARCHIVE PROJECT
  ======================================================= */

  const archiveProject =
    useCallback(
      async (
        projectId: string
      ): Promise<ProjectResult> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const now =
            new Date().toISOString();

          const updatedProject: Project = {
            ...existingProject,

            status: "archived",

            archivedAt: now,

            updatedAt: now,
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to archive project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     RESTORE PROJECT
  ======================================================= */

  const restoreProject =
    useCallback(
      async (
        projectId: string
      ): Promise<ProjectResult> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const now =
            new Date().toISOString();

          const updatedProject: Project = {
            ...existingProject,

            status: "active",

            archivedAt: null,

            updatedAt: now,
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to restore project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     COMPLETE PROJECT
  ======================================================= */

  const completeProject =
    useCallback(
      async (
        projectId: string
      ): Promise<ProjectResult> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const now =
            new Date().toISOString();

          const updatedProject: Project = {
            ...existingProject,

            status: "completed",

            completedAt: now,

            updatedAt: now,
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to complete project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     PAUSE PROJECT
  ======================================================= */

  const pauseProject =
    useCallback(
      async (
        projectId: string
      ): Promise<ProjectResult> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const now =
            new Date().toISOString();

          const updatedProject: Project = {
            ...existingProject,

            status: "paused",

            updatedAt: now,
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to pause project";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     ADD MEMBER
  ======================================================= */

  const addMember =
    useCallback(
      async (
        projectId: string,
        member: ProjectMember
      ): Promise<ProjectResult<Project>> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const memberExists =
            existingProject.members.some(
              (item) =>
                item.id === member.id
            );

          if (memberExists) {
            throw new Error(
              "Member already exists"
            );
          }

          const updatedProject: Project = {
            ...existingProject,

            members: [
              ...existingProject.members,
              member,
            ],

            updatedAt:
              new Date().toISOString(),
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
            data: updatedProject,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to add project member";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     REMOVE MEMBER
  ======================================================= */

  const removeMember =
    useCallback(
      async (
        projectId: string,
        memberId: string
      ): Promise<ProjectResult<Project>> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const updatedProject: Project = {
            ...existingProject,

            members:
              existingProject.members.filter(
                (member) =>
                  member.id !== memberId
              ),

            updatedAt:
              new Date().toISOString(),
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
            data: updatedProject,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to remove project member";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     ADD TAG
  ======================================================= */

  const addTag =
    useCallback(
      async (
        projectId: string,
        tag: string
      ): Promise<ProjectResult<Project>> => {
        setError(null);

        try {
          const normalizedTag =
            tag.trim();

          if (!normalizedTag) {
            throw new Error(
              "Tag cannot be empty"
            );
          }

          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          if (
            existingProject.tags.includes(
              normalizedTag
            )
          ) {
            return {
              success: true,
              data: existingProject,
            };
          }

          const updatedProject: Project = {
            ...existingProject,

            tags: [
              ...existingProject.tags,
              normalizedTag,
            ],

            updatedAt:
              new Date().toISOString(),
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
            data: updatedProject,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to add tag";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     REMOVE TAG
  ======================================================= */

  const removeTag =
    useCallback(
      async (
        projectId: string,
        tag: string
      ): Promise<ProjectResult<Project>> => {
        setError(null);

        try {
          const existingProject =
            projects.find(
              (project) =>
                project.id === projectId
            );

          if (!existingProject) {
            throw new Error(
              "Project not found"
            );
          }

          const updatedProject: Project = {
            ...existingProject,

            tags:
              existingProject.tags.filter(
                (item) =>
                  item !== tag
              ),

            updatedAt:
              new Date().toISOString(),
          };

          const nextProjects =
            projects.map(
              (project) =>
                project.id === projectId
                  ? updatedProject
                  : project
            );

          persistProjects(nextProjects);

          return {
            success: true,
            data: updatedProject,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to remove tag";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        projects,
        persistProjects,
      ]
    );

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const value =
    useMemo<ProjectContextValue>(
      () => ({
        projects,

        activeProjectId,

        activeProject,

        isLoading,

        isInitialized,

        error,

        createProject,

        updateProject,

        deleteProject,

        archiveProject,

        restoreProject,

        completeProject,

        pauseProject,

        setActiveProject,

        addMember,

        removeMember,

        addTag,

        removeTag,

        getProject,

        refreshProjects,

        clearError,
      }),
      [
        projects,
        activeProjectId,
        activeProject,
        isLoading,
        isInitialized,
        error,
        createProject,
        updateProject,
        deleteProject,
        archiveProject,
        restoreProject,
        completeProject,
        pauseProject,
        setActiveProject,
        addMember,
        removeMember,
        addTag,
        removeTag,
        getProject,
        refreshProjects,
        clearError,
      ]
    );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

/* =========================================================
   HOOKS
========================================================= */

export function useProjectContext():
  ProjectContextValue {
  const context =
    useContext(ProjectContext);

  if (!context) {
    throw new Error(
      "useProjectContext must be used within a ProjectProvider"
    );
  }

  return context;
}

export function useProjects():
  ProjectContextValue {
  return useProjectContext();
}