import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

// ==================================================
// ENV
// ==================================================

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const groqApiKey =
  process.env.GROQ_API_KEY;

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

// ==================================================
// ENV VALIDATION
// ==================================================

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL bulunamadı."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY bulunamadı."
  );
}

if (!groqApiKey) {
  throw new Error(
    "GROQ_API_KEY bulunamadı."
  );
}

// ==================================================
// SETTINGS
// ==================================================

const MAX_MESSAGES = 12;

const MAX_MESSAGE_LENGTH = 12000;

const MAX_RESPONSE_TOKENS =  4000;

const MAX_MEMORIES = 8;

const MAX_MEMORY_CHARS = 1800;

// ==================================================
// TYPES
// ==================================================

type ChatRole =
  | "user"
  | "assistant"
  | "system";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

// ==================================================
// SUPABASE
// ==================================================

function createSupabaseClient(
  token: string
) {
  return createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },

      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// ==================================================
// MESSAGE VALIDATION
// ==================================================

function isValidChatMessage(
  message: unknown
): message is ChatMessage {
  if (
    typeof message !== "object" ||
    message === null
  ) {
    return false;
  }

  if (
    !("role" in message) ||
    !("content" in message)
  ) {
    return false;
  }

  const candidate =
    message as ChatMessage;

  const validRoles: ChatRole[] = [
    "user",
    "assistant",
    "system",
  ];

  return (
    validRoles.includes(
      candidate.role
    ) &&
    typeof candidate.content ===
      "string" &&
    candidate.content.trim().length > 0
  );
}

// ==================================================
// TEXT TRUNCATION
// ==================================================

function truncateText(
  text: string,
  maxLength: number
): string {
  if (
    text.length <= maxLength
  ) {
    return text;
  }

  return (
    text.slice(
      0,
      maxLength
    ) +
    "\n\n[Mesaj bağlam sınırı nedeniyle kısaltıldı.]"
  );
}

// ==================================================
// BUILD CONTEXT
// ==================================================

function buildMessages(
  rawMessages: ChatMessage[]
): ChatMessage[] {
  return rawMessages
    .filter(
      (message) =>
        message.role !== "system" &&
        message.content.trim()
    )
    .slice(-MAX_MESSAGES)
    .map(
      (message) => ({
        role: message.role,

        content: truncateText(
          message.content.trim(),
          MAX_MESSAGE_LENGTH
        ),
      })
    );
}

// ==================================================
// POST
// ==================================================

export async function POST(
  req: NextRequest
) {
  try {
    // ==============================================
    // AUTH HEADER
    // ==============================================

    const authHeader =
      req.headers.get(
        "authorization"
      );

    if (
      !authHeader?.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Yetkilendirme gerekli.",
        },
        {
          status: 401,
        }
      );
    }

    const token =
      authHeader
        .replace(
          "Bearer ",
          ""
        )
        .trim();

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Geçersiz yetkilendirme.",
        },
        {
          status: 401,
        }
      );
    }

    // ==============================================
    // SUPABASE
    // ==============================================

    const supabase =
      createSupabaseClient(
        token
      );

    // ==============================================
    // USER AUTH
    // ==============================================

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser(
        token
      );

    if (
      userError ||
      !user
    ) {
      console.error(
        "AUTH HATASI:",
        userError
      );

      return NextResponse.json(
        {
          error:
            "Geçersiz oturum.",
        },
        {
          status: 401,
        }
      );
    }

    // ==============================================
    // REQUEST BODY
    // ==============================================

    let body: unknown;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Geçersiz JSON isteği.",
        },
        {
          status: 400,
        }
      );
    }

    const requestBody =
      body as {
        messages?: unknown;
      };

    if (
      !Array.isArray(
        requestBody.messages
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Mesajlar bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const rawMessages =
      requestBody.messages.filter(
        isValidChatMessage
      );

    if (
      rawMessages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Geçerli mesaj bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const messages =
      buildMessages(
        rawMessages
      );

    if (
      messages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "İşlenecek mesaj bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    // ==============================================
    // MEMORY SETTINGS
    // ==============================================

    let memoryEnabled = true;

    const {
      data: userSettings,
      error: settingsError,
    } =
      await supabase
        .from("user_settings")
        .select(
          "memory_enabled"
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (settingsError) {
      console.error(
        "HAFIZA AYARI HATASI:",
        settingsError
      );
    }

    if (userSettings) {
      memoryEnabled =
        userSettings.memory_enabled !==
        false;
    }

    // ==============================================
    // GET MEMORIES
    // ==============================================

    let memoryText = "";

    if (memoryEnabled) {
      const {
        data: memories,
        error: memoryError,
      } =
        await supabase
          .from("memories")
          .select(
            "content"
          )
          .eq(
            "user_id",
            user.id
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

      if (memoryError) {
        console.error(
          "HAFIZA OKUMA HATASI:",
          memoryError
        );
      }

      if (memories) {
        const selectedMemories:
          string[] = [];

        let totalChars = 0;

        for (
          const memory of memories
        ) {
          const content =
            memory.content?.trim();

          if (!content) {
            continue;
          }

          if (
            totalChars +
              content.length >
            MAX_MEMORY_CHARS
          ) {
            break;
          }

          selectedMemories.push(
            `- ${content}`
          );

          totalChars +=
            content.length;
        }

        memoryText =
          selectedMemories.join(
            "\n"
          );
      }
    }

    // ==============================================
    // SYSTEM PROMPT
    // ==============================================

    const systemPrompt =
      `
Sen SYRAVEN isimli gelişmiş bir yapay zekâ asistanısın.

TEMEL ÖZELLİKLERİN:

- Profesyonel
- Zeki
- Açık
- Güvenilir
- Kullanıcı odaklı
- Yardımcı
- Teknoloji ve yazılım konusunda güçlü

DAVRANIŞ KURALLARI:

- Kullanıcının dilinde cevap ver.
- Türkçe sorulara Türkçe cevap ver.
- Gereksiz tekrar yapma.
- Kullanıcı detay isterse kapsamlı cevap ver.
- Karmaşık konuları anlaşılır şekilde açıkla.
- Emin olmadığın bilgileri kesin gerçek gibi sunma.
- Kullanıcı istemedikçe cevapları gereksiz uzatma.
- Konuşmanın önceki bağlamını dikkate al.

YAZILIM VE KOD KURALLARI:

- Kod hatalarını dikkatlice analiz et.
- Syntax hatalarını tespit et.
- TypeScript tip uyumsuzluklarını dikkate al.
- Next.js App Router yapısını dikkate al.
- Server ve Client Component farkını doğru uygula.
- Güvenlik açısından riskli kodları belirt.
- Environment variable ve gizli anahtarları asla cevapta tekrar etme.
- Production için temiz ve sürdürülebilir kod yaz.
- Kullanıcı "tam kodu ver" derse eksiksiz dosyayı gönder.
- Kullanıcının mevcut mimarisini gereksiz yere değiştirme.

KULLANICI HAFIZASI:

${
  memoryEnabled
    ? (
        memoryText ||
        "Kullanıcı hakkında kayıtlı bilgi yok."
      )
    : "Hafıza kapalı."
}

HAFIZA KURALLARI:

- Hafızadaki bilgileri yalnızca gerçekten ilgili olduğunda kullan.
- Mevcut kullanıcı mesajı hafızayla çelişirse mevcut mesajı esas al.
- Hafızadan yeni bilgi uydurma.
- Hassas bilgiler hakkında çıkarım yapma.
      `.trim();

    // ==============================================
    // GROQ REQUEST
    // ==============================================

    const response =
      await fetch(
        GROQ_API_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${groqApiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                GROQ_MODEL,

              stream: false,

              temperature: 0.6,

              top_p: 0.95,

              reasoning_effort:
                "low",

              include_reasoning:
                false,

              max_completion_tokens:
                MAX_RESPONSE_TOKENS,

              messages: [
                {
                  role: "system",

                  content:
                    systemPrompt,
                },

                ...messages,
              ],
            }),
        }
      );

    // ==============================================
    // GROQ ERROR
    // ==============================================

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "GROQ HATASI:",
        response.status,
        errorText
      );

      if (
        response.status === 400
      ) {
        return NextResponse.json(
          {
            error:
              "AI isteği geçersiz.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        response.status === 401
      ) {
        return NextResponse.json(
          {
            error:
              "AI servis yetkilendirmesi başarısız.",
          },
          {
            status: 500,
          }
        );
      }

      if (
        response.status === 429
      ) {
        return NextResponse.json(
          {
            error:
              "AI kullanım limiti geçici olarak aşıldı. Birkaç saniye sonra tekrar deneyin.",
          },
          {
            status: 429,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            "AI servisi şu anda cevap veremedi.",
        },
        {
          status: 502,
        }
      );
    }

    // ==============================================
    // RESPONSE DATA
    // ==============================================

    const data =
      await response.json();

    const content =
      data?.choices?.[0]
        ?.message?.content;

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      console.error(
        "GEÇERSİZ AI CEVABI:",
        data
      );

      return NextResponse.json(
        {
          error:
            "AI geçerli bir cevap üretmedi.",
        },
        {
          status: 502,
        }
      );
    }

    // ==============================================
    // SUCCESS
    // ==============================================

    return NextResponse.json(
      {
        message: {
          role: "assistant",

          content:
            content.trim(),
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "CHAT SERVER HATASI:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Sunucu hatası oluştu.",

        details:
          process.env.NODE_ENV ===
          "development"
            ? String(error)
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}