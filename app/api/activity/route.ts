import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { DEFAULT_LIMIT, deriveActivity } from "@/lib/activity/events";

/*
  SYRAVEN — Activity

  WHY THIS ROUTE EXISTS

  /activity opened on eight invented events, and after those were
  removed it had nothing to show because there was no endpoint. This is
  the endpoint: the caller's own projects, tasks, Brain records and
  agent approvals, turned into a timeline by lib/activity/events.ts,
  which states only what their timestamp columns prove.

  AUTHORIZATION

  Every query runs on the caller's RLS-scoped client, AND filters by the
  caller explicitly. The explicit filter is not redundant:
  public.projects has row level security neither enabled nor policied
  (see lib/search/query.ts), so for that table the .eq() below is the
  only thing standing between one user and everyone's project names.
  It is written identically for every table so no source can quietly
  lose it.

  No id, workspace or filter is read from the request. There is nothing
  for a caller to widen.

  PARTIAL FAILURE

  One failing source does not blank the timeline. It is named in
  `degraded`, the page says which part is missing, and the rest is
  shown -- a partial answer that says it is partial, never a silently
  shorter list that reads as complete.
*/

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Rows read per source before deriving events. */
const PER_SOURCE = 30;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export const GET = withAuth(async (_request: NextRequest, session) => {
  try {
    const db = session.supabase;

    const [projects, tasks, knowledge, approvals] = await Promise.all([
      db
        .from("projects")
        .select("id, name, created_at, updated_at")
        .eq("user_id", session.userId)
        .order("updated_at", { ascending: false })
        .limit(PER_SOURCE),
      db
        .from("tasks")
        .select("id, title, status, created_at, updated_at, completed_at")
        .eq("user_id", session.userId)
        .order("updated_at", { ascending: false })
        .limit(PER_SOURCE),
      db
        .from("knowledge")
        .select("id, title, status, created_at, updated_at")
        .eq("user_id", session.userId)
        .order("updated_at", { ascending: false })
        .limit(PER_SOURCE),
      db
        .from("agent_approvals")
        .select("id, tool_id, agent_id, status, created_at, decided_at, expires_at")
        .eq("requested_for_user_id", session.userId)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE),
    ]);

    const degraded: string[] = [];
    if (projects.error) degraded.push("projects");
    if (tasks.error) degraded.push("tasks");
    if (knowledge.error) degraded.push("knowledge");
    if (approvals.error) degraded.push("approvals");

    const events = deriveActivity(
      {
        projects: projects.data ?? [],
        tasks: tasks.data ?? [],
        knowledge: knowledge.data ?? [],
        approvals: approvals.data ?? [],
      },
      { now: new Date(), limit: DEFAULT_LIMIT },
    );

    return json({ success: true, data: { events, degraded } });
  } catch (error) {
    console.error("SYRAVEN ACTIVITY GET ERROR:", error);

    return json(
      { success: false, error: { message: "Activity could not be loaded." } },
      500,
    );
  }
});
