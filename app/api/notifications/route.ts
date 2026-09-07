import { NextResponse } from "next/server";

/*
  DATA ACCESS (Phase 4):

  Read, update and delete use the CALLER'S OWN RLS-enforced client.
  public.notifications carries owner-scoped select/update/delete policies
  (auth.uid() = user_id) matching this route's filters, so RLS enforces
  ownership beneath them (ARCHITECTURE_AUDIT.md §8.6).

  CREATE is the exception and still uses the service-role client:
  20260901165535 deliberately grants NO insert policy on
  public.notifications, because a notification is something the system
  raises about a user, not something a user writes for themselves. The
  POST handler is annotated at its query below.
*/
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toJson } from "@/lib/supabase/json";
import { withAuth } from "@/lib/api/withAuth";
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

export const GET = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller's RLS-enforced client is the default data path.
    */
    const db = session.supabase;

    const { searchParams } =
      new URL(request.url);

    /*
      SECURITY:

      Identity comes from the verified session only. A userId request
      parameter is deliberately NOT accepted: it previously allowed any
      caller to read another user's notifications
      (ARCHITECTURE_AUDIT.md 8.1).
    */
    const userId =
      session.userId;

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

    let query = db
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
});

/* ==================================================
   CREATE NOTIFICATION
================================================== */

export const POST = withAuth(async (
  request,
  session
) => {
  try {
    const body =
      (await request.json()) as
        CreateNotificationBody;

    /*
      SECURITY:

      Notifications are created for the authenticated caller only.
      A client-supplied userId in the body is ignored, so a caller cannot
      inject notifications into another user's feed.
    */
    const userId =
      session.userId;

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
    /*
      ELEVATED ACCESS — UNFORGEABLE_RECORD.

      public.notifications has no insert policy by design: a notification
      is raised BY the system ABOUT a user, not written by the user. The
      caller's client would therefore be denied here.

      Ownership is still enforced in code — user_id comes from the
      verified session (see above), never from the request body.
    */
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
});

/* ==================================================
   UPDATE NOTIFICATION
================================================== */

export const PATCH = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller's RLS-enforced client is the default data path.
    */
    const db = session.supabase;

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
    } = await db
      .from("notifications")
      .update(updateData)
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        session.userId
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
});

/* ==================================================
   DELETE NOTIFICATION
================================================== */

export const DELETE = withAuth(async (
  request,
  session
) => {
  try {
    /*
      Phase 4: the caller's RLS-enforced client is the default data path.
    */
    const db = session.supabase;

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
    } = await db
      .from("notifications")
      .delete()
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        session.userId
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
});