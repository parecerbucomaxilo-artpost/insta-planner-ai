import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const META_OAUTH_ORIGIN = "https://insta-planner-ai.lovable.app";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos (evita expiração em popups/reauth lentos)

function normalizeInstagramAccount(value: string | null | undefined) {
  const normalized = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  if (!normalized) return null;
  if (!/^[a-z0-9._]{2,80}$/.test(normalized)) throw new Error("Informe um @ de Instagram válido.");
  return normalized;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

/**
 * Gera URL autenticada do OAuth Meta. Verifica que o perfil pertence ao usuário
 * logado e devolve um token assinado (perfilId.exp.sig) consumido por
 * /api/public/meta-oauth/start, evitando hijack de credenciais Instagram.
 */
export const createMetaOAuthStartUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { perfilId: string; targetAccount?: string }) =>
    z.object({ perfilId: z.string().uuid(), targetAccount: z.string().optional() }).parse(d),
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

    const targetAccount = normalizeInstagramAccount(data.targetAccount);
    const targetEncoded = targetAccount ? base64UrlEncode(targetAccount) : "_";
    const exp = Date.now() + TOKEN_TTL_MS;
    const payload = `${data.perfilId}.${exp}.${targetEncoded}`;
    const sig = createHmac("sha256", appSecret).update(payload).digest("hex").slice(0, 32);
    const token = `${payload}.${sig}`;
    return {
      url: `${META_OAUTH_ORIGIN}/api/public/meta-oauth/start?token=${encodeURIComponent(token)}`,
    };
  });
