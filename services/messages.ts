import { supabase } from "@/lib/supabase";

export async function loadMessages(chatId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data;
}

export async function addUserMessage(
  chatId: string,
  content: string
) {
  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content,
  });

  if (error) throw error;
}

export async function addAssistantMessage(
  chatId: string,
  content: string
) {
  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "assistant",
    content,
  });

  if (error) throw error;
}