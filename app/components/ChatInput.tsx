"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useRef,
} from "react";

import {
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";

type ChatInputProps = {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;

  selectedFile: File | null;
  setSelectedFile: (
    file: File | null
  ) => void;

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
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);

    event.target.value = "";
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        !isStreaming &&
        !isUploading &&
        (
          input.trim() ||
          selectedFile
        )
      ) {
        sendMessage();
      }
    }
  }

  const canSend =
    Boolean(
      input.trim() ||
      selectedFile
    ) &&
    !isUploading &&
    !isStreaming;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div
        className="
          overflow-hidden
          rounded-3xl
          border
          border-white/10
          bg-zinc-900/80
          shadow-2xl
          shadow-black/30
          backdrop-blur-xl
          transition
          focus-within:border-white/20
          focus-within:bg-zinc-900
        "
      >
        {/* DOSYA ÖNİZLEME */}

        {selectedFile && (
          <div
            className="
              mx-3
              mt-3
              flex
              min-w-0
              items-center
              gap-3
              rounded-2xl
              border
              border-white/10
              bg-white/[0.04]
              px-3
              py-2.5
              sm:mx-4
              sm:mt-4
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-white/[0.06]
                text-zinc-300
              "
            >
              <Paperclip size={17} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {selectedFile.name}
              </p>

              <p className="mt-0.5 text-xs text-zinc-500">
                {isUploading
                  ? "Dosya yükleniyor..."
                  : "Mesajla birlikte gönderilecek"}
              </p>
            </div>

            {!isUploading &&
              !isStreaming && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFile(
                      null
                    )
                  }
                  className="
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    text-zinc-500
                    transition
                    hover:bg-white/[0.06]
                    hover:text-white
                  "
                  aria-label="Dosyayı kaldır"
                >
                  <X size={16} />
                </button>
              )}
          </div>
        )}

        {/* TEXTAREA */}

        <textarea
          value={input}
          onChange={(event) =>
            setInput(
              event.target.value
            )
          }
          onKeyDown={handleKeyDown}
          placeholder="SYRAVEN'a bir şey sor..."
          disabled={
            isStreaming ||
            isUploading
          }
          rows={1}
          className="
            block
            min-h-[64px]
            max-h-48
            w-full
            resize-none
            bg-transparent
            px-4
            pt-4
            pb-2
            text-[15px]
            leading-6
            text-white
            outline-none
            placeholder:text-zinc-500
            disabled:cursor-not-allowed
            disabled:opacity-60
            sm:px-5
            sm:text-base
          "
        />

        {/* ALT ACTION BAR */}

        <div
          className="
            flex
            items-center
            justify-between
            gap-3
            px-3
            pb-3
            sm:px-4
            sm:pb-4
          "
        >
          {/* DOSYA EKLE */}

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={
              isStreaming ||
              isUploading
            }
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-white/10
              bg-white/[0.035]
              text-zinc-400
              transition
              hover:bg-white/[0.08]
              hover:text-white
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
            aria-label="Dosya ekle"
          >
            <Paperclip size={18} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={
              isStreaming ||
              isUploading
            }
          />

          {/* SAĞ TARAF */}

          <div className="flex items-center gap-2">
            {!isStreaming && (
              <span className="hidden text-xs text-zinc-600 sm:inline">
                Enter ile gönder
              </span>
            )}

            <button
              type="button"
              onClick={
                isStreaming
                  ? stopStreaming
                  : sendMessage
              }
              disabled={
                !isStreaming &&
                !canSend
              }
              className={`
                flex
                h-10
                min-w-[40px]
                items-center
                justify-center
                rounded-xl
                px-3
                transition
                active:scale-95
                disabled:cursor-not-allowed
                disabled:opacity-40

                ${
                  isStreaming
                    ? `
                      bg-red-500
                      text-white
                      hover:bg-red-600
                    `
                    : `
                      bg-white
                      text-black
                      hover:bg-zinc-200
                    `
                }
              `}
              aria-label={
                isStreaming
                  ? "Durdur"
                  : "Gönder"
              }
            >
              {isStreaming ? (
                <>
                  <Square
                    size={15}
                    fill="currentColor"
                  />

                  <span className="ml-2 hidden text-sm font-medium sm:inline">
                    Durdur
                  </span>
                </>
              ) : isUploading ? (
                <span className="text-sm">
                  ...
                </span>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      <p
        className="
          mt-2
          px-2
          text-center
          text-[11px]
          leading-5
          text-zinc-600
        "
      >
        SYRAVEN hata yapabilir. Önemli bilgileri kontrol edin.
      </p>
    </div>
  );
}