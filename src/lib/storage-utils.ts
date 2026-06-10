import { supabase } from "@/integrations/supabase/client";

/**
 * Converte um base64/dataURL para Blob e garante que seja JPEG se solicitado
 */
async function dataURLtoJPG(dataurl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do canvas"));
        return;
      }
      // Fundo branco para garantir que transparências do PNG não fiquem pretas no JPG
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Falha na conversão para Blob"));
        },
        "image/jpeg",
        0.92
      );
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem para conversão"));
    img.src = dataurl;
  });
}

/**
 * Faz upload de uma imagem (base64) para o Supabase Storage e retorna a URL pública.
 */
export async function uploadToSupabase(dataUrl: string, path: string): Promise<string> {
  const blob = await dataURLtoJPG(dataUrl);
  const fileName = `${path}-${Math.random().toString(36).substring(2)}.jpg`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from("posts_media")
    .upload(filePath, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error("Erro no upload para o Storage:", error);
    throw error;
  }

  // Criar uma Signed URL válida por 1 hora (3600 segundos)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("posts_media")
    .createSignedUrl(data.path, 3600);

  if (signedError) {
    console.error("Erro ao gerar Signed URL:", signedError);
    // Fallback para Public URL caso a assinatura falhe
    const { data: { publicUrl } } = supabase.storage
      .from("posts_media")
      .getPublicUrl(data.path);
    return publicUrl;
  }

  return signedData.signedUrl;
}
