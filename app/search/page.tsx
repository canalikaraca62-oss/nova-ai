"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  FileText,
  FolderKanban,
  ListTodo,
  Loader2,
  Search as SearchIcon,
  SlidersHorizontal,
} from "lucide-react";

/*
  SYRAVEN — Universal search

  WHY THIS PAGE EXISTS

  /search was a destination with no page. It was linked from the desktop
  sidebar, the mobile nav, the command palette, and — the one a user
  could actually reach — the /apps catalogue, where "Research Engine →
  Open application" led to a 404.

  The repository-wide link audit reported zero dead links throughout,
  because its collector matched only `href="..."` string literals and
  could not see the `href:` object properties that /apps uses to declare
  its catalogue. The audit has been widened; this page is the fix for
  what it then found.

  WHAT IT IS BUILT ON

  /api/search, which already existed and is genuinely solid: session
  scoped through withAuth, rate limited (60/min — search is cheap to
  issue and expensive to serve), entity-allowlisted, and tenancy-proven
  rather than tenancy-filtered. Nothing new was needed on the server.

  THE VOCABULARY IS THE SERVER'S

  Three entities: project, task, knowledge. Not "documents", not
  "messages" — lib/search/types.ts is explicit that messages and
  agent_runs are excluded because their ownership is inferred rather
  than owned, and no documents table exists. This page offers exactly
  what the server will answer for, so a filter can never promise a
  result class that cannot be returned.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/** Mirrors SEARCHABLE_ENTITIES in lib/search/types.ts. */
const ENTITIES = ["project", "task", "knowledge"] as const;

type Entity = (typeof ENTITIES)[number];

/** Mirrors SEARCH_LIMITS. Enforced server-side; repeated here to guide. */
const MIN_QUERY = 2;
const MAX_QUERY = 200;
const PAGE_SIZE = 20;

interface SearchHit {
  id: string;
  type: Entity;
  title: string;
  snippet: string | null;
  score: number;
  updatedAt: string | null;
}

interface SearchPayload {
  results?: SearchHit[];
  pagination?: {
    /*
     * Deliberately not a total. The route's own note explains why: an
     * exact count is an inference channel about rows the caller cannot
     * read.
     */
    hasMore?: boolean;
  };
}

const ENTITY_META: Record<
  Entity,
  { label: string; plural: string; icon: typeof FolderKanban; href: (id: string) => string }
> = {
  project: {
    label: "Project",
    plural: "Projects",
    icon: FolderKanban,
    href: (id) => `/projects/${id}`,
  },
  task: {
    label: "Task",
    plural: "Tasks",
    icon: ListTodo,
    href: (id) => `/tasks/${id}`,
  },
  knowledge: {
    label: "Knowledge",
    plural: "Knowledge",
    icon: FileText,
    href: (id) => `/knowledge/${id}`,
  },
};

/**
 * Renders a timestamp identically on the server and in the browser.
 *
 * toLocaleDateString() formats against the runtime's locale and
 * timezone, which differ between the two and surface as a hydration
 * mismatch. A fixed ISO slice is stable.
 */
function formatUpdatedAt(value: string | null): string | null {
  return value === null ? null : value.slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function SearchPage() {
  const [query, setQuery] = useState("");

  /** The query the current results actually belong to. */
  const [submitted, setSubmitted] = useState("");

  const [selected, setSelected] = useState<Entity[]>([...ENTITIES]);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /** Distinguishes "no results" from "you have not searched yet". */
  const [hasSearched, setHasSearched] = useState(false);

  const trimmed = query.trim();

  const canSearch =
    trimmed.length >= MIN_QUERY && trimmed.length <= MAX_QUERY;

  const runSearch = useCallback(
    async (term: string, entities: Entity[]) => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          q: term,
          limit: String(PAGE_SIZE),
        });

        /*
          Omitted entirely when everything is selected: the server reads
          an absent `type` as "all", and sending the full list would be
          the same request in a longer form.
        */
        if (entities.length > 0 && entities.length < ENTITIES.length) {
          params.set("type", entities.join(","));
        }

        const response = await fetch(`/api/search?${params.toString()}`, {
          cache: "no-store",
        });

        if (response.status === 401) {
          /*
            `hasSearched` is deliberately NOT set here.

            It was, and the result was a page asserting two
            contradictory things at once: the sign-in alert, and "No
            matches" underneath it. The second is a claim that the
            search ran and the workspace held nothing — when in truth
            it never ran at all. A refusal is not an empty result, and
            showing it as one is the same fabrication this page exists
            to avoid.
          */
          setSearchError("Sign in to search your workspace.");
          setHits([]);
          return;
        }

        if (response.status === 429) {
          /*
            Named rather than folded into a generic failure: this one the
            user can act on by waiting, and saying so is kinder than
            "something went wrong".
          */
          setSearchError("Too many searches just now. Try again shortly.");
          return;
        }

        if (!response.ok) throw new Error("failed");

        const payload = (await response.json()) as SearchPayload;

        setHits(payload.results ?? []);
        setHasMore(payload.pagination?.hasMore === true);
        setSubmitted(term);

        /*
          Set only on a search the server actually answered, so "No
          matches" can never stand in for a refusal.
        */
        setHasSearched(true);
      } catch {
        setSearchError("That search could not be completed.");
        setHits([]);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSearch || isSearching) return;

    void runSearch(trimmed, selected);
  };

  /*
    Filter changes re-search from the HANDLER, not from an effect.

    An effect watching `selected` was the obvious shape and the wrong
    one: it sets state during render-commit, which is what
    react-hooks/set-state-in-effect warns about, and it re-fires on any
    dependency change rather than on the user's actual intent. Toggling
    a filter is a discrete user action, so the request belongs where the
    action is.
  */
  const toggleEntity = (entity: Entity) => {
    const next = selected.includes(entity)
      ? selected.filter((value) => value !== entity)
      : [...selected, entity];

    /*
      Never leave nothing selected. An empty entity list would be sent
      as "all" by the server, so the UI would show every filter off
      while returning everything — a control contradicting its own
      result.
    */
    const resolved = next.length === 0 ? [entity] : next;

    setSelected(resolved);

    /* Only re-search once a search has actually been made. */
    if (submitted.length > 0) {
      void runSearch(submitted, resolved);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<Entity, SearchHit[]>();

    for (const hit of hits) {
      const bucket = map.get(hit.type) ?? [];
      bucket.push(hit);
      map.set(hit.type, bucket);
    }

    return map;
  }, [hits]);

  return (
    /*
      A plain container, not a second <main>: AppShell (mounted by
      app/search/layout.tsx) already emits the page main landmark, and
      two of them is invalid HTML.
    */
    <div className="w-full">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Search</h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Search across the projects, tasks and knowledge you have
            access to. Results are scoped to your account.
          </p>
        </header>

        {/* Query */}
        <form onSubmit={handleSubmit} className="mt-8">
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={MAX_QUERY}
              placeholder="Search projects, tasks and knowledge..."
              aria-label="Search your workspace"
              aria-describedby="search-hint"
              className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-32 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />

            <button
              type="submit"
              disabled={!canSearch || isSearching}
              className="absolute right-2 top-1/2 flex h-10 -translate-y-1/2 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching
                </>
              ) : (
                "Search"
              )}
            </button>
          </div>

          <p
            id="search-hint"
            className="mt-2 pl-1 text-xs text-muted-foreground"
          >
            {trimmed.length > 0 && trimmed.length < MIN_QUERY
              ? `Enter at least ${MIN_QUERY} characters.`
              : `Between ${MIN_QUERY} and ${MAX_QUERY} characters.`}
          </p>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              Filter
            </span>

            {ENTITIES.map((entity) => {
              const active = selected.includes(entity);
              const meta = ENTITY_META[entity];

              return (
                <button
                  key={entity}
                  type="button"
                  onClick={() => toggleEntity(entity)}
                  aria-pressed={active}
                  className={[
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {meta.plural}
                </button>
              );
            })}
          </div>
        </form>

        {/* Error */}
        {searchError ? (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {searchError}
          </div>
        ) : null}

        {/* Results */}
        <section className="mt-8">
          {isSearching ? (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-center"
            >
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />

              <p className="mt-4 text-sm text-muted-foreground">
                Searching your workspace...
              </p>
            </div>
          ) : !hasSearched ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center">
              <SearchIcon
                aria-hidden="true"
                className="h-7 w-7 text-muted-foreground"
              />

              <h2 className="mt-4 text-lg font-semibold">
                Search your workspace
              </h2>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Find a project, a task, or something you saved to
                knowledge.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center">
              <h2 className="text-lg font-semibold">No matches</h2>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Nothing matched &ldquo;{submitted}&rdquo; in the areas you
                have selected.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {ENTITIES.filter((entity) => grouped.has(entity)).map(
                (entity) => {
                  const meta = ENTITY_META[entity];
                  const Icon = meta.icon;
                  const bucket = grouped.get(entity) ?? [];

                  return (
                    <div key={entity}>
                      <div className="mb-3 flex items-center gap-2">
                        <Icon
                          aria-hidden="true"
                          className="h-4 w-4 text-muted-foreground"
                        />

                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {meta.plural}
                        </h2>

                        <span className="text-xs text-muted-foreground">
                          {bucket.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {bucket.map((hit) => {
                          const updated = formatUpdatedAt(hit.updatedAt);

                          return (
                            <Link
                              key={`${hit.type}-${hit.id}`}
                              href={meta.href(hit.id)}
                              className="group block rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <h3 className="font-medium leading-6 text-foreground">
                                  {hit.title}
                                </h3>

                                {updated ? (
                                  <time
                                    dateTime={hit.updatedAt ?? undefined}
                                    className="shrink-0 text-xs text-muted-foreground"
                                  >
                                    {updated}
                                  </time>
                                ) : null}
                              </div>

                              {hit.snippet ? (
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                  {hit.snippet}
                                </p>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}

              {hasMore ? (
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  More results exist. Narrow your search to see them.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
