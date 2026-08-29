"use client";

import {
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

const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: "memory-1",
    title: "Product vision",
    content:
      "NOVA is being built as a large-scale intelligent platform that combines AI agents, knowledge, automation and powerful workspaces.",
    category: "Project",
    importance: "High",
    createdAt: "Updated today",
    pinned: true,
  },
  {
    id: "memory-2",
    title: "Development preferences",
    content:
      "Prefer clean TypeScript architecture, reusable components and scalable application structure.",
    category: "Preference",
    importance: "High",
    createdAt: "Updated today",
    pinned: true,
  },
  {
    id: "memory-3",
    title: "Workspace context",
    content:
      "The workspace should support research, building, automation, analysis and creative AI workflows.",
    category: "Project",
    importance: "High",
    createdAt: "Updated yesterday",
    pinned: false,
  },
  {
    id: "memory-4",
    title: "Interface preference",
    content:
      "Keep the interface modern, premium, minimal and focused on intelligent workflows.",
    category: "Preference",
    importance: "Medium",
    createdAt: "Updated yesterday",
    pinned: false,
  },
  {
    id: "memory-5",
    title: "Knowledge organization",
    content:
      "Important documents and research should be transformed into structured, searchable intelligence.",
    category: "Knowledge",
    importance: "Medium",
    createdAt: "Updated 2 days ago",
    pinned: false,
  },
  {
    id: "memory-6",
    title: "User workflow",
    content:
      "Users should be able to move seamlessly between conversations, projects, knowledge and autonomous agents.",
    category: "Personal",
    importance: "Low",
    createdAt: "Updated 3 days ago",
    pinned: false,
  },
];

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
    useState<MemoryItem[]>(
      INITIAL_MEMORIES
    );

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

  const togglePinned = (id: string) => {
    setMemories((current) =>
      current.map((memory) =>
        memory.id === id
          ? {
              ...memory,
              pinned: !memory.pinned,
            }
          : memory
      )
    );
  };

  const deleteMemory = (id: string) => {
    setMemories((current) =>
      current.filter(
        (memory) => memory.id !== id
      )
    );
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

    if (
      !newTitle.trim() ||
      !newContent.trim()
    ) {
      return;
    }

    setIsCreating(true);

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 400);
      });

      const memory: MemoryItem = {
        id: `memory-${Date.now()}`,
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        importance: newImportance,
        createdAt: "Just now",
        pinned: false,
      };

      setMemories((current) => [
        memory,
        ...current,
      ]);

      resetCreateForm();
      setShowCreateModal(false);
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
              Manage the information NOVA remembers to
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
                      {memory.createdAt}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredMemories.length === 0 && (
            <div className="mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />

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
            </div>
          )}
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
                  Store important context for NOVA.
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
                  placeholder="What should NOVA remember?"
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