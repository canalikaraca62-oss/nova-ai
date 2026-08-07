"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

import { generateChatTitle } from "@/services/ai";
import { uploadFile } from "@/services/storage";

import Sidebar from "@/app/components/Menu";
import ChatWindow from "@/app/components/ChatWindow";
import ChatInput from "@/app/components/ChatInput";
import { streamChat } from "@/app/hooks/chat-stream";
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

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [isUploading, setIsUploading] =
    useState(false);

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
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    setMessages(
      (data || []).map((msg) => ({
        sender:
          msg.role === "assistant"
            ? "nova"
            : "user",

        text: msg.content,
      }))
    );
  }
  async function sendMessage() {
  if (!input.trim() && !selectedFile) return;

  const userMessage = input;

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

  //----------------------------------
  // DOSYA YÜKLE
  //----------------------------------

  let uploadedFile: string | null = null;

  if (selectedFile) {
    try {
      setIsUploading(true);

      uploadedFile = await uploadFile(
        selectedFile
      );

      console.log(
        "DOSYA YÜKLENDİ:",
        uploadedFile
      );
    } catch (err) {
      console.error(err);

      alert("Dosya yüklenemedi.");

      setIsUploading(false);

      return;
    }

    setIsUploading(false);
  }

  //----------------------------------
  // USER MESAJINI KAYDET
  //----------------------------------

  const { error: userError } =
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userMessage,
    });

  if (userError) {
    console.error(userError);
    return;
  }

  //----------------------------------
  // DEVAMI PART 3'TE
  //----------------------------------
    //----------------------------------
  // AI İSTEĞİ
  //----------------------------------

  setIsLoading(true);

  const response = await fetch("/api/chat", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      messages: updatedMessages.map((m) => ({
        role:
          m.sender === "nova"
            ? "assistant"
            : "user",

        content: m.text,
      })),

      file: uploadedFile,
    }),
  });

  const data = await response.json();

  setIsLoading(false);

  const assistantMessage = {
    sender: "nova" as const,
    text: data.reply,
  };

  setMessages((prev) => [
    ...prev,
    assistantMessage,
  ]);

  //----------------------------------
  // AI MESAJINI KAYDET
  //----------------------------------

  const { error: aiError } =
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: data.reply,
    });

  if (aiError) {
    console.error(aiError);
    return;
  }

  //----------------------------------
  // İLK MESAJDA BAŞLIK
  //----------------------------------

  if (updatedMessages.length === 1) {
    try {
      const title =
        await generateChatTitle(
          userMessage
        );

      await supabase
        .from("chats")
        .update({
          title,
        })
        .eq("id", chatId);
    } catch (err) {
      console.error(err);
    }
  }

  //----------------------------------
  // TEMİZLE
  //----------------------------------

  setSelectedFile(null);
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
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        isUploading={isUploading}
      />
    </main>
  </div>
);
}
