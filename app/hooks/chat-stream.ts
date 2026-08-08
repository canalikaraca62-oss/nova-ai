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
  const text = decoder.decode(value, {
    stream: true,
  });

  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.startsWith("data: ")) {
      continue;
    }

    const data = line.slice(6).trim();

    if (data === "[DONE]") {
      continue;
    }

    try {
      const json = JSON.parse(data);

      const content =
        json.choices?.[0]?.delta?.content;

      if (content) {
        onChunk(content);
      }
    } catch (error) {
      console.error(
        "Stream JSON parse hatası:",
        error
      );
    }
  }
}
  }

  reader.releaseLock();
}