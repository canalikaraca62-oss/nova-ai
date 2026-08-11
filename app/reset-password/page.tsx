"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    if (!password || !confirmPassword) {
      alert("Lütfen tüm alanları doldurun.");
      return;
    }

    if (password.length < 6) {
      alert("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Şifreniz başarıyla değiştirildi.");

    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl">
        <h1 className="text-3xl font-bold mb-3 text-center">
          Yeni Şifre
        </h1>

        <p className="text-center text-zinc-400 mb-8">
          Hesabınız için yeni bir şifre belirleyin.
        </p>

        <input
          type="password"
          placeholder="Yeni şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-zinc-800 border border-zinc-700 outline-none focus:border-blue-500"
        />

        <input
          type="password"
          placeholder="Yeni şifre tekrar"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(e.target.value)
          }
          className="w-full p-3 mb-6 rounded-lg bg-zinc-800 border border-zinc-700 outline-none focus:border-blue-500"
        />

        <button
          onClick={handleResetPassword}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 rounded-lg font-semibold transition"
        >
          {loading
            ? "Şifre değiştiriliyor..."
            : "Şifreyi Değiştir"}
        </button>

        <button
          onClick={() => router.push("/login")}
          className="w-full mt-4 text-zinc-400 hover:text-white transition"
        >
          Giriş sayfasına dön
        </button>
      </div>
    </div>
  );
}