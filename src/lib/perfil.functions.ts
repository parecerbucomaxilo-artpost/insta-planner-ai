import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ensurePerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("perfil_usuario")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.id) return { id: existing.data.id as string };

    const created = await supabase
      .from("perfil_usuario")
      .insert({ user_id: userId })
      .select("id")
      .maybeSingle();
    if (created.error) throw new Error(created.error.message);
    if (!created.data?.id) throw new Error("Falha ao criar perfil");
    return { id: created.data.id as string };
  });
