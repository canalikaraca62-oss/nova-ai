"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
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

  SEARCH BY MEANING

  "Ask by meaning" embeds the question with the real provider and ranks
  the caller's indexed passages in the database. A record is searchable
  that way only once it has been indexed, and each card says whether it
  has -- from GET /api/knowledge/index, never assumed. The match figure
  is the similarity the database computed; when ranking was unavailable
  no figure is shown and the page says the results are unranked. When
  the deployment has no provider configured, the page says that instead
  of offering a search that cannot run.

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

/** Index state exactly as /api/knowledge/index reports it. */
type IndexStatus = "indexed" | "partial" | "failed";

/** One answer from /api/knowledge/semantic. */
interface SemanticResult {
  knowledgeId: string;
  title: string;
  excerpt: string;
  /** The database's cosine similarity, or null when ranking was unavailable. */
  similarity: number | null;
}

interface SemanticAnswer {
  results: SemanticResult[];
  degraded: boolean;
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

function indexLabel(status: IndexStatus | undefined): string {
  if (status === "partial") return "Continue indexing";
  if (status === "failed") return "Retry indexing";

  return "Index for meaning";
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

  /*
   * null = the index state could not be read, so nothing is claimed
   * either way: no "not configured", no "nothing indexed".
   */
  const [semanticAvailable, setSemanticAvailable] =
    useState<boolean | null>(null);
  const [indexStatus, setIndexStatus] =
    useState<Record<string, IndexStatus>>({});
  const [indexing, setIndexing] = useState<Record<string, boolean>>({});
  const [indexNotes, setIndexNotes] = useState<Record<string, string>>({});

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<SemanticAnswer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const [listResult, indexResult] = await Promise.allSettled([
      fetch("/api/knowledge?limit=100", { cache: "no-store" }),
      fetch("/api/knowledge/index", { cache: "no-store" }),
    ]);

    /* Index state first: its failure must not blank the list. */
    try {
      if (indexResult.status === "fulfilled" && indexResult.value.ok) {
        const payload = (await indexResult.value.json().catch(() => null)) as {
          data?: {
            available?: boolean;
            records?: { knowledgeId: string; status: IndexStatus }[];
          };
        } | null;

        setSemanticAvailable(payload?.data?.available === true);
        setIndexStatus(
          Object.fromEntries(
            (payload?.data?.records ?? []).map((record) => [
              record.knowledgeId,
              record.status,
            ]),
          ),
        );
      } else {
        setSemanticAvailable(null);
      }
    } catch {
      setSemanticAvailable(null);
    }

    try {
      if (listResult.status === "rejected") throw new Error("failed");

      const response = listResult.value;

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

  /**
   * Indexes one record. The card's state changes only from the server's
   * answer -- "indexed" appears when the server reports no passage left
   * without a vector, not when the request was sent.
   */
  const indexRecord = useCallback(async (knowledgeId: string) => {
    setIndexing((current) => ({ ...current, [knowledgeId]: true }));
    setIndexNotes((current) => {
      const next = { ...current };
      delete next[knowledgeId];
      return next;
    });

    try {
      const response = await fetch("/api/knowledge/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeId }),
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: {
          state?: "indexed" | "partial";
          remaining?: number | null;
          embeddedNow?: number;
          failed?: number;
        };
        error?: { message?: string };
      } | null;

      const progress = payload?.data;

      if (!response.ok || !progress?.state) {
        setIndexNotes((current) => ({
          ...current,
          [knowledgeId]: payload?.error?.message ?? "Indexing failed.",
        }));
        return;
      }

      const failed = progress.failed ?? 0;
      const nothingSucceeded = failed > 0 && (progress.embeddedNow ?? 0) === 0;

      setIndexStatus((current) => ({
        ...current,
        [knowledgeId]:
          progress.state === "indexed"
            ? "indexed"
            : nothingSucceeded
              ? "failed"
              : "partial",
      }));

      if (progress.state === "partial") {
        const remaining = progress.remaining;

        setIndexNotes((current) => ({
          ...current,
          [knowledgeId]:
            typeof remaining === "number"
              ? `${remaining} passage${remaining === 1 ? "" : "s"} still to index.${failed > 0 ? ` ${failed} failed this time.` : ""}`
              : "Partly indexed.",
        }));
      }
    } catch {
      setIndexNotes((current) => ({
        ...current,
        [knowledgeId]: "Indexing failed. Check your connection.",
      }));
    } finally {
      setIndexing((current) => {
        const next = { ...current };
        delete next[knowledgeId];
        return next;
      });
    }
  }, []);

  const ask = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmed = question.trim();
      if (!trimmed) return;

      setAsking(true);
      setAskError(null);

      try {
        const response = await fetch("/api/knowledge/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });

        const payload = (await response.json().catch(() => null)) as {
          data?: { results?: SemanticResult[]; degraded?: boolean };
          error?: { message?: string };
        } | null;

        if (!response.ok || !payload?.data) {
          setAnswer(null);
          setAskError(payload?.error?.message ?? "Search by meaning failed.");
          return;
        }

        setAnswer({
          results: payload.data.results ?? [],
          degraded: payload.data.degraded === true,
        });
      } catch {
        setAnswer(null);
        setAskError("Search by meaning failed. Check your connection.");
      } finally {
        setAsking(false);
      }
    },
    [question],
  );

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

  const indexedCount = useMemo(
    () => items.filter((item) => indexStatus[item.id] === "indexed").length,
    [items, indexStatus],
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

        <section
          aria-labelledby="knowledge-ask-heading"
          className="mt-8 rounded-2xl border border-border bg-card p-5"
        >
          <h2
            id="knowledge-ask-heading"
            className="text-base font-semibold text-foreground"
          >
            Ask by meaning
          </h2>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {semanticAvailable === false
              ? "Search by meaning is not configured on this deployment."
              : semanticAvailable === null
                ? "Finds records close in meaning, not only in wording."
                : `Finds records close in meaning, not only in wording. ${indexedCount} of ${items.length} indexed.`}
          </p>

          <form
            onSubmit={(event) => void ask(event)}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What did we decide about pricing?"
              aria-label="Ask your knowledge by meaning"
              maxLength={500}
              disabled={semanticAvailable === false}
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={
                semanticAvailable === false ||
                asking ||
                question.trim().length === 0
              }
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {asking ? "Searching..." : "Ask"}
            </button>
          </form>

          {askError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {askError}
            </p>
          ) : null}

          {answer ? (
            <div className="mt-4" aria-live="polite">
              {answer.degraded && answer.results.length > 0 ? (
                <p className="mb-3 text-xs text-muted-foreground">
                  These results are not ranked: similarity ranking was
                  unavailable.
                </p>
              ) : null}

              {answer.results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {semanticAvailable !== null && indexedCount === 0
                    ? "Nothing is indexed yet. Index a record below to search it by meaning."
                    : "No indexed record is close enough in meaning."}
                </p>
              ) : (
                <ol className="space-y-3">
                  {answer.results.map((result) => (
                    <li key={result.knowledgeId}>
                      <Link
                        href={`/knowledge/${result.knowledgeId}`}
                        className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {result.title}
                          </span>

                          {typeof result.similarity === "number" ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {Math.round(result.similarity * 100)}% match
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {result.excerpt}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
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
                const status = indexStatus[item.id];
                const note = indexNotes[item.id];

                /*
                  The whole card still opens the record: the title link
                  is stretched over it. The index control sits above
                  that layer as its own button -- a button nested inside
                  a link is invalid HTML and unreachable by keyboard.
                */
                return (
                  <article
                    key={item.id}
                    className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
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
                      <Link
                        href={`/knowledge/${item.id}`}
                        className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-primary"
                      >
                        {item.title}
                      </Link>
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

                    {semanticAvailable !== false ? (
                      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 text-xs">
                        {status === "indexed" ? (
                          <span className="rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                            Searchable by meaning
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void indexRecord(item.id)}
                            disabled={indexing[item.id] === true}
                            className="rounded-lg border border-border bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {indexing[item.id] ? "Indexing..." : indexLabel(status)}
                          </button>
                        )}

                        {note ? (
                          <span role="status" className="text-muted-foreground">
                            {note}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
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
