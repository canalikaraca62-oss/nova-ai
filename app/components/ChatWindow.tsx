"use client";

import {
  useEffect,
  useRef,
} from "react";

import Message from "./Message";

type Attachment = {
  name: string;
  url: string;
  type: string;
};

type MessageType = {
  id?: string;
  sender: "user" | "syraven";
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

  function scrollToBottom(
    force = false
  ) {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    if (
      !force &&
      !shouldAutoScrollRef.current
    ) {
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

        if (!current) {
          animationFrameRef.current =
            null;

          return;
        }

        if (
          force ||
          shouldAutoScrollRef.current
        ) {
          current.scrollTop =
            current.scrollHeight;
        }

        animationFrameRef.current =
          null;
      });
  }

  function handleScroll() {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    shouldAutoScrollRef.current =
      distanceFromBottom < 120;
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isStreaming) {
      shouldAutoScrollRef.current =
        true;

      scrollToBottom(true);
    }
  }, [isStreaming]);

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

  const isEmpty =
    messages.length === 0 &&
    !isLoading;

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
        px-4
        py-6
        sm:px-6
        sm:py-8
        lg:px-8
      "
    >
      <div
        className="
          flex
          min-h-full
          w-full
          max-w-4xl
          mx-auto
          flex-col
        "
      >
        {isEmpty && (
          <div
            className="
              flex
              flex-1
              flex-col
              items-center
              justify-center
              pb-20
              text-center
            "
          >
            <div
              className="
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
                shadow-2xl
              "
            >
              ✦
            </div>

            <h1
              className="
                text-3xl
                font-semibold
                tracking-tight
                text-white
                sm:text-4xl
              "
            >
              Merhaba, ben SYRAVEN
            </h1>

            <p
              className="
                mt-3
                max-w-md
                text-sm
                leading-6
                text-zinc-500
                sm:text-base
              "
            >
              Sorularını sor, fikirlerini geliştir,
              dosyalarını analiz et ve birlikte üretelim.
            </p>
          </div>
        )}

        {!isEmpty && (
          <div
            className="
              flex
              flex-col
              gap-5
              pb-8
            "
          >
            {messages.map(
              (message, index) => (
                <Message
                  key={
                    message.id ||
                    `${message.sender}-${index}`
                  }
                  sender={message.sender}
                  text={message.text}
                  attachment={
                    message.attachment
                  }
                />
              )
            )}

            {isLoading &&
              !isStreaming && (
                <div className="flex justify-start">
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.035]
                      px-4
                      py-3
                      text-sm
                      text-zinc-400
                    "
                  >
                    <div className="flex gap-1">
                      <span
                        className="
                          h-1.5
                          w-1.5
                          animate-bounce
                          rounded-full
                          bg-zinc-400
                          [animation-delay:-0.3s]
                        "
                      />

                      <span
                        className="
                          h-1.5
                          w-1.5
                          animate-bounce
                          rounded-full
                          bg-zinc-400
                          [animation-delay:-0.15s]
                        "
                      />

                      <span
                        className="
                          h-1.5
                          w-1.5
                          animate-bounce
                          rounded-full
                          bg-zinc-400
                        "
                      />
                    </div>

                    <span>
                      SYRAVEN düşünüyor...
                    </span>
                  </div>
                </div>
              )}
          </div>
        )}

        <div
          aria-hidden="true"
          className="h-4 shrink-0"
        />
      </div>
    </div>
  );
}