import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listInstagramConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: owned, error } = await context.supabase.from("perfil_usuario").select("id").eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível carregar suas contas Instagram.");
    if (!owned?.length) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { maintainInstagramConnection } = await import("./instagram-connection.server");
    const { data: rows, error: readError } = await supabaseAdmin.from("perfil_usuario").select("id,user_id,instagram_arroba,arroba_usuario,instagram_access_token,instagram_business_account_id,instagram_connection").eq("user_id", context.userId).in("id", owned.map(p => p.id));
    if (readError) throw new Error("Não foi possível restaurar suas contas Instagram.");
    return Promise.all((rows || []).map(async row => {
      const result = await maintainInstagramConnection(supabaseAdmin, row);
      return { id: row.id, conta: row.instagram_arroba || row.arroba_usuario, state: result.state, message: result.message || (result.state === "reconnect" ? "Autorização expirada ou revogada. Reconecte esta conta." : result.state === "missing" ? "Conta ainda não autorizada." : "Autorização Instagram válida.") };
    }));
  });