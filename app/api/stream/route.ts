import {
  after,
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  parseAction,
} from "@/services/action-parser";

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
// CONTEXT SETTINGS
// ==================================================

const ESTIMATED_CHARS_PER_TOKEN = 3;

const MAX_INPUT_TOKEN_BUDGET = 5000;

const MAX_LATEST_MESSAGE_CHARS = 16000;

const MAX_OLD_MESSAGE_CHARS = 2200;

const MAX_PREVIOUS_MESSAGES = 6;

const MAX_RESPONSE_TOKENS = 6000;

const MIN_RESPONSE_TOKENS = 800;

const SAFE_TOTAL_TOKEN_LIMIT = 12000;

// ==================================================
// MEMORY SETTINGS
// ==================================================

const MAX_MEMORIES = 8;

const MAX_MEMORY_CHARS = 1800;

const MAX_MEMORY_MESSAGE_LENGTH = 6000;

const MAX_MEMORY_ANALYSIS_CHARS = 2500;

const MAX_MEMORY_LENGTH = 300;

// ==================================================
// TYPES
// ==================================================

type ChatRole =
  | "system"
  | "user"
  | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type MemoryDecision = {
  save: boolean;
  memory: string;
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
// TOKEN ESTIMATION
// ==================================================

function estimateTokens(
  text: string
): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(
    text.length /
      ESTIMATED_CHARS_PER_TOKEN
  );
}

// ==================================================
// TEXT TRUNCATION
// ==================================================

function truncateText(
  text: string,
  maxLength: number,
  suffix =
    "\n\n[İçeriğin devamı bağlam sınırı nedeniyle kısaltıldı.]"
): string {
  if (
    text.length <= maxLength
  ) {
    return text;
  }

  if (
    suffix.length >= maxLength
  ) {
    return text.slice(
      0,
      maxLength
    );
  }

  return (
    text.slice(
      0,
      maxLength -
        suffix.length
    ) + suffix
  );
}

// ==================================================
// SMART TRUNCATION
// ==================================================

function smartTruncateText(
  text: string,
  maxLength: number
): string {
  if (
    text.length <= maxLength
  ) {
    return text;
  }

  const marker =
    "\n\n/* ================================================\n" +
    "   ORTA KISIM BAĞLAM SINIRI NEDENİYLE KISALTILDI\n" +
    "   ================================================ */\n\n";

  const available =
    maxLength -
    marker.length;

  if (
    available <= 0
  ) {
    return text.slice(
      0,
      maxLength
    );
  }

  const startLength =
    Math.floor(
      available * 0.7
    );

  const endLength =
    available -
    startLength;

  return (
    text.slice(
      0,
      startLength
    ) +
    marker +
    text.slice(
      -endLength
    )
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
    "system",
    "user",
    "assistant",
  ];

  return (
    typeof candidate.content ===
      "string" &&
    validRoles.includes(
      candidate.role
    )
  );
}

// ==================================================
// BUILD CHAT CONTEXT
// ==================================================

function buildChatContext(
  rawMessages: ChatMessage[]
): ChatMessage[] {
  const validMessages =
    rawMessages
      .filter(
        (message) =>
          message.role !== "system" &&
          typeof message.content ===
            "string" &&
          message.content.trim()
      )
      .map(
        (message) => ({
          role:
            message.role,

          content:
            message.content.trim(),
        })
      );

  if (
    validMessages.length === 0
  ) {
    return [];
  }

  const latestMessage =
    validMessages[
      validMessages.length - 1
    ];

  let latestContent =
    smartTruncateText(
      latestMessage.content,
      MAX_LATEST_MESSAGE_CHARS
    );

  const latestTokenBudget =
    Math.floor(
      MAX_INPUT_TOKEN_BUDGET *
        0.72
    );

  const latestCharacterBudget =
    latestTokenBudget *
    ESTIMATED_CHARS_PER_TOKEN;

  if (
    estimateTokens(
      latestContent
    ) >
    latestTokenBudget
  ) {
    latestContent =
      smartTruncateText(
        latestContent,
        latestCharacterBudget
      );
  }

  const latestProcessed: ChatMessage =
    {
      role:
        latestMessage.role,

      content:
        latestContent,
    };

  const previousMessages =
    validMessages
      .slice(
        Math.max(
          0,
          validMessages.length -
            1 -
            MAX_PREVIOUS_MESSAGES
        ),
        -1
      )
      .map(
        (message) => ({
          role:
            message.role,

          content:
            smartTruncateText(
              message.content,
              MAX_OLD_MESSAGE_CHARS
            ),
        })
      );

  const result: ChatMessage[] = [
    latestProcessed,
  ];

  let usedTokens =
    estimateTokens(
      latestProcessed.content
    );

  for (
    let i =
      previousMessages.length - 1;
    i >= 0;
    i--
  ) {
    const message =
      previousMessages[i];

    const messageTokens =
      estimateTokens(
        message.content
      );

    if (
      usedTokens +
        messageTokens >
      MAX_INPUT_TOKEN_BUDGET
    ) {
      continue;
    }

    result.unshift(
      message
    );

    usedTokens +=
      messageTokens;
  }

  return result;
}

// ==================================================
// SECRET DETECTION
// ==================================================

function containsSensitiveSecret(
  text: string
): boolean {
  const patterns = [
    /sk-[A-Za-z0-9_-]{10,}/i,

    /gsk_[A-Za-z0-9_-]{10,}/i,

    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,

    /SUPABASE_SERVICE_ROLE_KEY/i,

    /OPENAI_API_KEY/i,

    /GROQ_API_KEY/i,

    /password\s*[:=]/i,

    /secret\s*[:=]/i,
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(text)
  );
}

// ==================================================
// MEMORY ANALYSIS
// ==================================================

async function analyzeAndSaveMemory({
  supabase,
  userId,
  userText,
}: {
  supabase: ReturnType<
    typeof createSupabaseClient
  >;

  userId: string;

  userText: string;
}) {
  const originalText =
    userText.trim();

  if (!originalText) {
    return;
  }

  if (
    originalText.length >
    MAX_MEMORY_MESSAGE_LENGTH
  ) {
    return;
  }

  if (
    containsSensitiveSecret(
      originalText
    )
  ) {
    return;
  }

  const cleanText =
    smartTruncateText(
      originalText,
      MAX_MEMORY_ANALYSIS_CHARS
    );

  try {
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

              temperature: 0.2,

              reasoning_effort:
                "low",

              include_reasoning:
                false,

              max_completion_tokens:
                180,

              response_format: {
                type:
                  "json_object",
              },

              messages: [
                {
                  role:
                    "system",

                  content: `
Sen SYRAVEN'ın hafıza analiz sistemisin.

Görevin kullanıcının mesajında gelecekte işe yarayabilecek açık, kalıcı ve önemli bilgiler olup olmadığını belirlemektir.

Kaydedilebilecek bilgiler:

- Kullanıcının mesleği veya işi
- Uzmanlık alanları
- Uzun vadeli projeleri
- Uzun vadeli hedefleri
- Kariyer hedefleri
- Öğrenmek istediği konular
- Kalıcı tercihleri
- Çalışma tercihleri
- Hobileri ve ilgi alanları
- Açıkça hatırlanmasını istediği bilgiler

ASLA kaydetme:

- Şifreler
- API anahtarları
- Access tokenlar
- Refresh tokenlar
- Güvenlik kodları
- Kredi kartı bilgileri
- Banka bilgileri
- Gizli kimlik doğrulama bilgileri
- Hassas kişisel bilgiler

Tahmin yürütme.

Sadece kullanıcının açıkça söylediği bilgileri değerlendir.

Sadece JSON döndür.

Format:

{
  "save": true,
  "memory": "Kullanıcının ..."
}

veya:

{
  "save": false,
  "memory": ""
}
                  `.trim(),
                },

                {
                  role:
                    "user",

                  content:
                    cleanText,
                },
              ],
            }),
        }
      );

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    const rawContent =
      data?.choices?.[0]
        ?.message?.content;

    if (
      typeof rawContent !==
        "string" ||
      !rawContent.trim()
    ) {
      return;
    }

    let decision:
      MemoryDecision;

    try {
      decision =
        JSON.parse(
          rawContent.trim()
        ) as MemoryDecision;
    } catch {
      return;
    }

    if (
      decision.save !== true ||
      typeof decision.memory !==
        "string" ||
      !decision.memory.trim()
    ) {
      return;
    }

    const memoryContent =
      truncateText(
        decision.memory.trim(),
        MAX_MEMORY_LENGTH,
        ""
      );

    if (!memoryContent) {
      return;
    }

    const {
      data: existingMemory,
      error: findMemoryError,
    } =
      await supabase
        .from("memories")
        .select("id")
        .eq(
          "user_id",
          userId
        )
        .eq(
          "content",
          memoryContent
        )
        .maybeSingle();

    if (findMemoryError) {
      console.error(
        "MEMORY ARAMA HATASI:",
        findMemoryError
      );

      return;
    }

    if (existingMemory) {
      return;
    }

    const {
      error: insertMemoryError,
    } =
      await supabase
        .from("memories")
        .insert({
          user_id:
            userId,

          content:
            memoryContent,
        });

    if (insertMemoryError) {
      console.error(
        "MEMORY KAYDETME HATASI:",
        insertMemoryError
      );
    }
  } catch (error) {
    console.error(
      "MEMORY ANALİZ HATASI:",
      error
    );
  }
}

// ==================================================
// RESPONSE TOKEN BUDGET
// ==================================================

function calculateResponseTokens(
  systemPrompt: string,
  messages: ChatMessage[]
): number {
  const messageText =
    messages
      .map(
        (message) =>
          message.content
      )
      .join("\n");

  const estimatedInputTokens =
    estimateTokens(
      systemPrompt
    ) +
    estimateTokens(
      messageText
    );

  const safeRemaining =
    SAFE_TOTAL_TOKEN_LIMIT -
    estimatedInputTokens;

  if (
    safeRemaining <=
    MIN_RESPONSE_TOKENS
  ) {
    return MIN_RESPONSE_TOKENS;
  }

  return Math.min(
    MAX_RESPONSE_TOKENS,
    safeRemaining
  );
}

// ==================================================
// CREATE ACTION SSE STREAM
// ==================================================

function createActionStream(
  action: Awaited<
    ReturnType<typeof parseAction>
  >
) {
  const encoder =
    new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const actionEvent =
        `event: action\n` +
        `data: ${JSON.stringify(action)}\n\n`;

      controller.enqueue(
        encoder.encode(
          actionEvent
        )
      );

      controller.enqueue(
        encoder.encode(
          "data: [DONE]\n\n"
        )
      );

      controller.close();
    },
  });
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
        .slice(
          "Bearer ".length
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
    // SUPABASE CLIENT
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

    const rawMessages:
      ChatMessage[] =
        Array.isArray(
          requestBody.messages
        )
          ? requestBody.messages.filter(
              isValidChatMessage
            )
          : [];

    if (
      rawMessages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Mesaj bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    // ==============================================
    // BUILD CHAT CONTEXT
    // ==============================================

    const messages =
      buildChatContext(
        rawMessages
      );

    if (
      messages.length === 0
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

    // ==============================================
    // LATEST USER MESSAGE
    // ==============================================

    const latestUserMessage =
      [...rawMessages]
        .reverse()
        .find(
          (message) =>
            message.role ===
            "user"
        );

    if (
      !latestUserMessage
    ) {
      return NextResponse.json(
        {
          error:
            "Kullanıcı mesajı bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    // ==============================================
    // ACTION ANALYSIS
    // ==============================================

    let action:
      | Awaited<
          ReturnType<typeof parseAction>
        >
      | null = null;

    try {
      action =
        await parseAction(
          latestUserMessage.content
        );
    } catch (error) {
      console.error(
        "ACTION ANALİZ HATASI:",
        error
      );

      action = null;
    }

    if (
      action &&
      action.type !== "none" &&
      action.requiresConfirmation
    ) {
      console.log(
        "SYRAVEN ACTION:",
        action
      );

      return new Response(
        createActionStream(
          action
        ),
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/event-stream; charset=utf-8",

            "Cache-Control":
              "no-cache, no-transform",

            Connection:
              "keep-alive",

            "X-Accel-Buffering":
              "no",
          },
        }
      );
    }

    // ==============================================
    // MEMORY SETTINGS
    // ==============================================

    let memoryEnabled =
      true;

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
        "HAFIZA AYARI OKUMA HATASI:",
        settingsError
      );
    }

    if (userSettings) {
      memoryEnabled =
        userSettings.memory_enabled !==
        false;
    }

    // ==============================================
    // MEMORY GET
    // ==============================================

    let memoryText = "";

    if (memoryEnabled) {
      const {
        data: memories,
        error: memoryError,
      } =
        await supabase
          .from("memories")
          .select("content")
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
      } else {
        const selectedMemories:
          string[] = [];

        let totalChars = 0;

        for (
          const memory of
            memories || []
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

Temel özelliklerin:

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
- Yazılım konusunda uzman davran.
- Kod verirken temiz ve üretime uygun kod yaz.
- Konuşmanın bağlamını dikkate al.
- Emin olmadığın bilgileri kesin gerçek gibi sunma.
- Aynı bilgiyi kullanıcıya tekrar tekrar sordurma.
- Kullanıcı istemedikçe cevabı gereksiz uzatma.

YAZILIM VE KOD KURALLARI:

- Kod hatalarını dikkatlice analiz et.
- Syntax hatalarını tespit et.
- TypeScript tip uyumsuzluklarını dikkate al.
- Next.js App Router yapısını dikkate al.
- Server ve Client Component farkını doğru uygula.
- Güvenlik açısından riskli kodları belirt.
- Environment variable ve secret bilgilerini asla cevapta sızdırma.
- Production ortamı için temiz mimari düşün.
- Kullanıcı "tam kodu ver" derse eksiksiz dosyayı üret.
- Kullanıcının mevcut kodunu verdiyse gereksiz şekilde tamamen farklı bir mimariye geçme.
- Kullanıcının mevcut yapısını mümkün olduğunca koru.

UZUN KOD VE DOKÜMAN KURALLARI:

Kullanıcı uzun bir kod veya doküman gönderirse:

- Önce kullanıcının asıl isteğini belirle.
- Son kullanıcı mesajı en önemli bağlamdır.
- Kodun ilgili bölümlerini dikkatlice analiz et.
- Kullanıcı özellikle istemedikçe tüm kodu tekrar yazma.
- Kullanıcı "tam kodu gönder" derse gerekli tam dosyayı üret.
- Hata düzeltirken kullanıcı açıkça tam dosya isterse eksiksiz dosyayı ver.
- Görmediğin kod hakkında kesin varsayım yapma.
- Büyük içeriği gereksiz şekilde özetleyip geçme.
- Asıl teknik problemi çözmeye odaklan.

KULLANICI HAFIZASI:

${
  memoryEnabled
    ? memoryText ||
      "Kullanıcı hakkında kayıtlı bir bilgi yok."
    : "Hafıza kapalı. Kullanıcı hafızasını kullanma."
}

HAFIZA KURALLARI:

- Hafızadaki bilgileri yalnızca gerçekten ilgili olduğunda kullan.
- Mevcut kullanıcı mesajı hafızayla çelişirse mevcut mesajı esas al.
- Hafızayı kullanıcıya gereksiz şekilde listeleme.
- Hafızadan tahmin veya yeni bilgi üretme.
- Hassas veya gereksiz çıkarımlar yapma.
      `.trim();

    // ==============================================
    // RESPONSE TOKEN BUDGET
    // ==============================================

    const responseTokens =
      calculateResponseTokens(
        systemPrompt,
        messages
      );

    // ==============================================
    // DEBUG
    // ==============================================

    console.log(
      "SYRAVEN STREAM:",
      {
        userId:
          user.id,

        model:
          GROQ_MODEL,

        messageCount:
          messages.length,

        action:
          action?.type ||
          "none",

        memoryEnabled,

        maxResponseTokens:
          responseTokens,
      }
    );

    // ==============================================
    // GROQ STREAM
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

              stream: true,

              temperature: 0.6,

              top_p: 0.95,

              reasoning_effort:
                "low",

              include_reasoning:
                false,

              max_completion_tokens:
                responseTokens,

              messages: [
                {
                  role:
                    "system",

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
        "GROQ STREAM HATASI:",
        response.status,
        errorText
      );

      if (
        response.status === 400
      ) {
        return NextResponse.json(
          {
            error:
              "AI isteği geçersiz. Model ayarlarını ve mesaj formatını kontrol edin.",
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
        response.status === 413
      ) {
        return NextResponse.json(
          {
            error:
              "Gönderilen içerik AI modelinin işleyebileceği sınırı aştı.",
          },
          {
            status: 413,
          }
        );
      }

      if (
        response.status === 429
      ) {
        return NextResponse.json(
          {
            error:
              "AI kullanım limiti geçici olarak aşıldı. Birkaç saniye bekleyip tekrar deneyin.",
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

    if (!response.body) {
      return NextResponse.json(
        {
          error:
            "AI stream body bulunamadı.",
        },
        {
          status: 500,
        }
      );
    }

    // ==============================================
    // MEMORY ANALYSIS
    // ==============================================

    if (
      memoryEnabled &&
      latestUserMessage.content.length <=
        MAX_MEMORY_MESSAGE_LENGTH &&
      !containsSensitiveSecret(
        latestUserMessage.content
      )
    ) {
      after(
        async () => {
          try {
            await analyzeAndSaveMemory({
              supabase,

              userId:
                user.id,

              userText:
                latestUserMessage.content,
            });
          } catch (error) {
            console.error(
              "AFTER MEMORY HATASI:",
              error
            );
          }
        }
      );
    }

    // ==============================================
    // STREAM RESPONSE
    // ==============================================

    return new Response(
      response.body,
      {
        status: 200,

        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          Connection:
            "keep-alive",

          "X-Accel-Buffering":
            "no",
        },
      }
    );
  } catch (error) {
    console.error(
      "STREAM SERVER HATASI:",
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