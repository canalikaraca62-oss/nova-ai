"use client";

import { ChangeEvent, KeyboardEvent } from "react";

type ChatInputProps = {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;

  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;

  isUploading: boolean;

  isStreaming: boolean;
  stopStreaming: () => void;
};

export default function ChatInput({
  input,
  setInput,
  sendMessage,
  selectedFile,
  setSelectedFile,
  isUploading,
  isStreaming,
  stopStreaming,
}: ChatInputProps) {
  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (!isStreaming && !isUploading) {
        sendMessage();
      }
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-0 sm:px-2 pb-2 sm:pb-0">

      {/* INPUT CONTAINER */}
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/95 p-2 sm:p-3 shadow-xl">

        {/* TEXTAREA */}
        <textarea
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="QELVORA'ya bir şey sor..."
          disabled={isStreaming}
          rows={2}
          className="block w-full min-w-0 resize-none rounded-xl bg-transparent px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white placeholder:text-zinc-500 outline-none disabled:opacity-50"
        />

        {/* FILE */}
        {selectedFile && (
          <div className="mx-1 mb-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs sm:text-sm">

            <div className="min-w-0 truncate text-zinc-300">
              📎 {selectedFile.name}
            </div>

            {isUploading ? (
              <span className="shrink-0 text-yellow-400">
                Yükleniyor...
              </span>
            ) : !isStreaming ? (
              <button
                type="button"
                onClick={() =>
                  setSelectedFile(null)
                }
                className="shrink-0 text-red-400 hover:text-red-300"
              >
                Kaldır
              </button>
            ) : null}

          </div>
        )}

        {/* ACTIONS */}
        <div className="flex items-center justify-between gap-2">

          {/* FILE BUTTON */}
          <label
            className={`flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-300 transition hover:bg-zinc-700 sm:px-4 ${
              isStreaming
                ? "pointer-events-none opacity-50"
                : ""
            }`}
          >
            <span className="sm:hidden">
              📎
            </span>

            <span className="hidden sm:inline">
              📎 Dosya
            </span>

            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isStreaming}
            />
          </label>

          {/* SEND / STOP */}
          <button
            type="button"
            onClick={
              isStreaming
                ? stopStreaming
                : sendMessage
            }
            disabled={
              isUploading && !isStreaming
            }
            className={`flex h-10 min-w-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] sm:px-5 ${
              isStreaming
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:opacity-50`}
          >
            <span className="sm:hidden">
              {isStreaming
                ? "■"
                : isUploading
                ? "..."
                : "↑"}
            </span>

            <span className="hidden sm:inline">
              {isStreaming
                ? "Durdur"
                : isUploading
                ? "Yükleniyor..."
                : "Gönder"}
            </span>
          </button>

        </div>

      </div>
    </div>
  );
}