import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeImage(
  imageUrl: string,
  prompt: string
) {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",

    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
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
  });

  return (
    response.choices[0].message.content ??
    "Resim analiz edilemedi."
  );
}