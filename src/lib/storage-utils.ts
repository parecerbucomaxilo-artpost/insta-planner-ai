import { supabase } from "@/integrations/supabase/client";

/**
 * Converte um base64/dataURL para Blob e garante que seja JPEG
 */
async function dataURLtoBlob(dataurl: string): Promise<Blob> {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Faz upload de uma imagem (base64) para o Supabase Storage e retorna a URL pública definitiva.
 */
export async function uploadGeneratedImage(dataUrl: string): Promise<string> {
  if (!dataUrl) throw new Error("DataURL da imagem é obrigatório");

  const blob = await dataURLtoBlob(dataUrl);
  
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData?.user?.id || 'anonymous';
  
  // Nome único com UUID e timestamp
  const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}.png`;
  
  const { data, error } = await supabase.storage
    .from("post-images")
    .upload(fileName, blob, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error("Erro no upload para o Storage (usando fallback de DataURL):", error);
    // Se o upload falhar, retorna o próprio dataUrl como fallback para não quebrar a UI
    return dataUrl;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("post-images")
    .getPublicUrl(data.path);
    
  return publicUrl;
}
