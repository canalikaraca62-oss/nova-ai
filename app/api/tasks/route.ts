import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   TYPES
================================================== */

type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

type TaskPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

type TaskPayload = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  projectId?: unknown;
  project_id?: unknown;
  agentId?: unknown;
  agent_id?: unknown;
  dueDate?: unknown;
  due_date?: unknown;
  tags?: unknown;
  metadata?: unknown;
};

type SafeTaskInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string | null;
  agentId: string | null;
  dueDate: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
};

/* ==================================================
   CONSTANTS
================================================== */

const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 20000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 80;

/* ==================================================
   RESPONSE HELPERS
================================================== */

function success(
  data: unknown,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
    }
  );
}

function failure(
  error: string,
  status = 400,
  code?: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      code: code ?? null,
    },
    {
      status,
    }
  );
}

/* ==================================================
   AUTH
================================================== */

async function getAuthenticatedUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return {
      userId: null,
      error: "Missing authorization header.",
    };
  }

  const token =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : authorization.trim();

  if (!token) {
    return {
      userId: null,
      error: "Invalid authorization token.",
    };
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return {
      userId: null,
      error: "Unauthorized.",
    };
  }

  return {
    userId: data.user.id,
    error: null,
  };
}

/* ==================================================
   NORMALIZERS
================================================== */

function normalizeString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function normalizeNullableString(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function normalizeStatus(
  value: unknown,
  fallback: TaskStatus = "todo"
): TaskStatus {
  if (
    typeof value === "string" &&
    TASK_STATUSES.includes(
      value as TaskStatus
    )
  ) {
    return value as TaskStatus;
  }

  return fallback;
}

function normalizePriority(
  value: unknown,
  fallback: TaskPriority = "medium"
): TaskPriority {
  if (
    typeof value === "string" &&
    TASK_PRIORITIES.includes(
      value as TaskPriority
    )
  ) {
    return value as TaskPriority;
  }

  return fallback;
}

function normalizeTags(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueTags = new Set<string>();

  for (const item of value) {
    if (
      typeof item !== "string"
    ) {
      continue;
    }

    const tag =
      item
        .trim()
        .slice(
          0,
          MAX_TAG_LENGTH
        );

    if (tag) {
      uniqueTags.add(tag);
    }

    if (
      uniqueTags.size >=
      MAX_TAGS
    ) {
      break;
    }
  }

  return Array.from(
    uniqueTags
  );
}

function normalizeMetadata(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

function normalizeDate(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date =
    new Date(value);

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
   CREATE INPUT
================================================== */

function parseCreateInput(
  payload: TaskPayload
):
  | {
      success: true;
      data: SafeTaskInput;
    }
  | {
      success: false;
      error: string;
    } {
  const rawTitle =
    normalizeString(
      payload.title
    );

  if (!rawTitle) {
    return {
      success: false,
      error:
        "Task title is required.",
    };
  }

  if (
    rawTitle.length >
    MAX_TITLE_LENGTH
  ) {
    return {
      success: false,
      error:
        `Task title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
    };
  }

  const rawDescription =
    normalizeNullableString(
      payload.description
    );

  if (
    rawDescription &&
    rawDescription.length >
      MAX_DESCRIPTION_LENGTH
  ) {
    return {
      success: false,
      error:
        `Task description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
    };
  }

  const projectId =
    normalizeNullableString(
      payload.projectId ??
      payload.project_id
    );

  const agentId =
    normalizeNullableString(
      payload.agentId ??
      payload.agent_id
    );

  const dueDate =
    normalizeDate(
      payload.dueDate ??
      payload.due_date
    );

  return {
    success: true,
    data: {
      title: rawTitle,
      description:
        rawDescription,
      status:
        normalizeStatus(
          payload.status
        ),
      priority:
        normalizePriority(
          payload.priority
        ),
      projectId,
      agentId,
      dueDate,
      tags:
        normalizeTags(
          payload.tags
        ),
      metadata:
        normalizeMetadata(
          payload.metadata
        ),
    },
  };
}

/* ==================================================
   GET TASKS
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (!auth.userId) {
      return failure(
        auth.error ??
          "Unauthorized.",
        401,
        "UNAUTHORIZED"
      );
    }

    const searchParams =
      request.nextUrl.searchParams;

    const status =
      searchParams.get(
        "status"
      );

    const priority =
      searchParams.get(
        "priority"
      );

    const projectId =
      searchParams.get(
        "projectId"
      ) ??
      searchParams.get(
        "project_id"
      );

    const agentId =
      searchParams.get(
        "agentId"
      ) ??
      searchParams.get(
        "agent_id"
      );

    const limitParam =
      Number(
        searchParams.get(
          "limit"
        ) ?? "50"
      );

    const offsetParam =
      Number(
        searchParams.get(
          "offset"
        ) ?? "0"
      );

    const limit =
      Number.isFinite(
        limitParam
      )
        ? Math.min(
            Math.max(
              Math.floor(
                limitParam
              ),
              1
            ),
            100
          )
        : 50;

    const offset =
      Number.isFinite(
        offsetParam
      )
        ? Math.max(
            Math.floor(
              offsetParam
            ),
            0
          )
        : 0;

    let query =
      supabaseAdmin
        .from("tasks")
        .select(
          "*",
          {
            count: "exact",
          }
        )
        .eq(
          "user_id",
          auth.userId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .range(
          offset,
          offset +
            limit -
            1
        );

    if (
      status &&
      TASK_STATUSES.includes(
        status as TaskStatus
      )
    ) {
      query =
        query.eq(
          "status",
          status
        );
    }

    if (
      priority &&
      TASK_PRIORITIES.includes(
        priority as TaskPriority
      )
    ) {
      query =
        query.eq(
          "priority",
          priority
        );
    }

    if (projectId) {
      query =
        query.eq(
          "project_id",
          projectId
        );
    }

    if (agentId) {
      query =
        query.eq(
          "agent_id",
          agentId
        );
    }

    const {
      data,
      error,
      count,
    } =
      await query;

    if (error) {
      console.error(
        "SYRAVEN TASKS GET ERROR:",
        error
      );

      return failure(
        "Failed to load tasks.",
        500,
        "TASKS_FETCH_FAILED"
      );
    }

    return success({
      tasks:
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
    });
  } catch (error) {
    console.error(
      "SYRAVEN TASKS GET UNEXPECTED ERROR:",
      error
    );

    return failure(
      "Unexpected error while loading tasks.",
      500,
      "INTERNAL_ERROR"
    );
  }
}

/* ==================================================
   CREATE TASK
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (!auth.userId) {
      return failure(
        auth.error ??
          "Unauthorized.",
        401,
        "UNAUTHORIZED"
      );
    }

    let payload: TaskPayload;

    try {
      payload =
        await request.json();
    } catch {
      return failure(
        "Invalid JSON body.",
        400,
        "INVALID_JSON"
      );
    }

    const parsed =
      parseCreateInput(
        payload
      );

    if (!parsed.success) {
      return failure(
        parsed.error,
        400,
        "INVALID_TASK"
      );
    }

    const input =
      parsed.data;

    if (input.projectId) {
      const {
        data: project,
        error: projectError,
      } =
        await supabaseAdmin
          .from("projects")
          .select("id")
          .eq(
            "id",
            input.projectId
          )
          .eq(
            "user_id",
            auth.userId
          )
          .maybeSingle();

      if (
        projectError ||
        !project
      ) {
        return failure(
          "Project not found or access denied.",
          403,
          "PROJECT_ACCESS_DENIED"
        );
      }
    }

    if (input.agentId) {
      const {
        data: agent,
        error: agentError,
      } =
        await supabaseAdmin
          .from("agents")
          .select("id")
          .eq(
            "id",
            input.agentId
          )
          .eq(
            "user_id",
            auth.userId
          )
          .maybeSingle();

      if (
        agentError ||
        !agent
      ) {
        return failure(
          "Agent not found or access denied.",
          403,
          "AGENT_ACCESS_DENIED"
        );
      }
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("tasks")
        .insert({
          user_id:
            auth.userId,
          title:
            input.title,
          description:
            input.description,
          status:
            input.status,
          priority:
            input.priority,
          project_id:
            input.projectId,
          agent_id:
            input.agentId,
          due_date:
            input.dueDate,
          tags:
            input.tags,
          metadata:
            input.metadata,
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "SYRAVEN TASK CREATE ERROR:",
        error
      );

      return failure(
        "Failed to create task.",
        500,
        "TASK_CREATE_FAILED"
      );
    }

    return success(
      {
        task: data,
      },
      201
    );
  } catch (error) {
    console.error(
      "SYRAVEN TASK CREATE UNEXPECTED ERROR:",
      error
    );

    return failure(
      "Unexpected error while creating task.",
      500,
      "INTERNAL_ERROR"
    );
  }
}

/* ==================================================
   UPDATE TASK
================================================== */

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (!auth.userId) {
      return failure(
        auth.error ??
          "Unauthorized.",
        401,
        "UNAUTHORIZED"
      );
    }

    const taskId =
      request.nextUrl.searchParams.get(
        "id"
      );

    if (!taskId) {
      return failure(
        "Task id is required.",
        400,
        "TASK_ID_REQUIRED"
      );
    }

    let payload: TaskPayload;

    try {
      payload =
        await request.json();
    } catch {
      return failure(
        "Invalid JSON body.",
        400,
        "INVALID_JSON"
      );
    }

    const updates: Record<
      string,
      unknown
    > = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      payload.title !==
      undefined
    ) {
      const title =
        normalizeString(
          payload.title
        );

      if (!title) {
        return failure(
          "Task title cannot be empty.",
          400,
          "INVALID_TITLE"
        );
      }

      if (
        title.length >
        MAX_TITLE_LENGTH
      ) {
        return failure(
          `Task title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
          400,
          "INVALID_TITLE"
        );
      }

      updates.title =
        title;
    }

    if (
      payload.description !==
      undefined
    ) {
      const description =
        normalizeNullableString(
          payload.description
        );

      if (
        description &&
        description.length >
          MAX_DESCRIPTION_LENGTH
      ) {
        return failure(
          `Task description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
          400,
          "INVALID_DESCRIPTION"
        );
      }

      updates.description =
        description;
    }

    if (
      payload.status !==
      undefined
    ) {
      if (
        !TASK_STATUSES.includes(
          payload.status as TaskStatus
        )
      ) {
        return failure(
          "Invalid task status.",
          400,
          "INVALID_STATUS"
        );
      }

      updates.status =
        payload.status;
    }

    if (
      payload.priority !==
      undefined
    ) {
      if (
        !TASK_PRIORITIES.includes(
          payload.priority as TaskPriority
        )
      ) {
        return failure(
          "Invalid task priority.",
          400,
          "INVALID_PRIORITY"
        );
      }

      updates.priority =
        payload.priority;
    }

    if (
      payload.tags !==
      undefined
    ) {
      updates.tags =
        normalizeTags(
          payload.tags
        );
    }

    if (
      payload.metadata !==
      undefined
    ) {
      updates.metadata =
        normalizeMetadata(
          payload.metadata
        );
    }

    if (
      payload.dueDate !==
        undefined ||
      payload.due_date !==
        undefined
    ) {
      updates.due_date =
        normalizeDate(
          payload.dueDate ??
          payload.due_date
        );
    }

    const projectValue =
      payload.projectId ??
      payload.project_id;

    if (
      projectValue !==
      undefined
    ) {
      const projectId =
        normalizeNullableString(
          projectValue
        );

      if (projectId) {
        const {
          data: project,
        } =
          await supabaseAdmin
            .from("projects")
            .select("id")
            .eq(
              "id",
              projectId
            )
            .eq(
              "user_id",
              auth.userId
            )
            .maybeSingle();

        if (!project) {
          return failure(
            "Project not found or access denied.",
            403,
            "PROJECT_ACCESS_DENIED"
          );
        }
      }

      updates.project_id =
        projectId;
    }

    const agentValue =
      payload.agentId ??
      payload.agent_id;

    if (
      agentValue !==
      undefined
    ) {
      const agentId =
        normalizeNullableString(
          agentValue
        );

      if (agentId) {
        const {
          data: agent,
        } =
          await supabaseAdmin
            .from("agents")
            .select("id")
            .eq(
              "id",
              agentId
            )
            .eq(
              "user_id",
              auth.userId
            )
            .maybeSingle();

        if (!agent) {
          return failure(
            "Agent not found or access denied.",
            403,
            "AGENT_ACCESS_DENIED"
          );
        }
      }

      updates.agent_id =
        agentId;
    }

    if (
      Object.keys(
        updates
      ).length === 1
    ) {
      return failure(
        "No valid fields supplied for update.",
        400,
        "NO_UPDATES"
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("tasks")
        .update(
          updates
        )
        .eq(
          "id",
          taskId
        )
        .eq(
          "user_id",
          auth.userId
        )
        .select("*")
        .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN TASK UPDATE ERROR:",
        error
      );

      return failure(
        "Failed to update task.",
        500,
        "TASK_UPDATE_FAILED"
      );
    }

    if (!data) {
      return failure(
        "Task not found.",
        404,
        "TASK_NOT_FOUND"
      );
    }

    return success({
      task: data,
    });
  } catch (error) {
    console.error(
      "SYRAVEN TASK UPDATE UNEXPECTED ERROR:",
      error
    );

    return failure(
      "Unexpected error while updating task.",
      500,
      "INTERNAL_ERROR"
    );
  }
}

/* ==================================================
   DELETE TASK
================================================== */

export async function DELETE(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (!auth.userId) {
      return failure(
        auth.error ??
          "Unauthorized.",
        401,
        "UNAUTHORIZED"
      );
    }

    const taskId =
      request.nextUrl.searchParams.get(
        "id"
      );

    if (!taskId) {
      return failure(
        "Task id is required.",
        400,
        "TASK_ID_REQUIRED"
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("tasks")
        .delete()
        .eq(
          "id",
          taskId
        )
        .eq(
          "user_id",
          auth.userId
        )
        .select("id")
        .maybeSingle();

    if (error) {
      console.error(
        "SYRAVEN TASK DELETE ERROR:",
        error
      );

      return failure(
        "Failed to delete task.",
        500,
        "TASK_DELETE_FAILED"
      );
    }

    if (!data) {
      return failure(
        "Task not found.",
        404,
        "TASK_NOT_FOUND"
      );
    }

    return success({
      id: data.id,
      deleted: true,
    });
  } catch (error) {
    console.error(
      "SYRAVEN TASK DELETE UNEXPECTED ERROR:",
      error
    );

    return failure(
      "Unexpected error while deleting task.",
      500,
      "INTERNAL_ERROR"
    );
  }
}