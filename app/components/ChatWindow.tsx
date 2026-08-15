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
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const shouldAutoScrollRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);

  function handleScroll() {
    const container = containerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    // Kullanıcı aşağıya yakınsa otomatik takip et.
    // Yukarı çıktıysa artık zorla aşağı indirme.
    shouldAutoScrollRef.current =
      distanceFromBottom < 120;
  }

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    // Her streaming chunk'ında ayrı ayrı scroll çalıştırma.
    // Browser'ın frame'ine bağla.
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current =
      requestAnimationFrame(() => {
        const container = containerRef.current;

        if (!container) return;

        container.scrollTop =
          container.scrollHeight;

        scrollFrameRef.current = null;
      });

    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(
          scrollFrameRef.current
        );
      }
    };
  }, [messages.length, isLoading]);

  // Yeni mesaj geldiğinde aşağıya git.
  // Streaming sırasında her chunk'ta smooth scroll yapma.
  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    const container = containerRef.current;

    if (!container) return;

    container.scrollTop =
      container.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="
        min-h-0
        flex-1
        w-full
        max-w-4xl
        mx-auto
        rounded-xl
        bg-zinc-900
        p-3
        sm:p-5
        lg:p-6
        mb-3
        sm:mb-6
        overflow-y-auto
        overflow-x-hidden
        overscroll-contain
        touch-pan-y
        [scrollbar-width:thin]
      "
    >
      {messages.map((msg, index) => (
        <Message
          key={index}
          sender={msg.sender}
          text={msg.text}
          attachment={msg.attachment}
        />
      ))}

      {isLoading && (
        <div className="flex justify-start mt-4">
          <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-white">
            <span className="inline-flex items-center gap-1">
              <span>QELVORA yazıyor</span>

              <span className="animate-pulse">
                ...
              </span>
            </span>
          </div>
        </div>
      )}

      <div
        ref={bottomRef}
        className="h-px"
      />
    </div>
  );
}