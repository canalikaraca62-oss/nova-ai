"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Attachment = {
  name: string;
  url: string;
  type: string;
};

type MessageProps = {
  sender: "user" | "qelvora";
  text: string;
  attachment?: Attachment | null;
};

export default function Message({
  sender,
  text,
  attachment,
}: MessageProps) {
  const isUser = sender === "user";

  const isImage = attachment?.type.startsWith("image/");

  return (
    <div
      className={`flex mb-6 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-lg ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-900 border border-zinc-800 text-white"
        }`}
      >
        <div className="text-xs opacity-70 mb-3 font-semibold">
          {isUser ? "👤 Sen" : "🤖 QELVORA"}
        </div>

        {attachment && (
          <div className="mb-4">
            {isImage ? (
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-w-full max-h-80 rounded-xl object-contain"
              />
            ) : (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3 hover:bg-black/30 transition"
              >
                <span className="text-2xl">📎</span>

                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {attachment.name}
                  </div>

                  <div className="text-xs opacity-70">
                    Dosyayı aç
                  </div>
                </div>
              </a>
            )}
          </div>
        )}

        {text && (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match =
                    /language-(\w+)/.exec(className || "");

                  if (match) {
                    return (
                      <div className="rounded-xl overflow-hidden my-4">
                        <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 text-sm">
                          <span>{match[1]}</span>

                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                String(children)
                              )
                            }
                            className="hover:text-blue-400"
                          >
                            📋 Copy
                          </button>
                        </div>

                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }

                  return (
                    <code
                      className="bg-zinc-800 px-1 py-0.5 rounded"
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
      </div>
    </div>
  );
}