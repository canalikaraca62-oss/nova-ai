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
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldAutoScrollRef = useRef(true);

  const animationFrameRef =
    useRef<number | null>(null);

  //----------------------------------
  // SCROLL DURUMUNU KONTROL ET
  //----------------------------------

  function handleScroll() {
    const container = containerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    shouldAutoScrollRef.current =
      distanceFromBottom < 150;
  }

  //----------------------------------
  // AŞAĞI KAYDIR
  //----------------------------------

  function scrollToBottom() {
    const container = containerRef.current;

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

        animationFrameRef.current = null;
      });
  }

  //----------------------------------
  // YENİ MESAJ + STREAMING
  //----------------------------------

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    /*
     * Kullanıcı zaten aşağıdaysa
     * otomatik takip devam eder.
     */
    if (distanceFromBottom < 300) {
      shouldAutoScrollRef.current = true;
    }

    /*
     * Yeni AI cevabı streaming yaparken
     * otomatik olarak aşağıyı takip et.
     */
    if (isStreaming) {
      shouldAutoScrollRef.current = true;
    }

    scrollToBottom();
  }, [messages, isStreaming]);

  //----------------------------------
  // CEVAP BİTTİĞİNDE EN ALTA GİT
  //----------------------------------

  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      shouldAutoScrollRef.current = true;

      const container = containerRef.current;

      if (!container) return;

      requestAnimationFrame(() => {
        container.scrollTop =
          container.scrollHeight;
      });
    }
  }, [isStreaming, messages.length]);

  //----------------------------------
  // KLAVYE SCROLL
  //----------------------------------

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      const container =
        containerRef.current;

      if (!container) return;

      const activeElement =
        document.activeElement;

      const tag =
        activeElement?.tagName;

      /*
       * Kullanıcı mesaj yazıyorsa
       * klavyeye müdahale etme.
       */
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (activeElement as HTMLElement)
          ?.isContentEditable
      ) {
        return;
      }

      const amount = 120;

      //----------------------------------
      // AŞAĞI
      //----------------------------------

      if (event.key === "ArrowDown") {
        event.preventDefault();

        container.scrollTop += amount;
      }

      //----------------------------------
      // YUKARI
      //----------------------------------

      if (event.key === "ArrowUp") {
        event.preventDefault();

        container.scrollTop -= amount;
      }

      //----------------------------------
      // PAGE DOWN
      //----------------------------------

      if (event.key === "PageDown") {
        event.preventDefault();

        container.scrollTop +=
          container.clientHeight * 0.8;
      }

      //----------------------------------
      // PAGE UP
      //----------------------------------

      if (event.key === "PageUp") {
        event.preventDefault();

        container.scrollTop -=
          container.clientHeight * 0.8;
      }

      //----------------------------------
      // HOME
      //----------------------------------

      if (event.key === "Home") {
        event.preventDefault();

        container.scrollTop = 0;
      }

      //----------------------------------
      // END
      //----------------------------------

      if (event.key === "End") {
        event.preventDefault();

        container.scrollTop =
          container.scrollHeight;
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  //----------------------------------
  // TEMİZLE
  //----------------------------------

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

  //----------------------------------
  // UI
  //----------------------------------

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      tabIndex={0}
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
        focus:outline-none
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
  );
}