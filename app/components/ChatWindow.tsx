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
};

export default function ChatWindow({
  messages,
  isLoading,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const shouldAutoScrollRef = useRef(true);

  function handleScroll() {
    const container = scrollRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    shouldAutoScrollRef.current =
      distanceFromBottom < 120;
  }

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isLoading]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="
        relative
        flex-1
        min-h-0
        w-full
        max-w-5xl
        mx-auto
        mb-4
        sm:mb-6
        overflow-y-auto
        overflow-x-hidden
        rounded-2xl
        border
        border-white/10
        bg-zinc-950/80
        shadow-[0_20px_80px_rgba(0,0,0,0.35)]
        backdrop-blur-xl
        scrollbar-thin
        scrollbar-track-transparent
        scrollbar-thumb-zinc-700
      "
    >
      {/* Üst glow */}
      <div className="pointer-events-none sticky top-0 z-10 h-0">
        <div className="absolute left-1/2 top-0 h-32 w-2/3 -translate-x-1/2 rounded-full bg-blue-500/[0.04] blur-3xl" />
      </div>

      {/* CONTENT */}
      <div
        className="
          min-h-full
          px-3
          py-5
          sm:px-6
          sm:py-7
          lg:px-8
          lg:py-8
        "
      >
        {/* EMPTY STATE */}
        {messages.length === 0 && !isLoading && (
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-2xl px-4 text-center">
              <div
                className="
                  mx-auto
                  mb-6
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  text-2xl
                  shadow-[0_0_40px_rgba(59,130,246,0.08)]
                "
              >
                ✦
              </div>

              <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-600">
                QELVORA INTELLIGENCE
              </p>

              <h2
                className="
                  mt-3
                  text-2xl
                  font-semibold
                  tracking-tight
                  text-zinc-200
                  sm:text-3xl
                "
              >
                What are you building today?
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500 sm:text-base">
                Ask questions, analyze documents, write code,
                explore ideas and work with QELVORA.
              </p>
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {messages.length > 0 && (
          <div className="mx-auto w-full max-w-4xl space-y-5 sm:space-y-7">
            {messages.map((msg, index) => (
              <Message
                key={`${msg.sender}-${index}`}
                sender={msg.sender}
                text={msg.text}
                attachment={msg.attachment}
              />
            ))}

            {/* STREAMING INDICATOR */}
            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="
                    inline-flex
                    items-center
                    gap-3
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/[0.04]
                    px-4
                    py-3
                    text-sm
                    text-zinc-400
                    shadow-[0_8px_30px_rgba(0,0,0,0.2)]
                    backdrop-blur-md
                  "
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="
                        h-1.5
                        w-1.5
                        animate-bounce
                        rounded-full
                        bg-zinc-400
                      "
                    />

                    <span
                      className="
                        h-1.5
                        w-1.5
                        animate-bounce
                        rounded-full
                        bg-zinc-500
                        [animation-delay:120ms]
                      "
                    />

                    <span
                      className="
                        h-1.5
                        w-1.5
                        animate-bounce
                        rounded-full
                        bg-zinc-600
                        [animation-delay:240ms]
                      "
                    />
                  </div>

                  <span>QELVORA düşünüyor...</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
}