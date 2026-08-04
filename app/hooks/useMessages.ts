import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function useMessages(chatId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) return;

    loadMessages();
  }, [chatId]);

  async function loadMessages() {
    setLoading(true);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setMessages(data || []);
    setLoading(false);
  }

  return {
    messages,
    loading,
    reload: loadMessages,
  };
}