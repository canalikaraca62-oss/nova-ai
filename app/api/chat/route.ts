import { NextResponse } from "next/server";

import {
  askNova,
  generateChatTitle,
} from "@/services/ai.server";

import { readDocument } from "@/services/document-reader";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const MAX_FILE_SIZE =
  15 * 1024 * 1024;

function getExtension(
  filePath: string
) {
  return (
    filePath
      .split(".")
      .pop()
      ?.toLowerCase() ?? ""
  );
}

function getPublicFileUrl(
  filePath: string
) {
  const encodedPath =
    filePath
      .split("/")
      .map(
        encodeURIComponent
      )
      .join("/");

  return `${SUPABASE_URL}/storage/v1/object/public/files/${encodedPath}`;
}

async function extractFileText(
  filePath: string
) {
  const extension =
    getExtension(filePath);

  const supportedExtensions = [
    "docx",
    "pdf",
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

  if (
    !supportedExtensions.includes(
      extension
    )
  ) {
    throw new Error(
      `Şimdilik .${extension} dosyalarını okuyamıyorum.`
    );
  }

  const fileUrl =
    getPublicFileUrl(filePath);

  console.log(
    "DOSYA İNDİRİLİYOR:",
    fileUrl
  );

  const fileResponse =
    await fetch(fileUrl);

  if (!fileResponse.ok) {
    throw new Error(
      `Dosya indirilemedi. HTTP ${fileResponse.status}`
    );
  }

  const contentLength =
    Number(
      fileResponse.headers.get(
        "content-length"
      ) ?? 0
    );

  if (
    contentLength >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      "Dosya çok büyük."
    );
  }

  return await readDocument(
    extension,
    fileResponse
  );
}

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    //----------------------------------
    // BAŞLIK ÜRET
    //----------------------------------

    if (body.generateTitle) {
      const title =
        await generateChatTitle(
          body.firstMessage ??
            ""
        );

      return NextResponse.json({
        reply: title,
      });
    }

    //----------------------------------
    // MESAJLAR
    //----------------------------------

    const messages =
      Array.isArray(
        body.messages
      )
        ? [...body.messages]
        : [];
            //----------------------------------
    // DOSYA VARSA OKU
    //----------------------------------

    if (body.file) {
      try {
        console.log(
          "DOSYA PATH:",
          body.file
        );

        const fileText =
          await extractFileText(
            body.file
          );

        console.log(
          "DOSYA OKUNDU:",
          fileText.length,
          "karakter"
        );

        if (!fileText) {
          return NextResponse.json(
            {
              reply:
                "Dosya yüklendi fakat okunabilir metin bulunamadı.",
            },
            {
              status: 400,
            }
          );
        }

        messages.push({
          role: "system",
          content: `
Kullanıcı bu mesajla birlikte bir dosya yükledi.

Dosya yolu:

${body.file}

Dosyanın çıkarılmış içeriği aşağıdadır.

==================

${fileText}

==================

Kurallar:

- Dosyanın içeriğini gerçekten okumuş gibi davran.
- Kullanıcının sorularını bu dosyaya göre cevapla.
- "Dosyayı göremiyorum" deme.
- "Dosyaya erişemiyorum" deme.
- Eğer kullanıcı sadece dosyayı yüklediyse,
dosyayı aldığını söyle ve özetleyebileceğini,
analiz edebileceğini veya soruları cevaplayabileceğini belirt.
`,
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

    //----------------------------------
    // AI
    //----------------------------------

    const reply =
      await askNova(messages);

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