"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export type ChatMessageRole =
  | "user"
  | "assistant"
  | "system"
  | "tool";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: React.ReactNode;
  createdAt?: string | Date;
  metadata?: React.ReactNode;
}

export interface ChatWindowRef {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToMessage: (
    messageId: string,
    behavior?: ScrollBehavior
  ) => void;
}

export interface ChatWindowProps {
  messages: ChatMessage[];

  loading?: boolean;
  typing?: boolean;

  autoScroll?: boolean;
  className?: string;

  emptyState?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;

  renderMessage?: (
    message: ChatMessage,
    index: number
  ) => React.ReactNode;

  onReachTop?: () => void;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function formatTime(value?: string | Date): string {
  if (!value) {
    return "";
  }

  const date =
    typeof value === "string"
      ? new Date(value)
      : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function DefaultEmptyState(): React.ReactNode {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted text-2xl">
        ✦
      </div>

      <h2 className="mt-5 text-lg font-semibold text-foreground">
        Start a conversation
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Ask a question, share an idea, upload a file, or start
        building something new.
      </p>
    </div>
  );
}

function TypingIndicator(): React.ReactNode {
  return (
    <div className="flex items-end gap-3 px-4 py-3 sm:px-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        AI
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

function DefaultMessage({
  message,
}: {
  message: ChatMessage;
}): React.ReactNode {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";

  const alignment = isUser
    ? "justify-end"
    : "justify-start";

  const bubbleClass = isUser
    ? "bg-primary text-primary-foreground"
    : isSystem
      ? "border-amber-500/20 bg-amber-500/10 text-foreground"
      : isTool
        ? "border-blue-500/20 bg-blue-500/10 text-foreground"
        : "border border-border bg-card text-foreground";

  const time = formatTime(message.createdAt);

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        "group flex w-full px-4 py-2 sm:px-6",
        alignment
      )}
    >
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]",
          isUser && "items-end"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
            bubbleClass,
            !isUser && "rounded-tl-md",
            isUser && "rounded-tr-md"
          )}
        >
          {message.content}
        </div>

        {message.metadata ? (
          <div className="px-1 text-xs text-muted-foreground">
            {message.metadata}
          </div>
        ) : null}

        {time ? (
          <span className="px-1 text-[11px] text-muted-foreground">
            {time}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export const ChatWindow = forwardRef<
  ChatWindowRef,
  ChatWindowProps
>(function ChatWindow(
  {
    messages,
    loading = false,
    typing = false,
    autoScroll = true,
    className,
    emptyState,
    header,
    footer,
    renderMessage,
    onReachTop,
    onScroll,
  },
  ref
) {
  const scrollContainerRef =
    useRef<HTMLDivElement | null>(null);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  const [isNearBottom, setIsNearBottom] =
    useState<boolean>(true);

  const [showScrollButton, setShowScrollButton] =
    useState<boolean>(false);

  const lastMessageId = useMemo(() => {
    return messages.length > 0
      ? messages[messages.length - 1]?.id
      : undefined;
  }, [messages]);

  const scrollToBottom = (
    behavior: ScrollBehavior = "smooth"
  ): void => {
    bottomRef.current?.scrollIntoView({
      behavior,
      block: "end",
    });
  };

  const scrollToMessage = (
    messageId: string,
    behavior: ScrollBehavior = "smooth"
  ): void => {
    const container =
      scrollContainerRef.current;

    if (!container) {
      return;
    }

    const target =
      container.querySelector<HTMLElement>(
        `#message-${CSS.escape(messageId)}`
      );

    target?.scrollIntoView({
      behavior,
      block: "center",
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom,
      scrollToMessage,
    }),
    []
  );

  useEffect(() => {
    if (!autoScroll || !isNearBottom) {
      return;
    }

    scrollToBottom("smooth");
  }, [
    lastMessageId,
    typing,
    loading,
    autoScroll,
    isNearBottom,
  ]);

  useEffect(() => {
    if (messages.length === 0) {
      setIsNearBottom(true);
      setShowScrollButton(false);
    }
  }, [messages.length]);

  const handleScroll = (
    event: React.UIEvent<HTMLDivElement>
  ): void => {
    const element = event.currentTarget;

    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    const nearBottom = distanceFromBottom < 120;

    setIsNearBottom(nearBottom);
    setShowScrollButton(
      !nearBottom && element.scrollHeight > element.clientHeight
    );

    if (element.scrollTop <= 20) {
      onReachTop?.();
    }

    onScroll?.(event);
  };

  return (
    <section
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background",
        className
      )}
    >
      {header ? (
        <div className="shrink-0 border-b border-border">
          {header}
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto scroll-smooth"
        aria-live="polite"
      >
        {messages.length === 0 && !loading
          ? emptyState ?? <DefaultEmptyState />
          : (
            <div className="mx-auto flex w-full max-w-5xl flex-col py-4">
              {messages.map((message, index) => (
                <React.Fragment key={message.id}>
                  {renderMessage
                    ? renderMessage(message, index)
                    : (
                      <DefaultMessage
                        message={message}
                      />
                    )}
                </React.Fragment>
              ))}

              {typing || loading ? (
                <TypingIndicator />
              ) : null}

              <div
                ref={bottomRef}
                className="h-px w-full"
                aria-hidden="true"
              />
            </div>
          )}
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-5 left-1/2 z-10 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-lg transition-transform hover:scale-105"
          aria-label="Scroll to latest message"
        >
          <span aria-hidden="true">↓</span>
          Latest
        </button>
      ) : null}

      {footer ? (
        <div className="shrink-0 border-t border-border">
          {footer}
        </div>
      ) : null}
    </section>
  );
});

ChatWindow.displayName = "ChatWindow";

export default ChatWindow;