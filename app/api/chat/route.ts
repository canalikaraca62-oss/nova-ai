import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  askSyraven,
  generateChatTitle,
} from "@/services/ai.server";

import { analyzeImage } from "@/services/vision.server";

import { parseAction } from "@/services/action-parser";

import {
  readPdf,
  readDocx,
  readText,
  readPptx,
} from "@/services/document-reader";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_AI_FILE_TEXT = 25_000;
const MAX_MEMORIES_FOR_CHECK = 30;

function getExtension(filePath: string) {
  return (
    filePath
      .split(".")
      .pop()
      ?.toLowerCase() ?? ""
  );
}

async function getPrivateFileUrl(filePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from("files")
    .createSignedUrl(filePath, 60 * 5);

  if (error || !data?.signedUrl) {
    throw new Error(
      "Dosya için güvenli erişim bağlantısı oluşturulamadı."
    );
  }

  return data.signedUrl;
}

function isImage(extension: string) {
  return ["png", "jpg", "jpeg", "webp"].includes(extension);
}

async function extractFileText(filePath: string) {
  const extension = getExtension(filePath);

  const supportedExtensions = [
    "pdf",
    "docx",
    "pptx",
    "txt",
    "md",
    "json",
    "csv",
    "js",
    "jsx",
    "ts",
    "tsx",
    "css",
    "html",
    "xml",
    "py",
    "java",
    "c",
    "cpp",
    "cs",
    "sql",
  ];

  if (!supportedExtensions.includes(extension)) {
    throw new Error(
      `Şimdilik .${extension} dosyalarını okuyamıyorum.`
    );
  }

  const fileUrl = await getPrivateFileUrl(filePath);

  const fileResponse = await fetch(fileUrl);

  if (!fileResponse.ok) {
    throw new Error(
      `Dosya indirilemedi. HTTP ${fileResponse.status}`
    );
  }

  const contentLength = Number(
    fileResponse.headers.get("content-length") ?? 0
  );

  if (contentLength > MAX_FILE_SIZE) {
    throw new Error("Dosya çok büyük.");
  }

  switch (extension) {
    case "pdf":
      return readPdf(fileResponse);

    case "docx":
      return readDocx(fileResponse);

    case "pptx":
      return readPptx(fileResponse);

    default:
      return readText(fileResponse);
  }
}

/**
 * Kullanıcının mevcut hafızalarını getirir.
 */
async function getExistingMemories(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("memories")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      })
      .limit(MAX_MEMORIES_FOR_CHECK);

    if (error) {
      console.error(
        "Mevcut hafızalar alınamadı:",
        error
      );

      return [];
    }

    return data || [];
  } catch (error) {
    console.error(
      "Hafıza sorgulama hatası:",
      error
    );

    return [];
  }
}

/**
 * AI ile yeni bilginin gerçekten memory olup olmadığını
 * ve mevcut memory'lerden biriyle aynı olup olmadığını kontrol eder.
 */
async function analyzeMemory(
  userMessage: string,
  existingMemories: Array<{
    id: string;
    content: string;
  }>
) {
  const existingMemoryText =
    existingMemories.length > 0
      ? existingMemories
          .map(
            (memory, index) =>
              `${index + 1}. [ID: ${memory.id}] ${memory.content}`
          )
          .join("\n")
      : "Henüz kayıtlı hafıza yok.";

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
          process.env.GROQ_MODEL ||
          "openai/gpt-oss-20b",

        messages: [
          {
            role: "system",

            content: `
Sen SYRAVEN'in gelişmiş hafıza yöneticisisin.

Görevin:
Kullanıcının mesajını incele ve gelecekte yardımcı olacak kalıcı bir bilgi olup olmadığını belirle.

Önemli olabilecek bilgiler:

- Kullanıcının mesleği
- Uzmanlık alanları
- Kullandığı teknolojiler
- Uzun vadeli projeleri
- Proje hedefleri
- Tercihleri
- Çalışma şekli
- Öğrenme tercihleri
- Kalıcı hedefleri

Kaydetme:

- Selamlaşmaları
- Geçici soruları
- Tek seferlik istekleri
- Şakaları
- Genel bilgileri
- Hassas kişisel bilgileri
- Gereksiz ayrıntıları

ÇOK ÖNEMLİ:

Eğer yeni bilgi mevcut hafızalardan biriyle aynı anlama geliyorsa yeni kayıt oluşturma.

Eğer kullanıcı mevcut bir bilgiyi açıkça değiştiriyorsa,
UPDATE olarak işaretle.

Eğer yeni ve önemli bir bilgi varsa,
CREATE olarak işaretle.

Eğer memory gerekmiyorsa,
NONE olarak işaretle.

SADECE aşağıdaki JSON formatında cevap ver:

{
  "action": "CREATE",
  "memory": "Kısa ve net hafıza cümlesi",
  "memoryId": null
}

veya:

{
  "action": "UPDATE",
  "memory": "Güncellenmiş kısa hafıza cümlesi",
  "memoryId": "mevcut-memory-id"
}

veya:

{
  "action": "NONE",
  "memory": null,
  "memoryId": null
}

Kurallar:

- memory en fazla 300 karakter olsun.
- Kullanıcının söylediğinden fazlasını çıkarma.
- Tahmin yapma.
- Hassas bilgi üretme.
- Aynı bilgiyi farklı kelimelerle tekrar kaydetme.
`.trim(),
          },

          {
            role: "user",

            content: `
MEVCUT HAFIZALAR:

${existingMemoryText}

KULLANICININ YENİ MESAJI:

${userMessage}
`.trim(),
          },
        ],

        temperature: 0.1,
        max_tokens: 180,
      }),
    }
  );

  if (!response.ok) {
    console.error(
      "Memory AI hatası:",
      await response.text()
    );

    return null;
  }

  const data = await response.json();

  const content =
    data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return null;
  }

  try {
    const cleaned = content
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error(
      "Memory JSON parse hatası:",
      error,
      content
    );

    return null;
  }
}

/**
 * Yeni memory oluşturur veya mevcut memory'yi günceller.
 */
async function extractAndSaveMemory(
  userId: string,
  userMessage: string
) {
  if (!userMessage.trim()) {
    return;
  }

  try {
    const existingMemories =
      await getExistingMemories(userId);

    const result = await analyzeMemory(
      userMessage,
      existingMemories
    );

    if (!result) {
      return;
    }

    const action = result.action;
    const memory = result.memory;
    const memoryId = result.memoryId;

    if (
      action !== "CREATE" &&
      action !== "UPDATE"
    ) {
      return;
    }

    if (
      typeof memory !== "string" ||
      memory.trim().length < 5 ||
      memory.trim().length > 300
    ) {
      return;
    }

    const cleanMemory = memory.trim();

    //------------------------------------
    // UPDATE
    //------------------------------------

    if (
      action === "UPDATE" &&
      typeof memoryId === "string"
    ) {
      const existingMemory =
        existingMemories.find(
          (item) =>
            item.id === memoryId
        );

      if (!existingMemory) {
        console.warn(
          "Memory update reddedildi: kayıt bulunamadı."
        );

        return;
      }

      const { error } =
        await supabaseAdmin
          .from("memories")
          .update({
            content: cleanMemory,
          })
          .eq("id", memoryId)
          .eq("user_id", userId);

      if (error) {
        console.error(
          "Memory güncelleme hatası:",
          error
        );

        return;
      }

      console.log(
        "🧠 SYRAVEN MEMORY GÜNCELLEDİ:",
        cleanMemory
      );

      return;
    }

    //------------------------------------
    // CREATE
    //------------------------------------

    if (action === "CREATE") {
      /**
       * Ek güvenlik:
       * AI CREATE dese bile mevcut memory'lerde
       * neredeyse aynı metin varsa tekrar kaydetme.
       */
      const normalizedNewMemory =
        cleanMemory
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      const duplicate =
        existingMemories.some(
          (existing) => {
            const normalizedExisting =
              existing.content
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();

            return (
              normalizedExisting ===
              normalizedNewMemory
            );
          }
        );

      if (duplicate) {
        console.log(
          "🧠 Aynı memory zaten mevcut, kayıt atlandı."
        );

        return;
      }

     const { data: existingMemory, error: searchError } =
  await supabaseAdmin
    .from("memories")
    .select("id, content")
    .eq("user_id", userId)
    .ilike("content", memory)
    .limit(1)
    .maybeSingle();

if (searchError) {
  console.error(
    "Mevcut hafıza kontrolü hatası:",
    searchError
  );

  return;
}

if (existingMemory) {
  console.log(
    "🧠 SYRAVEN: Bu bilgi zaten hafızada."
  );

  return;
}

const { error } =
  await supabaseAdmin
    .from("memories")
    .insert({
      user_id: userId,
      content: memory,
    });

if (error) {
  console.error(
    "Memory kaydetme hatası:",
    error
  );

  return;
}

console.log(
  "🧠 SYRAVEN MEMORY KAYDETTİ:",
  memory
);

      console.log(
        "🧠 SYRAVEN MEMORY KAYDETTİ:",
        cleanMemory
      );
    }
  } catch (error) {
    console.error(
      "Memory analiz hatası:",
      error
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    //------------------------------------
    // KULLANICI
    //------------------------------------

    const authHeader =
      req.headers.get("authorization");

    let userId: string | null = null;

    if (
      authHeader?.startsWith(
        "Bearer "
      )
    ) {
      const token =
        authHeader.replace(
          "Bearer ",
          ""
        );

      const {
        data: { user },
      } =
        await supabaseAdmin.auth.getUser(
          token
        );

      userId = user?.id ?? null;
    }

    //------------------------------------
    // SOHBET BAŞLIĞI
    //------------------------------------

    if (body.generateTitle) {
      const title =
        await generateChatTitle(
          body.firstMessage ?? ""
        );

      return NextResponse.json({
        reply: title,
      });
    }

    //------------------------------------
    // MESAJLAR
    //------------------------------------

    const messages =
      Array.isArray(body.messages)
        ? [...body.messages]
        : [];

    //------------------------------------
    // SON KULLANICI MESAJI
    //------------------------------------

    const lastUserMessage =
      [...messages]
        .reverse()
        .find(
          (message) =>
            message?.role === "user"
        );

    const userMessage =
      typeof lastUserMessage?.content ===
      "string"
        ? lastUserMessage.content
        : "";

    //------------------------------------
    // DOSYA VARSA
    //------------------------------------

    if (body.file) {
      const extension =
        getExtension(body.file);

      //------------------------------------
      // RESİM
      //------------------------------------

      if (isImage(extension)) {
        const imageUrl =
          await getPrivateFileUrl(
            body.file
          );

        const visionReply =
          await analyzeImage(
            imageUrl
          );

        return NextResponse.json({
          reply: visionReply,
        });
      }

      //------------------------------------
      // BELGE
      //------------------------------------

      try {
        const fileText =
          await extractFileText(
            body.file
          );

        if (!fileText) {
          return NextResponse.json(
            {
              reply:
                "Dosya okunamadı.",
            },
            {
              status: 400,
            }
          );
        }

        const limitedFileText =
          fileText.length >
          MAX_AI_FILE_TEXT
            ? fileText.slice(
                0,
                MAX_AI_FILE_TEXT
              ) +
              "\n\n[Dosyanın geri kalanı çok uzun olduğu için buraya eklenmedi.]"
            : fileText;

        messages.push({
          role: "system",

          content: `
Kullanıcı bu dosyayı yükledi:

${body.file}

Dosya içeriği:

${limitedFileText}

Kurallar:

- Dosyayı gerçekten okumuş gibi davran.
- Soruları bu dosyaya göre cevapla.
- "Dosyayı göremiyorum" deme.
- "Dosyaya erişemiyorum" deme.
- Dosya çok uzunsa mevcut içerikten mümkün olduğunca doğru cevap ver.
`.trim(),
        });
      } catch (err) {
        console.error(err);

        return NextResponse.json(
          {
            reply:
              err instanceof Error
                ? err.message
                : "Dosya okunamadı.",
          },
          {
            status: 400,
          }
        );
      }
    }

    //------------------------------------
    // MEMORY
    //------------------------------------

    if (
      userId &&
      userMessage
    ) {
      /**
       * Hafıza analizinin ana cevabı
       * gereksiz yere bekletmemesi için
       * arka planda çalışmasına izin veriyoruz.
       *
       * Not:
       * Node process kapanmadan promise'ın
       * tamamlanmasına fırsat vermek için
       * await kullanıyoruz.
       */
      await extractAndSaveMemory(
        userId,
        userMessage
      );
    }

    //------------------------------------
    // AI
    //------------------------------------

   const reply =
  await askSyraven(
    messages,
    userId ?? undefined
  );

//------------------------------------
// ACTIONS
//------------------------------------

if (userId && userMessage) {
  try {
    const action = await parseAction(userMessage);

    if (action) {
      console.log(
        "⚡ SYRAVEN ACTION:",
        action
      );
    }
  } catch (error) {
    console.error(
      "Action parser hatası:",
      error
    );
  }
}

return NextResponse.json({
  reply,
});
  } catch (error) {
    console.error(
      "CHAT API HATASI:",
      error
    );

    return NextResponse.json(
      {
        reply:
          "Sunucu hatası oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}