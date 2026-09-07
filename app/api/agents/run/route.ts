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
 * storage; there is currently no storage backing them, so high-risk
 * steps always stop for approval. See the note at `loadApprovals`.
 */

import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { enforceUsage } from "@/lib/api/usageGuard";
import {
  requireOptionalProjectAccess,
  requireOptionalWorkspaceAccess,
} from "@/lib/api/tenantGuard";
import type { ApprovalRecord } from "@/lib/orchestration/execution";
import { runOrchestration } from "@/lib/orchestration/orchestrator";

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
 * Loads server-held approval records for this execution.
 *
 * There is no persistence for approvals yet: `public.agent_runs` has a
 * NOT NULL foreign key to `public.agents` and a select-only RLS policy,
 * so it cannot hold orchestration state without a migration, and this
 * phase was instructed not to create one.
 *
 * The consequence is stated rather than worked around: with no store,
 * every high-risk step stops at `awaiting_approval`. That is the correct
 * failing direction. The alternative — accepting an approval flag from
 * the request body — would defeat the entire control, so this returns an
 * empty map until a real store exists.
 */
async function loadApprovals(): Promise<ReadonlyMap<string, ApprovalRecord>> {
  return new Map();
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
        message: "Geçersiz JSON request body gönderildi.",
      },
      400,
    );
  }

  if (!isRecord(body)) {
    return json(
      {
        success: false,
        status: "rejected",
        message: "Geçerli bir request body gönderilmedi.",
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
        message: `Hedef metni 1-${MAX_GOAL_CHARS} karakter arasında olmalıdır.`,
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
      approvals: await loadApprovals(),
    });

    if (result.error === "UNKNOWN_AGENT") {
      return json(
        {
          success: false,
          status: "rejected",
          message: "Geçerli bir ajan seçilmedi.",
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
      return json({
        success: false,
        status: "awaiting_approval",
        message: "Bu plan kullanıcı onayı gerektiriyor.",
        data: {
          executionKey: result.executionKey,
          agentId: result.agentId,
          steps: result.steps,
          pendingApprovals: result.pendingApprovals,
        },
      });
    }

    if (result.state === "failed") {
      return json(
        {
          success: false,
          status: "failed",
          message: "Plan yürütülemedi.",
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
      message: "İşlem tamamlandı.",
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
        message: "İşlem sırasında beklenmeyen bir hata oluştu.",
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
      message: "Bu endpoint yalnızca POST isteklerini destekler.",
    },
    405,
  );
}
