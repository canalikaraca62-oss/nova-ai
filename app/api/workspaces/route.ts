import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import type { AuthenticatedSession } from "@/lib/auth/session";

/*
  SYRAVEN — Workspaces

  WHY THIS ROUTE EXISTS

  The dashboard told a new user to "Create your first workspace" and
  offered no way to do it: the empty state rendered text with no control,
  and WorkspaceContext.createWorkspace only called setWorkspaces(), so
  nothing persisted. Every new account reached a dead end.

  public.workspaces already existed with four RLS policies and zero rows.
  The schema was ready; only the write path was missing.

  AUTHORIZATION

  Session-scoped through `withAuth`, reading and writing through the
  caller's RLS client. The workspace policies are ORGANISATION-scoped:

    SELECT / INSERT  is_organization_member(organization_id)
    UPDATE / DELETE  is_organization_admin(organization_id)

  So RLS decides visibility and creation rights; this route never
  bypasses it and never uses the service-role client.

  ORGANISATION IDENTITY IS NEVER TAKEN FROM THE REQUEST

  `workspaces.organization_id` is NOT NULL, so a workspace must belong to
  an organisation. That id is resolved from the caller's own membership
  rows — never from the body. Accepting it would be an IDOR: a caller
  could name another tenant's organisation and, if RLS ever regressed,
  plant a workspace inside it.

  `created_by` is likewise taken from `session.userId`, not the body.

  SELF-PROVISIONING FOR ACCOUNTS WITHOUT AN ORGANISATION

  Registration provisions an organisation and an owner membership, but
  accounts created before that route existed have neither — verified in
  production: 7 users, 0 organisations, 0 memberships. For them
  `is_organization_member` returns false and RLS refuses every workspace
  insert, which is the dead end again one layer down.

  POST therefore provisions a personal organisation on first use when the
  caller has none. This is not a privilege escalation: it creates an
  organisation the caller owns, exactly as registration would have, and
  grants membership only in that new organisation. It cannot attach the
  caller to an existing one.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

/** Bounds on caller-supplied text. */
const LIMITS = {
  maxName: 120,
  maxDescription: 500,
  /** Ceiling on a single listing. Not caller-controllable. */
  maxList: 100,
} as const;

function fail(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

interface WorkspaceInput {
  name: string;
  description: string | null;
}

/**
 * Validates the request body.
 *
 * Accepts ONLY `name` and `description`. Any `organization_id`,
 * `created_by`, `owner_id` or `id` in the body is ignored rather than
 * rejected: silently dropping a field a caller cannot control is safer
 * than echoing it back, which would hint that the field means something.
 */
function parseBody(
  body: unknown,
): { ok: true; input: WorkspaceInput } | { ok: false; reason: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "A JSON object is required." };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.name !== "string") {
    return { ok: false, reason: "A workspace name is required." };
  }

  const name = record.name.trim();

  if (name.length === 0) {
    return { ok: false, reason: "A workspace name is required." };
  }

  if (name.length > LIMITS.maxName) {
    return {
      ok: false,
      reason: `A workspace name may be at most ${LIMITS.maxName} characters.`,
    };
  }

  const rawDescription = record.description;

  if (
    rawDescription !== undefined &&
    rawDescription !== null &&
    typeof rawDescription !== "string"
  ) {
    return { ok: false, reason: "Description must be text." };
  }

  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (description.length > LIMITS.maxDescription) {
    return {
      ok: false,
      reason: `A description may be at most ${LIMITS.maxDescription} characters.`,
    };
  }

  return {
    ok: true,
    input: { name, description: description.length > 0 ? description : null },
  };
}

/**
 * Derives a URL-safe slug.
 *
 * A random suffix is appended rather than probing for collisions: a
 * uniqueness check would be a read-then-write race, and the suffix keeps
 * the insert a single statement.
 */
function deriveSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const suffix = Math.random().toString(36).slice(2, 8);

  return `${base || "workspace"}-${suffix}`;
}

/* -------------------------------------------------------------------------- */
/*                          ORGANISATION RESOLUTION                           */
/* -------------------------------------------------------------------------- */

/**
 * Returns an organisation the caller is an active member of, creating a
 * personal one if they have none.
 *
 * Read through the caller's RLS client, so the membership rows returned
 * are provably their own. The id is never accepted from the request.
 */
async function resolveOrganizationId(
  session: AuthenticatedSession,
): Promise<{ ok: true; organizationId: string } | { ok: false; status: number }> {
  const { data: membership, error: membershipError } = await session.supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", session.userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("SYRAVEN WORKSPACES: membership lookup failed.", {
      userId: session.userId,
      error: membershipError.message,
    });

    return { ok: false, status: 503 };
  }

  if (membership?.organization_id) {
    return { ok: true, organizationId: membership.organization_id };
  }

  /*
   * No organisation. Provision a personal one, owned by this caller.
   *
   * `organizations` INSERT is policied WITH CHECK (owner_id = auth.uid()),
   * so RLS itself guarantees the caller can only create an organisation
   * they own — this cannot be steered at someone else's tenant.
   */
  const { data: organization, error: organizationError } = await session.supabase
    .from("organizations")
    .insert({
      name: "Personal",
      slug: deriveSlug("personal"),
      owner_id: session.userId,
    })
    .select("id")
    .maybeSingle();

  if (organizationError || !organization) {
    console.error("SYRAVEN WORKSPACES: organisation provisioning failed.", {
      userId: session.userId,
      error: organizationError?.message ?? "no row returned",
    });

    return { ok: false, status: 503 };
  }

  /*
   * Owner membership. Without it `is_organization_member` returns false
   * and the workspace insert below would be refused by RLS — the caller
   * would own an organisation they could not use.
   */
  const { error: memberError } = await session.supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: session.userId,
      role: "owner",
      status: "active",
    });

  if (memberError) {
    console.error("SYRAVEN WORKSPACES: owner membership failed.", {
      userId: session.userId,
      error: memberError.message,
    });

    /*
     * COMPENSATING DELETE.
     *
     * The organisation was created a moment ago and the caller cannot
     * use it: without the owner membership `is_organization_member` is
     * false, so every workspace insert against it is refused. Leaving it
     * behind would accumulate one dead organisation per attempt —
     * `deriveSlug` appends a random suffix, so there is no unique
     * constraint to stop a retry inserting another.
     *
     * ONLY the organisation created in THIS request is removed. `newly`
     * is the id returned by the insert above, never an id from the
     * request or from a lookup, so a pre-existing organisation cannot be
     * reached by this path. The `owner_id` filter is a second,
     * independent bound on top of RLS.
     *
     * This mirrors the compensating delete in
     * app/api/auth/register/route.ts, which removes a half-provisioned
     * signup for the same reason.
     */
    const { error: rollbackError } = await session.supabase
      .from("organizations")
      .delete()
      .eq("id", organization.id)
      .eq("owner_id", session.userId);

    if (rollbackError) {
      /*
       * Rollback itself failed. Reported at a higher severity because it
       * leaves state a later request cannot clean up, and the id is
       * logged so it can be found — it is a row identifier, not user
       * content.
       */
      console.error("SYRAVEN WORKSPACES: rollback FAILED; orphan remains.", {
        userId: session.userId,
        organizationId: organization.id,
        error: rollbackError.message,
      });
    }

    return { ok: false, status: 503 };
  }

  return { ok: true, organizationId: organization.id };
}

/* -------------------------------------------------------------------------- */
/*                                    GET                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lists workspaces the caller may see.
 *
 * No ownership filter is written here: the SELECT policy
 * (`is_organization_member(organization_id)`) is the boundary, and
 * adding a redundant client-side filter would imply the policy is
 * optional. Columns are explicit — never `*`, which would surface
 * whatever a future migration adds.
 */
export const GET = withAuth(
  async (_request: NextRequest, session: AuthenticatedSession) => {
    const { data, error } = await session.supabase
      .from("workspaces")
      .select(
        "id, name, slug, description, organization_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(LIMITS.maxList);

    if (error) {
      console.error("SYRAVEN WORKSPACES: list failed.", {
        userId: session.userId,
        error: error.message,
      });

      return fail(503, "Workspaces are temporarily unavailable.");
    }

    return NextResponse.json(
      { success: true, workspaces: (data ?? []) as WorkspaceResponse[] },
      { status: 200 },
    );
  },
);

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

/**
 * Creates a workspace for the caller's organisation.
 *
 * ORDER OF OPERATIONS:
 *
 *   1. Validate the body — only name and description are read.
 *   2. Resolve the organisation from the caller's own membership,
 *      provisioning a personal one if they have none.
 *   3. Insert with organization_id and created_by taken from the server,
 *      never from the request.
 *
 * RLS evaluates `is_organization_member(organization_id)` on the insert,
 * so even if step 2 were ever wrong, the database refuses the write.
 */
export const POST = withAuth(
  async (request: NextRequest, session: AuthenticatedSession) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail(400, "A valid request body is required.");
    }

    const parsed = parseBody(body);

    if (!parsed.ok) return fail(400, parsed.reason);

    const organization = await resolveOrganizationId(session);

    if (!organization.ok) {
      return fail(
        organization.status,
        "Workspaces are temporarily unavailable.",
      );
    }

    const { data, error } = await session.supabase
      .from("workspaces")
      .insert({
        name: parsed.input.name,
        slug: deriveSlug(parsed.input.name),
        description: parsed.input.description,
        /* Server-derived. Never from the request body. */
        organization_id: organization.organizationId,
        created_by: session.userId,
      })
      .select(
        "id, name, slug, description, organization_id, created_at, updated_at",
      )
      .maybeSingle();

    if (error) {
      console.error("SYRAVEN WORKSPACES: create failed.", {
        userId: session.userId,
        error: error.message,
      });

      return fail(503, "The workspace could not be created.");
    }

    if (!data) {
      /*
       * No row returned means RLS refused the insert. Reported as a
       * forbidden action rather than a server fault, and without saying
       * which organisation was involved.
       */
      return fail(403, "You cannot create a workspace here.");
    }

    return NextResponse.json(
      { success: true, workspace: data as WorkspaceResponse },
      { status: 201 },
    );
  },
);
