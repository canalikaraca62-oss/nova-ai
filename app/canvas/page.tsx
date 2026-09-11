"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/*
  SYRAVEN — Canvases

  WHY THIS PAGE WAS REWRITTEN

  It opened on six invented canvases — "SYRAVEN Product Strategy" at 82%
  progress with 6 collaborators, "Global Market Research" at 67% — held
  in a module-scope array and seeded straight into useState. Creating one
  built an id from the title plus Date.now(), invented a description,
  two tags, one collaborator and 0% progress, and unshifted it. Archiving
  flipped a local flag. Everything vanished on reload, and none of it had
  ever been anyone's work.

  /api/canvases has offered full CRUD the whole time: session-scoped
  through withAuth, owner-filtered, with a tenant guard on a
  body-supplied workspaceId.

  WHAT THE TABLE ACTUALLY HAS

    id, user_id, workspace_id, title, description, nodes, edges,
    created_at, updated_at

  There is no `type`, no `status`, no `collaborators`, no `progress` and
  no `tags` column. Those five drove the type filter, the status filter,
  the tag search, all four stat cards and both card layouts — and every
  one of them was invented. They are gone rather than reconstructed from
  metadata, because a number a user reads as a fact has to come from
  somewhere real.

  What replaces them is genuinely derived: a canvas's size is the count
  of its nodes and edges, which the document actually carries, and its
  recency is updated_at.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/** A canvas row as the API returns it. */
interface CanvasRow {
  id: string;
  title: string;
  description: string | null;
  nodes: unknown;
  edges: unknown;
  updated_at: string;
}

interface CanvasItem {
  id: string;
  title: string;
  description: string;
  /** Real: how much is on the canvas. */
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Renders a timestamp identically on the server and in the browser.
 *
 * toLocaleDateString() formats against the runtime's locale and
 * timezone, which differ between the two and surface as a hydration
 * mismatch. A fixed ISO slice is stable.
 */
function formatUpdatedAt(value: string): string {
  return value.slice(0, 10);
}

function toCanvasItem(row: CanvasRow): CanvasItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "No description yet.",
    nodeCount: countOf(row.nodes),
    edgeCount: countOf(row.edges),
    updatedAt: row.updated_at,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function CanvasPage() {
  const [canvases, setCanvases] = useState<CanvasItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [newCanvasTitle, setNewCanvasTitle] = useState("");

  const loadCanvases = useCallback(async () => {
    setIsLoading(true);
    setCanvasError(null);

    try {
      const response = await fetch("/api/canvases", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setCanvases([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json()) as {
        canvases?: CanvasRow[];
      };

      setCanvases((payload.canvases ?? []).map(toCanvasItem));
    } catch {
      setCanvasError("Your canvases could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return loadCanvases();
    });

    return () => {
      cancelled = true;
    };
  }, [loadCanvases]);

  const filteredCanvases = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return canvases;

    return canvases.filter(
      (canvas) =>
        canvas.title.toLowerCase().includes(normalized) ||
        canvas.description.toLowerCase().includes(normalized),
    );
  }, [canvases, query]);

  /*
    Every figure here is counted from rows the server returned. The
    previous version summed an invented `collaborators` field across
    invented canvases.
  */
  const stats = useMemo(() => {
    return {
      total: canvases.length,
      nodes: canvases.reduce((sum, canvas) => sum + canvas.nodeCount, 0),
      edges: canvases.reduce((sum, canvas) => sum + canvas.edgeCount, 0),
    };
  }, [canvases]);

  async function createCanvas() {
    const title = newCanvasTitle.trim();

    if (!title || isCreating) return;

    setIsCreating(true);
    setCanvasError(null);

    try {
      /*
        The id comes from the SERVER. It used to be built from the title
        plus Date.now(), so the canvas existed only in this tab and the
        "Open" link pointed at a canvas that did not exist.
      */
      const response = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title }),
      });

      const payload = (await response.json().catch(() => null)) as {
        canvas?: CanvasRow;
      } | null;

      const created = payload?.canvas;

      if (!response.ok || !created) throw new Error("failed");

      setCanvases((current) => [toCanvasItem(created), ...current]);
      setNewCanvasTitle("");
      setShowCreatePanel(false);
    } catch {
      setCanvasError("That canvas could not be created.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b border-white/[0.07] pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Canvases
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/50">
              Spatial workspaces for thinking through a problem — notes,
              connections and structure on one surface.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreatePanel((value) => !value)}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            New canvas
          </button>
        </header>

        {/* Create */}
        {showCreatePanel ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <label
              htmlFor="canvas-title"
              className="text-sm font-medium"
            >
              Canvas name
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="canvas-title"
                value={newCanvasTitle}
                onChange={(event) => setNewCanvasTitle(event.target.value)}
                placeholder="What are you working through?"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />

              <button
                type="button"
                onClick={() => {
                  void createCanvas();
                }}
                disabled={isCreating || !newCanvasTitle.trim()}
                className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Error */}
        {canvasError ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {canvasError}
          </div>
        ) : null}

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Canvases" value={stats.total} />
          <StatCard label="Nodes" value={stats.nodes} />
          <StatCard label="Connections" value={stats.edges} />
        </section>

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search canvases..."
            aria-label="Search canvases"
            className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 sm:max-w-sm"
          />

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card p-1">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={`h-9 rounded-lg px-4 text-xs font-medium capitalize transition ${
                  view === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/50 hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <section className="mt-6">
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-sm text-foreground/50"
            >
              Loading your canvases...
            </div>
          ) : filteredCanvases.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center">
              <h2 className="text-lg font-semibold">
                {canvases.length === 0
                  ? "No canvases yet"
                  : "No canvases found"}
              </h2>

              <p className="mt-2 max-w-sm text-sm leading-6 text-foreground/50">
                {canvases.length === 0
                  ? "Create one to start mapping out a problem."
                  : "Try a different search."}
              </p>

              {canvases.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setShowCreatePanel(true)}
                  className="mt-5 text-sm font-medium text-primary hover:underline"
                >
                  Create your first canvas
                </button>
              ) : null}
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCanvases.map((canvas) => (
                <CanvasCard key={canvas.id} canvas={canvas} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card">
              {filteredCanvases.map((canvas) => (
                <CanvasListItem key={canvas.id} canvas={canvas} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 SUBVIEWS                                   */
/* -------------------------------------------------------------------------- */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-foreground/50">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

/** What a canvas actually contains, counted from its document. */
function CanvasSize({ canvas }: { canvas: CanvasItem }) {
  return (
    <span className="text-xs text-foreground/40">
      {canvas.nodeCount} node{canvas.nodeCount === 1 ? "" : "s"}
      {" · "}
      {canvas.edgeCount} connection{canvas.edgeCount === 1 ? "" : "s"}
    </span>
  );
}

function CanvasCard({ canvas }: { canvas: CanvasItem }) {
  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <h3 className="truncate text-base font-semibold">{canvas.title}</h3>

      <p className="mt-3 line-clamp-3 min-h-[60px] text-sm leading-6 text-foreground/50">
        {canvas.description}
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <div className="flex flex-col gap-1">
          <CanvasSize canvas={canvas} />

          <time
            dateTime={canvas.updatedAt}
            className="text-xs text-foreground/35"
          >
            Updated {formatUpdatedAt(canvas.updatedAt)}
          </time>
        </div>

        <Link
          href={`/canvas/${encodeURIComponent(canvas.id)}`}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Open →
        </Link>
      </div>
    </article>
  );
}

function CanvasListItem({ canvas }: { canvas: CanvasItem }) {
  return (
    <article className="flex flex-col gap-4 border-b border-border p-5 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h3 className="font-semibold">{canvas.title}</h3>

        <p className="mt-1 truncate text-sm text-foreground/40">
          {canvas.description}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CanvasSize canvas={canvas} />

          <span className="text-xs text-foreground/35">·</span>

          <time
            dateTime={canvas.updatedAt}
            className="text-xs text-foreground/35"
          >
            {formatUpdatedAt(canvas.updatedAt)}
          </time>
        </div>
      </div>

      <Link
        href={`/canvas/${encodeURIComponent(canvas.id)}`}
        className="shrink-0 self-start rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 lg:self-auto"
      >
        Open
      </Link>
    </article>
  );
}
