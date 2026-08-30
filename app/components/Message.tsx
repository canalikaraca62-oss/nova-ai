"use client";

import React from "react";

export type MessageRole =
  | "user"
  | "assistant"
  | "system";

export interface MessageAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface MessageProps {
  id?: string;

  role: MessageRole;

  content: React.ReactNode;

  avatar?: React.ReactNode;

  name?: string;

  timestamp?: React.ReactNode;

  actions?: MessageAction[];

  isLoading?: boolean;

  className?: string;

  contentClassName?: string;

  children?: React.ReactNode;
}

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes.filter(Boolean).join(" ");
}

function DefaultAvatar({
  role,
}: {
  role: MessageRole;
}): React.ReactElement {
  const label =
    role === "user"
      ? "U"
      : role === "assistant"
        ? "AI"
        : "S";

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center",
        "rounded-xl text-xs font-semibold",
        role === "user" &&
          "bg-primary text-primary-foreground",
        role === "assistant" &&
          "bg-muted text-foreground",
        role === "system" &&
          "bg-muted text-muted-foreground"
      )}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

function LoadingDots(): React.ReactElement {
  return (
    <div
      className="flex items-center gap-1 py-1"
      aria-label="Generating response"
      role="status"
    >
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  );
}

function MessageActions({
  actions,
}: {
  actions: MessageAction[];
}): React.ReactElement {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5",
            "text-xs font-medium text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-primary/30",
            action.disabled &&
              "cursor-not-allowed opacity-50"
          )}
          aria-label={action.label}
        >
          {action.icon ? (
            <span
              className="flex h-4 w-4 items-center justify-center"
              aria-hidden="true"
            >
              {action.icon}
            </span>
          ) : null}

          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Message({
  id,
  role,
  content,
  avatar,
  name,
  timestamp,
  actions = [],
  isLoading = false,
  className,
  contentClassName,
  children,
}: MessageProps): React.ReactElement {
  const isUser = role === "user";

  const defaultName =
    role === "user"
      ? "You"
      : role === "assistant"
        ? "SYRAVEN"
        : "System";

  return (
    <article
      id={id}
      className={cn(
        "group flex w-full gap-3 sm:gap-4",
        isUser && "flex-row-reverse",
        className
      )}
      data-role={role}
    >
      <div className="shrink-0">
        {avatar ?? (
          <DefaultAvatar role={role} />
        )}
      </div>

      <div
        className={cn(
          "min-w-0 max-w-[85%] flex-1",
          isUser && "flex flex-col items-end"
        )}
      >
        <div
          className={cn(
            "mb-1 flex items-center gap-2",
            isUser && "flex-row-reverse"
          )}
        >
          <span className="text-sm font-semibold text-foreground">
            {name ?? defaultName}
          </span>

          {timestamp ? (
            <span className="text-xs text-muted-foreground">
              {timestamp}
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "w-fit max-w-full rounded-2xl px-4 py-3",
            role === "user"
              ? "bg-primary text-primary-foreground"
              : role === "assistant"
                ? "bg-muted/50 text-foreground"
                : "border border-border bg-background text-muted-foreground",
            contentClassName
          )}
        >
          {isLoading ? (
            <LoadingDots />
          ) : (
            <div className="break-words text-sm leading-6">
              {content}
            </div>
          )}

          {children ? (
            <div className="mt-3">
              {children}
            </div>
          ) : null}
        </div>

        {!isLoading && actions.length > 0 ? (
          <MessageActions
            actions={actions}
          />
        ) : null}
      </div>
    </article>
  );
}

export interface MessageGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function MessageGroup({
  children,
  className,
}: MessageGroupProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MessageSkeleton({
  role = "assistant",
  className,
}: {
  role?: MessageRole;
  className?: string;
}): React.ReactElement {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full animate-pulse gap-3 sm:gap-4",
        isUser && "flex-row-reverse",
        className
      )}
    >
      <div className="h-9 w-9 shrink-0 rounded-xl bg-muted" />

      <div
        className={cn(
          "max-w-[75%] flex-1",
          isUser && "flex flex-col items-end"
        )}
      >
        <div
          className={cn(
            "mb-2 h-3 w-20 rounded bg-muted",
            isUser && "self-end"
          )}
        />

        <div className="space-y-2 rounded-2xl bg-muted/50 p-4">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}