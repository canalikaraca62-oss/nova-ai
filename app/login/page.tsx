"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin() {
  setLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setLoading(false);
    alert(error.message);
    return;
  }

  console.log("LOGIN USER:", data.user);
  console.log("LOGIN SESSION:", data.session);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("SESSION LOGIN SONRASI:", session);
  console.log("USER LOGIN SONRASI:", session?.user?.id);

  setLoading(false);

  if (!session) {
    alert("Giriş başarılı görünüyor ama Supabase session oluşturmadı.");
    return;
  }

  router.replace("/chat");
  router.refresh();
}

  async function handleForgotPassword() {
    if (!email) {
      alert("Önce e-posta adresinizi girin.");
      return;
    }

    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setResetLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl">
        <h1 className="text-3xl font-bold mb-6 text-center">
          QELVORA Giriş
        </h1>

        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-zinc-800 border border-zinc-700 outline-none focus:border-blue-500"
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-2 rounded-lg bg-zinc-800 border border-zinc-700 outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={resetLoading}
          className="block ml-auto mb-6 text-sm text-blue-400 hover:text-blue-300 transition"
        >
          {resetLoading
            ? "Gönderiliyor..."
            : "Şifrenizi mi unuttunuz?"}
        </button>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 rounded-lg font-semibold transition"
        >
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <p className="text-center text-zinc-400 mt-6">
          Hesabın yok mu?
        </p>

        <a
          href="/register"
          className="block text-center text-blue-400 mt-2 hover:text-blue-300"
        >
          Kayıt Ol
        </a>
      </div>
    </div>
  );
}