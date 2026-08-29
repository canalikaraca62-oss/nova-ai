"use client";

import Link from "next/link";
import {
  Archive,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Info,
  MessageSquare,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type NotificationType =
  | "system"
  | "message"
  | "project"
  | "update"
  | "alert";

type NotificationFilter = "all" | "unread" | "read";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  createdAt: string;
  unread: boolean;
  actionHref?: string;
  actionLabel?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notification-1",
    title: "Research analysis completed",
    description:
      "Your deep research workspace has finished processing the latest intelligence sources.",
    type: "project",
    createdAt: "2 minutes ago",
    unread: true,
    actionHref: "/knowledge",
    actionLabel: "View research",
  },
  {
    id: "notification-2",
    title: "New AI capability available",
    description:
      "A new autonomous capability has been added to the NOVA marketplace.",
    type: "update",
    createdAt: "18 minutes ago",
    unread: true,
    actionHref: "/marketplace",
    actionLabel: "Explore marketplace",
  },
  {
    id: "notification-3",
    title: "Workspace memory updated",
    description:
      "NOVA successfully extracted and stored new long-term knowledge from your recent activity.",
    type: "system",
    createdAt: "1 hour ago",
    unread: true,
    actionHref: "/memory",
    actionLabel: "Open memory",
  },
  {
    id: "notification-4",
    title: "New message in your workspace",
    description:
      "Your latest conversation has received a new AI-generated response.",
    type: "message",
    createdAt: "3 hours ago",
    unread: false,
    actionHref: "/dashboard",
    actionLabel: "Open workspace",
  },
  {
    id: "notification-5",
    title: "Usage threshold approaching",
    description:
      "Your current workspace usage is approaching the configured notification threshold.",
    type: "alert",
    createdAt: "Yesterday",
    unread: false,
    actionHref: "/pricing",
    actionLabel: "View plans",
  },
  {
    id: "notification-6",
    title: "Project successfully archived",
    description:
      "A completed project was archived and its workspace state has been preserved.",
    type: "project",
    createdAt: "Yesterday",
    unread: false,
    actionHref: "/dashboard",
    actionLabel: "View projects",
  },
  {
    id: "notification-7",
    title: "NOVA platform update",
    description:
      "Performance improvements and new workspace capabilities are now available.",
    type: "update",
    createdAt: "2 days ago",
    unread: false,
    actionHref: "/",
    actionLabel: "Learn more",
  },
];

function NotificationIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  switch (type) {
    case "message":
      return <MessageSquare className={className} />;

    case "project":
      return <FileText className={className} />;

    case "update":
      return <Sparkles className={className} />;

    case "alert":
      return <CircleAlert className={className} />;

    case "system":
    default:
      return <Info className={className} />;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >(INITIAL_NOTIFICATIONS);

  const [filter, setFilter] =
    useState<NotificationFilter>("all");

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) => notification.unread
    ).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case "unread":
        return notifications.filter(
          (notification) => notification.unread
        );

      case "read":
        return notifications.filter(
          (notification) => !notification.unread
        );

      case "all":
      default:
        return notifications;
    }
  }, [filter, notifications]);

  function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              unread: false,
            }
          : notification
      )
    );
  }

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      }))
    );
  }

  function deleteNotification(id: string) {
    setNotifications((current) =>
      current.filter(
        (notification) => notification.id !== id
      )
    );
  }

  function clearReadNotifications() {
    setNotifications((current) =>
      current.filter(
        (notification) => notification.unread
      )
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
        {/* Header */}
        <section className="border-b border-border pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Bell className="h-4 w-4" />
                Workspace activity
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Notifications
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Stay informed about important workspace activity,
                intelligence updates, messages and system events.
              </p>
            </div>

            <Link
              href="/settings"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                All
                <span className="ml-2 opacity-70">
                  {notifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "unread"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="ml-2 opacity-70">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFilter("read")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "read"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Read
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>

              <button
                type="button"
                onClick={clearReadNotifications}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Clear read
              </button>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Total
                </p>

                <p className="text-xl font-semibold text-foreground">
                  {notifications.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Unread
                </p>

                <p className="text-xl font-semibold text-foreground">
                  {unreadCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock3 className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Latest activity
                </p>

                <p className="text-sm font-semibold text-foreground">
                  2 minutes ago
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notification List */}
        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Recent activity
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Important updates from your NOVA workspace.
              </p>
            </div>
          </div>

          {filteredNotifications.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {filteredNotifications.map(
                (notification, index) => (
                  <article
                    key={notification.id}
                    className={`group relative flex gap-4 p-5 transition-colors hover:bg-muted/40 ${
                      index !==
                      filteredNotifications.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    {notification.unread && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                    )}

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <NotificationIcon
                        type={notification.type}
                        className="h-5 w-5"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {notification.title}
                            </h3>

                            {notification.unread && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>

                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {notification.description}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs text-muted-foreground">
                          {notification.createdAt}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {notification.actionHref &&
                          notification.actionLabel && (
                            <Link
                              href={
                                notification.actionHref
                              }
                              onClick={() =>
                                markAsRead(
                                  notification.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                            >
                              {
                                notification.actionLabel
                              }

                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}

                        {notification.unread && (
                          <button
                            type="button"
                            onClick={() =>
                              markAsRead(
                                notification.id
                              )
                            }
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Mark as read
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            deleteNotification(
                              notification.id
                            )
                          }
                          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                          aria-label={`Delete ${notification.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                {filter === "unread" ? (
                  <CheckCheck className="h-7 w-7" />
                ) : (
                  <BellOff className="h-7 w-7" />
                )}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {filter === "unread"
                  ? "You're all caught up"
                  : "No notifications found"}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {filter === "unread"
                  ? "There are no unread notifications in your workspace."
                  : "There are no notifications matching the selected filter."}
              </p>

              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-5 text-sm font-medium text-primary hover:underline"
                >
                  View all notifications
                </button>
              )}
            </div>
          )}
        </section>

        {/* Footer Info */}
        <section className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-5">
          <Archive className="h-5 w-5 shrink-0 text-muted-foreground" />

          <p className="text-sm leading-6 text-muted-foreground">
            Notifications are organized by workspace activity.
            Important system alerts and intelligence events are
            surfaced automatically.
          </p>
        </section>
      </div>
    </main>
  );
}