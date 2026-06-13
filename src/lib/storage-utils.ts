import { supabase } from "@/integrations/supabase/client";

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 350_000) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  bitmap.close();
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function uploadPostImage(file: File, userId: string = TEMP_USER_ID): Promise<string> {
  const uploadFile = await compressImageForUpload(file);
  // Sanitiza: remove acentos, troca espaços e remove qualquer char fora de [a-zA-Z0-9._-]
  const safeName = uploadFile.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const ownerFolder = userId || TEMP_USER_ID;
  const fileName = `${ownerFolder}/${Date.now()}-${safeName}`;

  console.log("Iniciando upload direto para bucket post-images:", fileName);
  
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, uploadFile, {
      cacheControl: '604800',
      contentType: uploadFile.type || 'image/jpeg',
      upsert: false
    });

  if (error) {
    console.error("Erro no upload para o Supabase Storage:", error);
    throw new Error(`Falha no upload: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('post-images')
    .getPublicUrl(fileName);

  return publicUrl;
}
