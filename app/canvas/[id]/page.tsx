"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CanvasNodeType =
  | "text"
  | "note"
  | "idea"
  | "task"
  | "image"
  | "document";

type CanvasNode = {
  id: string;
  type: CanvasNodeType;
  title: string;
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  createdAt?: string;
  updatedAt?: string;
};

type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

type CanvasData = {
  id: string;
  name: string;
  description?: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  updatedAt?: string;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

function createNode(
  type: CanvasNodeType,
  x: number,
  y: number
): CanvasNode {
  const id =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const titles: Record<CanvasNodeType, string> = {
    text: "Untitled text",
    note: "New note",
    idea: "New idea",
    task: "New task",
    image: "Image",
    document: "Document",
  };

  return {
    id,
    type,
    title: titles[type],
    content: "",
    x,
    y,
    width: 280,
    height: 180,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeNodes(value: unknown): CanvasNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Partial<CanvasNode> =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "string"
    )
    .map((item, index) => ({
      id: item.id ?? `node-${index}`,
      type:
        item.type === "text" ||
        item.type === "note" ||
        item.type === "idea" ||
        item.type === "task" ||
        item.type === "image" ||
        item.type === "document"
          ? item.type
          : "note",
      title:
        typeof item.title === "string"
          ? item.title
          : "Untitled",
      content:
        typeof item.content === "string"
          ? item.content
          : "",
      x:
        typeof item.x === "number"
          ? item.x
          : 120 + index * 40,
      y:
        typeof item.y === "number"
          ? item.y
          : 120 + index * 40,
      width:
        typeof item.width === "number"
          ? item.width
          : 280,
      height:
        typeof item.height === "number"
          ? item.height
          : 180,
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : undefined,
      updatedAt:
        typeof item.updatedAt === "string"
          ? item.updatedAt
          : undefined,
    }));
}

function normalizeEdges(value: unknown): CanvasEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Partial<CanvasEdge> =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "string"
    )
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      source:
        typeof item.source === "string"
          ? item.source
          : "",
      target:
        typeof item.target === "string"
          ? item.target
          : "",
      label:
        typeof item.label === "string"
          ? item.label
          : undefined,
    }))
    .filter((edge) => edge.source && edge.target);
}

function getNodeStyle(type: CanvasNodeType) {
  switch (type) {
    case "idea":
      return {
        icon: "✦",
        accent: "border-violet-500/40",
        badge: "bg-violet-500/10 text-violet-300",
      };

    case "task":
      return {
        icon: "✓",
        accent: "border-emerald-500/40",
        badge: "bg-emerald-500/10 text-emerald-300",
      };

    case "image":
      return {
        icon: "◈",
        accent: "border-pink-500/40",
        badge: "bg-pink-500/10 text-pink-300",
      };

    case "document":
      return {
        icon: "▤",
        accent: "border-blue-500/40",
        badge: "bg-blue-500/10 text-blue-300",
      };

    case "text":
      return {
        icon: "T",
        accent: "border-sky-500/40",
        badge: "bg-sky-500/10 text-sky-300",
      };

    default:
      return {
        icon: "●",
        accent: "border-amber-500/40",
        badge: "bg-amber-500/10 text-amber-300",
      };
  }
}

export default function CanvasDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawCanvasId = params?.id;

  const canvasId = useMemo(() => {
    if (Array.isArray(rawCanvasId)) {
      return rawCanvasId[0] ?? "";
    }

    return typeof rawCanvasId === "string"
      ? rawCanvasId
      : "";
  }, [rawCanvasId]);

  const [canvas, setCanvas] =
    useState<CanvasData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [lastSaved, setLastSaved] =
    useState<Date | null>(null);

  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>(null);

  const [zoom, setZoom] =
    useState(1);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [isDirty, setIsDirty] =
    useState(false);

  const workspaceRef =
    useRef<HTMLDivElement | null>(null);

  const saveTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const selectedNode = useMemo(() => {
    if (!canvas || !selectedNodeId) {
      return null;
    }

    return (
      canvas.nodes.find(
        (node) => node.id === selectedNodeId
      ) ?? null
    );
  }, [canvas, selectedNodeId]);

  const loadCanvas = useCallback(async () => {
    if (!canvasId) {
      setError("Canvas ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/canvas?id=${encodeURIComponent(
          canvasId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error ??
            "Canvas could not be loaded."
        );
      }

      const source =
        payload?.canvas ??
        payload?.data ??
        payload;

      const loadedCanvas: CanvasData = {
        id:
          typeof source?.id === "string"
            ? source.id
            : canvasId,
        name:
          typeof source?.name === "string" &&
          source.name.trim()
            ? source.name
            : "Untitled Canvas",
        description:
          typeof source?.description === "string"
            ? source.description
            : null,
        nodes: normalizeNodes(source?.nodes),
        edges: normalizeEdges(source?.edges),
        updatedAt:
          typeof source?.updated_at === "string"
            ? source.updated_at
            : typeof source?.updatedAt === "string"
              ? source.updatedAt
              : undefined,
      };

      setCanvas(loadedCanvas);

      if (loadedCanvas.updatedAt) {
        setLastSaved(
          new Date(loadedCanvas.updatedAt)
        );
      }

      setIsDirty(false);
    } catch (loadError) {
      console.error(
        "CANVAS LOAD ERROR:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Canvas could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  useEffect(() => {
    void loadCanvas();
  }, [loadCanvas]);

  const saveCanvas = useCallback(
    async (
      data?: CanvasData,
      silent = false
    ) => {
      const target = data ?? canvas;

      if (!target || !canvasId) {
        return;
      }

      try {
        setSaving(true);

        const response = await fetch(
          "/api/canvas",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: canvasId,
              name: target.name,
              description:
                target.description ?? null,
              nodes: target.nodes,
              edges: target.edges,
            }),
          }
        );

        const payload =
          await response.json().catch(
            () => null
          );

        if (!response.ok) {
          throw new Error(
            payload?.error ??
              "Canvas could not be saved."
          );
        }

        setLastSaved(new Date());
        setIsDirty(false);

        if (!silent) {
          console.log(
            "CANVAS SAVED:",
            canvasId
          );
        }
      } catch (saveError) {
        console.error(
          "CANVAS SAVE ERROR:",
          saveError
        );

        if (!silent) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Canvas could not be saved."
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [canvas, canvasId]
  );

  useEffect(() => {
    if (!isDirty || !canvas) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(
        saveTimeoutRef.current
      );
    }

    saveTimeoutRef.current =
      setTimeout(() => {
        void saveCanvas(canvas, true);
      }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(
          saveTimeoutRef.current
        );
      }
    };
  }, [canvas, isDirty, saveCanvas]);

  const updateCanvas = useCallback(
    (
      updater: (
        current: CanvasData
      ) => CanvasData
    ) => {
      setCanvas((current) => {
        if (!current) {
          return current;
        }

        return updater(current);
      });

      setIsDirty(true);
    },
    []
  );

  const addNode = useCallback(
    (type: CanvasNodeType) => {
      updateCanvas((current) => {
        const offset =
          current.nodes.length * 28;

        const node = createNode(
          type,
          160 + (offset % 400),
          140 + (offset % 300)
        );

        setSelectedNodeId(node.id);

        return {
          ...current,
          nodes: [
            ...current.nodes,
            node,
          ],
        };
      });
    },
    [updateCanvas]
  );

  const updateSelectedNode = useCallback(
    (
      updates: Partial<CanvasNode>
    ) => {
      if (!selectedNodeId) {
        return;
      }

      updateCanvas((current) => ({
        ...current,
        nodes: current.nodes.map(
          (node) =>
            node.id === selectedNodeId
              ? {
                  ...node,
                  ...updates,
                  updatedAt:
                    new Date().toISOString(),
                }
              : node
        ),
      }));
    },
    [
      selectedNodeId,
      updateCanvas,
    ]
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) {
      return;
    }

    updateCanvas((current) => ({
      ...current,
      nodes: current.nodes.filter(
        (node) =>
          node.id !== selectedNodeId
      ),
      edges: current.edges.filter(
        (edge) =>
          edge.source !== selectedNodeId &&
          edge.target !== selectedNodeId
      ),
    }));

    setSelectedNodeId(null);
  }, [
    selectedNodeId,
    updateCanvas,
  ]);

  const handleZoomIn = () => {
    setZoom((current) =>
      Math.min(
        MAX_ZOOM,
        Number(
          (
            current + ZOOM_STEP
          ).toFixed(2)
        )
      )
    );
  };

  const handleZoomOut = () => {
    setZoom((current) =>
      Math.max(
        MIN_ZOOM,
        Number(
          (
            current - ZOOM_STEP
          ).toFixed(2)
        )
      )
    );
  };

  const resetZoom = () => {
    setZoom(1);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await workspaceRef.current?.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch (fullscreenError) {
      console.error(
        "FULLSCREEN ERROR:",
        fullscreenError
      );
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(
        Boolean(document.fullscreenElement)
      );
    };

    document.addEventListener(
      "fullscreenchange",
      onFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        onFullscreenChange
      );
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-[1800px] items-center justify-center px-6">
          <div className="flex flex-col items-center gap-5">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white" />
            <div className="text-center">
              <p className="font-medium">
                Loading canvas
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Preparing your workspace…
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !canvas) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-8">
            <div className="text-3xl">
              ⚠
            </div>

            <h1 className="mt-5 text-2xl font-semibold">
              Canvas unavailable
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {error}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadCanvas()
                }
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Try again
              </button>

              <Link
                href="/canvas"
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              >
                Back to Canvas
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!canvas) {
    return null;
  }

  return (
    <main
      ref={workspaceRef}
      className="min-h-screen overflow-hidden bg-zinc-950 text-white"
    >
      <div className="flex min-h-screen flex-col">
        <header className="relative z-30 flex min-h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-zinc-950/90 px-4 backdrop-blur-xl md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/canvas"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Back to canvases"
            >
              ←
            </Link>

            <div className="min-w-0">
              <input
                value={canvas.name}
                onChange={(event) =>
                  updateCanvas(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                className="w-full max-w-[420px] truncate bg-transparent text-base font-semibold outline-none placeholder:text-zinc-600 md:text-lg"
                placeholder="Untitled Canvas"
              />

              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    saving
                      ? "bg-amber-400"
                      : isDirty
                        ? "bg-sky-400"
                        : "bg-emerald-400"
                  }`}
                />

                <span>
                  {saving
                    ? "Saving…"
                    : isDirty
                      ? "Unsaved changes"
                      : lastSaved
                        ? `Saved ${lastSaved.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Ready"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(
                  (current) => !current
                )
              }
              className="hidden rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 md:inline-flex"
            >
              {sidebarOpen
                ? "Hide panel"
                : "Show panel"}
            </button>

            <button
              type="button"
              onClick={() =>
                void saveCanvas()
              }
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : "Save"}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="relative min-w-0 flex-1 overflow-hidden">
            <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  addNode("note")
                }
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
              >
                + Note
              </button>

              <button
                type="button"
                onClick={() =>
                  addNode("idea")
                }
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
              >
                ✦ Idea
              </button>

              <button
                type="button"
                onClick={() =>
                  addNode("task")
                }
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
              >
                ✓ Task
              </button>

              <button
                type="button"
                onClick={() =>
                  addNode("text")
                }
                className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
              >
                + Text
              </button>
            </div>

            <div
              className="relative h-full min-h-[700px] overflow-auto"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)",
                backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
              }}
            >
              <div
                className="relative min-h-[1400px] min-w-[1800px] origin-top-left transition-transform duration-150"
                style={{
                  transform: `scale(${zoom})`,
                  width: `${100 / zoom}%`,
                }}
              >
                {canvas.nodes.map(
                  (node) => {
                    const style =
                      getNodeStyle(node.type);

                    const isSelected =
                      node.id === selectedNodeId;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() =>
                          setSelectedNodeId(
                            node.id
                          )
                        }
                        className={`absolute overflow-hidden rounded-2xl border bg-zinc-900/95 text-left shadow-2xl backdrop-blur transition ${
                          isSelected
                            ? "border-white ring-2 ring-white/20"
                            : `${style.accent} hover:-translate-y-0.5 hover:bg-zinc-900`
                        }`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width:
                            node.width ??
                            280,
                          minHeight:
                            node.height ??
                            180,
                        }}
                      >
                        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${style.badge}`}
                          >
                            <span>
                              {style.icon}
                            </span>
                            {node.type}
                          </span>

                          <span className="text-xs text-zinc-600">
                            •••
                          </span>
                        </div>

                        <div className="p-4">
                          <h3 className="truncate font-semibold text-white">
                            {node.title}
                          </h3>

                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-zinc-400">
                            {node.content ||
                              "Add content to this canvas item."}
                          </p>
                        </div>
                      </button>
                    );
                  }
                )}

                {canvas.nodes.length ===
                  0 && (
                  <div className="absolute left-1/2 top-[320px] w-full max-w-md -translate-x-1/2 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl">
                      ✦
                    </div>

                    <h2 className="mt-5 text-xl font-semibold">
                      Start building
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Add ideas, notes, tasks and
                      documents to create your
                      workspace.
                    </p>

                    <div className="mt-5 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          addNode("idea")
                        }
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                      >
                        Add idea
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          addNode("note")
                        }
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
                      >
                        Add note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-zinc-950/90 p-1.5 shadow-2xl backdrop-blur">
              <button
                type="button"
                onClick={handleZoomOut}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Zoom out"
              >
                −
              </button>

              <button
                type="button"
                onClick={resetZoom}
                className="min-w-16 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                {Math.round(zoom * 100)}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Zoom in"
              >
                +
              </button>

              <div className="mx-1 h-5 w-px bg-white/10" />

              <button
                type="button"
                onClick={() =>
                  void toggleFullscreen()
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Toggle fullscreen"
              >
                {fullscreen ? "⊙" : "⛶"}
              </button>
            </div>
          </section>

          {sidebarOpen && (
            <aside className="hidden w-[360px] shrink-0 border-l border-white/[0.07] bg-zinc-950 xl:block">
              <div className="flex h-full flex-col">
                <div className="border-b border-white/[0.07] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                    Inspector
                  </p>

                  <h2 className="mt-2 text-lg font-semibold">
                    {selectedNode
                      ? "Node details"
                      : "Canvas overview"}
                  </h2>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {selectedNode ? (
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Type
                        </label>

                        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm capitalize text-zinc-300">
                          {
                            selectedNode.type
                          }
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Title
                        </label>

                        <input
                          value={
                            selectedNode.title
                          }
                          onChange={(
                            event
                          ) =>
                            updateSelectedNode(
                              {
                                title:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Content
                        </label>

                        <textarea
                          value={
                            selectedNode.content ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateSelectedNode(
                              {
                                content:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                          rows={9}
                          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-zinc-300 outline-none transition focus:border-white/30"
                          placeholder="Write something..."
                        />
                      </div>

                      <button
                        type="button"
                        onClick={
                          deleteSelectedNode
                        }
                        className="w-full rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
                      >
                        Delete node
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Nodes
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                          {
                            canvas.nodes
                              .length
                          }
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Connections
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                          {
                            canvas.edges
                              .length
                          }
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                          Description
                        </label>

                        <textarea
                          value={
                            canvas.description ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateCanvas(
                              (
                                current
                              ) => ({
                                ...current,
                                description:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          rows={6}
                          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-zinc-300 outline-none focus:border-white/30"
                          placeholder="Describe this canvas..."
                        />
                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-transparent p-4">
                        <p className="font-medium">
                          AI workspace ready
                        </p>

                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          This canvas structure is
                          ready to connect with agents,
                          projects, documents and
                          automation workflows.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}