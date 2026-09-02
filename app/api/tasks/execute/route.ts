import type {
  NextRequest} from "next/server";
import {
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toJson } from "@/lib/supabase/json";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   DATABASE TYPES
================================================== */

type TaskRow =
  Database["public"]["Tables"]["tasks"]["Row"];

type TaskUpdate =
  Database["public"]["Tables"]["tasks"]["Update"];

/* ==================================================
   TYPES
================================================== */

type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

type ExecutePayload = {
  taskId?: unknown;
  task_id?: unknown;

  instruction?: unknown;
  prompt?: unknown;

  input?: unknown;

  autoComplete?: unknown;
  auto_complete?: unknown;
};

type TaskRecord = Pick<
  TaskRow,
  | "id"
  | "user_id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "project_id"
  | "agent_id"
  | "due_date"
  | "tags"
  | "metadata"
  | "created_at"
  | "updated_at"
>;

type ExecutionStatus =
  | "running"
  | "completed"
  | "failed";

type ExecutionRecord = {
  id: string;

  status: ExecutionStatus;

  startedAt: string;

  completedAt:
    | string
    | null;

  instruction:
    | string
    | null;

  input: unknown;

  result:
    | string
    | null;

  error:
    | string
    | null;
};

/* ==================================================
   CONSTANTS
================================================== */

const MAX_INSTRUCTION_LENGTH = 12000;

const MAX_EXECUTION_HISTORY = 20;

const MAX_TASK_ID_LENGTH = 200;

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
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return {
      userId: null,
      error:
        "Missing authorization header.",
    };
  }

  const token =
    authorization.startsWith(
      "Bearer "
    )
      ? authorization
          .slice(7)
          .trim()
      : authorization.trim();

  if (!token) {
    return {
      userId: null,
      error:
        "Invalid authorization token.",
    };
  }

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
    userId:
      data.user.id,
    error: null,
  };
}

/* ==================================================
   NORMALIZERS
================================================== */

function normalizeString(
  value: unknown,
  maxLength = 10000
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength
  );
}

function normalizeBoolean(
  value: unknown,
  fallback = true
): boolean {
  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      value
        .trim()
        .toLowerCase();

    if (
      normalized === "true"
    ) {
      return true;
    }

    if (
      normalized === "false"
    ) {
      return false;
    }
  }

  return fallback;
}

function normalizeMetadata(
  value: unknown
): Record<
  string,
  unknown
> {
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

function normalizeTaskStatus(
  value: unknown
): TaskStatus {
  switch (
    value
  ) {
    case "todo":
    case "in_progress":
    case "blocked":
    case "completed":
    case "cancelled":
      return value;

    default:
      return "todo";
  }
}

/* ==================================================
   EXECUTION ID
================================================== */

function createExecutionId(): string {
  const random =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
      ? crypto
          .randomUUID()
          .replace(
            /-/g,
            ""
          )
          .slice(
            0,
            16
          )
      : Math.random()
          .toString(36)
          .slice(
            2,
            18
          );

  return [
    "task_exec",
    Date.now().toString(36),
    random,
  ].join("_");
}

/* ==================================================
   EXECUTION HISTORY
================================================== */

function isExecutionRecord(
  value: unknown
): value is ExecutionRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof record.id ===
      "string" &&
    typeof record.status ===
      "string" &&
    typeof record.startedAt ===
      "string"
  );
}

function getExecutionHistory(
  metadata: Record<
    string,
    unknown
  >
): ExecutionRecord[] {
  const executions =
    metadata.executions;

  if (
    !Array.isArray(
      executions
    )
  ) {
    return [];
  }

  return executions
    .filter(
      isExecutionRecord
    )
    .slice(
      -MAX_EXECUTION_HISTORY
    );
}

function buildExecutionMetadata(
  existingMetadata: Record<
    string,
    unknown
  >,
  execution: ExecutionRecord
): Record<
  string,
  unknown
> {
  const previousExecutions =
    getExecutionHistory(
      existingMetadata
    );

  /*
   * Aynı execution id varsa
   * eski running kaydını replace eder.
   */

  const executions =
    previousExecutions.filter(
      (
        item
      ) =>
        item.id !==
        execution.id
    );

  executions.push(
    execution
  );

  return {
    ...existingMetadata,

    executions:
      executions.slice(
        -MAX_EXECUTION_HISTORY
      ),

    lastExecution:
      execution,
  };
}

/* ==================================================
   LOAD TASK
================================================== */

async function getTask(
  taskId: string,
  userId: string
): Promise<{
  task: TaskRecord | null;
  error: unknown;
}> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("tasks")
      .select(
        `
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
        `
      )
      .eq(
        "id",
        taskId
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  return {
    task:
      (data as TaskRecord | null) ??
      null,

    error,
  };
}

/* ==================================================
   UPDATE TASK EXECUTION
================================================== */

async function updateTaskExecution({
  taskId,
  userId,
  status,
  metadata,
}: {
  taskId: string;

  userId: string;

  status: TaskStatus;

  metadata: Record<
    string,
    unknown
  >;
}): Promise<{
  task: TaskRecord | null;
  error: unknown;
}> {
  const updateData: TaskUpdate = {
    status,

    metadata:
      toJson(
        metadata
      ),

    updated_at:
      new Date().toISOString(),
  };

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
        userId
      )
      .select(
        `
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
        `
      )
      .maybeSingle();

  return {
    task:
      (data as TaskRecord | null) ??
      null,

    error,
  };
}

/* ==================================================
   BUILD EXECUTION CONTEXT
================================================== */

function buildExecutionContext({
  task,
  instruction,
  input,
}: {
  task: TaskRecord;

  instruction:
    | string
    | null;

  input: unknown;
}) {
  return {
    taskId:
      task.id,

    title:
      task.title,

    description:
      task.description,

    status:
      task.status,

    priority:
      task.priority,

    projectId:
      task.project_id,

    agentId:
      task.agent_id,

    dueDate:
      task.due_date,

    tags:
      task.tags ?? [],

    instruction,

    input:
      input ?? null,
  };
}

/* ==================================================
   EXECUTION ENGINE
================================================== */

async function executeTask({
  task,
  instruction,
  input,
}: {
  task: TaskRecord;

  instruction:
    | string
    | null;

  input: unknown;
}) {
  const context =
    buildExecutionContext({
      task,
      instruction,
      input,
    });

  const steps: string[] =
    [];

  steps.push(
    `Task "${task.title}" execution started.`
  );

  if (
    task.description
  ) {
    steps.push(
      "Task description was included in the execution context."
    );
  }

  if (
    instruction
  ) {
    steps.push(
      "Custom execution instruction was applied."
    );
  }

  if (
    task.agent_id
  ) {
    steps.push(
      `Agent context is attached: ${task.agent_id}.`
    );
  }

  if (
    task.project_id
  ) {
    steps.push(
      `Project context is attached: ${task.project_id}.`
    );
  }

  if (
    task.due_date
  ) {
    steps.push(
      "Task due date was included in the execution context."
    );
  }

  if (
    Array.isArray(
      task.tags
    ) &&
    task.tags.length > 0
  ) {
    steps.push(
      "Task tags were included in the execution context."
    );
  }

  if (
    input !== undefined &&
    input !== null
  ) {
    steps.push(
      "Additional execution input was received."
    );
  }

  return {
    context,

    result: {
      summary:
        instruction ??
        `Task "${task.title}" was processed successfully.`,

      steps,

      processedAt:
        new Date().toISOString(),
    },
  };
}

/* ==================================================
   POST EXECUTE TASK
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

    if (
      !auth.userId
    ) {
      return failure(
        auth.error ??
          "Unauthorized.",
        401,
        "UNAUTHORIZED"
      );
    }

    /* ----------------------------------------------
       PARSE BODY
    ---------------------------------------------- */

    let payload:
      ExecutePayload;

    try {
      payload =
        (await request.json()) as
          ExecutePayload;
    } catch {
      return failure(
        "Invalid JSON body.",
        400,
        "INVALID_JSON"
      );
    }

    const taskId =
      normalizeString(
        payload.taskId ??
          payload.task_id,
        MAX_TASK_ID_LENGTH
      );

    if (
      !taskId
    ) {
      return failure(
        "Task id is required.",
        400,
        "TASK_ID_REQUIRED"
      );
    }

    const instruction =
      normalizeString(
        payload.instruction ??
          payload.prompt,
        MAX_INSTRUCTION_LENGTH
      );

    /*
     * normalizeString slice yaptığı için
     * uzunluk kontrolünü orijinal değer üzerinden
     * ayrıca yapıyoruz.
     */

    const rawInstruction =
      payload.instruction ??
      payload.prompt;

    if (
      typeof rawInstruction ===
        "string" &&
      rawInstruction.trim().length >
        MAX_INSTRUCTION_LENGTH
    ) {
      return failure(
        `Instruction cannot exceed ${MAX_INSTRUCTION_LENGTH} characters.`,
        400,
        "INSTRUCTION_TOO_LONG"
      );
    }

    const autoComplete =
      normalizeBoolean(
        payload.autoComplete ??
          payload.auto_complete,
        true
      );

    const input =
      payload.input ??
      null;

    /* ----------------------------------------------
       LOAD TASK
    ---------------------------------------------- */

    const {
      task,
      error: taskError,
    } =
      await getTask(
        taskId,
        auth.userId
      );

    if (
      taskError
    ) {
      console.error(
        "SYRAVEN TASK EXECUTE LOAD ERROR:",
        taskError
      );

      return failure(
        "Failed to load task.",
        500,
        "TASK_LOAD_FAILED"
      );
    }

    if (
      !task
    ) {
      return failure(
        "Task not found.",
        404,
        "TASK_NOT_FOUND"
      );
    }

    /* ----------------------------------------------
       STATUS VALIDATION
    ---------------------------------------------- */

    const currentStatus =
      normalizeTaskStatus(
        task.status
      );

    if (
      currentStatus ===
      "completed"
    ) {
      return failure(
        "This task is already completed.",
        409,
        "TASK_ALREADY_COMPLETED"
      );
    }

    if (
      currentStatus ===
      "cancelled"
    ) {
      return failure(
        "Cancelled tasks cannot be executed.",
        409,
        "TASK_CANCELLED"
      );
    }

    /* ----------------------------------------------
       CREATE EXECUTION
    ---------------------------------------------- */

    const executionId =
      createExecutionId();

    const startedAt =
      new Date().toISOString();

    const existingMetadata =
      normalizeMetadata(
        task.metadata
      );

    const runningExecution:
      ExecutionRecord = {
        id:
          executionId,

        status:
          "running",

        startedAt,

        completedAt:
          null,

        instruction,

        input,

        result:
          null,

        error:
          null,
      };

    const runningMetadata =
      buildExecutionMetadata(
        existingMetadata,
        runningExecution
      );

    /* ----------------------------------------------
       SAVE RUNNING STATE
    ---------------------------------------------- */

    const {
      task: runningTask,
      error: runningError,
    } =
      await updateTaskExecution({
        taskId:
          task.id,

        userId:
          auth.userId,

        status:
          "in_progress",

        metadata:
          runningMetadata,
      });

    if (
      runningError
    ) {
      console.error(
        "SYRAVEN TASK EXECUTE START ERROR:",
        runningError
      );

      return failure(
        "Failed to start task execution.",
        500,
        "TASK_EXECUTION_START_FAILED"
      );
    }

    if (
      !runningTask
    ) {
      return failure(
        "Task could not be updated.",
        500,
        "TASK_EXECUTION_UPDATE_FAILED"
      );
    }

    /* ----------------------------------------------
       EXECUTE
    ---------------------------------------------- */

    try {
      const executionResult =
        await executeTask({
          task:
            runningTask,

          instruction,

          input,
        });

      const completedAt =
        new Date().toISOString();

      const completedExecution:
        ExecutionRecord = {
          id:
            executionId,

          status:
            "completed",

          startedAt,

          completedAt,

          instruction,

          input,

          result:
            JSON.stringify(
              executionResult.result
            ),

          error:
            null,
        };

      /*
       * Running state'i tekrar yüklenen
       * metadata üzerinden tamamlıyoruz.
       */

      const latestMetadata =
        normalizeMetadata(
          runningTask.metadata
        );

      const completedMetadata =
        buildExecutionMetadata(
          latestMetadata,
          completedExecution
        );

      const finalStatus:
        TaskStatus =
          autoComplete
            ? "completed"
            : "in_progress";

      /* --------------------------------------------
         SAVE COMPLETED STATE
      -------------------------------------------- */

      const {
        task: updatedTask,
        error: completionError,
      } =
        await updateTaskExecution({
          taskId:
            task.id,

          userId:
            auth.userId,

          status:
            finalStatus,

          metadata:
            completedMetadata,
        });

      if (
        completionError
      ) {
        console.error(
          "SYRAVEN TASK EXECUTE COMPLETE ERROR:",
          completionError
        );

        return failure(
          "Task executed but the final state could not be saved.",
          500,
          "TASK_EXECUTION_SAVE_FAILED"
        );
      }

      if (
        !updatedTask
      ) {
        return failure(
          "Task execution completed but task could not be returned.",
          500,
          "TASK_EXECUTION_RESULT_MISSING"
        );
      }

      return success(
        {
          execution: {
            id:
              executionId,

            status:
              "completed",

            startedAt,

            completedAt,

            autoCompleted:
              autoComplete,
          },

          result:
            executionResult.result,

          context:
            executionResult.context,

          task:
            updatedTask,
        },
        200
      );
    } catch (
      executionError
    ) {
      console.error(
        "SYRAVEN TASK EXECUTION ERROR:",
        executionError
      );

      const failedAt =
        new Date().toISOString();

      const failedExecution:
        ExecutionRecord = {
          id:
            executionId,

          status:
            "failed",

          startedAt,

          completedAt:
            failedAt,

          instruction,

          input,

          result:
            null,

          error:
            executionError instanceof
              Error
              ? executionError.message
              : "Unknown execution error.",
        };

      /*
       * Failure durumunda mevcut
       * running metadata korunur.
       */

      const failureMetadata =
        buildExecutionMetadata(
          normalizeMetadata(
            runningTask.metadata
          ),
          failedExecution
        );

      const {
        error: failureUpdateError,
      } =
        await updateTaskExecution({
          taskId:
            task.id,

          userId:
            auth.userId,

          status:
            "blocked",

          metadata:
            failureMetadata,
        });

      if (
        failureUpdateError
      ) {
        console.error(
          "SYRAVEN TASK EXECUTION FAILURE SAVE ERROR:",
          failureUpdateError
        );
      }

      return failure(
        "Task execution failed.",
        500,
        "TASK_EXECUTION_FAILED"
      );
    }
  } catch (
    error
  ) {
    console.error(
      "SYRAVEN TASK EXECUTE UNEXPECTED ERROR:",
      error
    );

    return failure(
      "Unexpected error while executing task.",
      500,
      "INTERNAL_ERROR"
    );
  }
}