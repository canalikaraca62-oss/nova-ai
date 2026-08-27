export type ActionType =
  | "none"
  | "calendar_create"
  | "calendar_update"
  | "calendar_delete"
  | "email_send"
  | "email_reply"
  | "reminder_create"
  | "notification_send"
  | "web_task";

export type ActionRequest = {
  type: ActionType;
  requiresConfirmation: boolean;
  confidence: number;
  data: Record<string, unknown>;
};