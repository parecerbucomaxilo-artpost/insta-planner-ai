import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyNotifs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notificacoes_erro")
      .select("id,tipo,titulo,mensagem,post_id,lida,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { items: data ?? [], naoLidas: (data ?? []).filter((n: any) => !n.lida).length };
  });

export const markAllNotifsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notificacoes_erro")
      .update({ lida: true })
      .eq("user_id", userId)
      .eq("lida", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
