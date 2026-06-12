import { supabase } from "@/integrations/supabase/client";

export async function uploadPostImage(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  
  console.log("Iniciando upload direto para bucket post-images:", fileName);
  
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, file, {
      cacheControl: '3600',
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
