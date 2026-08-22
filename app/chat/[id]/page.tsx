"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Menu } from "lucide-react";

import { supabase } from "@/lib/supabase";

import { generateChatTitle } from "@/services/ai";
import { uploadFile } from "@/services/storage";

import Sidebar from "@/app/components/Menu";
import ChatWindow from "@/app/components/ChatWindow";
import ChatInput from "@/app/components/ChatInput";
import { streamChat } from "@/app/hooks/chat-stream";

type Attachment = {
  name: string;
  url: string;
  type: string;
} | null;

type ChatMessage = {
  sender: "user" | "syraven";
  text: string;
  attachment?: Attachment;
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

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const abortControllerRef =
    useRef<AbortController | null>(null);

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
      console.error(
        "MESAJLAR YÜKLENEMEDİ:",
        error
      );

      console.error(
        "HATA MESAJI:",
        error.message
      );

      console.error(
        "HATA DETAYI:",
        error.details
      );

      console.error(
        "HATA İPUCU:",
        error.hint
      );

      console.error(
        "HATA KODU:",
        error.code
      );

      return;
    }

    const loadedMessages = await Promise.all(
      (data || []).map(async (msg) => {
        let attachment: Attachment = null;

        if (msg.attachment_path) {
          const {
            data: signedUrlData,
            error: signedUrlError,
          } = await supabase.storage
            .from("files")
            .createSignedUrl(
              msg.attachment_path,
              60 * 60
            );

          if (signedUrlError) {
            console.error(
              "Attachment URL hatası:",
              signedUrlError
            );
          } else {
            attachment = {
              name:
                msg.attachment_name ||
                "Dosya",

              url:
                signedUrlData.signedUrl,

              type:
                msg.attachment_type ||
                "application/octet-stream",
            };
          }
        }

        return {
          sender:
            msg.role === "assistant"
              ? ("syraven" as const)
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

    let uploadedFile: string | null =
      null;

    let attachmentUrl: string | null =
      null;

    const fileName =
      selectedFile?.name || null;

    const fileType =
      selectedFile?.type ||
      "application/octet-stream";

    if (selectedFile) {
      try {
        setIsUploading(true);

        uploadedFile =
          await uploadFile(selectedFile);

        console.log(
          "DOSYA YÜKLENDİ:",
          uploadedFile
        );

        const {
          data: signedUrlData,
          error: signedUrlError,
        } = await supabase.storage
          .from("files")
          .createSignedUrl(
            uploadedFile,
            60 * 60
          );

        if (signedUrlError) {
          throw signedUrlError;
        }

        attachmentUrl =
          signedUrlData.signedUrl;

        setIsUploading(false);
      } catch (err) {
        console.error(err);

        alert(
          "Dosya yüklenemedi."
        );

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
              name:
                fileName || "Dosya",

              url:
                attachmentUrl,

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
      await supabase
        .from("messages")
        .insert({
          chat_id: chatId,

          role: "user",

          content: userMessage,

          attachment_path:
            uploadedFile,

          attachment_name:
            selectedFile
              ? selectedFile.name
              : null,

          attachment_type:
            selectedFile
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
        const response =
          await fetch(
            "/api/chat",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                messages:
                  updatedMessages.map(
                    (m) => ({
                      role:
                        m.sender ===
                        "syraven"
                          ? "assistant"
                          : "user",

                      content:
                        m.text,
                    })
                  ),

                file: uploadedFile,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.reply ||
              "Dosya işlenemedi."
          );
        }

        const assistantMessage = {
          sender:
            "syraven" as const,

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

        const {
          error: aiError,
        } = await supabase
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

        if (
          updatedMessages.length === 1
        ) {
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
              .eq(
                "id",
                chatId
              );
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
            sender: "syraven",

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

    const {
      data: memories,
      error: memoryError,
    } = await supabase
      .from("memories")
      .select("content")
      .eq(
        "user_id",
        user.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(20);

    if (memoryError) {
      console.error(
        "MEMORY YÜKLENEMEDİ:",
        memoryError
      );
    }

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    setIsStreaming(true);

    setIsLoading(true);

    const assistantMessage = {
      sender:
        "syraven" as const,

      text: "",

      attachment: null,
    };

    let fullAssistantText = "";

    setMessages((prev) => [
      ...prev,
      assistantMessage,
    ]);

    let pendingText = "";

    let frameId: number | null =
      null;

    const flushStream = () => {
      if (!pendingText) {
        frameId = null;

        return;
      }

      const textToAdd =
        pendingText;

      pendingText = "";

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
            textToAdd,
        };

        return updated;
      });

      frameId = null;
    };

    try {
      await streamChat(
        [
          ...(memories || []).map(
            (memory) => ({
              role:
                "system" as const,

              content:
                `Kullanıcı hakkında kayıtlı bilgi: ${memory.content}`,
            })
          ),

          ...updatedMessages.map(
            (m) => ({
              role:
                m.sender ===
                "syraven"
                  ? ("assistant" as const)
                  : ("user" as const),

              content: m.text,
            })
          ),
        ],

        (chunk) => {
          fullAssistantText +=
            chunk;

          pendingText +=
            chunk;

          if (
            frameId === null
          ) {
            frameId =
              requestAnimationFrame(
                flushStream
              );
          }
        },

        controller.signal
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        console.log(
          " SYRAVEN üretimi kullanıcı tarafından durduruldu."
        );
      } else {
        console.error(
          "Streaming hatası:",
          error
        );

        setMessages((prev) => [
          ...prev,
          {
            sender: "syraven",

            text:
              "Üzgünüm, cevap oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.",

            attachment: null,
          },
        ]);
      }
    } finally {
      if (
        frameId !== null
      ) {
        cancelAnimationFrame(
          frameId
        );

        frameId = null;
      }

      if (pendingText) {
        const remainingText =
          pendingText;

        pendingText = "";

        setMessages((prev) => {
          const updated = [
            ...prev,
          ];

          const lastIndex =
            updated.length - 1;

          if (lastIndex < 0) {
            return prev;
          }

          updated[lastIndex] = {
            ...updated[lastIndex],

            text:
              updated[lastIndex].text +
              remainingText,
          };

          return updated;
        });
      }

      setIsLoading(false);

      setIsStreaming(false);

      abortControllerRef.current =
        null;
    }

    //----------------------------------
    // STREAMING AI MESAJINI KAYDET
    //----------------------------------

    if (fullAssistantText) {
      const {
        error: aiError,
      } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,

          role: "assistant",

          content:
            fullAssistantText,
        });

      if (aiError) {
        console.error(aiError);
      }
    }

    //----------------------------------
    // İLK MESAJDA BAŞLIK
    //----------------------------------

    if (
      updatedMessages.length === 1
    ) {
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
          .eq(
            "id",
            chatId
          );
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
    <div className="fixed inset-0 flex min-h-0 overflow-hidden bg-black text-white">

      {/* SIDEBAR */}
      <Sidebar
        open={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <main className="flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden">

        {/* MOBİL ÜST BAR */}
        <div className="flex shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950 p-4 md:hidden">
          <button
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            className="rounded-lg p-2 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            aria-label="Menüyü aç"
          >
            <Menu size={24} />
          </button>

          <h1 className="text-lg font-bold text-white">
             SYRAVEN Chat
          </h1>
        </div>

        {/* DESKTOP BAŞLIK */}
        <div className="hidden shrink-0 p-8 md:block">
          <h1 className="text-4xl font-bold">
            SYRAVEN Chat
          </h1>
        </div>

        {/* CHAT ALANI */}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />

        {/* MESAJ GİRİŞ ALANI */}
        <div className="shrink-0 px-4 pb-4 pt-2 md:px-8 md:pb-8 md:pt-4">
          <ChatInput
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            selectedFile={selectedFile}
            setSelectedFile={
              setSelectedFile
            }
            isUploading={isUploading}
            isStreaming={isStreaming}
            stopStreaming={() => {
              abortControllerRef.current?.abort();
            }}
          />
        </div>

      </main>
    </div>
  );
}