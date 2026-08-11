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

    if (memoryError) {
      console.error(
        "HAFIZA OKUMA HATASI:",
        memoryError
      );
    }

    //------------------------------------
    // HAFIZAYI AI'YA EKLE
    //------------------------------------

    if (memories && memories.length > 0) {
      const memoryText = memories
        .map((memory) => `- ${memory.content}`)
        .join("\n");

      messages.unshift({
        role: "system",
        content: `
Kullanıcı hakkında daha önce kaydedilmiş bilgiler:

${memoryText}

Bu bilgileri yalnızca ilgili olduklarında kullan.
Kullanıcıya bu bilgilerin bir hafıza sisteminden geldiğini söyleme.
`,
      });
    }
  //------------------------------------
// YENİ MEMORY TESPİTİ
//------------------------------------

const latestUserMessage = [...messages]
  .reverse()
  .find(
    (message) => message.role === "user"
  );

if (latestUserMessage?.content) {
  const memoryMatch =
    latestUserMessage.content.match(
      /(?:benim adım|adım|ismim)\s+(?:[=:]?\s*)([A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+)?)/i
    );

  if (memoryMatch?.[1]) {
    const newName =
      memoryMatch[1].trim();

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
      const {
        error: updateError,
      } = await supabase
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
      const {
        error: insertError,
      } = await supabase
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
`,
            },

            ...messages,
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
