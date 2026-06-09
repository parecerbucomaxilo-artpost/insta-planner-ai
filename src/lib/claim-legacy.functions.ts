import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Atribui posts/perfis "órfãos" (sem dono) ao usuário autenticado.
 * Só executa se NENHUM registro ainda tem dono — assim, apenas o primeiro
 * usuário a entrar reivindica os dados existentes.
 */
export const claimLegacyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ count: postsOwned }, { count: perfilOwned }] = await Promise.all([
      supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).not("user_id", "is", null),
      supabaseAdmin.from("perfil_usuario").select("id", { count: "exact", head: true }).not("user_id", "is", null),
    ]);

    if ((postsOwned ?? 0) > 0 || (perfilOwned ?? 0) > 0) {
      return { claimed: false };
    }

    await Promise.all([
      supabaseAdmin.from("posts").update({ user_id: userId }).is("user_id", null),
      supabaseAdmin.from("perfil_usuario").update({ user_id: userId }).is("user_id", null),
    ]);
    return { claimed: true };
  });
