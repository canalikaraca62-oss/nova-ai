"use client";

import React, {
  useEffect,
  useState,
} from "react";

import ChatActions, {
  type ChatActionType,
} from "./ChatActions";

export type ChatHeaderProps = {
  chatId?: string;

  title?: string;

  subtitle?: string;

  isPinned?: boolean;

  isArchived?: boolean;

  isLoading?: boolean;

  disabled?: boolean;

  className?: string;

  onBack?: () => void;

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

  onAction?: (
    action: ChatActionType
  ) => void | Promise<void>;

  onModelChange?: (
    model: string
  ) => void | Promise<void>;

  model?: string;

  availableModels?: string[];

  showModelSelector?: boolean;
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

export default function ChatHeader({
  chatId,
  title = "New conversation",
  subtitle,

  isPinned = false,
  isArchived = false,

  isLoading = false,
  disabled = false,

  className,

  onBack,

  onRename,
  onDelete,
  onExport,
  onShare,
  onArchive,
  onUnarchive,
  onPin,
  onUnpin,
  onNewChat,
  onAction,

  onModelChange,

  model = "auto",

  availableModels = [
    "auto",
    "gpt-4o",
    "gpt-4o-mini",
    "llama-3.3-70b-versatile",
  ],

  showModelSelector = true,
}: ChatHeaderProps) {
  const [
    selectedModel,
    setSelectedModel,
  ] = useState(model);

  const [
    isModelOpen,
    setIsModelOpen,
  ] = useState(false);

  useEffect(() => {
    setSelectedModel(model);
  }, [model]);

  const handleModelChange =
    async (
      nextModel: string
    ) => {
      if (
        disabled ||
        isLoading
      ) {
        return;
      }

      try {
        setSelectedModel(
          nextModel
        );

        setIsModelOpen(
          false
        );

        await onModelChange?.(
          nextModel
        );
      } catch (error) {
        console.error(
          "Model change failed:",
          error
        );

        setSelectedModel(
          model
        );
      }
    };

  return (
    <header
      className={cn(
        "relative z-20 flex min-h-[72px] w-full items-center justify-between gap-4 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-6",
        className
      )}
    >
      {/* LEFT */}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={
              disabled ||
              isLoading
            }
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m15 18-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-violet-500/20">
          S
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-bold text-zinc-950 dark:text-white sm:text-base">
              {title}
            </h1>

            {isPinned && (
              <span
                title="Pinned conversation"
                className="shrink-0 text-xs"
              >
                📌
              </span>
            )}

            {isArchived && (
              <span className="hidden shrink-0 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 sm:inline-flex">
                Archived
              </span>
            )}
          </div>

          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {subtitle}
            </p>
          ) : (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>

              <span className="text-[10px] font-medium text-zinc-500">
                {isLoading
                  ? "Thinking..."
                  : "Ready"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT */}

      <div className="flex shrink-0 items-center gap-2">
        {showModelSelector && (
          <div className="relative hidden sm:block">
            <button
              type="button"
              disabled={
                disabled ||
                isLoading
              }
              onClick={() =>
                setIsModelOpen(
                  previous =>
                    !previous
                )
              }
              className="flex h-10 max-w-[190px] items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-violet-500"
              >
                <path
                  d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>

              <span className="truncate">
                {selectedModel ===
                "auto"
                  ? "Auto"
                  : selectedModel}
              </span>

              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className={cn(
                  "ml-auto shrink-0 transition-transform",
                  isModelOpen &&
                    "rotate-180"
                )}
              >
                <path
                  d="m6 9 6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isModelOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                    AI Model
                  </p>
                </div>

                <div className="mt-1 space-y-1">
                  {availableModels.map(
                    item => {
                      const active =
                        item ===
                        selectedModel;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            void handleModelChange(
                              item
                            )
                          }
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                            active
                              ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          )}
                        >
                          <span>
                            {item ===
                            "auto"
                              ? "Auto select"
                              : item}
                          </span>

                          {active && (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="m5 12 4 4L19 6"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={
            disabled ||
            isLoading
          }
          onClick={() =>
            void onShare?.()
          }
          aria-label="Share conversation"
          className="hidden h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 8a3 3 0 1 0-2.82-4A3 3 0 0 0 18 8ZM6 15a3 3 0 1 0 2.82 4A3 3 0 0 0 6 15Zm12 1a3 3 0 1 0-2.82 4A3 3 0 0 0 18 16Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />

            <path
              d="m8.7 16.5 6.6 3M15.3 4.5l-6.6 3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <ChatActions
          chatId={chatId}
          title={title}
          isPinned={isPinned}
          isArchived={isArchived}
          disabled={
            disabled ||
            isLoading
          }
          onAction={onAction}
          onRename={onRename}
          onDelete={onDelete}
          onExport={onExport}
          onShare={onShare}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onPin={onPin}
          onUnpin={onUnpin}
          onNewChat={onNewChat}
        />
      </div>
    </header>
  );
}