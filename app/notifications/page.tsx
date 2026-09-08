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
import { useCallback, useEffect, useMemo, useState } from "react";

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
  /*
    Notifications are loaded from the API rather than seeded.

    This page previously rendered a hardcoded array and every action
    -- mark read, mark all read, delete, clear read -- only called
    setState. A reload restored the same four fabricated items, so a
    notification a user had dismissed came straight back and a real
    one never appeared at all.
  */
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] =
    useState<NotificationFilter>("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });

      if (response.status === 401) {
        /* Signed out: an empty list is the correct view. */
        setNotifications([]);
        return;
      }

      if (!response.ok) {
        throw new Error("Notifications could not be loaded.");
      }

      const payload = (await response.json()) as {
        data?: {
          id: string;
          title: string;
          message: string | null;
          type: string;
          read: boolean;
          created_at: string;
          action_url: string | null;
          action_label: string | null;
        }[];
      };

      setNotifications(
        (payload.data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          description: row.message ?? "",
          type: row.type as NotificationType,
          createdAt: row.created_at,
          unread: !row.read,
          actionHref: row.action_url ?? undefined,
          actionLabel: row.action_label ?? undefined,
        })),
      );
    } catch {
      setError("Notifications could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

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

  /*
    Every mutation writes through the API and then reconciles local
    state, so the change survives a reload.

    Local state is updated OPTIMISTICALLY and rolled back on failure:
    the list is small and the actions are trivially reversible, so
    waiting on a round trip would make the UI feel broken. What is not
    acceptable is the previous behaviour -- updating local state and
    never telling the server at all.
  */
  async function markAsRead(id: string) {
    const previous = notifications;

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, unread: false }
          : notification,
      ),
    );

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      });

      if (!response.ok) throw new Error("failed");
    } catch {
      setNotifications(previous);
      setError("That notification could not be updated.");
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => n.unread);

    if (unread.length === 0) return;

    const previous = notifications;

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );

    try {
      /*
        The API has no bulk endpoint, so this is one request per unread
        notification. Acceptable at this list size (the page fetches at
        most a page of rows); a bulk route would be the fix if it grew.
      */
      const results = await Promise.all(
        unread.map((notification) =>
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: notification.id, read: true }),
          }),
        ),
      );

      if (results.some((r) => !r.ok)) throw new Error("failed");
    } catch {
      setNotifications(previous);
      setError("Some notifications could not be updated.");
    }
  }

  async function deleteNotification(id: string) {
    const previous = notifications;

    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );

    try {
      const response = await fetch(
        `/api/notifications?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("failed");
    } catch {
      setNotifications(previous);
      setError("That notification could not be removed.");
    }
  }

  async function clearReadNotifications() {
    const read = notifications.filter((n) => !n.unread);

    if (read.length === 0) return;

    const previous = notifications;

    setNotifications((current) =>
      current.filter((notification) => notification.unread),
    );

    try {
      const results = await Promise.all(
        read.map((notification) =>
          fetch(
            `/api/notifications?id=${encodeURIComponent(notification.id)}`,
            { method: "DELETE" },
          ),
        ),
      );

      if (results.some((r) => !r.ok)) throw new Error("failed");
    } catch {
      setNotifications(previous);
      setError("Some notifications could not be removed.");
    }
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
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>

              <button
                type="button"
                onClick={() => void clearReadNotifications()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Clear read
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Loading notifications...
          </p>
        ) : null}

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
                Important updates from your SYRAVEN workspace.
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