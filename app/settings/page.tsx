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

  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memorySaving, setMemorySaving] = useState(false);

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

      const { data: settings, error: settingsError } =
        await supabase
          .from("user_settings")
          .select("memory_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

      if (settingsError) {
        console.error(
          "Kullanıcı ayarları yükleme hatası:",
          settingsError
        );
      }

      if (settings) {
        setMemoryEnabled(settings.memory_enabled);
      } else {
        const { error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            memory_enabled: true,
          });

        if (insertError) {
          console.error(
            "Varsayılan ayar oluşturma hatası:",
            insertError
          );
        }

        setMemoryEnabled(true);
      }
    } catch (error) {
      console.error("Ayarlar yükleme hatası:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function toggleMemory() {
    setMemorySaving(true);

    const nextValue = !memoryEnabled;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            memory_enabled: nextValue,
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        console.error(
          "Hafıza ayarı güncelleme hatası:",
          error
        );
        return;
      }

      setMemoryEnabled(nextValue);
    } catch (error) {
      console.error(
        "Hafıza ayarı hatası:",
        error
      );
    } finally {
      setMemorySaving(false);
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

          {/* HAFIZA */}

          <section className="border-t border-zinc-800 pt-8 mb-8">

            <h2 className="text-xl font-semibold mb-2">
              🧠 Kalıcı Hafıza
            </h2>

            <p className="text-sm text-zinc-400 mb-5">
              QELVORA'nın senin hakkında önemli
              bilgileri hatırlamasına izin ver.
            </p>

            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 flex items-center justify-between gap-4">

              <div>
                <p className="font-semibold">
                  Hafızayı kullan
                </p>

                <p className="text-sm text-zinc-400 mt-1">
                  {memoryEnabled
                    ? "QELVORA önemli bilgileri hatırlayabilir."
                    : "QELVORA yeni hafıza bilgileri kaydetmez ve mevcut hafızayı kullanmaz."}
                </p>
              </div>

              <button
                onClick={toggleMemory}
                disabled={memorySaving}
                className={`relative w-14 h-8 rounded-full transition ${
                  memoryEnabled
                    ? "bg-blue-600"
                    : "bg-zinc-600"
                } disabled:opacity-50`}
                aria-label="Hafıza ayarını değiştir"
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition ${
                    memoryEnabled
                      ? "left-7"
                      : "left-1"
                  }`}
                />
              </button>

            </div>

            <p className="text-xs text-zinc-500 mt-3">
              Bu ayarı istediğin zaman değiştirebilirsin.
            </p>

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