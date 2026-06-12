import { supabase } from "@/integrations/supabase/client";

export async function uploadPostImage(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  
  console.log("Iniciando upload manual para bucket post-images:", fileName);
  
  // Tentativa de upload com retry simplificado para lidar com timeouts intermitentes
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (error.message?.includes('timeout') && retryCount < maxRetries) {
          retryCount++;
          console.log(`Timeout detectado. Tentativa ${retryCount} de ${maxRetries}...`);
          continue;
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      console.log("Upload concluído com sucesso. URL pública:", publicUrl);
      return publicUrl;
    } catch (err: any) {
      if (retryCount >= maxRetries) {
        console.error("Erro final no upload para o Supabase Storage:", err);
        throw new Error(`Falha no upload após tentativas: ${err.message || 'Erro desconhecido'}`);
      }
      retryCount++;
    }
  }
  
  throw new Error("Falha inesperada no fluxo de upload.");
}
