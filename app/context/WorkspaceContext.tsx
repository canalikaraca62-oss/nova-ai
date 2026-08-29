"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceStatus =
  | "active"
  | "archived"
  | "paused"
  | "deleted";

export type WorkspaceVisibility = "private" | "team" | "public";

export interface WorkspaceMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt: string;
}

export interface WorkspaceSettings {
  visibility: WorkspaceVisibility;
  allowInvites: boolean;
  allowGuests: boolean;
  notificationsEnabled: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  status: WorkspaceStatus;
  ownerId?: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  visibility?: WorkspaceVisibility;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  status?: WorkspaceStatus;
  settings?: Partial<WorkspaceSettings>;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;

  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  error: string | null;

  setActiveWorkspaceId: (workspaceId: string | null) => void;

  getWorkspaceById: (
    workspaceId: string
  ) => Workspace | undefined;

  createWorkspace: (
    input: CreateWorkspaceInput
  ) => Promise<Workspace>;

  updateWorkspace: (
    workspaceId: string,
    input: UpdateWorkspaceInput
  ) => Promise<Workspace | null>;

  deleteWorkspace: (
    workspaceId: string
  ) => Promise<boolean>;

  archiveWorkspace: (
    workspaceId: string
  ) => Promise<Workspace | null>;

  restoreWorkspace: (
    workspaceId: string
  ) => Promise<Workspace | null>;

  addMember: (
    workspaceId: string,
    member: Omit<WorkspaceMember, "joinedAt">
  ) => Promise<Workspace | null>;

  removeMember: (
    workspaceId: string,
    memberId: string
  ) => Promise<Workspace | null>;

  clearError: () => void;

  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null
);

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createWorkspaceId(): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `workspace-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  visibility: "private",
  allowInvites: true,
  allowGuests: false,
  notificationsEnabled: true,
};

interface WorkspaceProviderProps {
  children: ReactNode;
  initialWorkspaces?: Workspace[];
}

export function WorkspaceProvider({
  children,
  initialWorkspaces = [],
}: WorkspaceProviderProps) {
  const [workspaces, setWorkspaces] =
    useState<Workspace[]>(initialWorkspaces);

  const [activeWorkspaceId, setActiveWorkspaceIdState] =
    useState<string | null>(() => {
      if (initialWorkspaces.length > 0) {
        return initialWorkspaces[0]?.id ?? null;
      }

      return null;
    });

  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) {
      return null;
    }

    return (
      workspaces.find(
        (workspace) => workspace.id === activeWorkspaceId
      ) ?? null
    );
  }, [activeWorkspaceId, workspaces]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setActiveWorkspaceId = useCallback(
    (workspaceId: string | null) => {
      if (workspaceId === null) {
        setActiveWorkspaceIdState(null);
        return;
      }

      const exists = workspaces.some(
        (workspace) => workspace.id === workspaceId
      );

      if (!exists) {
        setError("Selected workspace could not be found.");
        return;
      }

      setError(null);
      setActiveWorkspaceIdState(workspaceId);
    },
    [workspaces]
  );

  const getWorkspaceById = useCallback(
    (workspaceId: string) => {
      return workspaces.find(
        (workspace) => workspace.id === workspaceId
      );
    },
    [workspaces]
  );

  const refreshWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      /*
       * Backend/API integration point.
       *
       * Example:
       *
       * const response = await fetch("/api/workspaces", {
       *   method: "GET",
       *   cache: "no-store",
       * });
       *
       * if (!response.ok) {
       *   throw new Error("Failed to fetch workspaces.");
       * }
       *
       * const data = (await response.json()) as Workspace[];
       * setWorkspaces(data);
       */

      await Promise.resolve();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to refresh workspaces.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createWorkspace = useCallback(
    async (
      input: CreateWorkspaceInput
    ): Promise<Workspace> => {
      setIsCreating(true);
      setError(null);

      try {
        const now = new Date().toISOString();

        const normalizedName = input.name.trim();

        if (!normalizedName) {
          throw new Error(
            "Workspace name cannot be empty."
          );
        }

        const baseSlug =
          createSlug(normalizedName) || "workspace";

        let slug = baseSlug;
        let counter = 1;

        const existingSlugs = new Set(
          workspaces.map((workspace) => workspace.slug)
        );

        while (existingSlugs.has(slug)) {
          counter += 1;
          slug = `${baseSlug}-${counter}`;
        }

        const workspace: Workspace = {
          id: createWorkspaceId(),
          name: normalizedName,
          description: input.description?.trim() || "",
          slug,
          icon: input.icon ?? null,
          color: input.color ?? null,
          status: "active",
          members: [],
          settings: {
            ...DEFAULT_SETTINGS,
            visibility:
              input.visibility ??
              DEFAULT_SETTINGS.visibility,
          },
          createdAt: now,
          updatedAt: now,
        };

        setWorkspaces((current) => [
          workspace,
          ...current,
        ]);

        setActiveWorkspaceIdState(workspace.id);

        return workspace;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to create workspace.";

        setError(message);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [workspaces]
  );

  const updateWorkspace = useCallback(
    async (
      workspaceId: string,
      input: UpdateWorkspaceInput
    ): Promise<Workspace | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const existingWorkspace = workspaces.find(
          (workspace) => workspace.id === workspaceId
        );

        if (!existingWorkspace) {
          throw new Error(
            "Workspace could not be found."
          );
        }

        const updatedWorkspace: Workspace = {
          ...existingWorkspace,
          ...input,
          name:
            input.name !== undefined
              ? input.name.trim()
              : existingWorkspace.name,
          description:
            input.description !== undefined
              ? input.description.trim()
              : existingWorkspace.description,
          settings: {
            ...existingWorkspace.settings,
            ...(input.settings ?? {}),
          },
          updatedAt: new Date().toISOString(),
        };

        if (!updatedWorkspace.name.trim()) {
          throw new Error(
            "Workspace name cannot be empty."
          );
        }

        setWorkspaces((current) =>
          current.map((workspace) =>
            workspace.id === workspaceId
              ? updatedWorkspace
              : workspace
          )
        );

        return updatedWorkspace;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to update workspace.";

        setError(message);

        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaces]
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      setIsDeleting(true);
      setError(null);

      try {
        const exists = workspaces.some(
          (workspace) => workspace.id === workspaceId
        );

        if (!exists) {
          throw new Error(
            "Workspace could not be found."
          );
        }

        const remainingWorkspaces = workspaces.filter(
          (workspace) => workspace.id !== workspaceId
        );

        setWorkspaces(remainingWorkspaces);

        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceIdState(
            remainingWorkspaces[0]?.id ?? null
          );
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to delete workspace.";

        setError(message);

        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [activeWorkspaceId, workspaces]
  );

  const archiveWorkspace = useCallback(
    async (
      workspaceId: string
    ): Promise<Workspace | null> => {
      return updateWorkspace(workspaceId, {
        status: "archived",
      });
    },
    [updateWorkspace]
  );

  const restoreWorkspace = useCallback(
    async (
      workspaceId: string
    ): Promise<Workspace | null> => {
      return updateWorkspace(workspaceId, {
        status: "active",
      });
    },
    [updateWorkspace]
  );

  const addMember = useCallback(
    async (
      workspaceId: string,
      member: Omit<WorkspaceMember, "joinedAt">
    ): Promise<Workspace | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const workspace = workspaces.find(
          (item) => item.id === workspaceId
        );

        if (!workspace) {
          throw new Error(
            "Workspace could not be found."
          );
        }

        const alreadyExists = workspace.members.some(
          (existingMember) =>
            existingMember.id === member.id
        );

        if (alreadyExists) {
          throw new Error(
            "This member already belongs to the workspace."
          );
        }

        const newMember: WorkspaceMember = {
          ...member,
          joinedAt: new Date().toISOString(),
        };

        const updatedWorkspace: Workspace = {
          ...workspace,
          members: [
            ...workspace.members,
            newMember,
          ],
          updatedAt: new Date().toISOString(),
        };

        setWorkspaces((current) =>
          current.map((item) =>
            item.id === workspaceId
              ? updatedWorkspace
              : item
          )
        );

        return updatedWorkspace;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to add workspace member.";

        setError(message);

        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaces]
  );

  const removeMember = useCallback(
    async (
      workspaceId: string,
      memberId: string
    ): Promise<Workspace | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const workspace = workspaces.find(
          (item) => item.id === workspaceId
        );

        if (!workspace) {
          throw new Error(
            "Workspace could not be found."
          );
        }

        const memberExists = workspace.members.some(
          (member) => member.id === memberId
        );

        if (!memberExists) {
          throw new Error(
            "Workspace member could not be found."
          );
        }

        const updatedWorkspace: Workspace = {
          ...workspace,
          members: workspace.members.filter(
            (member) => member.id !== memberId
          ),
          updatedAt: new Date().toISOString(),
        };

        setWorkspaces((current) =>
          current.map((item) =>
            item.id === workspaceId
              ? updatedWorkspace
              : item
          )
        );

        return updatedWorkspace;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to remove workspace member.";

        setError(message);

        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [workspaces]
  );

  useEffect(() => {
    if (
      activeWorkspaceId &&
      !workspaces.some(
        (workspace) =>
          workspace.id === activeWorkspaceId
      )
    ) {
      setActiveWorkspaceIdState(
        workspaces[0]?.id ?? null
      );
    }
  }, [activeWorkspaceId, workspaces]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,

      isLoading,
      isCreating,
      isUpdating,
      isDeleting,

      error,

      setActiveWorkspaceId,

      getWorkspaceById,

      createWorkspace,
      updateWorkspace,
      deleteWorkspace,

      archiveWorkspace,
      restoreWorkspace,

      addMember,
      removeMember,

      clearError,

      refreshWorkspaces,
    }),
    [
      workspaces,
      activeWorkspace,
      activeWorkspaceId,

      isLoading,
      isCreating,
      isUpdating,
      isDeleting,

      error,

      setActiveWorkspaceId,
      getWorkspaceById,

      createWorkspace,
      updateWorkspace,
      deleteWorkspace,

      archiveWorkspace,
      restoreWorkspace,

      addMember,
      removeMember,

      clearError,

      refreshWorkspaces,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used within a WorkspaceProvider."
    );
  }

  return context;
}

export default WorkspaceContext;