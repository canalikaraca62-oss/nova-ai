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
    <div>
      <h1>NOVA Chat</h1>

      {messages.map((msg, index) => (
        <div key={index}>
          <b>{msg.sender}:</b> {msg.text}
        </div>
      ))}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Mesaj yaz..."
      />

      <button onClick={sendMessage}>
        Gönder
      </button>
    </div>
  );
}