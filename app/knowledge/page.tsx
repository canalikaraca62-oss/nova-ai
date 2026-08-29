"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  BookOpen,
  Brain,
  FileText,
  FolderPlus,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

type KnowledgeType =
  | "document"
  | "note"
  | "research"
  | "dataset";

interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  type: KnowledgeType;
  updatedAt: string;
  tags: string[];
}

const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: "ai-strategy",
    title: "AI Strategy & Architecture",
    description:
      "Core architecture, product strategy and AI system decisions.",
    type: "research",
    updatedAt: "Recently updated",
    tags: ["AI", "Architecture", "Strategy"],
  },
  {
    id: "product-research",
    title: "Product Research",
    description:
      "Research, market analysis and product discovery notes.",
    type: "research",
    updatedAt: "Updated today",
    tags: ["Research", "Product"],
  },
  {
    id: "technical-docs",
    title: "Technical Documentation",
    description:
      "Engineering documentation, APIs and implementation details.",
    type: "document",
    updatedAt: "Updated yesterday",
    tags: ["Engineering", "API"],
  },
  {
    id: "user-insights",
    title: "User Insights",
    description:
      "Customer feedback, interviews and behavioral insights.",
    type: "dataset",
    updatedAt: "Updated 2 days ago",
    tags: ["Users", "Insights"],
  },
];

const TYPE_LABELS: Record<
  KnowledgeType,
  string
> = {
  document: "Document",
  note: "Note",
  research: "Research",
  dataset: "Dataset",
};

function getTypeIcon(type: KnowledgeType) {
  switch (type) {
    case "research":
      return Brain;

    case "dataset":
      return Sparkles;

    case "note":
      return BookOpen;

    case "document":
    default:
      return FileText;
  }
}

export default function KnowledgePage() {
  const [query, setQuery] =
    useState("");

  const [selectedType, setSelectedType] =
    useState<KnowledgeType | "all">(
      "all"
    );

  const [isCreating, setIsCreating] =
    useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    return KNOWLEDGE_ITEMS.filter(
      (item) => {
        const matchesType =
          selectedType === "all" ||
          item.type === selectedType;

        if (!matchesType) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchableContent = [
          item.title,
          item.description,
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();

        return searchableContent.includes(
          normalizedQuery
        );
      }
    );
  }, [query, selectedType]);

  const handleCreateKnowledge =
    useCallback(async () => {
      setIsCreating(true);

      try {
        await new Promise((resolve) =>
          setTimeout(resolve, 500)
        );
      } finally {
        setIsCreating(false);
      }
    }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-8">
        <section className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Knowledge Intelligence
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Knowledge Base
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Organize documents, research and
                intelligence in one powerful workspace.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleCreateKnowledge();
            }}
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}

            Create knowledge
          </button>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Knowledge items
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {KNOWLEDGE_ITEMS.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <FileText className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Documents
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {
                    KNOWLEDGE_ITEMS.filter(
                      (item) =>
                        item.type ===
                        "document"
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Brain className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Research
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {
                    KNOWLEDGE_ITEMS.filter(
                      (item) =>
                        item.type ===
                        "research"
                    ).length
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <FolderPlus className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Categories
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  4
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
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search knowledge..."
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedType("all")
                }
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedType === "all"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                All
              </button>

              {(
                Object.keys(
                  TYPE_LABELS
                ) as KnowledgeType[]
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setSelectedType(type)
                  }
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedType === type
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const Icon =
                getTypeIcon(item.type);

              return (
                <Link
                  key={item.id}
                  href={`/knowledge/${item.id}`}
                  className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>

                    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      {TYPE_LABELS[item.type]}
                    </span>
                  </div>

                  <h2 className="mt-5 text-lg font-semibold text-foreground">
                    {item.title}
                  </h2>

                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                    {item.updatedAt}
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />

              <h2 className="mt-4 text-lg font-semibold">
                No knowledge found
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Try changing your search or filters.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}