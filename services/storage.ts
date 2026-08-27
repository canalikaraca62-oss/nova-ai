import { supabase } from "@/lib/supabase";

export async function uploadFile(
  file: File
): Promise<string> {
  if (!file) {
    throw new Error(
      "Yüklenecek dosya bulunamadı."
    );
  }

  const fileName =
    file.name || "dosya";

  const extension =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase();

  const uniqueFileName =
    extension
      ? `${crypto.randomUUID()}.${extension}`
      : crypto.randomUUID();

  console.log(
    "UPLOAD BAŞLADI:",
    {
      name: file.name,
      size: file.size,
      type: file.type,
    }
  );

  const {
    data,
    error,
  } =
    await supabase.storage
      .from("files")
      .upload(
        uniqueFileName,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType:
            file.type ||
            undefined,
        }
      );

  if (error) {
    console.error(
      "UPLOAD HATASI:",
      error
    );

    throw new Error(
      error.message ||
        "Dosya yüklenemedi."
    );
  }

  if (!data?.path) {
    throw new Error(
      "Dosya yüklendi ancak dosya yolu alınamadı."
    );
  }

  console.log(
    "UPLOAD BAŞARILI:",
    data.path
  );

  return data.path;
}