import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toJson } from "@/lib/supabase/json";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN NOTIFICATIONS API
================================================== */

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/* ==================================================
   DATABASE TYPES
================================================== */

type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

type NotificationUpdate =
  Database["public"]["Tables"]["notifications"]["Update"];

/* ==================================================
   TYPES
================================================== */

type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "message"
  | "mention"
  | "agent"
  | "project"
  | "task"
  | "billing"
  | "system";

type NotificationPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type CreateNotificationBody = {
  userId?: string;

  type?: NotificationType;
  priority?: NotificationPriority;

  title?: string;
  message?: string;

  actionUrl?: string | null;
  actionLabel?: string | null;

  metadata?: Record<string, unknown> | null;

  read?: boolean;
};

type UpdateNotificationBody = {
  id?: string;

  title?: string;
  message?: string;

  type?: NotificationType;
  priority?: NotificationPriority;

  actionUrl?: string | null;
  actionLabel?: string | null;

  metadata?: Record<string, unknown> | null;

  read?: boolean;
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

function normalizeString(
  value: unknown,
  maxLength: number
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

function normalizeBoolean(
  value: string | null
): boolean | null {
  if (value === null) {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function normalizeType(
  value: unknown
): NotificationType {
  switch (value) {
    case "info":
    case "success":
    case "warning":
    case "error":
    case "message":
    case "mention":
    case "agent":
    case "project":
    case "task":
    case "billing":
    case "system":
      return value;

    default:
      return "info";
  }
}

function normalizePriority(
  value: unknown
): NotificationPriority {
  switch (value) {
    case "low":
    case "normal":
    case "high":
    case "urgent":
      return value;

    default:
      return "normal";
  }
}

function normalizeMetadata(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
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

/* ==================================================
   GET NOTIFICATIONS
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

    const limit = normalizeLimit(
      searchParams.get("limit")
    );

    const offset = normalizeOffset(
      searchParams.get("offset")
    );

    const read = normalizeBoolean(
      searchParams.get("read")
    );

    const type =
      searchParams.get("type");

    const priority =
      searchParams.get("priority");

    let query = supabaseAdmin
      .from("notifications")
      .select(
        `
          id,
          user_id,
          type,
          priority,
          title,
          message,
          action_url,
          action_label,
          metadata,
          read,
          read_at,
          created_at,
          updated_at
        `,
        {
          count: "exact",
        }
      )
      .eq(
        "user_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .range(
        offset,
        offset + limit - 1
      );

    if (read !== null) {
      query = query.eq(
        "read",
        read
      );
    }

    if (type) {
      query = query.eq(
        "type",
        type
      );
    }

    if (priority) {
      query = query.eq(
        "priority",
        priority
      );
    }

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        "SYRAVEN NOTIFICATIONS GET ERROR:",
        error
      );

      return jsonError(
        "Notifications could not be loaded.",
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
      "SYRAVEN NOTIFICATIONS GET ERROR:",
      error
    );

    return jsonError(
      "Failed to load notifications.",
      500
    );
  }
}

/* ==================================================
   CREATE NOTIFICATION
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as
        CreateNotificationBody;

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

    const message =
      normalizeString(
        body.message,
        10000
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

    if (!message) {
      return jsonError(
        "message is required.",
        400
      );
    }

    const actionUrl =
      normalizeString(
        body.actionUrl,
        5000
      );

    const actionLabel =
      normalizeString(
        body.actionLabel,
        200
      );

    const type =
      normalizeType(
        body.type
      );

    const priority =
      normalizePriority(
        body.priority
      );

    const read =
      body.read === true;

    const now =
      new Date().toISOString();

    const insertData: NotificationInsert = {
      user_id: userId,

      type,

      priority,

      title,

      message,

      action_url:
        actionUrl ?? null,

      action_label:
        actionLabel ?? null,

      metadata: toJson(
        normalizeMetadata(
          body.metadata
        )
      ),

      read,

      read_at:
        read
          ? now
          : null,

      updated_at:
        now,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("notifications")
      .insert(insertData)
      .select(
        `
          id,
          user_id,
          type,
          priority,
          title,
          message,
          action_url,
          action_label,
          metadata,
          read,
          read_at,
          created_at,
          updated_at
        `
      )
      .single();

    if (error) {
      console.error(
        "SYRAVEN NOTIFICATION CREATE ERROR:",
        error
      );

      return jsonError(
        "Notification could not be created.",
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
      "SYRAVEN NOTIFICATION CREATE ERROR:",
      error
    );

    return jsonError(
      "Failed to create notification.",
      500
    );
  }
}

/* ==================================================
   UPDATE NOTIFICATION
================================================== */

export async function PATCH(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as
        UpdateNotificationBody;

    const id =
      normalizeString(
        body.id,
        200
      );

    if (!id) {
      return jsonError(
        "Notification id is required.",
        400
      );
    }

    const updateData: NotificationUpdate = {
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
      typeof body.message === "string"
    ) {
      const message =
        normalizeString(
          body.message,
          10000
        );

      if (!message) {
        return jsonError(
          "message cannot be empty.",
          400
        );
      }

      updateData.message = message;
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
      body.priority !== undefined
    ) {
      updateData.priority =
        normalizePriority(
          body.priority
        );
    }

    if (
      body.actionUrl !== undefined
    ) {
      updateData.action_url =
        normalizeString(
          body.actionUrl,
          5000
        );
    }

    if (
      body.actionLabel !== undefined
    ) {
      updateData.action_label =
        normalizeString(
          body.actionLabel,
          200
        );
    }

    if (
      body.metadata !== undefined
    ) {
      updateData.metadata = toJson(
        normalizeMetadata(
          body.metadata
        )
      );
    }

    if (
      typeof body.read === "boolean"
    ) {
      updateData.read =
        body.read;

      updateData.read_at =
        body.read
          ? new Date().toISOString()
          : null;
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("notifications")
      .update(updateData)
      .eq(
        "id",
        id
      )
      .select(
        `
          id,
          user_id,
          type,
          priority,
          title,
          message,
          action_url,
          action_label,
          metadata,
          read,
          read_at,
          created_at,
          updated_at
        `
      )
      .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN NOTIFICATION UPDATE ERROR:",
        error
      );

      return jsonError(
        "Notification could not be updated.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Notification not found.",
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
      "SYRAVEN NOTIFICATION UPDATE ERROR:",
      error
    );

    return jsonError(
      "Failed to update notification.",
      500
    );
  }
}

/* ==================================================
   DELETE NOTIFICATION
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
        "Notification id is required.",
        400
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq(
        "id",
        id
      )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN NOTIFICATION DELETE ERROR:",
        error
      );

      return jsonError(
        "Notification could not be deleted.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Notification not found.",
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
      "SYRAVEN NOTIFICATION DELETE ERROR:",
      error
    );

    return jsonError(
      "Failed to delete notification.",
      500
    );
  }
}