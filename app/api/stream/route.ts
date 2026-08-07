import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",

        stream: true,

        temperature: 0.7,

        messages: [
          {
            role: "system",
            content: `
Sen NOVA isimli gelişmiş bir yapay zekâ asistansın.

- Türkçe konuş.
- Profesyonel ol.
- Gereksiz uzun cevap verme.
`,
          },

          ...messages,
        ],
      }),
    }
  );

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}