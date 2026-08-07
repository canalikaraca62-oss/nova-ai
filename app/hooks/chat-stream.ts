export type StreamMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function streamChat(
  messages: StreamMessage[],
  onChunk: (chunk: string) => void
) {
  const response = await fetch("/api/stream", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error("Stream isteği başarısız.");
  }

  if (!response.body) {
    throw new Error("Response body bulunamadı.");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let finished = false;

  while (!finished) {
    const { value, done } =
      await reader.read();

    finished = done;

    if (value) {
      const text =
        decoder.decode(value, {
          stream: true,
        });

      onChunk(text);
    }
  }

  reader.releaseLock();
}