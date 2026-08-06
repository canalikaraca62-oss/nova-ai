import { supabase } from "@/lib/supabase";

export async function uploadFile(file: File) {
  console.log("UPLOAD BAŞLADI");

  const extension = file.name.split(".").pop();

  const fileName = `${crypto.randomUUID()}.${extension}`;

  const { data, error } = await supabase.storage
    .from("files")
    .upload(fileName, file);

  console.log(data);
  console.log(error);

  if (error) throw error;

  // Public URL yerine Storage path döndür
  return fileName;
}