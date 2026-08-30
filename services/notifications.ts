/**
 * SYRAVEN Notifications Service
 *
 * Enterprise-grade notification management.
 *
 * Features:
 * - In-app notifications
 * - Email / push / SMS / webhook channel abstraction
 * - Notification lifecycle
 * - Read / unread state
 * - Priority handling
 * - Scheduling
 * - Expiration
 * - Bulk operations
 * - User preferences
 * - Pagination
 * - Filtering
 * - In-memory implementation
 *
 * Production note:
 * This service is intentionally storage/provider agnostic.
 * The in-memory implementation can later be replaced with
 * Supabase/PostgreSQL, Redis queues, email providers, push providers,
 * SMS providers, or webhooks without changing the public API.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type NotificationChannel =
  | "in_app"
  | "email"
  | "push"
  | "sms"
  | "webhook";

export type NotificationPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type NotificationStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  | "expired";

export type NotificationCategory =
  | "system"
  | "security"
  | "billing"
  | "project"
  | "task"
  | "message"
  | "ai"
  | "integration"
  | "account"
  | "custom";

export interface NotificationAction {
  id: string;

  label: string;

  url?: string;

  action?: string;

  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;

  userId: string;

  title: string;

  body: string;

  category: NotificationCategory | string;

  priority: NotificationPriority;

  status: NotificationStatus;

  channels: NotificationChannel[];

  readAt?: Date;

  deliveredAt?: Date;

  scheduledFor?: Date;

  expiresAt?: Date;

  actions: NotificationAction[];

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreateNotificationInput {
  userId: string;

  title: string;

  body: string;

  category?: NotificationCategory | string;

  priority?: NotificationPriority;

  channels?: NotificationChannel[];

  scheduledFor?: Date;

  expiresAt?: Date;

  actions?: NotificationAction[];

  metadata?: Record<string, unknown>;
}

export interface UpdateNotificationInput {
  title?: string;

  body?: string;

  category?: NotificationCategory | string;

  priority?: NotificationPriority;

  channels?: NotificationChannel[];

  scheduledFor?: Date;

  expiresAt?: Date;

  actions?: NotificationAction[];

  metadata?: Record<string, unknown>;
}

export interface NotificationListOptions {
  userId?: string;

  category?: NotificationCategory | string;

  priority?: NotificationPriority;

  status?: NotificationStatus;

  channel?: NotificationChannel;

  unreadOnly?: boolean;

  includeExpired?: boolean;

  limit?: number;

  offset?: number;
}

export interface NotificationListResult {
  notifications: Notification[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface NotificationPreference {
  userId: string;

  enabled: boolean;

  channels: Partial<
    Record<
      NotificationChannel,
      boolean
    >
  >;

  categories: Partial<
    Record<string, boolean>
  >;

  quietHours?: {
    enabled: boolean;

    start: string;

    end: string;
  };

  updatedAt: Date;
}

export interface UpdateNotificationPreferenceInput {
  enabled?: boolean;

  channels?: Partial<
    Record<
      NotificationChannel,
      boolean
    >
  >;

  categories?: Partial<
    Record<string, boolean>
  >;

  quietHours?: {
    enabled: boolean;

    start: string;

    end: string;
  };
}

export interface NotificationStats {
  userId?: string;

  total: number;

  unread: number;

  pending: number;

  scheduled: number;

  sent: number;

  delivered: number;

  failed: number;

  expired: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class NotificationServiceError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "NotificationServiceError";
  }
}

export class NotificationNotFoundError
  extends NotificationServiceError {
  constructor(
    notificationId: string
  ) {
    super(
      `Notification not found: ${notificationId}`
    );

    this.name =
      "NotificationNotFoundError";
  }
}

export class NotificationValidationError
  extends NotificationServiceError {
  readonly errors: string[];

  constructor(
    errors: string[]
  ) {
    super(
      errors.join(" ")
    );

    this.name =
      "NotificationValidationError";

    this.errors =
      errors;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_NOTIFICATION_LIMIT =
  50;

export const MAX_NOTIFICATION_LIMIT =
  500;

export const MAX_NOTIFICATION_TITLE_LENGTH =
  500;

export const MAX_NOTIFICATION_BODY_LENGTH =
  100_000;

export const MAX_NOTIFICATION_ACTIONS =
  20;

export const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannel[] =
  [
    "in_app",
  ];

/* -------------------------------------------------------------------------- */
/*                         NOTIFICATIONS SERVICE                              */
/* -------------------------------------------------------------------------- */

export class NotificationsService {
  private readonly notifications =
    new Map<
      string,
      Notification
    >();

  private readonly preferences =
    new Map<
      string,
      NotificationPreference
    >();

  /* ------------------------------------------------------------------------ */
  /*                                  CREATE                                  */
  /* ------------------------------------------------------------------------ */

  create(
    input: CreateNotificationInput
  ): Notification {
    this.validateCreateInput(
      input
    );

    const now =
      new Date();

    const channels =
      this.normalizeChannels(
        input.channels
      );

    const initialStatus =
      this.resolveInitialStatus(
        input.scheduledFor
      );

    const notification: Notification = {
      id:
        this.generateId(
          "notification"
        ),

      userId:
        input.userId.trim(),

      title:
        input.title.trim(),

      body:
        input.body,

      category:
        input.category ??
        "system",

      priority:
        input.priority ??
        "normal",

      status:
        initialStatus,

      channels,

      scheduledFor:
        input.scheduledFor
          ? new Date(
              input.scheduledFor
            )
          : undefined,

      expiresAt:
        input.expiresAt
          ? new Date(
              input.expiresAt
            )
          : undefined,

      actions:
        this.cloneActions(
          input.actions
        ),

      metadata:
        this.cloneMetadata(
          input.metadata
        ),

      createdAt:
        now,

      updatedAt:
        now,
    };

    if (
      notification.expiresAt &&
      notification.expiresAt <= now
    ) {
      notification.status =
        "expired";
    }

    this.notifications.set(
      notification.id,
      notification
    );

    return this.cloneNotification(
      notification
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                   READ                                   */
  /* ------------------------------------------------------------------------ */

  get(
    notificationId: string
  ): Notification | undefined {
    this.processLifecycle();

    const notification =
      this.notifications.get(
        notificationId
      );

    if (!notification) {
      return undefined;
    }

    return this.cloneNotification(
      notification
    );
  }

  require(
    notificationId: string
  ): Notification {
    const notification =
      this.get(
        notificationId
      );

    if (!notification) {
      throw new NotificationNotFoundError(
        notificationId
      );
    }

    return notification;
  }

  list(
    options: NotificationListOptions = {}
  ): NotificationListResult {
    this.processLifecycle();

    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    let items =
      Array.from(
        this.notifications.values()
      );

    if (
      options.userId !==
      undefined
    ) {
      items =
        items.filter(
          (notification) =>
            notification.userId ===
            options.userId
        );
    }

    if (
      options.category !==
      undefined
    ) {
      items =
        items.filter(
          (notification) =>
            notification.category ===
            options.category
        );
    }

    if (
      options.priority !==
      undefined
    ) {
      items =
        items.filter(
          (notification) =>
            notification.priority ===
            options.priority
        );
    }

    if (
      options.status !==
      undefined
    ) {
      items =
        items.filter(
          (notification) =>
            notification.status ===
            options.status
        );
    }

    if (
      options.channel !==
      undefined
    ) {
      items =
        items.filter(
          (notification) =>
            notification.channels.includes(
              options.channel as NotificationChannel
            )
        );
    }

    if (
      options.unreadOnly
    ) {
      items =
        items.filter(
          (notification) =>
            !notification.readAt &&
            notification.status !==
              "expired"
        );
    }

    if (
      !options.includeExpired
    ) {
      items =
        items.filter(
          (notification) =>
            notification.status !==
            "expired"
        );
    }

    items.sort(
      (a, b) =>
        b.createdAt.getTime() -
        a.createdAt.getTime()
    );

    const total =
      items.length;

    const notifications =
      items
        .slice(
          offset,
          offset + limit
        )
        .map(
          (notification) =>
            this.cloneNotification(
              notification
            )
        );

    return {
      notifications,

      total,

      limit,

      offset,

      hasMore:
        offset +
          notifications.length <
        total,
    };
  }

  getUserNotifications(
    userId: string,
    options: Omit<
      NotificationListOptions,
      "userId"
    > = {}
  ): NotificationListResult {
    return this.list({
      ...options,

      userId,
    });
  }

  getUnreadNotifications(
    userId: string,
    options: Omit<
      NotificationListOptions,
      "userId" | "unreadOnly"
    > = {}
  ): NotificationListResult {
    return this.list({
      ...options,

      userId,

      unreadOnly: true,
    });
  }

  getUnreadCount(
    userId: string
  ): number {
    return this.getUnreadNotifications(
      userId,
      {
        limit:
          MAX_NOTIFICATION_LIMIT,
      }
    ).total;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UPDATE                                  */
  /* ------------------------------------------------------------------------ */

  update(
    notificationId: string,
    input: UpdateNotificationInput
  ): Notification {
    const existing =
      this.require(
        notificationId
      );

    this.validateUpdateInput(
      input
    );

    const updated: Notification = {
      ...existing,

      title:
        input.title !== undefined
          ? input.title.trim()
          : existing.title,

      body:
        input.body !== undefined
          ? input.body
          : existing.body,

      category:
        input.category ??
        existing.category,

      priority:
        input.priority ??
        existing.priority,

      channels:
        input.channels !== undefined
          ? this.normalizeChannels(
              input.channels
            )
          : existing.channels,

      scheduledFor:
        input.scheduledFor !==
        undefined
          ? new Date(
              input.scheduledFor
            )
          : existing.scheduledFor,

      expiresAt:
        input.expiresAt !==
        undefined
          ? new Date(
              input.expiresAt
            )
          : existing.expiresAt,

      actions:
        input.actions !== undefined
          ? this.cloneActions(
              input.actions
            )
          : existing.actions,

      metadata:
        input.metadata !== undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        new Date(),
    };

    this.notifications.set(
      notificationId,
      updated
    );

    return this.cloneNotification(
      updated
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                             STATUS LIFECYCLE                             */
  /* ------------------------------------------------------------------------ */

  markSending(
    notificationId: string
  ): Notification {
    return this.setStatus(
      notificationId,
      "sending"
    );
  }

  markSent(
    notificationId: string
  ): Notification {
    return this.setStatus(
      notificationId,
      "sent"
    );
  }

  markDelivered(
    notificationId: string
  ): Notification {
    const existing =
      this.require(
        notificationId
      );

    const now =
      new Date();

    const updated: Notification = {
      ...existing,

      status:
        "delivered",

      deliveredAt:
        now,

      updatedAt:
        now,
    };

    this.notifications.set(
      notificationId,
      updated
    );

    return this.cloneNotification(
      updated
    );
  }

  markFailed(
    notificationId: string
  ): Notification {
    return this.setStatus(
      notificationId,
      "failed"
    );
  }

  cancel(
    notificationId: string
  ): Notification {
    return this.setStatus(
      notificationId,
      "cancelled"
    );
  }

  markRead(
    notificationId: string
  ): Notification {
    const existing =
      this.require(
        notificationId
      );

    if (
      existing.readAt
    ) {
      return existing;
    }

    const now =
      new Date();

    const updated: Notification = {
      ...existing,

      status:
        existing.status ===
          "expired"
          ? "expired"
          : "read",

      readAt:
        now,

      updatedAt:
        now,
    };

    this.notifications.set(
      notificationId,
      updated
    );

    return this.cloneNotification(
      updated
    );
  }

  markUnread(
    notificationId: string
  ): Notification {
    const existing =
      this.require(
        notificationId
      );

    const updated: Notification = {
      ...existing,

      readAt:
        undefined,

      status:
        existing.status ===
          "read"
          ? "delivered"
          : existing.status,

      updatedAt:
        new Date(),
    };

    this.notifications.set(
      notificationId,
      updated
    );

    return this.cloneNotification(
      updated
    );
  }

  markAllRead(
    userId: string
  ): number {
    const unread =
      Array.from(
        this.notifications.values()
      ).filter(
        (notification) =>
          notification.userId ===
            userId &&
          !notification.readAt &&
          notification.status !==
            "expired" &&
          notification.status !==
            "cancelled"
      );

    for (
      const notification of unread
    ) {
      this.markRead(
        notification.id
      );
    }

    return unread.length;
  }

  /* ------------------------------------------------------------------------ */
  /*                               PREFERENCES                                */
  /* ------------------------------------------------------------------------ */

  getPreferences(
    userId: string
  ): NotificationPreference {
    const existing =
      this.preferences.get(
        userId
      );

    if (existing) {
      return this.clonePreferences(
        existing
      );
    }

    const preferences =
      this.createDefaultPreferences(
        userId
      );

    this.preferences.set(
      userId,
      preferences
    );

    return this.clonePreferences(
      preferences
    );
  }

  updatePreferences(
    userId: string,
    input: UpdateNotificationPreferenceInput
  ): NotificationPreference {
    const current =
      this.getPreferences(
        userId
      );

    const updated: NotificationPreference = {
      ...current,

      enabled:
        input.enabled ??
        current.enabled,

      channels:
        {
          ...current.channels,

          ...input.channels,
        },

      categories:
        {
          ...current.categories,

          ...input.categories,
        },

      quietHours:
        input.quietHours !==
        undefined
          ? {
              ...input.quietHours,
            }
          : current.quietHours,

      updatedAt:
        new Date(),
    };

    this.preferences.set(
      userId,
      updated
    );

    return this.clonePreferences(
      updated
    );
  }

  canNotify(
    userId: string,
    category: string,
    channel: NotificationChannel
  ): boolean {
    const preferences =
      this.getPreferences(
        userId
      );

    if (
      !preferences.enabled
    ) {
      return false;
    }

    if (
      preferences.channels[channel] ===
      false
    ) {
      return false;
    }

    if (
      preferences.categories[category] ===
      false
    ) {
      return false;
    }

    if (
      this.isQuietHours(
        preferences
      )
    ) {
      return false;
    }

    return true;
  }

  /* ------------------------------------------------------------------------ */
  /*                                DELIVERY                                  */
  /* ------------------------------------------------------------------------ */

  getDeliverableNotifications(): Notification[] {
    this.processLifecycle();

    const now =
      new Date();

    return Array.from(
      this.notifications.values()
    )
      .filter(
        (notification) => {
          if (
            notification.status !==
              "pending" &&
            notification.status !==
              "scheduled"
          ) {
            return false;
          }

          if (
            notification.expiresAt &&
            notification.expiresAt <=
              now
          ) {
            return false;
          }

          if (
            notification.scheduledFor &&
            notification.scheduledFor >
              now
          ) {
            return false;
          }

          return notification.channels.some(
            (channel) =>
              this.canNotify(
                notification.userId,
                notification.category,
                channel
              )
          );
        }
      )
      .sort(
        (a, b) => {
          const priorityDifference =
            this.priorityValue(
              b.priority
            ) -
            this.priorityValue(
              a.priority
            );

          if (
            priorityDifference !==
            0
          ) {
            return priorityDifference;
          }

          return (
            a.createdAt.getTime() -
            b.createdAt.getTime()
          );
        }
      )
      .map(
        (notification) =>
          this.cloneNotification(
            notification
          )
      );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  DELETE                                  */
  /* ------------------------------------------------------------------------ */

  delete(
    notificationId: string
  ): void {
    this.require(
      notificationId
    );

    this.notifications.delete(
      notificationId
    );
  }

  deleteUserNotifications(
    userId: string
  ): number {
    const ids =
      Array.from(
        this.notifications.values()
      )
        .filter(
          (notification) =>
            notification.userId ===
            userId
        )
        .map(
          (notification) =>
            notification.id
        );

    for (
      const id of ids
    ) {
      this.notifications.delete(
        id
      );
    }

    return ids.length;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  STATS                                   */
  /* ------------------------------------------------------------------------ */

  getStats(
    userId?: string
  ): NotificationStats {
    this.processLifecycle();

    const items =
      Array.from(
        this.notifications.values()
      ).filter(
        (notification) =>
          userId === undefined ||
          notification.userId ===
            userId
      );

    return {
      userId,

      total:
        items.length,

      unread:
        items.filter(
          (notification) =>
            !notification.readAt &&
            notification.status !==
              "expired"
        ).length,

      pending:
        items.filter(
          (notification) =>
            notification.status ===
            "pending"
        ).length,

      scheduled:
        items.filter(
          (notification) =>
            notification.status ===
            "scheduled"
        ).length,

      sent:
        items.filter(
          (notification) =>
            notification.status ===
            "sent"
        ).length,

      delivered:
        items.filter(
          (notification) =>
            notification.status ===
            "delivered"
        ).length,

      failed:
        items.filter(
          (notification) =>
            notification.status ===
            "failed"
        ).length,

      expired:
        items.filter(
          (notification) =>
            notification.status ===
            "expired"
        ).length,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                  ADMIN                                   */
  /* ------------------------------------------------------------------------ */

  clear(
    userId?: string
  ): void {
    if (
      userId === undefined
    ) {
      this.notifications.clear();

      return;
    }

    this.deleteUserNotifications(
      userId
    );
  }

  clearPreferences(
    userId?: string
  ): void {
    if (
      userId === undefined
    ) {
      this.preferences.clear();

      return;
    }

    this.preferences.delete(
      userId
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                             PRIVATE HELPERS                              */
  /* ------------------------------------------------------------------------ */

  private validateCreateInput(
    input: CreateNotificationInput
  ): void {
    const errors: string[] =
      [];

    if (
      !input.userId ||
      !input.userId.trim()
    ) {
      errors.push(
        "User ID is required."
      );
    }

    if (
      !input.title ||
      !input.title.trim()
    ) {
      errors.push(
        "Notification title is required."
      );
    }

    if (
      input.title &&
      input.title.length >
        MAX_NOTIFICATION_TITLE_LENGTH
    ) {
      errors.push(
        `Notification title exceeds maximum length of ${MAX_NOTIFICATION_TITLE_LENGTH}.`
      );
    }

    if (
      input.body &&
      input.body.length >
        MAX_NOTIFICATION_BODY_LENGTH
    ) {
      errors.push(
        `Notification body exceeds maximum length of ${MAX_NOTIFICATION_BODY_LENGTH}.`
      );
    }

    if (
      input.actions &&
      input.actions.length >
        MAX_NOTIFICATION_ACTIONS
    ) {
      errors.push(
        `Notification cannot have more than ${MAX_NOTIFICATION_ACTIONS} actions.`
      );
    }

    if (
      input.scheduledFor &&
      input.expiresAt &&
      input.scheduledFor >=
        input.expiresAt
    ) {
      errors.push(
        "Scheduled time must be before expiration time."
      );
    }

    if (
      errors.length > 0
    ) {
      throw new NotificationValidationError(
        errors
      );
    }
  }

  private validateUpdateInput(
    input: UpdateNotificationInput
  ): void {
    const errors: string[] =
      [];

    if (
      input.title !== undefined &&
      !input.title.trim()
    ) {
      errors.push(
        "Notification title cannot be empty."
      );
    }

    if (
      input.title !== undefined &&
      input.title.length >
        MAX_NOTIFICATION_TITLE_LENGTH
    ) {
      errors.push(
        `Notification title exceeds maximum length of ${MAX_NOTIFICATION_TITLE_LENGTH}.`
      );
    }

    if (
      input.body !== undefined &&
      input.body.length >
        MAX_NOTIFICATION_BODY_LENGTH
    ) {
      errors.push(
        `Notification body exceeds maximum length of ${MAX_NOTIFICATION_BODY_LENGTH}.`
      );
    }

    if (
      input.actions !== undefined &&
      input.actions.length >
        MAX_NOTIFICATION_ACTIONS
    ) {
      errors.push(
        `Notification cannot have more than ${MAX_NOTIFICATION_ACTIONS} actions.`
      );
    }

    if (
      errors.length > 0
    ) {
      throw new NotificationValidationError(
        errors
      );
    }
  }

  private normalizeChannels(
    channels?: NotificationChannel[]
  ): NotificationChannel[] {
    const source =
      channels &&
      channels.length > 0
        ? channels
        : DEFAULT_NOTIFICATION_CHANNELS;

    return Array.from(
      new Set(source)
    );
  }

  private resolveInitialStatus(
    scheduledFor?: Date
  ): NotificationStatus {
    if (
      scheduledFor &&
      scheduledFor >
        new Date()
    ) {
      return "scheduled";
    }

    return "pending";
  }

  private setStatus(
    notificationId: string,
    status: NotificationStatus
  ): Notification {
    const existing =
      this.require(
        notificationId
      );

    const updated: Notification = {
      ...existing,

      status,

      updatedAt:
        new Date(),
    };

    this.notifications.set(
      notificationId,
      updated
    );

    return this.cloneNotification(
      updated
    );
  }

  private processLifecycle(): void {
    const now =
      new Date();

    for (
      const notification of
      this.notifications.values()
    ) {
      let changed =
        false;

      const updated: Notification = {
        ...notification,
      };

      if (
        notification.expiresAt &&
        notification.expiresAt <=
          now &&
        notification.status !==
          "expired"
      ) {
        updated.status =
          "expired";

        changed =
          true;
      }

      if (
        notification.status ===
          "scheduled" &&
        notification.scheduledFor &&
        notification.scheduledFor <=
          now &&
        !updated.expiresAt
      ) {
        updated.status =
          "pending";

        changed =
          true;
      }

      if (
        changed
      ) {
        updated.updatedAt =
          now;

        this.notifications.set(
          updated.id,
          updated
        );
      }
    }
  }

  private createDefaultPreferences(
    userId: string
  ): NotificationPreference {
    return {
      userId,

      enabled: true,

      channels: {
        in_app: true,
        email: true,
        push: true,
        sms: false,
        webhook: false,
      },

      categories: {},

      updatedAt:
        new Date(),
    };
  }

  private isQuietHours(
    preferences: NotificationPreference
  ): boolean {
    const quietHours =
      preferences.quietHours;

    if (
      !quietHours ||
      !quietHours.enabled
    ) {
      return false;
    }

    const startMinutes =
      this.parseTime(
        quietHours.start
      );

    const endMinutes =
      this.parseTime(
        quietHours.end
      );

    if (
      startMinutes === null ||
      endMinutes === null
    ) {
      return false;
    }

    const now =
      new Date();

    const currentMinutes =
      now.getHours() *
        60 +
      now.getMinutes();

    if (
      startMinutes ===
      endMinutes
    ) {
      return false;
    }

    if (
      startMinutes <
      endMinutes
    ) {
      return (
        currentMinutes >=
          startMinutes &&
        currentMinutes <
          endMinutes
      );
    }

    return (
      currentMinutes >=
        startMinutes ||
      currentMinutes <
        endMinutes
    );
  }

  private parseTime(
    value: string
  ): number | null {
    const match =
      /^(\d{2}):(\d{2})$/.exec(
        value
      );

    if (!match) {
      return null;
    }

    const hours =
      Number(match[1]);

    const minutes =
      Number(match[2]);

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return (
      hours * 60 +
      minutes
    );
  }

  private priorityValue(
    priority: NotificationPriority
  ): number {
    switch (priority) {
      case "urgent":
        return 4;

      case "high":
        return 3;

      case "normal":
        return 2;

      case "low":
        return 1;

      default:
        return 0;
    }
  }

  private normalizeLimit(
    limit?: number
  ): number {
    if (
      limit === undefined ||
      !Number.isFinite(limit)
    ) {
      return DEFAULT_NOTIFICATION_LIMIT;
    }

    return Math.max(
      1,
      Math.min(
        Math.floor(limit),
        MAX_NOTIFICATION_LIMIT
      )
    );
  }

  private normalizeOffset(
    offset?: number
  ): number {
    if (
      offset === undefined ||
      !Number.isFinite(offset)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(offset)
    );
  }

  private cloneActions(
    actions?: NotificationAction[]
  ): NotificationAction[] {
    if (!actions) {
      return [];
    }

    return actions.map(
      (action) => ({
        ...action,

        metadata:
          this.cloneMetadata(
            action.metadata
          ),
      })
    );
  }

  private cloneMetadata(
    metadata?: Record<
      string,
      unknown
    >
  ): Record<
    string,
    unknown
  > | undefined {
    if (!metadata) {
      return undefined;
    }

    return {
      ...metadata,
    };
  }

  private cloneNotification(
    notification: Notification
  ): Notification {
    return {
      ...notification,

      channels:
        [
          ...notification.channels,
        ],

      actions:
        this.cloneActions(
          notification.actions
        ),

      scheduledFor:
        notification.scheduledFor
          ? new Date(
              notification.scheduledFor
            )
          : undefined,

      expiresAt:
        notification.expiresAt
          ? new Date(
              notification.expiresAt
            )
          : undefined,

      readAt:
        notification.readAt
          ? new Date(
              notification.readAt
            )
          : undefined,

      deliveredAt:
        notification.deliveredAt
          ? new Date(
              notification.deliveredAt
            )
          : undefined,

      createdAt:
        new Date(
          notification.createdAt
        ),

      updatedAt:
        new Date(
          notification.updatedAt
        ),

      metadata:
        this.cloneMetadata(
          notification.metadata
        ),
    };
  }

  private clonePreferences(
    preferences: NotificationPreference
  ): NotificationPreference {
    return {
      ...preferences,

      channels: {
        ...preferences.channels,
      },

      categories: {
        ...preferences.categories,
      },

      quietHours:
        preferences.quietHours
          ? {
              ...preferences.quietHours,
            }
          : undefined,

      updatedAt:
        new Date(
          preferences.updatedAt
        ),
    };
  }

  private generateId(
    prefix: string
  ): string {
    const timestamp =
      Date.now()
        .toString(36);

    const random =
      Math.random()
        .toString(36)
        .slice(2, 14);

    return `${prefix}_${timestamp}_${random}`;
  }
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const notificationsService =
  new NotificationsService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function createNotification(
  input: CreateNotificationInput
): Notification {
  return notificationsService.create(
    input
  );
}

export function getNotification(
  notificationId: string
): Notification | undefined {
  return notificationsService.get(
    notificationId
  );
}

export function requireNotification(
  notificationId: string
): Notification {
  return notificationsService.require(
    notificationId
  );
}

export function updateNotification(
  notificationId: string,
  input: UpdateNotificationInput
): Notification {
  return notificationsService.update(
    notificationId,
    input
  );
}

export function listNotifications(
  options: NotificationListOptions = {}
): NotificationListResult {
  return notificationsService.list(
    options
  );
}

export function getUserNotifications(
  userId: string,
  options: Omit<
    NotificationListOptions,
    "userId"
  > = {}
): NotificationListResult {
  return notificationsService.getUserNotifications(
    userId,
    options
  );
}

export function getUnreadNotifications(
  userId: string,
  options: Omit<
    NotificationListOptions,
    "userId" | "unreadOnly"
  > = {}
): NotificationListResult {
  return notificationsService.getUnreadNotifications(
    userId,
    options
  );
}

export function getUnreadNotificationCount(
  userId: string
): number {
  return notificationsService.getUnreadCount(
    userId
  );
}

export function markNotificationRead(
  notificationId: string
): Notification {
  return notificationsService.markRead(
    notificationId
  );
}

export function markNotificationUnread(
  notificationId: string
): Notification {
  return notificationsService.markUnread(
    notificationId
  );
}

export function markAllNotificationsRead(
  userId: string
): number {
  return notificationsService.markAllRead(
    userId
  );
}

export function cancelNotification(
  notificationId: string
): Notification {
  return notificationsService.cancel(
    notificationId
  );
}

export function deleteNotification(
  notificationId: string
): void {
  notificationsService.delete(
    notificationId
  );
}

export function getNotificationPreferences(
  userId: string
): NotificationPreference {
  return notificationsService.getPreferences(
    userId
  );
}

export function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferenceInput
): NotificationPreference {
  return notificationsService.updatePreferences(
    userId,
    input
  );
}

export function canSendNotification(
  userId: string,
  category: string,
  channel: NotificationChannel
): boolean {
  return notificationsService.canNotify(
    userId,
    category,
    channel
  );
}

export function getNotificationStats(
  userId?: string
): NotificationStats {
  return notificationsService.getStats(
    userId
  );
}

export default notificationsService;