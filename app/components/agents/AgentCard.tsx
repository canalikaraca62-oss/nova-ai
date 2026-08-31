"use client";

import React, { useMemo, useState } from "react";

export type AgentStatus =
  | "active"
  | "idle"
  | "running"
  | "paused"
  | "offline"
  | "error";

export type Agent = {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  status?: AgentStatus | string | null;
  model?: string | null;
  provider?: string | null;
  avatar?: string | null;
  image?: string | null;
  capabilities?: string[] | null;
  tags?: string[] | null;
  executions?: number | null;
  totalRuns?: number | null;
  successRate?: number | null;
  lastRunAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type AgentCardProps = {
  agent: Agent;

  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;

  onClick?: (agent: Agent) => void;
  onSelect?: (agent: Agent) => void;
  onRun?: (agent: Agent) => void;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  onDuplicate?: (agent: Agent) => void;
};

type StatusConfig = {
  label: string;
  dot: string;
  badge: string;
};

const STATUS_CONFIG: Record<
  AgentStatus,
  StatusConfig
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-400",
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },

  idle: {
    label: "Idle",
    dot: "bg-blue-400",
    badge:
      "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },

  running: {
    label: "Running",
    dot: "bg-violet-400 animate-pulse",
    badge:
      "border-violet-500/20 bg-violet-500/10 text-violet-300",
  },

  paused: {
    label: "Paused",
    dot: "bg-amber-400",
    badge:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },

  offline: {
    label: "Offline",
    dot: "bg-zinc-500",
    badge:
      "border-white/10 bg-white/[0.04] text-zinc-400",
  },

  error: {
    label: "Error",
    dot: "bg-red-400",
    badge:
      "border-red-500/20 bg-red-500/10 text-red-300",
  },
};

function normalizeStatus(
  status?: string | null
): AgentStatus {
  const value = status?.trim().toLowerCase();

  switch (value) {
    case "active":
      return "active";

    case "idle":
      return "idle";

    case "running":
      return "running";

    case "paused":
      return "paused";

    case "offline":
      return "offline";

    case "error":
      return "error";

    default:
      return "idle";
  }
}

function getInitials(name?: string | null): string {
  const normalizedName =
    name?.trim() ?? "";

  const words = normalizedName
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AI";
  }

  return words
    .slice(0, 2)
    .map((word) =>
      word.charAt(0).toUpperCase()
    )
    .join("");
}

function formatRelativeDate(
  value?: string | Date | null
): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const difference =
    Date.now() - date.getTime();

  if (difference < 0) {
    return date.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year:
          date.getFullYear() !==
          new Date().getFullYear()
            ? "numeric"
            : undefined,
      }
    );
  }

  const seconds = Math.floor(
    difference / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 30) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    }
  );
}

function getSafeImageSource(
  agent: Agent
): string | null {
  const source =
    agent.avatar ??
    agent.image ??
    null;

  if (
    typeof source !== "string" ||
    source.trim().length === 0
  ) {
    return null;
  }

  return source;
}

function getSafeNumber(
  value: number | null | undefined,
  fallback = 0
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return value;
}

export default function AgentCard({
  agent,
  selected = false,
  compact = false,
  disabled = false,
  onClick,
  onSelect,
  onRun,
  onEdit,
  onDelete,
  onDuplicate,
}: AgentCardProps) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [imageError, setImageError] =
    useState(false);

  const statusKey = normalizeStatus(
    agent.status
  );

  /*
   * IMPORTANT:
   * STATUS_CONFIG is Record<AgentStatus, StatusConfig>
   * and statusKey is AgentStatus.
   *
   * This guarantees a valid StatusConfig.
   * The fallback is kept as an additional
   * runtime safety layer.
   */
  const status: StatusConfig =
    STATUS_CONFIG[statusKey] ??
    STATUS_CONFIG.idle;

  const safeName =
    agent.name?.trim() ||
    "Untitled Agent";

  const safeId =
    agent.id?.trim() ||
    "unknown";

  const imageSource = useMemo(
    () => getSafeImageSource(agent),
    [
      agent.avatar,
      agent.image,
    ]
  );

  const capabilities = useMemo(() => {
    const source =
      agent.capabilities ??
      agent.tags ??
      [];

    return source
      .filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0
      )
      .map((item) => item.trim())
      .slice(0, compact ? 2 : 4);
  }, [
    agent.capabilities,
    agent.tags,
    compact,
  ]);

  const totalRuns = getSafeNumber(
    agent.executions ??
      agent.totalRuns,
    0
  );

  const successRate =
    typeof agent.successRate === "number" &&
    Number.isFinite(agent.successRate)
      ? Math.max(
          0,
          Math.min(
            100,
            agent.successRate
          )
        )
      : null;

  const secondaryLabel =
    agent.role?.trim() ||
    agent.provider?.trim() ||
    agent.model?.trim() ||
    null;

  const handleCardClick = () => {
    if (disabled) {
      return;
    }

    onSelect?.(agent);
    onClick?.(agent);
  };

  const handleAction = (
    event: React.MouseEvent,
    action?: (agent: Agent) => void
  ) => {
    event.stopPropagation();

    if (disabled) {
      return;
    }

    setMenuOpen(false);
    action?.(agent);
  };

  return (
    <article
      onClick={handleCardClick}
      className={[
        "group relative overflow-hidden rounded-2xl border",
        "bg-[#0b0d12]/90 backdrop-blur-xl",
        "transition-all duration-300",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer",
        selected
          ? "border-violet-400/60 shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_20px_70px_rgba(0,0,0,0.35)]"
          : "border-white/[0.08] hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-2xl hover:shadow-black/30",
      ].join(" ")}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.10),transparent_38%)] opacity-70" />

      {/* Selected indicator */}
      {selected ? (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
      ) : null}

      <div
        className={[
          "relative",
          compact
            ? "p-4"
            : "p-5",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 via-blue-500/10 to-cyan-400/10 text-sm font-bold text-white shadow-inner shadow-white/5">
              {imageSource &&
              !imageError ? (
                <img
                  src={imageSource}
                  alt={safeName}
                  className="h-full w-full object-cover"
                  onError={() =>
                    setImageError(true)
                  }
                />
              ) : (
                <span>
                  {getInitials(safeName)}
                </span>
              )}
            </div>

            <span
              className={[
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b0d12]",
                status.dot,
              ].join(" ")}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold tracking-tight text-white">
                  {safeName}
                </h3>

                {secondaryLabel ? (
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {secondaryLabel}
                  </p>
                ) : null}
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Agent actions"
                  aria-expanded={menuOpen}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (!disabled) {
                      setMenuOpen(
                        (value) => !value
                      );
                    }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-zinc-500 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-lg leading-none">
                    ⋯
                  </span>
                </button>

                {menuOpen ? (
                  <div
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                    className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#12151c] p-1 shadow-2xl shadow-black/50"
                  >
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={(event) =>
                          handleAction(
                            event,
                            onEdit
                          )
                        }
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Edit agent
                      </button>
                    ) : null}

                    {onDuplicate ? (
                      <button
                        type="button"
                        onClick={(event) =>
                          handleAction(
                            event,
                            onDuplicate
                          )
                        }
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Duplicate
                      </button>
                    ) : null}

                    {onDelete ? (
                      <>
                        <div className="my-1 h-px bg-white/[0.07]" />

                        <button
                          type="button"
                          onClick={(event) =>
                            handleAction(
                              event,
                              onDelete
                            )
                          }
                          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                        >
                          Delete agent
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <span
            className={[
              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
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

          {agent.model?.trim() ? (
            <span className="max-w-[50%] truncate text-[11px] font-medium text-zinc-500">
              {agent.model.trim()}
            </span>
          ) : null}
        </div>

        {/* Description */}
        {!compact &&
        agent.description?.trim() ? (
          <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-6 text-zinc-400">
            {agent.description.trim()}
          </p>
        ) : null}

        {/* Capabilities */}
        {capabilities.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {capabilities.map(
              (capability, index) => (
                <span
                  key={`${capability}-${index}`}
                  className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] font-medium text-zinc-400"
                >
                  {capability}
                </span>
              )
            )}
          </div>
        ) : null}

        {/* Stats */}
        {!compact ? (
          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-white/[0.07] bg-black/10">
            <div className="px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Runs
              </p>

              <p className="mt-1 text-sm font-semibold text-zinc-200">
                {Math.max(
                  0,
                  totalRuns
                ).toLocaleString()}
              </p>
            </div>

            <div className="border-x border-white/[0.07] px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Success
              </p>

              <p className="mt-1 text-sm font-semibold text-zinc-200">
                {successRate !== null
                  ? `${successRate.toFixed(
                      successRate % 1 === 0
                        ? 0
                        : 1
                    )}%`
                  : "—"}
              </p>
            </div>

            <div className="px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Last run
              </p>

              <p className="mt-1 truncate text-sm font-semibold text-zinc-200">
                {formatRelativeDate(
                  agent.lastRunAt ??
                    agent.updatedAt ??
                    agent.createdAt
                )}
              </p>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-600">
            ID:{" "}
            <span className="font-mono text-zinc-500">
              {safeId.slice(0, 8)}
            </span>
          </span>

          {onRun ? (
            <button
              type="button"
              disabled={disabled}
              onClick={(event) =>
                handleAction(
                  event,
                  onRun
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-[10px]">
                ▶
              </span>

              Run Agent
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}