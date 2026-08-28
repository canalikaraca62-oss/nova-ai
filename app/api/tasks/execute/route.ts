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

type ExecutePayload = {
  taskId?: unknown;
  task_id?: unknown;
  instruction?: unknown;
  prompt?: unknown;
  input?: unknown;
  autoComplete?: unknown;
  auto_complete?: unknown;
};

type TaskRecord = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus | string;
  priority: string | null;
  project_id: string | null;
  agent_id: string | null;
  due_date: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExecutionRecord = {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  instruction: string | null;
  input: unknown;
  result: string | null;
  error: string | null;
};

/* ==================================================
   CONSTANTS
================================================== */

const MAX_INSTRUCTION_LENGTH = 12000;
const MAX_EXECUTION_HISTORY = 20;

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
      ? authorization
          .slice(7)
          .trim()
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
}

/* ==================================================
   NORMALIZERS
================================================== */

function normalizeString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
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

function createExecutionId() {
  return [
    "task_exec",
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join("_");
}

/* ==================================================
   EXECUTION HISTORY
================================================== */

function getExecutionHistory(
  metadata: Record<string, unknown>
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
      (
        item
      ): item is ExecutionRecord =>
        Boolean(
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof (
            item as ExecutionRecord
          ).id === "string"
        )
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
) {
  const previousExecutions =
    getExecutionHistory(
      existingMetadata
    );

  const executions = [
    ...previousExecutions,
    execution,
  ].slice(
    -MAX_EXECUTION_HISTORY
  );

  return {
    ...existingMetadata,
    executions,
    lastExecution: execution,
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
      .select("*")
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
  metadata: Record<string, unknown>;
}) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("tasks")
      .update({
        status,
        metadata,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        taskId
      )
      .eq(
        "user_id",
        userId
      )
      .select("*")
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
  instruction: string | null;
  input: unknown;
}) {
  return {
    taskId: task.id,
    title: task.title,
    description:
      task.description,
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

   Bu katman mevcut veritabanı yapısına
   bağımlı kalmadan deterministic bir
   execution result üretir.

   Daha sonra agent/AI katmanı genişletildiğinde
   bu fonksiyon merkezi execution adapter olarak
   kullanılabilir.
================================================== */

async function executeTask({
  task,
  instruction,
  input,
}: {
  task: TaskRecord;
  instruction: string | null;
  input: unknown;
}) {
  const context =
    buildExecutionContext({
      task,
      instruction,
      input,
    });

  const steps: string[] = [];

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
        await request.json();
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
        payload.task_id
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
        payload.prompt
      );

    if (
      instruction &&
      instruction.length >
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

    if (
      task.status ===
      "completed"
    ) {
      return failure(
        "This task is already completed.",
        409,
        "TASK_ALREADY_COMPLETED"
      );
    }

    if (
      task.status ===
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
        id: executionId,
        status: "running",
        startedAt,
        completedAt: null,
        instruction,
        input,
        result: null,
        error: null,
      };

    const runningMetadata =
      buildExecutionMetadata(
        existingMetadata,
        runningExecution
      );

    const {
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

    /* ----------------------------------------------
       EXECUTE
    ---------------------------------------------- */

    try {
      const executionResult =
        await executeTask({
          task,
          instruction,
          input,
        });

      const completedAt =
        new Date().toISOString();

      const completedExecution:
        ExecutionRecord = {
          id: executionId,
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
          error: null,
        };

      const completedMetadata =
        buildExecutionMetadata(
          existingMetadata,
          completedExecution
        );

      const finalStatus:
        TaskStatus =
        autoComplete
          ? "completed"
          : "in_progress";

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

      return success({
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
      });
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
          id: executionId,
          status:
            "failed",
          startedAt,
          completedAt:
            failedAt,
          instruction,
          input,
          result: null,
          error:
            executionError instanceof Error
              ? executionError.message
              : "Unknown execution error.",
        };

      const failedMetadata =
        buildExecutionMetadata(
          existingMetadata,
          failedExecution
        );

      await updateTaskExecution({
        taskId:
          task.id,
        userId:
          auth.userId,
        status:
          "blocked",
        metadata:
          failedMetadata,
      });

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