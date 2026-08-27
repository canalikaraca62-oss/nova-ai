"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleRegister() {
    if (loading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail =
      email.trim();

    if (!cleanEmail) {
      setErrorMessage(
        "Lütfen e-posta adresini gir."
      );

      return;
    }

    if (!cleanEmail.includes("@")) {
      setErrorMessage(
        "Geçerli bir e-posta adresi gir."
      );

      return;
    }

    if (!password) {
      setErrorMessage(
        "Lütfen bir şifre oluştur."
      );

      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        "Şifren en az 6 karakter olmalı."
      );

      return;
    }

    if (
      password !== confirmPassword
    ) {
      setErrorMessage(
        "Şifreler birbiriyle eşleşmiyor."
      );

      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

      if (error) {
        setErrorMessage(
          error.message
        );

        return;
      }

      if (!data.session) {
        setSuccessMessage(
          "Kayıt başarılı! E-posta adresine gönderilen doğrulama bağlantısını kontrol et."
        );

        return;
      }

      router.replace("/chat");
      router.refresh();
    } catch (error) {
      console.error(
        "REGISTER HATASI:",
        error
      );

      setErrorMessage(
        "Kayıt sırasında beklenmeyen bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-white sm:px-6">
      {/* BACKGROUND GLOW */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl sm:h-96 sm:w-96" />

        <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl sm:h-96 sm:w-96" />

        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* LOGO */}
        <div className="mb-6 text-center sm:mb-8">
          <Link
            href="/"
            className="text-2xl font-bold tracking-[0.2em] sm:text-3xl"
          >
            SYRAVEN
          </Link>

          <p className="mt-2 text-sm text-zinc-500">
            AI workspace
          </p>
        </div>

        {/* CARD */}
        <div className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Hesabını oluştur
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              SYRAVEN ile daha akıllı çalışmaya başla.
            </p>
          </div>

          {/* ERROR */}
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          {/* SUCCESS */}
          {successMessage && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            {/* EMAIL */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                E-posta
              </label>

              <input
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                disabled={loading}
                autoComplete="email"
                className="h-12 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Şifre
              </label>

              <input
                type="password"
                placeholder="En az 6 karakter"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                disabled={loading}
                autoComplete="new-password"
                className="h-12 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Şifreyi doğrula
              </label>

              <input
                type="password"
                placeholder="Şifreni tekrar gir"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    handleRegister();
                  }
                }}
                disabled={loading}
                autoComplete="new-password"
                className="h-12 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* SUBMIT */}
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="h-12 w-full rounded-xl bg-white font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Hesap oluşturuluyor..."
                : "Ücretsiz hesap oluştur"}
            </button>
          </div>

          {/* DIVIDER */}
          <div className="relative my-7">
            <div className="border-t border-zinc-800" />
          </div>

          {/* LOGIN */}
          <p className="text-center text-sm text-zinc-500">
            Zaten bir hesabın var mı?
          </p>

          <Link
            href="/login"
            className="mt-2 block text-center font-medium text-blue-400 transition hover:text-blue-300"
          >
            Giriş yap
          </Link>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-600">
          Ücretsiz başla. İstediğin zaman devam et.
        </p>
      </div>
    </main>
  );
}