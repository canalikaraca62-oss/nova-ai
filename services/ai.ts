import {
  supabase,
} from "@/lib/supabase";

export async function generateChatTitle(
  firstMessage: string
) {
  const {
    data: {
      session,
    },
    error: sessionError,
  } =
    await supabase.auth.getSession();

  if (sessionError) {
    console.error(
      "SESSION HATASI:",
      sessionError
    );

    throw new Error(
      "Oturum bilgisi alınamadı."
    );
  }

  if (
    !session?.access_token
  ) {
    throw new Error(
      "Oturum bulunamadı. Lütfen tekrar giriş yapın."
    );
  }

  const response =
    await fetch(
      "/api/chat",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${session.access_token}`,
        },

        body:
          JSON.stringify({
            generateTitle:
              true,

            firstMessage,
          }),
      }
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {
    console.error(
      "CHAT TITLE API HATASI:",
      data
    );

    throw new Error(
      data.reply ||
      "Başlık oluşturulamadı."
    );
  }

  if (
    typeof data.reply !==
      "string" ||
    !data.reply.trim()
  ) {
    throw new Error(
      "Geçerli bir sohbet başlığı oluşturulamadı."
    );
  }

  return data.reply.trim();
}