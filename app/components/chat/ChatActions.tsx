"use client";

import React, { useCallback, useEffect, useState } from "react";

export type ChatActionType =
  | "new"
  | "rename"
  | "archive"
  | "unarchive"
  | "pin"
  | "unpin"
  | "delete"
  | "export"
  | "share";

export type ChatActionsProps = {
  chatId?: string;

  title?: string;

  isPinned?: boolean;

  isArchived?: boolean;

  disabled?: boolean;

  className?: string;

  onAction?: (
    action: ChatActionType
  ) => void | Promise<void>;

  onRename?: (
    title: string
  ) => void | Promise<void>;

  onDelete?: () => void | Promise<void>;

  onExport?: () => void | Promise<void>;

  onShare?: () => void | Promise<void>;

  onArchive?: () => void | Promise<void>;

  onUnarchive?: () => void | Promise<void>;

  onPin?: () => void | Promise<void>;

  onUnpin?: () => void | Promise<void>;

  onNewChat?: () => void | Promise<void>;
};

function cn(
  ...classes: Array<
    string | undefined | null | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

export default function ChatActions({
  chatId,
  title = "Untitled conversation",
  isPinned = false,
  isArchived = false,
  disabled = false,
  className,
  onAction,
  onRename,
  onDelete,
  onExport,
  onShare,
  onArchive,
  onUnarchive,
  onPin,
  onUnpin,
  onNewChat,
}: ChatActionsProps) {
  const [isOpen, setIsOpen] =
    useState(false);

  const [isRenameOpen, setIsRenameOpen] =
    useState(false);

  const [isDeleteOpen, setIsDeleteOpen] =
    useState(false);

  const [draftTitle, setDraftTitle] =
    useState(title);

  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const executeAction = useCallback(
    async (
      action: ChatActionType,
      callback?: () => void | Promise<void>
    ) => {
      if (disabled || isLoading) {
        return;
      }

      try {
        setIsLoading(true);

        await callback?.();

        await onAction?.(action);

        closeMenu();
      } catch (error) {
        console.error(
          `Chat action failed: ${action}`,
          {
            chatId,
            error,
          }
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      chatId,
      closeMenu,
      disabled,
      isLoading,
      onAction,
    ]
  );

  const handleRename = async () => {
    const nextTitle =
      draftTitle.trim();

    if (
      !nextTitle ||
      disabled ||
      isLoading
    ) {
      return;
    }

    try {
      setIsLoading(true);

      await onRename?.(
        nextTitle
      );

      await onAction?.(
        "rename"
      );

      setIsRenameOpen(false);
      setIsOpen(false);
    } catch (error) {
      console.error(
        "Chat rename failed:",
        {
          chatId,
          error,
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);

      await onDelete?.();

      await onAction?.(
        "delete"
      );

      setIsDeleteOpen(false);
      setIsOpen(false);
    } catch (error) {
      console.error(
        "Chat delete failed:",
        {
          chatId,
          error,
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const menuItemClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800";

  return (
    <div
      className={cn(
        "relative",
        className
      )}
    >
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() =>
          setIsOpen(
            previous => !previous
          )
        }
        aria-label="Chat actions"
        aria-expanded={isOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="5"
            cy="12"
            r="1.5"
            fill="currentColor"
          />

          <circle
            cx="12"
            cy="12"
            r="1.5"
            fill="currentColor"
          />

          <circle
            cx="19"
            cy="12"
            r="1.5"
            fill="currentColor"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">
              {title}
            </p>

            {chatId && (
              <p className="mt-1 truncate font-mono text-[10px] text-zinc-400">
                {chatId}
              </p>
            )}
          </div>

          <div className="space-y-1 py-2">
            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() =>
                void executeAction(
                  "new",
                  onNewChat
                )
              }
              className={menuItemClass}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                +
              </span>

              <span>New chat</span>
            </button>

            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() => {
                setDraftTitle(title);
                setIsRenameOpen(true);
                setIsOpen(false);
              }}
              className={menuItemClass}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                ✎
              </span>

              <span>Rename</span>
            </button>

            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() =>
                void executeAction(
                  "share",
                  onShare
                )
              }
              className={menuItemClass}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                ↗
              </span>

              <span>Share</span>
            </button>

            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() =>
                void executeAction(
                  "export",
                  onExport
                )
              }
              className={menuItemClass}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                ↓
              </span>

              <span>Export</span>
            </button>
          </div>

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-1 py-1">
            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() =>
                void executeAction(
                  isPinned
                    ? "unpin"
                    : "pin",
                  isPinned
                    ? onUnpin
                    : onPin
                )
              }
              className={menuItemClass}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                {isPinned
                  ? "★"
                  : "☆"}
              </span>

              <span>
                {isPinned
                  ? "Unpin chat"
                  : "Pin chat"}
              </span>
            </button>

            <button
              type="button"
              disabled={disabled || isLoading}
              onClick={() =>
                void executeAction(
                  isArchived
                    ? "unarchive"
                    : "archive",
                  isArchived
                    ? onUnarchive
                    : onArchive
                )
              }
              className={menuItemClass}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                {isArchived
                  ? "↩"
                  : "□"}
              </span>

              <span>
                {isArchived
                  ? "Restore chat"
                  : "Archive chat"}
              </span>
            </button>
          </div>

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <button
            type="button"
            disabled={disabled || isLoading}
            onClick={() => {
              setIsDeleteOpen(true);
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              ×
            </span>

            <span>Delete chat</span>
          </button>
        </div>
      )}

      {isRenameOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Rename conversation
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Give this conversation a clear,
              recognizable name.
            </p>

            <input
              autoFocus
              value={draftTitle}
              disabled={isLoading}
              onChange={event =>
                setDraftTitle(
                  event.target.value
                )
              }
              onKeyDown={event => {
                if (
                  event.key === "Enter"
                ) {
                  void handleRename();
                }

                if (
                  event.key === "Escape"
                ) {
                  setIsRenameOpen(false);
                }
              }}
              className="mt-5 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  setIsRenameOpen(false)
                }
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  isLoading ||
                  !draftTitle.trim()
                }
                onClick={() =>
                  void handleRename()
                }
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-xl text-red-600 dark:text-red-400">
              !
            </div>

            <h2 className="mt-5 text-lg font-bold text-zinc-950 dark:text-white">
              Delete conversation?
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              This action permanently removes the
              conversation and cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  setIsDeleteOpen(false)
                }
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  void handleDelete()
                }
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading
                  ? "Deleting..."
                  : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}