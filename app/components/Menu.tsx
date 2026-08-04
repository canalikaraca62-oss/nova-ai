"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Chat = {
  id: string;
  title: string;
};

export default function Sidebar() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setChats(data || []);
  }

  async function newChat() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("chats")
      .insert({
        title: "Yeni Sohbet",
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    router.push(`/chat/${data.id}`);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-72 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">

      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-white">🚀 NOVA</h1>
        <p className="text-zinc-400 text-sm">
          Artificial Intelligence
        </p>
      </div>

      {/* Yeni Sohbet */}
      <div className="p-4">
        <button
          onClick={newChat}
          className="w-full bg-blue-600 hover:bg-blue-700 transition py-3 rounded-xl font-semibold"
        >
          ➕ Yeni Sohbet
        </button>
      </div>

      {/* Sohbetler */}
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
              <button
                key={chat.id}
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="w-full text-left bg-zinc-800 hover:bg-zinc-700 transition p-3 rounded-xl text-white rounded-lg"
              >
                💬 {chat.title}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Alt Menü */}
      <div className="border-t border-zinc-800 p-4 space-y-2">

        <button className="w-full text-left text-zinc-300 hover:text-white">
          ⚙️ Ayarlar
        </button>

        <button className="w-full text-left text-zinc-300 hover:text-white">
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