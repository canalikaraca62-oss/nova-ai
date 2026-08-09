import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  askNova,
  generateChatTitle,
} from "@/services/ai.server";

import {
  analyzeImage,
} from "@/services/vision.server";

import {
  readPdf,
  readDocx,
  readText,
  readPptx,
} from "@/services/document-reader";

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

async function getPrivateFileUrl(
  filePath: string
) {
  const { data, error } =
    await supabaseAdmin.storage
      .from("files")
      .createSignedUrl(filePath, 60 * 5);

  if (error || !data?.signedUrl) {
    throw new Error(
      "Dosya için güvenli erişim bağlantısı oluşturulamadı."
    );
  }

  return data.signedUrl;
}

function isImage(
  extension: string
) {
  return [
    "png",
    "jpg",
    "jpeg",
    "webp",
  ].includes(extension);
}

async function extractFileText(
  filePath: string
) {
  const extension =
    getExtension(filePath);

  console.log(
    "PPTX DEBUG FILE PATH:",
    filePath
  );

  console.log(
    "PPTX DEBUG EXTENSION:",
    extension
  );

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
  await getPrivateFileUrl(filePath);

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
export async function POST(req: Request) {
  try {
    const body = await req.json();

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

    const messages = Array.isArray(
      body.messages
    )
      ? [...body.messages]
      : [];

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
                "Dosya okunamadı.",
            },
            {
              status: 400,
            }
          );
        }

       const MAX_AI_FILE_TEXT = 25_000;

const limitedFileText =
  fileText.length > MAX_AI_FILE_TEXT
    ? fileText.slice(0, MAX_AI_FILE_TEXT) +
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
- Dosya çok uzunsa, mevcut içerikten mümkün olduğunca doğru cevap ver.
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

    //------------------------------------
    // AI
    //------------------------------------

    const reply =
      await askNova(messages);

    return NextResponse.json({
      reply,
    });
      } catch (error) {
    console.error(error);

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