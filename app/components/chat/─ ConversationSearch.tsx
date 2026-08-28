"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ConversationSearchItem = {
  id: string;
  title: string;
  preview?: string | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  pinned?: boolean;
  archived?: boolean;
  metadata?: Record<string, unknown>;
};

export type ConversationSearchProps = {
  conversations?: ConversationSearchItem[];

  placeholder?: string;

  debounceMs?: number;

  maxResults?: number;

  autoFocus?: boolean;

  showRecentSearches?: boolean;

  recentSearchLimit?: number;

  onSelect?: (
    conversation: ConversationSearchItem
  ) => void;

  onSearch?: (
    query: string
  ) =>
    | ConversationSearchItem[]
    | Promise<
        ConversationSearchItem[]
      >
    | void
    | Promise<void>;

  onQueryChange?: (
    query: string
  ) => void;

  className?: string;

  disabled?: boolean;
};

function cn(
  ...classes: Array<
    string | undefined | null | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeText(
  value: string
) {
  return value
    .toLocaleLowerCase()
    .trim();
}

function formatDate(
  value?: string | Date | null
) {
  if (!value) {
    return null;
  }

  try {
    const date =
      typeof value === "string"
        ? new Date(value)
        : value;

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    const now = new Date();

    const difference =
      now.getTime() -
      date.getTime();

    const minutes =
      Math.floor(
        difference / 60000
      );

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days < 7) {
      return `${days}d ago`;
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
      }
    ).format(date);
  } catch {
    return null;
  }
}

export default function ConversationSearch({
  conversations = [],

  placeholder =
    "Search conversations...",

  debounceMs = 180,

  maxResults = 8,

  autoFocus = false,

  showRecentSearches = true,

  recentSearchLimit = 5,

  onSelect,

  onSearch,

  onQueryChange,

  className,

  disabled = false,
}: ConversationSearchProps) {
  const inputRef =
    useRef<HTMLInputElement>(
      null
    );

  const containerRef =
    useRef<HTMLDivElement>(
      null
    );

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    debouncedQuery,
    setDebouncedQuery,
  ] = useState("");

  const [
    results,
    setResults,
  ] = useState<
    ConversationSearchItem[]
  >([]);

  const [
    recentSearches,
    setRecentSearches,
  ] = useState<
    ConversationSearchItem[]
  >([]);

  const [
    activeIndex,
    setActiveIndex,
  ] = useState(-1);

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    isSearching,
    setIsSearching,
  ] = useState(false);

  const normalizedQuery =
    useMemo(
      () =>
        normalizeText(
          debouncedQuery
        ),
      [debouncedQuery]
    );

  /* =====================================================
     AUTO FOCUS
  ===================================================== */

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [autoFocus]);

  /* =====================================================
     DEBOUNCE
  ===================================================== */

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        setDebouncedQuery(
          query
        );
      }, debounceMs);

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    query,
    debounceMs,
  ]);

  /* =====================================================
     SEARCH
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const runSearch =
      async () => {
        if (
          !normalizedQuery
        ) {
          if (!cancelled) {
            setResults([]);
            setIsSearching(false);
          }

          return;
        }

        setIsSearching(true);

        try {
          if (onSearch) {
            const response =
              await onSearch(
                debouncedQuery
              );

            if (
              cancelled
            ) {
              return;
            }

            if (
              Array.isArray(
                response
              )
            ) {
              setResults(
                response.slice(
                  0,
                  maxResults
                )
              );
            } else {
              setResults([]);
            }

            return;
          }

          const filtered =
            conversations
              .filter(
                (
                  conversation
                ) => {
                  const title =
                    normalizeText(
                      conversation.title
                    );

                  const preview =
                    normalizeText(
                      conversation.preview ??
                        ""
                    );

                  return (
                    title.includes(
                      normalizedQuery
                    ) ||
                    preview.includes(
                      normalizedQuery
                    )
                  );
                }
              )
              .sort(
                (a, b) => {
                  const aPinned =
                    a.pinned
                      ? 1
                      : 0;

                  const bPinned =
                    b.pinned
                      ? 1
                      : 0;

                  return (
                    bPinned -
                    aPinned
                  );
                }
              )
              .slice(
                0,
                maxResults
              );

          if (
            !cancelled
          ) {
            setResults(
              filtered
            );
          }
        } catch (
          error
        ) {
          console.error(
            "Conversation search failed:",
            error
          );

          if (
            !cancelled
          ) {
            setResults([]);
          }
        } finally {
          if (
            !cancelled
          ) {
            setIsSearching(
              false
            );
          }
        }
      };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [
    normalizedQuery,
    debouncedQuery,
    conversations,
    maxResults,
    onSearch,
  ]);

  /* =====================================================
     RESET ACTIVE INDEX
  ===================================================== */

  useEffect(() => {
    setActiveIndex(-1);
  }, [
    normalizedQuery,
    results.length,
  ]);

  /* =====================================================
     CLOSE ON OUTSIDE CLICK
  ===================================================== */

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent
    ) => {
      if (
        !containerRef.current
      ) {
        return;
      }

      if (
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, []);

  /* =====================================================
     NOTIFY QUERY CHANGE
  ===================================================== */

  useEffect(() => {
    onQueryChange?.(
      query
    );
  }, [
    query,
    onQueryChange,
  ]);

  /* =====================================================
     CURRENT ITEMS
  ===================================================== */

  const visibleItems =
    normalizedQuery
      ? results
      : showRecentSearches
        ? recentSearches.slice(
            0,
            recentSearchLimit
          )
        : [];

  const showDropdown =
    isOpen &&
    !disabled &&
    (
      normalizedQuery.length >
        0 ||
      (
        showRecentSearches &&
        recentSearches.length >
          0
      )
    );

  /* =====================================================
     SELECT
  ===================================================== */

  const handleSelect = (
    conversation: ConversationSearchItem
  ) => {
    setQuery(
      conversation.title
    );

    setIsOpen(false);

    setActiveIndex(-1);

    setRecentSearches(
      (
        previous
      ) => {
        const withoutCurrent =
          previous.filter(
            (
              item
            ) =>
              item.id !==
              conversation.id
          );

        return [
          conversation,
          ...withoutCurrent,
        ].slice(
          0,
          recentSearchLimit
        );
      }
    );

    onSelect?.(
      conversation
    );
  };

  /* =====================================================
     KEYBOARD NAVIGATION
  ===================================================== */

  const handleKeyDown = (
    event: React.KeyboardEvent<
      HTMLInputElement
    >
  ) => {
    if (
      event.key ===
      "Escape"
    ) {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();

      return;
    }

    if (
      !showDropdown
    ) {
      return;
    }

    if (
      event.key ===
      "ArrowDown"
    ) {
      event.preventDefault();

      setActiveIndex(
        (
          previous
        ) =>
          previous >=
          visibleItems.length -
            1
            ? 0
            : previous + 1
      );

      return;
    }

    if (
      event.key ===
      "ArrowUp"
    ) {
      event.preventDefault();

      setActiveIndex(
        (
          previous
        ) =>
          previous <= 0
            ? visibleItems.length -
              1
            : previous - 1
      );

      return;
    }

    if (
      event.key ===
        "Enter" &&
      activeIndex >= 0 &&
      visibleItems[
        activeIndex
      ]
    ) {
      event.preventDefault();

      handleSelect(
        visibleItems[
          activeIndex
        ]
      );
    }
  };

  /* =====================================================
     HIGHLIGHT
  ===================================================== */

  const renderHighlightedText = (
    value: string
  ) => {
    if (
      !normalizedQuery
    ) {
      return value;
    }

    const lowerValue =
      value.toLocaleLowerCase();

    const queryIndex =
      lowerValue.indexOf(
        normalizedQuery
      );

    if (
      queryIndex === -1
    ) {
      return value;
    }

    const before =
      value.slice(
        0,
        queryIndex
      );

    const match =
      value.slice(
        queryIndex,
        queryIndex +
          normalizedQuery.length
      );

    const after =
      value.slice(
        queryIndex +
          normalizedQuery.length
      );

    return (
      <>
        {before}

        <mark className="rounded bg-violet-500/15 px-0.5 font-semibold text-violet-700 dark:text-violet-300">
          {match}
        </mark>

        {after}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full",
        className
      )}
    >
      {/* SEARCH INPUT */}

      <div className="group relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400 transition group-focus-within:text-violet-500">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="6.5"
              stroke="currentColor"
              strokeWidth="2"
            />

            <path
              d="m16 16 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          placeholder={
            placeholder
          }
          onFocus={() =>
            setIsOpen(true)
          }
          onChange={(
            event
          ) => {
            setQuery(
              event.target.value
            );

            setIsOpen(true);
          }}
          onKeyDown={
            handleKeyDown
          }
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-24 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-600"
        />

        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
          {isSearching && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          )}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setActiveIndex(-1);

                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
            >
              ×
            </button>
          )}

          <kbd className="hidden rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[10px] font-medium text-zinc-400 sm:block dark:border-zinc-800 dark:bg-zinc-900">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* RESULTS */}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              {normalizedQuery
                ? "Search results"
                : "Recent conversations"}
            </p>
          </div>

          {visibleItems.length >
          0 ? (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {visibleItems.map(
                (
                  conversation,
                  index
                ) => {
                  const isActive =
                    index ===
                    activeIndex;

                  const date =
                    formatDate(
                      conversation.updatedAt ??
                        conversation.createdAt
                    );

                  return (
                    <button
                      key={
                        conversation.id
                      }
                      type="button"
                      onMouseEnter={() =>
                        setActiveIndex(
                          index
                        )
                      }
                      onClick={() =>
                        handleSelect(
                          conversation
                        )
                      }
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                        isActive
                          ? "bg-zinc-100 dark:bg-zinc-900"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M7 10h10M7 14h6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />

                          <path
                            d="M20 11.5C20 16.194 16.194 20 11.5 20c-1.346 0-2.62-.313-3.75-.87L4 20l.87-3.75A8.46 8.46 0 0 1 3 11.5C3 6.806 6.806 3 11.5 3S20 6.806 20 11.5Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                            {renderHighlightedText(
                              conversation.title
                            )}
                          </p>

                          {conversation.pinned && (
                            <span className="shrink-0 text-xs">
                              📌
                            </span>
                          )}

                          {conversation.archived && (
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800">
                              Archived
                            </span>
                          )}
                        </div>

                        {conversation.preview && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            {renderHighlightedText(
                              conversation.preview
                            )}
                          </p>
                        )}
                      </div>

                      {date && (
                        <span className="shrink-0 pt-0.5 text-[10px] text-zinc-400">
                          {date}
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <path
                    d="m16 16 4 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <p className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No conversations found
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Try a different search term.
              </p>
            </div>
          )}

          {visibleItems.length >
            0 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-[10px] text-zinc-400 dark:border-zinc-800">
              <span>
                {visibleItems.length}{" "}
                result
                {visibleItems.length !==
                1
                  ? "s"
                  : ""}
              </span>

              <span className="hidden sm:block">
                ↑ ↓ to navigate · Enter
                to open · Esc to close
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}