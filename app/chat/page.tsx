"use client";

import { useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      sender: "nova",
      text: "👋 Merhaba Can Ali! Ben NOVA. Sana nasıl yardımcı olabilirim?"
    }
  ]);

  const [input, setInput] = useState("");

  function sendMessage() {
    if (input.trim() === "") return;

    setMessages([
      ...messages,
      {
        sender: "user",
        text: input
      }
    ]);

    setInput("");
  }

  return (
    <main className="flex h-screen bg-[#0b0b0f] text-white">

      <aside className="w-72 border-r border-white/10 p-5">
        <h1 className="text-3xl font-bold mb-6">NOVA</h1>

        <button className="w-full rounded-xl bg-white text-black py-3 font-semibold">
          + New Chat
        </button>
      </aside>

      <section className="flex flex-1 flex-col">

        <div className="flex-1 overflow-y-auto p-8 space-y-5">

          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.sender === "user"
                  ? "flex justify-end"
                  : "flex"
              }
            >
              <div
                className={
                  message.sender === "user"
                    ? "bg-blue-600 rounded-2xl p-4 max-w-xl"
                    : "bg-white/10 rounded-2xl p-4 max-w-xl"
                }
              >
                {message.text}
              </div>
            </div>
          ))}

        </div>

        <div className="border-t border-white/10 p-5 flex gap-3">

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="NOVA'ya mesaj yaz..."
            className="flex-1 rounded-xl bg-white/10 p-4 outline-none"
          />

          <button
            onClick={sendMessage}
            className="rounded-xl bg-blue-600 px-6"
          >
            Gönder
          </button>

        </div>

      </section>

    </main>
  );
}