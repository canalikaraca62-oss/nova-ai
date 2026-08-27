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

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 12000;

type ActionRequestBody = {
  message?: unknown;
  action?: unknown;
  execute?: unknown;
};

function isActionRequest(
  value: unknown
): value is ActionRequest {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const action =
    value as Record<string, unknown>;

  return (
    typeof action.type === "string" &&
    typeof action.requiresConfirmation ===
      "boolean" &&
    typeof action.confidence === "number" &&
    typeof action.data === "object" &&
    action.data !== null &&
    !Array.isArray(action.data)
  );
}

export async function POST(
  request: Request
) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Geçersiz JSON isteği.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Geçersiz istek gövdesi.",
        },
        {
          status: 400,
        }
      );
    }

    const requestBody =
      body as ActionRequestBody;

    /*
     * ===============================================
     * ACTION EXECUTE
     * ===============================================
     *
     * Frontend önce action'ı analiz eder.
     * Kullanıcı onayladıktan sonra:
     *
     * {
     *   action: {...},
     *   execute: true
     * }
     *
     * gönderir.
     */

    if (
      requestBody.execute === true
    ) {
      if (
        !isActionRequest(
          requestBody.action
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Geçerli bir action bulunamadı.",
          },
          {
            status: 400,
          }
        );
      }

      const result =
        await executeAction(
          requestBody.action
        );

      return NextResponse.json(
        {
          success:
            result.success,

          message:
            result.message,

          data:
            result.data,
        },
        {
          status:
            result.success
              ? 200
              : 400,
        }
      );
    }

    /*
     * ===============================================
     * ACTION ANALYZE
     * ===============================================
     */

    const userMessage =
      typeof requestBody.message ===
      "string"
        ? requestBody.message.trim()
        : "";

    if (!userMessage) {
      return NextResponse.json(
        {
          error:
            "Geçerli bir mesaj gönderilmedi.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      userMessage.length >
      MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            `Mesaj çok uzun. En fazla ${MAX_MESSAGE_LENGTH} karakter gönderilebilir.`,
        },
        {
          status: 413,
        }
      );
    }

    const action =
      await parseAction(
        userMessage
      );

    return NextResponse.json(
      {
        action,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "ACTION API HATASI:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Action işlemi sırasında bir hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}