"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Check,
  ShieldCheck,
  X,
} from "lucide-react";

/*
  SYRAVEN — Approvals

  WHAT THIS PAGE IS

  The human control plane. When an agent plans a step whose risk is
  `high` or above, lib/orchestration/registry.ts refuses to execute it
  and the orchestrator stops at `awaiting_approval`. A person has to
  say yes. This is where they say it.

  WHY IT EXISTS NOW

  /api/agents/approvals has had GET and POST since the approval store
  was built, and the seeded E2E suite already exercises both. There was
  no page. So the control that decides whether an agent may send an
  email or delete a record was reachable only by an HTTP client, and a
  user with pending approvals had nowhere to see them.

  WHAT IT SHOWS

  Only real rows. listPendingApprovals() filters server-side to
  requested_for_user_id = session.userId, status = 'pending', and drops
  anything already past its expiry before returning. Nothing is
  invented here and nothing is filtered client-side: an approval that
  is not the caller's is never sent to this page in the first place.

  WHAT A DECISION DOES

  POST { approvalId, decision } with decision restricted to approved or
  rejected. pending, expired and used are states the SYSTEM reaches --
  the clock, and the orchestrator consuming a grant -- so the route
  refuses them, and this page offers no control that would send one.

  A 404 means the approval is no longer open: absent, not the caller's,
  or already decided. The route answers all three identically on
  purpose, because distinguishing them would say whether an id exists.
  This page repeats that honestly rather than guessing which it was.
*/

interface PendingApproval {
  readonly id: string;
  readonly executionKey: string;
  readonly agentId: string;
  readonly toolId: string;
  readonly risk: string;
  readonly effect: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

type Decision = "approved" | "rejected";

/** Remaining time, in the coarsest honest unit. */
function timeLeft(expiresAt: string): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();

  if (!Number.isFinite(remaining) || remaining <= 0) return "expired";

  const minutes = Math.floor(remaining / 60_000);

  if (minutes < 1) return "under a minute left";
  if (minutes === 1) return "1 minute left";
  if (minutes < 60) return `${minutes} minutes left`;

  const hours = Math.floor(minutes / 60);

  return hours === 1 ? "1 hour left" : `${hours} hours left`;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Ids currently being decided, so a row cannot be double-submitted. */
  const [deciding, setDeciding] = useState<readonly string[]>([]);

  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/agents/approvals", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setApprovals([]);
        return;
      }

      if (!response.ok) throw new Error("failed");

      const payload = (await response.json().catch(() => null)) as {
        data?: { approvals?: PendingApproval[] };
      } | null;

      setApprovals(payload?.data?.approvals ?? []);
    } catch {
      setLoadError("Your pending approvals could not be loaded.");
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

  const decide = useCallback(
    async (approvalId: string, decision: Decision) => {
      setDeciding((current) => [...current, approvalId]);
      setNotice(null);

      try {
        const response = await fetch("/api/agents/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId, decision }),
        });

        if (response.status === 404) {
          /*
            No longer open. The row is stale in this view, so reload
            rather than guessing why -- the route deliberately does not
            say whether it expired, was decided elsewhere, or never
            belonged to this caller.
          */
          setNotice("That approval is no longer open.");
          await load();
          return;
        }

        if (!response.ok) throw new Error("failed");

        /*
          Removed only after the server confirmed. An optimistic
          removal would show the action as decided when the write may
          have failed.
        */
        setApprovals((current) =>
          current.filter((approval) => approval.id !== approvalId),
        );

        setNotice(
          decision === "approved"
            ? "Approved. The agent may now run that step."
            : "Rejected. The agent will not run that step.",
        );
      } catch {
        setNotice("That decision could not be recorded. Nothing changed.");
      } finally {
        setDeciding((current) =>
          current.filter((id) => id !== approvalId),
        );
      }
    },
    [load],
  );

  const sorted = useMemo(
    () =>
      [...approvals].sort(
        (a, b) =>
          new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      ),
    [approvals],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h1 className="text-2xl font-semibold text-foreground">
            Approvals
          </h1>
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          High-risk agent steps stop here until you decide. Nothing on
          this list has run.
        </p>
      </header>

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

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground"
        >
          {notice}
        </div>
      ) : null}

      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground"
        >
          Loading your approvals...
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <div className="mx-auto w-fit rounded-xl bg-muted p-3 text-muted-foreground">
            <Check className="h-5 w-5" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-foreground">
            Nothing is waiting on you
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            When an agent plans a step that could change something
            outside SYRAVEN, it stops and asks. Those requests appear
            here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {sorted.map((approval) => {
            const busy = deciding.includes(approval.id);
            const remaining = timeLeft(approval.expiresAt);

            return (
              <li
                key={approval.id}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {approval.risk} risk
                      </span>

                      <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                        {approval.toolId}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {approval.agentId}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-foreground">
                      {approval.effect}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {remaining}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(approval.id, "rejected")}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(approval.id, "approved")}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                      {busy ? "Recording..." : "Approve"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
