"use client";

import { useEffect, useRef } from "react";
import Message from "./Message";

type Attachment = {
  name: string;
  url: string;
  type: string;
};

type MessageType = {
  sender: "user" | "qelvora";
  text: string;
  attachment?: Attachment | null;
};

type ChatWindowProps = {
  messages: MessageType[];
  isLoading: boolean;
  isStreaming: boolean;
};

export default function ChatWindow({
  messages,
  isLoading,
  isStreaming,
}: ChatWindowProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const shouldAutoScrollRef =
    useRef(true);

  const animationFrameRef =
    useRef<number | null>(null);

  function handleScroll() {
    const container =
      containerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    shouldAutoScrollRef.current =
      distanceFromBottom < 150;
  }

  function scrollToBottom() {
    const container =
      containerRef.current;

    if (!container) return;

    if (!shouldAutoScrollRef.current) {
      return;
    }

    if (
      animationFrameRef.current !== null
    ) {
      cancelAnimationFrame(
        animationFrameRef.current
      );
    }

    animationFrameRef.current =
      requestAnimationFrame(() => {
        const current =
          containerRef.current;

        if (!current) return;

        current.scrollTop =
          current.scrollHeight;

        animationFrameRef.current =
          null;
      });
  }

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    if (distanceFromBottom < 300) {
      shouldAutoScrollRef.current = true;
    }

    if (isStreaming) {
      shouldAutoScrollRef.current = true;
    }

    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    if (
      !isStreaming &&
      messages.length > 0
    ) {
      shouldAutoScrollRef.current = true;

      requestAnimationFrame(() => {
        const container =
          containerRef.current;

        if (!container) return;

        container.scrollTop =
          container.scrollHeight;
      });
    }
  }, [isStreaming, messages.length]);

  useEffect(() => {
    return () => {
      if (
        animationFrameRef.current !== null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="
        min-h-0
        min-w-0
        flex-1
        w-full
        overflow-y-auto
        overflow-x-hidden
        overscroll-contain
        touch-pan-y
        px-3
        py-3
        sm:px-5
        sm:py-5
        [scrollbar-width:thin]
      "
    >
      <div
        className="
          w-full
          max-w-4xl
          mx-auto
          rounded-xl
          bg-zinc-900
          p-3
          sm:p-5
          lg:p-6
          min-h-full
        "
      >
        {messages.map(
          (msg, index) => (
            <Message
              key={index}
              sender={msg.sender}
              text={msg.text}
              attachment={
                msg.attachment
              }
            />
          )
        )}

        {isLoading && (
          <div className="flex justify-start mt-4">
            <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-white">
              <span className="inline-flex items-center gap-1">
                <span>
                  QELVORA yazıyor
                </span>

                <span className="animate-pulse">
                  ...
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}