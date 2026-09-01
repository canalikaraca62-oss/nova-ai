import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toJson } from "@/lib/supabase/json";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN TASKS API
================================================== */

/* ==================================================
   DATABASE TYPES
================================================== */

type TaskInsert =
  Database["public"]["Tables"]["tasks"]["Insert"];

type TaskUpdate =
  Database["public"]["Tables"]["tasks"]["Update"];

type TaskRow =
  Database["public"]["Tables"]["tasks"]["Row"];

/* ==================================================
   DOMAIN TYPES
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

/* ==================================================
   REQUEST TYPES
================================================== */

type TaskPayload = {
  id?: unknown;

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

const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;

const TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 20_000;

const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 100;

const MAX_SEARCH_LENGTH = 500;

const MAX_METADATA_SIZE = 100_000;

/* ==================================================
   SELECT
================================================== */

const TASK_SELECT = `
  id,
  user_id,
  title,
  description,
  status,
  priority,
  project_id,
  agent_id,
  due_date,
  tags,
  metadata,
  created_at,
  updated_at
`;

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
): Promise<{
  userId: string | null;
  error: string | null;
}> {
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

  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (
      error ||
      !data.user
    ) {
      return {
        userId: null,
        error: "Unauthorized.",
      };
    }

    return {
      userId: data.user.id,
      error: null,
    };
  } catch (error) {
    console.error(
      "SYRAVEN AUTH ERROR:",
      error
    );

    return {
      userId: null,
      error: "Authentication failed.",
    };
  }
}

/* ==================================================
   GENERAL NORMALIZERS
================================================== */

function normalizeString(
  value: unknown,
  maxLength = 10_000
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength
  );
}

function normalizeNullableString(
  value: unknown,
  maxLength = 10_000
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return normalizeString(
    value,
    maxLength
  );
}

function normalizeLimit(
  value: string | null
): number {
  const parsed =
    Number(value);

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
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
}

/* ==================================================
   ENUM VALIDATION
================================================== */

function isTaskStatus(
  value: unknown
): value is TaskStatus {
  return (
    typeof value === "string" &&
    TASK_STATUSES.includes(
      value as TaskStatus
    )
  );
}

function isTaskPriority(
  value: unknown
): value is TaskPriority {
  return (
    typeof value === "string" &&
    TASK_PRIORITIES.includes(
      value as TaskPriority
    )
  );
}

function normalizeStatus(
  value: unknown,
  fallback: TaskStatus = "todo"
): TaskStatus {
  return isTaskStatus(value)
    ? value
    : fallback;
}

function normalizePriority(
  value: unknown,
  fallback: TaskPriority = "medium"
): TaskPriority {
  return isTaskPriority(value)
    ? value
    : fallback;
}

/* ==================================================
   TAGS
================================================== */

function normalizeTags(
  value: unknown
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  const uniqueTags =
    new Set<string>();

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

    if (!tag) {
      continue;
    }

    uniqueTags.add(tag);

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

/* ==================================================
   METADATA
================================================== */

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

  try {
    const serialized =
      JSON.stringify(value);

    if (
      serialized.length >
      MAX_METADATA_SIZE
    ) {
      return {};
    }

    return JSON.parse(
      serialized
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ==================================================
   DATE
================================================== */

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

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  const date =
    new Date(normalized);

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
   SEARCH SANITIZER
================================================== */

function normalizeSearch(
  value: string | null
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .replace(/[,()]/g, " ")
      .trim()
      .slice(
        0,
        MAX_SEARCH_LENGTH
      );

  return normalized || null;
}

/* ==================================================
   JSON BODY
================================================== */

async function parseJsonBody(
  request: NextRequest
): Promise<
  | {
      success: true;
      data: Record<string, unknown>;
    }
  | {
      success: false;
      error: string;
      code: string;
    }
> {
  try {
    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return {
        success: false,
        error:
          "Request body must be a JSON object.",
        code:
          "INVALID_BODY",
      };
    }

    return {
      success: true,
      data:
        body as Record<
          string,
          unknown
        >,
    };
  } catch {
    return {
      success: false,
      error:
        "Invalid JSON body.",
      code:
        "INVALID_JSON",
    };
  }
}

/* ==================================================
   CREATE INPUT VALIDATION
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
      code: string;
    } {
  const title =
    normalizeString(
      payload.title,
      MAX_TITLE_LENGTH
    );

  if (!title) {
    return {
      success: false,
      error:
        "Task title is required.",
      code:
        "TITLE_REQUIRED",
    };
  }

  if (
    typeof payload.title === "string" &&
    payload.title.trim().length >
      MAX_TITLE_LENGTH
  ) {
    return {
      success: false,
      error:
        `Task title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
      code:
        "TITLE_TOO_LONG",
    };
  }

  const description =
    normalizeNullableString(
      payload.description,
      MAX_DESCRIPTION_LENGTH
    );

  if (
    typeof payload.description === "string" &&
    payload.description.trim().length >
      MAX_DESCRIPTION_LENGTH
  ) {
    return {
      success: false,
      error:
        `Task description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
      code:
        "DESCRIPTION_TOO_LONG",
    };
  }

  if (
    payload.status !== undefined &&
    !isTaskStatus(
      payload.status
    )
  ) {
    return {
      success: false,
      error:
        "Invalid task status.",
      code:
        "INVALID_STATUS",
    };
  }

  if (
    payload.priority !== undefined &&
    !isTaskPriority(
      payload.priority
    )
  ) {
    return {
      success: false,
      error:
        "Invalid task priority.",
      code:
        "INVALID_PRIORITY",
    };
  }

  const rawProjectId =
    payload.projectId ??
    payload.project_id;

  const rawAgentId =
    payload.agentId ??
    payload.agent_id;

  const rawDueDate =
    payload.dueDate ??
    payload.due_date;

  if (
    rawDueDate !== undefined &&
    rawDueDate !== null &&
    rawDueDate !== ""
  ) {
    const parsedDate =
      normalizeDate(
        rawDueDate
      );

    if (!parsedDate) {
      return {
        success: false,
        error:
          "Invalid due date.",
        code:
          "INVALID_DUE_DATE",
      };
    }
  }

  return {
    success: true,
    data: {
      title,
      description,

      status:
        normalizeStatus(
          payload.status
        ),

      priority:
        normalizePriority(
          payload.priority
        ),

      projectId:
        normalizeNullableString(
          rawProjectId,
          200
        ),

      agentId:
        normalizeNullableString(
          rawAgentId,
          200
        ),

      dueDate:
        normalizeDate(
          rawDueDate
        ),

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
   PROJECT ACCESS VALIDATION
================================================== */

async function validateProjectAccess(
  projectId: string,
  userId: string
): Promise<{
  valid: boolean;
  databaseError: boolean;
}> {
  const {
    data,
    error,
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
        userId
      )
      .maybeSingle();

  if (error) {
    console.error(
      "SYRAVEN PROJECT VALIDATION ERROR:",
      error
    );

    return {
      valid: false,
      databaseError: true,
    };
  }

  return {
    valid: Boolean(data),
    databaseError: false,
  };
}

/* ==================================================
   AGENT ACCESS VALIDATION
================================================== */

async function validateAgentAccess(
  agentId: string,
  userId: string
): Promise<{
  valid: boolean;
  databaseError: boolean;
}> {
  const {
    data,
    error,
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
        userId
      )
      .maybeSingle();

  if (error) {
    console.error(
      "SYRAVEN AGENT VALIDATION ERROR:",
      error
    );

    return {
      valid: false,
      databaseError: true,
    };
  }

  return {
    valid: Boolean(data),
    databaseError: false,
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

    const rawStatus =
      searchParams.get(
        "status"
      );

    const rawPriority =
      searchParams.get(
        "priority"
      );

    const projectId =
      normalizeString(
        searchParams.get(
          "projectId"
        ) ??
        searchParams.get(
          "project_id"
        ),
        200
      );

    const agentId =
      normalizeString(
        searchParams.get(
          "agentId"
        ) ??
        searchParams.get(
          "agent_id"
        ),
        200
      );

    const search =
      normalizeSearch(
        searchParams.get(
          "search"
        )
      );

    const limit =
      normalizeLimit(
        searchParams.get(
          "limit"
        )
      );

    const offset =
      normalizeOffset(
        searchParams.get(
          "offset"
        )
      );

    let query =
      supabaseAdmin
        .from("tasks")
        .select(
          TASK_SELECT,
          {
            count: "exact",
          }
        )
        .eq(
          "user_id",
          auth.userId
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

    if (
      rawStatus &&
      isTaskStatus(
        rawStatus
      )
    ) {
      query =
        query.eq(
          "status",
          rawStatus
        );
    }

    if (
      rawPriority &&
      isTaskPriority(
        rawPriority
      )
    ) {
      query =
        query.eq(
          "priority",
          rawPriority
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

    if (search) {
      query =
        query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
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

    const total =
      count ?? 0;

    return success({
      tasks:
        data ?? [],

      pagination: {
        total,
        limit,
        offset,

        hasMore:
          total >
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
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       BODY
    ---------------------------------------------- */

    const bodyResult =
      await parseJsonBody(
        request
      );

    if (!bodyResult.success) {
      return failure(
        bodyResult.error,
        400,
        bodyResult.code
      );
    }

    const payload =
      bodyResult.data as TaskPayload;

    /* ----------------------------------------------
       VALIDATE INPUT
    ---------------------------------------------- */

    const parsed =
      parseCreateInput(
        payload
      );

    if (!parsed.success) {
      return failure(
        parsed.error,
        400,
        parsed.code
      );
    }

    const input =
      parsed.data;

    /* ----------------------------------------------
       VALIDATE PROJECT
    ---------------------------------------------- */

    if (input.projectId) {
      const projectValidation =
        await validateProjectAccess(
          input.projectId,
          auth.userId
        );

      if (
        projectValidation.databaseError
      ) {
        return failure(
          "Failed to verify project access.",
          500,
          "PROJECT_VALIDATION_FAILED"
        );
      }

      if (
        !projectValidation.valid
      ) {
        return failure(
          "Project not found or access denied.",
          403,
          "PROJECT_ACCESS_DENIED"
        );
      }
    }

    /* ----------------------------------------------
       VALIDATE AGENT
    ---------------------------------------------- */

    if (input.agentId) {
      const agentValidation =
        await validateAgentAccess(
          input.agentId,
          auth.userId
        );

      if (
        agentValidation.databaseError
      ) {
        return failure(
          "Failed to verify agent access.",
          500,
          "AGENT_VALIDATION_FAILED"
        );
      }

      if (
        !agentValidation.valid
      ) {
        return failure(
          "Agent not found or access denied.",
          403,
          "AGENT_ACCESS_DENIED"
        );
      }
    }

    /* ----------------------------------------------
       INSERT
    ---------------------------------------------- */

    const now =
      new Date().toISOString();

    const insertData: TaskInsert = {
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
        toJson(
          input.metadata
        ),

      updated_at:
        now,
    };

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("tasks")
        .insert(
          insertData
        )
        .select(
          TASK_SELECT
        )
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
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       BODY
    ---------------------------------------------- */

    const bodyResult =
      await parseJsonBody(
        request
      );

    if (!bodyResult.success) {
      return failure(
        bodyResult.error,
        400,
        bodyResult.code
      );
    }

    const payload =
      bodyResult.data as TaskPayload;

    /* ----------------------------------------------
       TASK ID
    ---------------------------------------------- */

    const queryTaskId =
      request.nextUrl.searchParams.get(
        "id"
      );

    const bodyTaskId =
      normalizeString(
        payload.id,
        200
      );

    const taskId =
      normalizeString(
        queryTaskId,
        200
      ) ??
      bodyTaskId;

    if (!taskId) {
      return failure(
        "Task id is required.",
        400,
        "TASK_ID_REQUIRED"
      );
    }

    /* ----------------------------------------------
       LOAD EXISTING TASK
    ---------------------------------------------- */

    const {
      data: existingTask,
      error: existingTaskError,
    } =
      await supabaseAdmin
        .from("tasks")
        .select(
          `
            id,
            project_id,
            agent_id
          `
        )
        .eq(
          "id",
          taskId
        )
        .eq(
          "user_id",
          auth.userId
        )
        .maybeSingle();

    if (existingTaskError) {
      console.error(
        "SYRAVEN TASK LOOKUP ERROR:",
        existingTaskError
      );

      return failure(
        "Failed to verify task.",
        500,
        "TASK_LOOKUP_FAILED"
      );
    }

    if (!existingTask) {
      return failure(
        "Task not found.",
        404,
        "TASK_NOT_FOUND"
      );
    }

    /* ----------------------------------------------
       UPDATE DATA
    ---------------------------------------------- */

    const updateData: TaskUpdate = {
      updated_at:
        new Date().toISOString(),
    };

    let hasUpdates = false;

    /* ----------------------------------------------
       TITLE
    ---------------------------------------------- */

    if (
      payload.title !==
      undefined
    ) {
      const title =
        normalizeString(
          payload.title,
          MAX_TITLE_LENGTH
        );

      if (!title) {
        return failure(
          "Task title cannot be empty.",
          400,
          "INVALID_TITLE"
        );
      }

      if (
        typeof payload.title === "string" &&
        payload.title.trim().length >
          MAX_TITLE_LENGTH
      ) {
        return failure(
          `Task title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
          400,
          "TITLE_TOO_LONG"
        );
      }

      updateData.title =
        title;

      hasUpdates = true;
    }

    /* ----------------------------------------------
       DESCRIPTION
    ---------------------------------------------- */

    if (
      payload.description !==
      undefined
    ) {
      if (
        payload.description !== null &&
        typeof payload.description !==
          "string"
      ) {
        return failure(
          "Description must be a string or null.",
          400,
          "INVALID_DESCRIPTION"
        );
      }

      if (
        typeof payload.description === "string" &&
        payload.description.trim().length >
          MAX_DESCRIPTION_LENGTH
      ) {
        return failure(
          `Task description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
          400,
          "DESCRIPTION_TOO_LONG"
        );
      }

      updateData.description =
        normalizeNullableString(
          payload.description,
          MAX_DESCRIPTION_LENGTH
        );

      hasUpdates = true;
    }

    /* ----------------------------------------------
       STATUS
    ---------------------------------------------- */

    if (
      payload.status !==
      undefined
    ) {
      if (
        !isTaskStatus(
          payload.status
        )
      ) {
        return failure(
          "Invalid task status.",
          400,
          "INVALID_STATUS"
        );
      }

      updateData.status =
        payload.status;

      hasUpdates = true;
    }

    /* ----------------------------------------------
       PRIORITY
    ---------------------------------------------- */

    if (
      payload.priority !==
      undefined
    ) {
      if (
        !isTaskPriority(
          payload.priority
        )
      ) {
        return failure(
          "Invalid task priority.",
          400,
          "INVALID_PRIORITY"
        );
      }

      updateData.priority =
        payload.priority;

      hasUpdates = true;
    }

    /* ----------------------------------------------
       TAGS
    ---------------------------------------------- */

    if (
      payload.tags !==
      undefined
    ) {
      if (
        !Array.isArray(
          payload.tags
        )
      ) {
        return failure(
          "Tags must be an array.",
          400,
          "INVALID_TAGS"
        );
      }

      updateData.tags =
        normalizeTags(
          payload.tags
        );

      hasUpdates = true;
    }

    /* ----------------------------------------------
       METADATA
    ---------------------------------------------- */

    if (
      payload.metadata !==
      undefined
    ) {
      if (
        !payload.metadata ||
        typeof payload.metadata !==
          "object" ||
        Array.isArray(
          payload.metadata
        )
      ) {
        return failure(
          "Metadata must be a JSON object.",
          400,
          "INVALID_METADATA"
        );
      }

      try {
        const serialized =
          JSON.stringify(
            payload.metadata
          );

        if (
          serialized.length >
          MAX_METADATA_SIZE
        ) {
          return failure(
            `Metadata cannot exceed ${MAX_METADATA_SIZE} bytes.`,
            400,
            "METADATA_TOO_LARGE"
          );
        }

        updateData.metadata =
          toJson(
            JSON.parse(
              serialized
            )
          );
      } catch {
        return failure(
          "Metadata must be JSON serializable.",
          400,
          "INVALID_METADATA"
        );
      }

      hasUpdates = true;
    }

    /* ----------------------------------------------
       DUE DATE
    ---------------------------------------------- */

    const hasDueDateUpdate =
      payload.dueDate !==
        undefined ||
      payload.due_date !==
        undefined;

    if (
      hasDueDateUpdate
    ) {
      const rawDueDate =
        payload.dueDate ??
        payload.due_date;

      if (
        rawDueDate !== null &&
        rawDueDate !== undefined &&
        rawDueDate !== ""
      ) {
        const dueDate =
          normalizeDate(
            rawDueDate
          );

        if (!dueDate) {
          return failure(
            "Invalid due date.",
            400,
            "INVALID_DUE_DATE"
          );
        }

        updateData.due_date =
          dueDate;
      } else {
        updateData.due_date =
          null;
      }

      hasUpdates = true;
    }

    /* ----------------------------------------------
       PROJECT
    ---------------------------------------------- */

    const hasProjectUpdate =
      payload.projectId !==
        undefined ||
      payload.project_id !==
        undefined;

    if (
      hasProjectUpdate
    ) {
      const rawProjectId =
        payload.projectId ??
        payload.project_id;

      let projectId: string | null =
        null;

      if (
        rawProjectId !== null &&
        rawProjectId !== undefined &&
        rawProjectId !== ""
      ) {
        projectId =
          normalizeString(
            rawProjectId,
            200
          );

        if (!projectId) {
          return failure(
            "Invalid project id.",
            400,
            "INVALID_PROJECT_ID"
          );
        }

        const validation =
          await validateProjectAccess(
            projectId,
            auth.userId
          );

        if (
          validation.databaseError
        ) {
          return failure(
            "Failed to verify project access.",
            500,
            "PROJECT_VALIDATION_FAILED"
          );
        }

        if (
          !validation.valid
        ) {
          return failure(
            "Project not found or access denied.",
            403,
            "PROJECT_ACCESS_DENIED"
          );
        }
      }

      updateData.project_id =
        projectId;

      hasUpdates = true;
    }

    /* ----------------------------------------------
       AGENT
    ---------------------------------------------- */

    const hasAgentUpdate =
      payload.agentId !==
        undefined ||
      payload.agent_id !==
        undefined;

    if (
      hasAgentUpdate
    ) {
      const rawAgentId =
        payload.agentId ??
        payload.agent_id;

      let agentId: string | null =
        null;

      if (
        rawAgentId !== null &&
        rawAgentId !== undefined &&
        rawAgentId !== ""
      ) {
        agentId =
          normalizeString(
            rawAgentId,
            200
          );

        if (!agentId) {
          return failure(
            "Invalid agent id.",
            400,
            "INVALID_AGENT_ID"
          );
        }

        const validation =
          await validateAgentAccess(
            agentId,
            auth.userId
          );

        if (
          validation.databaseError
        ) {
          return failure(
            "Failed to verify agent access.",
            500,
            "AGENT_VALIDATION_FAILED"
          );
        }

        if (
          !validation.valid
        ) {
          return failure(
            "Agent not found or access denied.",
            403,
            "AGENT_ACCESS_DENIED"
          );
        }
      }

      updateData.agent_id =
        agentId;

      hasUpdates = true;
    }

    /* ----------------------------------------------
       NO UPDATES
    ---------------------------------------------- */

    if (!hasUpdates) {
      return failure(
        "No valid fields supplied for update.",
        400,
        "NO_UPDATES"
      );
    }

    /* ----------------------------------------------
       UPDATE
    ---------------------------------------------- */

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("tasks")
        .update(
          updateData
        )
        .eq(
          "id",
          taskId
        )
        .eq(
          "user_id",
          auth.userId
        )
        .select(
          TASK_SELECT
        )
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
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       TASK ID
    ---------------------------------------------- */

    const taskId =
      normalizeString(
        request.nextUrl.searchParams.get(
          "id"
        ),
        200
      );

    if (!taskId) {
      return failure(
        "Task id is required.",
        400,
        "TASK_ID_REQUIRED"
      );
    }

    /* ----------------------------------------------
       DELETE
    ---------------------------------------------- */

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
      id:
        data.id,

      deleted:
        true,
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