"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

export type MessageReaction =
  | "like"
  | "dislike"
  | null;

export type MessageAction =
  | "copy"
  | "retry"
  | "edit"
  | "share"
  | "delete"
  | "like"
  | "dislike";

export type MessageActionsProps = {
  messageId?: string;

  content?: string;

  isUser?: boolean;

  isLoading?: boolean;

  disabled?: boolean;

  className?: string;

  reaction?: MessageReaction;

  showCopy?: boolean;

  showRetry?: boolean;

  showEdit?: boolean;

  showShare?: boolean;

  showDelete?: boolean;

  showFeedback?: boolean;

  onCopy?: (
    content: string
  ) => void | Promise<void>;

  onRetry?: () => void | Promise<void>;

  onEdit?: () => void | Promise<void>;

  onShare?: () => void | Promise<void>;

  onDelete?: () => void | Promise<void>;

  onReactionChange?: (
    reaction: MessageReaction
  ) => void | Promise<void>;

  onAction?: (
    action: MessageAction,
    messageId?: string
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

type ActionButtonProps = {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

function ActionButton({
  label,
  active = false,
  danger = false,
  disabled = false,
  onClick,
  children,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : danger
            ? "border-red-200 bg-white text-red-500 hover:bg-red-50 dark:border-red-500/20 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-500/10"
            : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export default function MessageActions({
  messageId,
  content = "",
  isUser = false,
  isLoading = false,
  disabled = false,
  className,

  reaction = null,

  showCopy = true,
  showRetry = true,
  showEdit = true,
  showShare = true,
  showDelete = true,
  showFeedback = true,

  onCopy,
  onRetry,
  onEdit,
  onShare,
  onDelete,
  onReactionChange,
  onAction,
}: MessageActionsProps) {
  const [currentReaction, setCurrentReaction] =
    useState<MessageReaction>(
      reaction
    );

  const [copied, setCopied] =
    useState(false);

  const [isWorking, setIsWorking] =
    useState(false);

  const [isMoreOpen, setIsMoreOpen] =
    useState(false);

  const moreMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const busy =
    disabled ||
    isLoading ||
    isWorking;

  useEffect(() => {
    setCurrentReaction(
      reaction
    );
  }, [reaction]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        setCopied(false);
      }, 1800);

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [copied]);

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

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
    action: MessageAction,
    callback?: () => void | Promise<void>
  ) => {
    if (busy) {
      return;
    }

    try {
      setIsWorking(true);

      await callback?.();

      await onAction?.(
        action,
        messageId
      );
    } catch (error) {
      console.error(
        `Message action failed: ${action}`,
        error
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    if (busy) {
      return;
    }

    try {
      setIsWorking(true);

      if (onCopy) {
        await onCopy(content);
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          content
        );
      }

      setCopied(true);

      await onAction?.(
        "copy",
        messageId
      );
    } catch (error) {
      console.error(
        "Message copy failed:",
        error
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleReaction = async (
    nextReaction: Exclude<
      MessageReaction,
      null
    >
  ) => {
    if (busy) {
      return;
    }

    const previousReaction =
      currentReaction;

    const resolvedReaction =
      previousReaction === nextReaction
        ? null
        : nextReaction;

    try {
      setCurrentReaction(
        resolvedReaction
      );

      setIsWorking(true);

      await onReactionChange?.(
        resolvedReaction
      );

      await onAction?.(
        nextReaction,
        messageId
      );
    } catch (error) {
      console.error(
        "Message reaction failed:",
        error
      );

      setCurrentReaction(
        previousReaction
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        className
      )}
    >
      {showCopy && (
        <ActionButton
          label={
            copied
              ? "Copied"
              : "Copy message"
          }
          disabled={busy}
          onClick={() =>
            void handleCopy()
          }
        >
          {copied ? (
            <svg
              width="17"
              height="17"
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
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="9"
                y="9"
                width="10"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />

              <path
                d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </ActionButton>
      )}

      {!isUser &&
        showRetry && (
          <ActionButton
            label="Regenerate response"
            disabled={busy}
            onClick={() =>
              void runAction(
                "retry",
                onRetry
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
                d="M20 11a8 8 0 1 0 1 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />

              <path
                d="M20 4v7h-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ActionButton>
        )}

      {!isUser &&
        showFeedback && (
          <>
            <ActionButton
              label="Good response"
              active={
                currentReaction ===
                "like"
              }
              disabled={busy}
              onClick={() =>
                void handleReaction(
                  "like"
                )
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3Zm0 10 4.5 1c2.2.5 4.5-1 4.5-3.3V13h3a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-5l.8-3.2A2.2 2.2 0 0 0 12.7 2L7 10Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </ActionButton>

            <ActionButton
              label="Bad response"
              active={
                currentReaction ===
                "dislike"
              }
              disabled={busy}
              onClick={() =>
                void handleReaction(
                  "dislike"
                )
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M17 14V4h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3Zm0-10-4.5-1C10.3 2.5 8 4 8 6.3V11H5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h5l-.8 3.2A2.2 2.2 0 0 0 11.3 22L17 14Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </ActionButton>
          </>
        )}

      <div
        ref={moreMenuRef}
        className="relative"
      >
        <ActionButton
          label="More message actions"
          disabled={busy}
          onClick={() =>
            setIsMoreOpen(
              previous => !previous
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
        </ActionButton>

        {isMoreOpen && (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            {isUser &&
              showEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setIsMoreOpen(false);

                    void runAction(
                      "edit",
                      onEdit
                    );
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m14 4 6 6L9 21H3v-6L14 4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="m12.5 5.5 6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>

                  Edit message
                </button>
              )}

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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 16V3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="m7 8 5-5 5 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M5 13v6h14v-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                Share message
              </button>
            )}

            {showDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setIsMoreOpen(false);

                  void runAction(
                    "delete",
                    onDelete
                  );
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M10 11v5M14 11v5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M6 7l1 13h10l1-13"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M9 7V4h6v3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                Delete message
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}