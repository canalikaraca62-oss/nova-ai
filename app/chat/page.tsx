"use client";

import type {
  FormEvent,
  KeyboardEvent} from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type MessageRole = "system" | "user" | "assistant";

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

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Merhaba. Ben SYRAVEN AI. Araştırma, analiz, yazılım, strateji, içerik ve karmaşık görevlerde sana yardımcı olmaya hazırım.",
    createdAt: new Date().toISOString(),
  },
];

const SUGGESTIONS = [
  {
    title: "Derin araştırma",
    description: "Bir konuyu kapsamlı şekilde analiz et",
    prompt:
      "Bu konu hakkında kapsamlı bir araştırma yap ve önemli noktaları yapılandırılmış şekilde açıkla:",
  },
  {
    title: "Kod oluştur",
    description: "Production-ready çözüm geliştir",
    prompt:
      "Production-ready, güvenli ve ölçeklenebilir bir çözüm geliştir:",
  },
  {
    title: "Strateji hazırla",
    description: "Adım adım uygulanabilir plan oluştur",
    prompt:
      "Bu hedef için ayrıntılı ve uygulanabilir bir strateji oluştur:",
  },
  {
    title: "Analiz et",
    description: "Veriyi ve problemi derinlemesine incele",
    prompt:
      "Aşağıdaki konuyu derinlemesine analiz et, riskleri ve fırsatları belirt:",
  },
];

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

function formatTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function copyToClipboard(value: string) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard
  ) {
    return navigator.clipboard.writeText(value);
  }

  return Promise.resolve();
}

export default function ChatPage() {
  const router = useRouter();

  const [messages, setMessages] =
    useState<ChatMessage[]>(STARTER_MESSAGES);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [copiedMessageId, setCopiedMessageId] =
    useState<string | null>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            message.id !== "welcome"
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      240
    )}px`;
  }, [input]);

  async function handleSend(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    const content = input.trim();

    if (!content || isSending) {
      return;
    }

    setError(null);

    const userMessage =
      createMessage("user", content);

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          messages: [
            ...conversationMessages,
            {
              role: "user",
              content,
            },
          ],
        }),
      });

      const rawText = await response.text();

      let data: ChatApiResponse = {};

      try {
        data =
          rawText.length > 0
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

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          assistantContent
        ),
      ]);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Beklenmeyen bir hata oluştu.";

      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void handleSend();
    }
  }

  function handleSuggestion(
    prompt: string
  ) {
    setInput(prompt);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function handleNewChat() {
    setMessages(STARTER_MESSAGES);
    setInput("");
    setError(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  async function handleCopy(
    message: ChatMessage
  ) {
    try {
      await copyToClipboard(
        message.content
      );

      setCopiedMessageId(message.id);

      window.setTimeout(() => {
        setCopiedMessageId(null);
      }, 1600);
    } catch {
      setError(
        "Mesaj panoya kopyalanamadı."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col">
        {/* HEADER */}

        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#07090d]/95 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-cyan-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3v18" />
                  <path d="M5 8h14" />
                  <path d="M7 16h10" />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-[0.14em] text-white">
                  SYRAVEN AI
                </h1>

                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                  <p className="text-xs text-white/45">
                    AI workspace
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-white/75 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
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

              <button
                type="button"
                onClick={() =>
                  router.push("/agents")
                }
                className="hidden h-9 items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/[0.1] sm:inline-flex"
              >
                Agents
              </button>
            </div>
          </div>
        </header>

        {/* CHAT */}

        <section className="flex flex-1">
          <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-6 pt-6 sm:px-6 lg:px-8">
            {messages.length ===
              STARTER_MESSAGES.length && (
              <div className="mb-8 mt-4">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-1.5 text-xs font-medium text-cyan-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                    SYRAVEN Intelligence
                  </div>

                  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                    Ne inşa etmek
                    <span className="text-cyan-300">
                      {" "}
                      istiyorsun?
                    </span>
                  </h2>

                  <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
                    Karmaşık problemleri analiz et,
                    araştır, üret ve projelerini
                    daha hızlı ilerlet.
                  </p>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map(
                    (suggestion) => (
                      <button
                        key={suggestion.title}
                        type="button"
                        onClick={() =>
                          handleSuggestion(
                            suggestion.prompt
                          )
                        }
                        className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-cyan-400/[0.035]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-semibold text-white/90">
                              {suggestion.title}
                            </h3>

                            <p className="mt-1.5 text-xs leading-5 text-white/40">
                              {
                                suggestion.description
                              }
                            </p>
                          </div>

                          <svg
                            viewBox="0 0 24 24"
                            className="mt-0.5 h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-cyan-300"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M5 12h14" />
                            <path d="m13 6 6 6-6 6" />
                          </svg>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* MESSAGES */}

            <div className="flex flex-1 flex-col gap-6 py-2">
              {messages.map((message) => {
                const isUser =
                  message.role === "user";

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
                      className={`group max-w-[85%] sm:max-w-[78%] ${
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
                          {message.content}
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
              })}

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

            {/* ERROR */}

            {error && (
              <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3">
                <p className="text-xs text-red-200">
                  {error}
                </p>

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
            )}

            {/* INPUT */}

            <form
              onSubmit={handleSend}
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
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                  rows={1}
                  placeholder="SYRAVEN AI ile konuş..."
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
                        isSending
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