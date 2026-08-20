import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const groqApiKey = process.env.GROQ_API_KEY!;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type MemoryDecision = {
  save: boolean;
  memory: string;
};

export async function POST(req: NextRequest) {
  try {
    //------------------------------------
    // AUTH TOKEN
    //------------------------------------

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Yetkilendirme gerekli.",
        },
        {
          status: 401,
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    //------------------------------------
    // SUPABASE USER
    //------------------------------------

    const supabase = createClient(
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Geçersiz oturum.",
        },
        {
          status: 401,
        }
      );
    }

    //------------------------------------
    // MESAJLAR
    //------------------------------------

    const body = await req.json();

    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
      : [];

    //------------------------------------
    // HAFIZA AYARI
    //------------------------------------

    let memoryEnabled = true;

    const {
      data: userSettings,
      error: settingsError,
    } = await supabase
      .from("user_settings")
      .select("memory_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) {
      console.error(
        "HAFIZA AYARI OKUMA HATASI:",
        settingsError
      );
    } else if (userSettings) {
      memoryEnabled =
        userSettings.memory_enabled !== false;
    }

    console.log(
      "MEMORY ENABLED:",
      memoryEnabled
    );

    //------------------------------------
    // SON KULLANICI MESAJI
    //------------------------------------

    const latestUserMessage = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "user" &&
          typeof message.content === "string"
      );

    //------------------------------------
    // HAFIZA
    //------------------------------------

    let memories: { content: string }[] = [];
    let memoryText = "";

    if (memoryEnabled) {
      const {
        data,
        error: memoryError,
      } = await supabase
        .from("memories")
        .select("content")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (memoryError) {
        console.error(
          "HAFIZA OKUMA HATASI:",
          memoryError
        );
      } else {
        memories = data || [];
      }

      memoryText = memories
        .map((memory) => `- ${memory.content}`)
        .join("\n");
    }

    console.log(
      "STREAM USER ID:",
      user.id
    );

    console.log(
      "STREAM MEMORY:",
      memories
    );

    //------------------------------------
    // AI MEMORY ANALİZİ
    //------------------------------------

    if (
      memoryEnabled &&
      latestUserMessage?.content
    ) {
      const userText =
        latestUserMessage.content.trim();

      try {
        const memoryResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",

            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              model:
                "openai/gpt-oss-20b",

              temperature: 0,

              messages: [
                {
                  role: "system",

                  content: `
Sen QELVORA'nın hafıza analiz sistemisin.

Görevin, kullanıcının mesajında gelecekteki konuşmalarda işe yarayabilecek ÖNEMLİ ve KALICI bir kullanıcı bilgisi olup olmadığını belirlemektir.

Şunları genellikle KAYDET:

- Kullanıcının adı
- Yaşadığı şehir, ülke veya bölge
- Eğitim durumu
- Okuduğu bölüm
- Okulu
- Mesleği
- İşi
- Öğrencilik durumu
- Öğrenmek istediği şeyler
- Uzun vadeli hedefleri
- Hayalleri
- Kariyer hedefleri
- Spor hedefleri
- Projeleri
- Uzun vadeli planları
- Hobileri
- İlgi alanları
- Sevdiği şeyler
- Sevmediği şeyler
- Tercihleri
- Favorileri
- Kullanıcının özellikle "bunu hatırla", "bunu kaydet", "aklında tut" gibi ifadelerle kalıcı olarak hatırlanmasını istediği bilgiler
- Gelecekte kullanıcıya daha kişisel ve faydalı cevap vermeyi sağlayacak diğer kalıcı bilgiler

Örneğin:

"KKTC'de yaşıyorum."
→ KAYDET

"Ana hedefim tenis şampiyonu olmak."
→ KAYDET

"Bilgisayar mühendisliği okuyorum."
→ KAYDET

"İngilizce öğreniyorum."
→ KAYDET

"Hayalim profesyonel tenisçi olmak."
→ KAYDET

"En sevdiğim spor tenis."
→ KAYDET

Şunları KAYDETME:

- Basit selamlaşmalar
- Günlük ve geçici durumlar
- Anlık duygular
- Basit sorular
- Genel bilgiler
- Haberler
- Hava durumu
- O an yapılan geçici işler
- Şifreler
- API anahtarları
- Tokenlar
- Güvenlik kodları
- Kredi kartı bilgileri
- Banka bilgileri
- Gizli kimlik doğrulama bilgileri

ÖNEMLİ:

Kullanıcı bir bilgiyi doğrudan söylemese bile cümleden açıkça anlaşılan kalıcı bir bilgi varsa kaydet.

Ancak tahmin yürütme.

Örneğin:
"Tenis oynamayı seviyorum."
→ Kullanıcının tenis sevdiğini kaydet.

"Yarın tenis oynayacağım."
→ Bunu kalıcı hafızaya kaydetme.

Sonuç olarak SADECE JSON döndür.

Format:

{
  "save": true,
  "memory": "Kullanıcının ... "
}

veya:

{
  "save": false,
  "memory": ""
}

Memory metni kısa, açık ve üçüncü şahıs şeklinde olmalıdır.

Kullanıcının cümlesini gereksiz yere uzun şekilde kopyalama.
`,
                },

                {
                  role: "user",
                  content: userText,
                },
              ],
            }),
          }
        );

        if (memoryResponse.ok) {
          const memoryData =
            await memoryResponse.json();

          const rawContent =
            memoryData?.choices?.[0]?.message
              ?.content;

          if (rawContent) {
            let cleanedContent =
              String(rawContent).trim();

            // Markdown JSON çitlerini temizle
            cleanedContent =
              cleanedContent
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();

            try {
              const decision =
                JSON.parse(
                  cleanedContent
                ) as MemoryDecision;

              if (
                decision.save === true &&
                typeof decision.memory ===
                  "string" &&
                decision.memory.trim()
              ) {
                const memoryContent =
                  decision.memory.trim();

                console.log(
                  "AI MEMORY KARARI:",
                  memoryContent
                );

                //------------------------------------
                // AYNI MEMORY VAR MI?
                //------------------------------------

                const {
                  data: existingMemory,
                  error: findMemoryError,
                } = await supabase
                  .from("memories")
                  .select("id")
                  .eq(
                    "user_id",
                    user.id
                  )
                  .eq(
                    "content",
                    memoryContent
                  )
                  .limit(1)
                  .maybeSingle();

                if (findMemoryError) {
                  console.error(
                    "MEMORY ARAMA HATASI:",
                    findMemoryError
                  );
                }

                //------------------------------------
                // MEMORY KAYDET
                //------------------------------------

                if (!existingMemory) {
                  const {
                    error:
                      insertMemoryError,
                  } = await supabase
                    .from("memories")
                    .insert({
                      user_id: user.id,
                      content:
                        memoryContent,
                    });

                  if (
                    insertMemoryError
                  ) {
                    console.error(
                      "MEMORY KAYDETME HATASI:",
                      insertMemoryError
                    );
                  } else {
                    console.log(
                      "YENİ MEMORY KAYDEDİLDİ:",
                      memoryContent
                    );
                  }
                } else {
                  console.log(
                    "MEMORY ZATEN VAR:",
                    memoryContent
                  );
                }
              } else {
                console.log(
                  "AI: KAYDEDİLECEK MEMORY YOK."
                );
              }
            } catch (parseError) {
              console.error(
                "MEMORY JSON PARSE HATASI:",
                parseError
              );

              console.error(
                "AI MEMORY CEVABI:",
                cleanedContent
              );
            }
          }
        } else {
          const errorText =
            await memoryResponse.text();

          console.error(
            "MEMORY AI HATASI:",
            errorText
          );
        }
      } catch (memoryAiError) {
        console.error(
          "MEMORY ANALİZ HATASI:",
          memoryAiError
        );
      }
    }

    //------------------------------------
    // GROQ STREAM
    //------------------------------------

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model:
            "openai/gpt-oss-20b",

          stream: true,

          max_tokens: 4096,

          temperature: 0.7,

          messages: [
            {
              role: "system",

              content: `
Sen QELVORA isimli gelişmiş bir yapay zekâ asistansın.

Kurallar:

- Türkçe konuş.
- Profesyonel ol.
- Kullanıcının istediği uzunluğa uy.
- Kullanıcı belirli bir kelime sayısı istiyorsa mümkün olduğunca o uzunluğa yaklaş.
- Kullanıcı uzun ve detaylı bir cevap istiyorsa cevabı gereksiz yere kısaltma.
- Kullanıcı açıkça belirli sayıda bölüm istiyorsa tüm bölümleri tamamla.
- Yazılım konusunda uzmansın.
- Konuşmanın tamamını dikkate al.

KULLANICI HAFIZASI:

${
  memoryEnabled
    ? memoryText ||
      "Kullanıcı hakkında kayıtlı bir bilgi yok."
    : "Hafıza kapalı. Kullanıcı hafızasını kullanma."
}

Hafıza açıksa yukarıdaki bilgiler kullanıcı hakkında daha önce kaydedilmiş gerçek bilgilerdir.

Önemli:

- Hafıza açıksa kayıtlı bilgileri kullan.
- Kullanıcı "Benim adım ne?" gibi bir soru sorarsa ve hafızasında adı kayıtlıysa doğrudan kayıtlı adı söyle.
- Kayıtlı bir bilgi varken kullanıcıya "bunu paylaşmadınız", "bilgi kayıtlı değil" veya benzeri bir cevap verme.
- Hafızadaki bilgileri kullanıcıya "hafıza sisteminden öğrendim" şeklinde açıklama.
- Hafıza kapalıysa hafıza ile ilgili kayıtları kullanma.
`,
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
    // GROQ HATASI
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
    // STREAM
    //------------------------------------

    return new Response(
      response.body,
      {
        headers: {
          "Content-Type":
            "text/event-stream",

          "Cache-Control":
            "no-cache",

          Connection:
            "keep-alive",
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