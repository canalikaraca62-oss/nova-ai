"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";


type Team = {
  id: string;
  name: string;
  description: string;
  initials: string;
  color: string;
  createdAt: string;
};

/** A team row as this page consumes it. */
interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

/*
 * TEAMS ARE REAL ROWS.
 *
 * This page used to run entirely on a module-scope array: four invented
 * teams — "SYRAVEN Core", eighteen invented projects — staffed by
 * invented colleagues at @syraven.ai addresses. Creating a team built
 * an id from the name plus Date.now() and unshifted it; inviting and
 * removing people mutated the same array. Every change was gone on
 * reload and none of it was ever anybody's data.
 *
 * public.teams has existed since the enterprise-core migration with
 * owner-scoped RLS on all four verbs, but no route reached it. There is
 * one now, and this page uses it.
 *
 * MEMBERSHIP IS NOT STORED. There is no team_members table, and an
 * invitation is not a row — it is an email to somebody who may not hold
 * an account, with a token, an expiry and an acceptance step.
 * organization_invites already models that at the organisation level.
 * Rather than invent a weaker parallel, the roster is gone and the page
 * says where membership is actually managed.
 */

const TEAM_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
] as const;

/**
 * A stable colour per team, derived from its id.
 *
 * Teams have no colour column, and choosing at random per render would
 * make a card change colour between loads.
 */
function colorForTeam(id: string): string {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return TEAM_COLORS[hash % TEAM_COLORS.length]!;
}

function initialsFor(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "T";
}

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    description:
      row.description ?? "No description provided.",
    initials: initialsFor(row.name),
    color: colorForTeam(row.id),
    createdAt: row.created_at,
  };
}


function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    setTeamError(null);

    try {
      const response = await fetch("/api/teams", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setTeams([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json()) as {
        data?: TeamRow[];
      };

      const loaded = (payload.data ?? []).map(toTeam);

      setTeams(loaded);
      setSelectedTeamId((current) =>
        current || (loaded[0]?.id ?? ""),
      );
    } catch {
      setTeamError("Teams could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return loadTeams();
    });

    return () => {
      cancelled = true;
    };
  }, [loadTeams]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");


  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return teams;
    }

    return teams.filter((team) => {
      return (
        team.name.toLowerCase().includes(query) ||
        team.description.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, teams]);

  const selectedTeam = useMemo(() => {
    return teams.find((team) => team.id === selectedTeamId) ?? null;
  }, [selectedTeamId, teams]);

  /*
   * The headline counters used to sum invented member and project
   * totals off the seed array. Neither number is available: teams store
   * no membership and carry no project link.
   */

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newTeamName.trim();

    if (!name || isCreating) {
      return;
    }

    setIsCreating(true);
    setTeamError(null);

    try {
      /*
        The id comes from the SERVER. It used to be built from the team
        name plus Date.now(), so the team existed only in this tab and
        matched no row anywhere.
      */
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newTeamDescription.trim() || undefined,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as { data?: TeamRow } | null;

      const created = payload?.data;

      if (!response.ok || !created) {
        throw new Error("failed");
      }

      const team = toTeam(created);

      setTeams((currentTeams) => [team, ...currentTeams]);
      setSelectedTeamId(team.id);
      setNewTeamName("");
      setNewTeamDescription("");
      setShowCreateModal(false);
    } catch {
      setTeamError("That team could not be created.");
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteTeam(teamId: string) {
    const previous = teams;

    setTeams((currentTeams) =>
      currentTeams.filter((team) => team.id !== teamId),
    );

    if (selectedTeamId === teamId) {
      setSelectedTeamId("");
    }

    try {
      const response = await fetch(
        `/api/teams?id=${encodeURIComponent(teamId)}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("failed");
    } catch {
      setTeams(previous);
      setTeamError("That team could not be removed.");
    }
  }

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <section className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Workspace</span>
              <span className="text-foreground/30">/</span>
              <span>Teams</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Teams
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/50 sm:text-base">
              Organize your people, projects and collaboration into focused
              high-performance teams.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <span className="text-lg leading-none">+</span>
            Create team
          </button>
        </section>

        {/* Statistics */}
        {teamError ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {teamError}
          </div>
        ) : null}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-foreground/45">Total teams</p>
            <p className="mt-3 text-3xl font-semibold">{teams.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-foreground/45">Collaboration status</p>

            <div className="mt-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-lg font-medium">Operational</span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          {/* Team list */}
          <aside className="rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold">Your teams</h2>

                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-foreground/50">
                  {filteredTeams.length}
                </span>
              </div>

              <div className="relative mt-4">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search teams..."
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-foreground/25 focus:border-white/25"
                />
              </div>
            </div>

            <div className="max-h-[650px] overflow-y-auto p-3">
              {isLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-8 text-center"
                >
                  <p className="text-sm text-foreground/45">
                    Loading your teams...
                  </p>
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-foreground/45">
                    {teams.length === 0
                      ? "You have not created a team yet."
                      : "No teams found."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTeams.map((team) => {
                    const isSelected = team.id === selectedTeamId;

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedTeamId(team.id)}
                        className={[
                          "w-full rounded-xl border p-4 text-left transition",
                          isSelected
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${team.color} text-sm font-bold`}
                          >
                            {team.initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="truncate font-medium">
                                {team.name}
                              </h3>

                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/45">
                              {team.description}
                            </p>

                            <div className="mt-3 text-xs text-foreground/40">
                              <span>
                                Created {team.createdAt.slice(0, 10)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Team details */}
          <section className="min-w-0">
            {!selectedTeam ? (
              <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <div>
                  <h2 className="text-xl font-semibold">Select a team</h2>
                  <p className="mt-2 text-sm text-foreground/45">
                    Choose a team from the left to view its members and details.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Team hero */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${selectedTeam.color} text-xl font-bold shadow-lg`}
                        >
                          {selectedTeam.initials}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-semibold">
                              {selectedTeam.name}
                            </h2>

                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                              Active
                            </span>
                          </div>

                          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/50">
                            {selectedTeam.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          void deleteTeam(selectedTeam.id);
                        }}
                        className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                      >
                        Delete team
                      </button>
                    </div>

                    <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-foreground/35">
                          Created
                        </p>
                        <p className="mt-2 text-lg font-medium">
                          {formatDate(selectedTeam.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Members */}
                {/*
                  The roster lived here: invented colleagues with
                  @syraven.ai addresses, a role badge each, and an
                  "Add member" button that appended one more to local
                  state under an "invited" badge — an invitation nobody
                  was ever sent.

                  There is no team_members table to hold a roster, and
                  an invitation is an email with a token, an expiry and
                  an acceptance step, not an array entry. Membership is
                  modelled at the organisation level, so this points
                  there instead of fabricating a team roster.
                */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                  <h2 className="font-semibold">Team members</h2>

                  <p className="mt-2 max-w-prose text-sm leading-6 text-foreground/40">
                    Membership and invitations are handled for the whole
                    organisation rather than per team, so everyone you
                    invite there can reach this team.
                  </p>

                  <Link
                    href="/settings"
                    className="mt-5 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-foreground/70 transition hover:bg-white/[0.07] hover:text-foreground"
                  >
                    Manage organisation members
                  </Link>
                </div>


                {/*
                  A metrics panel stood here reporting 94% participation,
                  a project count and a team health of "Excellent". None
                  of the three was measured: the percentage and the
                  health were string literals, and the count came from
                  the seed array.
                */}
              </div>
            )}
          </section>
        </section>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">Create a new team</h2>
                <p className="mt-1 text-sm text-foreground/40">
                  Build a dedicated workspace for your collaborators.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-foreground/40 transition hover:bg-white/5 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createTeam} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Team name
                </label>

                <input
                  autoFocus
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  placeholder="e.g. Global Intelligence"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-foreground/25 focus:border-white/25"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <textarea
                  value={newTeamDescription}
                  onChange={(event) =>
                    setNewTeamDescription(event.target.value)
                  }
                  placeholder="What will this team work on?"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-foreground/25 focus:border-white/25"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-foreground/50 transition hover:bg-white/5 hover:text-foreground"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Create team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
    </div>
  );
}