import { supabase } from "@/integrations/supabase/client";

/**
 * Converte um base64/dataURL para Blob
 */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Faz upload de uma imagem (base64) para o Supabase Storage e retorna a URL pública.
 */
export async function uploadToSupabase(dataUrl: string, path: string): Promise<string> {
  const blob = dataURLtoBlob(dataUrl);
  const fileExt = blob.type.split("/")[1] || "png";
  const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from("posts_media")
    .upload(filePath, blob, {
      contentType: blob.type,
      upsert: true,
    });

  if (error) {
    console.error("Erro no upload para o Storage:", error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("posts_media")
    .getPublicUrl(data.path);

  return publicUrl;
}
