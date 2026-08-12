export async function analyzeImage(imageUrl: string) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },

      body: JSON.stringify({
        model:
          "meta-llama/llama-4-maverick-17b-128e-instruct",

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

Türkçe cevap ver.
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

        temperature: 0.3,
        max_completion_tokens: 1200,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "GROQ VISION HATASI:",
      errorText
    );

    throw new Error(
      "Görsel analiz servisi cevap veremedi."
    );
  }

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content ??
    ""
  );
}