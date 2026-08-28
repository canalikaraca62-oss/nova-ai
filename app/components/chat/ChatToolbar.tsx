"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

export type ChatToolbarAction =
  | "new"
  | "search"
  | "settings"
  | "share"
  | "export"
  | "clear"
  | "toggle-web-search"
  | "toggle-memory"
  | "toggle-streaming"
  | "change-model";

export type ChatToolbarProps = {
  disabled?: boolean;

  isLoading?: boolean;

  className?: string;

  model?: string;

  availableModels?: string[];

  webSearchEnabled?: boolean;

  memoryEnabled?: boolean;

  streamingEnabled?: boolean;

  showNewChat?: boolean;

  showSearch?: boolean;

  showSettings?: boolean;

  showShare?: boolean;

  showExport?: boolean;

  showClear?: boolean;

  onNewChat?: () => void | Promise<void>;

  onSearch?: () => void | Promise<void>;

  onSettings?: () => void | Promise<void>;

  onShare?: () => void | Promise<void>;

  onExport?: () => void | Promise<void>;

  onClear?: () => void | Promise<void>;

  onModelChange?: (
    model: string
  ) => void | Promise<void>;

  onWebSearchChange?: (
    enabled: boolean
  ) => void | Promise<void>;

  onMemoryChange?: (
    enabled: boolean
  ) => void | Promise<void>;

  onStreamingChange?: (
    enabled: boolean
  ) => void | Promise<void>;

  onAction?: (
    action: ChatToolbarAction
  ) => void | Promise<void>;
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

type ToolbarButtonProps = {
  label: string;

  active?: boolean;

  disabled?: boolean;

  onClick?: () => void;

  children: React.ReactNode;

  danger?: boolean;
};

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
  danger = false,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : danger
            ? "border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-500/10"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export default function ChatToolbar({
  disabled = false,
  isLoading = false,
  className,

  model = "auto",

  availableModels = [
    "auto",
    "gpt-4o",
    "gpt-4o-mini",
    "llama-3.3-70b-versatile",
  ],

  webSearchEnabled = false,
  memoryEnabled = true,
  streamingEnabled = true,

  showNewChat = true,
  showSearch = true,
  showSettings = true,
  showShare = true,
  showExport = true,
  showClear = true,

  onNewChat,
  onSearch,
  onSettings,
  onShare,
  onExport,
  onClear,

  onModelChange,
  onWebSearchChange,
  onMemoryChange,
  onStreamingChange,

  onAction,
}: ChatToolbarProps) {
  const [selectedModel, setSelectedModel] =
    useState(model);

  const [webSearch, setWebSearch] =
    useState(webSearchEnabled);

  const [memory, setMemory] =
    useState(memoryEnabled);

  const [streaming, setStreaming] =
    useState(streamingEnabled);

  const [isModelOpen, setIsModelOpen] =
    useState(false);

  const [isMoreOpen, setIsMoreOpen] =
    useState(false);

  const [isWorking, setIsWorking] =
    useState(false);

  const modelMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const moreMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const busy =
    disabled ||
    isLoading ||
    isWorking;

  useEffect(() => {
    setSelectedModel(model);
  }, [model]);

  useEffect(() => {
    setWebSearch(
      webSearchEnabled
    );
  }, [webSearchEnabled]);

  useEffect(() => {
    setMemory(
      memoryEnabled
    );
  }, [memoryEnabled]);

  useEffect(() => {
    setStreaming(
      streamingEnabled
    );
  }, [streamingEnabled]);

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(
          target
        )
      ) {
        setIsModelOpen(false);
      }

      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(
          target
        )
      ) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, []);

  const runAction = async (
    action: ChatToolbarAction,
    callback?: () => void | Promise<void>
  ) => {
    if (busy) {
      return;
    }

    try {
      setIsWorking(true);

      await callback?.();

      await onAction?.(
        action
      );
    } catch (error) {
      console.error(
        `Chat toolbar action failed: ${action}`,
        error
      );
    } finally {
      setIsWorking(false);
    }
  };

  const changeModel = async (
    nextModel: string
  ) => {
    if (busy) {
      return;
    }

    const previousModel =
      selectedModel;

    try {
      setSelectedModel(
        nextModel
      );

      setIsModelOpen(false);

      setIsWorking(true);

      await onModelChange?.(
        nextModel
      );

      await onAction?.(
        "change-model"
      );
    } catch (error) {
      console.error(
        "Chat model change failed:",
        error
      );

      setSelectedModel(
        previousModel
      );
    } finally {
      setIsWorking(false);
    }
  };

  const toggleWebSearch =
    async () => {
      if (busy) {
        return;
      }

      const nextValue =
        !webSearch;

      try {
        setWebSearch(
          nextValue
        );

        setIsWorking(true);

        await onWebSearchChange?.(
          nextValue
        );

        await onAction?.(
          "toggle-web-search"
        );
      } catch (error) {
        console.error(
          "Web search toggle failed:",
          error
        );

        setWebSearch(
          !nextValue
        );
      } finally {
        setIsWorking(false);
      }
    };

  const toggleMemory =
    async () => {
      if (busy) {
        return;
      }

      const nextValue =
        !memory;

      try {
        setMemory(
          nextValue
        );

        setIsWorking(true);

        await onMemoryChange?.(
          nextValue
        );

        await onAction?.(
          "toggle-memory"
        );
      } catch (error) {
        console.error(
          "Memory toggle failed:",
          error
        );

        setMemory(
          !nextValue
        );
      } finally {
        setIsWorking(false);
      }
    };

  const toggleStreaming =
    async () => {
      if (busy) {
        return;
      }

      const nextValue =
        !streaming;

      try {
        setStreaming(
          nextValue
        );

        setIsWorking(true);

        await onStreamingChange?.(
          nextValue
        );

        await onAction?.(
          "toggle-streaming"
        );
      } catch (error) {
        console.error(
          "Streaming toggle failed:",
          error
        );

        setStreaming(
          !nextValue
        );
      } finally {
        setIsWorking(false);
      }
    };

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90",
        className
      )}
    >
      {/* LEFT */}

      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
        {showNewChat && (
          <ToolbarButton
            label="New chat"
            disabled={busy}
            onClick={() =>
              void runAction(
                "new",
                onNewChat
              )
            }
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <span className="hidden md:inline">
              New
            </span>
          </ToolbarButton>
        )}

        {showSearch && (
          <ToolbarButton
            label="Search conversations"
            disabled={busy}
            onClick={() =>
              void runAction(
                "search",
                onSearch
              )
            }
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="11"
                cy="11"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
              />

              <path
                d="m16 16 4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <span className="hidden md:inline">
              Search
            </span>
          </ToolbarButton>
        )}

        <div
          ref={modelMenuRef}
          className="relative"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setIsModelOpen(
                previous => !previous
              )
            }
            className="flex h-10 max-w-[190px] items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <svg
              width="16"
              height="16"
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
              {selectedModel === "auto"
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
                "shrink-0 transition-transform",
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
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
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
                        disabled={busy}
                        onClick={() =>
                          void changeModel(
                            item
                          )
                        }
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        )}
                      >
                        <span>
                          {item === "auto"
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

        <ToolbarButton
          label="Toggle web search"
          active={webSearch}
          disabled={busy}
          onClick={() =>
            void toggleWebSearch()
          }
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="1.8"
            />

            <path
              d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          <span className="hidden lg:inline">
            Web
          </span>
        </ToolbarButton>
      </div>

      {/* RIGHT */}

      <div className="flex shrink-0 items-center gap-2">
        {showSettings && (
          <ToolbarButton
            label="Chat settings"
            disabled={busy}
            onClick={() =>
              void runAction(
                "settings",
                onSettings
              )
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />

              <path
                d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.08h-3v-.08A1.7 1.7 0 0 0 10.66 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.04a1.7 1.7 0 0 0-1.56-1.04h-.08v-3h.08A1.7 1.7 0 0 0 7 9.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.72 5.9l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.74v-.08h3v.08A1.7 1.7 0 0 0 15.74 6.3a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.04h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </ToolbarButton>
        )}

        <div
          ref={moreMenuRef}
          className="relative"
        >
          <ToolbarButton
            label="More options"
            disabled={busy}
            onClick={() =>
              setIsMoreOpen(
                previous => !previous
              )
            }
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
          </ToolbarButton>

          {isMoreOpen && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                  Conversation controls
                </p>
              </div>

              <div className="space-y-1 py-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void toggleMemory()
                  }
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
                      🧠
                    </span>

                    <span>
                      Conversation memory
                    </span>
                  </span>

                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      memory
                        ? "bg-emerald-500"
                        : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  />
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void toggleStreaming()
                  }
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
                      ⚡
                    </span>

                    <span>
                      Stream responses
                    </span>
                  </span>

                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      streaming
                        ? "bg-emerald-500"
                        : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  />
                </button>
              </div>

              {(showShare ||
                showExport ||
                showClear) && (
                <div className="border-t border-zinc-100 py-2 dark:border-zinc-800">
                  {showShare && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setIsMoreOpen(false);

                        void runAction(
                          "share",
                          onShare
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <span>↗</span>

                      <span>
                        Share conversation
                      </span>
                    </button>
                  )}

                  {showExport && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setIsMoreOpen(false);

                        void runAction(
                          "export",
                          onExport
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <span>↓</span>

                      <span>
                        Export conversation
                      </span>
                    </button>
                  )}

                  {showClear && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setIsMoreOpen(false);

                        void runAction(
                          "clear",
                          onClear
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <span>×</span>

                      <span>
                        Clear conversation
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}