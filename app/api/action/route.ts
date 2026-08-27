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

type ActionResult = {
  success: boolean;
  status: "completed" | "pending_confirmation" | "rejected" | "unsupported";
  message: string;
  data?: Record<string, unknown>;
};

/* ==================================================
 * HELPERS
 * ================================================== */

function json(
  body: ActionResult,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/* ==================================================
 * SAFE ACTION CHECK
 * ================================================== */

function isSafeAction(
  action: ActionRequest
) {
  return (
    action.type === "none" ||
    !action.requiresConfirmation
  );
}

/* ==================================================
 * POST
 * ================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as ActionPayload;

    const action =
      body.action;

    if (!action) {
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

    if (
      action.type === "none"
    ) {
      return json(
        {
          success: true,
          status: "completed",
          message:
            "Gerçekleştirilecek bir işlem yok.",
        }
      );
    }

    /* ==============================================
     * CONFIRMATION REQUIRED
     * ============================================== */

    if (
      action.requiresConfirmation
    ) {
      return json(
        {
          success: false,
          status:
            "pending_confirmation",
          message:
            "Bu işlem kullanıcı onayı gerektiriyor.",
          data: {
            actionType:
              action.type,
          },
        }
      );
    }

    /* ==============================================
     * SAFE INTERNAL ACTIONS
     * ============================================== */

    if (
      isSafeAction(
        action
      )
    ) {
      return json(
        {
          success: true,
          status:
            "completed",
          message:
            "İşlem başarıyla tamamlandı.",
          data: {
            actionType:
              action.type,
          },
        }
      );
    }

    /* ==============================================
     * FALLBACK
     * ============================================== */

    return json(
      {
        success: false,
        status:
          "unsupported",
        message:
          "Bu işlem şu anda desteklenmiyor.",
        data: {
          actionType:
            action.type,
        },
      },
      400
    );
  } catch (
    error
  ) {
    console.error(
      "SYRAVEN ACTION API HATASI:",
      error
    );

    return json(
      {
        success: false,
        status:
          "rejected",
        message:
          "Action işlenirken bir hata oluştu.",
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
      status:
        "rejected",
      message:
        "Bu endpoint yalnızca POST isteklerini destekler.",
    },
    405
  );
}