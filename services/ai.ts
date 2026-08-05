export async function askNova(messages: any[]) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",

        messages: [
          {
            role: "system",
            content: `
Sen NOVA isimli gelişmiş bir yapay zekâ asistansın.

Kurallar:

- Türkçe konuş.
- Profesyonel ol.
- Gereksiz uzun cevap verme.
- Yazılım konusunda uzmansın.
- Konuşmanın tamamını dikkate al.
`,
          },

          ...messages,
        ],

        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();

  return data.choices[0].message.content;
}

export async function generateChatTitle(firstMessage: string) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",

        messages: [
          {
            role: "system",
            content: `
Sen sohbet başlığı üreten bir asistansın.

Kurallar:

- En fazla 5 kelime.
- Sadece başlığı yaz.
- Tırnak kullanma.
- Nokta koyma.
- Türkçe yaz.
`,
          },
          {
            role: "user",
            content: firstMessage,
          },
        ],

        temperature: 0.2,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();

  return data.choices[0].message.content.trim();
}