"use client";

import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  Brain,
  Settings,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <main
      className="
        min-h-screen
        bg-[#090a0f]
        text-white
      "
    >
      <div
        className="
          mx-auto
          max-w-4xl
          px-5
          py-8
          sm:px-8
        "
      >
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="
            mb-10
            flex
            items-center
            gap-2
            text-sm
            text-zinc-400
            transition
            hover:text-white
          "
        >
          <ArrowLeft size={18} />

          Geri dön
        </button>

        <div className="mb-10">
          <div
            className="
              mb-5
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl
              border
              border-white/[0.08]
              bg-white/[0.04]
            "
          >
            <Settings size={25} />
          </div>

          <h1
            className="
              text-3xl
              font-semibold
              tracking-tight
            "
          >
            Ayarlar
          </h1>

          <p
            className="
              mt-2
              text-sm
              text-zinc-500
            "
          >
            SYRAVEN deneyimini buradan
            yönetebilirsin.
          </p>
        </div>

        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            border-white/[0.07]
            bg-white/[0.025]
          "
        >
          <div
            className="
              flex
              items-center
              gap-4
              border-b
              border-white/[0.07]
              p-5
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-white/[0.05]
              "
            >
              <Brain
                size={19}
              />
            </div>

            <div>
              <h2 className="text-sm font-medium">
                Memory Sistemi
              </h2>

              <p
                className="
                  mt-1
                  text-xs
                  text-zinc-500
                "
              >
                Kaydedilen bilgileri
                Memories sayfasından
                yönetebilirsin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}