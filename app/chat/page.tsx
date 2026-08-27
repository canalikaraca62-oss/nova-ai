"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function ChatPage() {
  const router = useRouter();

  const hasCreatedConversation =
    useRef(false);

  useEffect(() => {
    async function createConversation() {
      if (
        hasCreatedConversation.current
      ) {
        return;
      }

      hasCreatedConversation.current =
        true;

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");

        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("conversations")
        .insert({
          title: "Yeni Sohbet",
          user_id: user.id,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error(
          "SOHBET OLUŞTURMA HATASI:",
          error
        );

        hasCreatedConversation.current =
          false;

        return;
      }

      router.replace(
        `/chat/${data.id}`
      );
    }

    createConversation();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

        <p className="text-sm text-zinc-400">
          Yeni sohbet hazırlanıyor...
        </p>
      </div>
    </main>
  );
}