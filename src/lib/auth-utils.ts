import { supabase } from "@/integrations/supabase/client";

/** Lê o id do usuário autenticado, ou lança um erro amigável. */
export async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  return data.user.id;
}
