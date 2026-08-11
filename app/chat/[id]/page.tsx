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
    const {
  data: { session },
} = await supabase.auth.getSession();

console.log(
  "SESSION VAR MI:",
  !!session
);

console.log(
  "USER ID:",
  session?.user?.id
);
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
  console.error("MESAJLAR YÜKLENEMEDİ:", error);
  console.error("HATA MESAJI:", error.message);
  console.error("HATA DETAYI:", error.details);
  console.error("HATA İPUCU:", error.hint);
  console.error("HATA KODU:", error.code);
  return;
}

  const loadedMessages = await Promise.all(
    (data || []).map(async (msg) => {
      let attachment = null;

      if (msg.attachment_path) {
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("files")
            .createSignedUrl(msg.attachment_path, 60 * 60);

        if (signedUrlError) {
          console.error(
            "Attachment URL hatası:",
            signedUrlError
          );
        } else {
          attachment = {
            name: msg.attachment_name || "Dosya",
            url: signedUrlData.signedUrl,
            type: msg.attachment_type || "application/octet-stream",
          };
        }
      }

      return {
        sender:
          msg.role === "assistant"
            ? ("qelvora" as const)
            : ("user" as const),

        text: msg.content || "",

        attachment,
      };
    })
  );

  setMessages(loadedMessages);
}
async function sendMessage() {
  if (isStreaming || isUploading) {
    return;
  }

  if (!input.trim() && !selectedFile) {
    return;
  }

  const userMessage = input;

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

  const fileName = selectedFile?.name || null;
  const fileType =
    selectedFile?.type || "application/octet-stream";

  if (selectedFile) {
    try {
      setIsUploading(true);

      uploadedFile = await uploadFile(selectedFile);

      console.log("DOSYA YÜKLENDİ:", uploadedFile);

      const {
        data: signedUrlData,
        error: signedUrlError,
      } = await supabase.storage
        .from("files")
        .createSignedUrl(uploadedFile, 60 * 60);

      if (signedUrlError) {
        throw signedUrlError;
      }

      attachmentUrl = signedUrlData.signedUrl;

      setIsUploading(false);
    } catch (err) {
      console.error(err);

      alert("Dosya yüklenemedi.");

      setIsUploading(false);

      return;
    }
  }

  //----------------------------------
  // USER MESAJI
  //----------------------------------

  const updatedMessages = [
    ...messages,
    {
      sender: "user" as const,
      text: userMessage,
      attachment: attachmentUrl
        ? {
            name: fileName || "Dosya",
            url: attachmentUrl,
            type: fileType,
          }
        : null,
    },
  ];

  setMessages(updatedMessages);
  setInput("");

  //----------------------------------
  // USER MESAJINI DATABASE'E KAYDET
  //----------------------------------

  const { error: userError } =
  await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: userMessage,
    attachment_path: uploadedFile,
    attachment_name: selectedFile
      ? selectedFile.name
      : null,
    attachment_type: selectedFile
      ? selectedFile.type
      : null,
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
          data.reply || "Dosya işlenemedi."
        );
      }

      const assistantMessage = {
        sender: "qelvora" as const,
        text: data.reply,
        attachment: null,
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
              userMessage || "Dosya analizi"
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
          attachment: null,
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
const { data: memories, error: memoryError } =
  await supabase
    .from("memories")
    .select("content")
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

if (memoryError) {
  console.error("MEMORY YÜKLENEMEDİ:", memoryError);
}
  const controller =
    new AbortController();

  abortControllerRef.current =
    controller;

  setIsStreaming(true);
  setIsLoading(true);

  const assistantMessage = {
    sender: "qelvora" as const,
    text: "",
    attachment: null,
  };

  let fullAssistantText = "";

  setMessages((prev) => [
    ...prev,
    assistantMessage,
  ]);

  try {
    await streamChat(
  [
    ...(memories || []).map((memory) => ({
      role: "system" as const,
      content: `Kullanıcı hakkında kayıtlı bilgi: ${memory.content}`,
    })),

    ...updatedMessages.map((m) => ({
      role:
        m.sender === "qelvora"
          ? ("assistant" as const)
          : ("user" as const),

      content: m.text,
    })),
  ],

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
          attachment: null,
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
