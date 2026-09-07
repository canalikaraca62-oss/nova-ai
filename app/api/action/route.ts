import { NextResponse } from "next/server";

import type {
  ActionRequest,
} from "@/services/action-types";

import { withAuth } from "@/lib/api/withAuth";
import { enforceUsage } from "@/lib/api/usageGuard";
import {
  getTool,
  requiresHumanApproval,
} from "@/lib/orchestration/registry";

/* ==================================================
 * TYPES
 * ================================================== */

type ActionPayload = {
  action?: ActionRequest;
};

type ActionResultStatus =
  | "completed"
  | "pending_confirmation"
  | "rejected"
  | "unsupported";

type ActionResult = {
  success: boolean;
  status: ActionResultStatus;
  message: string;
  data?: Record<string, unknown>;
};

/*
 * ActionRequest ana tipini değiştirmeden,
 * endpoint seviyesinde confirmation desteği ekliyoruz.
 *
 * requiresConfirmation, mevcut ActionRequest tipinde
 * henüz tanımlı olmayabilir. Bu nedenle güvenli bir
 * genişletilmiş görünüm kullanıyoruz.
 */
type ConfirmableAction = ActionRequest & {
  requiresConfirmation?: boolean;
};

/* ==================================================
 * RESPONSE HELPER
 * ================================================== */

function json(
  body: ActionResult,
  status = 200
): NextResponse<ActionResult> {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/* ==================================================
 * TYPE GUARDS
 * ================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isActionRequest(
  value: unknown
): value is ActionRequest {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.type === "string";
}

/* ==================================================
 * ACTION HELPERS
 * ================================================== */

/*
  SECURITY (Phase 9): risk classification is SERVER-SIDE.

  This previously read `action.requiresConfirmation` — a CLIENT-SUPPLIED
  field. A caller who simply omitted it had every action classified as
  safe, so the confirmation boundary was effectively self-declared.

  Risk now comes from the server-side tool registry
  (lib/orchestration/registry.ts). An action type absent from the
  registry is UNKNOWN and is refused rather than assumed safe — failing
  closed is the whole point of the boundary.

  The client's own `requiresConfirmation` is still honoured as a signal
  that MORE caution is wanted, but it can only raise the requirement,
  never lower it.
*/
function requiresConfirmation(
  action: ActionRequest
): boolean {
  const tool = getTool(action.type);

  if (tool !== null) {
    if (requiresHumanApproval(tool.risk)) {
      return true;
    }
  }

  /* A client may ask for confirmation it would not otherwise get. */
  const confirmableAction =
    action as ConfirmableAction;

  return (
    confirmableAction.requiresConfirmation === true
  );
}

/**
 * An action is safe only when the SERVER can classify it as low risk.
 *
 * Unknown action types are NOT safe. Treating an unrecognised type as
 * harmless is how an unregistered privileged operation would slip
 * through.
 */
function isSafeAction(
  action: ActionRequest
): boolean {
  if (action.type === "none") {
    return true;
  }

  const tool = getTool(action.type);

  if (tool === null) {
    /* Unknown to the registry -> not classifiable -> not safe. */
    return false;
  }

  if (requiresHumanApproval(tool.risk)) {
    return false;
  }

  return !requiresConfirmation(action);
}

/* ==================================================
 * POST
 * ================================================== */

export const POST = withAuth(async (
  request,
  session
) => {
  /*
    USAGE ENFORCEMENT (Phase 5, extended in Phase 9)

    This route was outside Phase 5's scope because it calls no paid
    provider. It is now an ACTION EXECUTION boundary, so it is metered
    and rate limited like any other: an unmetered action endpoint is a
    way to drive server-side work without it counting against anything.

    The existing Phase 5 system is reused — no second quota system.
  */
  const guard = await enforceUsage(
    session,
    "ai:agent",
    "agentRun"
  );

  if (guard.denied) {
    return guard.response;
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          success: false,
          status: "rejected",
          message:
            "Geçersiz JSON request body gönderildi.",
        },
        400
      );
    }

    if (!isRecord(body)) {
      return json(
        {
          success: false,
          status: "rejected",
          message:
            "Geçerli bir request body gönderilmedi.",
        },
        400
      );
    }

    const action = body.action;

    if (!isActionRequest(action)) {
      return json(
        {
          success: false,
          status: "rejected",
          message:
            "Geçerli bir action gönderilmedi.",
        },
        400
      );
    }

    /* ==============================================
     * NO ACTION
     * ============================================== */

    if (action.type === "none") {
      return json({
        success: true,
        status: "completed",
        message:
          "Gerçekleştirilecek bir işlem yok.",
        data: {
          actionType: action.type,
        },
      });
    }

    /* ==============================================
     * CONFIRMATION REQUIRED
     * ============================================== */

    if (requiresConfirmation(action)) {
      return json({
        success: false,
        status: "pending_confirmation",
        message:
          "Bu işlem kullanıcı onayı gerektiriyor.",
        data: {
          actionType: action.type,
        },
      });
    }

    /* ==============================================
     * SAFE INTERNAL ACTIONS
     * ============================================== */

    if (isSafeAction(action)) {
      return json({
        success: true,
        status: "completed",
        message:
          "İşlem başarıyla tamamlandı.",
        data: {
          actionType: action.type,
        },
      });
    }

    /* ==============================================
     * FALLBACK
     * ============================================== */

    return json(
      {
        success: false,
        status: "unsupported",
        message:
          "Bu işlem şu anda desteklenmiyor.",
        data: {
          actionType: action.type,
        },
      },
      400
    );
  } catch (error) {
    console.error(
      "[SYRAVEN_ACTION_API_ERROR]",
      error
    );

    return json(
      {
        success: false,
        status: "rejected",
        message:
          "Action işlenirken beklenmeyen bir hata oluştu.",
      },
      500
    );
  }
});

/* ==================================================
 * METHOD NOT ALLOWED
 * ================================================== */

export async function GET() {
  return json(
    {
      success: false,
      status: "rejected",
      message:
        "Bu endpoint yalnızca POST isteklerini destekler.",
    },
    405
  );
}