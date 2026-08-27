import { NextResponse } from "next/server";

import {
  parseAction,
} from "@/services/action-parser";

import {
  executeAction,
} from "@/services/action-executor";

import type {
  ActionRequest,
} from "@/services/action-types";

/* ==================================================
 * RUNTIME
 * ================================================== */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/* ==================================================
 * CONFIG
 * ================================================== */

const MAX_MESSAGE_LENGTH = 12000;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

/* ==================================================
 * TYPES
 * ================================================== */

type ActionApiRequestBody = {
  message?: unknown;
  action?: unknown;
  execute?: unknown;
};

type ApiErrorResponse = {
  success: false;
  error: string;
  code: string;
  requestId: string;
};

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  requestId: string;
};

/* ==================================================
 * REQUEST ID
 * ================================================== */

function createRequestId(): string {
  return crypto.randomUUID();
}

/* ==================================================
 * JSON RESPONSE HELPERS
 * ================================================== */

function successResponse<T>(
  data: T,
  requestId: string,
  status = 200
) {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    requestId,
  };

  return NextResponse.json(
    response,
    {
      status,
      headers: JSON_HEADERS,
    }
  );
}

function errorResponse(
  error: string,
  code: string,
  requestId: string,
  status = 400
) {
  const response: ApiErrorResponse = {
    success: false,
    error,
    code,
    requestId,
  };

  return NextResponse.json(
    response,
    {
      status,
      headers: JSON_HEADERS,
    }
  );
}

/* ==================================================
 * ERROR NORMALIZATION
 * ================================================== */

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error === "string" &&
    error.trim()
  ) {
    return error;
  }

  return "Bilinmeyen bir hata oluştu.";
}

/* ==================================================
 * BODY VALIDATION
 * ================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

/* ==================================================
 * ACTION VALIDATION
 * ================================================== */

function isActionRequest(
  value: unknown
): value is ActionRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    value.type.trim().length > 0 &&
    typeof value.requiresConfirmation ===
      "boolean" &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    isRecord(value.data)
  );
}

/* ==================================================
 * POST
 * ================================================== */

export async function POST(
  request: Request
) {
  const requestId =
    createRequestId();

  try {
    /* ==============================================
     * PARSE JSON
     * ============================================== */

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return errorResponse(
        "Geçersiz JSON isteği.",
        "INVALID_JSON",
        requestId,
        400
      );
    }

    if (!isRecord(body)) {
      return errorResponse(
        "Geçersiz istek gövdesi.",
        "INVALID_REQUEST_BODY",
        requestId,
        400
      );
    }

    const requestBody =
      body as ActionApiRequestBody;

    /* ==============================================
     * EXECUTE ACTION
     * ============================================== */

    if (
      requestBody.execute === true
    ) {
      if (
        !isActionRequest(
          requestBody.action
        )
      ) {
        return errorResponse(
          "Geçerli bir işlem isteği bulunamadı.",
          "INVALID_ACTION",
          requestId,
          400
        );
      }

      const action =
        requestBody.action;

      /*
       * ============================================
       * SECURITY GATE
       * ============================================
       *
       * Confirmation gerektiren işlemler frontend
       * tarafından onaylandıktan sonra execute=true
       * ile gelir.
       *
       * İleride burada:
       *
       * - Supabase auth
       * - userId
       * - workspaceId
       * - organizationId
       * - plan kontrolü
       * - permission kontrolü
       * - enterprise policy
       * - audit logging
       * - rate limiting
       *
       * eklenecek.
       *
       * Route sözleşmesi buna hazırdır.
       */

      const result =
        await executeAction(
          action
        );

      return successResponse(
        {
          executed: result.success,
          message:
            result.message,
          result:
            result.data ?? null,
          action: {
            type:
              action.type,
            confidence:
              action.confidence,
            requiresConfirmation:
              action.requiresConfirmation,
          },
        },
        requestId,
        result.success
          ? 200
          : 400
      );
    }

    /* ==============================================
     * ANALYZE ACTION
     * ============================================== */

    const userMessage =
      typeof requestBody.message ===
      "string"
        ? requestBody.message.trim()
        : "";

    if (!userMessage) {
      return errorResponse(
        "Geçerli bir mesaj gönderilmedi.",
        "EMPTY_MESSAGE",
        requestId,
        400
      );
    }

    if (
      userMessage.length >
      MAX_MESSAGE_LENGTH
    ) {
      return errorResponse(
        `Mesaj çok uzun. En fazla ${MAX_MESSAGE_LENGTH} karakter gönderilebilir.`,
        "MESSAGE_TOO_LONG",
        requestId,
        413
      );
    }

    /*
     * ============================================
     * ACTION PARSE
     * ============================================
     *
     * parseAction gelecekte:
     *
     * Chat
     * Agent
     * Workspace
     * Automation
     * Connected Apps
     * Coding Studio
     * Knowledge
     *
     * tarafından ortak kullanılabilir.
     */

    const action =
      await parseAction(
        userMessage
      );

    /*
     * Parser hiçbir işlem bulamazsa bile
     * API başarılı şekilde response dönebilir.
     *
     * Bunun için ActionRequest.type = "none"
     * kullanılabilir.
     */

    if (
      !isActionRequest(
        action
      )
    ) {
      return errorResponse(
        "Action parser geçerli bir işlem çıktısı üretmedi.",
        "INVALID_ACTION_RESPONSE",
        requestId,
        500
      );
    }

    return successResponse(
      {
        action,
        executable:
          action.type !== "none",
        requiresConfirmation:
          action.requiresConfirmation,
      },
      requestId,
      200
    );
  } catch (error) {
    /*
     * ==============================================
     * SERVER ERROR
     * ==============================================
     */

    console.error(
      "SYRAVEN ACTION API ERROR",
      {
        requestId,
        error,
      }
    );

    return errorResponse(
      getErrorMessage(error),
      "ACTION_API_ERROR",
      requestId,
      500
    );
  }
}

/* ==================================================
 * METHOD NOT ALLOWED
 * ================================================== */

export async function GET() {
  const requestId =
    createRequestId();

  return errorResponse(
    "Bu endpoint yalnızca POST isteklerini destekler.",
    "METHOD_NOT_ALLOWED",
    requestId,
    405
  );
}