"use client";

import React, {
  useEffect,
  useState,
} from "react";

export type FeedbackValue =
  | "like"
  | "dislike"
  | null;

export type FeedbackReason =
  | "helpful"
  | "accurate"
  | "clear"
  | "creative"
  | "incorrect"
  | "not-helpful"
  | "unsafe"
  | "slow"
  | "other";

export type MessageFeedbackProps = {
  messageId?: string;

  value?: FeedbackValue;

  disabled?: boolean;

  isLoading?: boolean;

  className?: string;

  allowComment?: boolean;

  onChange?: (
    value: FeedbackValue,
    reason?: FeedbackReason,
    comment?: string
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

const POSITIVE_REASONS: Array<{
  value: FeedbackReason;
  label: string;
}> = [
  {
    value: "helpful",
    label: "Helpful",
  },
  {
    value: "accurate",
    label: "Accurate",
  },
  {
    value: "clear",
    label: "Clear",
  },
  {
    value: "creative",
    label: "Creative",
  },
];

const NEGATIVE_REASONS: Array<{
  value: FeedbackReason;
  label: string;
}> = [
  {
    value: "incorrect",
    label: "Incorrect",
  },
  {
    value: "not-helpful",
    label: "Not helpful",
  },
  {
    value: "unsafe",
    label: "Unsafe",
  },
  {
    value: "slow",
    label: "Poor quality",
  },
  {
    value: "other",
    label: "Other",
  },
];

export default function MessageFeedback({
  messageId,
  value = null,
  disabled = false,
  isLoading = false,
  className,
  allowComment = true,
  onChange,
}: MessageFeedbackProps) {
  const [feedback, setFeedback] =
    useState<FeedbackValue>(value);

  const [reason, setReason] =
    useState<FeedbackReason>();

  const [comment, setComment] =
    useState("");

  const [isExpanded, setIsExpanded] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const busy =
    disabled ||
    isLoading ||
    isSubmitting;

  useEffect(() => {
    setFeedback(value);
  }, [value]);

  const handleFeedback = (
    nextValue: Exclude<
      FeedbackValue,
      null
    >
  ) => {
    if (busy) {
      return;
    }

    if (feedback === nextValue) {
      setFeedback(null);
      setReason(undefined);
      setComment("");
      setIsExpanded(false);

      void onChange?.(null);

      return;
    }

    setFeedback(nextValue);
    setReason(undefined);
    setComment("");
    setSubmitted(false);
    setIsExpanded(true);
  };

  const handleSubmit = async () => {
    if (!feedback || busy) {
      return;
    }

    const previousFeedback =
      feedback;

    try {
      setIsSubmitting(true);

      await onChange?.(
        feedback,
        reason,
        comment.trim() || undefined
      );

      setSubmitted(true);
      setIsExpanded(false);
    } catch (error) {
      console.error(
        "Message feedback submission failed:",
        {
          messageId,
          error,
        }
      );

      setFeedback(
        previousFeedback
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (busy) {
      return;
    }

    setIsExpanded(false);
    setReason(undefined);
    setComment("");
  };

  const reasons =
    feedback === "like"
      ? POSITIVE_REASONS
      : NEGATIVE_REASONS;

  return (
    <div
      className={cn(
        "w-full",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs text-zinc-400">
          Was this helpful?
        </span>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            handleFeedback("like")
          }
          aria-label="Good response"
          title="Good response"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border transition",
            "disabled:cursor-not-allowed disabled:opacity-50",
            feedback === "like"
              ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
              : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          )}
        >
          <svg
            width="15"
            height="15"
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
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            handleFeedback("dislike")
          }
          aria-label="Bad response"
          title="Bad response"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border transition",
            "disabled:cursor-not-allowed disabled:opacity-50",
            feedback === "dislike"
              ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          )}
        >
          <svg
            width="15"
            height="15"
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
        </button>

        {submitted && (
          <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Thanks for your feedback
          </span>
        )}
      </div>

      {isExpanded &&
        feedback && (
          <div className="mt-3 max-w-xl rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {feedback === "like"
                  ? "What was good?"
                  : "What could be improved?"}
              </h4>

              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Your feedback helps improve
                future responses.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {reasons.map(item => (
                <button
                  key={item.value}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setReason(
                      previous =>
                        previous ===
                        item.value
                          ? undefined
                          : item.value
                    )
                  }
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium transition",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    reason === item.value
                      ? feedback === "like"
                        ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {allowComment && (
              <textarea
                value={comment}
                disabled={busy}
                onChange={event =>
                  setComment(
                    event.target.value
                  )
                }
                placeholder="Add an optional comment..."
                rows={3}
                maxLength={1000}
                className="mt-4 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={handleCancel}
                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void handleSubmit()
                }
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950"
              >
                {isSubmitting
                  ? "Sending..."
                  : "Send feedback"}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}