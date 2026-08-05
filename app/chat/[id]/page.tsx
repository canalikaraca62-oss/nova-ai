"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

import Sidebar from "@/app/components/Menu";
import ChatWindow from "@/app/components/ChatWindow";
import ChatInput from "@/app/components/ChatInput";

type ChatMessage = {
  sender: "user" | "nova";
  text: string;
};

export default function ChatDetailPage() {
  const params = useParams();

  const chatId = params.id as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (chatId) {
      loadMessages();
    }
  }, [chatId]);

  async function loadMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setMessages(
      (data || []).map((msg) => ({
        sender: msg.role === "assistant" ? "nova" : "user",
        text: msg.content,
      }))
    );
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;

    // Kullanıcı mesajını ekrana hemen ekle
    const updatedMessages = [
      ...messages,
      {
        sender: "user" as const,
        text: userMessage,
      },
    ];

    setMessages(updatedMessages);
    setInput("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Kullanıcı mesajını kaydet
    const { error: userError } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userMessage,
    });

    if (userError) {
      console.error(userError);
      return;
    }

    // AI'ya bütün konuşmayı gönder
    setIsLoading(true);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: updatedMessages.map((m) => ({
          role: m.sender === "nova" ? "assistant" : "user",
          content: m.text,
        })),
      }),
    });

    const data = await response.json();
    setIsLoading(false);

    const assistantMessage = {
      sender: "nova" as const,
      text: data.reply,
    };

    // AI cevabını ekrana ekle
    setMessages((prev) => [...prev, assistantMessage]);

    // AI cevabını veritabanına kaydet
    const { error: aiError } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: data.reply,
    });

    if (aiError) {
      console.error(aiError);
      return;
    }
  }

  return (
    <div className="flex h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 flex flex-col p-8">
        <h1 className="text-4xl font-bold mb-8">
          NOVA Chat
        </h1>

        <ChatWindow
  messages={messages}
  isLoading={isLoading}
/>

        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
        />
      </main>
    </div>
  );
}