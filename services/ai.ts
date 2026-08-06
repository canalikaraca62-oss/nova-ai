export async function generateChatTitle(firstMessage: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generateTitle: true,
      firstMessage,
    }),
  });

  if (!response.ok) {
    throw new Error("Başlık oluşturulamadı.");
  }

  const data = await response.json();

  return data.reply;
}