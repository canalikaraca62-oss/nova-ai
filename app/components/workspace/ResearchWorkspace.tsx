"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleAlert,
  Clipboard,
  ExternalLink,
  FileText,
  Globe2,
  Lightbulb,
  Link2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type ResearchStatus =
  | "idle"
  | "researching"
  | "completed"
  | "failed";

export type ResearchSourceType =
  | "website"
  | "article"
  | "document"
  | "paper"
  | "other";

export type ResearchSource = {
  id: string;
  title: string;
  url?: string;
  description?: string;
  type?: ResearchSourceType;
  domain?: string;
};

export type ResearchInsight = {
  id: string;
  title: string;
  content: string;
  confidence?: number;
};

export type ResearchResult = {
  id: string;
  query: string;
  summary?: string;
  sources: ResearchSource[];
  insights: ResearchInsight[];
  createdAt?: string;
};

export type ResearchRequest = {
  workspaceId: string;
  query: string;
};

export type ResearchWorkspaceProps = {
  workspaceId: string;

  workspaceName?: string;

  initialQuery?: string;

  initialResult?: ResearchResult | null;

  onResearch?: (
    request: ResearchRequest
  ) => Promise<ResearchResult>;

  onSaveNotes?: (
    workspaceId: string,
    notes: string
  ) => Promise<void>;

  onError?: (
    error: Error
  ) => void;

  className?: string;
};

/* ==================================================
   HELPERS
================================================== */

function joinClasses(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function getSourceTypeLabel(
  type?: ResearchSourceType
): string {
  switch (type) {
    case "website":
      return "Website";

    case "article":
      return "Article";

    case "document":
      return "Document";

    case "paper":
      return "Research Paper";

    default:
      return "Source";
  }
}

function getDomainFromUrl(
  url?: string
): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function createLocalId(
  prefix: string
): string {
  return [
    prefix,
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 8),
  ].join("-");
}

/* ==================================================
   COMPONENT
================================================== */

export default function ResearchWorkspace({
  workspaceId,
  workspaceName = "Research Workspace",
  initialQuery = "",
  initialResult = null,
  onResearch,
  onSaveNotes,
  onError,
  className = "",
}: ResearchWorkspaceProps) {
  const [query, setQuery] =
    useState<string>(
      initialQuery
    );

  const [result, setResult] =
    useState<ResearchResult | null>(
      initialResult
    );

  const [notes, setNotes] =
    useState<string>("");

  const [status, setStatus] =
    useState<ResearchStatus>(
      initialResult
        ? "completed"
        : "idle"
    );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [isSavingNotes, setIsSavingNotes] =
    useState<boolean>(false);

  const [activeTab, setActiveTab] =
    useState<
      "overview" | "sources" | "insights" | "notes"
    >("overview");

  /* ==================================================
     SYNC
  ================================================== */

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setResult(initialResult);

    setStatus(
      initialResult
        ? "completed"
        : "idle"
    );
  }, [initialResult]);

  /* ==================================================
     DERIVED STATE
  ================================================== */

  const sourceCount =
    result?.sources.length ?? 0;

  const insightCount =
    result?.insights.length ?? 0;

  const isResearching =
    status === "researching";

  const canResearch = Boolean(
    query.trim() &&
      !isResearching &&
      onResearch
  );

  const tabs = useMemo(
    () => [
      {
        id: "overview" as const,
        label: "Overview",
        icon: BookOpen,
      },
      {
        id: "sources" as const,
        label: "Sources",
        icon: Link2,
        count: sourceCount,
      },
      {
        id: "insights" as const,
        label: "Insights",
        icon: Lightbulb,
        count: insightCount,
      },
      {
        id: "notes" as const,
        label: "Notes",
        icon: FileText,
      },
    ],
    [
      insightCount,
      sourceCount,
    ]
  );

  /* ==================================================
     ERROR
  ================================================== */

  const handleError = useCallback(
    (error: unknown): void => {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(
              "Something went wrong during research."
            );

      setErrorMessage(
        normalizedError.message
      );

      onError?.(
        normalizedError
      );
    },
    [onError]
  );

  /* ==================================================
     RESEARCH
  ================================================== */

  const handleResearch = useCallback(
    async (
      event?: FormEvent<HTMLFormElement>
    ): Promise<void> => {
      event?.preventDefault();

      const trimmedQuery =
        query.trim();

      if (!trimmedQuery) {
        setErrorMessage(
          "Please enter a research topic."
        );
        return;
      }

      if (!onResearch) {
        setErrorMessage(
          "Research service is not configured."
        );
        return;
      }

      setStatus("researching");
      setErrorMessage(null);

      try {
        const researchResult =
          await onResearch({
            workspaceId,
            query: trimmedQuery,
          });

        setResult(
          researchResult
        );

        setStatus(
          "completed"
        );

        setActiveTab(
          "overview"
        );
      } catch (error: unknown) {
        setStatus("failed");

        handleError(
          error
        );
      }
    },
    [
      handleError,
      onResearch,
      query,
      workspaceId,
    ]
  );

  /* ==================================================
     SAVE NOTES
  ================================================== */

  const handleSaveNotes = useCallback(
    async (): Promise<void> => {
      if (!onSaveNotes) {
        return;
      }

      setIsSavingNotes(true);
      setErrorMessage(null);

      try {
        await onSaveNotes(
          workspaceId,
          notes
        );
      } catch (error: unknown) {
        handleError(
          error
        );
      } finally {
        setIsSavingNotes(false);
      }
    },
    [
      handleError,
      notes,
      onSaveNotes,
      workspaceId,
    ]
  );

  /* ==================================================
     ADD SOURCE
  ================================================== */

  const handleAddSource = (): void => {
    if (!result) {
      return;
    }

    const source: ResearchSource = {
      id: createLocalId("source"),
      title: "New research source",
      description:
        "Add source details from your research workflow.",
      type: "other",
    };

    setResult({
      ...result,
      sources: [
        ...result.sources,
        source,
      ],
    });

    setActiveTab("sources");
  };

  /* ==================================================
     DELETE SOURCE
  ================================================== */

  const handleDeleteSource = (
    sourceId: string
  ): void => {
    if (!result) {
      return;
    }

    setResult({
      ...result,
      sources:
        result.sources.filter(
          (source) =>
            source.id !== sourceId
        ),
    });
  };

  /* ==================================================
     EMPTY STATE
  ================================================== */

  const hasResult =
    result !== null;

  return (
    <section
      className={joinClasses(
        "flex",
        "min-h-[700px]",
        "w-full",
        "flex-col",
        "overflow-hidden",
        "rounded-2xl",
        "border",
        "border-border",
        "bg-background",
        "shadow-sm",
        className
      )}
    >
      {/* ==============================================
          HEADER
      ============================================== */}

      <div className="border-b border-border px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Research Workspace
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                {workspaceName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === "completed" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Check className="h-3.5 w-3.5" />
                Research completed
              </span>
            ) : null}

            {isResearching ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Researching
              </span>
            ) : null}
          </div>
        </div>

        {/* ============================================
            SEARCH
        ============================================ */}

        <form
          onSubmit={(event) => {
            void handleResearch(event);
          }}
          className="mt-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

              <input
                value={query}
                onChange={(event) => {
                  setQuery(
                    event.target.value
                  );
                }}
                disabled={isResearching}
                placeholder="What would you like to research?"
                className="h-12 w-full rounded-xl border border-border bg-background pl-12 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={!canResearch}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isResearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Start research
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ==============================================
          ERROR
      ============================================== */}

      {errorMessage ? (
        <div
          role="alert"
          className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 sm:mx-6"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">
              Research error
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {errorMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ==============================================
          LOADING
      ============================================== */}

      {isResearching ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>

            <h2 className="mt-5 text-base font-semibold text-foreground">
              Research in progress
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Gathering information, analyzing
              sources, and generating insights.
            </p>

            <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </div>
      ) : null}

      {/* ==============================================
          EMPTY STATE
      ============================================== */}

      {!isResearching && !hasResult ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BookOpen className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-foreground">
              Start a research session
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Enter a topic, question, market,
              technology, or problem. The research
              workspace will organize sources,
              summaries, and actionable insights.
            </p>

            <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border p-4">
                <Globe2 className="h-5 w-5 text-primary" />

                <h3 className="mt-3 text-sm font-medium text-foreground">
                  Sources
                </h3>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Collect relevant research
                  materials.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4">
                <Brain className="h-5 w-5 text-primary" />

                <h3 className="mt-3 text-sm font-medium text-foreground">
                  Analysis
                </h3>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Transform information into
                  structured knowledge.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4">
                <Lightbulb className="h-5 w-5 text-primary" />

                <h3 className="mt-3 text-sm font-medium text-foreground">
                  Insights
                </h3>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Discover key findings and
                  opportunities.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ==============================================
          RESEARCH RESULT
      ============================================== */}

      {!isResearching && result ? (
        <>
          {/* ============================================
              TABS
          ============================================ */}

          <div className="overflow-x-auto border-b border-border">
            <div className="flex min-w-max px-5 sm:px-6">
              {tabs.map((tab) => {
                const Icon =
                  tab.icon;

                const isActive =
                  activeTab ===
                  tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(
                        tab.id
                      );
                    }}
                    className={joinClasses(
                      "relative",
                      "inline-flex",
                      "items-center",
                      "gap-2",
                      "px-4",
                      "py-3.5",
                      "text-sm",
                      "font-medium",
                      "transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />

                    {tab.label}

                    {typeof tab.count ===
                    "number" ? (
                      <span
                        className={joinClasses(
                          "rounded-full",
                          "px-1.5",
                          "py-0.5",
                          "text-[10px]",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    ) : null}

                    {isActive ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ============================================
              CONTENT
          ============================================ */}

          <div className="flex-1 p-5 sm:p-6">
            {/* ==========================================
                OVERVIEW
            ========================================== */}

            {activeTab ===
            "overview" ? (
              <div className="mx-auto max-w-4xl">
                <div className="rounded-xl border border-border bg-muted/[0.15] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Search className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Research topic
                      </span>

                      <h2 className="mt-1 text-lg font-semibold text-foreground">
                        {result.query}
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />

                    <h2 className="text-base font-semibold text-foreground">
                      Research summary
                    </h2>
                  </div>

                  <div className="mt-3 rounded-xl border border-border p-5">
                    {result.summary ? (
                      <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                        {result.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No summary was returned
                        for this research session.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border p-4">
                    <Globe2 className="h-5 w-5 text-primary" />

                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {sourceCount}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Sources collected
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <Lightbulb className="h-5 w-5 text-primary" />

                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {insightCount}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Insights generated
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <Clipboard className="h-5 w-5 text-primary" />

                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {notes.trim()
                        ? "1"
                        : "0"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Research notes
                    </p>
                  </div>
                </div>

                {result.insights.length >
                0 ? (
                  <div className="mt-8">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />

                        <h2 className="text-base font-semibold text-foreground">
                          Key insights
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(
                            "insights"
                          );
                        }}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View all
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {result.insights
                        .slice(0, 3)
                        .map(
                          (
                            insight
                          ) => (
                            <article
                              key={
                                insight.id
                              }
                              className="rounded-xl border border-border p-4"
                            >
                              <h3 className="text-sm font-semibold text-foreground">
                                {
                                  insight.title
                                }
                              </h3>

                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {
                                  insight.content
                                }
                              </p>
                            </article>
                          )
                        )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ==========================================
                SOURCES
            ========================================== */}

            {activeTab ===
            "sources" ? (
              <div className="mx-auto max-w-4xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Research sources
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Sources collected during
                      this research session.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleAddSource
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                    Add source
                  </button>
                </div>

                {result.sources.length ===
                0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
                    <Link2 className="mx-auto h-6 w-6 text-muted-foreground" />

                    <p className="mt-3 text-sm font-medium text-foreground">
                      No sources yet
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Add research sources
                      manually or run another
                      research session.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {result.sources.map(
                      (source) => {
                        const domain =
                          source.domain ??
                          getDomainFromUrl(
                            source.url
                          );

                        return (
                          <article
                            key={
                              source.id
                            }
                            className="group rounded-xl border border-border p-4 transition-colors hover:bg-muted/[0.2]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <Globe2 className="h-5 w-5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="truncate text-sm font-semibold text-foreground">
                                      {
                                        source.title
                                      }
                                    </h3>

                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        {getSourceTypeLabel(
                                          source.type
                                        )}
                                      </span>

                                      {domain ? (
                                        <span className="text-xs text-muted-foreground">
                                          {
                                            domain
                                          }
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteSource(
                                        source.id
                                      );
                                    }}
                                    className="opacity-0 text-muted-foreground transition-opacity hover:text-destructive group-hover:opacity-100"
                                    aria-label="Delete source"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                {source.description ? (
                                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                    {
                                      source.description
                                    }
                                  </p>
                                ) : null}

                                {source.url ? (
                                  <a
                                    href={
                                      source.url
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                  >
                                    Open source
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* ==========================================
                INSIGHTS
            ========================================== */}

            {activeTab ===
            "insights" ? (
              <div className="mx-auto max-w-4xl">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Research insights
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Important findings generated
                    from your research.
                  </p>
                </div>

                {result.insights.length ===
                0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
                    <Lightbulb className="mx-auto h-6 w-6 text-muted-foreground" />

                    <p className="mt-3 text-sm font-medium text-foreground">
                      No insights available
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Run research to generate
                      structured insights.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4">
                    {result.insights.map(
                      (insight, index) => (
                        <article
                          key={
                            insight.id
                          }
                          className="rounded-xl border border-border p-5"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                              {index + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <h3 className="text-sm font-semibold text-foreground">
                                  {
                                    insight.title
                                  }
                                </h3>

                                {typeof insight.confidence ===
                                "number" ? (
                                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                                    {Math.round(
                                      insight.confidence *
                                        100
                                    )}
                                    % confidence
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                                {
                                  insight.content
                                }
                              </p>
                            </div>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* ==========================================
                NOTES
            ========================================== */}

            {activeTab ===
            "notes" ? (
              <div className="mx-auto max-w-4xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Research notes
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Capture your own conclusions,
                      ideas, and next steps.
                    </p>
                  </div>

                  {onSaveNotes ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveNotes();
                      }}
                      disabled={
                        isSavingNotes
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isSavingNotes ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Save notes
                        </>
                      )}
                    </button>
                  ) : null}
                </div>

                <textarea
                  value={notes}
                  onChange={(event) => {
                    setNotes(
                      event.target.value
                    );
                  }}
                  placeholder="Write your research notes, conclusions, hypotheses, and next steps..."
                  rows={18}
                  className="mt-6 w-full resize-y rounded-xl border border-border bg-background p-4 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />

                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    Research notes are specific
                    to this workspace.
                  </span>

                  <span>
                    {notes.length} characters
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}