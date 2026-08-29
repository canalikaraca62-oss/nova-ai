"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface ChatInputAttachment {
  id: string;
  name: string;
  size?: number;
  type?: string;
  file?: File;
}

export interface ChatInputRef {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

export interface ChatInputProps {
  value?: string;
  defaultValue?: string;

  placeholder?: string;

  disabled?: boolean;
  loading?: boolean;

  autoFocus?: boolean;

  maxLength?: number;
  minRows?: number;
  maxRows?: number;

  showCharacterCount?: boolean;

  attachments?: ChatInputAttachment[];

  onChange?: (value: string) => void;
  onSubmit?: (
    value: string,
    attachments: ChatInputAttachment[]
  ) => void | Promise<void>;

  onAttachmentAdd?: (files: File[]) => void;
  onAttachmentRemove?: (attachmentId: string) => void;

  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;

  className?: string;
  textareaClassName?: string;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  function ChatInput(
    {
      value,
      defaultValue = "",
      placeholder = "Message...",
      disabled = false,
      loading = false,
      autoFocus = false,
      maxLength,
      minRows = 1,
      maxRows = 6,
      showCharacterCount = false,
      attachments = [],
      onChange,
      onSubmit,
      onAttachmentAdd,
      onAttachmentRemove,
      leftActions,
      rightActions,
      className,
      textareaClassName,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [internalValue, setInternalValue] =
      useState<string>(defaultValue);

    const [submitting, setSubmitting] =
      useState<boolean>(false);

    const isControlled = value !== undefined;

    const currentValue = isControlled
      ? value
      : internalValue;

    const isBusy =
      disabled || loading || submitting;

    const setCurrentValue = (nextValue: string): void => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }

      onChange?.(nextValue);
    };

    const resizeTextarea = (): void => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      textarea.style.height = "auto";

      const computedStyle =
        window.getComputedStyle(textarea);

      const lineHeight =
        Number.parseFloat(computedStyle.lineHeight) || 24;

      const maxHeight =
        lineHeight * Math.max(maxRows, minRows);

      const nextHeight = Math.min(
        textarea.scrollHeight,
        maxHeight
      );

      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY =
        textarea.scrollHeight > maxHeight
          ? "auto"
          : "hidden";
    };

    useEffect(() => {
      resizeTextarea();
    }, [currentValue, minRows, maxRows]);

    useEffect(() => {
      if (autoFocus) {
        textareaRef.current?.focus();
      }
    }, [autoFocus]);

    useImperativeHandle(
      ref,
      () => ({
        focus: (): void => {
          textareaRef.current?.focus();
        },

        clear: (): void => {
          setCurrentValue("");
        },

        getValue: (): string => {
          return currentValue;
        },

        setValue: (nextValue: string): void => {
          setCurrentValue(nextValue);
        },
      }),
      [currentValue]
    );

    const handleChange = (
      event: React.ChangeEvent<HTMLTextAreaElement>
    ): void => {
      const nextValue = event.target.value;

      if (
        maxLength !== undefined &&
        nextValue.length > maxLength
      ) {
        return;
      }

      setCurrentValue(nextValue);
    };

    const handleSubmit = async (): Promise<void> => {
      const message = currentValue.trim();

      if (
        isBusy ||
        (!message && attachments.length === 0)
      ) {
        return;
      }

      if (!onSubmit) {
        return;
      }

      try {
        setSubmitting(true);

        await onSubmit(
          message,
          attachments
        );

        if (!isControlled) {
          setInternalValue("");
        }

        onChange?.("");
      } finally {
        setSubmitting(false);
      }
    };

    const handleKeyDown = (
      event: React.KeyboardEvent<HTMLTextAreaElement>
    ): void => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        void handleSubmit();
      }
    };

    const handleFileChange = (
      event: React.ChangeEvent<HTMLInputElement>
    ): void => {
      const files = Array.from(
        event.target.files ?? []
      );

      if (files.length > 0) {
        onAttachmentAdd?.(files);
      }

      event.target.value = "";
    };

    const handleRemoveAttachment = (
      attachmentId: string
    ): void => {
      onAttachmentRemove?.(attachmentId);
    };

    const canSubmit =
      !isBusy &&
      (currentValue.trim().length > 0 ||
        attachments.length > 0);

    return (
      <div
        className={cn(
          "w-full",
          className
        )}
      >
        {attachments.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {attachment.name}
                  </p>

                  {attachment.size ? (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(
                        attachment.size
                      )}
                    </p>
                  ) : null}
                </div>

                {onAttachmentRemove ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveAttachment(
                        attachment.id
                      )
                    }
                    disabled={isBusy}
                    aria-label={`Remove ${attachment.name}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          {leftActions ? (
            <div className="flex shrink-0 items-center gap-1">
              {leftActions}
            </div>
          ) : null}

          {onAttachmentAdd ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={isBusy}
              />

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={isBusy}
                aria-label="Add attachment"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </>
          ) : null}

          <textarea
            ref={textareaRef}
            value={currentValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isBusy}
            rows={minRows}
            maxLength={maxLength}
            aria-label={placeholder}
            className={cn(
              "max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50",
              textareaClassName
            )}
          />

          {rightActions ? (
            <div className="flex shrink-0 items-center gap-1">
              {rightActions}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
            aria-label="Send message"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "transition-all duration-200",
              canSubmit
                ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            {submitting || loading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-label="Sending"
              />
            ) : (
              <span
                className="text-lg leading-none"
                aria-hidden="true"
              >
                ↑
              </span>
            )}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            Enter to send · Shift + Enter for new line
          </p>

          {showCharacterCount &&
          maxLength !== undefined ? (
            <span
              className={cn(
                "text-xs tabular-nums",
                currentValue.length >= maxLength
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {currentValue.length}/{maxLength}
            </span>
          ) : null}
        </div>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";

export default ChatInput;