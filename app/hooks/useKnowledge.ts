"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type KnowledgeStatus =
  | "draft"
  | "processing"
  | "ready"
  | "archived"
  | "error";

export type KnowledgeSourceType =
  | "document"
  | "url"
  | "text"
  | "file"
  | "note";

export interface KnowledgeItem {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  sourceType: KnowledgeSourceType;
  sourceUrl?: string;
  tags?: string[];
  status: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeInput {
  title: string;
  content?: string;
  summary?: string;
  sourceType?: KnowledgeSourceType;
  sourceUrl?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  summary?: string;
  sourceType?: KnowledgeSourceType;
  sourceUrl?: string;
  tags?: string[];
  status?: KnowledgeStatus;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeFilters {
  query?: string;
  status?: KnowledgeStatus;
  sourceType?: KnowledgeSourceType;
  tags?: string[];
}

export interface KnowledgeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UseKnowledgeOptions {
  initialItems?: KnowledgeItem[];
  autoLoad?: boolean;
}

export interface UseKnowledgeReturn {
  items: KnowledgeItem[];
  filteredItems: KnowledgeItem[];

  selectedItem: KnowledgeItem | null;

  filters: KnowledgeFilters;

  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  error: string | null;

  load: () => Promise<void>;

  create: (
    input: CreateKnowledgeInput
  ) => Promise<KnowledgeResult<KnowledgeItem>>;

  update: (
    id: string,
    input: UpdateKnowledgeInput
  ) => Promise<KnowledgeResult<KnowledgeItem>>;

  remove: (
    id: string
  ) => Promise<KnowledgeResult<string>>;

  select: (
    item: KnowledgeItem | null
  ) => void;

  selectById: (
    id: string
  ) => void;

  clearSelection: () => void;

  setFilters: (
    filters: KnowledgeFilters
  ) => void;

  updateFilters: (
    filters: Partial<KnowledgeFilters>
  ) => void;

  clearFilters: () => void;

  refresh: () => Promise<void>;

  clearError: () => void;
}

const API_ENDPOINT = "/api/knowledge";

function normalizeText(
  value: string
): string {
  return value
    .trim()
    .toLocaleLowerCase();
}

function matchesQuery(
  item: KnowledgeItem,
  query: string
): boolean {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery =
    normalizeText(query);

  const searchableValues = [
    item.title,
    item.content ?? "",
    item.summary ?? "",
    item.sourceUrl ?? "",
    ...(item.tags ?? []),
  ];

  return searchableValues.some(
    (value) =>
      normalizeText(value).includes(
        normalizedQuery
      )
  );
}

function matchesTags(
  item: KnowledgeItem,
  tags: string[]
): boolean {
  if (tags.length === 0) {
    return true;
  }

  const itemTags = (
    item.tags ?? []
  ).map(normalizeText);

  return tags.every((tag) =>
    itemTags.includes(
      normalizeText(tag)
    )
  );
}

function filterKnowledgeItems(
  items: KnowledgeItem[],
  filters: KnowledgeFilters
): KnowledgeItem[] {
  return items.filter((item) => {
    if (
      filters.query &&
      !matchesQuery(
        item,
        filters.query
      )
    ) {
      return false;
    }

    if (
      filters.status &&
      item.status !==
        filters.status
    ) {
      return false;
    }

    if (
      filters.sourceType &&
      item.sourceType !==
        filters.sourceType
    ) {
      return false;
    }

    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !matchesTags(
        item,
        filters.tags
      )
    ) {
      return false;
    }

    return true;
  });
}

async function parseResponse<T>(
  response: Response
): Promise<KnowledgeResult<T>> {
  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  const isJson =
    contentType.includes(
      "application/json"
    );

  let payload: unknown = null;

  if (isJson) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;

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

export function useKnowledge(
  options: UseKnowledgeOptions = {}
): UseKnowledgeReturn {
  const {
    initialItems = [],
    autoLoad = true,
  } = options;

  const [items, setItems] =
    useState<KnowledgeItem[]>(
      initialItems
    );

  const [selectedItem, setSelectedItem] =
    useState<KnowledgeItem | null>(
      null
    );

  const [filters, setFiltersState] =
    useState<KnowledgeFilters>({});

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

  const filteredItems = useMemo(
    () =>
      filterKnowledgeItems(
        items,
        filters
      ),
    [items, filters]
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
          await parseResponse<
            KnowledgeItem[]
          >(response);

        if (!result.success) {
          setError(
            result.error ??
              "Knowledge items could not be loaded."
          );

          return;
        }

        setItems(
          Array.isArray(result.data)
            ? result.data
            : []
        );
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred."
        );
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
      input: CreateKnowledgeInput
    ): Promise<
      KnowledgeResult<KnowledgeItem>
    > => {
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
          await parseResponse<
            KnowledgeItem
          >(response);

        if (!result.success) {
          setError(
            result.error ??
              "Knowledge item could not be created."
          );

          return result;
        }

        if (result.data) {
          setItems(
            (currentItems) => [
              result.data!,
              ...currentItems,
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
      input: UpdateKnowledgeInput
    ): Promise<
      KnowledgeResult<KnowledgeItem>
    > => {
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
          await parseResponse<
            KnowledgeItem
          >(response);

        if (!result.success) {
          setError(
            result.error ??
              "Knowledge item could not be updated."
          );

          return result;
        }

        if (result.data) {
          setItems(
            (currentItems) =>
              currentItems.map(
                (item) =>
                  item.id === id
                    ? result.data!
                    : item
              )
          );

          setSelectedItem(
            (currentItem) =>
              currentItem?.id === id
                ? result.data!
                : currentItem
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
    ): Promise<KnowledgeResult<string>> => {
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
          await parseResponse<
            { id?: string } | null
          >(response);

        if (!result.success) {
          setError(
            result.error ??
              "Knowledge item could not be deleted."
          );

          return {
            success: false,
            error: result.error,
          };
        }

        setItems(
          (currentItems) =>
            currentItems.filter(
              (item) =>
                item.id !== id
            )
        );

        setSelectedItem(
          (currentItem) =>
            currentItem?.id === id
              ? null
              : currentItem
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

  const select = useCallback(
    (
      item: KnowledgeItem | null
    ) => {
      setSelectedItem(item);
    },
    []
  );

  const selectById = useCallback(
    (id: string) => {
      setSelectedItem(
        items.find(
          (item) => item.id === id
        ) ?? null
      );
    },
    [items]
  );

  const clearSelection =
    useCallback(() => {
      setSelectedItem(null);
    }, []);

  const setFilters = useCallback(
    (
      nextFilters: KnowledgeFilters
    ) => {
      setFiltersState(nextFilters);
    },
    []
  );

  const updateFilters =
    useCallback(
      (
        nextFilters: Partial<KnowledgeFilters>
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
    }, []);

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
    items,
    filteredItems,

    selectedItem,

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

export default useKnowledge;