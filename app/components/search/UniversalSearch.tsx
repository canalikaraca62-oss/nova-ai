"use client";

import Link from "next/link";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Clock3,
  FileText,
  FolderKanban,
  Hash,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type UniversalSearchResultType =
  | "page"
  | "project"
  | "document"
  | "chat"
  | "agent"
  | "task"
  | "command"
  | "other";

export type UniversalSearchResult = {
  id: string;
  title: string;
  description?: string;
  href?: string;
  type?: UniversalSearchResultType;
  icon?: ReactNode;
  meta?: string;
  keywords?: string[];
  disabled?: boolean;
};

export type UniversalSearchGroup = {
  id: string;
  label: string;
  results: UniversalSearchResult[];
};

export type UniversalSearchProps = {
  groups?: UniversalSearchGroup[];
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  autoFocus?: boolean;
  showFilters?: boolean;
  maxResults?: number;
  className?: string;
  onQueryChange?: (query: string) => void;
  onResultSelect?: (
    result: UniversalSearchResult
  ) => void;
  onClose?: () => void;
};

/* ==================================================
   DEFAULT DATA
================================================== */

const DEFAULT_GROUPS: UniversalSearchGroup[] = [
  {
    id: "pages",
    label: "Pages",
    results: [
      {
        id: "chat",
        title: "Chat",
        description: "Open your conversations",
        href: "/chat",
        type: "page",
        icon: <Hash className="h-4 w-4" />,
        keywords: [
          "conversation",
          "message",
          "ai",
        ],
      },
      {
        id: "canvas",
        title: "Canvas",
        description: "Open your AI workspace",
        href: "/canvas",
        type: "page",
        icon: <Sparkles className="h-4 w-4" />,
        keywords: [
          "workspace",
          "editor",
          "board",
        ],
      },
      {
        id: "projects",
        title: "Projects",
        description: "Manage your projects",
        href: "/projects",
        type: "project",
        icon: (
          <FolderKanban className="h-4 w-4" />
        ),
        keywords: [
          "project",
          "workspace",
          "team",
        ],
      },
      {
        id: "knowledge",
        title: "Knowledge",
        description: "Search your knowledge base",
        href: "/knowledge",
        type: "document",
        icon: (
          <FileText className="h-4 w-4" />
        ),
        keywords: [
          "documents",
          "files",
          "knowledge",
        ],
      },
    ],
  },
];

/* ==================================================
   HELPERS
================================================== */

function normalizeSearchValue(
  value: string
): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function resultMatchesQuery(
  result: UniversalSearchResult,
  query: string
): boolean {
  const normalizedQuery: string =
    normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableValues: string[] = [
    result.title,
    result.description ?? "",
    result.meta ?? "",
    ...(result.keywords ?? []),
    result.type ?? "",
  ];

  return searchableValues.some(
    (value: string): boolean =>
      normalizeSearchValue(
        value
      ).includes(normalizedQuery)
  );
}

function filterGroups(
  groups: UniversalSearchGroup[],
  query: string,
  maxResults: number
): UniversalSearchGroup[] {
  let remainingResults: number =
    maxResults;

  const filteredGroups: UniversalSearchGroup[] =
    [];

  for (
    const group of groups
  ) {
    if (remainingResults <= 0) {
      break;
    }

    const matchingResults: UniversalSearchResult[] =
      group.results
        .filter(
          (
            result: UniversalSearchResult
          ): boolean =>
            resultMatchesQuery(
              result,
              query
            )
        )
        .slice(
          0,
          remainingResults
        );

    if (
      matchingResults.length === 0
    ) {
      continue;
    }

    filteredGroups.push({
      ...group,
      results: matchingResults,
    });

    remainingResults -=
      matchingResults.length;
  }

  return filteredGroups;
}

function getResultIcon(
  result: UniversalSearchResult
): ReactNode {
  if (result.icon) {
    return result.icon;
  }

  switch (result.type) {
    case "project":
      return (
        <FolderKanban className="h-4 w-4" />
      );

    case "document":
      return (
        <FileText className="h-4 w-4" />
      );

    case "command":
      return (
        <Sparkles className="h-4 w-4" />
      );

    default:
      return (
        <Search className="h-4 w-4" />
      );
  }
}

/* ==================================================
   SEARCH RESULT
================================================== */

type SearchResultItemProps = {
  result: UniversalSearchResult;
  active: boolean;
  onSelect: (
    result: UniversalSearchResult
  ) => void;
};

function SearchResultItem({
  result,
  active,
  onSelect,
}: SearchResultItemProps): ReactNode {
  const className: string = [
    "group flex min-h-16 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors",
    active
      ? "bg-muted"
      : "hover:bg-muted/70",
    result.disabled
      ? "pointer-events-none opacity-50"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content: ReactNode = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
        {getResultIcon(result)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {result.title}
        </span>

        {result.description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {result.description}
          </span>
        ) : null}
      </span>

      {result.meta ? (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {result.meta}
        </span>
      ) : null}

      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
    </>
  );

  const handleClick = (): void => {
    if (!result.disabled) {
      onSelect(result);
    }
  };

  if (result.href) {
    return (
      <Link
        href={
          result.disabled
            ? "#"
            : result.href
        }
        onClick={handleClick}
        className={className}
        aria-disabled={
          result.disabled
        }
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={result.disabled}
      onClick={handleClick}
      className={className}
    >
      {content}
    </button>
  );
}

/* ==================================================
   MAIN COMPONENT
================================================== */

export default function UniversalSearch({
  groups = DEFAULT_GROUPS,
  placeholder = "Search everything...",
  emptyMessage = "No results found.",
  loading = false,
  autoFocus = false,
  showFilters = true,
  maxResults = 50,
  className = "",
  onQueryChange,
  onResultSelect,
  onClose,
}: UniversalSearchProps): ReactNode {
  const [
    query,
    setQuery,
  ] = useState<string>("");

  const [
    activeIndex,
    setActiveIndex,
  ] = useState<number>(0);

  const [
    selectedType,
    setSelectedType,
  ] = useState<
    UniversalSearchResultType | "all"
  >("all");

  const filteredGroups: UniversalSearchGroup[] =
    useMemo(
      (): UniversalSearchGroup[] => {
        const baseGroups: UniversalSearchGroup[] =
          filterGroups(
            groups,
            query,
            maxResults
          );

        if (
          selectedType === "all"
        ) {
          return baseGroups;
        }

        return baseGroups
          .map(
            (
              group: UniversalSearchGroup
            ): UniversalSearchGroup => ({
              ...group,
              results:
                group.results.filter(
                  (
                    result: UniversalSearchResult
                  ): boolean =>
                    result.type ===
                    selectedType
                ),
            })
          )
          .filter(
            (
              group: UniversalSearchGroup
            ): boolean =>
              group.results.length > 0
          );
      },
      [
        groups,
        maxResults,
        query,
        selectedType,
      ]
    );

  const flatResults: UniversalSearchResult[] =
    useMemo(
      (): UniversalSearchResult[] =>
        filteredGroups.flatMap(
          (
            group: UniversalSearchGroup
          ): UniversalSearchResult[] =>
            group.results
        ),
      [filteredGroups]
    );

  const availableTypes:
    UniversalSearchResultType[] =
    useMemo(() => {
      const types = new Set<
        UniversalSearchResultType
      >();

      for (
        const group of groups
      ) {
        for (
          const result of group.results
        ) {
          if (result.type) {
            types.add(
              result.type
            );
          }
        }
      }

      return Array.from(types);
    }, [groups]);

  useEffect((): void => {
    if (
      activeIndex >=
      flatResults.length
    ) {
      setActiveIndex(0);
    }
  }, [
    activeIndex,
    flatResults.length,
  ]);

  const handleQueryChange = (
    value: string
  ): void => {
    setQuery(value);
    setActiveIndex(0);
    onQueryChange?.(value);
  };

  const selectResult = (
    result: UniversalSearchResult
  ): void => {
    if (result.disabled) {
      return;
    }

    onResultSelect?.(result);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ): void => {
    if (
      flatResults.length === 0
    ) {
      if (
        event.key === "Escape"
      ) {
        onClose?.();
      }

      return;
    }

    if (
      event.key === "ArrowDown"
    ) {
      event.preventDefault();

      setActiveIndex(
        (
          current: number
        ): number =>
          current >=
          flatResults.length - 1
            ? 0
            : current + 1
      );

      return;
    }

    if (
      event.key === "ArrowUp"
    ) {
      event.preventDefault();

      setActiveIndex(
        (
          current: number
        ): number =>
          current <= 0
            ? flatResults.length - 1
            : current - 1
      );

      return;
    }

    if (
      event.key === "Enter"
    ) {
      event.preventDefault();

      const result:
        | UniversalSearchResult
        | undefined =
        flatResults[
          activeIndex
        ];

      if (result) {
        selectResult(result);
      }

      return;
    }

    if (
      event.key === "Escape"
    ) {
      onClose?.();
    }
  };

  const clearSearch = (): void => {
    handleQueryChange("");
  };

  return (
    <div
      className={[
        "flex w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* SEARCH INPUT */}

      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            autoFocus={autoFocus}
            value={query}
            onChange={(
              event
            ): void => {
              handleQueryChange(
                event.target.value
              );
            }}
            onKeyDown={handleKeyDown}
            type="search"
            placeholder={placeholder}
            aria-label="Universal search"
            className="h-11 w-full rounded-xl bg-muted/50 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:bg-background focus:ring-2 focus:ring-primary/20"
          />

          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* FILTERS */}

      {showFilters &&
      availableTypes.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto border-b border-border/60 px-3 py-2">
          <button
            type="button"
            onClick={(): void => {
              setSelectedType("all");
            }}
            className={[
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              selectedType === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            All
          </button>

          {availableTypes.map(
            (
              type: UniversalSearchResultType
            ) => (
              <button
                key={type}
                type="button"
                onClick={(): void => {
                  setSelectedType(type);
                  setActiveIndex(0);
                }}
                className={[
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  selectedType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {type}
              </button>
            )
          )}
        </div>
      ) : null}

      {/* RESULTS */}

      <div className="min-h-0 max-h-[60vh] overflow-y-auto p-2">
        {loading ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />

            <span>
              Searching...
            </span>
          </div>
        ) : flatResults.length ===
          0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>

            <p className="mt-4 text-sm font-medium">
              {emptyMessage}
            </p>

            {query ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different keyword
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map(
              (
                group: UniversalSearchGroup
              ) => (
                <section
                  key={group.id}
                >
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </p>

                  <div className="space-y-1">
                    {group.results.map(
                      (
                        result: UniversalSearchResult
                      ) => {
                        const resultIndex: number =
                          flatResults.findIndex(
                            (
                              current: UniversalSearchResult
                            ): boolean =>
                              current.id ===
                              result.id
                          );

                        return (
                          <SearchResultItem
                            key={result.id}
                            result={result}
                            active={
                              resultIndex ===
                              activeIndex
                            }
                            onSelect={
                              selectResult
                            }
                          />
                        );
                      }
                    )}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}

      <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border/60 px-4 text-[10px] text-muted-foreground">
        <div className="hidden items-center gap-3 sm:flex">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">
              ↑
            </kbd>

            <kbd className="rounded border border-border px-1 py-0.5">
              ↓
            </kbd>

            Navigate
          </span>

          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">
              ↵
            </kbd>

            Open
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Clock3 className="h-3 w-3" />

          <span>
            {flatResults.length} results
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  DEFAULT_GROUPS,
  filterGroups,
  getResultIcon,
  normalizeSearchValue,
  resultMatchesQuery,
};