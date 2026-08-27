"use client";

import { useEffect, useMemo, useState } from "react";

type ActivityCategory =
  | "all"
  | "ai"
  | "agent"
  | "project"
  | "knowledge"
  | "task"
  | "automation"
  | "file"
  | "security"
  | "system";

type ActivityStatus = "success" | "running" | "pending" | "failed" | "info";

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  category: Exclude<ActivityCategory, "all">;
  status: ActivityStatus;
  createdAt: string;
  actor: string;
  workspace?: string;
  metadata?: string[];
  unread?: boolean;
};

const categoryConfig: Record<
  Exclude<ActivityCategory, "all">,
  {
    label: string;
    icon: string;
    color: string;
    bg: string;
  }
> = {
  ai: {
    label: "AI",
    icon: "✦",
    color: "text-violet-300",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  agent: {
    label: "Agents",
    icon: "◈",
    color: "text-cyan-300",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  project: {
    label: "Projects",
    icon: "◫",
    color: "text-blue-300",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  knowledge: {
    label: "Knowledge",
    icon: "◇",
    color: "text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  task: {
    label: "Tasks",
    icon: "✓",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  automation: {
    label: "Automation",
    icon: "↻",
    color: "text-pink-300",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
  file: {
    label: "Files",
    icon: "▤",
    color: "text-orange-300",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  security: {
    label: "Security",
    icon: "◉",
    color: "text-red-300",
    bg: "bg-red-500/10 border-red-500/20",
  },
  system: {
    label: "System",
    icon: "●",
    color: "text-slate-300",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
};

const statusConfig: Record<
  ActivityStatus,
  {
    label: string;
    className: string;
    dot: string;
  }
> = {
  success: {
    label: "Completed",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  running: {
    label: "Running",
    className: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    dot: "bg-cyan-400",
  },
  pending: {
    label: "Pending",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  failed: {
    label: "Needs attention",
    className: "border-red-500/20 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
  info: {
    label: "Updated",
    className: "border-slate-500/20 bg-slate-500/10 text-slate-300",
    dot: "bg-slate-400",
  },
};

const initialActivities: ActivityItem[] = [
  {
    id: "activity-1",
    title: "Research Agent completed a market analysis",
    description:
      "The research workflow finished and generated a structured summary with sources, opportunities, risks and next steps.",
    category: "agent",
    status: "success",
    createdAt: "2 minutes ago",
    actor: "SYRAVEN Research Agent",
    workspace: "Strategy",
    metadata: ["24 sources", "8 insights", "Report ready"],
    unread: true,
  },
  {
    id: "activity-2",
    title: "Knowledge analysis is running",
    description:
      "SYRAVEN is processing newly added documents and updating the semantic knowledge index.",
    category: "knowledge",
    status: "running",
    createdAt: "8 minutes ago",
    actor: "SYRAVEN Knowledge",
    workspace: "Knowledge Hub",
    metadata: ["12 documents", "Indexing"],
    unread: true,
  },
  {
    id: "activity-3",
    title: "Automation executed successfully",
    description:
      "Your scheduled workflow completed and produced an updated activity summary.",
    category: "automation",
    status: "success",
    createdAt: "24 minutes ago",
    actor: "SYRAVEN Automation",
    workspace: "Automations",
    metadata: ["Scheduled run", "Completed"],
  },
  {
    id: "activity-4",
    title: "Project workspace was updated",
    description:
      "New changes were added to the active project workspace and are ready for review.",
    category: "project",
    status: "info",
    createdAt: "1 hour ago",
    actor: "You",
    workspace: "Current Project",
    metadata: ["Workspace updated"],
  },
  {
    id: "activity-5",
    title: "AI conversation generated new memory candidates",
    description:
      "SYRAVEN detected information that may be useful across future conversations.",
    category: "ai",
    status: "pending",
    createdAt: "2 hours ago",
    actor: "SYRAVEN Memory",
    workspace: "Memory",
    metadata: ["Review available"],
  },
  {
    id: "activity-6",
    title: "File analysis completed",
    description:
      "A document was processed successfully and extracted information is now available in Knowledge.",
    category: "file",
    status: "success",
    createdAt: "3 hours ago",
    actor: "SYRAVEN Files",
    workspace: "Knowledge Hub",
    metadata: ["Extraction complete"],
  },
  {
    id: "activity-7",
    title: "Task requires your attention",
    description:
      "One of your active tasks could not complete automatically and is waiting for review.",
    category: "task",
    status: "failed",
    createdAt: "Yesterday",
    actor: "SYRAVEN Tasks",
    workspace: "Tasks",
    metadata: ["Action required"],
  },
  {
    id: "activity-8",
    title: "Workspace security settings updated",
    description:
      "Access and privacy preferences were successfully updated.",
    category: "security",
    status: "info",
    createdAt: "Yesterday",
    actor: "You",
    workspace: "Privacy Center",
    metadata: ["Settings updated"],
  },
];

function getActivityGroup(createdAt: string) {
  const value = createdAt.toLowerCase();

  if (
    value.includes("minute") ||
    value.includes("hour") ||
    value.includes("just")
  ) {
    return "Today";
  }

  if (value.includes("yesterday")) {
    return "Yesterday";
  }

  return "Earlier";
}

export default function ActivityPage() {
  const [activities, setActivities] =
    useState<ActivityItem[]>(initialActivities);

  const [activeCategory, setActiveCategory] =
    useState<ActivityCategory>("all");

  const [search, setSearch] = useState("");

  const [selectedActivity, setSelectedActivity] =
    useState<ActivityItem | null>(null);

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const [timeFilter, setTimeFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = activities.filter(
    (activity) => activity.unread
  ).length;

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        !searchValue ||
        activity.title.toLowerCase().includes(searchValue) ||
        activity.description.toLowerCase().includes(searchValue) ||
        activity.actor.toLowerCase().includes(searchValue) ||
        activity.workspace?.toLowerCase().includes(searchValue);

      const matchesCategory =
        activeCategory === "all" ||
        activity.category === activeCategory;

      const matchesUnread =
        !showUnreadOnly || activity.unread === true;

      const matchesTime =
        timeFilter === "all" ||
        (timeFilter === "today" &&
          getActivityGroup(activity.createdAt) === "Today") ||
        (timeFilter === "week" &&
          !activity.createdAt.toLowerCase().includes("earlier"));

      return (
        matchesSearch &&
        matchesCategory &&
        matchesUnread &&
        matchesTime
      );
    });
  }, [
    activities,
    search,
    activeCategory,
    showUnreadOnly,
    timeFilter,
  ]);

  const groupedActivities = useMemo(() => {
    return filteredActivities.reduce<Record<string, ActivityItem[]>>(
      (groups, activity) => {
        const group = getActivityGroup(activity.createdAt);

        if (!groups[group]) {
          groups[group] = [];
        }

        groups[group].push(activity);

        return groups;
      },
      {}
    );
  }, [filteredActivities]);

  const markAllAsRead = () => {
    setActivities((current) =>
      current.map((activity) => ({
        ...activity,
        unread: false,
      }))
    );
  };

  const refreshActivity = async () => {
    setIsLoading(true);

    try {
      /*
       * Future SYRAVEN Activity API integration point.
       *
       * The UI is intentionally prepared for the central activity feed.
       * When the backend endpoint is finalized, replace this temporary
       * block with:
       *
       * const response = await fetch("/api/activity");
       * const payload = await response.json();
       * setActivities(payload.activities);
       *
       * The page remains fully functional until that API layer is connected.
       */

      await new Promise((resolve) => setTimeout(resolve, 650));
    } finally {
      setIsLoading(false);
    }
  };

  const categoryCount = (category: ActivityCategory) => {
    if (category === "all") {
      return activities.length;
    }

    return activities.filter(
      (activity) => activity.category === category
    ).length;
  };

  const stats = {
    total: activities.length,
    completed: activities.filter(
      (activity) => activity.status === "success"
    ).length,
    running: activities.filter(
      (activity) => activity.status === "running"
    ).length,
    attention: activities.filter(
      (activity) => activity.status === "failed"
    ).length,
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* HEADER */}

        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-gradient-to-br from-[#15151d] via-[#101016] to-[#0b0b10]">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[120px]" />

          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-lg text-violet-300 shadow-[0_0_30px_rgba(139,92,246,0.12)]">
                    ✦
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-violet-300">
                      SYRAVEN Intelligence
                    </p>

                    <p className="mt-1 text-xs text-white/35">
                      Your complete activity layer
                    </p>
                  </div>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Everything happening in{" "}
                  <span className="bg-gradient-to-r from-violet-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                    your SYRAVEN world.
                  </span>
                </h1>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
                  Follow your AI, agents, projects, automations, files,
                  knowledge and workspace activity from one intelligent
                  timeline.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/60 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
                  >
                    Mark all as read
                  </button>
                )}

                <button
                  type="button"
                  onClick={refreshActivity}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-70"
                >
                  <span
                    className={
                      isLoading
                        ? "inline-block animate-spin"
                        : "inline-block"
                    }
                  >
                    ↻
                  </span>

                  {isLoading ? "Refreshing..." : "Refresh activity"}
                </button>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Total activity"
                value={stats.total}
                detail="Across SYRAVEN"
                accent="violet"
              />

              <StatCard
                label="Completed"
                value={stats.completed}
                detail="Successfully finished"
                accent="green"
              />

              <StatCard
                label="Running now"
                value={stats.running}
                detail="Active intelligence"
                accent="cyan"
              />

              <StatCard
                label="Needs attention"
                value={stats.attention}
                detail="Review recommended"
                accent="red"
              />
            </div>
          </div>
        </section>

        {/* CONTROLS */}

        <section className="mt-6 rounded-[28px] border border-white/[0.07] bg-[#101015]/80 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search activity..."
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-500/40 focus:bg-black/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={timeFilter}
                onChange={(event) =>
                  setTimeFilter(event.target.value)
                }
                className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm text-white/70 outline-none"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setShowUnreadOnly((current) => !current)
                }
                className={`h-11 rounded-xl border px-4 text-sm font-medium transition ${
                  showUnreadOnly
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                    : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white"
                }`}
              >
                {unreadCount > 0
                  ? `Unread (${unreadCount})`
                  : "Unread"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            <ActivityFilter
              active={activeCategory === "all"}
              label="All"
              count={categoryCount("all")}
              onClick={() => setActiveCategory("all")}
            />

            {(Object.keys(categoryConfig) as Array<
              Exclude<ActivityCategory, "all">
            >).map((category) => {
              const config = categoryConfig[category];

              return (
                <ActivityFilter
                  key={category}
                  active={activeCategory === category}
                  label={config.label}
                  icon={config.icon}
                  count={categoryCount(category)}
                  onClick={() =>
                    setActiveCategory(category)
                  }
                />
              );
            })}
          </div>
        </section>

        {/* CONTENT */}

        <section className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[30px] border border-white/[0.07] bg-[#101015]/70 p-4 sm:p-6">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Activity timeline
                </h2>

                <p className="mt-1 text-sm text-white/35">
                  {filteredActivities.length} event
                  {filteredActivities.length !== 1 ? "s" : ""}{" "}
                  matching your filters.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live activity feed
              </div>
            </div>

            {Object.keys(groupedActivities).length > 0 ? (
              <div className="space-y-10">
                {["Today", "Yesterday", "Earlier"].map(
                  (group) => {
                    const groupItems = groupedActivities[group];

                    if (!groupItems?.length) {
                      return null;
                    }

                    return (
                      <div key={group}>
                        <div className="mb-5 flex items-center gap-4">
                          <p className="shrink-0 text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                            {group}
                          </p>

                          <div className="h-px w-full bg-white/[0.06]" />
                        </div>

                        <div className="space-y-3">
                          {groupItems.map((activity) => (
                            <ActivityRow
                              key={activity.id}
                              activity={activity}
                              onSelect={() => {
                                setSelectedActivity(activity);

                                if (activity.unread) {
                                  setActivities((current) =>
                                    current.map((item) =>
                                      item.id === activity.id
                                        ? {
                                            ...item,
                                            unread: false,
                                          }
                                        : item
                                    )
                                  );
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <EmptyActivityState
                onReset={() => {
                  setSearch("");
                  setActiveCategory("all");
                  setShowUnreadOnly(false);
                  setTimeFilter("all");
                }}
              />
            )}
          </div>

          {/* RIGHT PANEL */}

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-white/[0.07] bg-gradient-to-b from-[#15151d] to-[#0d0d12] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                    SYRAVEN Pulse
                  </p>

                  <h3 className="mt-2 text-lg font-semibold">
                    Your workspace is active
                  </h3>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  ↗
                </div>
              </div>

              <div className="mt-7 space-y-4">
                <PulseRow
                  label="AI activity"
                  value="Active"
                  dot="bg-violet-400"
                />

                <PulseRow
                  label="Agents"
                  value={`${stats.running} running`}
                  dot="bg-cyan-400"
                />

                <PulseRow
                  label="Automations"
                  value="Healthy"
                  dot="bg-emerald-400"
                />

                <PulseRow
                  label="Attention needed"
                  value={
                    stats.attention > 0
                      ? `${stats.attention} item`
                      : "None"
                  }
                  dot={
                    stats.attention > 0
                      ? "bg-red-400"
                      : "bg-emerald-400"
                  }
                />
              </div>
            </div>

            <div className="rounded-[30px] border border-violet-500/15 bg-violet-500/[0.04] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                ✦
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                Intelligent activity
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/40">
                As SYRAVEN grows, this feed becomes the central
                intelligence layer connecting your AI, agents,
                automations, projects and workspace.
              </p>

              <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <p className="text-xs font-medium text-white/35">
                  NEXT LEVEL
                </p>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  Activity will support deep links, execution history,
                  agent runs, security events and workspace insights.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {/* DETAIL MODAL */}

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: number;
  detail: string;
  accent: "violet" | "green" | "cyan" | "red";
}) {
  const accentMap = {
    violet:
      "border-violet-500/15 bg-violet-500/[0.04] text-violet-300",
    green:
      "border-emerald-500/15 bg-emerald-500/[0.04] text-emerald-300",
    cyan:
      "border-cyan-500/15 bg-cyan-500/[0.04] text-cyan-300",
    red: "border-red-500/15 bg-red-500/[0.04] text-red-300",
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${accentMap[accent]}`}
    >
      <p className="text-xs font-medium text-white/35">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </p>

      <p className="mt-2 text-xs text-white/35">
        {detail}
      </p>
    </div>
  );
}

function ActivityFilter({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition ${
        active
          ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
          : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {icon && <span className="text-sm">{icon}</span>}

      {label}

      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
          active
            ? "bg-violet-400/10 text-violet-200"
            : "bg-white/[0.05] text-white/30"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ActivityRow({
  activity,
  onSelect,
}: {
  activity: ActivityItem;
  onSelect: () => void;
}) {
  const category = categoryConfig[activity.category];
  const status = statusConfig[activity.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex w-full flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 text-left transition hover:-translate-y-[1px] hover:border-white/[0.12] hover:bg-white/[0.035] sm:flex-row sm:items-start sm:p-5"
    >
      {activity.unread && (
        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_16px_rgba(139,92,246,0.8)]" />
      )}

      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg ${category.bg} ${category.color}`}
      >
        {category.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="pr-4 text-sm font-semibold text-white/85 transition group-hover:text-white sm:text-[15px]">
            {activity.title}
          </h3>

          <span className="shrink-0 text-xs text-white/30">
            {activity.createdAt}
          </span>
        </div>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-white/40">
          {activity.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.className}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
            />

            {status.label}
          </span>

          <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[11px] text-white/35">
            {activity.actor}
          </span>

          {activity.workspace && (
            <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[11px] text-white/35">
              {activity.workspace}
            </span>
          )}
        </div>
      </div>

      <span className="absolute bottom-4 right-4 text-lg text-white/10 transition group-hover:translate-x-0.5 group-hover:text-white/40">
        →
      </span>
    </button>
  );
}

function PulseRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2 w-2 rounded-full shadow-[0_0_12px_currentColor] ${dot}`}
        />

        <span className="text-sm text-white/45">{label}</span>
      </div>

      <span className="text-sm font-medium text-white/70">
        {value}
      </span>
    </div>
  );
}

function EmptyActivityState({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.07] bg-white/[0.03] text-2xl text-white/40">
        ✦
      </div>

      <h3 className="mt-6 text-lg font-semibold">
        No activity found
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-white/35">
        Try changing your filters or search for something else in
        your SYRAVEN activity.
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.07] hover:text-white"
      >
        Reset filters
      </button>
    </div>
  );
}

function ActivityDetailModal({
  activity,
  onClose,
}: {
  activity: ActivityItem;
  onClose: () => void;
}) {
  const category = categoryConfig[activity.category];
  const status = statusConfig[activity.status];

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () =>
      window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-[32px] border border-white/[0.1] bg-[#111116] p-6 shadow-2xl sm:rounded-[32px] sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-xl ${category.bg} ${category.color}`}
          >
            {category.icon}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:bg-white/[0.07] hover:text-white"
            aria-label="Close activity details"
          >
            ×
          </button>
        </div>

        <div className="mt-7">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.className}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
              />

              {status.label}
            </span>

            <span className="text-xs text-white/30">
              {activity.createdAt}
            </span>
          </div>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            {activity.title}
          </h2>

          <p className="mt-4 text-sm leading-7 text-white/45 sm:text-base">
            {activity.description}
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <DetailBox label="Source" value={activity.actor} />

          <DetailBox
            label="Workspace"
            value={activity.workspace || "SYRAVEN"}
          />
        </div>

        {activity.metadata && activity.metadata.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/30">
              Activity metadata
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {activity.metadata.map((item) => (
                <span
                  key={item}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-white/55"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end border-t border-white/[0.06] pt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-xs text-white/30">{label}</p>

      <p className="mt-2 truncate text-sm font-medium text-white/70">
        {value}
      </p>
    </div>
  );
}