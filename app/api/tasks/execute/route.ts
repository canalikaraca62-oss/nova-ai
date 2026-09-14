import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";

/*
  SYRAVEN — /api/tasks/execute is not an executor

  WHAT THIS ROUTE USED TO DO

  It loaded the caller's task, stored an execution record as "running",
  and then "executed" it: executeTask() assembled sentences from the
  task's own fields -- `Task "X" was processed successfully.`, "Custom
  execution instruction was applied." -- with no model call, no tool and
  no side effect. It saved those sentences as the result, marked the
  execution "completed", and by default (autoComplete defaulted to true)
  set the task itself to completed.

  Nothing was done, and the task said it had been.

  WHY IT IS NOT REBUILT HERE

  Work that acts already has one path: /api/agents/run, where a plan is
  validated against the registry, high-risk steps wait for a claimed
  approval, and tools run on the caller's own client. A second executor
  for tasks would be a parallel action engine with its own state and
  its own idea of "done" -- exactly what ARCHITECTURE_NORTH_STAR.md
  rules out. Nothing in the product calls this route.

  It now answers 410 and reads or changes nothing.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async () =>
  NextResponse.json(
    {
      success: false,
      error: {
        code: "NOT_AN_EXECUTOR",
        message:
          "Tasks are not executed by this endpoint. Run work through an agent at /api/agents/run.",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "private, no-store" },
    },
  ),
);
