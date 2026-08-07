"use client";

import FileUpload from "./FileUpload";

type ChatInputProps = {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;

  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;

  isUploading: boolean;
};

export default function ChatInput({
  input,
  setInput,
  sendMessage,
  selectedFile,
  setSelectedFile,
  isUploading,
}: ChatInputProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">

      {selectedFile && (
        <div className="mb-2 flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
          <span className="text-sm text-green-400">
            📎 {selectedFile.name}
          </span>

          <button
            onClick={() => setSelectedFile(null)}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-3 items-center">

        <FileUpload
          onFileSelect={(file) =>
            setSelectedFile(file)
          }
        />

        <input
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          placeholder="NOVA'ya mesaj yaz..."
          disabled={isUploading}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
          className="flex-1 p-4 rounded-xl bg-zinc-800 text-white border border-zinc-700 outline-none focus:border-blue-500"
        />

        <button
          onClick={sendMessage}
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 transition px-6 py-4 rounded-xl disabled:opacity-50"
        >
          {isUploading
            ? "Yükleniyor..."
            : "Gönder"}
        </button>

      </div>

    </div>
  );
}