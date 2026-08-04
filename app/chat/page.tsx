"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    async function createChat() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("chats")
        .insert({
          title: "Yeni Sohbet",
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        return;
      }

      router.replace(`/chat/${data.id}`);
    }

    createChat();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      Sohbet hazırlanıyor...
    </div>
  );
}