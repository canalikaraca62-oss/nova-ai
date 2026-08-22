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

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setLoading(false);

    if (!session) {
      alert(
        "Giriş başarılı görünüyor ama oturum oluşturulamadı."
      );
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

    const { error } =
      await supabase.auth.resetPasswordForEmail(
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
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8 sm:px-6">

      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <a
            href="/"
            className="text-2xl sm:text-3xl font-bold tracking-[0.2em]"
          >
            SYRAVEN
          </a>

          <p className="text-zinc-500 text-sm mt-2">
            AI workspace
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl sm:rounded-3xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl p-5 sm:p-8 shadow-2xl">

          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">
              Hoş geldin
            </h1>

            <p className="text-zinc-400 text-sm mt-2">
              SYRAVEN hesabına giriş yap.
            </p>
          </div>

          <div className="space-y-4">

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                E-posta
              </label>

              <input
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full min-w-0 h-12 px-4 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Şifre
              </label>

              <input
                type="password"
                placeholder="Şifren"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleLogin();
                  }
                }}
                className="w-full min-w-0 h-12 px-4 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white placeholder:text-zinc-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
              />
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="block ml-auto text-sm text-zinc-400 hover:text-blue-400 transition"
            >
              {resetLoading
                ? "Gönderiliyor..."
                : "Şifreni mi unuttun?"}
            </button>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50 transition"
            >
              {loading
                ? "Giriş yapılıyor..."
                : "Giriş Yap"}
            </button>
          </div>

          <div className="relative my-7">
            <div className="border-t border-zinc-800" />
          </div>

          <p className="text-center text-sm text-zinc-500">
            Henüz hesabın yok mu?
          </p>

          <a
            href="/register"
            className="block text-center mt-2 text-blue-400 hover:text-blue-300 font-medium transition"
          >
            Ücretsiz hesap oluştur
          </a>

        </div>

        <p className="text-center text-xs text-zinc-600 mt-5">
          SYRAVEN ile daha akıllı çalış.
        </p>

      </div>
    </main>
  );
}