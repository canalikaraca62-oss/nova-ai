"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

export type MessageSource = {
  id?: string;

  title?: string;

  url?: string;

  domain?: string;

  description?: string;

  snippet?: string;

  favicon?: string;

  image?: string;

  author?: string;

  publisher?: string;

  publishedAt?: string | Date | null;

  score?: number | null;
};

export type MessageSourcesProps = {
  sources?: MessageSource[];

  className?: string;

  title?: string;

  initiallyExpanded?: boolean;

  defaultVisibleCount?: number;

  showScore?: boolean;

  showDescription?: boolean;

  showPublishedAt?: boolean;

  onSourceClick?: (
    source: MessageSource,
    index: number
  ) => void | Promise<void>;
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

function getHostname(
  url?: string,
  fallback?: string
) {
  if (!url) {
    return fallback ?? "";
  }

  try {
    return new URL(url).hostname
      .replace(/^www\./, "");
  } catch {
    return fallback ?? "";
  }
}

function getInitials(
  value: string
) {
  return value
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      part =>
        part.charAt(0).toUpperCase()
    )
    .join("");
}

function formatDate(
  value?: string | Date | null
) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

function normalizeScore(
  score?: number | null
) {
  if (
    typeof score !== "number" ||
    !Number.isFinite(score)
  ) {
    return null;
  }

  const normalized =
    score <= 1
      ? score * 100
      : score;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(normalized)
    )
  );
}

function SourceIcon({
  source,
}: {
  source: MessageSource;
}) {
  const domain =
    getHostname(
      source.url,
      source.domain
    );

  const initials =
    getInitials(
      domain ||
        source.publisher ||
        source.title ||
        "S"
    );

  const [imageError, setImageError] =
    useState(false);

  if (
    source.favicon &&
    !imageError
  ) {
    return (
      <img
        src={source.favicon}
        alt=""
        width={32}
        height={32}
        onError={() =>
          setImageError(true)
        }
        className="h-8 w-8 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover dark:border-zinc-800 dark:bg-zinc-900"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-[10px] font-bold text-violet-700 dark:text-violet-300">
      {initials || "S"}
    </div>
  );
}

export default function MessageSources({
  sources = [],
  className,
  title = "Sources",
  initiallyExpanded = false,
  defaultVisibleCount = 3,
  showScore = false,
  showDescription = true,
  showPublishedAt = true,
  onSourceClick,
}: MessageSourcesProps) {
  const [isExpanded, setIsExpanded] =
    useState(initiallyExpanded);

  const [faviconErrors, setFaviconErrors] =
    useState<Record<string, boolean>>(
      {}
    );

  useEffect(() => {
    setIsExpanded(
      initiallyExpanded
    );
  }, [initiallyExpanded]);

  const safeVisibleCount =
    Math.max(
      1,
      Math.floor(
        defaultVisibleCount
      )
    );

  const normalizedSources =
    useMemo(
      () =>
        sources.filter(
          source =>
            Boolean(
              source.title ||
                source.url ||
                source.domain ||
                source.description ||
                source.snippet
            )
        ),
      [sources]
    );

  if (
    normalizedSources.length === 0
  ) {
    return null;
  }

  const visibleSources =
    isExpanded
      ? normalizedSources
      : normalizedSources.slice(
          0,
          safeVisibleCount
        );

  const hiddenCount =
    Math.max(
      0,
      normalizedSources.length -
        safeVisibleCount
    );

  const handleSourceClick = async (
    source: MessageSource,
    index: number
  ) => {
    try {
      await onSourceClick?.(
        source,
        index
      );
    } catch (error) {
      console.error(
        "Source click handler failed:",
        error
      );
    }
  };

  return (
    <section
      className={cn(
        "mt-4 w-full max-w-3xl",
        className
      )}
      aria-label={title}
    >
      <div className="rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5A2.5 2.5 0 0 0 16.5 16H4V5.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                <path
                  d="M7 7h8M7 10h8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {title}
              </h3>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {normalizedSources.length}{" "}
                {normalizedSources.length ===
                1
                  ? "source"
                  : "sources"}
              </p>
            </div>
          </div>

          {normalizedSources.length >
            safeVisibleCount && (
            <button
              type="button"
              onClick={() =>
                setIsExpanded(
                  previous =>
                    !previous
                )
              }
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-500/10 dark:text-violet-300"
            >
              {isExpanded
                ? "Show less"
                : `View all (${normalizedSources.length})`}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {visibleSources.map(
            (
              source,
              visibleIndex
            ) => {
              const sourceIndex =
                normalizedSources.indexOf(
                  source
                );

              const domain =
                getHostname(
                  source.url,
                  source.domain
                );

              const sourceKey =
                source.id ??
                source.url ??
                `${source.title ?? "source"}-${sourceIndex}`;

              const formattedDate =
                formatDate(
                  source.publishedAt
                );

              const score =
                normalizeScore(
                  source.score
                );

              const description =
                source.description ??
                source.snippet;

              const content = (
                <>
                  <div className="flex min-w-0 flex-1 gap-3">
                    {source.favicon &&
                    !faviconErrors[
                      sourceKey
                    ] ? (
                      <img
                        src={source.favicon}
                        alt=""
                        width={32}
                        height={32}
                        onError={() =>
                          setFaviconErrors(
                            previous => ({
                              ...previous,
                              [sourceKey]:
                                true,
                            })
                          )
                        }
                        className="h-8 w-8 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    ) : (
                      <SourceIcon
                        source={source}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                            {source.title ||
                              domain ||
                              "Untitled source"}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {domain && (
                              <span className="truncate">
                                {domain}
                              </span>
                            )}

                            {source.publisher &&
                              source.publisher !==
                                domain && (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {
                                      source.publisher
                                    }
                                  </span>
                                </>
                              )}

                            {showPublishedAt &&
                              formattedDate && (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {
                                      formattedDate
                                    }
                                  </span>
                                </>
                              )}

                            {showScore &&
                              score !== null && (
                                <>
                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {score}%
                                    relevance
                                  </span>
                                </>
                              )}
                          </div>

                          {showDescription &&
                            description && (
                              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                {
                                  description
                                }
                              </p>
                            )}
                        </div>

                        {source.url && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-zinc-400"
                          >
                            <path
                              d="M14 5h5v5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            <path
                              d="m19 5-9 9"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />

                            <path
                              d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );

              if (source.url) {
                return (
                  <a
                    key={sourceKey}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      void handleSourceClick(
                        source,
                        sourceIndex
                      )
                    }
                    className="group flex w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-left transition hover:border-violet-500/30 hover:bg-violet-500/[0.03] focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/[0.05]"
                  >
                    {content}
                  </a>
                );
              }

              return (
                <button
                  key={sourceKey}
                  type="button"
                  onClick={() =>
                    void handleSourceClick(
                      source,
                      sourceIndex
                    )
                  }
                  className="group flex w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-left transition hover:border-violet-500/30 hover:bg-violet-500/[0.03] focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/[0.05]"
                >
                  {content}
                </button>
              );
            }
          )}
        </div>

        {!isExpanded &&
          hiddenCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setIsExpanded(true)
              }
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:border-violet-500/30 hover:bg-violet-500/[0.03] hover:text-violet-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-violet-500/30 dark:hover:text-violet-300"
            >
              Show {hiddenCount} more{" "}
              {hiddenCount === 1
                ? "source"
                : "sources"}

              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m7 10 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
      </div>
    </section>
  );
}