import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import type { AuthenticatedSession } from "@/lib/auth/session";
import {
  ensurePersonalAccount,
  type PersonalAccountClient,
} from "@/lib/tenancy/personalAccount";

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
  an organisation. That id is resolved by the database for the verified
  caller (auth.uid()) — never from the body. Accepting it would be an IDOR: a caller
  could name another tenant's organisation and, if RLS ever regressed,
  plant a workspace inside it.

  `created_by` is likewise taken from `session.userId`, not the body.

  ORGANISATION RESOLUTION HAS ONE AUTHORITY (Phase 3, Batch 2-D1)

  The caller's organisation comes from provision_personal_account()
  (20260917130000) through lib/tenancy/personalAccount. It returns the
  organisation the caller owns under the Batch 1 rule (an active owner
  membership whose organisation's owner_id is the caller, oldest first),
  or — for an account without one — creates it atomically with its owner
  membership and default workspace. Identity is auth.uid(); nothing is
  passed. This route used to provision an organisation itself, in several
  steps with a compensating delete; that second authority is gone.
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
 * Returns the organisation the caller owns, provisioning a personal one
 * (with its owner membership and default workspace) if they own none.
 *
 * Delegates entirely to the single provisioning authority. The id comes
 * back from the database function, bound to auth.uid(); it is never taken
 * from the request and never looked up here.
 *
 * FAIL CLOSED: a refused call (unconfirmed email) is 403, anything else
 * is 503. No workspace is inserted without a resolved organisation.
 */
async function resolveOrganizationId(
  session: AuthenticatedSession,
): Promise<{ ok: true; organizationId: string } | { ok: false; status: number }> {
  const account = await ensurePersonalAccount(
    session.supabase as unknown as PersonalAccountClient,
  );

  if (!account.ok) {
    return { ok: false, status: account.reason === "FORBIDDEN" ? 403 : 503 };
  }

  return { ok: true, organizationId: account.organizationId };
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
 *   2. Resolve the organisation the caller owns through the single
 *      provisioning authority (created atomically if they have none).
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
        organization.status === 403
          ? "Confirm your email address to create a workspace."
          : "Workspaces are temporarily unavailable.",
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
