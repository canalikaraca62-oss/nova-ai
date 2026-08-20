import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

const MAX_MEMORIES = 20;

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
      response.status,
      errorText
    );

    throw new Error(
      `AI servisi kullanılamıyor. HTTP ${response.status}`
    );
  }

  const data = await response.json();

console.log(
  "GROQ RESPONSE:",
  JSON.stringify(data, null, 2)
);

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

/**
 * Kullanıcının QELVORA hafızalarını getirir.
 */
async function getUserMemories(
  userId?: string
) {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } =
      await supabaseAdmin
        .from("memories")
        .select(
          "id, content, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(MAX_MEMORIES);

    if (error) {
      console.error(
        "Memory okuma hatası:",
        error
      );

      return [];
    }

    return data || [];
  } catch (error) {
    console.error(
      "Memory sistem hatası:",
      error
    );

    return [];
  }
}

/**
 * Kullanıcı hafızalarını AI için
 * güvenli ve sade bir context haline getirir.
 */
function buildMemoryContext(
  memories: Array<{
    content: string;
  }>
) {
  if (!memories.length) {
    return "";
  }

  const memoryText = memories
    .map(
      (memory, index) =>
        `${index + 1}. ${memory.content}`
    )
    .join("\n");

  return `
KULLANICI HAFIZASI

Aşağıdaki bilgiler kullanıcının daha önce
QELVORA ile paylaştığı ve gelecekte yardımcı
olabilecek bilgileridir.

${memoryText}

Hafıza kullanım kuralları:

- Bu bilgileri yalnızca gerçekten ilgili olduğunda kullan.
- Kullanıcı söylemediği bir bilgiyi hafızadan çıkarıp uydurma.
- Hafızadaki bilgiler ile mevcut mesaj çelişirse mevcut kullanıcı mesajını esas al.
- Hafızayı kullanıcıya gereksiz yere listeleme.
- Kullanıcı "bunu hatırlıyor musun?" gibi bir şey sorarsa hafızadaki ilgili bilgiyi kullan.
- Hassas veya gereksiz çıkarımlar yapma.
`.trim();
}

export async function askQelvora(
  messages: ChatMessage[],
  userId?: string
) {
  const memories =
    await getUserMemories(userId);

  const memoryContext =
    buildMemoryContext(memories);

  const systemPrompt = `
Sen QELVORA isimli gelişmiş bir yapay zekâ asistanısın.

Kimliğin:
- Profesyonel
- Zeki
- Açık
- Güvenilir
- Kullanıcı odaklı
- Yardımcı
- Teknoloji konusunda güçlü

Davranış kuralları:

- Kullanıcının dilinde cevap ver.
- Türkçe sorulara Türkçe cevap ver.
- Gereksiz tekrar yapma.
- Gereksiz uzunlukta cevap verme.
- Kullanıcı özellikle detay isterse kapsamlı cevap ver.
- Karmaşık konuları anlaşılır şekilde açıkla.
- Yazılım konusunda uzman davran.
- Kod verirken temiz ve üretime uygun kod yaz.
- Kullanıcının önceki mesajlarındaki bağlamı dikkate al.
- Emin olmadığın bilgileri kesin gerçek gibi sunma.
- Kullanıcı bir dosya sağladıysa mevcut dosya içeriğini dikkate al.
- Kullanıcının kişisel tercihlerini ve devam eden projelerini ilgili olduğunda hatırla.
- Aynı şeyi kullanıcıya tekrar tekrar sordurma.
- Kullanıcı daha önce verdiği bilgiyi tekrar vermek zorunda kalmamalı.
${memoryContext
  ? `\n\n${memoryContext}`
  : ""}
`.trim();

  return callGroq(
    [
      {
        role: "system",
        content: systemPrompt,
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
  const cleanMessage = firstMessage.trim();

  if (!cleanMessage) {
    return "Yeni Sohbet";
  }

  // Çok kısa selamlaşmalarda AI çağırmaya gerek yok
  const shortGreetings = [
    "merhaba",
    "selam",
    "hey",
    "sa",
    "slm",
    "günaydın",
    "iyi akşamlar",
  ];

  if (
    shortGreetings.includes(
      cleanMessage.toLocaleLowerCase("tr-TR")
    )
  ) {
    return "Yeni Sohbet";
  }

  try {
    const title = await callGroq(
      [
        {
          role: "system",
          content:
            "En fazla 5 kelimelik kısa bir Türkçe sohbet başlığı yaz. Sadece başlığı yaz. Açıklama, düşünme veya başka metin ekleme.",
        },
        {
          role: "user",
          content: cleanMessage,
        },
      ],
      {
        temperature: 0.2,
        maxTokens: 500,
      }
    );

    const cleanedTitle = title
      .replace(/^["']|["']$/g, "")
      .replace(/[.!?]+$/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(" ");

    return cleanedTitle || "Yeni Sohbet";
  } catch (error) {
    console.error(
      "CHAT TITLE HATASI:",
      error
    );

    // Başlık oluşturulamazsa sohbeti bozma
    return "Yeni Sohbet";
  }
}