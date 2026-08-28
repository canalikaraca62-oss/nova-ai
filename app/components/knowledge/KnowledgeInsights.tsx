"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Layers3,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";

export type KnowledgeInsightStatus =
  | "ready"
  | "processing"
  | "queued"
  | "error"
  | "draft";

export type KnowledgeInsightItem = {
  id: string;
  title?: string | null;
  status?: string | null;
  size?: number | null;
  chunkCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type KnowledgeInsightsProps = {
  items?: KnowledgeInsightItem[];

  title?: string;
  description?: string;

  className?: string;

  showStatusBreakdown?: boolean;
  showStorage?: boolean;
  showChunks?: boolean;
  showActivity?: boolean;
};

type NormalizedStatus =
  | "ready"
  | "processing"
  | "queued"
  | "error"
  | "draft";

type StatusSummary = {
  ready: number;
  processing: number;
  queued: number;
  error: number;
  draft: number;
};

function normalizeStatus(
  value?: string | null
): NormalizedStatus {
  switch (
    value
      ?.trim()
      .toLowerCase()
  ) {
    case "ready":
    case "completed":
    case "complete":
    case "active":
    case "indexed":
      return "ready";

    case "processing":
    case "indexing":
    case "embedding":
      return "processing";

    case "queued":
    case "pending":
    case "waiting":
      return "queued";

    case "error":
    case "failed":
    case "failure":
      return "error";

    default:
      return "draft";
  }
}

function formatBytes(
  value: number
) {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(value) /
        Math.log(1024)
    ),
    units.length - 1
  );

  const size =
    value /
    1024 ** index;

  return `${size.toFixed(
    size >= 10 || index === 0
      ? 0
      : 1
  )} ${units[index]}`;
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat().format(
    value
  );
}

function getStatusConfig(
  status: NormalizedStatus
) {
  switch (status) {
    case "ready":
      return {
        label: "Ready",
        icon: CheckCircle2,
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };

    case "processing":
      return {
        label: "Processing",
        icon: Loader2,
        className:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };

    case "queued":
      return {
        label: "Queued",
        icon: Clock3,
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };

    case "error":
      return {
        label: "Error",
        icon: XCircle,
        className:
          "border-destructive/20 bg-destructive/10 text-destructive",
      };

    default:
      return {
        label: "Draft",
        icon: FileText,
        className:
          "border-white/10 bg-muted/50 text-muted-foreground",
      };
  }
}

export default function KnowledgeInsights({
  items = [],
  title = "Knowledge insights",
  description = "Overview of your knowledge base and indexing status.",
  className = "",
  showStatusBreakdown = true,
  showStorage = true,
  showChunks = true,
  showActivity = true,
}: KnowledgeInsightsProps) {
  const insights = useMemo(() => {
    const statuses: StatusSummary = {
      ready: 0,
      processing: 0,
      queued: 0,
      error: 0,
      draft: 0,
    };

    let totalSize = 0;
    let totalChunks = 0;

    let latestActivity:
      | KnowledgeInsightItem
      | null = null;

    let latestTimestamp = 0;

    for (const item of items) {
      const status =
        normalizeStatus(
          item.status
        );

      statuses[status] += 1;

      if (
        typeof item.size ===
          "number" &&
        Number.isFinite(item.size) &&
        item.size > 0
      ) {
        totalSize +=
          item.size;
      }

      if (
        typeof item.chunkCount ===
          "number" &&
        Number.isFinite(
          item.chunkCount
        ) &&
        item.chunkCount > 0
      ) {
        totalChunks +=
          item.chunkCount;
      }

      const dateValue =
        item.updatedAt ??
        item.createdAt;

      if (!dateValue) {
        continue;
      }

      const timestamp =
        new Date(
          dateValue
        ).getTime();

      if (
        !Number.isFinite(
          timestamp
        )
      ) {
        continue;
      }

      if (
        timestamp >
        latestTimestamp
      ) {
        latestTimestamp =
          timestamp;

        latestActivity =
          item;
      }
    }

    const totalDocuments =
      items.length;

    const activeDocuments =
      statuses.ready +
      statuses.processing +
      statuses.queued;

    const successRate =
      totalDocuments > 0
        ? Math.round(
            (statuses.ready /
              totalDocuments) *
              100
          )
        : 0;

    const averageChunks =
      totalDocuments > 0
        ? totalChunks /
          totalDocuments
        : 0;

    return {
      statuses,
      totalSize,
      totalChunks,
      totalDocuments,
      activeDocuments,
      successRate,
      averageChunks,
      latestActivity,
    };
  }, [items]);

  const statusEntries = [
    "ready",
    "processing",
    "queued",
    "error",
    "draft",
  ] as const;

  return (
    <section
      className={[
        "w-full rounded-2xl border border-white/10",
        "bg-background p-5",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>

            <div>
              <h2 className="text-sm font-semibold">
                {title}
              </h2>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-muted/30 px-3 py-2 text-xs">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />

          <span className="text-muted-foreground">
            Total
          </span>

          <span className="font-semibold">
            {formatNumber(
              insights.totalDocuments
            )}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InsightMetric
          icon={FileText}
          label="Documents"
          value={formatNumber(
            insights.totalDocuments
          )}
          description={`${formatNumber(
            insights.activeDocuments
          )} active`}
        />

        {showChunks ? (
          <InsightMetric
            icon={Layers3}
            label="Knowledge chunks"
            value={formatNumber(
              insights.totalChunks
            )}
            description={
              insights.totalDocuments > 0
                ? `${insights.averageChunks.toFixed(
                    1
                  )} avg / document`
                : "No chunks yet"
            }
          />
        ) : null}

        {showStorage ? (
          <InsightMetric
            icon={Database}
            label="Storage"
            value={formatBytes(
              insights.totalSize
            )}
            description="Indexed source data"
          />
        ) : null}

        <InsightMetric
          icon={
            insights.statuses.error >
            0
              ? AlertCircle
              : BarChart3
          }
          label="Success rate"
          value={`${insights.successRate}%`}
          description={
            insights.statuses.error >
            0
              ? `${formatNumber(
                  insights.statuses.error
                )} issue${
                  insights.statuses.error ===
                  1
                    ? ""
                    : "s"
                } detected`
              : "Knowledge base healthy"
          }
        />
      </div>

      {showStatusBreakdown ? (
        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-semibold">
              Processing status
            </h3>

            <span className="text-[11px] text-muted-foreground">
              {formatNumber(
                insights.totalDocuments
              )} total documents
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {statusEntries.map(
              (status) => {
                const config =
                  getStatusConfig(
                    status
                  );

                const Icon =
                  config.icon;

                const count =
                  insights.statuses[
                    status
                  ];

                const percentage =
                  insights.totalDocuments >
                  0
                    ? Math.round(
                        (count /
                          insights.totalDocuments) *
                          100
                      )
                    : 0;

                return (
                  <div
                    key={status}
                    className="rounded-xl border border-white/10 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={[
                          "flex h-7 w-7 items-center justify-center rounded-lg border",
                          config.className,
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-3.5 w-3.5",
                            status ===
                            "processing"
                              ? "animate-spin"
                              : "",
                          ].join(" ")}
                        />
                      </div>

                      <span className="text-sm font-semibold">
                        {formatNumber(
                          count
                        )}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-[11px] font-medium">
                        {config.label}
                      </p>

                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {percentage}% of
                        knowledge base
                      </p>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      ) : null}

      {showActivity ? (
        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-muted/30">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium">
                Latest knowledge activity
              </p>

              {insights.latestActivity ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {insights.latestActivity
                    .title ||
                    "Untitled knowledge"}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  No knowledge activity yet
                </p>
              )}
            </div>

            {insights.latestActivity ? (
              <div
                className={[
                  "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1",
                  "text-[10px] font-medium",
                  getStatusConfig(
                    normalizeStatus(
                      insights
                        .latestActivity
                        .status
                    )
                  ).className,
                ].join(" ")}
              >
                {getStatusConfig(
                  normalizeStatus(
                    insights
                      .latestActivity
                      .status
                  )
                ).label}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type InsightMetricProps = {
  icon: typeof FileText;
  label: string;
  value: string;
  description: string;
};

function InsightMetric({
  icon: Icon,
  label,
  value,
  description,
}: InsightMetricProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-background">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xl font-semibold tracking-tight">
          {value}
        </p>

        <p className="mt-1 text-xs font-medium">
          {label}
        </p>

        <p className="mt-1 text-[10px] text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export {
  formatBytes,
  formatNumber,
  getStatusConfig,
  normalizeStatus,
};