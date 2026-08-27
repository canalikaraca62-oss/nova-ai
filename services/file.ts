import { supabase } from "@/lib/supabase";

export async function uploadFile(
  file: File
) {
  if (!file) {
    throw new Error(
      "Yüklenecek dosya bulunamadı."
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ??
    "";

  const fileName =
    extension
      ? `${crypto.randomUUID()}.${extension}`
      : crypto.randomUUID();

  const {
    data,
    error,
  } =
    await supabase.storage
      .from("files")
      .upload(
        fileName,
        file,
        {
          upsert: false,
        }
      );

  if (error) {
    console.error(
      "DOSYA YÜKLEME HATASI:",
      error
    );

    throw error;
  }

  return (
    data?.path ??
    fileName
  );
}