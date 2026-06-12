import { supabase } from "@/integrations/supabase/client";

export async function uploadPostImage(file: File): Promise<string> {
  // Sanitiza: remove acentos, troca espaços e remove qualquer char fora de [a-zA-Z0-9._-]
  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const fileName = `${Date.now()}-${safeName}`;

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
