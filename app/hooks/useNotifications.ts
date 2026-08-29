"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error";

export interface NotificationAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface Notification {
  id: string;
  title: string;
  message?: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  action?: NotificationAction;
  duration?: number;
}

export interface CreateNotificationInput {
  id?: string;
  title: string;
  message?: string;
  type?: NotificationType;
  action?: NotificationAction;
  duration?: number;
}

export interface UseNotificationsOptions {
  initialNotifications?: Notification[];
  maxNotifications?: number;
}

export interface UseNotificationsReturn {
  notifications: Notification[];

  unreadCount: number;

  hasUnread: boolean;

  addNotification: (
    input: CreateNotificationInput
  ) => Notification;

  notify: (
    input: CreateNotificationInput
  ) => Notification;

  success: (
    title: string,
    message?: string
  ) => Notification;

  error: (
    title: string,
    message?: string
  ) => Notification;

  warning: (
    title: string,
    message?: string
  ) => Notification;

  info: (
    title: string,
    message?: string
  ) => Notification;

  removeNotification: (
    id: string
  ) => void;

  dismiss: (
    id: string
  ) => void;

  markAsRead: (
    id: string
  ) => void;

  markAsUnread: (
    id: string
  ) => void;

  markAllAsRead: () => void;

  clearNotifications: () => void;

  clearAll: () => void;

  getNotification: (
    id: string
  ) => Notification | null;
}

function createNotificationId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "notification",
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2),
  ].join("-");
}

function createTimestamp(): string {
  return new Date().toISOString();
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    initialNotifications = [],
    maxNotifications = 100,
  } = options;

  const [
    notifications,
    setNotificationsState,
  ] = useState<Notification[]>(
    initialNotifications
  );

  const notificationsRef =
    useRef<Notification[]>(
      initialNotifications
    );

  const commitNotifications =
    useCallback(
      (
        updater:
          | Notification[]
          | ((
              current: Notification[]
            ) => Notification[])
      ) => {
        setNotificationsState(
          (currentNotifications) => {
            const nextNotifications =
              typeof updater === "function"
                ? updater(
                    currentNotifications
                  )
                : updater;

            notificationsRef.current =
              nextNotifications;

            return nextNotifications;
          }
        );
      },
      []
    );

  const addNotification =
    useCallback(
      (
        input: CreateNotificationInput
      ): Notification => {
        const notification: Notification =
          {
            id:
              input.id ??
              createNotificationId(),

            title: input.title,

            message:
              input.message,

            type:
              input.type ?? "info",

            read: false,

            createdAt:
              createTimestamp(),

            action:
              input.action,

            duration:
              input.duration,
          };

        commitNotifications(
          (currentNotifications) => {
            const existingIndex =
              currentNotifications.findIndex(
                (item) =>
                  item.id ===
                  notification.id
              );

            let nextNotifications:
              Notification[];

            if (existingIndex !== -1) {
              nextNotifications = [
                ...currentNotifications,
              ];

              nextNotifications[
                existingIndex
              ] = notification;
            } else {
              nextNotifications = [
                notification,
                ...currentNotifications,
              ];
            }

            if (
              maxNotifications > 0 &&
              nextNotifications.length >
                maxNotifications
            ) {
              return nextNotifications.slice(
                0,
                maxNotifications
              );
            }

            return nextNotifications;
          }
        );

        return notification;
      },
      [
        commitNotifications,
        maxNotifications,
      ]
    );

  const notify = useCallback(
    (
      input: CreateNotificationInput
    ) => {
      return addNotification(input);
    },
    [addNotification]
  );

  const success = useCallback(
    (
      title: string,
      message?: string
    ) => {
      return addNotification({
        title,
        message,
        type: "success",
      });
    },
    [addNotification]
  );

  const error = useCallback(
    (
      title: string,
      message?: string
    ) => {
      return addNotification({
        title,
        message,
        type: "error",
      });
    },
    [addNotification]
  );

  const warning = useCallback(
    (
      title: string,
      message?: string
    ) => {
      return addNotification({
        title,
        message,
        type: "warning",
      });
    },
    [addNotification]
  );

  const info = useCallback(
    (
      title: string,
      message?: string
    ) => {
      return addNotification({
        title,
        message,
        type: "info",
      });
    },
    [addNotification]
  );

  const removeNotification =
    useCallback(
      (id: string) => {
        commitNotifications(
          (currentNotifications) =>
            currentNotifications.filter(
              (notification) =>
                notification.id !== id
            )
        );
      },
      [commitNotifications]
    );

  const dismiss = useCallback(
    (id: string) => {
      removeNotification(id);
    },
    [removeNotification]
  );

  const markAsRead = useCallback(
    (id: string) => {
      commitNotifications(
        (currentNotifications) =>
          currentNotifications.map(
            (notification) =>
              notification.id === id
                ? {
                    ...notification,
                    read: true,
                  }
                : notification
          )
      );
    },
    [commitNotifications]
  );

  const markAsUnread = useCallback(
    (id: string) => {
      commitNotifications(
        (currentNotifications) =>
          currentNotifications.map(
            (notification) =>
              notification.id === id
                ? {
                    ...notification,
                    read: false,
                  }
                : notification
          )
      );
    },
    [commitNotifications]
  );

  const markAllAsRead =
    useCallback(() => {
      commitNotifications(
        (currentNotifications) =>
          currentNotifications.map(
            (notification) => ({
              ...notification,
              read: true,
            })
          )
      );
    }, [commitNotifications]);

  const clearNotifications =
    useCallback(() => {
      commitNotifications([]);
    }, [commitNotifications]);

  const clearAll = useCallback(() => {
    clearNotifications();
  }, [clearNotifications]);

  const getNotification =
    useCallback(
      (
        id: string
      ): Notification | null => {
        return (
          notificationsRef.current.find(
            (notification) =>
              notification.id === id
          ) ?? null
        );
      },
      []
    );

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !notification.read
      ).length,
    [notifications]
  );

  const hasUnread =
    unreadCount > 0;

  return {
    notifications,

    unreadCount,

    hasUnread,

    addNotification,
    notify,

    success,
    error,
    warning,
    info,

    removeNotification,
    dismiss,

    markAsRead,
    markAsUnread,
    markAllAsRead,

    clearNotifications,
    clearAll,

    getNotification,
  };
}

export default useNotifications;