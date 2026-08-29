"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ProjectStatus =
  | "active"
  | "archived"
  | "draft"
  | "completed";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
}

export interface ProjectFilters {
  query?: string;
  status?: ProjectStatus;
}

export interface ProjectResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UseProjectOptions {
  initialProjects?: Project[];
  autoLoad?: boolean;
}

export interface UseProjectReturn {
  projects: Project[];
  filteredProjects: Project[];

  selectedProject: Project | null;

  filters: ProjectFilters;

  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  error: string | null;

  load: () => Promise<void>;

  create: (
    input: CreateProjectInput
  ) => Promise<ProjectResult<Project>>;

  update: (
    id: string,
    input: UpdateProjectInput
  ) => Promise<ProjectResult<Project>>;

  remove: (
    id: string
  ) => Promise<ProjectResult<string>>;

  duplicate: (
    id: string
  ) => Promise<ProjectResult<Project>>;

  archive: (
    id: string
  ) => Promise<ProjectResult<Project>>;

  restore: (
    id: string
  ) => Promise<ProjectResult<Project>>;

  select: (
    project: Project | null
  ) => void;

  selectById: (
    id: string
  ) => void;

  clearSelection: () => void;

  setFilters: (
    filters: ProjectFilters
  ) => void;

  updateFilters: (
    filters: Partial<ProjectFilters>
  ) => void;

  clearFilters: () => void;

  refresh: () => Promise<void>;

  clearError: () => void;
}

const API_ENDPOINT = "/api/projects";

function normalizeText(
  value: string
): string {
  return value.trim().toLowerCase();
}

function matchesProject(
  project: Project,
  filters: ProjectFilters
): boolean {
  if (filters.query?.trim()) {
    const query = normalizeText(
      filters.query
    );

    const searchableText = [
      project.name,
      project.description ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(query)) {
      return false;
    }
  }

  if (
    filters.status &&
    project.status !== filters.status
  ) {
    return false;
  }

  return true;
}

async function parseResponse<T>(
  response: Response
): Promise<ProjectResult<T>> {
  let payload: unknown = null;

  try {
    const contentType =
      response.headers.get(
        "content-type"
      ) ?? "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      payload = await response.json();
    }
  } catch {
    payload = null;
  }

  if (!response.ok) {
    let error =
      `Request failed with status ${response.status}`;

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload
    ) {
      const payloadError =
        payload.error;

      if (
        typeof payloadError ===
        "string"
      ) {
        error = payloadError;
      }
    }

    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data: payload as T,
  };
}

export function useProject(
  options: UseProjectOptions = {}
): UseProjectReturn {
  const {
    initialProjects = [],
    autoLoad = true,
  } = options;

  const [projects, setProjects] =
    useState<Project[]>(
      initialProjects
    );

  const [
    selectedProject,
    setSelectedProject,
  ] = useState<Project | null>(
    null
  );

  const [filters, setFiltersState] =
    useState<ProjectFilters>({});

  const [isLoading, setIsLoading] =
    useState(false);

  const [isCreating, setIsCreating] =
    useState(false);

  const [isUpdating, setIsUpdating] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );

  const projectsRef =
    useRef<Project[]>(initialProjects);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          matchesProject(
            project,
            filters
          )
      ),
    [projects, filters]
  );

  const load = useCallback(
    async () => {
      abortControllerRef.current?.abort();

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          API_ENDPOINT,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            signal: controller.signal,
          }
        );

        const result =
          await parseResponse<Project[]>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Projects could not be loaded."
          );

          return;
        }

        const data =
          Array.isArray(result.data)
            ? result.data
            : [];

        setProjects(data);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);
      } finally {
        if (
          abortControllerRef.current ===
          controller
        ) {
          abortControllerRef.current =
            null;
        }

        setIsLoading(false);
      }
    },
    []
  );

  const create = useCallback(
    async (
      input: CreateProjectInput
    ): Promise<ProjectResult<Project>> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch(
          API_ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify(
              input
            ),
          }
        );

        const result =
          await parseResponse<Project>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Project could not be created."
          );

          return result;
        }

        if (result.data) {
          setProjects(
            (currentProjects) => [
              result.data as Project,
              ...currentProjects,
            ]
          );
        }

        return result;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const update = useCallback(
    async (
      id: string,
      input: UpdateProjectInput
    ): Promise<ProjectResult<Project>> => {
      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_ENDPOINT}/${encodeURIComponent(
            id
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify(
              input
            ),
          }
        );

        const result =
          await parseResponse<Project>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Project could not be updated."
          );

          return result;
        }

        if (result.data) {
          const updatedProject =
            result.data;

          setProjects(
            (currentProjects) =>
              currentProjects.map(
                (project) =>
                  project.id === id
                    ? updatedProject
                    : project
              )
          );

          setSelectedProject(
            (currentProject) =>
              currentProject?.id === id
                ? updatedProject
                : currentProject
          );
        }

        return result;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const remove = useCallback(
    async (
      id: string
    ): Promise<ProjectResult<string>> => {
      setIsDeleting(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_ENDPOINT}/${encodeURIComponent(
            id
          )}`,
          {
            method: "DELETE",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

        const result =
          await parseResponse<unknown>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Project could not be deleted."
          );

          return {
            success: false,
            error: result.error,
          };
        }

        setProjects(
          (currentProjects) =>
            currentProjects.filter(
              (project) =>
                project.id !== id
            )
        );

        setSelectedProject(
          (currentProject) =>
            currentProject?.id === id
              ? null
              : currentProject
        );

        return {
          success: true,
          data: id,
        };
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setIsDeleting(false);
      }
    },
    []
  );

  const duplicate = useCallback(
    async (
      id: string
    ): Promise<ProjectResult<Project>> => {
      const project =
        projectsRef.current.find(
          (item) => item.id === id
        );

      if (!project) {
        return {
          success: false,
          error: "Project not found.",
        };
      }

      return create({
        name: `${project.name} Copy`,
        description:
          project.description,
        status: "draft",
        metadata:
          project.metadata,
      });
    },
    [create]
  );

  const archive = useCallback(
    async (
      id: string
    ): Promise<ProjectResult<Project>> => {
      return update(id, {
        status: "archived",
      });
    },
    [update]
  );

  const restore = useCallback(
    async (
      id: string
    ): Promise<ProjectResult<Project>> => {
      return update(id, {
        status: "active",
      });
    },
    [update]
  );

  const select = useCallback(
    (project: Project | null) => {
      setSelectedProject(project);
    },
    []
  );

  const selectById = useCallback(
    (id: string) => {
      const project =
        projectsRef.current.find(
          (item) => item.id === id
        ) ?? null;

      setSelectedProject(project);
    },
    []
  );

  const clearSelection =
    useCallback(() => {
      setSelectedProject(null);
    }, []);

  const setFilters = useCallback(
    (
      nextFilters: ProjectFilters
    ) => {
      setFiltersState(nextFilters);
    },
    []
  );

  const updateFilters =
    useCallback(
      (
        nextFilters: Partial<ProjectFilters>
      ) => {
        setFiltersState(
          (currentFilters) => ({
            ...currentFilters,
            ...nextFilters,
          })
        );
      },
      []
    );

  const clearFilters =
    useCallback(() => {
      setFiltersState({});
    }, []);

  const refresh = useCallback(
    async () => {
      await load();
    },
    [load]
  );

  const clearError =
    useCallback(() => {
      setError(null);
    },
    []
  );

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    void load();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [autoLoad, load]);

  return {
    projects,
    filteredProjects,

    selectedProject,

    filters,

    isLoading,
    isCreating,
    isUpdating,
    isDeleting,

    error,

    load,
    create,
    update,
    remove,

    duplicate,
    archive,
    restore,

    select,
    selectById,
    clearSelection,

    setFilters,
    updateFilters,
    clearFilters,

    refresh,
    clearError,
  };
}

export default useProject;