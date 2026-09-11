"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/*
  SYRAVEN — Team detail

  WHAT THIS PAGE SHOWS

  A team, from public.teams, through GET /api/teams?id=<uuid> on the
  caller's own session. The route selects id, owner_id, workspace_id,
  name, description, created_at, updated_at, and the table's RLS is
  owner-scoped, so a team that is not yours simply is not returned.

  WHAT IT USED TO SHOW

  A module-scope array of three invented teams. "SYRAVEN Core" with
  eighteen projects, staffed by Alex Morgan, Sarah Chen, Marcus Reed and
  Emma Wilson at @syraven.ai addresses; "AI Research" with twelve;
  "Global Growth" with nine. A previous pass emptied the roster and
  disabled the invitation, but left everything around it standing, so
  the page still reported:

    Active projects   18          (no such column exists anywhere)
    Collaboration     94%         (a number with no source at all)
    Status            Healthy     (invented health)
    Active initiatives            three invented project names
    Team activity                 invented events, invented timestamps
    Team composition              percentage bars over an empty roster

  It was also broken as a route. The lookup compared a real team's UUID
  against invented slugs like "syraven-core", so every genuine team fell
  through to "Team not found" and only the three fictions could render.

  WHAT IS DELIBERATELY ABSENT NOW

  A project count. public.projects has no team_id — only knowledge does
  — so there is no honest way to count a team's projects. Showing zero
  would still assert the metric exists, so the metric is gone.

  A member roster. There is no team_members table. An invitation is not
  an array entry either: it is an email to somebody who may not hold an
  account, with a token, an expiry and an acceptance step.
  organization_invites already models that at the organisation level, so
  the roster is absent rather than rebuilt in a weaker form.

  Activity. Nothing records team events.

  WHAT IS REAL AND WIRED

  Renaming and deleting, through PATCH and DELETE on the same route,
  both owner-scoped. They are the only two mutations this team supports,
  and they genuinely persist.
*/

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

/** A team row exactly as /api/teams returns it. */
interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  workspace_id: string | null;
}

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
 * Teams have no colour column. Choosing at random per render would make
 * the same team change colour between loads, so this hashes the id —
 * the same function /teams uses, so a team looks the same in both
 * places.
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

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

/* -------------------------------------------------------------------------- */
/*                                    PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const teamId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(
        `/api/teams?id=${encodeURIComponent(teamId)}`,
        { cache: "no-store" },
      );

      if (response.status === 401) {
        setTeam(null);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: TeamRow[];
      } | null;

      /*
        The route answers with a filtered list rather than a single
        object, and returns an empty one for a malformed id, a team that
        does not exist, and a team belonging to somebody else alike —
        so those three cases are indistinguishable here, which is the
        point. Telling them apart would leak whether an id exists.
      */
      setTeam(payload?.data?.[0] ?? null);
    } catch {
      setLoadError("This team could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

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

  const presentation = useMemo(() => {
    if (!team) return null;

    return {
      initials: initialsFor(team.name),
      color: colorForTeam(team.id),
      created: formatDate(team.created_at),
    };
  }, [team]);

  const beginRename = useCallback(() => {
    if (!team) return;

    setDraftName(team.name);
    setDraftDescription(team.description ?? "");
    setSaveError(null);
    setIsRenaming(true);
  }, [team]);

  const saveRename = useCallback(async () => {
    if (!team) return;

    const name = draftName.trim();

    if (name.length === 0) {
      setSaveError("A team name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: team.id,
          name,
          description: draftDescription.trim() || null,
        }),
      });

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: TeamRow;
      } | null;

      /* Adopt the server's row, not the draft: it is the record. */
      if (payload?.data) setTeam(payload.data);

      setIsRenaming(false);
    } catch {
      setSaveError("Those changes could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }, [team, draftName, draftDescription]);

  const deleteTeam = useCallback(async () => {
    if (!team) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/teams?id=${encodeURIComponent(team.id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("failed");

      router.push("/teams");
    } catch {
      setSaveError("This team could not be removed.");
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }, [team, router]);

  /* ------------------------------------------------------------------ */
  /*                               STATES                               */
  /* ------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className="bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
        <div
          role="status"
          aria-live="polite"
          className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center text-sm text-foreground/50"
        >
          Loading this team...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center text-center">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!team || !presentation) {
    return (
      <div className="bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-2xl">
            ?
          </div>

          <h1 className="mt-6 text-3xl font-semibold">Team not found</h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-foreground/45">
            This team does not exist, or it is not yours to view.
          </p>

          <Link
            href="/teams"
            className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Back to teams
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*                                TEAM                                */
  /* ------------------------------------------------------------------ */

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-foreground/40"
        >
          <Link href="/teams" className="transition-colors hover:text-foreground">
            Teams
          </Link>

          <span aria-hidden="true">/</span>

          <span className="text-foreground/80">{team.name}</span>
        </nav>

        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-5">
                <div
                  aria-hidden="true"
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${presentation.color} text-2xl font-bold text-white shadow-lg`}
                >
                  {presentation.initials}
                </div>

                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {team.name}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/50">
                    {team.description ?? "No description yet."}
                  </p>

                  {presentation.created ? (
                    <p className="mt-4 text-sm text-foreground/35">
                      Created {presentation.created}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3">
                <button
                  type="button"
                  onClick={beginRename}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Edit details
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </section>

        {saveError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        {/*
          What a team is, and is not, in this product. Said plainly
          rather than implied by empty sections: a page with a "Members"
          tab that never lists anyone reads as broken, whereas this
          reads as honest.
        */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            Membership
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/50">
            Teams do not carry their own member list yet. People and
            their roles are managed for the organisation, and a team is
            currently a name and a description you own.
          </p>

          <Link
            href="/settings"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Organisation settings
          </Link>
        </section>
      </div>

      {/* ---------------------------- RENAME ---------------------------- */}

      {isRenaming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-edit-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="border-b border-border px-6 py-5">
              <h2 id="team-edit-title" className="text-lg font-semibold">
                Edit team
              </h2>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="team-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Name
                </label>

                <input
                  id="team-name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="team-description"
                  className="mb-2 block text-sm font-medium"
                >
                  Description
                </label>

                <textarea
                  id="team-description"
                  rows={3}
                  value={draftDescription}
                  onChange={(event) =>
                    setDraftDescription(event.target.value)
                  }
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>

              {saveError ? (
                <p role="alert" className="text-sm text-destructive">
                  {saveError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-foreground/60 transition-colors hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void saveRename()}
                  disabled={isSaving}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------------------- DELETE ---------------------------- */}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-delete-title"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h2 id="team-delete-title" className="text-lg font-semibold">
              Delete this team?
            </h2>

            <p className="mt-3 text-sm leading-6 text-foreground/50">
              {team.name} will be removed. This cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl px-4 py-2.5 text-sm text-foreground/60 transition-colors hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void deleteTeam()}
                disabled={isDeleting}
                className="rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete team"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
