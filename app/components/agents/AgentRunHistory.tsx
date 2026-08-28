"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Terminal,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "canceled"
  | "pending"
  | string;

export interface AgentRun {
  id: string;

  status: AgentRunStatus;

  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;

  duration_ms?: number | null;

  input?: string | null;
  output?: string | null;
  error?: string | null;

  model?: string | null;

  tokens_used?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;

  cost?: number | null;

  trigger?: string | null;

  metadata?: Record<string, unknown> | null;
}

interface AgentRunHistoryProps {
  runs?: AgentRun[];

  isLoading?: boolean;
  isRefreshing?: boolean;

  title?: string;
  description?: string;

  pageSize?: number;

  showSearch?: boolean;
  showFilters?: boolean;
  showPagination?: boolean;

  emptyMessage?: string;

  onRefresh?: () => void | Promise<void>;

  onRunAgain?: (
    run: AgentRun,
  ) => void | Promise<void>;

  onOpenRun?: (
    run: AgentRun,
  ) => void;

  className?: string;
}

type StatusFilter =
  | "all"
  | "completed"
  | "running"
  | "failed"
  | "queued";

function normalizeStatus(
  status?: AgentRunStatus | null,
) {
  const value = String(
    status ?? "queued",
  )
    .trim()
    .toLowerCase();

  if (value === "canceled") {
    return "cancelled";
  }

  if (value === "pending") {
    return "queued";
  }

  return value;
}

function getStatusConfig(
  status?: AgentRunStatus | null,
) {
  const normalized =
    normalizeStatus(status);

  switch (normalized) {
    case "completed":
      return {
        label: "Completed",
        icon: CheckCircle2,
        dot: "bg-emerald-400",
        badge:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      };

    case "running":
      return {
        label: "Running",
        icon: Loader2,
        dot: "bg-blue-400",
        badge:
          "border-blue-500/20 bg-blue-500/10 text-blue-300",
      };

    case "failed":
      return {
        label: "Failed",
        icon: XCircle,
        dot: "bg-red-400",
        badge:
          "border-red-500/20 bg-red-500/10 text-red-300",
      };

    case "cancelled":
      return {
        label: "Cancelled",
        icon: AlertCircle,
        dot: "bg-zinc-500",
        badge:
          "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
      };

    case "queued":
    default:
      return {
        label: "Queued",
        icon: Clock3,
        dot: "bg-amber-400",
        badge:
          "border-amber-500/20 bg-amber-500/10 text-amber-300",
      };
  }
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const minutes = Math.floor(
    difference / 1000 / 60,
  );

  const hours = Math.floor(
    difference / 1000 / 60 / 60,
  );

  const days = Math.floor(
    difference / 1000 / 60 / 60 / 24,
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !==
        now.getFullYear()
          ? "numeric"
          : undefined,
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatDuration(
  duration?: number | null,
  run?: AgentRun,
) {
  let milliseconds =
    duration ?? 0;

  if (
    !milliseconds &&
    run?.started_at &&
    run?.completed_at
  ) {
    const start = new Date(
      run.started_at,
    ).getTime();

    const end = new Date(
      run.completed_at,
    ).getTime();

    if (
      !Number.isNaN(start) &&
      !Number.isNaN(end)
    ) {
      milliseconds = end - start;
    }
  }

  if (!milliseconds || milliseconds < 0) {
    return "—";
  }

  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds =
    milliseconds / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(
      seconds >= 10 ? 1 : 2,
    )}s`;
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function formatNumber(
  value?: number | null,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en",
    {
      notation:
        value >= 10000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(value);
}

function formatCost(
  value?: number | null,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (value < 0.01 && value > 0) {
    return `<$0.01`;
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    },
  ).format(value);
}

function getRunDate(
  run: AgentRun,
) {
  return (
    run.created_at ??
    run.started_at ??
    run.completed_at ??
    ""
  );
}

export default function AgentRunHistory({
  runs = [],

  isLoading = false,
  isRefreshing = false,

  title = "Run history",
  description =
    "Review previous agent executions, outputs, performance, and failures.",

  pageSize = 10,

  showSearch = true,
  showFilters = true,
  showPagination = true,

  emptyMessage =
    "This agent has not been run yet.",

  onRefresh,
  onRunAgain,
  onOpenRun,

  className = "",
}: AgentRunHistoryProps) {
  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [expandedRunId, setExpandedRunId] =
    useState<string | null>(null);

  const [copiedRunId, setCopiedRunId] =
    useState<string | null>(null);

  const safePageSize =
    Math.max(1, pageSize);

  const filteredRuns = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return [...runs]
      .filter((run) => {
        const status =
          normalizeStatus(run.status);

        if (
          statusFilter !== "all" &&
          status !== statusFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchableValues = [
          run.id,
          run.input,
          run.output,
          run.error,
          run.model,
          run.trigger,
          status,
        ];

        return searchableValues.some(
          (value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(query),
        );
      })
      .sort((a, b) => {
        const aDate = new Date(
          getRunDate(a),
        ).getTime();

        const bDate = new Date(
          getRunDate(b),
        ).getTime();

        return (
          (Number.isNaN(bDate)
            ? 0
            : bDate) -
          (Number.isNaN(aDate)
            ? 0
            : aDate)
        );
      });
  }, [
    runs,
    search,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRuns.length /
        safePageSize,
    ),
  );

  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(
        Math.max(page, 1),
        totalPages,
      ),
    );
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
  ]);

  useEffect(() => {
    if (!copiedRunId) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        setCopiedRunId(null);
      }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copiedRunId]);

  const paginatedRuns = useMemo(() => {
    const start =
      (currentPage - 1) *
      safePageSize;

    return filteredRuns.slice(
      start,
      start + safePageSize,
    );
  }, [
    filteredRuns,
    currentPage,
    safePageSize,
  ]);

  const stats = useMemo(() => {
    return runs.reduce(
      (result, run) => {
        const status =
          normalizeStatus(run.status);

        result.total += 1;

        if (status === "completed") {
          result.completed += 1;
        }

        if (status === "failed") {
          result.failed += 1;
        }

        if (status === "running") {
          result.running += 1;
        }

        return result;
      },
      {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
      },
    );
  }, [runs]);

  const handleCopyRunId = async (
    runId: string,
  ) => {
    try {
      await navigator.clipboard.writeText(
        runId,
      );

      setCopiedRunId(runId);
    } catch {
      setCopiedRunId(null);
    }
  };

  const toggleExpanded = (
    runId: string,
  ) => {
    setExpandedRunId((current) =>
      current === runId
        ? null
        : runId,
    );
  };

  return (
    <section
      className={[
        "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                  <Terminal className="h-5 w-5 text-violet-300" />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-white">
                    {title}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
                <div className="px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-white">
                    {stats.total}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Total
                  </div>
                </div>

                <div className="border-l border-white/[0.06] px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-emerald-300">
                    {stats.completed}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Success
                  </div>
                </div>

                <div className="border-l border-white/[0.06] px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-red-300">
                    {stats.failed}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Failed
                  </div>
                </div>
              </div>

              {onRefresh ? (
                <button
                  type="button"
                  onClick={() => {
                    void onRefresh();
                  }}
                  disabled={
                    isRefreshing ||
                    isLoading
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Refresh run history"
                >
                  <RefreshCw
                    className={[
                      "h-4 w-4",
                      isRefreshing
                        ? "animate-spin"
                        : "",
                    ].join(" ")}
                  />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {showSearch || showFilters ? (
          <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-white/[0.015] px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            {showSearch ? (
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search runs, outputs, errors..."
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/20 pl-10 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>
            ) : (
              <div />
            )}

            {showFilters ? (
              <div className="flex items-center gap-2 overflow-x-auto">
                <div className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 text-zinc-500">
                  <Filter className="h-4 w-4" />

                  <span className="hidden text-xs font-medium sm:inline">
                    Status
                  </span>
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target
                        .value as StatusFilter,
                    )
                  }
                  className="h-11 rounded-xl border border-white/[0.07] bg-zinc-950 px-3 text-sm text-zinc-300 outline-none transition focus:border-violet-500/40"
                >
                  <option value="all">
                    All runs
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="running">
                    Running
                  </option>

                  <option value="failed">
                    Failed
                  </option>

                  <option value="queued">
                    Queued
                  </option>
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="h-4 w-40 rounded bg-white/[0.07]" />

                  <div className="h-7 w-20 rounded-full bg-white/[0.05]" />
                </div>

                <div className="mt-4 h-3 w-2/3 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : paginatedRuns.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.07] bg-white/[0.025]">
              <Sparkles className="h-7 w-7 text-violet-300" />
            </div>

            <h3 className="mt-5 text-base font-semibold text-white">
              No runs found
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
              {search ||
              statusFilter !== "all"
                ? "Try changing your search or filter criteria."
                : emptyMessage}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {paginatedRuns.map((run) => {
              const status =
                getStatusConfig(run.status);

              const StatusIcon =
                status.icon;

              const isExpanded =
                expandedRunId === run.id;

              const createdAt =
                getRunDate(run);

              const totalTokens =
                run.tokens_used ??
                ((run.input_tokens ?? 0) +
                  (run.output_tokens ?? 0));

              return (
                <article
                  key={run.id}
                  className="group transition hover:bg-white/[0.012]"
                >
                  <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center">
                    <button
                      type="button"
                      onClick={() =>
                        toggleExpanded(
                          run.id,
                        )
                      }
                      className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    >
                      <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                        <StatusIcon
                          className={[
                            "h-4.5 w-4.5",
                            normalizeStatus(
                              run.status,
                            ) === "running"
                              ? "animate-spin text-blue-300"
                              : "",
                          ].join(" ")}
                        />

                        <span
                          className={[
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950",
                            status.dot,
                          ].join(" ")}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium text-zinc-200">
                            {run.id.length > 20
                              ? `${run.id.slice(
                                  0,
                                  12,
                                )}…${run.id.slice(
                                  -6,
                                )}`
                              : run.id}
                          </span>

                          <span
                            className={[
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              status.badge,
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "h-1.5 w-1.5 rounded-full",
                                status.dot,
                              ].join(" ")}
                            />

                            {status.label}
                          </span>

                          {run.trigger ? (
                            <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                              {run.trigger}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
                          <span>
                            {formatDate(
                              createdAt,
                            )}
                          </span>

                          {run.model ? (
                            <span>
                              {run.model}
                            </span>
                          ) : null}

                          <span>
                            Duration:{" "}
                            {formatDuration(
                              run.duration_ms,
                              run,
                            )}
                          </span>

                          {totalTokens > 0 ? (
                            <span>
                              {formatNumber(
                                totalTokens,
                              )}{" "}
                              tokens
                            </span>
                          ) : null}
                        </div>

                        {run.input ? (
                          <p className="mt-2 line-clamp-1 text-sm text-zinc-500">
                            {run.input}
                          </p>
                        ) : run.error ? (
                          <p className="mt-2 line-clamp-1 text-sm text-red-300/70">
                            {run.error}
                          </p>
                        ) : null}
                      </div>

                      <ChevronDown
                        className={[
                          "mt-3 h-4 w-4 shrink-0 text-zinc-600 transition-transform",
                          isExpanded
                            ? "rotate-180"
                            : "",
                        ].join(" ")}
                      />
                    </button>

                    <div className="flex items-center gap-2 lg:justify-end">
                      {onRunAgain ? (
                        <button
                          type="button"
                          onClick={() => {
                            void onRunAgain(run);
                          }}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />

                          <span className="hidden sm:inline">
                            Run again
                          </span>
                        </button>
                      ) : null}

                      {onOpenRun ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenRun(run)
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
                          aria-label="Open run"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-white/[0.05] bg-black/[0.16] px-5 py-5 sm:px-6">
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-5">
                          {run.input ? (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                                Input
                              </p>

                              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/[0.06] bg-zinc-950 p-4 text-xs leading-6 text-zinc-400">
                                {run.input}
                              </pre>
                            </div>
                          ) : null}

                          {run.output ? (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                                Output
                              </p>

                              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-emerald-500/[0.08] bg-emerald-500/[0.025] p-4 text-xs leading-6 text-zinc-300">
                                {run.output}
                              </pre>
                            </div>
                          ) : null}

                          {run.error ? (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-400/70">
                                Error
                              </p>

                              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-4 text-xs leading-6 text-red-200/80">
                                {run.error}
                              </pre>
                            </div>
                          ) : null}

                          {run.metadata &&
                          Object.keys(
                            run.metadata,
                          ).length > 0 ? (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                                Metadata
                              </p>

                              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/[0.06] bg-zinc-950 p-4 text-xs leading-6 text-zinc-500">
                                {JSON.stringify(
                                  run.metadata,
                                  null,
                                  2,
                                )}
                              </pre>
                            </div>
                          ) : null}
                        </div>

                        <aside className="h-fit rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-200">
                              Execution details
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                void handleCopyRunId(
                                  run.id,
                                );
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-black/20 text-zinc-500 transition hover:text-white"
                              aria-label="Copy run ID"
                            >
                              {copiedRunId ===
                              run.id ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-zinc-600">
                                Run ID
                              </span>

                              <span className="max-w-[180px] truncate font-mono text-zinc-400">
                                {run.id}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-zinc-600">
                                Status
                              </span>

                              <span className="text-zinc-300">
                                {
                                  status.label
                                }
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-zinc-600">
                                Duration
                              </span>

                              <span className="text-zinc-300">
                                {formatDuration(
                                  run.duration_ms,
                                  run,
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-zinc-600">
                                Tokens
                              </span>

                              <span className="text-zinc-300">
                                {formatNumber(
                                  totalTokens,
                                )}
                              </span>
                            </div>

                            {run.cost !== null &&
                            run.cost !==
                              undefined ? (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-zinc-600">
                                  Cost
                                </span>

                                <span className="text-zinc-300">
                                  {formatCost(
                                    run.cost,
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {run.input_tokens !==
                            null &&
                            run.input_tokens !==
                              undefined ? (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-zinc-600">
                                  Input tokens
                                </span>

                                <span className="text-zinc-300">
                                  {formatNumber(
                                    run.input_tokens,
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {run.output_tokens !==
                            null &&
                            run.output_tokens !==
                              undefined ? (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-zinc-600">
                                  Output tokens
                                </span>

                                <span className="text-zinc-300">
                                  {formatNumber(
                                    run.output_tokens,
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {run.started_at ? (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-zinc-600">
                                  Started
                                </span>

                                <span className="text-zinc-300">
                                  {formatDate(
                                    run.started_at,
                                  )}
                                </span>
                              </div>
                            ) : null}

                            {run.completed_at ? (
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <span className="text-zinc-600">
                                  Completed
                                </span>

                                <span className="text-zinc-300">
                                  {formatDate(
                                    run.completed_at,
                                  )}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </aside>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {showPagination &&
        filteredRuns.length >
          safePageSize ? (
          <div className="flex flex-col gap-4 border-t border-white/[0.06] bg-white/[0.015] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-zinc-600">
              Showing{" "}
              {Math.min(
                (currentPage - 1) *
                  safePageSize +
                  1,
                filteredRuns.length,
              )}
              –
              {Math.min(
                currentPage *
                  safePageSize,
                filteredRuns.length,
              )}{" "}
              of{" "}
              {filteredRuns.length} runs
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1,
                      ),
                  )
                }
                disabled={
                  currentPage === 1
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="min-w-20 text-center text-xs text-zinc-500">
                Page {currentPage} of{" "}
                {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page + 1,
                      ),
                  )
                }
                disabled={
                  currentPage ===
                  totalPages
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-zinc-500 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}