/**
 * SYRAVEN — Agent execution endpoint
 * app/api/agents/run/route.ts
 *
 * Phase 9 completion (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * The end-to-end path: a goal comes in, the model proposes a plan, the
 * server authorizes every step, and only authorized steps run.
 *
 * WHAT THE CLIENT MAY DECIDE
 *
 *   - which registered agent to use (validated against the registry)
 *   - the goal text (treated as untrusted content)
 *   - which workspace/project to scope to (PROVEN by tenant guards)
 *
 * WHAT THE CLIENT MAY NOT DECIDE
 *
 *   - risk level, capability, or approval  (server registry + records)
 *   - identity, tenancy, or plan           (session + database)
 *   - model, token ceiling, or limits      (Phase 7 policy)
 *
 * A body field named `approved`, `risk`, `userId`, or `plan` has no
 * effect anywhere in this path. Approvals are read from server-side
 * storage — `public.agent_approvals`, through
 * lib/orchestration/approvalStore.ts, on the caller's own RLS client.
 *
 * An earlier version of this note said there was no storage behind
 * them and that high-risk steps therefore always stopped. That was
 * wrong: it named `public.agent_runs`, which is a different table with
 * a select-only policy. The approvals table was migrated for exactly
 * this purpose the whole time, so the control was failing closed for a
 * reason that did not hold, with no way for anyone to grant a step.
 */

import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { enforceUsage } from "@/lib/api/usageGuard";
import {
  requireOptionalProjectAccess,
  requireOptionalWorkspaceAccess,
} from "@/lib/api/tenantGuard";
import { deriveExecutionKey } from "@/lib/orchestration/execution";
import { runOrchestration } from "@/lib/orchestration/orchestrator";
import {
  consumeApproval,
  loadApprovals,
  requestApprovals,
} from "@/lib/orchestration/approvalStore";
import { getTool, type RiskLevel } from "@/lib/orchestration/registry";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

const MAX_GOAL_CHARS = 2_000;

interface RunResponseBody {
  success: boolean;
  status: string;
  message: string;
  data?: Record<string, unknown>;
}

function json(body: RunResponseBody, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function readOptionalId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Describes what a step will do, for the person being asked to allow it.
 *
 * Taken from the tool registry, which is the server's own description —
 * never from the model's plan or the request. A caller cannot influence
 * the sentence shown above the Approve button.
 */
function effectForTool(toolId: string): string {
  return (
    getTool(toolId)?.description ??
    `Run ${toolId}. This step changes something outside SYRAVEN.`
  );
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export const POST = withAuth(async (request, session) => {
  /* ------------------------------------------------------------------ */
  /* 1. Usage — Phase 5, before any provider call                        */
  /* ------------------------------------------------------------------ */

  const guard = await enforceUsage(session, "ai:agent", "agentRun");

  if (guard.denied) {
    return guard.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        success: false,
        status: "rejected",
        message: "The request body is not valid JSON.",
      },
      400,
    );
  }

  if (!isRecord(body)) {
    return json(
      {
        success: false,
        status: "rejected",
        message: "A valid request body is required.",
      },
      400,
    );
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";

  if (goal.length === 0 || goal.length > MAX_GOAL_CHARS) {
    return json(
      {
        success: false,
        status: "rejected",
        message: `The goal must be between 1 and ${MAX_GOAL_CHARS} characters.`,
      },
      400,
    );
  }

  /* ------------------------------------------------------------------ */
  /* 2. Tenancy — PROVEN here, never taken from the body                 */
  /* ------------------------------------------------------------------ */

  const requestedWorkspaceId = readOptionalId(body.workspaceId);
  const requestedProjectId = readOptionalId(body.projectId);

  const workspaceAccess = await requireOptionalWorkspaceAccess(
    session,
    requestedWorkspaceId,
  );

  if (workspaceAccess?.denied) {
    return workspaceAccess.response;
  }

  const projectAccess = await requireOptionalProjectAccess(
    session,
    requestedProjectId,
  );

  if (projectAccess?.denied) {
    return projectAccess.response;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Orchestrate                                                      */
  /* ------------------------------------------------------------------ */

  /*
    Derived here with the same inputs the orchestrator uses, so the key
    that loads approvals is the key the plan is checked against. It
    hashes the RAW agentId rather than a resolved one — matching the
    orchestrator exactly — so no validation is duplicated in a second
    place where it could drift.
  */
  const executionKey = deriveExecutionKey({
    userId: session.userId,
    agentId: typeof body.agentId === "string" ? body.agentId : "",
    goal,
    workspaceId: requestedWorkspaceId,
    projectId: requestedProjectId,
  });

  try {
    const result = await runOrchestration({
      session,
      entitlement: guard.entitlement,
      /*
       * Passed through unvalidated ON PURPOSE: the orchestrator resolves
       * it against the registry and fails closed on anything unknown.
       * Pre-validating here would duplicate that check in a second place
       * where it could drift.
       */
      agentId: body.agentId,
      goal,
      workspaceId: requestedWorkspaceId,
      projectId: requestedProjectId,
      /*
        Loaded from `public.agent_approvals` on the caller's own RLS
        client, keyed by the SAME execution key the orchestrator
        derives. Never from the request body: a field named `approved`
        has no effect anywhere on this path.
      */
      approvals: await loadApprovals(session, executionKey),
    });

    if (result.error === "UNKNOWN_AGENT") {
      return json(
        {
          success: false,
          status: "rejected",
          message: "A valid agent must be selected.",
        },
        400,
      );
    }

    /*
     * Recorded only when a provider call actually happened, and with the
     * token counts it reported — a bare record() would meter the run but
     * not the spend, so a large planning call would cost the same as a
     * trivial one.
     */
    if (result.usage !== null) {
      await guard.record({
        model: result.modelId,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      });
    }

    if (result.state === "awaiting_approval") {
      /*
        Record what is waiting, so the user has something to decide.

        Until this existed the run stopped correctly and then vanished:
        no row, no endpoint, no UI, and every high-risk plan was a dead
        end. The rows are written as 'pending' with no decider, which
        is the only shape the insert policy accepts.
      */
      const riskByTool = new Map<string, RiskLevel>();
      const effectByTool = new Map<string, string>();

      for (const step of result.steps) {
        if (step.status !== "awaiting_approval") continue;

        riskByTool.set(step.tool, step.risk as RiskLevel);
        effectByTool.set(step.tool, effectForTool(step.tool));
      }

      await requestApprovals(session, {
        executionKey: result.executionKey,
        agentId: result.agentId ?? "",
        toolIds: result.pendingApprovals,
        riskByTool,
        effectByTool,
        workspaceId: requestedWorkspaceId,
        projectId: requestedProjectId,
      });

      return json({
        success: false,
        status: "awaiting_approval",
        message: "This plan needs your approval before it can run.",
        data: {
          executionKey: result.executionKey,
          agentId: result.agentId,
          steps: result.steps,
          pendingApprovals: result.pendingApprovals,
        },
      });
    }

    /*
      Spend the grants that were actually used.

      An approval left at 'approved' after its step has run is still
      live — verifyApproval accepts any approved, unexpired record, and
      the same goal derives the same execution key. A refresh would find
      the grant waiting and run the step again without asking.
    */
    for (const toolId of result.consumedApprovals) {
      await consumeApproval(session, {
        executionKey: result.executionKey,
        toolId,
      });
    }

    if (result.state === "failed") {
      return json(
        {
          success: false,
          status: "failed",
          message: "The plan could not be carried out.",
          data: {
            executionKey: result.executionKey,
            agentId: result.agentId,
            /* A reason code, never provider or database internals. */
            reason: result.error,
            steps: result.steps,
          },
        },
        422,
      );
    }

    return json({
      success: true,
      status: result.state,
      message: "Finished.",
      data: {
        executionKey: result.executionKey,
        agentId: result.agentId,
        steps: result.steps,
      },
    });
  } catch (error) {
    console.error("[SYRAVEN_AGENT_RUN_ERROR]", {
      userId: session.userId,
      name: error instanceof Error ? error.name : "unknown",
    });

    return json(
      {
        success: false,
        status: "rejected",
        message: "Something went wrong while running this.",
      },
      500,
    );
  }
});

/* -------------------------------------------------------------------------- */
/*                             METHOD NOT ALLOWED                             */
/* -------------------------------------------------------------------------- */

export async function GET() {
  return json(
    {
      success: false,
      status: "rejected",
      message: "This endpoint accepts POST requests only.",
    },
    405,
  );
}
