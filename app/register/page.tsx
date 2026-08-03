"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");

    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl">
        <h1 className="text-3xl font-bold mb-6 text-center">
          NOVA Kayıt Ol
        </h1>

        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-zinc-800 border border-zinc-700"
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-6 rounded-lg bg-zinc-800 border border-zinc-700"
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg"
        >
          {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
        </button>

        <p className="text-center text-zinc-400 mt-6">
          Zaten hesabın var mı?
        </p>

        <a
          href="/login"
          className="block text-center text-blue-400 mt-2"
        >
          Giriş Yap
        </a>
      </div>
    </div>
  );
}