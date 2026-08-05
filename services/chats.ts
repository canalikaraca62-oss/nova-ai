import { supabase } from "@/lib/supabase";

export async function renameChat(
  chatId: string,
  title: string
) {
  const { error } = await supabase
    .from("chats")
    .update({
      title,
    })
    .eq("id", chatId);

  if (error) throw error;
}