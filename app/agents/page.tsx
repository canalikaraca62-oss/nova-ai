"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  Bot,
  Compass,
  LayoutGrid,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

/*
  SYRAVEN — Agents

  WHAT THIS PAGE SHOWS

  The caller's own agents, from GET /api/agents on their session.
  public.agents is owner-scoped, so another person's agents are never
  returned rather than filtered out here.

  Note the envelope: this route answers { success, agents: [...] }, not
  { data }. /api/projects and /api/knowledge use `data`. Assuming a
  shared envelope across routes has already silently emptied one page
  in this codebase, so the key is read explicitly.

  WHAT IT USED TO SHOW

  A module-scope array of twelve invented agents with an invented
  taxonomy: category, featured, premium, popular, a colour gradient and
  a tag list. public.agents has none of those columns. The search box
  filtered fiction, the category chips filtered fiction, and a
  "Featured" rail showed four of them.

  Three hero tiles read "{agents.length}+", "24/7" and "∞". The first
  put a plus on the exact length of a hardcoded array; the others
  measured nothing at all.

  A heart button toggled a `favorites` array in local state. Nothing
  stored it, so every favourite vanished on reload -- the same
  fake-persistence defect removed from a dozen surfaces here.

  WHAT IS DELIBERATELY ABSENT

  Categories, tags, featured and premium flags. Adding a taxonomy means
  adding columns, and inventing one in the client to make the filter
  bar look busy is how this page got here.

  Favourites, until something stores them.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/** An agent row exactly as /api/agents returns it. */
interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  visibility: string | null;
  model: string | null;
  updated_at: string | null;
}

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/agents", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setAgents([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      /* `agents`, not `data` — see the note at the top of this file. */
      const payload = (await response.json().catch(() => null)) as {
        agents?: AgentRow[];
      } | null;

      setAgents(payload?.agents ?? []);
    } catch {
      setLoadError("Your agents could not be loaded.");
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

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return agents;

    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        (agent.description ?? "").toLowerCase().includes(query),
    );
  }, [agents, search]);

  return (
    /*
      A plain container, not a second <main>: AppChrome already emits
      the page main landmark, and two of them is invalid HTML.
    */
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 sm:p-8 lg:p-10">
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles size={14} />
                SYRAVEN Intelligence Network
              </div>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Not a single AI.
                <span className="block text-primary">
                  Your own AI team.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Agents you have created, and the work they are set up
                to do.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/agents/create"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus size={18} />
                Create agent
              </Link>

              <Link
                href="/marketplace"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border px-5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Marketplace
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          {/*
            One count, of real rows. Three tiles used to sit here
            reading "{agents.length}+", "24/7" and "∞" — a plus sign on
            an exact number, and two figures measuring nothing.
          */}
          <div className="relative mt-10 border-t border-border pt-6">
            <p className="text-2xl font-semibold tracking-tight">
              {isLoading ? "—" : agents.length}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {agents.length === 1 ? "Agent" : "Agents"} you have
              created
            </p>
          </div>
        </section>

        {/* SEARCH */}
        <section className="mt-14">
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                <Compass size={14} />
                Agent Explorer
              </div>

              <h2 className="text-2xl font-semibold tracking-tight">
                Find the right agent for the job
              </h2>
            </div>

            <div className="relative">
              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search agents..."
                aria-label="Search agents"
                className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
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

          {/* AGENTS */}
          <div className="mt-8">
            <div className="mb-5 flex items-center gap-2">
              <LayoutGrid size={17} className="text-muted-foreground" />

              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {isLoading ? "—" : filteredAgents.length}
                </span>{" "}
                {filteredAgents.length === 1 ? "agent" : "agents"}
              </p>
            </div>

            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-[300px] items-center justify-center rounded-[2rem] border border-dashed border-border px-6 text-center text-sm text-muted-foreground"
              >
                Loading your agents...
              </div>
            ) : filteredAgents.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Search size={23} />
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  {agents.length === 0
                    ? "No agents yet"
                    : "No agents found"}
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {agents.length === 0
                    ? "Agents you create will appear here."
                    : "Try a different search."}
                </p>

                {agents.length === 0 ? (
                  <Link
                    href="/agents/create"
                    className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Plus size={18} />
                    Create agent
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* CREATE CTA */}
        <section className="mt-14 overflow-hidden rounded-[2rem] border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted">
                <Bot size={22} />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Create your own AI specialist.
              </h2>

              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Define an agent&apos;s role, speciality and way of
                working.
              </p>
            </div>

            <Link
              href="/agents/create"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus size={18} />
              Create new agent
            </Link>
          </div>
        </section>

        {/* WHAT THE ARCHITECTURE GUARANTEES */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<ShieldCheck size={20} />}
            title="User control"
            description="An agent asks for explicit confirmation before taking action in the outside world."
          />

          <InfoCard
            icon={<Users size={20} />}
            title="Built for teams"
            description="The agent architecture supports personal, workspace, team and enterprise use."
          />

          <InfoCard
            icon={<TrendingUp size={20} />}
            title="Scalable architecture"
            description="Designed to grow with marketplace, workflow, memory and connected applications."
          />
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   PIECES                                   */
/* -------------------------------------------------------------------------- */

function AgentCard({ agent }: { agent: AgentRow }) {
  const updated = formatUpdated(agent.updated_at);

  return (
    <div className="group rounded-[1.6rem] border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted">
          <Bot size={22} />
        </div>

        {agent.status ? (
          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {agent.status}
          </span>
        ) : null}
      </div>

      <h3 className="mt-5 font-semibold tracking-tight">
        {agent.name}
      </h3>

      {agent.description ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {agent.description}
        </p>
      ) : null}

      {agent.model ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {agent.model}
        </p>
      ) : null}

      {updated ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Updated {updated}
        </p>
      ) : null}

      <Link
        href={`/agents/${agent.id}`}
        className="mt-6 flex h-11 items-center justify-between rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
      >
        Open agent
        <ArrowRight size={17} />
      </Link>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold">{title}</h3>

      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
