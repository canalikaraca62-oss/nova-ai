"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

import { supabase } from "@/lib/supabase";

import {
  getChats,
  createChat,
  deleteChat,
  renameChat,
} from "@/services/chats";

type Chat = {
  id: string;
  title: string;
};

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export default function Sidebar({
  open = false,
  onClose,
}: SidebarProps) {
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [editingChatId, setEditingChatId] =
    useState<string | null>(null);
  const [editingTitle, setEditingTitle] =
    useState("");

  useEffect(() => {
    loadChats();

    const channel = supabase
      .channel("chat-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        () => {
          loadChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadChats() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      const data = await getChats(user.id);
      setChats(data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function newChat() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      const chat = await createChat(user.id);

      onClose?.();
      router.push(`/chat/${chat.id}`);
    } catch (error) {
      console.error(error);
    }
  }

  async function removeChat(chatId: string) {
    const ok = confirm("Bu sohbet silinsin mi?");

    if (!ok) return;

    try {
      await deleteChat(chatId);
      await loadChats();

      onClose?.();
      router.push("/chat");
    } catch (error) {
      console.error(error);
    }
  }

  async function saveChatTitle(chatId: string) {
    if (!editingTitle.trim()) return;

    try {
      await renameChat(
        chatId,
        editingTitle.trim()
      );

      setEditingChatId(null);
      setEditingTitle("");

      await loadChats();
    } catch (error) {
      console.error(error);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* MOBİL ARKA PLAN */}
      {open && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50
          flex h-screen w-[280px] flex-col
          border-r border-zinc-800 bg-zinc-950
          transition-transform duration-300
          md:static md:z-auto md:translate-x-0
          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* LOGO */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              🚀 QELVORA
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Artificial Intelligence
            </p>
          </div>

          {/* MOBİL KAPAT */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white md:hidden"
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* YENİ SOHBET */}
        <div className="p-4">
          <button
            onClick={newChat}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            ➕ Yeni Sohbet
          </button>
        </div>

        {/* SOHBETLER */}
        <div className="flex-1 overflow-y-auto px-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
            Son Sohbetler
          </p>

          <div className="space-y-2">
            {chats.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Henüz sohbet yok.
              </p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-900 transition hover:bg-zinc-800"
                >
                  {editingChatId === chat.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) =>
                        setEditingTitle(
                          e.target.value
                        )
                      }
                      onBlur={() =>
                        saveChatTitle(chat.id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          saveChatTitle(chat.id);
                        }

                        if (e.key === "Escape") {
                          setEditingChatId(null);
                          setEditingTitle("");
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent p-3 text-white outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        onClose?.();
                        router.push(
                          `/chat/${chat.id}`
                        );
                      }}
                      className="min-w-0 flex-1 truncate p-3 text-left text-white"
                    >
                      💬 {chat.title}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingChatId(chat.id);
                      setEditingTitle(chat.title);
                    }}
                    className="px-2 text-blue-400 hover:text-blue-300"
                    title="Yeniden Adlandır"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    onClick={() =>
                      removeChat(chat.id)
                    }
                    className="px-3 text-red-400 hover:text-red-300"
                    title="Sohbeti Sil"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ALT MENÜ */}
        <div className="space-y-2 border-t border-zinc-800 p-4">
          <button
            onClick={() => {
              onClose?.();
              router.push("/settings");
            }}
            className="w-full rounded-lg px-2 py-2 text-left text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          >
            ⚙️ Ayarlar
          </button>

          <button
            onClick={() => {
              onClose?.();
              router.push("/profile");
            }}
            className="w-full rounded-lg px-2 py-2 text-left text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          >
            👤 Profil
          </button>

          <button
            onClick={() => {
              onClose?.();
              router.push("/memory");
            }}
            className="w-full rounded-lg px-2 py-2 text-left text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          >
            🧠 Hafıza
          </button>

          <button
            onClick={logout}
            className="w-full rounded-lg px-2 py-2 text-left text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            🚪 Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}