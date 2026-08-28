"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "canceled"
  | "idle"
  | string;

export type AgentExecutionData = {
  id: string;

  agentId?: string | null;
  agentName?: string | null;

  status?: ExecutionStatus | null;

  input?: unknown;
  output?: unknown;
  error?: string | null;

  model?: string | null;
  provider?: string | null;

  progress?: number | null;

  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;

  duration?: number | null;
  durationMs?: number | null;

  tokensUsed?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;

  metadata?: Record<
    string,
    unknown
  > | null;
};

export type AgentExecutionProps = {
  execution: AgentExecutionData;

  compact?: boolean;
  defaultExpanded?: boolean;

  onCancel?: (
    execution: AgentExecutionData
  ) => void;

  onRetry?: (
    execution: AgentExecutionData
  ) => void;

  onViewDetails?: (
    execution: AgentExecutionData
  ) => void;
};

const STATUS_CONFIG = {
  queued: {
    label: "Queued",
    dot: "bg-amber-400",
    badge:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },

  running: {
    label: "Running",
    dot: "bg-violet-400 animate-pulse",
    badge:
      "border-violet-500/20 bg-violet-500/10 text-violet-300",
  },

  completed: {
    label: "Completed",
    dot: "bg-emerald-400",
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },

  failed: {
    label: "Failed",
    dot: "bg-red-400",
    badge:
      "border-red-500/20 bg-red-500/10 text-red-300",
  },

  cancelled: {
    label: "Cancelled",
    dot: "bg-zinc-500",
    badge:
      "border-white/10 bg-white/[0.04] text-zinc-400",
  },

  idle: {
    label: "Idle",
    dot: "bg-blue-400",
    badge:
      "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
};

function normalizeStatus(
  status?: string | null
): keyof typeof STATUS_CONFIG {
  const value =
    status?.trim().toLowerCase();

  if (value === "canceled") {
    return "cancelled";
  }

  if (
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "idle"
  ) {
    return value;
  }

  return "idle";
}

function formatDate(
  value?: string | Date | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDuration(
  value?: number | null
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return "—";
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }

  const seconds = value / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(
      seconds < 10 ? 1 : 0
    )}s`;
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function safeStringify(
  value: unknown
) {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    value === null ||
    value === undefined
  ) {
    return "No data";
  }

  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(value);
  }
}

function formatNumber(
  value?: number | null
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString();
}

export default function AgentExecution({
  execution,
  compact = false,
  defaultExpanded = false,
  onCancel,
  onRetry,
  onViewDetails,
}: AgentExecutionProps) {
  const [
    expanded,
    setExpanded,
  ] = useState(defaultExpanded);

  const [
    elapsed,
    setElapsed,
  ] = useState<number | null>(
    null
  );

  const statusKey =
    normalizeStatus(
      execution.status
    );

  const status =
    STATUS_CONFIG[statusKey];

  const isRunning =
    statusKey === "running";

  const canCancel =
    statusKey === "running" ||
    statusKey === "queued";

  const canRetry =
    statusKey === "failed" ||
    statusKey === "cancelled";

  const progress = useMemo(() => {
    if (
      typeof execution.progress !==
      "number"
    ) {
      if (
        statusKey === "completed"
      ) {
        return 100;
      }

      if (
        statusKey === "queued"
      ) {
        return 0;
      }

      return null;
    }

    return Math.max(
      0,
      Math.min(
        100,
        execution.progress
      )
    );
  }, [
    execution.progress,
    statusKey,
  ]);

  const baseDuration =
    execution.durationMs ??
    execution.duration ??
    null;

  useEffect(() => {
    if (!isRunning) {
      setElapsed(baseDuration);
      return;
    }

    const startedAt =
      execution.startedAt
        ? new Date(
            execution.startedAt
          ).getTime()
        : Date.now();

    const updateElapsed = () => {
      const value =
        Math.max(
          0,
          Date.now() - startedAt
        );

      setElapsed(value);
    };

    updateElapsed();

    const interval =
      window.setInterval(
        updateElapsed,
        1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    isRunning,
    execution.startedAt,
    baseDuration,
  ]);

  const inputValue =
    safeStringify(
      execution.input
    );

  const outputValue =
    safeStringify(
      execution.output
    );

  const totalTokens =
    execution.tokensUsed ??
    (
      (execution.inputTokens ?? 0) +
      (execution.outputTokens ?? 0)
    );

  const metadataEntries =
    Object.entries(
      execution.metadata ?? {}
    );

  return (
    <article
      className={[
        "relative overflow-hidden rounded-2xl border",
        "border-white/[0.08]",
        "bg-[#0b0d12]/90",
        "backdrop-blur-xl",
        "transition-all duration-300",
        expanded
          ? "shadow-2xl shadow-black/30"
          : "hover:border-white/[0.14]",
      ].join(" ")}
    >
      {/* Premium glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.10),transparent_38%)]" />

      {isRunning && (
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="h-full w-1/3 animate-[pulse_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
        </div>
      )}

      <div
        className={[
          "relative",
          compact
            ? "p-4"
            : "p-5",
        ].join(" ")}
      >
        {/* HEADER */}
        <div className="flex items-start gap-4">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
              status.badge,
            ].join(" ")}
          >
            {statusKey ===
              "completed" && (
              <span className="text-lg">
                ✓
              </span>
            )}

            {statusKey ===
              "failed" && (
              <span className="text-lg">
                !
              </span>
            )}

            {isRunning && (
              <span className="text-sm">
                ◌
              </span>
            )}

            {statusKey ===
              "queued" && (
              <span className="text-sm">
                ◷
              </span>
            )}

            {statusKey ===
              "cancelled" && (
              <span className="text-sm">
                ×
              </span>
            )}

            {statusKey ===
              "idle" && (
              <span className="text-sm">
                ◇
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">
                  {execution.agentName ??
                    "Agent Execution"}
                </h3>

                <p className="mt-1 truncate font-mono text-xs text-zinc-600">
                  {execution.id}
                </p>
              </div>

              <span
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
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
            </div>

            {(execution.model ||
              execution.provider) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {execution.provider && (
                  <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] text-zinc-400">
                    {execution.provider}
                  </span>
                )}

                {execution.model && (
                  <span className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] text-zinc-400">
                    {execution.model}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PROGRESS */}
        {progress !== null && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-medium text-zinc-500">
                Execution progress
              </span>

              <span className="font-semibold text-zinc-300">
                {Math.round(progress)}%
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={[
                  "h-full rounded-full transition-all duration-500",
                  statusKey ===
                  "failed"
                    ? "bg-red-400"
                    : statusKey ===
                      "completed"
                    ? "bg-emerald-400"
                    : "bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-400",
                ].join(" ")}
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* STATS */}
        {!compact && (
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.07] bg-black/10 sm:grid-cols-4">
            <div className="border-b border-white/[0.07] px-3 py-3 sm:border-b-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Duration
              </p>

              <p className="mt-1 text-sm font-semibold text-zinc-200">
                {formatDuration(
                  elapsed ??
                    baseDuration
                )}
              </p>
            </div>

            <div className="border-b border-l border-white/[0.07] px-3 py-3 sm:border-b-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Tokens
              </p>

              <p className="mt-1 text-sm font-semibold text-zinc-200">
                {formatNumber(
                  totalTokens
                )}
              </p>
            </div>

            <div className="border-white/[0.07] px-3 py-3 sm:border-l">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Started
              </p>

              <p className="mt-1 truncate text-xs font-medium text-zinc-300">
                {formatDate(
                  execution.startedAt
                )}
              </p>
            </div>

            <div className="border-l border-white/[0.07] px-3 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Finished
              </p>

              <p className="mt-1 truncate text-xs font-medium text-zinc-300">
                {formatDate(
                  execution.completedAt ??
                    execution.updatedAt
                )}
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {execution.error && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-sm text-red-300">
                !
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-300">
                  Execution failed
                </p>

                <p className="mt-1 break-words text-xs leading-5 text-red-200/70">
                  {execution.error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EXPANDED CONTENT */}
        {expanded && !compact && (
          <div className="mt-5 space-y-4">
            <ExecutionBlock
              title="Input"
              value={inputValue}
            />

            {execution.output !==
              undefined &&
              execution.output !== null && (
              <ExecutionBlock
                title="Output"
                value={outputValue}
              />
            )}

            {metadataEntries.length >
              0 && (
              <div className="rounded-xl border border-white/[0.07] bg-black/10 p-4">
                <p className="mb-3 text-xs font-semibold text-zinc-300">
                  Metadata
                </p>

                <div className="space-y-2">
                  {metadataEntries.map(
                    ([
                      key,
                      value,
                    ]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0"
                      >
                        <span className="text-[11px] text-zinc-600">
                          {key}
                        </span>

                        <span className="max-w-[65%] break-all text-right font-mono text-[11px] text-zinc-400">
                          {safeStringify(
                            value
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTIONS */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
          <button
            type="button"
            onClick={() =>
              setExpanded(
                (value) => !value
              )
            }
            className="text-xs font-medium text-zinc-500 transition hover:text-white"
          >
            {expanded
              ? "Hide details"
              : "View details"}
          </button>

          <div className="flex items-center gap-2">
            {onViewDetails && (
              <button
                type="button"
                onClick={() =>
                  onViewDetails(
                    execution
                  )
                }
                className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white"
              >
                Open
              </button>
            )}

            {canRetry &&
              onRetry && (
                <button
                  type="button"
                  onClick={() =>
                    onRetry(
                      execution
                    )
                  }
                  className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/20"
                >
                  Retry
                </button>
              )}

            {canCancel &&
              onCancel && (
                <button
                  type="button"
                  onClick={() =>
                    onCancel(
                      execution
                    )
                  }
                  className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-500/40 hover:bg-red-500/10"
                >
                  Cancel
                </button>
              )}
          </div>
        </div>
      </div>
    </article>
  );
}

type ExecutionBlockProps = {
  title: string;
  value: string;
};

function ExecutionBlock({
  title,
  value,
}: ExecutionBlockProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <p className="text-xs font-semibold text-zinc-300">
          {title}
        </p>

        <span className="font-mono text-[10px] text-zinc-600">
          JSON / Text
        </span>
      </div>

      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-zinc-400">
        {value}
      </pre>
    </div>
  );
}

export type {
  ExecutionStatus,
};