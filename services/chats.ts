import { supabase } from "@/lib/supabase";

export async function getChats(userId: string) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function createChat(userId: string) {
  const { data, error } = await supabase
    .from("chats")
    .insert({
      title: "Yeni Sohbet",
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function renameChat(
  chatId: string,
  title: string
) {
  const { data, error } = await supabase
    .from("chats")
    .update({
      title,
    })
    .eq("id", chatId)
    .select();

  console.log("UPDATE DATA:", data);
  console.log("UPDATE ERROR:", error);

  if (error) throw error;
}

export async function deleteChat(chatId: string) {
  // Önce mesajları sil
  const { error: messageError } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId);

  if (messageError) throw messageError;

  // Sonra sohbeti sil
  const { error: chatError } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId);

  if (chatError) throw chatError;
}