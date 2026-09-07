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

/*
 * createSlug and createWorkspaceId were removed with the local-only
 * creation path: the server now derives the slug and the database
 * generates the id, so a client-side version of either could only
 * disagree with what is stored.
 */


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
       * Loads the caller's workspaces. What the comment here previously
       * described as an integration point, now wired.
       *
       * Visibility is decided by RLS on public.workspaces
       * (is_organization_member), so this sends no filter and no
       * identity: the session cookie is the whole authorization.
       */
      const response = await fetch("/api/workspaces", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        /*
         * Not signed in. An empty list is the correct view; treating it
         * as an error would show a failure banner on a page the user is
         * simply not authenticated for.
         */
        setWorkspaces([]);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch workspaces.");
      }

      const payload = (await response.json()) as {
        success?: boolean;
        workspaces?: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };

      const rows = payload.workspaces ?? [];

      /* Mapped onto the existing shape so no consumer changes. */
      setWorkspaces(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? "",
          slug: row.slug,
          icon: null,
          color: null,
          status: "active" as WorkspaceStatus,
          members: [],
          settings: { ...DEFAULT_SETTINGS },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      );
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
        const normalizedName = input.name.trim();

        if (!normalizedName) {
          throw new Error(
            "Workspace name cannot be empty."
          );
        }

        /*
         * Slug derivation moved server-side. A client-chosen slug would
         * let one tenant squat another's URLs, and the local
         * collision loop could only see workspaces already loaded in
         * this browser.
         */

        /*
         * PERSISTED, not local state.
         *
         * This previously built a Workspace object and pushed it into
         * React state, so a created workspace vanished on reload — the
         * dashboard's "Create your first workspace" led nowhere twice
         * over: no control, and no persistence behind it.
         *
         * The server owns identity and tenancy. `organization_id` and
         * `created_by` are resolved from the verified session inside the
         * route and are deliberately NOT sent from here; sending them
         * would make ownership caller-controlled.
         */
        const response = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: normalizedName,
            description: input.description?.trim() || undefined,
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          workspace?: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            created_at: string;
            updated_at: string;
          };
          error?: string;
        } | null;

        if (!response.ok || !payload?.success || !payload.workspace) {
          throw new Error(
            payload?.error ?? "Failed to create workspace.",
          );
        }

        const created = payload.workspace;

        /*
         * Mapped onto the existing Workspace shape so no consumer
         * changes. `icon`, `color` and `settings` are not columns on
         * public.workspaces; they keep their previous client-side
         * defaults rather than being invented server-side.
         */
        const workspace: Workspace = {
          id: created.id,
          name: created.name,
          description: created.description ?? "",
          slug: created.slug,
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
          createdAt: created.created_at,
          updatedAt: created.updated_at,
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
    []
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

  /*
   * Load persisted workspaces once on mount.
   *
   * Without this the provider starts from `initialWorkspaces` and never
   * consults the server, so a workspace created in a previous session
   * would not appear — the dashboard would show "No workspaces yet" to a
   * user who already has one.
   *
   * The fetch is started from a microtask rather than from the effect
   * body. refreshWorkspaces sets loading state on its first line, so
   * calling it synchronously here would update state during the effect
   * and cascade an extra render (react-hooks/set-state-in-effect).
   * Deferring moves that first setState into a callback, which is the
   * shape an effect is meant to have.
   *
   * cancelled guards unmount: a provider torn down while the request
   * is in flight must not set state afterwards.
   */
  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return refreshWorkspaces();
    });

    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaces]);

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