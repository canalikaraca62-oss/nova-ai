import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const groqApiKey =
  process.env.GROQ_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    //------------------------------------
    // AUTH TOKEN
    //------------------------------------

    const authHeader =
      req.headers.get("authorization");

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

    const token =
      authHeader.replace("Bearer ", "");

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

    const messages = Array.isArray(body.messages)
      ? [...body.messages]
      : [];

    //------------------------------------
    // HAFIZA
    //------------------------------------

    const { data: memories, error: memoryError } =
      await supabase
        .from("memories")
        .select("content")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(20);

        console.log("STREAM USER ID:", user.id);
console.log("STREAM MEMORY:", memories, memoryError);

    if (memoryError) {
      console.error(
        "HAFIZA OKUMA HATASI:",
        memoryError
      );
    }

    //------------------------------------
    // HAFIZAYI AI'YA EKLE
    //------------------------------------

   let memoryText = "";

if (memories && memories.length > 0) {
  memoryText = memories
    .map((memory) => `- ${memory.content}`)
    .join("\n");
}
//------------------------------------
// GENEL MEMORY TESPİTİ
//------------------------------------

const latestUserMessage = [...messages]
  .reverse()
  .find(
    (message) =>
      message.role === "user" &&
      typeof message.content === "string"
  );

if (latestUserMessage?.content) {
  const userText = latestUserMessage.content.trim();

  //------------------------------------
  // SORU VE GEÇİCİ CÜMLELERİ AYIKLA
  //------------------------------------

  const isQuestion =
    userText.endsWith("?") ||
    /^(ne|nedir|kim|kimim|nerede|neden|nasıl|nasıl|hangi|kaç|ne zaman|sence|biliyor musun|hatırlıyor musun)\b/i.test(
      userText
    );

  if (!isQuestion) {
    //------------------------------------
    // İSİM TESPİTİ
    //------------------------------------

    const memoryMatch = userText.match(
      /^(?:benim adım|adım|ismim)\s*(?:=|:)?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+)?)\s*[.!]*$/i
    );

    if (memoryMatch?.[1]) {
      const newName = memoryMatch[1].trim();

      const invalidNames = [
        "ne",
        "nedir",
        "kim",
        "kimim",
        "sen",
        "ben",
        "adım",
        "ismim",
      ];

      const normalizedName =
        newName.toLocaleLowerCase("tr-TR");

      if (!invalidNames.includes(normalizedName)) {
        const memoryContent =
          `Kullanıcının adı ${newName}.`;

        const {
          data: existingNameMemory,
          error: findError,
        } = await supabase
          .from("memories")
          .select("id")
          .eq("user_id", user.id)
          .ilike(
            "content",
            "Kullanıcının adı %"
          )
          .limit(1)
          .maybeSingle();

        if (findError) {
          console.error(
            "İSİM MEMORY ARAMA HATASI:",
            findError
          );
        } else if (existingNameMemory) {
          const { error: updateError } =
            await supabase
              .from("memories")
              .update({
                content: memoryContent,
              })
              .eq(
                "id",
                existingNameMemory.id
              );

          if (updateError) {
            console.error(
              "İSİM MEMORY GÜNCELLEME HATASI:",
              updateError
            );
          }
        } else {
          const { error: insertError } =
            await supabase
              .from("memories")
              .insert({
                user_id: user.id,
                content: memoryContent,
              });

          if (insertError) {
            console.error(
              "İSİM MEMORY KAYDETME HATASI:",
              insertError
            );
          }
        }
      }
    } else {
      //------------------------------------
      // GENEL KALICI BİLGİ TESPİTİ
      //------------------------------------

      const memoryPatterns = [
        {
          pattern:
            /\b(?:KKTC|Kuzey Kıbrıs|Kıbrıs|Türkiye|İstanbul|Ankara|İzmir|Lefkoşa|Girne|Mağusa|Gazimağusa)\b.*\b(?:yaşıyorum|oturuyorum|ikamet ediyorum)\b/i,
          label: "Kullanıcının yaşadığı yer",
        },

        {
          pattern:
            /^(?:hedefim|hedefim şu|amacım|amacım şu)\s+(.+)/i,
          label: "Kullanıcının hedefi",
        },

        {
          pattern:
            /^(?:hayalim|hayalim şu)\s+(.+)/i,
          label: "Kullanıcının hayali",
        },

        {
          pattern:
            /^(?:ben|bende)\s+(.+?)\s+(?:öğreniyorum|çalışıyorum|okuyorum)\.?$/i,
          label: "Kullanıcının öğrenim veya çalışma bilgisi",
        },

        {
          pattern:
            /^(?:ben|bende)\s+(.+?)\s+(?:öğrencisiyim|mezunuyum)\.?$/i,
          label: "Kullanıcının eğitim bilgisi",
        },

        {
          pattern:
            /^en sevdiğim\s+(.+?)\s+(.+?)[.!]*$/i,
          label: "Kullanıcının tercihi",
        },

        {
          pattern:
            /^favori\s+(.+?)\s+(.+?)[.!]*$/i,
          label: "Kullanıcının tercihi",
        },

        {
          pattern:
            /^(.+?)\s+öğreniyorum[.!]*$/i,
          label: "Kullanıcının öğrenmekte olduğu konu",
        },

        {
          pattern:
            /^(.+?)\s+üzerinde çalışıyorum[.!]*$/i,
          label: "Kullanıcının üzerinde çalıştığı konu",
        },
      ];

      const matchedMemory =
        memoryPatterns.find((item) =>
          item.pattern.test(userText)
        );

      if (matchedMemory) {
        //------------------------------------
        // MEMORY METNİNİ OLUŞTUR
        //------------------------------------

        let memoryContent = "";

        if (
          matchedMemory.label ===
          "Kullanıcının yaşadığı yer"
        ) {
          memoryContent =
            `Kullanıcı ${userText}`;
        } else if (
          matchedMemory.label ===
          "Kullanıcının hedefi"
        ) {
          const target =
            userText
              .replace(
                /^(?:hedefim|hedefim şu|amacım|amacım şu)\s+/i,
                ""
              )
              .replace(/[.!]+$/, "")
              .trim();

          memoryContent =
            `Kullanıcının hedefi: ${target}.`;
        } else if (
          matchedMemory.label ===
          "Kullanıcının hayali"
        ) {
          const dream =
            userText
              .replace(
                /^(?:hayalim|hayalim şu)\s+/i,
                ""
              )
              .replace(/[.!]+$/, "")
              .trim();

          memoryContent =
            `Kullanıcının hayali: ${dream}.`;
        } else if (
          matchedMemory.label ===
          "Kullanıcının tercihi"
        ) {
          memoryContent =
            `Kullanıcının tercihi: ${userText}`;
        } else {
          memoryContent =
            `Kullanıcı hakkında bilgi: ${userText}`;
        }

        //------------------------------------
        // AYNI MEMORY ZATEN VAR MI?
        //------------------------------------

        const {
          data: existingMemory,
          error: findMemoryError,
        } = await supabase
          .from("memories")
          .select("id")
          .eq("user_id", user.id)
          .eq("content", memoryContent)
          .limit(1)
          .maybeSingle();

        if (findMemoryError) {
          console.error(
            "GENEL MEMORY ARAMA HATASI:",
            findMemoryError
          );
        } else if (!existingMemory) {
          //------------------------------------
          // YENİ MEMORY KAYDET
          //------------------------------------

          const {
            error: insertMemoryError,
          } = await supabase
            .from("memories")
            .insert({
              user_id: user.id,
              content: memoryContent,
            });

          if (insertMemoryError) {
            console.error(
              "GENEL MEMORY KAYDETME HATASI:",
              insertMemoryError
            );
          } else {
            console.log(
              "YENİ MEMORY KAYDEDİLDİ:",
              memoryContent
            );
          }
        }
      }
    }
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
          model: "llama-3.3-70b-versatile",

          stream: true,

          temperature: 0.7,

        messages: [
  {
    role: "system",
    content: `
Sen QELVORA isimli gelişmiş bir yapay zekâ asistansın.

Kurallar:

- Türkçe konuş.
- Profesyonel ol.
- Gereksiz uzun cevap verme.
- Yazılım konusunda uzmansın.
- Konuşmanın tamamını dikkate al.

KULLANICI HAFIZASI:

${memoryText || "Kullanıcı hakkında kayıtlı bir bilgi yok."}

Hafızadaki bilgiler kullanıcı hakkında daha önce kaydedilmiş gerçek bilgilerdir.

Önemli:
- Kullanıcı hafızasında bir bilgi varsa onu kullan.
- Kullanıcı "Benim adım ne?" gibi bir soru sorarsa ve hafızasında adı kayıtlıysa doğrudan kayıtlı adı söyle.
- Kayıtlı bir bilgi varken kullanıcıya "bunu paylaşmadınız", "bilgi kayıtlı değil" veya benzeri bir cevap verme.
- Hafızadaki bilgileri kullanıcıya "hafıza sisteminden öğrendim" şeklinde açıklama.
`,
  },

  ...messages.filter(
    (message) => message.role !== "system"
  ),
],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "GROQ STREAM HATASI:",
        errorText
      );

      return NextResponse.json(
        {
          error: "AI servisi cevap veremedi.",
        },
        {
          status: 500,
        }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(
      "STREAM SERVER HATASI:",
      error
    );

    return NextResponse.json(
      {
        error: "Sunucu hatası oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}
