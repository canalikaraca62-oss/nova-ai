import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Memory = {
  id: string;
  content: string;
  created_at: string | null;
};

// --------------------------------------------------
// GROQ
// --------------------------------------------------

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

// --------------------------------------------------
// CONTEXT LIMITS
// --------------------------------------------------

const MAX_MEMORIES = 10;

const MAX_CHAT_MESSAGES = 12;

const MAX_HISTORY_MESSAGE_CHARS = 3000;

const MAX_LATEST_USER_MESSAGE_CHARS = 30000;

const MAX_CONTEXT_CHARS = 30000;

const MAX_MEMORY_CONTEXT_CHARS = 2500;

const DEFAULT_MAX_TOKENS = 2200;

const CHAT_TITLE_MAX_TOKENS = 500;

// --------------------------------------------------
// TEXT HELPERS
// --------------------------------------------------

function truncateText(
  text: string,
  maxLength: number,
  suffix =
    "\n\n[İçeriğin devamı bağlam sınırı nedeniyle kısaltıldı.]"
): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (suffix.length >= maxLength) {
    return text.slice(
      0,
      maxLength
    );
  }

  return (
    text.slice(
      0,
      Math.max(
        0,
        maxLength - suffix.length
      )
    ) + suffix
  );
}

// --------------------------------------------------
// CHAT CONTEXT
// --------------------------------------------------

function limitChatMessages(
  messages: ChatMessage[]
): ChatMessage[] {
  const validMessages =
    messages
      .filter(
        (message) =>
          message &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .slice(
        -MAX_CHAT_MESSAGES
      );

  if (
    validMessages.length === 0
  ) {
    return [];
  }

  const result: ChatMessage[] = [];

  let totalChars = 0;

  let latestUserIndex = -1;

  for (
    let i =
      validMessages.length - 1;
    i >= 0;
    i--
  ) {
    if (
      validMessages[i].role ===
      "user"
    ) {
      latestUserIndex = i;

      break;
    }
  }

  // ----------------------------------------------
  // EN SON KULLANICI MESAJI
  // ----------------------------------------------

  if (
    latestUserIndex !== -1
  ) {
    const latestUserMessage =
      validMessages[
        latestUserIndex
      ];

    const latestContent =
      truncateText(
        latestUserMessage.content.trim(),
        MAX_LATEST_USER_MESSAGE_CHARS
      );

    result.unshift({
      role: "user",
      content: latestContent,
    });

    totalChars +=
      latestContent.length;
  }

  // ----------------------------------------------
  // DİĞER MESAJLAR
  // ----------------------------------------------

  for (
    let i =
      validMessages.length - 1;
    i >= 0;
    i--
  ) {
    if (
      i === latestUserIndex
    ) {
      continue;
    }

    const message =
      validMessages[i];

    const content =
      truncateText(
        message.content.trim(),
        MAX_HISTORY_MESSAGE_CHARS
      );

    if (
      totalChars +
        content.length >
      MAX_CONTEXT_CHARS
    ) {
      continue;
    }

    result.unshift({
      role: message.role,
      content,
    });

    totalChars +=
      content.length;
  }

  return result;
}

// --------------------------------------------------
// GROQ API
// --------------------------------------------------

async function callGroq(
  messages: GroqMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?:
      | "none"
      | "low"
      | "medium"
      | "high";
  }
): Promise<string> {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY bulunamadı."
    );
  }

  const maxTokens =
    options?.maxTokens ??
    DEFAULT_MAX_TOKENS;

  const response =
    await fetch(
      GROQ_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model:
            DEFAULT_MODEL,

          messages,

          temperature:
            options?.temperature ??
            0.7,

          max_completion_tokens:
            maxTokens,

          reasoning_effort:
            options?.reasoningEffort ??
            "low",

          include_reasoning:
            false,
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

    if (
      response.status === 400
    ) {
      throw new Error(
        "AI isteği geçersiz. Model ayarlarını ve mesaj formatını kontrol edin."
      );
    }

    if (
      response.status === 401
    ) {
      throw new Error(
        "AI servis yetkilendirmesi başarısız."
      );
    }

    if (
      response.status === 413
    ) {
      throw new Error(
        "İstek çok büyük olduğu için AI modeli işleyemedi."
      );
    }

    if (
      response.status === 429
    ) {
      throw new Error(
        "AI kullanım limiti geçici olarak aşıldı. Biraz sonra tekrar deneyin."
      );
    }

    throw new Error(
      `AI servisi kullanılamıyor. HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  const choice =
    data?.choices?.[0];

  const content =
    choice?.message?.content;

  if (
    typeof content === "string" &&
    content.trim()
  ) {
    return content.trim();
  }

  console.error(
    "Groq boş cevap:",
    JSON.stringify(
      {
        model:
          data?.model,

        finish_reason:
          choice?.finish_reason,

        content,

        reasoning:
          choice?.message?.reasoning,

        usage:
          data?.usage,
      },
      null,
      2
    )
  );

  if (
    choice?.finish_reason ===
    "length"
  ) {
    throw new Error(
      "AI cevap üretmeden önce token limitine ulaştı."
    );
  }

  throw new Error(
    "AI boş bir cevap döndürdü."
  );
}

// --------------------------------------------------
// MEMORY
// --------------------------------------------------

async function getUserMemories(
  userId?: string
): Promise<Memory[]> {
  if (!userId) {
    return [];
  }

  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("memories")
        .select(
          "id, content, created_at"
        )
        .eq(
          "user_id",
          userId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(
          MAX_MEMORIES
        );

    if (error) {
      console.error(
        "Memory okuma hatası:",
        error
      );

      return [];
    }

    if (!data) {
      return [];
    }

    const memories: Memory[] =
      data
        .filter(
          (
            memory
          ): memory is {
            id: string;
            content: string;
            created_at: string | null;
          } =>
            typeof memory.id ===
              "string" &&
            typeof memory.content ===
              "string"
        )
        .map(
          (
            memory
          ) => ({
            id:
              memory.id,

            content:
              memory.content,

            created_at:
              typeof memory.created_at ===
              "string"
                ? memory.created_at
                : null,
          })
        );

    return memories;
  } catch (error) {
    console.error(
      "Memory sistem hatası:",
      error
    );

    return [];
  }
}

function buildMemoryContext(
  memories: Memory[]
): string {
  if (
    memories.length === 0
  ) {
    return "";
  }

  const selectedMemories:
    string[] = [];

  let totalChars = 0;

  for (
    const memory of memories
  ) {
    const content =
      memory.content.trim();

    if (!content) {
      continue;
    }

    if (
      totalChars +
        content.length >
      MAX_MEMORY_CONTEXT_CHARS
    ) {
      break;
    }

    selectedMemories.push(
      content
    );

    totalChars +=
      content.length;
  }

  if (
    selectedMemories.length === 0
  ) {
    return "";
  }

  const memoryText =
    selectedMemories
      .map(
        (
          memory,
          index
        ) =>
          `${index + 1}. ${memory}`
      )
      .join(
        "\n"
      );

  return `
KULLANICI HAFIZASI

Aşağıdaki bilgiler kullanıcı tarafından daha önce
paylaşılmış kalıcı bilgilerdir.

${memoryText}

Kurallar:

- Yalnızca gerçekten ilgili olduğunda kullan.
- Mevcut kullanıcı mesajı hafızayla çelişirse mevcut mesajı esas al.
- Hafızadan yeni bilgi veya tahmin üretme.
- Hafızayı gereksiz yere kullanıcıya listeleme.
- Hassas çıkarımlar yapma.
`.trim();
}

// --------------------------------------------------
// SYRAVEN
// --------------------------------------------------

export async function askSyraven(
  messages: ChatMessage[],
  userId?: string
): Promise<string> {
  const limitedMessages =
    limitChatMessages(
      messages
    );

  const memories =
    await getUserMemories(
      userId
    );

  const memoryContext =
    buildMemoryContext(
      memories
    );

  const systemPrompt = `
Sen SYRAVEN isimli gelişmiş bir yapay zekâ asistanısın.

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
- Kullanıcı detay isterse kapsamlı cevap ver.
- Karmaşık konuları anlaşılır şekilde açıkla.
- Yazılım konusunda uzman davran.
- Kod verirken temiz ve üretime uygun kod yaz.
- Önceki konuşmanın mevcut bağlamını dikkate al.
- Emin olmadığın bilgileri kesin gerçek gibi sunma.
- Kullanıcı bir dosya sağladıysa verilen dosya içeriğini dikkate al.
- Aynı bilgiyi tekrar tekrar sordurma.
- Kullanıcı istemedikçe gereksiz yere uzun cevap verme.

ÖNEMLİ UZUN MESAJ KURALLARI:

- Kullanıcı uzun bir kod veya metin gönderirse mümkün olduğunca tamamını analiz et.
- Kod incelerken sadece başlangıç kısmına odaklanma.
- Hata varsa dosyanın farklı bölümlerini dikkate al.
- Kullanıcının sorusuyla doğrudan ilgili kısımları önceliklendir.
- Gönderilmeyen veya bağlam dışında kalan kısımlar hakkında tahmin yapma.
${
  memoryContext
    ? `

${memoryContext}`
    : ""
}
`.trim();

  return callGroq(
    [
      {
        role: "system",
        content:
          systemPrompt,
      },

      ...limitedMessages,
    ],
    {
      temperature:
        0.7,

      maxTokens:
        DEFAULT_MAX_TOKENS,

      reasoningEffort:
        "low",
    }
  );
}

// --------------------------------------------------
// CHAT TITLE
// --------------------------------------------------

export async function generateChatTitle(
  firstMessage: string
): Promise<string> {
  const cleanMessage =
    firstMessage.trim();

  if (!cleanMessage) {
    return "Yeni Sohbet";
  }

  const normalizedMessage =
    cleanMessage
      .toLocaleLowerCase(
        "tr-TR"
      )
      .replace(
        /[.!?,]+$/g,
        ""
      )
      .trim();

  const shortGreetings = [
    "merhaba",
    "selam",
    "hey",
    "sa",
    "slm",
    "günaydın",
    "iyi akşamlar",
    "iyi günler",
  ];

  if (
    shortGreetings.includes(
      normalizedMessage
    )
  ) {
    return "Yeni Sohbet";
  }

  try {
    const title =
      await callGroq(
        [
          {
            role: "system",

            content: `
Kullanıcının ilk mesajına göre kısa ve açıklayıcı
bir Türkçe sohbet başlığı oluştur.

Kurallar:

- En fazla 5 kelime kullan.
- Sadece başlığı yaz.
- Açıklama yazma.
- Markdown kullanma.
- Tırnak işareti kullanma.
- Başlık dışında hiçbir şey yazma.
`.trim(),
          },

          {
            role: "user",

            content:
              truncateText(
                cleanMessage,
                2000
              ),
          },
        ],
        {
          temperature:
            0.2,

          maxTokens:
            CHAT_TITLE_MAX_TOKENS,

          reasoningEffort:
            "low",
        }
      );

    const cleanedTitle =
      title
        .replace(
          /^["']|["']$/g,
          ""
        )
        .replace(
          /[.!?]+$/g,
          ""
        )
        .trim()
        .split(
          /\s+/
        )
        .slice(
          0,
          5
        )
        .join(
          " "
        );

    return (
      cleanedTitle ||
      "Yeni Sohbet"
    );
  } catch (error) {
    console.error(
      "CHAT TITLE HATASI:",
      error
    );

    return "Yeni Sohbet";
  }
}