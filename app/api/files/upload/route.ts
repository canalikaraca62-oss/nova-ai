import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

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

function getBearerToken(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [type, token] =
    authorization.split(" ");

  if (
    type?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token.trim();
}

/* ==================================================
   AUTHENTICATE USER
================================================== */

async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const bearerToken =
    getBearerToken(request);

  /*
    Authorization header varsa doğrudan
    Supabase access token doğrulanır.
  */

  if (bearerToken) {
    const {
      data,
      error,
    } = await supabaseAdmin.auth.getUser(
      bearerToken
    );

    if (!error && data.user) {
      return {
        id: data.user.id,
        email: data.user.email,
      };
    }
  }

  /*
    Cookie tabanlı auth kullanan client'lar için
    Supabase auth cookie içindeki token denenir.
  */

  const cookies = request.cookies.getAll();

  const authCookie = cookies.find(
    (cookie) =>
      cookie.name.includes(
        "auth-token"
      ) ||
      cookie.name.startsWith(
        "sb-"
      )
  );

  if (!authCookie?.value) {
    return null;
  }

  try {
    const parsedValue =
      JSON.parse(authCookie.value);

    const accessToken =
      parsedValue?.access_token;

    if (!accessToken) {
      return null;
    }

    const {
      data,
      error,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  } catch {
    return null;
  }
}

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

export async function POST(
  request: NextRequest
) {
  try {
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

    const user =
      await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        } satisfies UploadResponse,
        {
          status: 401,
        }
      );
    }

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
}

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