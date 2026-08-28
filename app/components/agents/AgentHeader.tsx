"use client";

import {
  Activity,
  Bot,
  Check,
  ChevronLeft,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AgentHeaderStatus =
  | "active"
  | "idle"
  | "running"
  | "paused"
  | "draft"
  | "error"
  | "archived"
  | string;

export interface AgentHeaderAgent {
  id: string;
  name: string;
  description?: string | null;
  status?: AgentHeaderStatus | null;
  model?: string | null;
  category?: string | null;
  avatar?: string | null;
  color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_run_at?: string | null;
  execution_count?: number | null;
  success_rate?: number | null;
  capabilities?: string[] | null;
}

interface AgentHeaderProps {
  agent: AgentHeaderAgent;

  isRunning?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;

  showBackButton?: boolean;
  showActions?: boolean;
  showMetadata?: boolean;

  backLabel?: string;

  onBack?: () => void;
  onRun?: (agent: AgentHeaderAgent) => void;
  onPause?: (agent: AgentHeaderAgent) => void;
  onEdit?: (agent: AgentHeaderAgent) => void;
  onDelete?: (agent: AgentHeaderAgent) => void;
  onShare?: (agent: AgentHeaderAgent) => void;
  onDuplicate?: (agent: AgentHeaderAgent) => void;
  onRefresh?: (agent: AgentHeaderAgent) => void;
}

function normalizeStatus(
  status: AgentHeaderAgent["status"],
): string {
  const normalized = String(status ?? "idle")
    .trim()
    .toLowerCase();

  return normalized || "idle";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();

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
        date.getFullYear() !== now.getFullYear()
          ? "numeric"
          : undefined,
    },
  ).format(date);
}

function getStatusClasses(status: string) {
  switch (status) {
    case "active":
      return {
        dot: "bg-emerald-400",
        badge:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      };

    case "running":
      return {
        dot: "bg-blue-400",
        badge:
          "border-blue-500/20 bg-blue-500/10 text-blue-300",
      };

    case "paused":
      return {
        dot: "bg-amber-400",
        badge:
          "border-amber-500/20 bg-amber-500/10 text-amber-300",
      };

    case "error":
      return {
        dot: "bg-red-400",
        badge:
          "border-red-500/20 bg-red-500/10 text-red-300",
      };

    case "draft":
      return {
        dot: "bg-violet-400",
        badge:
          "border-violet-500/20 bg-violet-500/10 text-violet-300",
      };

    case "archived":
      return {
        dot: "bg-zinc-500",
        badge:
          "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
      };

    default:
      return {
        dot: "bg-zinc-400",
        badge:
          "border-white/[0.08] bg-white/[0.04] text-zinc-400",
      };
  }
}

export default function AgentHeader({
  agent,

  isRunning = false,
  isLoading = false,
  isSaving = false,

  showBackButton = true,
  showActions = true,
  showMetadata = true,

  backLabel = "Back to agents",

  onBack,
  onRun,
  onPause,
  onEdit,
  onDelete,
  onShare,
  onDuplicate,
  onRefresh,
}: AgentHeaderProps) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  const status =
    normalizeStatus(agent.status);

  const statusClasses =
    getStatusClasses(status);

  const isCurrentlyRunning =
    isRunning || status === "running";

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(
        agent.id,
      );

      setCopied(true);
      setMenuOpen(false);
    } catch {
      setCopied(false);
    }
  };

  const handleAction = (
    callback?: (agent: AgentHeaderAgent) => void,
  ) => {
    setMenuOpen(false);
    callback?.(agent);
  };

  return (
    <header className="relative border-b border-white/[0.06] bg-zinc-950/60 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
        {showBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </button>
        ) : null}

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4 sm:gap-5">
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] shadow-xl shadow-black/20 sm:h-16 sm:w-16"
                style={{
                  backgroundColor:
                    agent.color
                      ? `${agent.color}18`
                      : undefined,
                }}
              >
                {agent.avatar ? (
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Bot
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    style={{
                      color:
                        agent.color ?? undefined,
                    }}
                  />
                )}

                <span
                  className={[
                    "absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-zinc-950",
                    statusClasses.dot,
                  ].join(" ")}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      statusClasses.badge,
                    ].join(" ")}
                  >
                    {isCurrentlyRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span
                        className={[
                          "h-1.5 w-1.5 rounded-full",
                          statusClasses.dot,
                        ].join(" ")}
                      />
                    )}

                    {isCurrentlyRunning
                      ? "Running"
                      : formatStatus(status)}
                  </span>

                  {agent.category ? (
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                      {agent.category}
                    </span>
                  ) : null}

                  {isSaving ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving
                    </span>
                  ) : null}
                </div>

                <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {agent.name}
                </h1>

                {agent.description ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                    {agent.description}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">
                    This agent is ready to be configured.
                  </p>
                )}
              </div>
            </div>

            {showMetadata ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/[0.05] pt-5">
                {agent.model ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />

                    <span>
                      Model:
                    </span>

                    <span className="font-medium text-zinc-300">
                      {agent.model}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Activity className="h-3.5 w-3.5 text-zinc-500" />

                  <span>
                    {Number(
                      agent.execution_count ?? 0,
                    ).toLocaleString()}{" "}
                    runs
                  </span>
                </div>

                {typeof agent.success_rate ===
                "number" ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Check className="h-3.5 w-3.5 text-emerald-400" />

                    <span>
                      {Math.round(
                        agent.success_rate,
                      )}
                      % success rate
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Clock3 className="h-3.5 w-3.5" />

                  <span>
                    Updated{" "}
                    {formatDate(
                      agent.updated_at ??
                        agent.created_at,
                    )}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {showActions ? (
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {onRefresh ? (
                <button
                  type="button"
                  onClick={() => onRefresh(agent)}
                  disabled={isLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Refresh agent"
                >
                  <RotateCcw
                    className={[
                      "h-4 w-4",
                      isLoading
                        ? "animate-spin"
                        : "",
                    ].join(" ")}
                  />
                </button>
              ) : null}

              {onShare ? (
                <button
                  type="button"
                  onClick={() => onShare(agent)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Share2 className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    Share
                  </span>
                </button>
              ) : null}

              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(agent)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Edit3 className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    Edit
                  </span>
                </button>
              ) : null}

              {isCurrentlyRunning ? (
                onPause ? (
                  <button
                    type="button"
                    onClick={() => onPause(agent)}
                    disabled={isLoading}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </button>
                ) : null
              ) : onRun ? (
                <button
                  type="button"
                  onClick={() => onRun(agent)}
                  disabled={
                    isLoading ||
                    status === "archived"
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}

                  Run agent
                </button>
              ) : null}

              <div
                ref={menuRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() =>
                    setMenuOpen(
                      (current) => !current,
                    )
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950 p-2 shadow-2xl shadow-black/60">
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}

                      {copied
                        ? "Agent ID copied"
                        : "Copy agent ID"}
                    </button>

                    {onDuplicate ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleAction(
                            onDuplicate,
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate agent
                      </button>
                    ) : null}

                    {onShare ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleAction(onShare)
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open sharing
                      </button>
                    ) : null}

                    {onDelete ? (
                      <>
                        <div className="my-2 border-t border-white/[0.06]" />

                        <button
                          type="button"
                          onClick={() =>
                            handleAction(
                              onDelete,
                            )
                          }
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/[0.08] hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete agent
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}