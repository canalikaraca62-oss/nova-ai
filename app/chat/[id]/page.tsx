"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

import { generateChatTitle } from "@/services/ai";
import { uploadFile } from "@/services/storage";

import Sidebar from "@/app/components/Menu";
import ChatWindow from "@/app/components/ChatWindow";
import ChatInput from "@/app/components/ChatInput";
import { streamChat } from "@/app/hooks/chat-stream";
type ChatMessage = {
  sender: "user" | "qelvora";
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
    const abortControllerRef =
  useRef<AbortController | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

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
            ? "qelvora"
            : "user",

        text: msg.content,
      }))
    );
  }
 async function sendMessage() {
  if (isStreaming || isUploading) {
    return;
  }

  if (!input.trim() && !selectedFile) {
    return;
  }

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

  if (!user) {
    return;
  }

  //----------------------------------
  // DOSYA YÜKLE
  //----------------------------------

  let uploadedFile: string | null = null;
  let attachmentUrl: string | null = null;

  if (selectedFile) {
    try {
      setIsUploading(true);

      uploadedFile = await uploadFile(selectedFile);

      console.log(
        "DOSYA YÜKLENDİ:",
        uploadedFile
      );
      const { data: signedUrlData, error: signedUrlError } =
  await supabase.storage
    .from("files")
    .createSignedUrl(uploadedFile, 60 * 60);

if (signedUrlError) {
  console.error("SIGNED URL HATASI:", signedUrlError);
} else {
  attachmentUrl = signedUrlData.signedUrl;
}
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
  // DOSYA VARSA
  // /api/chat KULLAN
  //----------------------------------

  if (uploadedFile) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role:
              m.sender === "qelvora"
                ? "assistant"
                : "user",

            content: m.text,
          })),

          file: uploadedFile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.reply ||
            "Dosya işlenemedi."
        );
      }

      const assistantMessage = {
        sender: "qelvora" as const,
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
        await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            role: "assistant",
            content: data.reply,
          });

      if (aiError) {
        console.error(aiError);
      }

      //----------------------------------
      // İLK MESAJDA BAŞLIK
      //----------------------------------

      if (updatedMessages.length === 1) {
        try {
          const title =
            await generateChatTitle(
              userMessage ||
                "Dosya analizi"
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
    } catch (error) {
      console.error(
        "Dosya işleme hatası:",
        error
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: "qelvora",
          text:
            "Dosya işlenirken bir hata oluştu. Lütfen tekrar deneyin.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }

    return;
  }

  //----------------------------------
  // NORMAL METİN MESAJI
  // STREAMING
  //----------------------------------

  const controller =
    new AbortController();

  abortControllerRef.current =
    controller;

  setIsStreaming(true);
  setIsLoading(true);

  const assistantMessage = {
    sender: "qelvora" as const,
    text: "",
  };

  let fullAssistantText = "";

  setMessages((prev) => [
    ...prev,
    assistantMessage,
  ]);

  try {
    await streamChat(
      updatedMessages.map((m) => ({
        role:
          m.sender === "qelvora"
            ? "assistant"
            : "user",

        content: m.text,
      })),

      (chunk) => {
        fullAssistantText += chunk;

        setMessages((prev) => {
          const updated = [...prev];

          const lastIndex =
            updated.length - 1;

          if (lastIndex < 0) {
            return prev;
          }

          updated[lastIndex] = {
            ...updated[lastIndex],

            text:
              updated[lastIndex].text +
              chunk,
          };

          return updated;
        });
      },

      controller.signal
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      console.log(
        "QELVORA üretimi kullanıcı tarafından durduruldu."
      );
    } else {
      console.error(
        "Streaming hatası:",
        error
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: "qelvora",
          text:
            "Üzgünüm, cevap oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.",
        },
      ]);
    }
  } finally {
    setIsLoading(false);
    setIsStreaming(false);
    abortControllerRef.current =
      null;
  }

  //----------------------------------
  // STREAMING AI MESAJINI KAYDET
  //----------------------------------

  if (fullAssistantText) {
    const { error: aiError } =
      await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          role: "assistant",
          content: fullAssistantText,
        });

    if (aiError) {
      console.error(aiError);
    }
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
        QELVORA Chat
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
  isStreaming={isStreaming}
  stopStreaming={() => {
    abortControllerRef.current?.abort();
  }}
/>
    </main>
  </div>
);
}
