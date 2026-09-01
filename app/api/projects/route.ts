import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toJson } from "@/lib/supabase/json";
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

type ProjectStatus =
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "archived"
  | "cancelled";

type ProjectVisibility =
  | "private"
  | "workspace"
  | "public";

type ProjectPriority =
  | "low"
  | "normal"
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
    case "planning":
    case "active":
    case "paused":
    case "completed":
    case "archived":
    case "cancelled":
      return value;

    default:
      return "planning";
  }
}

function normalizeVisibility(
  value: unknown
): ProjectVisibility {
  switch (value) {
    case "private":
    case "workspace":
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
    case "normal":
    case "high":
    case "critical":
      return value;

    default:
      return "normal";
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

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const userId =
      normalizeString(
        searchParams.get("userId"),
        200
      );

    if (!userId) {
      return jsonError(
        "userId is required.",
        400
      );
    }

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

    let query = supabaseAdmin
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
}

/* ==================================================
   CREATE PROJECT
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as
        CreateProjectBody;

    const userId =
      normalizeString(
        body.userId,
        200
      );

    const name =
      normalizeString(
        body.name,
        500
      );

    if (!userId) {
      return jsonError(
        "userId is required.",
        400
      );
    }

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
    } = await supabaseAdmin
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
}

/* ==================================================
   UPDATE PROJECT
================================================== */

export async function PATCH(
  request: NextRequest
) {
  try {
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
      updateData.workspace_id =
        normalizeString(
          body.workspaceId,
          200
        );
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

    const {
      data: existingProject,
      error: existingError,
    } = await supabaseAdmin
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
    } = await supabaseAdmin
      .from("projects")
      .update(
        updateData
      )
      .eq(
        "id",
        id
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
}

/* ==================================================
   DELETE PROJECT
================================================== */

export async function DELETE(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const id =
      normalizeString(
        searchParams.get("id"),
        200
      );

    const userId =
      normalizeString(
        searchParams.get("userId"),
        200
      );

    if (!id) {
      return jsonError(
        "Project id is required.",
        400
      );
    }

    if (!userId) {
      return jsonError(
        "userId is required.",
        400
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
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
}