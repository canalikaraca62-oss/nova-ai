"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CanvasType =
  | "document"
  | "research"
  | "analysis"
  | "presentation"
  | "strategy"
  | "automation";

type CanvasStatus = "active" | "draft" | "archived";

type CanvasItem = {
  id: string;
  title: string;
  description: string;
  type: CanvasType;
  status: CanvasStatus;
  updatedAt: string;
  collaborators: number;
  progress: number;
  tags: string[];
};

const INITIAL_CANVASES: CanvasItem[] = [
  {
    id: "syraven-product-strategy",
    title: "SYRAVEN Product Strategy",
    description:
      "Core product direction, priorities, milestones and strategic decisions.",
    type: "strategy",
    status: "active",
    updatedAt: "2 minutes ago",
    collaborators: 6,
    progress: 82,
    tags: ["Strategy", "Product", "2026"],
  },
  {
    id: "global-market-research",
    title: "Global Market Research",
    description:
      "Research workspace for markets, competitors, opportunities and insights.",
    type: "research",
    status: "active",
    updatedAt: "18 minutes ago",
    collaborators: 4,
    progress: 67,
    tags: ["Research", "Market", "Insights"],
  },
  {
    id: "ai-platform-architecture",
    title: "AI Platform Architecture",
    description:
      "Technical architecture, AI orchestration and platform infrastructure.",
    type: "analysis",
    status: "active",
    updatedAt: "1 hour ago",
    collaborators: 8,
    progress: 91,
    tags: ["AI", "Architecture", "Engineering"],
  },
  {
    id: "investor-presentation",
    title: "Investor Presentation",
    description:
      "Executive presentation, financial narrative and company positioning.",
    type: "presentation",
    status: "draft",
    updatedAt: "3 hours ago",
    collaborators: 3,
    progress: 54,
    tags: ["Investor", "Finance", "Growth"],
  },
  {
    id: "growth-automation",
    title: "Growth Automation System",
    description:
      "Automated workflows for growth experiments and performance monitoring.",
    type: "automation",
    status: "draft",
    updatedAt: "Yesterday",
    collaborators: 5,
    progress: 38,
    tags: ["Automation", "Growth", "Agents"],
  },
  {
    id: "knowledge-system",
    title: "Enterprise Knowledge System",
    description:
      "Structured company knowledge, sources and intelligence workflows.",
    type: "document",
    status: "active",
    updatedAt: "Yesterday",
    collaborators: 9,
    progress: 76,
    tags: ["Knowledge", "Documents", "AI"],
  },
];

const TYPE_META: Record<
  CanvasType,
  {
    label: string;
    icon: string;
  }
> = {
  document: {
    label: "Document",
    icon: "▤",
  },
  research: {
    label: "Research",
    icon: "⌕",
  },
  analysis: {
    label: "Analysis",
    icon: "◈",
  },
  presentation: {
    label: "Presentation",
    icon: "▱",
  },
  strategy: {
    label: "Strategy",
    icon: "◉",
  },
  automation: {
    label: "Automation",
    icon: "⚡",
  },
};

function formatStatus(status: CanvasStatus) {
  if (status === "active") return "Active";
  if (status === "draft") return "Draft";
  return "Archived";
}

export default function CanvasPage() {
  const [canvases, setCanvases] =
    useState<CanvasItem[]>(INITIAL_CANVASES);

  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] =
    useState<CanvasType | "all">("all");

  const [selectedStatus, setSelectedStatus] =
    useState<CanvasStatus | "all">("all");

  const [view, setView] =
    useState<"grid" | "list">("grid");

  const [showCreatePanel, setShowCreatePanel] =
    useState(false);

  const [newCanvasTitle, setNewCanvasTitle] =
    useState("");

  const [newCanvasType, setNewCanvasType] =
    useState<CanvasType>("document");

  const filteredCanvases = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    return canvases.filter((canvas) => {
      const matchesQuery =
        !normalizedQuery ||
        canvas.title
          .toLowerCase()
          .includes(normalizedQuery) ||
        canvas.description
          .toLowerCase()
          .includes(normalizedQuery) ||
        canvas.tags.some((tag) =>
          tag
            .toLowerCase()
            .includes(normalizedQuery)
        );

      const matchesType =
        selectedType === "all" ||
        canvas.type === selectedType;

      const matchesStatus =
        selectedStatus === "all" ||
        canvas.status === selectedStatus;

      return (
        matchesQuery &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    canvases,
    query,
    selectedType,
    selectedStatus,
  ]);

  const stats = useMemo(() => {
    const active =
      canvases.filter(
        (canvas) => canvas.status === "active"
      ).length;

    const draft =
      canvases.filter(
        (canvas) => canvas.status === "draft"
      ).length;

    const collaborators =
      canvases.reduce(
        (total, canvas) =>
          total + canvas.collaborators,
        0
      );

    return {
      total: canvases.length,
      active,
      draft,
      collaborators,
    };
  }, [canvases]);

  function createCanvas() {
    const title =
      newCanvasTitle.trim();

    if (!title) {
      return;
    }

    const id =
      `${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now()}`;

    const newCanvas: CanvasItem = {
      id,
      title,
      description:
        "A new intelligent workspace ready for ideas, collaboration and execution.",
      type: newCanvasType,
      status: "draft",
      updatedAt: "Just now",
      collaborators: 1,
      progress: 0,
      tags: [
        TYPE_META[newCanvasType].label,
        "New",
      ],
    };

    setCanvases((current) => [
      newCanvas,
      ...current,
    ]);

    setNewCanvasTitle("");
    setNewCanvasType("document");
    setShowCreatePanel(false);
  }

  function archiveCanvas(id: string) {
    setCanvases((current) =>
      current.map((canvas) =>
        canvas.id === id
          ? {
              ...canvas,
              status:
                canvas.status === "archived"
                  ? "active"
                  : "archived",
            }
          : canvas
      )
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        {/* HEADER */}

        <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.025] to-transparent p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-xl text-cyan-200 shadow-lg shadow-cyan-950/20">
                  ◈
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/70">
                    SYRAVEN Workspace
                  </p>

                  <p className="mt-1 text-sm text-white/40">
                    Intelligent creation environment
                  </p>
                </div>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Canvas
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
                Build, organize and evolve your most
                important ideas inside a unified
                intelligent workspace. Every canvas can
                become a document, research system,
                strategy, analysis, presentation or
                automated execution environment.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/canvas/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98]"
              >
                <span className="text-lg leading-none">
                  +
                </span>
                New Canvas
              </Link>

              <button
                type="button"
                onClick={() =>
                  setShowCreatePanel((value) => !value)
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                Quick Create
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Canvases"
              value={stats.total}
              description="Across your workspace"
            />

            <StatCard
              label="Active"
              value={stats.active}
              description="Currently evolving"
            />

            <StatCard
              label="Drafts"
              value={stats.draft}
              description="Ready for refinement"
            />

            <StatCard
              label="Collaboration"
              value={stats.collaborators}
              description="Workspace participants"
            />
          </div>
        </section>

        {/* QUICK CREATE */}

        {showCreatePanel ? (
          <section className="mt-6 overflow-hidden rounded-[24px] border border-cyan-400/15 bg-cyan-400/[0.035]">
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Canvas title
                </span>

                <input
                  value={newCanvasTitle}
                  onChange={(event) =>
                    setNewCanvasTitle(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      createCanvas();
                    }
                  }}
                  placeholder="Example: Global Expansion Strategy"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400/40 focus:bg-black/30"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Workspace type
                </span>

                <select
                  value={newCanvasType}
                  onChange={(event) =>
                    setNewCanvasType(
                      event.target
                        .value as CanvasType
                    )
                  }
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#101010] px-4 text-sm text-white outline-none"
                >
                  {(
                    Object.keys(
                      TYPE_META
                    ) as CanvasType[]
                  ).map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {TYPE_META[type].label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={createCanvas}
                className="h-12 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-black transition hover:bg-cyan-200 active:scale-[0.98]"
              >
                Create Canvas
              </button>
            </div>
          </section>
        ) : null}

        {/* TOOLBAR */}

        <section className="mt-6 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                  ⌕
                </span>

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search canvases, tags and ideas..."
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                />
              </div>

              <select
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(
                    event.target
                      .value as CanvasType | "all"
                  )
                }
                className="h-12 rounded-xl border border-white/10 bg-[#101010] px-4 text-sm text-white/70 outline-none"
              >
                <option value="all">
                  All types
                </option>

                {(
                  Object.keys(
                    TYPE_META
                  ) as CanvasType[]
                ).map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {TYPE_META[type].label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target
                      .value as
                        | CanvasStatus
                        | "all"
                  )
                }
                className="h-12 rounded-xl border border-white/10 bg-[#101010] px-4 text-sm text-white/70 outline-none"
              >
                <option value="all">
                  All status
                </option>

                <option value="active">
                  Active
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="archived">
                  Archived
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end xl:self-auto">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`rounded-xl px-4 py-3 text-sm transition ${
                  view === "grid"
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.07]"
                }`}
              >
                Grid
              </button>

              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-xl px-4 py-3 text-sm transition ${
                  view === "list"
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.07]"
                }`}
              >
                List
              </button>
            </div>
          </div>
        </section>

        {/* RESULTS */}

        <section className="mt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Your Canvases
              </h2>

              <p className="mt-1 text-sm text-white/40">
                {filteredCanvases.length} workspace
                {filteredCanvases.length === 1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>

            <Link
              href="/search?scope=canvas"
              className="text-sm font-medium text-cyan-300/80 transition hover:text-cyan-200"
            >
              Advanced search →
            </Link>
          </div>

          {filteredCanvases.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.02] px-6 py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl text-white/50">
                ◈
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                No canvases found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
                Try changing your filters or create a
                new intelligent workspace.
              </p>

              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedType("all");
                  setSelectedStatus("all");
                }}
                className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08]"
              >
                Reset filters
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredCanvases.map((canvas) => (
                <CanvasCard
                  key={canvas.id}
                  canvas={canvas}
                  onArchive={archiveCanvas}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.025]">
              {filteredCanvases.map((canvas) => (
                <CanvasListItem
                  key={canvas.id}
                  canvas={canvas}
                  onArchive={archiveCanvas}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-xs text-white/35">
        {description}
      </p>
    </div>
  );
}

function CanvasCard({
  canvas,
  onArchive,
}: {
  canvas: CanvasItem;
  onArchive: (id: string) => void;
}) {
  const type = TYPE_META[canvas.type];

  return (
    <article className="group relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-transparent p-5 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.06]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-cyan-200">
            {type.icon}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-white/35">
              {type.label}
            </p>

            <h3 className="mt-1 truncate text-base font-semibold text-white">
              {canvas.title}
            </h3>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            canvas.status === "active"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : canvas.status === "draft"
                ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-white/[0.04] text-white/40"
          }`}
        >
          {formatStatus(canvas.status)}
        </span>
      </div>

      <p className="mt-5 min-h-[72px] text-sm leading-6 text-white/50">
        {canvas.description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {canvas.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-lg border border-white/[0.07] bg-black/15 px-2.5 py-1 text-[11px] text-white/40"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/35">
            Workspace progress
          </span>

          <span className="font-semibold text-white/70">
            {canvas.progress}%
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
            style={{
              width: `${canvas.progress}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <div>
          <p className="text-xs text-white/35">
            Updated {canvas.updatedAt}
          </p>

          <p className="mt-1 text-xs text-white/55">
            {canvas.collaborators} collaborator
            {canvas.collaborators === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onArchive(canvas.id)
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45 transition hover:bg-white/[0.07] hover:text-white"
          >
            {canvas.status === "archived"
              ? "Restore"
              : "Archive"}
          </button>

          <Link
            href={`/canvas/${encodeURIComponent(
              canvas.id
            )}`}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200"
          >
            Open →
          </Link>
        </div>
      </div>
    </article>
  );
}

function CanvasListItem({
  canvas,
  onArchive,
}: {
  canvas: CanvasItem;
  onArchive: (id: string) => void;
}) {
  const type = TYPE_META[canvas.type];

  return (
    <article className="flex flex-col gap-4 border-b border-white/[0.07] p-5 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-cyan-200">
          {type.icon}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">
              {canvas.title}
            </h3>

            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
              {formatStatus(canvas.status)}
            </span>
          </div>

          <p className="mt-1 truncate text-sm text-white/40">
            {canvas.description}
          </p>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/35">
            <span>{type.label}</span>
            <span>•</span>
            <span>{canvas.updatedAt}</span>
            <span>•</span>
            <span>{canvas.collaborators} collaborators</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="mr-2 hidden w-28 lg:block">
          <div className="mb-1 flex justify-between text-[10px] text-white/35">
            <span>Progress</span>
            <span>{canvas.progress}%</span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-cyan-400"
              style={{
                width: `${canvas.progress}%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onArchive(canvas.id)
          }
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45 transition hover:bg-white/[0.07] hover:text-white"
        >
          {canvas.status === "archived"
            ? "Restore"
            : "Archive"}
        </button>

        <Link
          href={`/canvas/${encodeURIComponent(
            canvas.id
          )}`}
          className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-cyan-200"
        >
          Open
        </Link>
      </div>
    </article>
  );
}