type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile";

async function callGroq(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY bulunamadı."
    );
  }

  const response = await fetch(
    GROQ_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,

        temperature:
          options?.temperature ?? 0.7,

        ...(options?.maxTokens
          ? {
              max_tokens:
                options.maxTokens,
            }
          : {}),
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      "Groq API hatası:",
      response.status
    );

    throw new Error(
      `AI servisi kullanılamıyor. HTTP ${response.status}`
    );
  }

  const data = await response.json();

  const content =
    data?.choices?.[0]?.message?.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "AI boş bir cevap döndürdü."
    );
  }

  return content.trim();
}

export async function askQelvora(
  messages: ChatMessage[]
) {
  return callGroq(
    [
      {
        role: "system",

        content: `
Sen QELVORA isimli gelişmiş bir yapay zekâ asistanısın.

Kimliğin:
- Profesyonel
- Zeki
- Açık
- Güvenilir
- Kullanıcı odaklı

Davranış kuralları:
- Kullanıcının dilinde cevap ver.
- Türkçe sorulara Türkçe cevap ver.
- Gereksiz tekrar yapma.
- Gereksiz uzunlukta cevap verme.
- Karmaşık konuları anlaşılır şekilde açıkla.
- Yazılım konusunda uzman davran.
- Kod verirken temiz ve üretime uygun kod yaz.
- Kullanıcının önceki mesajlarındaki bağlamı dikkate al.
- Emin olmadığın bilgileri kesin gerçek gibi sunma.
- Kullanıcı bir dosya sağladıysa mevcut dosya içeriğini dikkate al.
        `.trim(),
      },

      ...messages,
    ],
    {
      temperature: 0.7,
    }
  );
}

export async function generateChatTitle(
  firstMessage: string
) {
  const cleanMessage =
    firstMessage.trim();

  if (!cleanMessage) {
    return "Yeni Sohbet";
  }

  const title =
    await callGroq(
      [
        {
          role: "system",

          content: `
Sen QELVORA için profesyonel sohbet başlıkları üreten bir asistansın.

Kurallar:
- En fazla 5 kelime.
- Türkçe yaz.
- Sadece başlığı döndür.
- Tırnak kullanma.
- Nokta kullanma.
- Emoji kullanma.
- Gereksiz kelimeler kullanma.
- Kullanıcının asıl konusunu mümkün olduğunca doğru özetle.
        `.trim(),
        },

        {
          role: "user",
          content: cleanMessage,
        },
      ],
      {
        temperature: 0.2,
        maxTokens: 30,
      }
    );

  return title
    .replace(/^["']|["']$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
}