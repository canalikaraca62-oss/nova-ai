import { supabase } from "@/lib/supabase";
export type StreamMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function streamChat(
  messages: StreamMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Oturum bulunamadı.");
  }

  const response = await fetch("/api/stream", {
    method: "POST",
    signal,

    headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${session.access_token}`,
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

  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        if (!trimmedLine.startsWith("data: ")) {
          continue;
        }

        const data = trimmedLine.slice(6).trim();

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

    // Stream sonunda buffer'da kalan son parçayı işle
    if (buffer.trim()) {
      const trimmedLine = buffer.trim();

      if (trimmedLine.startsWith("data: ")) {
        const data = trimmedLine
          .slice(6)
          .trim();

        if (
          data &&
          data !== "[DONE]"
        ) {
          try {
            const json = JSON.parse(data);

            const content =
              json.choices?.[0]?.delta?.content;

            if (content) {
              onChunk(content);
            }
          } catch (error) {
            console.error(
              "Son stream parçası parse edilemedi:",
              error
            );
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}