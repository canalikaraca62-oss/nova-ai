"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  Menu,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

import Sidebar from "@/app/components/Menu";
import ChatWindow from "@/app/components/ChatWindow";
import ChatInput from "@/app/components/ChatInput";

import {
  streamChat,
  type StreamMessage,
} from "@/app/hooks/chat-stream";

import {
  generateChatTitle,
} from "@/services/ai";

import {
  renameChat,
} from "@/services/chats";

import type {
  ActionRequest,
} from "@/services/action-types";

/* ==================================================
 * TYPES
 * ================================================== */

type Attachment = {
  name: string;
  url: string;
  type: string;
};

type ChatMessage = {
  id: string;
  sender: "user" | "syraven";
  text: string;
  attachment?: Attachment | null;
};

type DatabaseMessage = {
  id: string;
  user_id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment?: unknown;
  created_at: string;
};

/* ==================================================
 * FILE UPLOAD
 * ================================================== */

async function uploadFile(
  file: File,
  userId: string
): Promise<Attachment> {
  const extension =
    file.name
      .split(".")
      .pop();

  const safeExtension =
    extension && extension.trim()
      ? `.${extension}`
      : "";

  const filePath =
    `${userId}/${crypto.randomUUID()}${safeExtension}`;

  const {
    error,
  } =
    await supabase.storage
      .from("files")
      .upload(
        filePath,
        file,
        {
          upsert: false,
        }
      );

  if (error) {
    console.error(
      "DOSYA YÜKLEME HATASI:",
      error
    );

    throw error;
  }

  const {
    data,
  } =
    supabase.storage
      .from("files")
      .getPublicUrl(
        filePath
      );

  if (!data.publicUrl) {
    throw new Error(
      "Dosya URL'si oluşturulamadı."
    );
  }

  return {
    name:
      file.name,

    url:
      data.publicUrl,

    type:
      file.type ||
      "application/octet-stream",
  };
}

/* ==================================================
 * PAGE
 * ================================================== */

export default function ChatDetailPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const chatId =
    typeof params?.id === "string"
      ? params.id
      : "";

  /* ==================================================
   * STATE
   * ================================================== */

  const [
    userId,
    setUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(true);

  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>(
      []
    );

  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    isUploading,
    setIsUploading,
  ] =
    useState(false);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isStreaming,
    setIsStreaming,
  ] =
    useState(false);

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);

  const [
    pendingAction,
    setPendingAction,
  ] =
    useState<ActionRequest | null>(
      null
    );

  /* ==================================================
   * REFS
   * ================================================== */

  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );

  const hasGeneratedTitleRef =
    useRef(false);

  /* ==================================================
   * CHAT ID CONTROL
   * ================================================== */

  useEffect(() => {
    if (!chatId) {
      router.replace(
        "/chat"
      );
    }
  }, [
    chatId,
    router,
  ]);

  /* ==================================================
   * AUTH
   * ================================================== */

  useEffect(() => {
    let mounted = true;

    const loadUser =
      async () => {
        setAuthLoading(
          true
        );

        try {
          const {
            data,
            error,
          } =
            await supabase.auth.getUser();

          if (error) {
            throw error;
          }

          if (
            !data.user
          ) {
            if (mounted) {
              setUserId(
                null
              );

              router.replace(
                "/login"
              );
            }

            return;
          }

          if (mounted) {
            setUserId(
              data.user.id
            );
          }
        } catch (error) {
          console.error(
            "KULLANICI YÜKLEME HATASI:",
            error
          );

          if (mounted) {
            setUserId(
              null
            );
          }
        } finally {
          if (mounted) {
            setAuthLoading(
              false
            );
          }
        }
      };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, [
    router,
  ]);

  /* ==================================================
   * LOAD MESSAGES
   * ================================================== */

  const loadMessages =
    useCallback(
      async () => {
        if (
          !chatId ||
          !userId
        ) {
          return;
        }

        setIsLoading(
          true
        );

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from("messages")
              .select(`
                id,
                user_id,
                chat_id,
                role,
                content,
                attachment_path,
                attachment_name,
                attachment_type,
                attachment,
                created_at
              `)
              .eq(
                "chat_id",
                chatId
              )
              .eq(
                "user_id",
                userId
              )
              .order(
                "created_at",
                {
                  ascending: true,
                }
              );

          if (error) {
            console.error(
              "SUPABASE MESAJ HATASI:",
              error
            );

            throw error;
          }

          const formattedMessages =
            (
              (data ??
                []) as DatabaseMessage[]
            ).map(
              (
                message
              ): ChatMessage => {
                let attachment:
                  Attachment | null =
                  null;

                if (
                  message.attachment &&
                  typeof message.attachment ===
                    "object"
                ) {
                  const rawAttachment =
                    message.attachment as Partial<Attachment>;

                  if (
                    rawAttachment.name &&
                    rawAttachment.url &&
                    rawAttachment.type
                  ) {
                    attachment = {
                      name:
                        rawAttachment.name,

                      url:
                        rawAttachment.url,

                      type:
                        rawAttachment.type,
                    };
                  }
                }

                if (
                  !attachment &&
                  message.attachment_path
                ) {
                  attachment = {
                    name:
                      message.attachment_name ||
                      "Dosya",

                    url:
                      message.attachment_path,

                    type:
                      message.attachment_type ||
                      "application/octet-stream",
                  };
                }

                return {
                  id:
                    message.id,

                  sender:
                    message.role ===
                    "user"
                      ? "user"
                      : "syraven",

                  text:
                    message.content ??
                    "",

                  attachment,
                };
              }
            );

          setMessages(
            formattedMessages
          );

          hasGeneratedTitleRef.current =
            formattedMessages.some(
              (
                message
              ) =>
                message.sender ===
                "user"
            );
        } catch (error) {
          console.error(
            "MESAJ YÜKLEME HATASI:",
            error
          );
        } finally {
          setIsLoading(
            false
          );
        }
      },
      [
        chatId,
        userId,
      ]
    );

  useEffect(() => {
    if (
      authLoading
    ) {
      return;
    }

    if (
      !userId
    ) {
      setIsLoading(
        false
      );

      return;
    }

    void loadMessages();
  }, [
    authLoading,
    userId,
    loadMessages,
  ]);

  /* ==================================================
   * STOP STREAMING
   * ================================================== */

  const stopStreaming =
    useCallback(() => {
      abortControllerRef.current?.abort();

      abortControllerRef.current =
        null;

      setIsStreaming(
        false
      );
    }, []);

  /* ==================================================
   * CLEANUP
   * ================================================== */

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /* ==================================================
   * SAVE MESSAGE
   * ================================================== */

  const saveMessage =
    useCallback(
      async (
        message: ChatMessage
      ) => {
        if (
          !chatId ||
          !userId
        ) {
          throw new Error(
            "Kullanıcı veya sohbet bulunamadı."
          );
        }

        const {
          data,
          error,
        } =
          await supabase
            .from("messages")
            .insert({
              user_id:
                userId,

              chat_id:
                chatId,

              role:
                message.sender ===
                "user"
                  ? "user"
                  : "assistant",

              content:
                message.text,

              attachment_path:
                message.attachment?.url ??
                null,

              attachment_name:
                message.attachment?.name ??
                null,

              attachment_type:
                message.attachment?.type ??
                null,

              attachment:
                message.attachment
                  ? {
                      name:
                        message.attachment.name,

                      url:
                        message.attachment.url,

                      type:
                        message.attachment.type,
                    }
                  : null,
            })
            .select()
            .single();

        if (error) {
          console.error(
            "MESAJ KAYDETME HATASI:",
            error
          );

          throw error;
        }

        return data;
      },
      [
        chatId,
        userId,
      ]
    );

  /* ==================================================
   * UPLOAD FILE
   * ================================================== */

  const uploadSelectedFile =
    useCallback(
      async () => {
        if (
          !selectedFile ||
          !userId
        ) {
          return null;
        }

        setIsUploading(
          true
        );

        try {
          return await uploadFile(
            selectedFile,
            userId
          );
        } finally {
          setIsUploading(
            false
          );
        }
      },
      [
        selectedFile,
        userId,
      ]
    );

  /* ==================================================
   * GENERATE CHAT TITLE
   * ================================================== */

  const generateTitleIfNeeded =
    useCallback(
      async (
        firstMessage: string
      ) => {
        if (
          hasGeneratedTitleRef.current ||
          !chatId ||
          !firstMessage.trim()
        ) {
          return;
        }

        hasGeneratedTitleRef.current =
          true;

        try {
          const title =
            await generateChatTitle(
              firstMessage
            );

          if (
            title &&
            title.trim()
          ) {
            await renameChat(
              chatId,
              title.trim()
            );
          }
        } catch (error) {
          console.error(
            "BAŞLIK OLUŞTURMA HATASI:",
            error
          );
        }
      },
      [
        chatId,
      ]
    );

  /* ==================================================
   * HANDLE ACTION
   * ================================================== */

  const handleAction =
    useCallback(
      (
        action: ActionRequest
      ) => {
        if (
          action.type ===
          "none"
        ) {
          return;
        }

        setPendingAction(
          action
        );

        if (
          action.requiresConfirmation
        ) {
          const actionMessage:
            ChatMessage = {
              id:
                crypto.randomUUID(),

              sender:
                "syraven",

              text:
                "⚡ Bir işlem isteği algıladım. İşlemi gerçekleştirmeden önce senden onay almam gerekiyor.",

              attachment:
                null,
            };

          setMessages(
            (
              previous
            ) => [
              ...previous,
              actionMessage,
            ]
          );

          void saveMessage(
            actionMessage
          ).catch(
            (
              error
            ) => {
              console.error(
                "ACTION MESAJI KAYDETME HATASI:",
                error
              );
            }
          );
        }
      },
      [
        saveMessage,
      ]
    );

  /* ==================================================
   * SEND MESSAGE
   * ================================================== */

  const sendMessage =
    useCallback(
      async () => {
        const cleanInput =
          input.trim();

        if (
          !cleanInput &&
          !selectedFile
        ) {
          return;
        }

        if (
          isStreaming ||
          isUploading ||
          !chatId ||
          !userId
        ) {
          return;
        }

        let uploadedAttachment:
          Attachment | null =
          null;

        const selectedFileName =
          selectedFile?.name ??
          "";

        try {
          if (selectedFile) {
            uploadedAttachment =
              await uploadSelectedFile();
          }

          const userMessage:
            ChatMessage = {
              id:
                crypto.randomUUID(),

              sender:
                "user",

              text:
                cleanInput,

              attachment:
                uploadedAttachment,
            };

          setMessages(
            (
              previous
            ) => [
              ...previous,
              userMessage,
            ]
          );

          setInput(
            ""
          );

          setSelectedFile(
            null
          );

          /*
           * ÖNCE KAYDET
           */

          await saveMessage(
            userMessage
          );

          /*
           * SONRA BAŞLIK ÜRET
           */

          void generateTitleIfNeeded(
            cleanInput ||
              selectedFileName ||
              "Yeni Sohbet"
          );

          /*
           * GEÇMİŞ MESAJLARI OLUŞTUR
           */

          const conversationMessages:
            StreamMessage[] =
            [
              ...messages,
              userMessage,
            ]
              .filter(
                (
                  message
                ) =>
                  Boolean(
                    message.text.trim()
                  )
              )
              .map(
                (
                  message
                ): StreamMessage => ({
                  role:
                    message.sender ===
                    "user"
                      ? "user"
                      : "assistant",

                  content:
                    message.text,
                })
              );

          const assistantMessageId =
            crypto.randomUUID();

          setMessages(
            (
              previous
            ) => [
              ...previous,
              {
                id:
                  assistantMessageId,

                sender:
                  "syraven",

                text:
                  "",

                attachment:
                  null,
              },
            ]
          );

          const controller =
            new AbortController();

          abortControllerRef.current =
            controller;

          setIsStreaming(
            true
          );

          let fullReply =
            "";

          await streamChat(
            conversationMessages,

            (
              chunk: string
            ) => {
              fullReply +=
                chunk;

              setMessages(
                (
                  previous
                ) =>
                  previous.map(
                    (
                      message
                    ) => {
                      if (
                        message.id !==
                        assistantMessageId
                      ) {
                        return message;
                      }

                      return {
                        ...message,

                        text:
                          fullReply,
                      };
                    }
                  )
              );
            },

            controller.signal,

            (
              action:
                ActionRequest
            ) => {
              handleAction(
                action
              );
            }
          );

          if (
            fullReply.trim()
          ) {
            const assistantMessage:
              ChatMessage = {
                id:
                  assistantMessageId,

                sender:
                  "syraven",

                text:
                  fullReply,

                attachment:
                  null,
              };

            await saveMessage(
              assistantMessage
            );
          } else {
            setMessages(
              (
                previous
              ) =>
                previous.filter(
                  (
                    message
                  ) =>
                    message.id !==
                    assistantMessageId
                )
            );
          }
        } catch (error) {
          if (
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "MESAJ GÖNDERME HATASI:",
            error
          );

          const errorMessage =
            error instanceof Error
              ? error.message
              : "Mesaj gönderilirken bir hata oluştu.";

          setMessages(
            (
              previous
            ) => [
              ...previous,
              {
                id:
                  crypto.randomUUID(),

                sender:
                  "syraven",

                text:
                  `⚠️ ${errorMessage}`,

                attachment:
                  null,
              },
            ]
          );
        } finally {
          abortControllerRef.current =
            null;

          setIsStreaming(
            false
          );

          setIsUploading(
            false
          );
        }
      },
      [
        chatId,
        generateTitleIfNeeded,
        handleAction,
        input,
        isStreaming,
        isUploading,
        messages,
        saveMessage,
        selectedFile,
        uploadSelectedFile,
        userId,
      ]
    );

  /* ==================================================
   * CONFIRM ACTION
   * ================================================== */

  const confirmAction =
    useCallback(() => {
      if (!pendingAction) {
        return;
      }

      const confirmationMessage:
        ChatMessage = {
          id:
            crypto.randomUUID(),

          sender:
            "syraven",

          text:
            "✅ İşlem onaylandı. Action execution sistemi bağlandığında işlem burada gerçekleştirilecek.",

          attachment:
            null,
        };

      setMessages(
        (
          previous
        ) => [
          ...previous,
          confirmationMessage,
        ]
      );

      void saveMessage(
        confirmationMessage
      ).catch(
        (
          error
        ) => {
          console.error(
            "ONAY MESAJI KAYDEDİLEMEDİ:",
            error
          );
        }
      );

      setPendingAction(
        null
      );
    },
    [
      pendingAction,
      saveMessage,
    ]
  );

  /* ==================================================
   * CANCEL ACTION
   * ================================================== */

  const cancelAction =
    useCallback(() => {
      if (!pendingAction) {
        return;
      }

      setPendingAction(
        null
      );

      const cancelMessage:
        ChatMessage = {
          id:
            crypto.randomUUID(),

          sender:
            "syraven",

          text:
            "❌ İşlem iptal edildi.",

          attachment:
            null,
        };

      setMessages(
        (
          previous
        ) => [
          ...previous,
          cancelMessage,
        ]
      );

      void saveMessage(
        cancelMessage
      ).catch(
        (
          error
        ) => {
          console.error(
            "İPTAL MESAJI KAYDEDİLEMEDİ:",
            error
          );
        }
      );
    },
    [
      pendingAction,
      saveMessage,
    ]
  );

  /* ==================================================
   * RENDER
   * ================================================== */

  return (
    <div
      className="
        flex
        h-dvh
        min-h-0
        w-full
        overflow-hidden
        bg-[#09090b]
        text-white
      "
    >
      <Sidebar
        open={menuOpen}
        onClose={() =>
          setMenuOpen(
            false
          )
        }
      />

      <main
        className="
          flex
          min-h-0
          min-w-0
          flex-1
          flex-col
          overflow-hidden
        "
      >
        {/* MOBILE HEADER */}

        <header
          className="
            flex
            h-14
            shrink-0
            items-center
            border-b
            border-white/[0.06]
            bg-[#09090b]/90
            px-3
            backdrop-blur-xl
            md:hidden
          "
        >
          <button
            type="button"
            onClick={() =>
              setMenuOpen(
                true
              )
            }
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              text-zinc-400
              transition
              hover:bg-white/[0.06]
              hover:text-white
            "
            aria-label="Menüyü aç"
          >
            <Menu size={21} />
          </button>

          <div className="ml-2">
            <p className="text-sm font-semibold tracking-tight text-white">
              SYRAVEN
            </p>

            <p className="text-[10px] text-zinc-500">
              Artificial Intelligence
            </p>
          </div>
        </header>

        <div
          className="
            flex
            min-h-0
            flex-1
            flex-col
            overflow-hidden
          "
        >
          <ChatWindow
            messages={messages}
            isLoading={
              isLoading ||
              authLoading
            }
            isStreaming={isStreaming}
          />

          {pendingAction &&
            pendingAction.type !==
              "none" &&
            pendingAction.requiresConfirmation && (
              <div
                className="
                  shrink-0
                  px-3
                  pb-3
                  sm:px-5
                "
              >
                <div
                  className="
                    mx-auto
                    max-w-4xl
                    rounded-2xl
                    border
                    border-yellow-500/20
                    bg-yellow-500/[0.06]
                    p-4
                    backdrop-blur-xl
                  "
                >
                  <p className="mb-2 text-sm font-semibold text-yellow-200">
                    ⚡ İşlem Onayı Gerekli
                  </p>

                  <p className="mb-4 text-sm leading-6 text-zinc-400">
                    SYRAVEN bir işlem gerçekleştirmek istiyor.
                    Devam etmek istiyor musun?
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={
                        confirmAction
                      }
                      className="
                        rounded-xl
                        bg-white
                        px-4
                        py-2
                        text-sm
                        font-medium
                        text-black
                        transition
                        hover:bg-zinc-200
                      "
                    >
                      Onayla
                    </button>

                    <button
                      type="button"
                      onClick={
                        cancelAction
                      }
                      className="
                        rounded-xl
                        border
                        border-white/10
                        bg-white/[0.03]
                        px-4
                        py-2
                        text-sm
                        font-medium
                        text-zinc-300
                        transition
                        hover:bg-white/[0.07]
                        hover:text-white
                      "
                    >
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            )}

          <div
            className="
              shrink-0
              border-t
              border-white/[0.06]
              bg-[#09090b]/90
              px-3
              py-3
              backdrop-blur-xl
              sm:px-5
              sm:py-4
            "
          >
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
              stopStreaming={
                stopStreaming
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}