import {
  after,
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const groqApiKey =
  process.env.GROQ_API_KEY!;

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type MemoryDecision = {
  save: boolean;
  memory: string;
};

function createSupabaseClient(token: string) {
  return createClient<any>(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },

      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Kullanıcının mesajını analiz eder.
 * Kalıcı bilgi varsa hafızaya kaydeder.
 *
 * Bu işlem ana AI cevabını bekletmez.
 */
async function analyzeAndSaveMemory({
  supabase,
  userId,
  userText,
}: {
  supabase: any;
  userId: string;
  userText: string;
}) {
  const cleanText = userText.trim();

  if (!cleanText) {
    return;
  }

  try {
    const memoryResponse = await fetch(
      GROQ_API_URL,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: GROQ_MODEL,

          temperature: 0,

          max_tokens: 250,

          messages: [
            {
              role: "system",

              content: `
Sen SYRAVEN'ın hafıza analiz sistemisin.

Görevin, kullanıcının mesajında gelecekteki konuşmalarda işe yarayabilecek önemli ve kalıcı bir bilgi olup olmadığını belirlemektir.

Kaydedilebilecek bilgiler:

- Kullanıcının adı
- Yaşadığı şehir, ülke veya bölge
- Eğitim durumu
- Okulu veya bölümü
- Mesleği veya işi
- Uzun vadeli hedefleri
- Kariyer hedefleri
- Projeleri
- Uzun vadeli planları
- Öğrenmek istediği şeyler
- Hobileri
- İlgi alanları
- Sevdiği veya sevmediği şeyler
- Kalıcı tercihleri
- Kullanıcının açıkça hatırlanmasını istediği bilgiler

Kaydet:

"KKTC'de yaşıyorum."
→ KAYDET

"Bilgisayar mühendisliği okuyorum."
→ KAYDET

"Tenis oynamayı seviyorum."
→ KAYDET

"Ana hedefim kendi yapay zekâ şirketimi kurmak."
→ KAYDET

Kaydetme:

"Merhaba."
→ KAYDETME

"Bugün hava nasıl?"
→ KAYDETME

"Yarın tenis oynayacağım."
→ KAYDETME

"Bugün çok yorgunum."
→ KAYDETME

Şunları ASLA kaydetme:

- Şifreler
- API anahtarları
- Tokenlar
- Güvenlik kodları
- Kredi kartı bilgileri
- Banka bilgileri
- Gizli kimlik doğrulama bilgileri

Tahmin yürütme.

Sadece kullanıcının açıkça söylediği veya doğrudan mesajdan kesin olarak anlaşılan kalıcı bilgileri kaydet.

Sadece geçerli JSON döndür.

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

Memory kısa, açık ve üçüncü şahıs şeklinde olmalıdır.
              `.trim(),
            },

            {
              role: "user",
              content: cleanText,
            },
          ],
        }),
      }
    );

    if (!memoryResponse.ok) {
      console.error(
        "MEMORY AI HATASI:",
        await memoryResponse.text()
      );

      return;
    }

    const memoryData =
      await memoryResponse.json();

    const rawContent =
      memoryData?.choices?.[0]?.message
        ?.content;

    if (
      typeof rawContent !== "string" ||
      !rawContent.trim()
    ) {
      return;
    }

    let cleanedContent =
      rawContent.trim();

    cleanedContent = cleanedContent
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

    let decision: MemoryDecision;

    try {
      decision = JSON.parse(
        cleanedContent
      ) as MemoryDecision;
    } catch {
      console.error(
        "MEMORY JSON PARSE HATASI:",
        cleanedContent
      );

      return;
    }

    if (
      decision.save !== true ||
      typeof decision.memory !== "string" ||
      !decision.memory.trim()
    ) {
      return;
    }

    const memoryContent =
      decision.memory.trim();

    const {
      data: existingMemory,
      error: findMemoryError,
    } = await supabase
      .from("memories")
      .select("id")
      .eq("user_id", userId)
      .eq("content", memoryContent)
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
    } = await supabase
      .from("memories")
      .insert({
        user_id: userId,
        content: memoryContent,
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

export async function POST(
  req: NextRequest
) {
  try {
    //------------------------------------
    // AUTH TOKEN
    //------------------------------------

    const authHeader =
      req.headers.get("authorization");

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
      authHeader.replace(
        "Bearer ",
        ""
      );

    //------------------------------------
    // SUPABASE
    //------------------------------------

    const supabase =
      createSupabaseClient(token);

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser(
        token
      );

    if (userError || !user) {
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

    //------------------------------------
    // REQUEST BODY
    //------------------------------------

    const body = await req.json();

    const messages: ChatMessage[] =
      Array.isArray(body.messages)
        ? body.messages.filter(
            (
              message: unknown
            ): message is ChatMessage =>
              typeof message ===
                "object" &&
              message !== null &&
              "role" in message &&
              "content" in message &&
              typeof (
                message as ChatMessage
              ).content === "string" &&
              [
                "system",
                "user",
                "assistant",
              ].includes(
                (
                  message as ChatMessage
                ).role
              )
          )
        : [];

    if (!messages.length) {
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

    //------------------------------------
    // MEMORY SETTING
    //------------------------------------

    let memoryEnabled = true;

    const {
      data: userSettings,
      error: settingsError,
    } = await supabase
      .from("user_settings")
      .select("memory_enabled")
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

    //------------------------------------
    // MEMORY GETİR
    //------------------------------------

    let memoryText = "";

    if (memoryEnabled) {
      const {
        data: memories,
        error: memoryError,
      } = await supabase
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
        .limit(20);

      if (memoryError) {
        console.error(
          "HAFIZA OKUMA HATASI:",
          memoryError
        );
      } else {
        memoryText =
          (memories || [])
            .map(
              (memory: {
                content: string;
              }) =>
                `- ${memory.content}`
            )
            .join("\n");
      }
    }

    //------------------------------------
    // SON KULLANICI MESAJI
    //------------------------------------

    const latestUserMessage =
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "user"
        );

    //------------------------------------
    // ANA AI STREAM
    //------------------------------------

    const response = await fetch(
      GROQ_API_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${groqApiKey}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: GROQ_MODEL,

          stream: true,

          max_tokens: 4096,

          temperature: 0.7,

          messages: [
            {
              role: "system",

              content: `
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
- Gereksiz uzunlukta cevap verme.
- Kullanıcı özellikle detay isterse kapsamlı cevap ver.
- Karmaşık konuları anlaşılır şekilde açıkla.
- Yazılım konusunda uzman davran.
- Kod verirken temiz ve üretime uygun kod yaz.
- Konuşmanın bağlamını dikkate al.
- Emin olmadığın bilgileri kesin gerçek gibi sunma.
- Kullanıcı bir dosya sağladıysa mevcut dosya içeriğini dikkate al.
- Aynı bilgiyi kullanıcıya tekrar tekrar sordurma.

KULLANICI HAFIZASI:

${
  memoryEnabled
    ? memoryText ||
      "Kullanıcı hakkında kayıtlı bir bilgi yok."
    : "Hafıza kapalı. Kullanıcı hafızasını kullanma."
}

Hafıza kullanım kuralları:

- Hafızadaki bilgileri yalnızca gerçekten ilgili olduğunda kullan.
- Hafızadaki bilgiler ile mevcut kullanıcı mesajı çelişirse mevcut mesajı esas al.
- Hafızayı kullanıcıya gereksiz yere listeleme.
- Kullanıcı "bunu hatırlıyor musun?" gibi bir soru sorarsa ilgili bilgiyi kullan.
- Hassas veya gereksiz çıkarımlar yapma.
              `.trim(),
            },

            ...messages.filter(
              (message) =>
                message.role !== "system"
            ),
          ],
        }),
      }
    );

    //------------------------------------
    // GROQ ERROR
    //------------------------------------

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "GROQ STREAM HATASI:",
        errorText
      );

      return NextResponse.json(
        {
          error:
            "AI servisi cevap veremedi.",
        },
        {
          status: 500,
        }
      );
    }

    //------------------------------------
    // MEMORY ANALİZİNİ
    // RESPONSE SONRASINA BIRAK
    //------------------------------------

    if (
      memoryEnabled &&
      latestUserMessage?.content
    ) {
      after(async () => {
        await analyzeAndSaveMemory({
          supabase,
          userId: user.id,
          userText:
            latestUserMessage.content,
        });
      });
    }

    //------------------------------------
    // STREAM RESPONSE
    //------------------------------------

    return new Response(
      response.body,
      {
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
      },
      {
        status: 500,
      }
    );
  }
}