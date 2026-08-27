import { supabase } from "@/lib/supabase";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Chat = {
  id: string;
  title: string;
  user_id: string;
  created_at?: string;
};

export async function sendChatMessage(
  messages: ChatMessage[],
  file?: string
) {
  const {
    data: {
      session,
    },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (
    sessionError ||
    !session?.access_token
  ) {
    throw new Error(
      "Oturum bulunamadı."
    );
  }

  const response =
    await fetch(
      "/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          messages,

          ...(file
            ? {
                file,
              }
            : {}),
        }),
      }
    );

  let data: {
    reply?: unknown;
  };

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Sunucudan geçersiz yanıt alındı."
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.reply ===
        "string"
        ? data.reply
        : "AI yanıtı alınamadı."
    );
  }

  if (
    typeof data?.reply !==
      "string"
  ) {
    throw new Error(
      "AI geçerli bir yanıt döndürmedi."
    );
  }

  return data.reply;
}

export async function getChats(
  userId: string
): Promise<Chat[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from("chats")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getChat(
  chatId: string
): Promise<Chat> {
  const {
    data,
    error,
  } =
    await supabase
      .from("chats")
      .select("*")
      .eq(
        "id",
        chatId
      )
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createChat(
  userId: string,
  title = "Yeni Sohbet"
): Promise<Chat> {
  const {
    data,
    error,
  } =
    await supabase
      .from("chats")
      .insert({
        title,
        user_id: userId,
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function renameChat(
  chatId: string,
  title: string
): Promise<Chat> {
  const cleanTitle =
    title.trim();

  if (!cleanTitle) {
    throw new Error(
      "Sohbet başlığı boş olamaz."
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("chats")
      .update({
        title: cleanTitle,
      })
      .eq(
        "id",
        chatId
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteChat(
  chatId: string
): Promise<void> {
  const {
    error: messageError,
  } =
    await supabase
      .from("messages")
      .delete()
      .eq(
        "chat_id",
        chatId
      );

  if (messageError) {
    throw messageError;
  }

  const {
    error: chatError,
  } =
    await supabase
      .from("chats")
      .delete()
      .eq(
        "id",
        chatId
      );

  if (chatError) {
    throw chatError;
  }
}