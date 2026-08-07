import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeImage(imageUrl: string) {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
Bu görseli ayrıntılı analiz et.

Eğer:
- ekran görüntüsü ise hataları açıkla
- matematik sorusu ise çöz
- grafik ise yorumla
- tablo ise analiz et
- belge ise özetle
- fotoğraf ise gördüklerini anlat
`,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    max_tokens: 1200,
  });

  return response.choices[0].message.content ?? "";
}