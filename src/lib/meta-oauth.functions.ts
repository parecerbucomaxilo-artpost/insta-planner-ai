import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const META_OAUTH_ORIGIN = "https://insta-planner-ai.lovable.app";
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Gera URL autenticada do OAuth Meta. Verifica que o perfil pertence ao usuário
 * logado e devolve um token assinado (perfilId.exp.sig) consumido por
 * /api/public/meta-oauth/start, evitando hijack de credenciais Instagram.
 */
export const createMetaOAuthStartUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { perfilId: string }) =>
    z.object({ perfilId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) throw new Error("META_APP_SECRET não configurado");

    // Confirma que o perfil pertence ao usuário autenticado.
    const { data: perfil, error } = await context.supabase
      .from("perfil_usuario")
      .select("id,user_id")
      .eq("id", data.perfilId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!perfil || perfil.user_id !== context.userId) {
      throw new Error("Perfil não pertence ao usuário autenticado");
    }

    const exp = Date.now() + TOKEN_TTL_MS;
    const payload = `${data.perfilId}.${exp}`;
    const sig = createHmac("sha256", appSecret).update(payload).digest("hex").slice(0, 32);
    const token = `${payload}.${sig}`;
    return {
      url: `${META_OAUTH_ORIGIN}/api/public/meta-oauth/start?token=${encodeURIComponent(token)}`,
    };
  });
