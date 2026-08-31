import { NextRequest, NextResponse } from "next/server";

import type {
  ActionRequest,
} from "@/services/action-types";

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

function requiresConfirmation(
  action: ActionRequest
): boolean {
  const confirmableAction =
    action as ConfirmableAction;

  return (
    confirmableAction.requiresConfirmation === true
  );
}

function isSafeAction(
  action: ActionRequest
): boolean {
  return (
    action.type === "none" ||
    !requiresConfirmation(action)
  );
}

/* ==================================================
 * POST
 * ================================================== */

export async function POST(
  request: NextRequest
) {
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
}

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