import type {
  ActionRequest,
} from "./action-types";

export type ActionExecutionResult = {
  success: boolean;
  message: string;
  data: Record<string, unknown>;
};

export async function executeAction(
  action: ActionRequest
): Promise<ActionExecutionResult> {
  switch (action.type) {
    case "calendar_create":
      return {
        success: true,
        message:
          "Takvim işlemi başarıyla hazırlandı.",
        data: action.data,
      };

    case "calendar_update":
      return {
        success: true,
        message:
          "Takvim güncelleme işlemi hazırlandı.",
        data: action.data,
      };

    case "calendar_delete":
      return {
        success: true,
        message:
          "Takvim silme işlemi hazırlandı.",
        data: action.data,
      };

    case "email_send":
      return {
        success: true,
        message:
          "E-posta gönderme işlemi hazırlandı.",
        data: action.data,
      };

    case "email_reply":
      return {
        success: true,
        message:
          "E-posta yanıtı hazırlandı.",
        data: action.data,
      };

    case "reminder_create":
      return {
        success: true,
        message:
          "Hatırlatıcı oluşturma işlemi hazırlandı.",
        data: action.data,
      };

    case "notification_send":
      return {
        success: true,
        message:
          "Bildirim gönderme işlemi hazırlandı.",
        data: action.data,
      };

    case "web_task":
      return {
        success: true,
        message:
          "Web görevi başarıyla hazırlandı.",
        data: action.data,
      };

    case "none":
    default:
      return {
        success: false,
        message:
          "Gerçekleştirilecek bir işlem bulunamadı.",
        data: {},
      };
  }
}