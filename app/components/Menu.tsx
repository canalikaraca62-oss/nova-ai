"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

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

export default function Sidebar() {
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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

      router.push("/chat");
    } catch (error) {
      console.error(error);
    }
  }

  async function saveChatTitle(chatId: string) {
    if (!editingTitle.trim()) return;

    try {
      await renameChat(chatId, editingTitle.trim());

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
    <aside className="w-72 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      
      {/* LOGO */}
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-white">
          🚀 QELVORA
        </h1>

        <p className="text-zinc-400 text-sm">
          Artificial Intelligence
        </p>
      </div>

      {/* YENİ SOHBET */}
      <div className="p-4">
        <button
          onClick={newChat}
          className="w-full bg-blue-600 hover:bg-blue-700 transition py-3 rounded-xl font-semibold"
        >
          ➕ Yeni Sohbet
        </button>
      </div>

      {/* SOHBETLER */}
      <div className="flex-1 overflow-y-auto px-4">
        <p className="text-xs text-zinc-500 uppercase mb-3 tracking-wider">
          Son Sohbetler
        </p>

        <div className="space-y-2">
          {chats.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              Henüz sohbet yok.
            </p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className="bg-zinc-800 hover:bg-zinc-700 rounded-xl transition flex items-center justify-between"
              >
                {editingChatId === chat.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => saveChatTitle(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveChatTitle(chat.id);
                      }

                      if (e.key === "Escape") {
                        setEditingChatId(null);
                        setEditingTitle("");
                      }
                    }}
                    className="flex-1 bg-transparent outline-none text-white p-3"
                  />
                ) : (
                  <button
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="flex-1 text-left p-3 text-white"
                  >
                    💬 {chat.title}
                  </button>
                )}

                {/* YENİDEN ADLANDIR */}
                <button
                  onClick={() => {
                    setEditingChatId(chat.id);
                    setEditingTitle(chat.title);
                  }}
                  className="px-2 text-blue-400 hover:text-blue-300"
                  title="Yeniden Adlandır"
                >
                  <Pencil size={18} />
                </button>

                {/* SİL */}
                <button
                  onClick={() => removeChat(chat.id)}
                  className="px-3 text-red-400 hover:text-red-300"
                  title="Sohbeti Sil"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ALT MENÜ */}
      <div className="border-t border-zinc-800 p-4 space-y-2">
        
        <button
          onClick={() => {
            console.log("Ayarlar tıklandı");
          }}
          className="w-full text-left text-zinc-300 hover:text-white"
        >
          ⚙️ Ayarlar
        </button>

        <button
  onClick={() => router.push("/profile")}
  className="w-full text-left text-zinc-300 hover:text-white"
>
  👤 Profil
</button>

        <button
          onClick={logout}
          className="w-full text-left text-red-400 hover:text-red-300"
        >
          🚪 Çıkış Yap
        </button>

      </div>
    </aside>
  );
}