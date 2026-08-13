"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Memory = {
  id: string;
  content: string;
  created_at: string;
};

export default function MemoryPage() {
  const router = useRouter();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMemories();
  }, []);

  async function loadMemories() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("memories")
        .select("id, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error("Hafızalar yüklenemedi:", error);
        return;
      }

      setMemories(data || []);
    } catch (error) {
      console.error("Hafıza yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteMemory(memoryId: string) {
    const ok = confirm("Bu hafıza kaydı silinsin mi?");

    if (!ok) return;

    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", memoryId);

    if (error) {
      console.error("Hafıza silme hatası:", error);
      alert("Hafıza silinemedi.");
      return;
    }

    setMemories((current) =>
      current.filter((memory) => memory.id !== memoryId)
    );
  }

  async function clearAllMemories() {
    const ok = confirm(
      "Tüm hafıza kayıtları silinsin mi? Bu işlem geri alınamaz."
    );

    if (!ok) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Tüm hafızayı silme hatası:", error);
      alert("Hafızalar silinemedi.");
      return;
    }

    setMemories([]);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">
          Hafızalar yükleniyor...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-3xl mx-auto">

        <button
          onClick={() => router.back()}
          className="mb-8 text-zinc-400 hover:text-white transition"
        >
          ← Geri
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              🧠 Hafıza
            </h1>

            <p className="text-zinc-400 mt-2">
              QELVORA'nın senin hakkında kaydettiği bilgiler.
            </p>
          </div>

          {memories.length > 0 && (
            <button
              onClick={clearAllMemories}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition"
            >
              Tümünü Sil
            </button>
          )}
        </div>

        {memories.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <p className="text-zinc-400">
              Henüz kayıtlı hafıza yok.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-white">
                    {memory.content}
                  </p>

                  <p className="text-xs text-zinc-500 mt-2">
                    {new Date(memory.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>

                <button
                  onClick={() => deleteMemory(memory.id)}
                  className="shrink-0 text-red-400 hover:text-red-300 transition"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}