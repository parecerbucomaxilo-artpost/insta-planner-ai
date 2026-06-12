import { supabase } from "@/integrations/supabase/client";

/** Lê o id do usuário autenticado, ou retorna um ID temporário se a autenticação estiver desativada. */
export async function getAuthedUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  
  if (data?.user) {
    return data.user.id;
  }
  
  // Retorna um ID temporário/fixo para permitir o uso do app sem login
  // Importante: RLS deve permitir inserts para este ID ou para anon
  console.warn("Usuário não autenticado. Usando ID temporário.");
  return "00000000-0000-0000-0000-000000000000"; 
}
