"use client";

import { X, Menu as MenuIcon } from "lucide-react";

type MenuProps = {
  open: boolean;
  onClose: () => void;
};

export default function Menu({
  open,
  onClose,
}: MenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        md:hidden
      "
    >
      {/* ARKA PLAN */}
      <button
        type="button"
        aria-label="Menüyü kapat"
        onClick={onClose}
        className="
          absolute
          inset-0
          h-full
          w-full
          bg-black/60
          backdrop-blur-sm
        "
      />

      {/* MENÜ */}
      <div
        className="
          absolute
          left-0
          top-0
          flex
          h-full
          w-[280px]
          flex-col
          border-r
          border-zinc-800
          bg-zinc-950
          shadow-2xl
        "
      >
        {/* HEADER */}
        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-zinc-800
            p-5
          "
        >
          <div>
            <h2 className="text-lg font-bold text-white">
              SYRAVEN
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Menü
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-zinc-800
              bg-zinc-900
              text-zinc-400
              transition
              hover:bg-zinc-800
              hover:text-white
            "
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* İÇERİK */}
        <div className="flex-1 p-4">
          <div
            className="
              flex
              items-center
              gap-3
              rounded-xl
              border
              border-zinc-800
              bg-zinc-900
              p-4
              text-zinc-400
            "
          >
            <MenuIcon size={20} />

            <span className="text-sm">
              SYRAVEN Menü
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}