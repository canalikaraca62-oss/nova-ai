import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { requireOptionalWorkspaceAccess } from "@/lib/api/tenantGuard";
import { isUuid } from "@/lib/auth/authorization";

/*
  SYRAVEN — Team persistence

  WHY THIS ROUTE EXISTS

  `public.teams` has existed since the enterprise-core migration, with
  owner-scoped RLS on all four verbs, but no route ever reached it. So
  /teams and /teams/[id] ran entirely on a module-scope `initialTeams`
  array: four invented teams with invented colleagues on @syraven.ai
  addresses. Creating a team unshifted an object into that array;
  renaming, removing a member and deleting all mutated it in place.
  Every change was gone on reload, and none of it had ever been anyone's
  data.

  WHAT THIS ROUTE DOES AND DOES NOT COVER

  Teams themselves persist here: create, list, rename, delete.

  MEMBERSHIP DOES NOT. There is no `team_members` table, and adding one
  is not a matter of a column — an invitation is an email to a person
  who may not hold an account yet, with a token, an expiry and an
  acceptance step. `public.organization_invites` already models exactly
  that shape at the organisation level. Inventing a parallel, weaker
  mechanism for teams would be the same defect in a new table, so the
  UI now says plainly that membership is managed for the organisation
  rather than pretending a team roster it cannot store.

  AUTHORIZATION

  Session-scoped through `withAuth`, on the caller's RLS client. The
  teams policies are owner-scoped (auth.uid() = owner_id), so the
  database is the boundary rather than this code. `owner_id` is taken
  from the verified session and never from the request.

  Note that `teams.owner_id` is NULLABLE and the select policy reads
  `auth.uid() = owner_id`, which is NULL — not true — for an ownerless
  row. Such rows are invisible to every authenticated caller. This route
  therefore always writes an owner, so it cannot create a team that
  nobody, including its creator, can subsequently see.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

const LIMITS = {
  maxName: 200,
  maxDescription: 2_000,
  maxList: 100,
} as const;

const TEAM_SELECT = `
  id,
  owner_id,
  workspace_id,
  name,
  description,
  created_at,
  updated_at
`;

interface CreateTeamBody {
  name?: unknown;
  description?: unknown;
  workspaceId?: unknown;
}

interface UpdateTeamBody {
  id?: unknown;
  name?: unknown;
  description?: unknown;
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { message },
    },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

/**
 * Trims a client string and enforces a ceiling.
 *
 * Returns null for anything that is not a non-empty string, so a
 * caller cannot smuggle a number or an object into a text column.
 */
function normalizeString(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

/* -------------------------------------------------------------------------- */
/*                                 GET TEAMS                                  */
/* -------------------------------------------------------------------------- */

export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const db = session.supabase;

    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");

    let query = db
      .from("teams")
      .select(TEAM_SELECT)
      /*
        Explicit ownership filter alongside RLS. The policy already
        restricts this, but a query that states its own boundary does
        not depend on the policy being present to be correct.
      */
      .eq("owner_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(LIMITS.maxList);

    if (id !== null) {
      if (!isUuid(id)) {
        /*
          A malformed uuid makes PostgREST answer 400, which reads
          differently from an empty result and would let a caller tell
          "bad id" from "not yours". Both paths return empty instead.
        */
        return NextResponse.json(
          { success: true, data: [] },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }

      query = query.eq("id", id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("SYRAVEN TEAMS GET ERROR:", error.message);

      return jsonError("Teams could not be loaded.", 500);
    }

    return NextResponse.json(
      {
        success: true,
        data: data ?? [],
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("SYRAVEN TEAMS GET ERROR:", error);

    return jsonError("Teams could not be loaded.", 500);
  }
});

/* -------------------------------------------------------------------------- */
/*                                CREATE TEAM                                 */
/* -------------------------------------------------------------------------- */

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const db = session.supabase;

    const body = (await request.json().catch(() => null)) as
      | CreateTeamBody
      | null;

    if (!body) {
      return jsonError("A request body is required.", 400);
    }

    const name = normalizeString(body.name, LIMITS.maxName);

    if (!name) {
      return jsonError("A team name is required.", 400);
    }

    const description = normalizeString(
      body.description,
      LIMITS.maxDescription,
    );

    const workspaceId = normalizeString(body.workspaceId, 200);

    /*
      TENANT GUARD.

      `workspaceId` arrives in the request body and the insert policy
      only checks the owner, so RLS would accept a row that is
      legitimately the caller's while pointing into a workspace they do
      not belong to. Proven before it is trusted.
    */
    const workspaceGuard = await requireOptionalWorkspaceAccess(
      session,
      workspaceId,
    );

    if (workspaceGuard?.denied) {
      return workspaceGuard.response;
    }

    const { data, error } = await db
      .from("teams")
      .insert({
        /* Ownership comes from the session, never from the body. */
        owner_id: session.userId,
        workspace_id: workspaceId,
        name,
        description,
      })
      .select(TEAM_SELECT)
      .single();

    if (error) {
      console.error("SYRAVEN TEAMS CREATE ERROR:", error.message);

      return jsonError("That team could not be created.", 500);
    }

    return NextResponse.json(
      { success: true, data },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    console.error("SYRAVEN TEAMS CREATE ERROR:", error);

    return jsonError("That team could not be created.", 500);
  }
});

/* -------------------------------------------------------------------------- */
/*                                UPDATE TEAM                                 */
/* -------------------------------------------------------------------------- */

export const PATCH = withAuth(async (request: NextRequest, session) => {
  try {
    const db = session.supabase;

    const body = (await request.json().catch(() => null)) as
      | UpdateTeamBody
      | null;

    const id = normalizeString(body?.id, 200);

    if (!id || !isUuid(id)) {
      return jsonError("A team id is required.", 400);
    }

    const update: {
      name?: string;
      description?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (body?.name !== undefined) {
      const name = normalizeString(body.name, LIMITS.maxName);

      if (!name) {
        return jsonError("A team name cannot be empty.", 400);
      }

      update.name = name;
    }

    if (body?.description !== undefined) {
      /* An explicit null clears the description; a string sets it. */
      update.description = normalizeString(
        body.description,
        LIMITS.maxDescription,
      );
    }

    const { data, error } = await db
      .from("teams")
      .update(update)
      .eq("id", id)
      .eq("owner_id", session.userId)
      .select(TEAM_SELECT)
      .maybeSingle();

    if (error) {
      console.error("SYRAVEN TEAMS UPDATE ERROR:", error.message);

      return jsonError("That team could not be updated.", 500);
    }

    if (!data) {
      /* Absent or not the caller's — reported identically. */
      return jsonError("Team not found.", 404);
    }

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("SYRAVEN TEAMS UPDATE ERROR:", error);

    return jsonError("That team could not be updated.", 500);
  }
});

/* -------------------------------------------------------------------------- */
/*                                DELETE TEAM                                 */
/* -------------------------------------------------------------------------- */

export const DELETE = withAuth(async (request: NextRequest, session) => {
  try {
    const db = session.supabase;

    const { searchParams } = new URL(request.url);

    const id = normalizeString(searchParams.get("id"), 200);

    if (!id || !isUuid(id)) {
      return jsonError("A team id is required.", 400);
    }

    const { data, error } = await db
      .from("teams")
      .delete()
      .eq("id", id)
      .eq("owner_id", session.userId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("SYRAVEN TEAMS DELETE ERROR:", error.message);

      return jsonError("That team could not be removed.", 500);
    }

    if (!data) {
      return jsonError("Team not found.", 404);
    }

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("SYRAVEN TEAMS DELETE ERROR:", error);

    return jsonError("That team could not be removed.", 500);
  }
});
