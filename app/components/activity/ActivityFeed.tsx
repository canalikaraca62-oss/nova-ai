"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

export type ActivityType =
  | "agent"
  | "task"
  | "project"
  | "knowledge"
  | "chat"
  | "canvas"
  | "automation"
  | "system"
  | "billing"
  | "security";

export type ActivityStatus =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "neutral";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  status?: ActivityStatus;
  title: string;
  description?: string;
  timestamp: string;
  actor?: string;
  metadata?: Record<
    string,
    string | number | boolean | null
  >;
  read?: boolean;
  actionable?: boolean;
  actionLabel?: string;
};

type ActivityFilter =
  | "all"
  | ActivityType;

type ActivityFeedProps = {
  activities?: ActivityItem[];
  title?: string;
  subtitle?: string;
  limit?: number;
  compact?: boolean;
  showHeader?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  showRefresh?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  onActivityClick?: (
    activity: ActivityItem
  ) => void;
  onRefresh?: () =>
    | void
    | Promise<void>;
};

const activityOrder: ActivityType[] = [
  "agent",
  "task",
  "project",
  "knowledge",
  "chat",
  "canvas",
  "automation",
  "system",
  "billing",
  "security",
];

const typeLabels: Record<
  ActivityType,
  string
> = {
  agent: "Agents",
  task: "Tasks",
  project: "Projects",
  knowledge: "Knowledge",
  chat: "Chat",
  canvas: "Canvas",
  automation: "Automations",
  system: "System",
  billing: "Billing",
  security: "Security",
};

function getActivityIcon(
  type: ActivityType
) {
  switch (type) {
    case "agent":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect
            x="5"
            y="7"
            width="14"
            height="12"
            rx="3"
          />
          <path d="M12 3v4" />
          <path d="M9 12h.01" />
          <path d="M15 12h.01" />
          <path d="M9 16h6" />
        </svg>
      );

    case "task":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "project":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
        </svg>
      );

    case "knowledge":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5" />
          <path d="M4 5.5v15" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
        </svg>
      );

    case "chat":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.5-.8L4 20l1.3-4A7.3 7.3 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
        </svg>
      );

    case "canvas":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="3"
          />
          <path d="m8 15 3-3 2 2 3-4" />
        </svg>
      );

    case "automation":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="m5.6 5.6 2.1 2.1" />
          <path d="m16.3 16.3 2.1 2.1" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <circle
            cx="12"
            cy="12"
            r="5"
          />
        </svg>
      );

    case "billing":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="3"
          />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      );

    case "security":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "system":
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle
            cx="12"
            cy="12"
            r="8"
          />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
  }
}

function getTypeStyles(
  type: ActivityType
) {
  switch (type) {
    case "agent":
      return "border-violet-400/20 bg-violet-400/[0.09] text-violet-200";

    case "task":
      return "border-emerald-400/20 bg-emerald-400/[0.09] text-emerald-200";

    case "project":
      return "border-blue-400/20 bg-blue-400/[0.09] text-blue-200";

    case "knowledge":
      return "border-amber-400/20 bg-amber-400/[0.09] text-amber-200";

    case "chat":
      return "border-cyan-400/20 bg-cyan-400/[0.09] text-cyan-200";

    case "canvas":
      return "border-pink-400/20 bg-pink-400/[0.09] text-pink-200";

    case "automation":
      return "border-indigo-400/20 bg-indigo-400/[0.09] text-indigo-200";

    case "billing":
      return "border-orange-400/20 bg-orange-400/[0.09] text-orange-200";

    case "security":
      return "border-red-400/20 bg-red-400/[0.09] text-red-200";

    case "system":
    default:
      return "border-white/[0.1] bg-white/[0.05] text-white/65";
  }
}

function getStatusDot(
  status: ActivityStatus
) {
  switch (status) {
    case "success":
      return "bg-emerald-400";

    case "warning":
      return "bg-amber-400";

    case "error":
      return "bg-red-400";

    case "info":
      return "bg-cyan-400";

    case "neutral":
    default:
      return "bg-white/30";
  }
}

function formatRelativeTime(
  timestamp: string
) {
  const date =
    new Date(timestamp);

  const time =
    date.getTime();

  if (Number.isNaN(time)) {
    return timestamp;
  }

  const now =
    Date.now();

  const difference =
    Math.max(
      0,
      now - time
    );

  const seconds =
    Math.floor(
      difference / 1000
    );

  if (seconds < 60) {
    return "Şimdi";
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {
    return `${minutes} dk önce`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours} sa önce`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 7) {
    return `${days} gün önce`;
  }

  try {
    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "numeric",
        month: "short",
      }
    ).format(date);
  } catch {
    return timestamp;
  }
}

export default function ActivityFeed({
  activities = [],
  title = "Activity",
  subtitle = "SYRAVEN genelindeki son gelişmeler",
  limit,
  compact = false,
  showHeader = true,
  showFilters = true,
  showSearch = true,
  showRefresh = true,
  emptyTitle = "Henüz aktivite yok",
  emptyDescription = "Yeni işlemler, görevler, agent çalışmaları ve sistem olayları burada görünecek.",
  className = "",
  onActivityClick,
  onRefresh,
}: ActivityFeedProps) {
  const [filter, setFilter] =
    useState<ActivityFilter>(
      "all"
    );

  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedActivityId, setSelectedActivityId] =
    useState<string | null>(
      null
    );

  const [readActivityIds, setReadActivityIds] =
    useState<Set<string>>(
      () =>
        new Set(
          activities
            .filter(
              (activity) =>
                activity.read
            )
            .map(
              (activity) =>
                activity.id
            )
        )
    );

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  useEffect(() => {
    setReadActivityIds(
      new Set(
        activities
          .filter(
            (activity) =>
              activity.read
          )
          .map(
            (activity) =>
              activity.id
          )
      )
    );
  }, [activities]);

  const filteredActivities =
    useMemo(() => {
      const normalizedQuery =
        searchQuery
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      const filtered =
        activities.filter(
          (activity) => {
            const matchesFilter =
              filter === "all" ||
              activity.type ===
                filter;

            if (
              !matchesFilter
            ) {
              return false;
            }

            if (
              !normalizedQuery
            ) {
              return true;
            }

            const searchableContent =
              [
                activity.title,
                activity.description,
                activity.actor,
                activity.type,
                typeLabels[
                  activity.type
                ],
              ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase(
                  "tr-TR"
                );

            return searchableContent.includes(
              normalizedQuery
            );
          }
        );

      const sorted =
        [...filtered].sort(
          (a, b) => {
            const aTime =
              new Date(
                a.timestamp
              ).getTime();

            const bTime =
              new Date(
                b.timestamp
              ).getTime();

            return (
              bTime - aTime
            );
          }
        );

      if (
        typeof limit ===
        "number"
      ) {
        return sorted.slice(
          0,
          Math.max(0, limit)
        );
      }

      return sorted;
    }, [
      activities,
      filter,
      searchQuery,
      limit,
    ]);

  const unreadCount =
    activities.filter(
      (activity) =>
        !readActivityIds.has(
          activity.id
        )
    ).length;

  const selectedActivity =
    selectedActivityId
      ? activities.find(
          (activity) =>
            activity.id ===
            selectedActivityId
        ) ?? null
      : null;

  async function handleRefresh() {
    if (
      isRefreshing ||
      !onRefresh
    ) {
      return;
    }

    setIsRefreshing(true);

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleActivityClick(
    activity: ActivityItem
  ) {
    setReadActivityIds(
      (current) => {
        const next =
          new Set(current);

        next.add(activity.id);

        return next;
      }
    );

    setSelectedActivityId(
      activity.id
    );

    onActivityClick?.(
      activity
    );
  }

  function markAllAsRead() {
    setReadActivityIds(
      new Set(
        activities.map(
          (activity) =>
            activity.id
        )
      )
    );
  }

  return (
    <section
      className={`w-full ${className}`}
    >
      {showHeader && (
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {title}
                </h2>

                {unreadCount > 0 && (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                    {unreadCount}
                  </span>
                )}
              </div>

              {subtitle && (
                <p className="mt-1 text-sm text-white/40">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={
                    markAllAsRead
                  }
                  className="hidden rounded-lg px-2.5 py-2 text-[11px] text-white/40 transition hover:bg-white/[0.05] hover:text-white/75 sm:inline-flex"
                >
                  Tümünü okundu yap
                </button>
              )}

              {showRefresh &&
                onRefresh && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleRefresh()
                    }
                    disabled={
                      isRefreshing
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Aktiviteleri yenile"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 ${
                        isRefreshing
                          ? "animate-spin"
                          : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M20 11a8 8 0 1 0 2 5.5" />
                      <path d="M20 4v7h-7" />
                    </svg>
                  </button>
                )}
            </div>
          </div>

          {!compact && (
            <div className="flex flex-col gap-3 sm:flex-row">
              {showSearch && (
                <label className="relative block min-w-0 flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/25">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="6"
                      />
                      <path d="m16 16 4 4" />
                    </svg>
                  </span>

                  <input
                    value={
                      searchQuery
                    }
                    onChange={(
                      event
                    ) =>
                      setSearchQuery(
                        event.target.value
                      )
                    }
                    placeholder="Aktivitelerde ara..."
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400/30 focus:bg-white/[0.05]"
                  />
                </label>
              )}

              {showFilters && (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:max-w-[420px]">
                  <button
                    type="button"
                    onClick={() =>
                      setFilter("all")
                    }
                    className={`h-10 shrink-0 rounded-xl border px-3 text-xs transition ${
                      filter === "all"
                        ? "border-cyan-400/25 bg-cyan-400/[0.09] text-cyan-200"
                        : "border-white/[0.08] bg-white/[0.025] text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                    }`}
                  >
                    Tümü
                  </button>

                  {activityOrder.map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setFilter(
                            type
                          )
                        }
                        className={`h-10 shrink-0 rounded-xl border px-3 text-xs transition ${
                          filter === type
                            ? "border-cyan-400/25 bg-cyan-400/[0.09] text-cyan-200"
                            : "border-white/[0.08] bg-white/[0.025] text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                        }`}
                      >
                        {
                          typeLabels[
                            type
                          ]
                        }
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        {filteredActivities.length ===
        0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-white/30">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M12 6v6l4 2" />
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                />
              </svg>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-white/80">
              {emptyTitle}
            </h3>

            <p className="mt-2 max-w-md text-xs leading-6 text-white/35">
              {searchQuery ||
              filter !== "all"
                ? "Arama veya filtre kriterlerini değiştirerek tekrar deneyin."
                : emptyDescription}
            </p>

            {(searchQuery ||
              filter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(
                    ""
                  );

                  setFilter(
                    "all"
                  );
                }}
                className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-white/55 transition hover:bg-white/[0.08] hover:text-white"
              >
                Filtreleri temizle
              </button>
            )}
          </div>
        ) : (
          <div>
            {filteredActivities.map(
              (
                activity,
                index
              ) => {
                const isRead =
                  readActivityIds.has(
                    activity.id
                  );

                const isSelected =
                  selectedActivityId ===
                  activity.id;

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() =>
                      handleActivityClick(
                        activity
                      )
                    }
                    className={`group relative flex w-full items-start gap-3 px-4 py-4 text-left transition sm:gap-4 sm:px-5 ${
                      index !==
                      filteredActivities.length -
                        1
                        ? "border-b border-white/[0.06]"
                        : ""
                    } ${
                      isSelected
                        ? "bg-cyan-400/[0.045]"
                        : "hover:bg-white/[0.035]"
                    }`}
                  >
                    <div
                      className={`relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${getTypeStyles(
                        activity.type
                      )}`}
                    >
                      {getActivityIcon(
                        activity.type
                      )}

                      {!isRead && (
                        <span
                          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0a0c10] ${getStatusDot(
                            activity.status ??
                              "info"
                          )}`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p
                              className={`truncate text-sm ${
                                isRead
                                  ? "font-medium text-white/65"
                                  : "font-semibold text-white/90"
                              }`}
                            >
                              {
                                activity.title
                              }
                            </p>

                            <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/30">
                              {
                                typeLabels[
                                  activity.type
                                ]
                              }
                            </span>
                          </div>

                          {activity.description && (
                            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-white/38">
                              {
                                activity.description
                              }
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 whitespace-nowrap text-[10px] text-white/25">
                          {formatRelativeTime(
                            activity.timestamp
                          )}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2">
                        {activity.actor && (
                          <span className="text-[10px] text-white/28">
                            {
                              activity.actor
                            }
                          </span>
                        )}

                        {activity.actionable && (
                          <>
                            {activity.actor && (
                              <span className="text-white/15">
                                ·
                              </span>
                            )}

                            <span className="text-[10px] text-cyan-300/70 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                              {activity.actionLabel ||
                                "Detayları görüntüle"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/45">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>

      {selectedActivity && (
        <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.035] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${getTypeStyles(
                  selectedActivity.type
                )}`}
              >
                {getActivityIcon(
                  selectedActivity.type
                )}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90">
                  {
                    selectedActivity.title
                  }
                </p>

                {selectedActivity.description && (
                  <p className="mt-2 text-xs leading-6 text-white/45">
                    {
                      selectedActivity.description
                    }
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedActivityId(
                  null
                )
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Detayları kapat"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="m6 6 12 12" />
                <path d="m18 6-12 12" />
              </svg>
            </button>
          </div>

          {selectedActivity.metadata &&
            Object.keys(
              selectedActivity.metadata
            ).length > 0 && (
              <div className="mt-4 grid gap-2 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
                {Object.entries(
                  selectedActivity.metadata
                ).map(
                  ([
                    key,
                    value,
                  ]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5"
                    >
                      <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">
                        {key}
                      </p>

                      <p className="mt-1 truncate text-xs text-white/65">
                        {value === null
                          ? "—"
                          : String(
                              value
                            )}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
        </div>
      )}
    </section>
  );
}