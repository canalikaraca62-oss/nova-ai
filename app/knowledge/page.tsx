"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  BookOpen,
  Brain,
  FileText,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

/*
  SYRAVEN — Knowledge

  WHAT THIS PAGE SHOWS

  The caller's own knowledge rows, from GET /api/knowledge on their
  session. public.knowledge is owner-scoped by RLS (auth.uid() =
  user_id), so somebody else's rows are not filtered out here -- they
  are never returned.

  WHAT IT USED TO SHOW

  A module-scope array of six invented items presented as the user's
  own knowledge base: "AI Strategy & Architecture", "Product Research",
  "Technical Documentation", each stamped "Recently updated" or
  "Updated today" and tagged. None of it was anybody's data, the search
  box filtered fiction, and the counters above counted the same
  fiction.

  "Create knowledge" was worse: it awaited a 500ms timer and resolved,
  having created nothing. The spinner ran and the list was unchanged.

  WHAT IS DELIBERATELY ABSENT

  A category count. The tile read "Categories: 4" -- a literal, not a
  count of anything. The type filter below already shows which types
  exist, so the tile said nothing true that the filter does not say
  honestly.

  Creating from this page. POST /api/knowledge requires a title and
  this page has no title field, so the control states that rather than
  inventing one.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

type KnowledgeType =
  | "document"
  | "note"
  | "research"
  | "dataset";

/** A knowledge row exactly as /api/knowledge returns it. */
interface KnowledgeRow {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  tags: string[] | null;
  updated_at: string | null;
}

const TYPE_LABELS: Record<KnowledgeType, string> = {
  document: "Document",
  note: "Note",
  research: "Research",
  dataset: "Dataset",
};

const KNOWN_TYPES: readonly KnowledgeType[] = [
  "document",
  "note",
  "research",
  "dataset",
];

/**
 * Narrows the free-text `type` column to a type this page can label.
 *
 * The column is text with no CHECK constraint, so a row can hold
 * something this UI has never heard of. Those are shown as documents
 * rather than hidden, because a row the user created should not vanish
 * from their own list over a label.
 */
function typeOf(value: string | null): KnowledgeType {
  return KNOWN_TYPES.includes(value as KnowledgeType)
    ? (value as KnowledgeType)
    : "document";
}

function getTypeIcon(type: KnowledgeType) {
  if (type === "research") return Brain;
  if (type === "dataset") return Sparkles;
  if (type === "note") return BookOpen;

  return FileText;
}

/** Real timestamps only. An empty cell beats an invented "today". */
function formatUpdated(value: string | null): string {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] =
    useState<KnowledgeType | "all">("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/knowledge?limit=100", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setItems([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: KnowledgeRow[];
      } | null;

      setItems(payload?.data ?? []);
    } catch {
      setLoadError("Your knowledge could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      if (
        selectedType !== "all" &&
        typeOf(item.type) !== selectedType
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const searchableContent = [
        item.title,
        item.description ?? "",
        ...(item.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableContent.includes(normalizedQuery);
    });
  }, [items, query, selectedType]);

  const documentCount = useMemo(
    () =>
      items.filter((item) => typeOf(item.type) === "document").length,
    [items],
  );

  return (
    /*
      A plain container, not a second <main>: AppChrome already emits
      the page main landmark, and two of them is invalid HTML.
    */
    <div className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8 lg:py-10">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="hidden rounded-2xl bg-primary/10 p-3 text-primary sm:block">
              <Brain className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Knowledge
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Documents, research and notes you have saved.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              disabled
              aria-describedby="knowledge-create-availability"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground opacity-60"
            >
              <Plus className="h-4 w-4" />

              Create knowledge
            </button>

            <p
              id="knowledge-create-availability"
              className="max-w-xs text-xs leading-5 text-muted-foreground sm:text-right"
            >
              Creating from this page is not available yet.
            </p>
          </div>
        </section>

        {/*
          Two counts, both of real rows. A third tile used to read
          "Categories: 4" -- a literal, counting nothing.
        */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
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
                  {isLoading ? "—" : items.length}
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
                  {isLoading ? "—" : documentCount}
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search knowledge..."
                aria-label="Search knowledge"
                className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", ...KNOWN_TYPES] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  aria-pressed={selectedType === type}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm transition-colors",
                    selectedType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  {type === "all" ? "All" : TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {loadError ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {loadError}

              <button
                type="button"
                onClick={() => void load()}
                className="ml-3 font-medium underline"
              >
                Try again
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground"
            >
              Loading your knowledge...
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const type = typeOf(item.type);
                const Icon = getTypeIcon(type);
                const updated = formatUpdated(item.updated_at);

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
                        {TYPE_LABELS[type]}
                      </span>
                    </div>

                    <h2 className="mt-5 text-lg font-semibold text-foreground">
                      {item.title}
                    </h2>

                    {item.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}

                    {item.tags && item.tags.length > 0 ? (
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
                    ) : null}

                    {updated ? (
                      <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                        Updated {updated}
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}

          {!isLoading && filteredItems.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {items.length === 0
                  ? "Nothing saved yet"
                  : "No matches"}
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {items.length === 0
                  ? "Documents, research and notes you save will appear here."
                  : "No knowledge matches this search or type."}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
