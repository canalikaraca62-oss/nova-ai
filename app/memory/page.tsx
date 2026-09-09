"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Brain,
  Calendar,
  Database,
  Filter,
  Loader2,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

type MemoryCategory =
  | "All"
  | "Personal"
  | "Project"
  | "Preference"
  | "Knowledge";

type Importance = "Low" | "Medium" | "High";

interface MemoryItem {
  id: string;
  title: string;
  content: string;
  category: Exclude<MemoryCategory, "All">;
  importance: Importance;
  createdAt: string;
  pinned: boolean;
}

/*
 * MEMORY IS REAL STORAGE, NOT A MOCK.
 *
 * This page used to open on four invented memories — a "Product
 * vision", "Development preferences", a "Workspace context" — that no
 * user had ever written, seeded straight into useState. Creating one
 * more slept 400ms to imitate a save, minted an id from Date.now(), and
 * pushed it into that same array. Everything vanished on reload, and
 * nothing was ever the user's own.
 *
 * The records now come from public.knowledge through /api/knowledge,
 * which is the product's real memory store: it already carries the
 * hierarchy (user / project / workspace / org), visibility and status
 * that lib/memory/hierarchy.ts describes, and its route enforces the
 * tenant guards. No new table was invented for this screen.
 *
 * The mapping:
 *
 *   category   -> knowledge.type      (note | document | dataset | text)
 *   importance -> metadata.importance
 *   pinned     -> metadata.pinned
 *
 * Importance and pinning live in metadata because they are this
 * screen's presentation of a record, not properties of the record
 * itself, and metadata is already persisted and returned by the API.
 */

/** How a memory category maps onto the knowledge type vocabulary. */
const CATEGORY_TO_TYPE: Record<
  Exclude<MemoryCategory, "All">,
  string
> = {
  Personal: "note",
  Project: "document",
  Preference: "text",
  Knowledge: "dataset",
};

const TYPE_TO_CATEGORY: Record<
  string,
  Exclude<MemoryCategory, "All">
> = {
  note: "Personal",
  document: "Project",
  text: "Preference",
  dataset: "Knowledge",
};

/** A knowledge row as this page consumes it. */
interface KnowledgeRow {
  id: string;
  title: string;
  content: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function readImportance(
  metadata: Record<string, unknown> | null
): Importance {
  const value = metadata?.importance;

  return value === "High" ||
    value === "Medium" ||
    value === "Low"
    ? value
    : "Medium";
}

/*
 * Renders a timestamp identically on the server and in the browser.
 *
 * toLocaleDateString() would format against the runtime's locale and
 * timezone, which differ between the two, producing a hydration
 * mismatch. Slicing the ISO date keeps one stable value.
 */
function formatCreatedAt(value: string): string {
  return value.slice(0, 10);
}

function toMemoryItem(
  row: KnowledgeRow
): MemoryItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? "",
    category:
      TYPE_TO_CATEGORY[row.type] ?? "Knowledge",
    importance: readImportance(row.metadata),
    createdAt: row.created_at,
    pinned: row.metadata?.pinned === true,
  };
}

const CATEGORIES: MemoryCategory[] = [
  "All",
  "Personal",
  "Project",
  "Preference",
  "Knowledge",
];

const IMPORTANCE_ORDER: Record<
  Importance,
  number
> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export default function MemoryPage() {
  const [memories, setMemories] =
    useState<MemoryItem[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [memoryError, setMemoryError] =
    useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setMemoryError(null);

    try {
      const response = await fetch(
        "/api/knowledge?limit=100",
        { cache: "no-store" }
      );

      if (response.status === 401) {
        setMemories([]);
        return;
      }

      if (!response.ok) {
        throw new Error("failed");
      }

      const payload =
        (await response.json()) as {
          data?: KnowledgeRow[];
        };

      setMemories(
        (payload.data ?? []).map(toMemoryItem)
      );
    } catch {
      setMemoryError(
        "Your memory could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return loadMemories();
    });

    return () => {
      cancelled = true;
    };
  }, [loadMemories]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<MemoryCategory>("All");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [isCreating, setIsCreating] =
    useState(false);

  const [newTitle, setNewTitle] =
    useState("");

  const [newContent, setNewContent] =
    useState("");

  const [newCategory, setNewCategory] =
    useState<Exclude<
      MemoryCategory,
      "All"
    >>("Knowledge");

  const [newImportance, setNewImportance] =
    useState<Importance>("Medium");

  const filteredMemories = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return [...memories]
      .filter((memory) => {
        const matchesCategory =
          selectedCategory === "All" ||
          memory.category === selectedCategory;

        const searchableText = [
          memory.title,
          memory.content,
          memory.category,
          memory.importance,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !query ||
          searchableText.includes(query);

        return (
          matchesCategory &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        return (
          IMPORTANCE_ORDER[b.importance] -
          IMPORTANCE_ORDER[a.importance]
        );
      });
  }, [
    memories,
    searchQuery,
    selectedCategory,
  ]);

  const stats = useMemo(() => {
    return {
      total: memories.length,
      pinned: memories.filter(
        (memory) => memory.pinned
      ).length,
      highImportance: memories.filter(
        (memory) =>
          memory.importance === "High"
      ).length,
      categories: new Set(
        memories.map(
          (memory) => memory.category
        )
      ).size,
    };
  }, [memories]);

  const togglePinned = async (id: string) => {
    const target = memories.find(
      (memory) => memory.id === id
    );

    if (!target) {
      return;
    }

    const previous = memories;
    const pinned = !target.pinned;

    setMemories((current) =>
      current.map((memory) =>
        memory.id === id
          ? { ...memory, pinned }
          : memory
      )
    );

    try {
      const response = await fetch(
        "/api/knowledge",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            /*
              The whole metadata object is sent because PATCH replaces
              it rather than merging. Sending only { pinned } would
              silently drop the importance stored alongside it.
            */
            metadata: {
              importance: target.importance,
              pinned,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error("failed");
      }
    } catch {
      setMemories(previous);
      setMemoryError(
        "That memory could not be updated."
      );
    }
  };

  const deleteMemory = async (id: string) => {
    const previous = memories;

    setMemories((current) =>
      current.filter(
        (memory) => memory.id !== id
      )
    );

    try {
      const response = await fetch(
        `/api/knowledge?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("failed");
      }
    } catch {
      setMemories(previous);
      setMemoryError(
        "That memory could not be removed."
      );
    }
  };

  const resetCreateForm = () => {
    setNewTitle("");
    setNewContent("");
    setNewCategory("Knowledge");
    setNewImportance("Medium");
  };

  const handleCreateMemory = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const title = newTitle.trim();
    const content = newContent.trim();

    if (!title || !content || isCreating) {
      return;
    }

    setIsCreating(true);
    setMemoryError(null);

    try {
      /*
        The id comes from the SERVER. This used to sleep 400ms and mint
        one from Date.now(), so the memory existed only in the browser
        and its id matched no row anywhere.
      */
      const response = await fetch(
        "/api/knowledge",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            content,
            type: CATEGORY_TO_TYPE[newCategory],
            metadata: {
              importance: newImportance,
              pinned: false,
            },
          }),
        }
      );

      const payload =
        (await response
          .json()
          .catch(() => null)) as {
          data?: KnowledgeRow;
        } | null;

      const created = payload?.data;

      if (!response.ok || !created) {
        throw new Error("failed");
      }

      setMemories((current) => [
        toMemoryItem(created),
        ...current,
      ]);

      resetCreateForm();
      setShowCreateModal(false);
    } catch {
      setMemoryError(
        "That memory could not be saved."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const getImportanceClasses = (
    importance: Importance
  ) => {
    switch (importance) {
      case "High":
        return "border-primary/30 bg-primary/10 text-primary";

      case "Medium":
        return "border-border bg-muted text-muted-foreground";

      case "Low":
      default:
        return "border-border bg-background text-muted-foreground";
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-8">
        <section className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Persistent Intelligence
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Memory
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Manage the information SYRAVEN remembers to
              create more intelligent, personalized and
              context-aware experiences.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowCreateModal(true)
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add memory
          </button>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Brain className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Total memories
                </p>

                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Pin className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Pinned
                </p>

                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {stats.pinned}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  High importance
                </p>

                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {stats.highImportance}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Database className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Categories
                </p>

                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {stats.categories}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search memories..."
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              {filteredMemories.length} memories
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setSelectedCategory(category)
                }
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {memoryError ? (
            <div
              role="alert"
              className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {memoryError}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4">
            {filteredMemories.map((memory) => (
              <article
                key={memory.id}
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md sm:p-6"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Brain className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-foreground">
                            {memory.title}
                          </h2>

                          {memory.pinned && (
                            <Pin className="h-4 w-4 fill-current text-primary" />
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                            {memory.category}
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getImportanceClasses(
                              memory.importance
                            )}`}
                          >
                            {memory.importance}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            togglePinned(memory.id)
                          }
                          aria-label={
                            memory.pinned
                              ? "Unpin memory"
                              : "Pin memory"
                          }
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                            memory.pinned
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Pin className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteMemory(memory.id)
                          }
                          aria-label="Delete memory"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          aria-label="More options"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
                      {memory.content}
                    </p>

                    <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <time dateTime={memory.createdAt}>
                        {formatCreatedAt(memory.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />

              <p className="mt-4 text-sm text-muted-foreground">
                Loading your memory...
              </p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />

              {memories.length === 0 ? (
                <>
                  <h2 className="mt-4 text-lg font-semibold text-foreground">
                    Nothing remembered yet
                  </h2>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Anything you save here stays available to SYRAVEN
                    when it works on your behalf.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-5 text-sm font-medium text-primary hover:underline"
                  >
                    Add your first memory
                  </button>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-lg font-semibold text-foreground">
                    No memories found
                  </h2>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Try changing your search or category filter.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                    }}
                    className="mt-5 text-sm font-medium text-primary hover:underline"
                  >
                    Reset filters
                  </button>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Add memory
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Store important context for SYRAVEN.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateMemory}
              className="space-y-5 p-6"
            >
              <div>
                <label
                  htmlFor="memory-title"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Title
                </label>

                <input
                  id="memory-title"
                  value={newTitle}
                  onChange={(event) =>
                    setNewTitle(event.target.value)
                  }
                  placeholder="What should SYRAVEN remember?"
                  className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="memory-content"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Memory
                </label>

                <textarea
                  id="memory-content"
                  value={newContent}
                  onChange={(event) =>
                    setNewContent(event.target.value)
                  }
                  placeholder="Add important context..."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="memory-category"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Category
                  </label>

                  <select
                    id="memory-category"
                    value={newCategory}
                    onChange={(event) =>
                      setNewCategory(
                        event.target
                          .value as Exclude<
                          MemoryCategory,
                          "All"
                        >
                      )
                    }
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="Personal">
                      Personal
                    </option>
                    <option value="Project">
                      Project
                    </option>
                    <option value="Preference">
                      Preference
                    </option>
                    <option value="Knowledge">
                      Knowledge
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="memory-importance"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Importance
                  </label>

                  <select
                    id="memory-importance"
                    value={newImportance}
                    onChange={(event) =>
                      setNewImportance(
                        event.target
                          .value as Importance
                      )
                    }
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="Low">
                      Low
                    </option>
                    <option value="Medium">
                      Medium
                    </option>
                    <option value="High">
                      High
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="h-11 flex-1 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isCreating ||
                    !newTitle.trim() ||
                    !newContent.trim()
                  }
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Save memory
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}