import { createServerFn } from "@tanstack/react-start";

// Auth está desativada no app — usamos supabaseAdmin e retornamos as notificações
// de todos os usuários (na prática 1 usuário ativo). Quando auth voltar, trocar
// para requireSupabaseAuth + filtro por context.userId.
export const listMyNotifs = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("notificacoes_erro")
    .select("id,tipo,titulo,mensagem,post_id,lida,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return { items: data ?? [], naoLidas: (data ?? []).filter((n: any) => !n.lida).length };
});

export const markAllNotifsRead = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("notificacoes_erro")
    .update({ lida: true })
    .eq("lida", false);
  if (error) throw new Error(error.message);
  return { ok: true };
});
