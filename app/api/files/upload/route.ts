import { NextResponse } from "next/server";

/*
  SERVICE ROLE CLIENT — justification (ARCHITECTURE_AUDIT.md §8.6)

  supabaseAdmin is used here for Supabase Storage operations. Storage
  access is governed by bucket policies rather than table RLS, and the
  upload path writes to a server-controlled storage prefix.

  Ownership is enforced in code: every write is keyed to session.userId,
  which withAuth verifies before this handler runs.
*/
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { withAuth } from "@/lib/api/withAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN FILE UPLOAD API
================================================== */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const STORAGE_BUCKET = "files";

/* ==================================================
   TYPES
================================================== */


type UploadResponse = {
  success: boolean;
  file?: {
    id: string;
    name: string;
    originalName: string;
    path: string;
    bucket: string;
    mimeType: string;
    size: number;
    url: string | null;
    createdAt: string;
  };
  error?: string;
};

/* ==================================================
   ALLOWED FILE TYPES
================================================== */

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",

  // Presentations
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text / data
  "text/plain",
  "text/markdown",
  "application/json",
  "application/xml",
  "text/xml",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",

  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",

  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // Code / source files
  "application/javascript",
  "text/javascript",
  "application/typescript",
  "text/typescript",
  "text/css",
  "text/html",
]);

/* ==================================================
   SAFE EXTENSIONS

   Bazı browser'lar code/text dosyalarında boş
   MIME type gönderebildiği için extension fallback
   kullanıyoruz.
================================================== */

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "txt",
  "md",
  "json",
  "xml",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "svg",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "webm",
  "mp4",
  "mov",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "html",
  "htm",
  "py",
  "java",
  "go",
  "rs",
  "sql",
  "yaml",
  "yml",
]);

/* ==================================================
   HELPERS
================================================== */

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();

  const lastDotIndex = normalized.lastIndexOf(".");

  if (
    lastDotIndex === -1 ||
    lastDotIndex === normalized.length - 1
  ) {
    return "";
  }

  return normalized.slice(lastDotIndex + 1);
}

function sanitizeFileName(fileName: string) {
  const extension = getFileExtension(fileName);

  const baseName =
    extension.length > 0
      ? fileName.slice(
          0,
          -(extension.length + 1)
        )
      : fileName;

  const safeBaseName = baseName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

  const finalBaseName =
    safeBaseName || "file";

  return extension
    ? `${finalBaseName}.${extension}`
    : finalBaseName;
}

function isAllowedFile(file: File) {
  const mimeType = file.type
    ?.trim()
    .toLowerCase();

  const extension =
    getFileExtension(file.name);

  if (
    mimeType &&
    ALLOWED_MIME_TYPES.has(mimeType)
  ) {
    return true;
  }

  return ALLOWED_EXTENSIONS.has(
    extension
  );
}

function createStoragePath({
  userId,
  fileName,
}: {
  userId: string;
  fileName: string;
}) {
  const timestamp = Date.now();
  const randomId =
    crypto.randomUUID();

  const safeFileName =
    sanitizeFileName(fileName);

  return [
    userId,
    new Date().getFullYear(),
    String(
      new Date().getMonth() + 1
    ).padStart(2, "0"),
    `${timestamp}-${randomId}-${safeFileName}`,
  ].join("/");
}


/* ==================================================
   AUTHENTICATE USER
================================================== */


/* ==================================================
   GET FILE
================================================== */

function getUploadedFile(
  formData: FormData
) {
  const candidates = [
    formData.get("file"),
    formData.get("files"),
    formData.get("document"),
  ];

  for (const candidate of candidates) {
    if (candidate instanceof File) {
      return candidate;
    }
  }

  return null;
}

/* ==================================================
   POST
================================================== */

export const POST = withAuth(async (
  request,
  session
) => {
  try {
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

    /*
      Authentication is performed by withAuth (lib/api/withAuth.ts)
      before this handler runs. The route-local helper this replaced
      also parsed a Supabase auth cookie by hand; withAuth handles both
      Bearer and cookie sessions through @supabase/ssr.
    */
    const user = {
      id: session.userId,
    };

    /* ----------------------------------------------
       CONTENT TYPE CHECK
    ---------------------------------------------- */

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (
      !contentType.includes(
        "multipart/form-data"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Content-Type must be multipart/form-data.",
        } satisfies UploadResponse,
        {
          status: 415,
        }
      );
    }

    /* ----------------------------------------------
       FORM DATA
    ---------------------------------------------- */

    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid multipart form data.",
        } satisfies UploadResponse,
        {
          status: 400,
        }
      );
    }

    const file =
      getUploadedFile(formData);

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No file was provided.",
        } satisfies UploadResponse,
        {
          status: 400,
        }
      );
    }

    /* ----------------------------------------------
       VALIDATION
    ---------------------------------------------- */

    if (!file.name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The uploaded file must have a name.",
        } satisfies UploadResponse,
        {
          status: 400,
        }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Empty files cannot be uploaded.",
        } satisfies UploadResponse,
        {
          status: 400,
        }
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The file exceeds the 50 MB upload limit.",
        } satisfies UploadResponse,
        {
          status: 413,
        }
      );
    }

    if (!isAllowedFile(file)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This file type is not supported.",
        } satisfies UploadResponse,
        {
          status: 415,
        }
      );
    }

    /* ----------------------------------------------
       STORAGE PATH
    ---------------------------------------------- */

    const storagePath =
      createStoragePath({
        userId: user.id,
        fileName: file.name,
      });

    const mimeType =
      file.type ||
      "application/octet-stream";

    /* ----------------------------------------------
       UPLOAD TO SUPABASE STORAGE
    ---------------------------------------------- */

    const fileBuffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    const {
      error: uploadError,
    } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(
        storagePath,
        fileBuffer,
        {
          contentType: mimeType,
          upsert: false,
        }
      );

    if (uploadError) {
      console.error(
        "SYRAVEN FILE UPLOAD ERROR:",
        uploadError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The file could not be uploaded.",
        } satisfies UploadResponse,
        {
          status: 500,
        }
      );
    }

    /* ----------------------------------------------
       SIGNED URL

       Bucket private olsa bile kullanıcıya kısa
       süreli erişim URL'si üretilebilir.
    ---------------------------------------------- */

    let signedUrl: string | null =
      null;

    const {
      data: signedUrlData,
    } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(
        storagePath,
        60 * 60
      );

    if (signedUrlData?.signedUrl) {
      signedUrl =
        signedUrlData.signedUrl;
    }

    /* ----------------------------------------------
       SUCCESS
    ---------------------------------------------- */

    const response: UploadResponse = {
      success: true,
      file: {
        id: crypto.randomUUID(),
        name: sanitizeFileName(
          file.name
        ),
        originalName: file.name,
        path: storagePath,
        bucket: STORAGE_BUCKET,
        mimeType,
        size: file.size,
        url: signedUrl,
        createdAt:
          new Date().toISOString(),
      },
    };

    return NextResponse.json(
      response,
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN FILE UPLOAD UNEXPECTED ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while uploading the file.",
      } satisfies UploadResponse,
      {
        status: 500,
      }
    );
  }
})

/* ==================================================
   METHOD NOT ALLOWED
================================================== */

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Method not allowed.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}