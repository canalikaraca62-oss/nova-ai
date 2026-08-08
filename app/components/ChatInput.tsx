"use client";

import { ChangeEvent } from "react";

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
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (!isStreaming) {
        sendMessage();
      }
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="NOVA'ya bir şey sor..."
            disabled={isStreaming}
            rows={3}
            className="w-full resize-none rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:opacity-50"
          />

          {selectedFile && (
            <div className="mt-2 text-sm text-zinc-400">
              Seçilen dosya:{" "}
              <span className="text-white">
                {selectedFile.name}
              </span>

              <button
                type="button"
                onClick={() =>
                  setSelectedFile(null)
                }
                className="ml-2 text-red-400 hover:text-red-300"
              >
                Kaldır
              </button>
            </div>
          )}
        </div>

        <label
          className={`cursor-pointer px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition ${
            isStreaming
              ? "pointer-events-none opacity-50"
              : ""
          }`}
        >
          Dosya

          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isStreaming}
          />
        </label>

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
          className={`px-6 py-3 rounded-xl font-medium transition ${
            isStreaming
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          } disabled:opacity-50`}
        >
          {isStreaming
            ? "Durdur"
            : isUploading
            ? "Yükleniyor..."
            : "Gönder"}
        </button>
      </div>
    </div>
  );
}