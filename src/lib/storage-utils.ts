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
export async function uploadFile(file: File): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    throw new Error("Usuário não autenticado — faça login para enviar arquivos.");
  }
  const userId = userData.user.id;
  
  // Nome único para o arquivo usando crypto.randomUUID()
  const fileName = `${userId}/${Date.now()}-${crypto.randomUUID()}-${file.name}`;
  
  const { data, error } = await supabase.storage
    .from("post-images")
    .upload(fileName, file, {
      upsert: true,
    });

  if (error) {
    console.error("Erro no upload para o Storage:", error);
    // Relançamos o erro para que o componente possa exibir o alerta em vermelho
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("post-images")
    .getPublicUrl(fileName);
    
  return publicUrl;
}

/**
 * Faz upload de uma imagem (base64) para o Supabase Storage e retorna a URL pública definitiva.
 */
export async function uploadGeneratedImage(dataUrl: string): Promise<string> {
  if (!dataUrl) throw new Error("DataURL da imagem é obrigatório");

  const blob = await dataURLtoBlob(dataUrl);
  
  // Criamos um File a partir do Blob para usar a função uploadFile
  const file = new File([blob], "generated-image.png", { type: "image/png" });
  return uploadFile(file);
}
