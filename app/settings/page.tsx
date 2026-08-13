"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
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
    } catch (error) {
      console.error("Ayarlar yükleme hatası:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    setMessage("");

    if (!newPassword || !confirmPassword) {
      setMessage("Lütfen iki alanı da doldurun.");
      return;
    }

    if (newPassword.length < 6) {
      setMessage(
        "Yeni şifre en az 6 karakter olmalıdır."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Şifreler eşleşmiyor.");
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (error) {
        throw error;
      }

      setNewPassword("");
      setConfirmPassword("");

      setMessage("Şifreniz başarıyla güncellendi.");
    } catch (error) {
      console.error(
        "Şifre değiştirme hatası:",
        error
      );

      setMessage(
        "Şifre değiştirilemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setSaving(false);
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
          Ayarlar yükleniyor...
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
            ⚙️ Ayarlar
          </h1>

          <p className="text-zinc-400 mb-8">
            Hesap ve güvenlik ayarlarını yönet.
          </p>

          {/* HESAP */}

          <section className="mb-8">

            <h2 className="text-xl font-semibold mb-4">
              Hesap
            </h2>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                E-posta adresi
              </label>

              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-zinc-300">
                {email}
              </div>
            </div>

          </section>

          {/* ŞİFRE */}

          <section className="border-t border-zinc-800 pt-8">

            <h2 className="text-xl font-semibold mb-2">
              🔐 Şifre
            </h2>

            <p className="text-sm text-zinc-400 mb-5">
              Hesabınızın şifresini değiştirebilirsiniz.
            </p>

            <div className="space-y-4">

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Yeni şifre
                </label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  placeholder="Yeni şifreniz"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Yeni şifre tekrar
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Yeni şifrenizi tekrar yazın"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={changePassword}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition py-3 rounded-xl font-semibold"
              >
                {saving
                  ? "Güncelleniyor..."
                  : "Şifreyi Güncelle"}
              </button>

              {message && (
                <p className="text-sm text-zinc-300 bg-zinc-800 rounded-xl p-4">
                  {message}
                </p>
              )}

            </div>

          </section>
{/* HAFIZA */}

<section className="border-t border-zinc-800 pt-8">

  <h2 className="text-xl font-semibold mb-2">
    🧠 Hafıza
  </h2>

  <p className="text-sm text-zinc-400 mb-4">
    QELVORA'nın senin hakkında kaydettiği bilgileri görüntüle ve yönet.
  </p>

  <button
    onClick={() => router.push("/memory")}
    className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition py-3 rounded-xl font-semibold"
  >
    🧠 Hafızayı Yönet
  </button>

</section>
          {/* ÇIKIŞ */}

          <section className="border-t border-zinc-800 mt-8 pt-8">

            <h2 className="text-xl font-semibold mb-2">
              Oturum
            </h2>

            <p className="text-sm text-zinc-400 mb-4">
              QELVORA hesabınızdan çıkış yapın.
            </p>

            <button
              onClick={logout}
              className="w-full bg-red-600 hover:bg-red-700 transition py-3 rounded-xl font-semibold"
            >
              🚪 Çıkış Yap
            </button>

          </section>

        </div>
      </div>
    </main>
  );
}