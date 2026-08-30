/**
 * SYRAVEN Notification Types
 *
 * Shared notification domain types for:
 * - In-app notifications
 * - Email notifications
 * - Push notifications
 * - System notifications
 * - Project notifications
 * - Task notifications
 * - AI notifications
 *
 * Designed for strict TypeScript and large-scale systems.
 */

/* -------------------------------------------------------------------------- */
/*                              NOTIFICATION TYPE                             */
/* -------------------------------------------------------------------------- */

export type NotificationType =
  | "system"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "message"
  | "mention"
  | "task"
  | "project"
  | "document"
  | "knowledge"
  | "agent"
  | "billing"
  | "security"
  | "integration"
  | "update"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              NOTIFICATION LEVEL                            */
/* -------------------------------------------------------------------------- */

export type NotificationLevel =
  | "low"
  | "normal"
  | "high"
  | "critical";

/* -------------------------------------------------------------------------- */
/*                              DELIVERY CHANNEL                              */
/* -------------------------------------------------------------------------- */

export type NotificationChannel =
  | "in_app"
  | "email"
  | "push"
  | "webhook";

/* -------------------------------------------------------------------------- */
/*                              DELIVERY STATUS                               */
/* -------------------------------------------------------------------------- */

export type NotificationDeliveryStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled";

/* -------------------------------------------------------------------------- */
/*                              NOTIFICATION STATUS                           */
/* -------------------------------------------------------------------------- */

export type NotificationStatus =
  | "unread"
  | "read"
  | "archived"
  | "deleted";

/* -------------------------------------------------------------------------- */
/*                                   ACTION                                   */
/* -------------------------------------------------------------------------- */

export interface NotificationAction {
  id: string;

  label: string;

  url?: string;

  action?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                  ACTOR                                     */
/* -------------------------------------------------------------------------- */

export interface NotificationActor {
  id: string;

  type:
    | "user"
    | "agent"
    | "system"
    | "service"
    | "integration";

  name?: string;

  avatarUrl?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                                RESOURCE                                    */
/* -------------------------------------------------------------------------- */

export interface NotificationResource {
  id: string;

  type: string;

  name?: string;

  url?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             DELIVERY ATTEMPT                               */
/* -------------------------------------------------------------------------- */

export interface NotificationDeliveryAttempt {
  id: string;

  channel: NotificationChannel;

  status: NotificationDeliveryStatus;

  attemptedAt: Date;

  deliveredAt?: Date;

  failedAt?: Date;

  error?: string;

  provider?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               NOTIFICATION                                 */
/* -------------------------------------------------------------------------- */

export interface Notification {
  id: string;

  userId: string;

  type: NotificationType;

  level: NotificationLevel;

  status: NotificationStatus;

  title: string;

  message: string;

  channels: NotificationChannel[];

  actor?: NotificationActor;

  resource?: NotificationResource;

  actions?: NotificationAction[];

  deliveries?: NotificationDeliveryAttempt[];

  readAt?: Date;

  archivedAt?: Date;

  expiresAt?: Date;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                          CREATE NOTIFICATION INPUT                         */
/* -------------------------------------------------------------------------- */

export interface CreateNotificationInput {
  userId: string;

  type?: NotificationType;

  level?: NotificationLevel;

  title: string;

  message: string;

  channels?: NotificationChannel[];

  actor?: NotificationActor;

  resource?: NotificationResource;

  actions?: NotificationAction[];

  expiresAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                          UPDATE NOTIFICATION INPUT                         */
/* -------------------------------------------------------------------------- */

export interface UpdateNotificationInput {
  type?: NotificationType;

  level?: NotificationLevel;

  status?: NotificationStatus;

  title?: string;

  message?: string;

  channels?: NotificationChannel[];

  actor?: NotificationActor;

  resource?: NotificationResource;

  actions?: NotificationAction[];

  expiresAt?: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                           NOTIFICATION FILTERS                             */
/* -------------------------------------------------------------------------- */

export interface NotificationListOptions {
  userId?: string;

  type?: NotificationType | NotificationType[];

  level?: NotificationLevel | NotificationLevel[];

  status?: NotificationStatus | NotificationStatus[];

  channel?: NotificationChannel;

  unreadOnly?: boolean;

  limit?: number;

  offset?: number;

  createdAfter?: Date;

  createdBefore?: Date;
}

/* -------------------------------------------------------------------------- */
/*                             NOTIFICATION RESULT                            */
/* -------------------------------------------------------------------------- */

export interface NotificationListResult {
  notifications: Notification[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                            DELIVERY REQUEST                                */
/* -------------------------------------------------------------------------- */

export interface SendNotificationInput {
  notificationId?: string;

  userId: string;

  channel: NotificationChannel;

  title: string;

  message: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             DELIVERY RESULT                                */
/* -------------------------------------------------------------------------- */

export interface NotificationDeliveryResult {
  notificationId?: string;

  channel: NotificationChannel;

  status: NotificationDeliveryStatus;

  provider?: string;

  deliveredAt?: Date;

  error?: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              NOTIFICATION EVENT                            */
/* -------------------------------------------------------------------------- */

export type NotificationEventType =
  | "notification.created"
  | "notification.updated"
  | "notification.read"
  | "notification.archived"
  | "notification.deleted"
  | "notification.sent"
  | "notification.delivered"
  | "notification.failed";

/* -------------------------------------------------------------------------- */
/*                            NOTIFICATION EVENT                              */
/* -------------------------------------------------------------------------- */

export interface NotificationEvent {
  id: string;

  type: NotificationEventType;

  notificationId: string;

  userId: string;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              NOTIFICATION STATS                            */
/* -------------------------------------------------------------------------- */

export interface NotificationStats {
  total: number;

  unread: number;

  read: number;

  archived: number;

  deleted: number;

  info: number;

  success: number;

  warning: number;

  error: number;

  critical: number;
}

/* -------------------------------------------------------------------------- */
/*                         NOTIFICATION PREFERENCES                           */
/* -------------------------------------------------------------------------- */

export interface NotificationChannelPreference {
  channel: NotificationChannel;

  enabled: boolean;
}

export interface NotificationTypePreference {
  type: NotificationType;

  enabled: boolean;

  channels?: NotificationChannel[];
}

export interface NotificationPreferences {
  userId: string;

  enabled: boolean;

  channels: NotificationChannelPreference[];

  types: NotificationTypePreference[];

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                    UPDATE NOTIFICATION PREFERENCES INPUT                   */
/* -------------------------------------------------------------------------- */

export interface UpdateNotificationPreferencesInput {
  enabled?: boolean;

  channels?: NotificationChannelPreference[];

  types?: NotificationTypePreference[];

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            NOTIFICATION PROVIDER                           */
/* -------------------------------------------------------------------------- */

export interface NotificationProvider {
  name: string;

  channel: NotificationChannel;

  send(
    input: SendNotificationInput
  ): Promise<NotificationDeliveryResult>;
}

/* -------------------------------------------------------------------------- */
/*                          NOTIFICATION SERVICE OPTIONS                      */
/* -------------------------------------------------------------------------- */

export interface NotificationServiceOptions {
  defaultChannels?: NotificationChannel[];

  maxNotificationsPerUser?: number;

  defaultListLimit?: number;

  maxListLimit?: number;

  autoDeleteExpired?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              CONSTANTS                                     */
/* -------------------------------------------------------------------------- */

export const DEFAULT_NOTIFICATION_CHANNELS:
  NotificationChannel[] = [
    "in_app",
  ];

export const DEFAULT_NOTIFICATION_TYPE:
  NotificationType = "info";

export const DEFAULT_NOTIFICATION_LEVEL:
  NotificationLevel = "normal";

export const DEFAULT_NOTIFICATION_STATUS:
  NotificationStatus = "unread";

export const DEFAULT_NOTIFICATION_LIST_LIMIT =
  50;

export const MAX_NOTIFICATION_LIST_LIMIT =
  1_000;