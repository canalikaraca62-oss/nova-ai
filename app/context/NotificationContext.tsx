"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "message"
  | "task"
  | "project"
  | "system"
  | "billing";

export type NotificationPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export interface NotificationAction {
  id: string;
  label: string;
  href?: string;
  destructive?: boolean;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  description?: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  href?: string;
  image?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationInput {
  type?: NotificationType;
  priority?: NotificationPriority;
  title: string;
  description?: string;
  href?: string;
  image?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
}

export interface UpdateNotificationInput {
  title?: string;
  description?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  href?: string;
  image?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
}

export interface NotificationResult<T = void> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface NotificationContextValue {
  notifications: AppNotification[];

  unreadCount: number;

  isLoading: boolean;

  isInitialized: boolean;

  error: string | null;

  addNotification: (
    input: CreateNotificationInput
  ) => Promise<
    NotificationResult<AppNotification>
  >;

  updateNotification: (
    notificationId: string,
    input: UpdateNotificationInput
  ) => Promise<
    NotificationResult<AppNotification>
  >;

  removeNotification: (
    notificationId: string
  ) => Promise<NotificationResult>;

  markAsRead: (
    notificationId: string
  ) => Promise<NotificationResult>;

  markAsUnread: (
    notificationId: string
  ) => Promise<NotificationResult>;

  markAllAsRead: () => Promise<
    NotificationResult
  >;

  clearAll: () => Promise<
    NotificationResult
  >;

  clearRead: () => Promise<
    NotificationResult
  >;

  getNotification: (
    notificationId: string
  ) => AppNotification | null;

  refreshNotifications: () => Promise<void>;

  clearError: () => void;
}

export interface NotificationProviderProps {
  children: React.ReactNode;
}

const NotificationContext =
  createContext<
    NotificationContextValue | undefined
  >(undefined);

const NOTIFICATION_STORAGE_KEY =
  "nova-notifications";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function readStorage<T>(
  key: string,
  fallback: T
): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const value =
      window.localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(
  key: string,
  value: T
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    // Storage errors must never crash the application.
  }
}

function sortNotifications(
  notifications: AppNotification[]
): AppNotification[] {
  const priorityWeight: Record<
    NotificationPriority,
    number
  > = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  return [...notifications].sort(
    (a, b) => {
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }

      const priorityDifference =
        priorityWeight[b.priority] -
        priorityWeight[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    }
  );
}

export function NotificationProvider({
  children,
}: NotificationProviderProps): React.ReactElement {
  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isInitialized, setIsInitialized] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !notification.read
      ).length,
    [notifications]
  );

  const persistNotifications =
    useCallback(
      (
        nextNotifications: AppNotification[]
      ): void => {
        const sortedNotifications =
          sortNotifications(
            nextNotifications
          );

        setNotifications(
          sortedNotifications
        );

        writeStorage(
          NOTIFICATION_STORAGE_KEY,
          sortedNotifications
        );
      },
      []
    );

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const refreshNotifications =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production API integration:
         *
         * const response = await fetch(
         *   "/api/notifications",
         *   {
         *     credentials: "include",
         *   }
         * );
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to load notifications"
         *   );
         * }
         *
         * const data =
         *   (await response.json()) as AppNotification[];
         */

        const storedNotifications =
          readStorage<AppNotification[]>(
            NOTIFICATION_STORAGE_KEY,
            []
          );

        setNotifications(
          sortNotifications(
            storedNotifications
          )
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load notifications";

        setError(message);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const addNotification =
    useCallback(
      async (
        input: CreateNotificationInput
      ): Promise<
        NotificationResult<AppNotification>
      > => {
        setError(null);

        try {
          const title = input.title.trim();

          if (!title) {
            throw new Error(
              "Notification title cannot be empty"
            );
          }

          const notification: AppNotification = {
            id: createId("notification"),
            type: input.type ?? "info",
            priority:
              input.priority ?? "normal",
            title,
            description:
              input.description?.trim() ||
              undefined,
            read: false,
            createdAt:
              new Date().toISOString(),
            readAt: null,
            href: input.href,
            image: input.image,
            actions: input.actions,
            metadata: input.metadata,
          };

          /*
           * Production API integration:
           *
           * POST /api/notifications
           */

          persistNotifications([
            notification,
            ...notifications,
          ]);

          return {
            success: true,
            data: notification,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to create notification";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const getNotification =
    useCallback(
      (
        notificationId: string
      ): AppNotification | null => {
        return (
          notifications.find(
            (notification) =>
              notification.id ===
              notificationId
          ) ?? null
        );
      },
      [notifications]
    );

  const updateNotification =
    useCallback(
      async (
        notificationId: string,
        input: UpdateNotificationInput
      ): Promise<
        NotificationResult<AppNotification>
      > => {
        setError(null);

        try {
          const existing =
            notifications.find(
              (notification) =>
                notification.id ===
                notificationId
            );

          if (!existing) {
            throw new Error(
              "Notification not found"
            );
          }

          if (
            input.title !== undefined &&
            !input.title.trim()
          ) {
            throw new Error(
              "Notification title cannot be empty"
            );
          }

          const updatedNotification:
            AppNotification = {
              ...existing,
              title:
                input.title?.trim() ??
                existing.title,
              description:
                input.description?.trim() ??
                existing.description,
              type:
                input.type ??
                existing.type,
              priority:
                input.priority ??
                existing.priority,
              href:
                input.href ??
                existing.href,
              image:
                input.image ??
                existing.image,
              actions:
                input.actions ??
                existing.actions,
              metadata:
                input.metadata ??
                existing.metadata,
            };

          /*
           * Production API integration:
           *
           * PATCH /api/notifications/:id
           */

          const nextNotifications =
            notifications.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? updatedNotification
                  : notification
            );

          persistNotifications(
            nextNotifications
          );

          return {
            success: true,
            data: updatedNotification,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to update notification";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const removeNotification =
    useCallback(
      async (
        notificationId: string
      ): Promise<NotificationResult> => {
        setError(null);

        try {
          const exists =
            notifications.some(
              (notification) =>
                notification.id ===
                notificationId
            );

          if (!exists) {
            throw new Error(
              "Notification not found"
            );
          }

          /*
           * Production API integration:
           *
           * DELETE /api/notifications/:id
           */

          const nextNotifications =
            notifications.filter(
              (notification) =>
                notification.id !==
                notificationId
            );

          persistNotifications(
            nextNotifications
          );

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to remove notification";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const markAsRead =
    useCallback(
      async (
        notificationId: string
      ): Promise<NotificationResult> => {
        setError(null);

        try {
          const exists =
            notifications.some(
              (notification) =>
                notification.id ===
                notificationId
            );

          if (!exists) {
            throw new Error(
              "Notification not found"
            );
          }

          const readAt =
            new Date().toISOString();

          const nextNotifications =
            notifications.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      read: true,
                      readAt,
                    }
                  : notification
            );

          persistNotifications(
            nextNotifications
          );

          /*
           * Production API integration:
           *
           * PATCH /api/notifications/:id/read
           */

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to mark notification as read";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const markAsUnread =
    useCallback(
      async (
        notificationId: string
      ): Promise<NotificationResult> => {
        setError(null);

        try {
          const exists =
            notifications.some(
              (notification) =>
                notification.id ===
                notificationId
            );

          if (!exists) {
            throw new Error(
              "Notification not found"
            );
          }

          const nextNotifications =
            notifications.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      read: false,
                      readAt: null,
                    }
                  : notification
            );

          persistNotifications(
            nextNotifications
          );

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to mark notification as unread";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const markAllAsRead =
    useCallback(
      async (): Promise<NotificationResult> => {
        setError(null);

        try {
          const readAt =
            new Date().toISOString();

          const nextNotifications =
            notifications.map(
              (notification) =>
                notification.read
                  ? notification
                  : {
                      ...notification,
                      read: true,
                      readAt,
                    }
            );

          persistNotifications(
            nextNotifications
          );

          /*
           * Production API integration:
           *
           * POST /api/notifications/read-all
           */

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to mark all notifications as read";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const clearRead =
    useCallback(
      async (): Promise<NotificationResult> => {
        setError(null);

        try {
          const nextNotifications =
            notifications.filter(
              (notification) =>
                !notification.read
            );

          persistNotifications(
            nextNotifications
          );

          /*
           * Production API integration:
           *
           * DELETE /api/notifications/read
           */

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to clear read notifications";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [
        notifications,
        persistNotifications,
      ]
    );

  const clearAll =
    useCallback(
      async (): Promise<NotificationResult> => {
        setError(null);

        try {
          /*
           * Production API integration:
           *
           * DELETE /api/notifications
           */

          persistNotifications([]);

          return {
            success: true,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to clear notifications";

          setError(message);

          return {
            success: false,
            message,
          };
        }
      },
      [persistNotifications]
    );

  const value =
    useMemo<NotificationContextValue>(
      () => ({
        notifications,
        unreadCount,
        isLoading,
        isInitialized,
        error,
        addNotification,
        updateNotification,
        removeNotification,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        clearAll,
        clearRead,
        getNotification,
        refreshNotifications,
        clearError,
      }),
      [
        notifications,
        unreadCount,
        isLoading,
        isInitialized,
        error,
        addNotification,
        updateNotification,
        removeNotification,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        clearAll,
        clearRead,
        getNotification,
        refreshNotifications,
        clearError,
      ]
    );

  return (
    <NotificationContext.Provider
      value={value}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext():
  NotificationContextValue {
  const context =
    useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider"
    );
  }

  return context;
}

export function useNotifications():
  NotificationContextValue {
  return useNotificationContext();
}