"use client";

import { useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      sender: "nova",
      text: "👋 Merhaba Can Ali! Ben NOVA. Sana nasıl yardımcı olabilirim?",
    },
  ]);

  const [input, setInput] = useState("");

  async function sendMessage() {
    if (input.trim() === "") return;

    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: userMessage,
      },
    ]);

    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          sender: "nova",
          text: data.reply,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "nova",
          text: "❌ Bir hata oluştu.",
        },
      ]);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-8">NOVA Chat</h1>

      <div className="w-full max-w-3xl bg-zinc-900 rounded-xl p-6 mb-6">
        {messages.map((msg, index) => (
          <div key={index} className="mb-4">
            <span className="font-bold">
              {msg.sender === "nova" ? "🤖 NOVA" : "👤 Sen"}:
            </span>{" "}
            {msg.text}
          </div>
        ))}
      </div>

      <div className="flex gap-3 w-full max-w-3xl">
        <input
          className="flex-1 p-3 rounded-lg bg-white text-black outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mesajını yaz..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
        />

        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
        >
          Gönder
        </button>
      </div>
    </div>
  );
}