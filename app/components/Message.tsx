"use client";

import { useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Attachment = {
  name: string;
  url: string;
  type: string;
} | null;

type MessageProps = {
  sender: "user" | "syraven";
  text: string;
  attachment?: Attachment;
};

export default function Message({
  sender,
  text,
  attachment,
}: MessageProps) {
  const isUser =
    sender === "user";

  const isImage =
    attachment?.type?.startsWith(
      "image/"
    );

  const [copied, setCopied] =
    useState(false);

  async function copyText() {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error(
        "Kopyalama hatası:",
        error
      );
    }
  }

  async function copyCode(
    code: string
  ) {
    try {
      await navigator.clipboard.writeText(
        code
      );
    } catch (error) {
      console.error(
        "Kod kopyalama hatası:",
        error
      );
    }
  }

  return (
    <div
      className={`
        flex
        w-full
        min-w-0
        ${
          isUser
            ? "justify-end"
            : "justify-start"
        }
      `}
    >
      <div
        className={`
          min-w-0
          max-w-[92%]
          sm:max-w-[85%]
          lg:max-w-[80%]

          ${
            isUser
              ? `
                rounded-3xl
                rounded-br-lg
                bg-blue-600
                px-4
                py-3
                text-white
                shadow-lg
                shadow-blue-950/20
              `
              : `
                rounded-3xl
                rounded-bl-lg
                border
                border-white/[0.08]
                bg-white/[0.035]
                px-4
                py-4
                text-zinc-200
                shadow-xl
                shadow-black/10
                backdrop-blur-xl
              `
          }
        `}
      >
        {/* HEADER */}

        <div
          className={`
            mb-3
            flex
            items-center
            gap-2
            text-[11px]
            font-semibold
            uppercase
            tracking-[0.12em]

            ${
              isUser
                ? "text-blue-100/80"
                : "text-zinc-500"
            }
          `}
        >
          <div
            className={`
              flex
              h-6
              w-6
              shrink-0
              items-center
              justify-center
              rounded-lg
              text-xs

              ${
                isUser
                  ? "bg-white/15"
                  : "border border-white/10 bg-white/[0.05]"
              }
            `}
          >
            {isUser ? "U" : "✦"}
          </div>

          <span>
            {isUser
              ? "Sen"
              : "SYRAVEN"}
          </span>
        </div>

        {/* ATTACHMENT */}

        {attachment && (
          <div className="mb-4 min-w-0">
            {isImage ? (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  block
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/20
                "
              >
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="
                    block
                    max-h-[420px]
                    w-auto
                    max-w-full
                    object-contain
                  "
                />
              </a>
            ) : (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex
                  min-w-0
                  items-center
                  gap-3
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/20
                  px-3
                  py-3
                  transition
                  hover:bg-black/30
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-white/[0.06]
                    text-lg
                  "
                >
                  📎
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {attachment.name}
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    Dosyayı aç
                  </p>
                </div>

                <span className="shrink-0 text-zinc-500">
                  ↗
                </span>
              </a>
            )}
          </div>
        )}

        {/* MESSAGE */}

        {text && (
          <div
            className={`
              min-w-0
              overflow-hidden
              text-sm
              leading-7
              sm:text-[15px]

              ${
                isUser
                  ? "text-white"
                  : "text-zinc-200"
              }
            `}
          >
            <ReactMarkdown
              remarkPlugins={[
                remarkGfm,
              ]}
              components={{
                p({ children }) {
                  return (
                    <p className="mb-4 break-words last:mb-0">
                      {children}
                    </p>
                  );
                },

                h1({ children }) {
                  return (
                    <h1 className="mb-4 mt-6 break-words text-2xl font-bold text-white first:mt-0">
                      {children}
                    </h1>
                  );
                },

                h2({ children }) {
                  return (
                    <h2 className="mb-3 mt-6 break-words text-xl font-semibold text-white first:mt-0">
                      {children}
                    </h2>
                  );
                },

                h3({ children }) {
                  return (
                    <h3 className="mb-3 mt-5 break-words text-lg font-semibold text-white first:mt-0">
                      {children}
                    </h3>
                  );
                },

                ul({ children }) {
                  return (
                    <ul className="mb-4 list-disc space-y-1 pl-6">
                      {children}
                    </ul>
                  );
                },

                ol({ children }) {
                  return (
                    <ol className="mb-4 list-decimal space-y-1 pl-6">
                      {children}
                    </ol>
                  );
                },

                li({ children }) {
                  return (
                    <li className="break-words">
                      {children}
                    </li>
                  );
                },

                blockquote({
                  children,
                }) {
                  return (
                    <blockquote className="my-4 border-l-2 border-zinc-600 pl-4 italic text-zinc-400">
                      {children}
                    </blockquote>
                  );
                },

                a({
                  href,
                  children,
                }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-400 underline decoration-blue-400/30 underline-offset-4 transition hover:text-blue-300"
                    >
                      {children}
                    </a>
                  );
                },

                table({
                  children,
                }) {
                  return (
                    <div className="my-5 w-full overflow-x-auto rounded-xl border border-white/10">
                      <table className="min-w-full text-left text-sm">
                        {children}
                      </table>
                    </div>
                  );
                },

                th({ children }) {
                  return (
                    <th className="whitespace-nowrap border-b border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-zinc-200">
                      {children}
                    </th>
                  );
                },

                td({ children }) {
                  return (
                    <td className="border-b border-white/[0.06] px-4 py-3 text-zinc-400">
                      {children}
                    </td>
                  );
                },

                hr() {
                  return (
                    <hr className="my-6 border-white/10" />
                  );
                },

                code({
                  className,
                  children,
                  ...props
                }) {
                  const languageMatch =
                    /language-(\w+)/.exec(
                      className || ""
                    );

                  const code =
                    String(children).replace(
                      /\n$/,
                      ""
                    );

                  const isCodeBlock =
                    Boolean(
                      languageMatch
                    );

                  if (isCodeBlock) {
                    const language =
                      languageMatch?.[1] ||
                      "code";

                    return (
                      <div className="my-5 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-2.5">
                          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            {language}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              copyCode(code)
                            }
                            className="
                              shrink-0
                              rounded-lg
                              border
                              border-white/10
                              bg-white/[0.03]
                              px-2.5
                              py-1.5
                              text-[11px]
                              text-zinc-400
                              transition
                              hover:bg-white/[0.08]
                              hover:text-white
                            "
                          >
                            Kopyala
                          </button>
                        </div>

                        <pre className="max-w-full overflow-x-auto p-4 text-[13px] leading-7 text-zinc-200">
                          <code
                            className={`font-mono ${
                              className || ""
                            }`}
                            {...props}
                          >
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  }

                  return (
                    <code
                      className="
                        break-words
                        rounded-md
                        border
                        border-white/10
                        bg-black/20
                        px-1.5
                        py-0.5
                        font-mono
                        text-[0.9em]
                        text-zinc-100
                      "
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}

        {/* COPY */}

        {!isUser &&
          text && (
            <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-3">
              <button
                type="button"
                onClick={copyText}
                className="
                  rounded-lg
                  border
                  border-white/10
                  bg-white/[0.025]
                  px-2.5
                  py-1.5
                  text-[11px]
                  text-zinc-500
                  transition
                  hover:bg-white/[0.06]
                  hover:text-zinc-200
                "
              >
                {copied
                  ? "✓ Kopyalandı"
                  : "Kopyala"}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}