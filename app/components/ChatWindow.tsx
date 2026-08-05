"use client";

import { useEffect, useRef } from "react";
import Message from "./Message";

type MessageType = {
  sender: "user" | "nova";
  text: string;
};

type ChatWindowProps = {
  messages: MessageType[];
  isLoading: boolean;
};

export default function ChatWindow({
  messages,
  isLoading,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto bg-zinc-900 rounded-xl p-6 mb-6 overflow-y-auto">
      {messages.map((msg, index) => (
        <Message
          key={index}
          sender={msg.sender}
          text={msg.text}
        />
      ))}

      {isLoading && (
        <div className="flex justify-start mt-4">
          <div className="bg-zinc-800 px-4 py-3 rounded-2xl animate-pulse text-white">
            🤖 NOVA yazıyor...
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}