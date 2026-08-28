"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Grid2X2,
  List,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import AgentCard from "./AgentCard";

export type AgentStatus =
  | "active"
  | "idle"
  | "running"
  | "paused"
  | "draft"
  | "error"
  | "archived";

export type AgentSortOption =
  | "recent"
  | "name"
  | "activity"
  | "created";

export interface AgentGridAgent {
  id: string;
  name: string;
  description?: string | null;
  status?: AgentStatus | string | null;
  category?: string | null;
  model?: string | null;
  avatar?: string | null;
  color?: string | null;
  capabilities?: string[] | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_run_at?: string | null;
  execution_count?: number | null;
  success_rate?: number | null;
  metadata?: Record<string, unknown> | null;

  [key: string]: unknown;
}

interface AgentGridProps {
  agents?: AgentGridAgent[];
  isLoading?: boolean;
  error?: string | null;

  title?: string;
  description?: string;

  searchPlaceholder?: string;

  showHeader?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  showSort?: boolean;
  showViewToggle?: boolean;

  emptyTitle?: string;
  emptyDescription?: string;

  className?: string;

  onCreateAgent?: () => void;
  onSelectAgent?: (agent: AgentGridAgent) => void;
  onEditAgent?: (agent: AgentGridAgent) => void;
  onDeleteAgent?: (agent: AgentGridAgent) => void;
  onRetry?: () => void;
}

type ViewMode = "grid" | "list";

const STATUS_OPTIONS = [
  "all",
  "active",
  "running",
  "idle",
  "paused",
  "draft",
  "error",
] as const;

const SORT_OPTIONS: Array<{
  value: AgentSortOption;
  label: string;
}> = [
  {
    value: "recent",
    label: "Recently updated",
  },
  {
    value: "name",
    label: "Name",
  },
  {
    value: "activity",
    label: "Most active",
  },
  {
    value: "created",
    label: "Recently created",
  },
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(
  status: AgentGridAgent["status"],
): string {
  const normalized = normalizeText(status);

  if (!normalized) {
    return "idle";
  }

  return normalized;
}

function getTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "active":
      return (
        <CheckCircle2 className="h-3.5 w-3.5" />
      );

    case "running":
      return (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      );

    case "error":
      return (
        <CircleAlert className="h-3.5 w-3.5" />
      );

    default:
      return (
        <Activity className="h-3.5 w-3.5" />
      );
  }
}

export default function AgentGrid({
  agents = [],
  isLoading = false,
  error = null,

  title = "Agents",
  description = "Build, manage, and orchestrate your AI workforce.",

  searchPlaceholder = "Search agents...",

  showHeader = true,
  showSearch = true,
  showFilters = true,
  showSort = true,
  showViewToggle = true,

  emptyTitle = "No agents found",
  emptyDescription = "Create your first AI agent and start building your intelligent workforce.",

  className = "",

  onCreateAgent,
  onSelectAgent,
  onEditAgent,
  onDeleteAgent,
  onRetry,
}: AgentGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<(typeof STATUS_OPTIONS)[number]>("all");

  const [sortBy, setSortBy] =
    useState<AgentSortOption>("recent");

  const [viewMode, setViewMode] =
    useState<ViewMode>("grid");

  const [isFilterOpen, setIsFilterOpen] =
    useState(false);

  const filteredAgents = useMemo(() => {
    const query = normalizeText(searchQuery);

    const result = agents.filter((agent) => {
      const status =
        normalizeStatus(agent.status);

      const matchesStatus =
        selectedStatus === "all" ||
        status === selectedStatus;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableValues = [
        agent.name,
        agent.description,
        agent.category,
        agent.model,
        ...(agent.capabilities ?? []),
        ...(agent.tags ?? []),
      ];

      return searchableValues.some((value) =>
        normalizeText(value).includes(query),
      );
    });

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return String(a.name ?? "").localeCompare(
            String(b.name ?? ""),
          );

        case "activity":
          return (
            Number(b.execution_count ?? 0) -
            Number(a.execution_count ?? 0)
          );

        case "created":
          return (
            getTimestamp(b.created_at) -
            getTimestamp(a.created_at)
          );

        case "recent":
        default:
          return (
            getTimestamp(
              b.updated_at ??
                b.last_run_at ??
                b.created_at,
            ) -
            getTimestamp(
              a.updated_at ??
                a.last_run_at ??
                a.created_at,
            )
          );
      }
    });
  }, [
    agents,
    searchQuery,
    selectedStatus,
    sortBy,
  ]);

  const statusCounts = useMemo(() => {
    return agents.reduce<Record<string, number>>(
      (accumulator, agent) => {
        const status =
          normalizeStatus(agent.status);

        accumulator[status] =
          (accumulator[status] ?? 0) + 1;

        return accumulator;
      },
      {},
    );
  }, [agents]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedStatus !== "all" ||
    sortBy !== "recent";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSortBy("recent");
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
      {showHeader ? (
        <div className="mb-8 flex flex-col gap-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">
                <Sparkles className="h-4 w-4" />
                AI Workforce
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>

              <p className="mt-2 text-sm leading-6 text-zinc-400 sm:text-base">
                {description}
              </p>
            </div>

            {onCreateAgent ? (
              <button
                type="button"
                onClick={onCreateAgent}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <Plus className="h-4 w-4" />
                Create agent
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs font-medium text-zinc-500">
                Total agents
              </div>

              <div className="mt-2 text-2xl font-semibold text-white">
                {agents.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs font-medium text-zinc-500">
                Active
              </div>

              <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                {statusCounts.active ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs font-medium text-zinc-500">
                Running
              </div>

              <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                {statusCounts.running ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-xs font-medium text-zinc-500">
                Needs attention
              </div>

              <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
                <CircleAlert className="h-4 w-4 text-amber-400" />
                {statusCounts.error ?? 0}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-3 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {showSearch ? (
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

              <input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder={searchPlaceholder}
                className="h-11 w-full rounded-xl border border-white/[0.06] bg-white/[0.025] pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-600 transition focus:border-white/15 focus:bg-white/[0.04] focus:ring-2 focus:ring-white/[0.04]"
              />

              {searchQuery ? (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {showFilters ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setIsFilterOpen(
                      (current) => !current,
                    )
                  }
                  className={[
                    "inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
                    selectedStatus !== "all"
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                      : "border-white/[0.06] bg-white/[0.025] text-zinc-300 hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter

                  {selectedStatus !== "all" ? (
                    <span className="rounded-full bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                      {selectedStatus}
                    </span>
                  ) : null}

                  <ChevronDown className="h-4 w-4" />
                </button>

                {isFilterOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950 p-2 shadow-2xl shadow-black/50">
                    <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Agent status
                    </div>

                    {STATUS_OPTIONS.map(
                      (status) => {
                        const isSelected =
                          selectedStatus === status;

                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              setSelectedStatus(
                                status,
                              );
                              setIsFilterOpen(false);
                            }}
                            className={[
                              "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                              isSelected
                                ? "bg-white/[0.08] text-white"
                                : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
                            ].join(" ")}
                          >
                            <span className="flex items-center gap-2 capitalize">
                              {status === "all" ? (
                                <Bot className="h-4 w-4" />
                              ) : (
                                getStatusIcon(status)
                              )}

                              {status}
                            </span>

                            <span className="text-xs text-zinc-600">
                              {status === "all"
                                ? agents.length
                                : statusCounts[
                                    status
                                  ] ?? 0}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showSort ? (
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target
                      .value as AgentSortOption,
                  )
                }
                className="h-11 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 text-sm text-zinc-300 outline-none transition hover:bg-white/[0.05] focus:border-white/15"
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-zinc-950"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}

            {showViewToggle ? (
              <div className="flex h-11 items-center rounded-xl border border-white/[0.06] bg-white/[0.025] p-1">
                <button
                  type="button"
                  onClick={() =>
                    setViewMode("grid")
                  }
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    viewMode === "grid"
                      ? "bg-white/[0.1] text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                  aria-label="Grid view"
                >
                  <Grid2X2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode("list")
                  }
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    viewMode === "list"
                      ? "bg-white/[0.1] text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
            <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">
                {filteredAgents.length} of{" "}
                {agents.length} agents shown
              </span>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 text-xs font-medium text-zinc-400 transition hover:text-white"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <CircleAlert className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">
                Unable to load agents
              </h3>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {error}
              </p>

              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                >
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div
          className={[
            "grid gap-5",
            viewMode === "grid"
              ? "sm:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-1",
          ].join(" ")}
        >
          {Array.from({
            length: viewMode === "grid" ? 6 : 4,
          }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/[0.06]" />

                <div className="min-w-0 flex-1">
                  <div className="h-4 w-32 rounded bg-white/[0.06]" />
                  <div className="mt-3 h-3 w-full rounded bg-white/[0.04]" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-white/[0.04]" />
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <div className="h-8 w-20 rounded-lg bg-white/[0.04]" />
                <div className="h-8 w-24 rounded-lg bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div
          className={[
            "grid gap-5",
            viewMode === "grid"
              ? "sm:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-1",
          ].join(" ")}
        >
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={
                viewMode === "list"
                  ? "w-full"
                  : ""
              }
            >
              <AgentCard
                agent={agent}
                onClick={() =>
                  onSelectAgent?.(agent)
                }
                onEdit={() =>
                  onEditAgent?.(agent)
                }
                onDelete={() =>
                  onDeleteAgent?.(agent)
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.015] px-6 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
            <Bot className="h-7 w-7 text-zinc-500" />
          </div>

          <h3 className="mt-6 text-lg font-semibold text-white">
            {emptyTitle}
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            {hasActiveFilters
              ? "Try adjusting your search or filters to find the agent you're looking for."
              : emptyDescription}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                Clear filters
              </button>
            ) : null}

            {onCreateAgent ? (
              <button
                type="button"
                onClick={onCreateAgent}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" />
                Create your first agent
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}