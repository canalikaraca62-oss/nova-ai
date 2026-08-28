"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  BarChart3,
  Brain,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  FolderOpen,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type WorkspaceAnalysisStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

export type WorkspaceMetric = {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
};

export type WorkspaceAnalysis = {
  summary: string;
  score?: number;
  metrics?: WorkspaceMetric[];
  insights?: string[];
  recommendations?: string[];
  analyzedAt?: string;
};

export type AnalyzeWorkspaceProps = {
  workspaceId: string;
  workspaceName?: string;
  initialAnalysis?: WorkspaceAnalysis | null;
  onAnalyze?: (
    workspaceId: string
  ) => Promise<WorkspaceAnalysis>;
  onError?: (error: Error) => void;
  className?: string;
};

/* ==================================================
   HELPERS
================================================== */

function joinClasses(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function formatDate(
  value?: string
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function normalizeScore(
  score?: number
): number | null {
  if (
    typeof score !== "number" ||
    Number.isNaN(score)
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(score))
  );
}

/* ==================================================
   DEFAULT METRICS
================================================== */

const DEFAULT_METRICS: WorkspaceMetric[] = [
  {
    label: "Documents",
    value: "—",
    description:
      "Documents included in the workspace.",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: "Sources",
    value: "—",
    description:
      "Connected knowledge sources.",
    icon: <Database className="h-4 w-4" />,
  },
  {
    label: "Files",
    value: "—",
    description:
      "Files available for analysis.",
    icon: <FolderOpen className="h-4 w-4" />,
  },
];

/* ==================================================
   COMPONENT
================================================== */

export default function AnalyzeWorkspace({
  workspaceId,
  workspaceName = "Workspace",
  initialAnalysis = null,
  onAnalyze,
  onError,
  className = "",
}: AnalyzeWorkspaceProps) {
  const [status, setStatus] =
    useState<WorkspaceAnalysisStatus>(
      initialAnalysis
        ? "success"
        : "idle"
    );

  const [analysis, setAnalysis] =
    useState<WorkspaceAnalysis | null>(
      initialAnalysis
    );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    setAnalysis(initialAnalysis);
    setStatus(
      initialAnalysis
        ? "success"
        : "idle"
    );
    setErrorMessage(null);
  }, [initialAnalysis, workspaceId]);

  const handleAnalyze = useCallback(
    async (): Promise<void> => {
      if (!onAnalyze) {
        return;
      }

      setStatus("loading");
      setErrorMessage(null);

      try {
        const result =
          await onAnalyze(workspaceId);

        setAnalysis(result);
        setStatus("success");
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(
                "Workspace analysis failed."
              );

        setStatus("error");

        setErrorMessage(
          normalizedError.message
        );

        onError?.(normalizedError);
      }
    },
    [
      onAnalyze,
      onError,
      workspaceId,
    ]
  );

  const score =
    normalizeScore(
      analysis?.score
    );

  const metrics =
    analysis?.metrics?.length
      ? analysis.metrics
      : DEFAULT_METRICS;

  const analyzedAt =
    formatDate(
      analysis?.analyzedAt
    );

  const isLoading =
    status === "loading";

  const hasAnalysis =
    status === "success" &&
    analysis !== null;

  return (
    <section
      className={joinClasses(
        "w-full",
        "rounded-xl",
        "border",
        "border-border",
        "bg-background",
        "p-5",
        "shadow-sm",
        className
      )}
    >
      {/* ================= HEADER ================= */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-foreground">
                Analyze {workspaceName}
              </h2>

              {hasAnalysis ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : null}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Generate insights, identify patterns,
              and understand the structure of this
              workspace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleAnalyze();
          }}
          disabled={
            isLoading ||
            !onAnalyze
          }
          className={joinClasses(
            "inline-flex",
            "h-10",
            "shrink-0",
            "items-center",
            "justify-center",
            "gap-2",
            "rounded-lg",
            "bg-primary",
            "px-4",
            "text-sm",
            "font-medium",
            "text-primary-foreground",
            "transition-colors",
            "hover:bg-primary/90",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-ring",
            "focus-visible:ring-offset-2",
            "disabled:pointer-events-none",
            "disabled:opacity-50"
          )}
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : hasAnalysis ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Analyze again
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyze workspace
            </>
          )}
        </button>
      </div>

      {/* ================= ERROR ================= */}

      {status === "error" ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              Analysis failed
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {errorMessage ??
                "Something went wrong while analyzing this workspace."}
            </p>

            {onAnalyze ? (
              <button
                type="button"
                onClick={() => {
                  void handleAnalyze();
                }}
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ================= IDLE ================= */}

      {status === "idle" ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Ready to analyze
            </h3>

            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Run an analysis to generate a summary,
              workspace metrics, insights, and
              recommendations.
            </p>
          </div>
        </div>
      ) : null}

      {/* ================= LOADING ================= */}

      {isLoading ? (
        <div
          aria-live="polite"
          className="mt-6 space-y-4"
        >
          <div className="animate-pulse rounded-lg bg-muted p-4">
            <div className="h-4 w-1/3 rounded bg-muted-foreground/20" />

            <div className="mt-3 h-3 w-full rounded bg-muted-foreground/20" />

            <div className="mt-2 h-3 w-5/6 rounded bg-muted-foreground/20" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from(
              { length: 3 },
              (_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-lg border border-border p-4"
                >
                  <div className="h-4 w-1/2 rounded bg-muted" />

                  <div className="mt-4 h-7 w-1/3 rounded bg-muted" />
                </div>
              )
            )}
          </div>
        </div>
      ) : null}

      {/* ================= SUCCESS ================= */}

      {hasAnalysis ? (
        <div className="mt-6 space-y-6">
          {/* SCORE + SUMMARY */}

          <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
            {score !== null ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-border bg-muted/20 p-5">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-8 border-primary/20">
                  <span className="text-2xl font-bold text-foreground">
                    {score}
                  </span>

                  <span className="absolute bottom-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                    score
                  </span>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />

                <h3 className="text-sm font-semibold text-foreground">
                  Analysis summary
                </h3>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {analysis.summary}
              </p>

              {analyzedAt ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />

                  Analyzed {analyzedAt}
                </div>
              ) : null}
            </div>
          </div>

          {/* METRICS */}

          {metrics.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Workspace metrics
              </h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map(
                  (metric, index) => (
                    <div
                      key={`${metric.label}-${index}`}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {metric.icon ?? (
                          <BarChart3 className="h-4 w-4" />
                        )}

                        <span className="text-xs font-medium">
                          {metric.label}
                        </span>
                      </div>

                      <p className="mt-3 text-2xl font-semibold text-foreground">
                        {metric.value}
                      </p>

                      {metric.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {metric.description}
                        </p>
                      ) : null}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {/* INSIGHTS */}

          {analysis.insights &&
          analysis.insights.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Key insights
              </h3>

              <div className="mt-3 space-y-3">
                {analysis.insights.map(
                  (insight, index) => (
                    <div
                      key={`${index}-${insight}`}
                      className="flex gap-3 rounded-lg border border-border p-4"
                    >
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </div>

                      <p className="text-sm leading-6 text-muted-foreground">
                        {insight}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {/* RECOMMENDATIONS */}

          {analysis.recommendations &&
          analysis.recommendations.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Recommendations
              </h3>

              <div className="mt-3 grid gap-3">
                {analysis.recommendations.map(
                  (
                    recommendation,
                    index
                  ) => (
                    <div
                      key={`${index}-${recommendation}`}
                      className="flex items-start gap-3 rounded-lg bg-primary/5 p-4"
                    >
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                      <p className="text-sm leading-6 text-muted-foreground">
                        {recommendation}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}