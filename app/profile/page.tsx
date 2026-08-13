"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");
      setUserId(user.id);
    } catch (error) {
      console.error("Profil yükleme hatası:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">
          Profil yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">

        <button
          onClick={() => router.back()}
          className="mb-8 text-zinc-400 hover:text-white transition"
        >
          ← Geri
        </button>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">

          <h1 className="text-3xl font-bold mb-2">
            👤 Profil
          </h1>

          <p className="text-zinc-400 mb-8">
            Hesap bilgilerin
          </p>

          <div className="space-y-6">

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                E-posta
              </label>

              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                {email}
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Kullanıcı ID
              </label>

              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 break-all text-sm text-zinc-300">
                {userId}
              </div>
            </div>

          </div>

          <div className="border-t border-zinc-800 mt-8 pt-6">

            <button
              onClick={logout}
              className="w-full bg-red-600 hover:bg-red-700 transition py-3 rounded-xl font-semibold"
            >
              🚪 Çıkış Yap
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}