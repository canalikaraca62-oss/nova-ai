"use client";

import {
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type KnowledgeSearchStatus =
  | "all"
  | "ready"
  | "processing"
  | "queued"
  | "error"
  | "draft";

export type KnowledgeSearchSort =
  | "relevance"
  | "newest"
  | "oldest"
  | "name";

export type KnowledgeSearchValue = {
  query: string;
  status: KnowledgeSearchStatus;
  sort: KnowledgeSearchSort;
};

export type KnowledgeSearchProps = {
  value?: Partial<KnowledgeSearchValue>;
  defaultValue?: Partial<KnowledgeSearchValue>;

  placeholder?: string;

  debounceMs?: number;

  loading?: boolean;
  disabled?: boolean;

  showFilters?: boolean;
  showSort?: boolean;

  className?: string;

  onChange?: (
    value: KnowledgeSearchValue
  ) => void;

  onSearch?: (
    value: KnowledgeSearchValue
  ) => void;
};

const DEFAULT_VALUE: KnowledgeSearchValue = {
  query: "",
  status: "all",
  sort: "relevance",
};

const STATUS_OPTIONS: Array<{
  value: KnowledgeSearchStatus;
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "ready",
    label: "Ready",
  },
  {
    value: "processing",
    label: "Processing",
  },
  {
    value: "queued",
    label: "Queued",
  },
  {
    value: "error",
    label: "Error",
  },
  {
    value: "draft",
    label: "Draft",
  },
];

const SORT_OPTIONS: Array<{
  value: KnowledgeSearchSort;
  label: string;
}> = [
  {
    value: "relevance",
    label: "Relevance",
  },
  {
    value: "newest",
    label: "Newest",
  },
  {
    value: "oldest",
    label: "Oldest",
  },
  {
    value: "name",
    label: "Name",
  },
];

function normalizeValue(
  value?: Partial<KnowledgeSearchValue>
): KnowledgeSearchValue {
  return {
    query:
      value?.query ??
      DEFAULT_VALUE.query,

    status:
      value?.status ??
      DEFAULT_VALUE.status,

    sort:
      value?.sort ??
      DEFAULT_VALUE.sort,
  };
}

function areValuesEqual(
  first: KnowledgeSearchValue,
  second: KnowledgeSearchValue
) {
  return (
    first.query === second.query &&
    first.status === second.status &&
    first.sort === second.sort
  );
}

export default function KnowledgeSearch({
  value,
  defaultValue,
  placeholder = "Search knowledge...",
  debounceMs = 350,
  loading = false,
  disabled = false,
  showFilters = true,
  showSort = true,
  className = "",
  onChange,
  onSearch,
}: KnowledgeSearchProps) {
  const isControlled =
    value !== undefined;

  const normalizedControlledValue =
    useMemo(
      () =>
        normalizeValue(value),
      [value]
    );

  const [
    internalValue,
    setInternalValue,
  ] = useState<KnowledgeSearchValue>(
    () =>
      normalizeValue(
        defaultValue
      )
  );

  const currentValue =
    isControlled
      ? normalizedControlledValue
      : internalValue;

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  const isFirstSearch =
    useRef(true);

  const latestValueRef =
    useRef(currentValue);

  useEffect(() => {
    latestValueRef.current =
      currentValue;
  }, [currentValue]);

  useEffect(() => {
    if (
      !isControlled ||
      !value
    ) {
      return;
    }

    setInternalValue(
      normalizedControlledValue
    );
  }, [
    isControlled,
    normalizedControlledValue,
    value,
  ]);

  useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current =
        false;

      return;
    }

    const timeout =
      window.setTimeout(() => {
        onSearch?.(
          latestValueRef.current
        );
      }, Math.max(0, debounceMs));

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    currentValue,
    debounceMs,
    onSearch,
  ]);

  const updateValue = (
    patch: Partial<KnowledgeSearchValue>
  ) => {
    const nextValue: KnowledgeSearchValue =
      {
        ...currentValue,
        ...patch,
      };

    if (
      areValuesEqual(
        nextValue,
        currentValue
      )
    ) {
      return;
    }

    if (!isControlled) {
      setInternalValue(
        nextValue
      );
    }

    onChange?.(
      nextValue
    );
  };

  const clearSearch = () => {
    updateValue({
      query: "",
    });
  };

  const resetFilters = () => {
    updateValue({
      status: "all",
      sort: "relevance",
    });
  };

  const hasActiveFilters =
    currentValue.status !==
      "all" ||
    currentValue.sort !==
      "relevance";

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    onSearch?.(
      currentValue
    );
  };

  return (
    <div
      className={[
        "w-full",
        className,
      ].join(" ")}
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="flex w-full items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            type="search"
            value={
              currentValue.query
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) => {
              updateValue({
                query:
                  event.target.value,
              });
            }}
            placeholder={
              placeholder
            }
            className={[
              "h-11 w-full rounded-xl border",
              "border-white/10 bg-background",
              "pl-10 pr-10 text-sm",
              "outline-none transition-colors",
              "placeholder:text-muted-foreground",
              "focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            aria-label="Search knowledge"
          />

          {loading ? (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : currentValue.query ? (
            <button
              type="button"
              disabled={
                disabled
              }
              onClick={
                clearSearch
              }
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {showFilters ? (
          <button
            type="button"
            disabled={
              disabled
            }
            onClick={() => {
              setFiltersOpen(
                (current) =>
                  !current
              );
            }}
            className={[
              "relative flex h-11 shrink-0 items-center justify-center gap-2",
              "rounded-xl border px-3",
              "transition-colors",
              filtersOpen ||
              hasActiveFilters
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/10 bg-background text-muted-foreground hover:bg-muted",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
            aria-label="Toggle search filters"
            aria-expanded={
              filtersOpen
            }
          >
            <SlidersHorizontal className="h-4 w-4" />

            <span className="hidden text-xs font-medium sm:inline">
              Filters
            </span>

            {hasActiveFilters ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            ) : null}
          </button>
        ) : null}
      </form>

      {showFilters &&
      filtersOpen ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-muted/20 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="knowledge-status"
                className="mb-2 block text-xs font-medium"
              >
                Status
              </label>

              <select
                id="knowledge-status"
                value={
                  currentValue.status
                }
                disabled={
                  disabled
                }
                onChange={(
                  event
                ) => {
                  updateValue({
                    status:
                      event.target
                        .value as KnowledgeSearchStatus,
                  });
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {showSort ? (
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="knowledge-sort"
                  className="mb-2 block text-xs font-medium"
                >
                  Sort by
                </label>

                <select
                  id="knowledge-sort"
                  value={
                    currentValue.sort
                  }
                  disabled={
                    disabled
                  }
                  onChange={(
                    event
                  ) => {
                    updateValue({
                      sort:
                        event.target
                          .value as KnowledgeSearchSort,
                    });
                  }}
                  className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {SORT_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                disabled={
                  disabled
                }
                onClick={
                  resetFilters
                }
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />

                Reset
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export {
  DEFAULT_VALUE,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  areValuesEqual,
  normalizeValue,
};