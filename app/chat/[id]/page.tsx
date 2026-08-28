"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

type MessageRole =
  | "system"
  | "user"
  | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

type ApiMessage = {
  role?: string;
  content?: string;
};

type ChatApiResponse = {
  message?: ApiMessage;
  response?: string;
  content?: string;
  error?: string;
};

type StoredConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

const STORAGE_PREFIX =
  "syraven-chat:";

function createMessage(
  role: MessageRole,
  content: string
): ChatMessage {
  return {
    id:
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function getResponseContent(
  data: ChatApiResponse
): string {
  if (
    typeof data.message?.content === "string" &&
    data.message.content.trim()
  ) {
    return data.message.content.trim();
  }

  if (
    typeof data.response === "string" &&
    data.response.trim()
  ) {
    return data.response.trim();
  }

  if (
    typeof data.content === "string" &&
    data.content.trim()
  ) {
    return data.content.trim();
  }

  return "";
}

function createTitle(
  messages: ChatMessage[]
): string {
  const firstUserMessage =
    messages.find(
      (message) =>
        message.role === "user"
    );

  if (!firstUserMessage) {
    return "Yeni sohbet";
  }

  const value =
    firstUserMessage.content
      .replace(/\s+/g, " ")
      .trim();

  if (value.length <= 48) {
    return value;
  }

  return `${value.slice(0, 48)}...`;
}

function formatTime(
  value: string
): string {
  try {
    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return "";
  }
}

function getStorageKey(
  conversationId: string
) {
  return `${STORAGE_PREFIX}${conversationId}`;
}

function loadConversation(
  conversationId: string
): StoredConversation | null {
  try {
    const raw =
      window.localStorage.getItem(
        getStorageKey(conversationId)
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as StoredConversation;

    if (
      !parsed ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }

    return {
      id: conversationId,
      title:
        typeof parsed.title === "string" &&
        parsed.title.trim()
          ? parsed.title
          : createTitle(
              parsed.messages
            ),
      messages:
        parsed.messages.filter(
          (
            message
          ): message is ChatMessage =>
            Boolean(
              message &&
                typeof message.id === "string" &&
                typeof message.role === "string" &&
                typeof message.content ===
                  "string" &&
                typeof message.createdAt ===
                  "string"
            )
        ),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function saveConversation(
  conversationId: string,
  messages: ChatMessage[]
) {
  try {
    const conversation: StoredConversation =
      {
        id: conversationId,
        title:
          createTitle(messages),
        messages,
        updatedAt:
          new Date().toISOString(),
      };

    window.localStorage.setItem(
      getStorageKey(conversationId),
      JSON.stringify(conversation)
    );
  } catch {
    /*
      localStorage erişimi başarısız olursa
      sohbet yine aktif oturum boyunca çalışmaya devam eder.
    */
  }
}

function copyText(
  value: string
): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard
  ) {
    return navigator.clipboard
      .writeText(value)
      .then(() => undefined);
  }

  return Promise.resolve();
}

export default function ChatConversationPage() {
  const router = useRouter();

  const params = useParams<{
    id?: string | string[];
  }>();

  const rawId = params?.id;

  const conversationId =
    Array.isArray(rawId)
      ? rawId[0] ?? ""
      : rawId ?? "";

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [input, setInput] =
    useState("");

  const [title, setTitle] =
    useState("Yeni sohbet");

  const [isLoadingConversation, setIsLoadingConversation] =
    useState(true);

  const [isSending, setIsSending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [copiedMessageId, setCopiedMessageId] =
    useState<string | null>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const bottomRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const lastUserMessageRef =
    useRef<string | null>(null);

  const apiMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  );

  useEffect(() => {
    if (!conversationId) {
      setIsLoadingConversation(false);
      return;
    }

    setIsLoadingConversation(true);
    setError(null);

    const conversation =
      loadConversation(conversationId);

    if (conversation) {
      setMessages(
        conversation.messages
      );

      setTitle(
        conversation.title
      );
    } else {
      setMessages([]);
      setTitle("Yeni sohbet");
    }

    setIsLoadingConversation(false);
  }, [conversationId]);

  useEffect(() => {
    if (
      isLoadingConversation ||
      !conversationId
    ) {
      return;
    }

    saveConversation(
      conversationId,
      messages
    );

    setTitle(
      createTitle(messages)
    );
  }, [
    conversationId,
    isLoadingConversation,
    messages,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    messages,
    isSending,
  ]);

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        240
      )}px`;
  }, [input]);

  useEffect(() => {
    if (!isLoadingConversation) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [
    isLoadingConversation,
  ]);

  async function sendMessage(
    contentOverride?: string
  ) {
    const content =
      (
        contentOverride ??
        input
      ).trim();

    if (
      !content ||
      isSending ||
      !conversationId
    ) {
      return;
    }

    setError(null);

    const userMessage =
      createMessage(
        "user",
        content
      );

    lastUserMessageRef.current =
      content;

    const requestMessages = [
      ...apiMessages,
      {
        role: "user",
        content,
      },
    ];

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ]
    );

    setInput("");
    setIsSending(true);

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
              conversationId,
              chatId:
                conversationId,
              message:
                content,
              messages:
                requestMessages,
            }),
          }
        );

      const rawText =
        await response.text();

      let data: ChatApiResponse = {};

      try {
        data =
          rawText
            ? JSON.parse(rawText)
            : {};
      } catch {
        if (!response.ok) {
          throw new Error(
            rawText ||
              "SYRAVEN AI isteği işleyemedi."
          );
        }

        data = {
          content: rawText,
        };
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Mesaj gönderilirken bir hata oluştu."
        );
      }

      const assistantContent =
        getResponseContent(data);

      if (!assistantContent) {
        throw new Error(
          "AI tarafından geçerli bir yanıt alınamadı."
        );
      }

      setMessages(
        (current) => [
          ...current,
          createMessage(
            "assistant",
            assistantContent
          ),
        ]
      );
    } catch (
      caughtError
    ) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Beklenmeyen bir hata oluştu.";

      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    void sendMessage();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void sendMessage();
    }
  }

  function handleRetry() {
    const message =
      lastUserMessageRef.current;

    if (!message || isSending) {
      return;
    }

    void sendMessage(message);
  }

  async function handleCopy(
    message: ChatMessage
  ) {
    try {
      await copyText(
        message.content
      );

      setCopiedMessageId(
        message.id
      );

      window.setTimeout(() => {
        setCopiedMessageId(null);
      }, 1600);
    } catch {
      setError(
        "Mesaj panoya kopyalanamadı."
      );
    }
  }

  function handleNewChat() {
    router.push("/chat");
  }

  function handleClearConversation() {
    if (!conversationId) {
      return;
    }

    try {
      window.localStorage.removeItem(
        getStorageKey(conversationId)
      );
    } catch {
      /* no-op */
    }

    setMessages([]);
    setInput("");
    setError(null);
    setTitle("Yeni sohbet");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  if (!conversationId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-6 text-white">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.08]">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-red-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </div>

          <h1 className="mt-5 text-xl font-semibold">
            Geçersiz sohbet
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/45">
            Bu sohbet kimliği
            kullanılamıyor.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/chat")
            }
            className="mt-6 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.08]"
          >
            Sohbetlere dön
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#07090d]/95 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push("/chat")
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.07] hover:text-white"
                aria-label="Sohbetlere dön"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />

                  <span className="truncate text-sm font-semibold text-white/90">
                    {title}
                  </span>
                </div>

                <p className="mt-0.5 truncate text-[10px] tracking-[0.12em] text-white/30">
                  SYRAVEN AI CONVERSATION
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  handleClearConversation
                }
                className="hidden h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white/55 transition hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-200 sm:inline-flex"
              >
                Temizle
              </button>

              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-3 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/[0.13]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>

                <span className="hidden sm:inline">
                  Yeni sohbet
                </span>
              </button>
            </div>
          </div>
        </header>

        <section className="flex flex-1">
          <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-6 pt-6 sm:px-6 lg:px-8">
            {isLoadingConversation ? (
              <div className="flex flex-1 items-center justify-center py-20">
                <div className="flex items-center gap-3 text-sm text-white/40">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
                  Sohbet yükleniyor...
                </div>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center sm:py-20">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07]">
                      <span className="text-lg font-bold text-cyan-200">
                        S
                      </span>
                    </div>

                    <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-4xl">
                      Sohbete başlayalım.
                    </h1>

                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/40">
                      SYRAVEN AI ile araştır,
                      analiz et, üret ve
                      projeni ileri taşı.
                    </p>
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-6 py-2">
                  {messages.map(
                    (message) => {
                      const isUser =
                        message.role ===
                        "user";

                      return (
                        <article
                          key={message.id}
                          className={`flex gap-3 sm:gap-4 ${
                            isUser
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          {!isUser && (
                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08]">
                              <span className="text-[10px] font-bold tracking-wider text-cyan-200">
                                S
                              </span>
                            </div>
                          )}

                          <div
                            className={`group max-w-[88%] sm:max-w-[78%] ${
                              isUser
                                ? "items-end"
                                : "items-start"
                            }`}
                          >
                            <div
                              className={`rounded-2xl px-4 py-3.5 text-sm leading-7 ${
                                isUser
                                  ? "rounded-tr-md border border-cyan-400/15 bg-cyan-400/[0.10] text-white/90"
                                  : "rounded-tl-md border border-white/[0.07] bg-white/[0.035] text-white/80"
                              }`}
                            >
                              <div className="whitespace-pre-wrap break-words">
                                {
                                  message.content
                                }
                              </div>
                            </div>

                            <div
                              className={`mt-1.5 flex items-center gap-2 px-1 text-[10px] text-white/25 ${
                                isUser
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <span>
                                {formatTime(
                                  message.createdAt
                                )}
                              </span>

                              {!isUser && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCopy(
                                      message
                                    )
                                  }
                                  className="opacity-0 transition hover:text-cyan-200 group-hover:opacity-100 focus:opacity-100"
                                >
                                  {copiedMessageId ===
                                  message.id
                                    ? "Kopyalandı"
                                    : "Kopyala"}
                                </button>
                              )}
                            </div>
                          </div>

                          {isUser && (
                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.06]">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4 text-white/65"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <circle
                                  cx="12"
                                  cy="8"
                                  r="3"
                                />
                                <path d="M5 21c1.2-4 3.5-6 7-6s5.8 2 7 6" />
                              </svg>
                            </div>
                          )}
                        </article>
                      );
                    }
                  )}

                  {isSending && (
                    <article className="flex gap-3 sm:gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08]">
                        <span className="text-[10px] font-bold tracking-wider text-cyan-200">
                          S
                        </span>
                      </div>

                      <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.035] px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
                        </div>
                      </div>
                    </article>
                  )}

                  <div ref={bottomRef} />
                </div>
              </>
            )}

            {error && (
              <div className="mb-3 flex flex-col gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-red-200">
                  {error}
                </p>

                <div className="flex shrink-0 items-center gap-3">
                  {lastUserMessageRef.current && (
                    <button
                      type="button"
                      onClick={
                        handleRetry
                      }
                      disabled={isSending}
                      className="text-xs text-cyan-200 transition hover:text-cyan-100 disabled:opacity-40"
                    >
                      Tekrar dene
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setError(null)
                    }
                    className="text-xs text-red-200/60 transition hover:text-red-100"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="sticky bottom-0 mt-4 bg-[#07090d] pb-2 pt-3"
            >
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.035] p-2 shadow-2xl shadow-black/20 transition focus-within:border-cyan-400/25 focus-within:bg-white/[0.045]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) =>
                    setInput(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleKeyDown
                  }
                  disabled={
                    isSending ||
                    isLoadingConversation
                  }
                  rows={1}
                  placeholder="Mesaj yaz..."
                  className="max-h-60 min-h-[52px] w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 disabled:cursor-not-allowed disabled:opacity-50"
                />

                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <div className="hidden items-center gap-2 text-[10px] text-white/25 sm:flex">
                    <kbd className="rounded border border-white/[0.08] px-1.5 py-0.5">
                      Enter
                    </kbd>

                    <span>gönder</span>

                    <span className="text-white/10">
                      ·
                    </span>

                    <kbd className="rounded border border-white/[0.08] px-1.5 py-0.5">
                      Shift + Enter
                    </kbd>

                    <span>yeni satır</span>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden text-[10px] text-white/20 sm:block">
                      {input.length} karakter
                    </span>

                    <button
                      type="submit"
                      disabled={
                        !input.trim() ||
                        isSending ||
                        isLoadingConversation
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300 text-[#061014] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Mesaj gönder"
                    >
                      {isSending ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            d="M21 12a9 9 0 1 1-6.2-8.55"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m5 12 14-7-7 14-2-7-5-2Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-2 text-center text-[10px] text-white/20">
                SYRAVEN AI yanıtları hata
                içerebilir. Kritik bilgileri
                doğrulayın.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}