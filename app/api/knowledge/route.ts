import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toJson } from "@/lib/supabase/json";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN KNOWLEDGE API
================================================== */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/* ==================================================
   DATABASE TYPES
================================================== */

type KnowledgeInsert =
  Database["public"]["Tables"]["knowledge"]["Insert"];

type KnowledgeUpdate =
  Database["public"]["Tables"]["knowledge"]["Update"];

/* ==================================================
   TYPES
================================================== */

type KnowledgeStatus =
  | "draft"
  | "processing"
  | "ready"
  | "failed"
  | "archived";

type KnowledgeVisibility =
  | "private"
  | "workspace"
  | "public";

type KnowledgeType =
  | "document"
  | "note"
  | "url"
  | "file"
  | "text"
  | "dataset"
  | "other";

type CreateKnowledgeBody = {
  userId?: string;
  workspaceId?: string | null;

  title?: string;
  content?: string | null;
  description?: string | null;

  type?: KnowledgeType;
  status?: KnowledgeStatus;
  visibility?: KnowledgeVisibility;

  sourceUrl?: string | null;

  metadata?: Record<string, unknown> | null;
  tags?: string[];
};

type UpdateKnowledgeBody = {
  id?: string;

  title?: string;
  content?: string | null;
  description?: string | null;

  type?: KnowledgeType;
  status?: KnowledgeStatus;
  visibility?: KnowledgeVisibility;

  sourceUrl?: string | null;

  metadata?: Record<string, unknown> | null;
  tags?: string[];
};

/* ==================================================
   HELPERS
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

function normalizeLimit(
  value: string | null
) {
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
) {
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
): KnowledgeStatus {
  switch (value) {
    case "draft":
    case "processing":
    case "ready":
    case "failed":
    case "archived":
      return value;

    default:
      return "ready";
  }
}

function normalizeVisibility(
  value: unknown
): KnowledgeVisibility {
  switch (value) {
    case "private":
    case "workspace":
    case "public":
      return value;

    default:
      return "private";
  }
}

function normalizeType(
  value: unknown
): KnowledgeType {
  switch (value) {
    case "document":
    case "note":
    case "url":
    case "file":
    case "text":
    case "dataset":
    case "other":
      return value;

    default:
      return "document";
  }
}

function normalizeTags(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50)
    )
  );
}

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

function normalizeMetadata(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

/* ==================================================
   GET KNOWLEDGE
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const userId =
      searchParams.get("userId");

    const workspaceId =
      searchParams.get("workspaceId");

    const type =
      searchParams.get("type");

    const status =
      searchParams.get("status");

    const visibility =
      searchParams.get("visibility");

    const search =
      searchParams.get("search");

    const limit = normalizeLimit(
      searchParams.get("limit")
    );

    const offset = normalizeOffset(
      searchParams.get("offset")
    );

    let query = supabaseAdmin
      .from("knowledge")
      .select(
        `
          id,
          user_id,
          workspace_id,
          project_id,
          team_id,
          title,
          description,
          content,
          type,
          status,
          visibility,
          source_url,
          file_name,
          file_path,
          file_type,
          file_size,
          metadata,
          tags,
          embedding,
          created_at,
          updated_at
        `,
        {
          count: "exact",
        }
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

    if (userId) {
      query = query.eq(
        "user_id",
        userId
      );
    }

    if (workspaceId) {
      query = query.eq(
        "workspace_id",
        workspaceId
      );
    }

    if (type) {
      query = query.eq(
        "type",
        type
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

    if (search) {
      const sanitizedSearch =
        search
          .replace(/[,()]/g, " ")
          .trim();

      if (sanitizedSearch) {
        query = query.or(
          `title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,content.ilike.%${sanitizedSearch}%`
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
        "SYRAVEN KNOWLEDGE GET ERROR:",
        error
      );

      return jsonError(
        "Knowledge records could not be loaded.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,

        data: data ?? [],

        pagination: {
          total: count ?? 0,
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
      "SYRAVEN KNOWLEDGE GET ERROR:",
      error
    );

    return jsonError(
      "Failed to load knowledge.",
      500
    );
  }
}

/* ==================================================
   CREATE KNOWLEDGE
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as
        CreateKnowledgeBody;

    const userId =
      normalizeString(
        body.userId,
        200
      );

    const title =
      normalizeString(
        body.title,
        500
      );

    if (!userId) {
      return jsonError(
        "userId is required.",
        400
      );
    }

    if (!title) {
      return jsonError(
        "title is required.",
        400
      );
    }

    const content =
      normalizeString(
        body.content,
        2_000_000
      );

    const description =
      normalizeString(
        body.description,
        5000
      );

    const workspaceId =
      normalizeString(
        body.workspaceId,
        200
      );

    const sourceUrl =
      normalizeString(
        body.sourceUrl,
        5000
      );

    const type =
      normalizeType(
        body.type
      );

    const status =
      normalizeStatus(
        body.status
      );

    const visibility =
      normalizeVisibility(
        body.visibility
      );

    const tags =
      normalizeTags(
        body.tags
      );

    const metadata =
      normalizeMetadata(
        body.metadata
      );

    const insertData: KnowledgeInsert = {
      user_id: userId,

      workspace_id:
        workspaceId ?? null,

      title,

      content:
        content ?? null,

      description:
        description ?? null,

      type,

      status,

      visibility,

      source_url:
        sourceUrl ?? null,

      metadata:
        toJson(metadata),

      tags,

      updated_at:
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("knowledge")
      .insert(insertData)
      .select(
        `
          id,
          user_id,
          workspace_id,
          project_id,
          team_id,
          title,
          description,
          content,
          type,
          status,
          visibility,
          source_url,
          file_name,
          file_path,
          file_type,
          file_size,
          metadata,
          tags,
          embedding,
          created_at,
          updated_at
        `
      )
      .single();

    if (error) {
      console.error(
        "SYRAVEN KNOWLEDGE CREATE ERROR:",
        error
      );

      return jsonError(
        "Knowledge record could not be created.",
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
      "SYRAVEN KNOWLEDGE CREATE ERROR:",
      error
    );

    return jsonError(
      "Failed to create knowledge.",
      500
    );
  }
}

/* ==================================================
   UPDATE KNOWLEDGE
================================================== */

export async function PATCH(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as
        UpdateKnowledgeBody;

    const id =
      normalizeString(
        body.id,
        200
      );

    if (!id) {
      return jsonError(
        "Knowledge id is required.",
        400
      );
    }

    const updateData: KnowledgeUpdate = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      typeof body.title === "string"
    ) {
      const title =
        normalizeString(
          body.title,
          500
        );

      if (!title) {
        return jsonError(
          "title cannot be empty.",
          400
        );
      }

      updateData.title = title;
    }

    if (
      body.content !== undefined
    ) {
      updateData.content =
        normalizeString(
          body.content,
          2_000_000
        );
    }

    if (
      body.description !== undefined
    ) {
      updateData.description =
        normalizeString(
          body.description,
          5000
        );
    }

    if (
      body.type !== undefined
    ) {
      updateData.type =
        normalizeType(
          body.type
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
      body.sourceUrl !== undefined
    ) {
      updateData.source_url =
        normalizeString(
          body.sourceUrl,
          5000
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

    if (
      body.tags !== undefined
    ) {
      updateData.tags =
        normalizeTags(
          body.tags
        );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("knowledge")
      .update(updateData)
      .eq(
        "id",
        id
      )
      .select(
        `
          id,
          user_id,
          workspace_id,
          project_id,
          team_id,
          title,
          description,
          content,
          type,
          status,
          visibility,
          source_url,
          file_name,
          file_path,
          file_type,
          file_size,
          metadata,
          tags,
          embedding,
          created_at,
          updated_at
        `
      )
      .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN KNOWLEDGE UPDATE ERROR:",
        error
      );

      return jsonError(
        "Knowledge record could not be updated.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Knowledge record not found.",
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
      "SYRAVEN KNOWLEDGE UPDATE ERROR:",
      error
    );

    return jsonError(
      "Failed to update knowledge.",
      500
    );
  }
}

/* ==================================================
   DELETE KNOWLEDGE
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

    if (!id) {
      return jsonError(
        "Knowledge id is required.",
        400
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("knowledge")
      .delete()
      .eq(
        "id",
        id
      )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN KNOWLEDGE DELETE ERROR:",
        error
      );

      return jsonError(
        "Knowledge record could not be deleted.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Knowledge record not found.",
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
      "SYRAVEN KNOWLEDGE DELETE ERROR:",
      error
    );

    return jsonError(
      "Failed to delete knowledge.",
      500
    );
  }
}