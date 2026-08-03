"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import Sidebar from "../components/Menu";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";

type ChatMessage = {
  sender: "nova" | "user";
  text: string;
};

export default function ChatPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "nova",
      text: "👋 Merhaba Can Ali! Ben NOVA. Sana nasıl yardımcı olabilirim?",
    },
  ]);

  const [input, setInput] = useState("");

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      }
    }

    checkUser();
  }, [router]);

  async function sendMessage() {
    if (!input.trim()) return;

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
    <div className="flex h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 flex flex-col p-8">
        <h1 className="text-4xl font-bold mb-8">NOVA Chat</h1>

        <ChatWindow messages={messages} />

        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
        />
      </main>
    </div>
  );
}