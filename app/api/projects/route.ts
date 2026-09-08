import { NextResponse } from "next/server";

/*
  DATA ACCESS (Phase 4) — ownership mismatch RESOLVED

  This route uses the CALLER'S OWN RLS-enforced client
  (session.supabase). It was previously the one route that could not,
  and this note records why that changed.

  THE PROBLEM

    public.projects RLS policies (20260901154222) predicate on:
        owner_id = auth.uid()  OR  is_organization_member(organization_id)

    This route read and wrote only `user_id`, a compatibility column
    added later by 20260901165535 under the heading "PROJECT
    COMPATIBILITY COLUMNS". Because owner_id was never populated, every
    policy evaluated false and the caller's client would have returned no
    rows for anybody.

  THE CANONICAL MODEL

    owner_id is canonical. It is the column the policies use, and it
    follows the same convention as organizations.owner_id, which the
    registration route already sets. user_id is a compatibility alias.

  THE FIX (no migration required)

    Both columns are nullable and optional in the schema, so the
    reconciliation is a code change, not a database change: POST now
    populates owner_id alongside user_id from the same verified session
    id. The policies are satisfied and the RLS client works.

    Existing rows needed no backfill — public.projects held 0 rows when
    this was verified.

  WHY user_id IS KEPT

    Dropping it would be a breaking schema change affecting
    projects_user_id_idx and the tasks route's project validator. Writing
    both from one session id keeps them consistent by construction.

  Explicit .eq("user_id", …) filters are RETAINED throughout: RLS is
  defence in depth beneath them, not a replacement (ARCHITECTURE_AUDIT.md
  §8.6).
*/
import { toJson } from "@/lib/supabase/json";
import { withAuth } from "@/lib/api/withAuth";
import { requireOptionalWorkspaceAccess } from "@/lib/api/tenantGuard";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN PROJECTS API
================================================== */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/* ==================================================
   DATABASE TYPES
================================================== */

type ProjectInsert =
  Database["public"]["Tables"]["projects"]["Insert"];

type ProjectUpdate =
  Database["public"]["Tables"]["projects"]["Update"];

/* ==================================================
   PROJECT TYPES
================================================== */

/*
  These unions mirror the CHECK constraints on public.projects.

  They previously did not, and the mismatch broke creation outright:
  normalizeStatus defaulted to "planning", which
  projects_status_check rejects, so every POST that omitted `status`
  -- which is every request the UI would send -- failed with a 500.

    status      draft | active | archived | completed
    visibility  private | organization | public

  Verified against production:
    projects_status_check     CHECK (status = ANY (ARRAY['draft','active','archived','completed']))
    projects_visibility_check CHECK (visibility = ANY (ARRAY['private','organization','public']))

  Widening either list requires a migration, not an edit here.
*/
type ProjectStatus =
  | "draft"
  | "active"
  | "archived"
  | "completed";

type ProjectVisibility =
  | "private"
  | "organization"
  | "public";

/* public.projects.priority has no CHECK; its column default is 'medium'. */
type ProjectPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

/* ==================================================
   REQUEST TYPES
================================================== */

type CreateProjectBody = {
  userId?: string;
  workspaceId?: string | null;

  name?: string;
  description?: string | null;

  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  priority?: ProjectPriority;

  startDate?: string | null;
  dueDate?: string | null;

  metadata?: Record<string, unknown> | null;
};

type UpdateProjectBody = {
  id?: string;

  name?: string;
  description?: string | null;

  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  priority?: ProjectPriority;

  workspaceId?: string | null;

  startDate?: string | null;
  dueDate?: string | null;

  metadata?: Record<string, unknown> | null;
};

/* ==================================================
   RESPONSE HELPERS
================================================== */

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  );
}

/* ==================================================
   NORMALIZERS
================================================== */

function normalizeString(
  value: unknown,
  maxLength = 10000
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength
  );
}

function normalizeLimit(
  value: string | null
): number {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.floor(parsed),
    MAX_LIMIT
  );
}

function normalizeOffset(
  value: string | null
): number {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeStatus(
  value: unknown
): ProjectStatus {
  switch (value) {
    case "draft":
    case "active":
    case "archived":
    case "completed":
      return value;

    default:
      /*
        Matches the column default. The previous default, "planning",
        is not in projects_status_check and made every create fail.
      */
      return "active";
  }
}

function normalizeVisibility(
  value: unknown
): ProjectVisibility {
  switch (value) {
    case "private":
    case "organization":
    case "public":
      return value;

    default:
      return "private";
  }
}

function normalizePriority(
  value: unknown
): ProjectPriority {
  switch (value) {
    case "low":
    case "medium":
    case "high":
    case "critical":
      return value;

    default:
      return "medium";
  }
}

function normalizeMetadata(
  value: unknown
): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function normalizeDate(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

/* ==================================================
   PROJECT SELECT
================================================== */

const PROJECT_SELECT = `
  id,
  user_id,
  workspace_id,
  name,
  description,
  status,
  visibility,
  priority,
  start_date,
  due_date,
  metadata,
  created_at,
  updated_at
`;

/* ==================================================
   GET PROJECTS
================================================== */

export const GET = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller RLS-enforced client is the default data path.
    */
    const db = session.supabase;

    const { searchParams } =
      new URL(request.url);

    /*
      SECURITY:

      The caller's identity comes from the verified session only.
      A `userId` request parameter is deliberately NOT accepted here:
      doing so previously allowed any caller to read another user's
      projects (ARCHITECTURE_AUDIT.md §8.1).
    */
    const userId =
      session.userId;

    /*
      Single-project lookup.

      The detail page needs one project by id. Without this it had no
      way to ask for one and rendered a hardcoded fallback instead,
      so a freshly created project opened as fabricated data.

      This adds a filter to the SAME session-scoped query -- it does
      not bypass the ownership predicate or RLS below.
    */
    const id =
      searchParams.get("id");

    const workspaceId =
      normalizeString(
        searchParams.get("workspaceId"),
        200
      );

    const status =
      searchParams.get("status");

    const visibility =
      searchParams.get("visibility");

    const priority =
      searchParams.get("priority");

    const search =
      searchParams.get("search");

    const limit =
      normalizeLimit(
        searchParams.get("limit")
      );

    const offset =
      normalizeOffset(
        searchParams.get("offset")
      );

    let query = db
      .from("projects")
      .select(
        PROJECT_SELECT,
        {
          count: "exact",
        }
      )
      .eq(
        "user_id",
        userId
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      )
      .range(
        offset,
        offset + limit - 1
      );

    /*
      SECURITY:

      A client-supplied workspace id is proven before it is used as a
      filter. Without this the id is trusted because the sibling user_id
      filter happens to be present — one missing filter away from
      ARCHITECTURE_AUDIT.md §8.1.
    */
    const workspaceGuard =
      await requireOptionalWorkspaceAccess(
        session,
        workspaceId
      );

    if (workspaceGuard?.denied) {
      return workspaceGuard.response;
    }

    if (id) {
      query = query.eq(
        "id",
        id
      );
    }

    if (workspaceId) {
      query = query.eq(
        "workspace_id",
        workspaceId
      );
    }

    if (status) {
      query = query.eq(
        "status",
        status
      );
    }

    if (visibility) {
      query = query.eq(
        "visibility",
        visibility
      );
    }

    if (priority) {
      query = query.eq(
        "priority",
        priority
      );
    }

    if (search) {
      const sanitizedSearch =
        search
          .replace(/[,()]/g, " ")
          .trim()
          .slice(0, 500);

      if (sanitizedSearch) {
        query = query.or(
          `name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`
        );
      }
    }

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        "SYRAVEN PROJECTS GET ERROR:",
        error
      );

      return jsonError(
        "Projects could not be loaded.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,

        data:
          data ?? [],

        pagination: {
          total:
            count ?? 0,

          limit,

          offset,

          hasMore:
            (count ?? 0) >
            offset + limit,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN PROJECTS GET ERROR:",
      error
    );

    return jsonError(
      "Failed to load projects.",
      500
    );
  }
});

/* ==================================================
   CREATE PROJECT
================================================== */

export const POST = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller RLS-enforced client is the default data path.
    */
    const db = session.supabase;

    const body =
      (await request.json()) as
        CreateProjectBody;

    /*
      SECURITY:

      Ownership is assigned from the verified session, never from the
      request body. A client-supplied `userId` is ignored.
    */
    const userId =
      session.userId;

    const name =
      normalizeString(
        body.name,
        500
      );

    if (!name) {
      return jsonError(
        "name is required.",
        400
      );
    }

    const workspaceId =
      normalizeString(
        body.workspaceId,
        200
      );

    /*
      TENANT GUARD.

      `workspaceId` arrives in the REQUEST BODY. Without this check a
      caller could place a project into a workspace they are not a
      member of: RLS permits the row because it only tests
      `owner_id = auth.uid()`, so the record is legitimately theirs
      while pointing at someone else's tenant.

      Verified against production before the fix: user B created a
      project carrying user A's workspace id and received 201.

      GET already guards the same parameter (see above); the write
      paths did not.
    */
    const workspaceGuard =
      await requireOptionalWorkspaceAccess(
        session,
        workspaceId
      );

    if (workspaceGuard?.denied) {
      return workspaceGuard.response;
    }

    const description =
      normalizeString(
        body.description,
        20000
      );

    const startDate =
      normalizeDate(
        body.startDate
      );

    const dueDate =
      normalizeDate(
        body.dueDate
      );

    if (
      startDate &&
      dueDate &&
      new Date(dueDate) <
        new Date(startDate)
    ) {
      return jsonError(
        "dueDate cannot be before startDate.",
        400
      );
    }

    const now =
      new Date().toISOString();

    const insertData: ProjectInsert = {
      /*
        OWNERSHIP (Phase 4)

        Both ownership columns are written, deliberately:

          owner_id — the CANONICAL column. public.projects RLS policies
                     (20260901154222) predicate on it, and it follows the
                     same convention as organizations.owner_id. Setting
                     it is what allows this route to use the caller's own
                     RLS-enforced client.

          user_id  — a compatibility column added later by
                     20260901165535 ("PROJECT COMPATIBILITY COLUMNS").
                     Existing queries and the projects_user_id_idx index
                     use it, so it is kept populated and consistent
                     rather than dropped, which would be a breaking
                     schema change.

        Both are set from the same verified session id, so they cannot
        diverge for rows this route creates.
      */
      owner_id:
        userId,

      user_id:
        userId,

      workspace_id:
        workspaceId ?? null,

      name,

      description:
        description ?? null,

      status:
        normalizeStatus(
          body.status
        ),

      visibility:
        normalizeVisibility(
          body.visibility
        ),

      priority:
        normalizePriority(
          body.priority
        ),

      start_date:
        startDate,

      due_date:
        dueDate,

      metadata:
        toJson(
          normalizeMetadata(
            body.metadata
          )
        ),

      updated_at:
        now,
    };

    const {
      data,
      error,
    } = await db
      .from("projects")
      .insert(
        insertData
      )
      .select(
        PROJECT_SELECT
      )
      .single();

    if (error) {
      console.error(
        "SYRAVEN PROJECT CREATE ERROR:",
        error
      );

      return jsonError(
        "Project could not be created.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN PROJECT CREATE ERROR:",
      error
    );

    return jsonError(
      "Failed to create project.",
      500
    );
  }
});

/* ==================================================
   UPDATE PROJECT
================================================== */

export const PATCH = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller RLS-enforced client is the default data path.
    */
    const db = session.supabase;

    const body =
      (await request.json()) as
        UpdateProjectBody;

    const id =
      normalizeString(
        body.id,
        200
      );

    if (!id) {
      return jsonError(
        "Project id is required.",
        400
      );
    }

    const updateData: ProjectUpdate = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      typeof body.name === "string"
    ) {
      const name =
        normalizeString(
          body.name,
          500
        );

      if (!name) {
        return jsonError(
          "name cannot be empty.",
          400
        );
      }

      updateData.name = name;
    }

    if (
      body.description !== undefined
    ) {
      updateData.description =
        normalizeString(
          body.description,
          20000
        );
    }

    if (
      body.workspaceId !== undefined
    ) {
      const targetWorkspace =
        normalizeString(
          body.workspaceId,
          200
        );

      /*
        Moving a project between workspaces is a tenant change, so it
        needs the same membership check as creating one. Without it a
        caller could relocate their own project into another
        organisation's workspace.
      */
      const moveGuard =
        await requireOptionalWorkspaceAccess(
          session,
          targetWorkspace
        );

      if (moveGuard?.denied) {
        return moveGuard.response;
      }

      updateData.workspace_id =
        targetWorkspace;
    }

    if (
      body.status !== undefined
    ) {
      updateData.status =
        normalizeStatus(
          body.status
        );
    }

    if (
      body.visibility !== undefined
    ) {
      updateData.visibility =
        normalizeVisibility(
          body.visibility
        );
    }

    if (
      body.priority !== undefined
    ) {
      updateData.priority =
        normalizePriority(
          body.priority
        );
    }

    if (
      body.startDate !== undefined
    ) {
      updateData.start_date =
        normalizeDate(
          body.startDate
        );
    }

    if (
      body.dueDate !== undefined
    ) {
      updateData.due_date =
        normalizeDate(
          body.dueDate
        );
    }

    if (
      body.metadata !== undefined
    ) {
      updateData.metadata =
        toJson(
          normalizeMetadata(
            body.metadata
          )
        );
    }

    /*
      SECURITY:

      The ownership filter is what makes this update safe. Without it any
      caller could modify any project by id (ARCHITECTURE_AUDIT.md §8.1).
      A non-owner receives 404 rather than 403 so that project ids are not
      enumerable.
    */
    const {
      data: existingProject,
      error: existingError,
    } = await db
      .from("projects")
      .select(
        `
          id,
          start_date,
          due_date
        `
      )
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        session.userId
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "SYRAVEN PROJECT LOOKUP ERROR:",
        existingError
      );

      return jsonError(
        "Project could not be verified.",
        500
      );
    }

    if (!existingProject) {
      return jsonError(
        "Project not found.",
        404
      );
    }

    const finalStartDate =
      updateData.start_date === undefined
        ? existingProject.start_date
        : updateData.start_date;

    const finalDueDate =
      updateData.due_date === undefined
        ? existingProject.due_date
        : updateData.due_date;

    if (
      finalStartDate &&
      finalDueDate &&
      new Date(
        String(finalDueDate)
      ) <
        new Date(
          String(finalStartDate)
        )
    ) {
      return jsonError(
        "dueDate cannot be before startDate.",
        400
      );
    }

    const {
      data,
      error,
    } = await db
      .from("projects")
      .update(
        updateData
      )
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        session.userId
      )
      .select(
        PROJECT_SELECT
      )
      .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN PROJECT UPDATE ERROR:",
        error
      );

      return jsonError(
        "Project could not be updated.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Project not found.",
        404
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN PROJECT UPDATE ERROR:",
      error
    );

    return jsonError(
      "Failed to update project.",
      500
    );
  }
});

/* ==================================================
   DELETE PROJECT
================================================== */

export const DELETE = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller RLS-enforced client is the default data path.
    */
    const db = session.supabase;

    const { searchParams } =
      new URL(request.url);

    const id =
      normalizeString(
        searchParams.get("id"),
        200
      );

    /*
      SECURITY:

      Deletion is scoped to the verified session owner. A client-supplied
      `userId` parameter is no longer accepted.
    */
    const userId =
      session.userId;

    if (!id) {
      return jsonError(
        "Project id is required.",
        400
      );
    }

    const {
      data,
      error,
    } = await db
      .from("projects")
      .delete()
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        userId
      )
      .select(
        "id"
      )
      .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN PROJECT DELETE ERROR:",
        error
      );

      return jsonError(
        "Project could not be deleted.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Project not found or access denied.",
        404
      );
    }

    return NextResponse.json(
      {
        success: true,
        deleted: true,
        id,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN PROJECT DELETE ERROR:",
      error
    );

    return jsonError(
      "Failed to delete project.",
      500
    );
  }
});