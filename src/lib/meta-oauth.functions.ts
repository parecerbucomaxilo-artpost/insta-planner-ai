import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const META_OAUTH_ORIGIN = "https://insta-planner-ai.lovable.app";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

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
 * Devolve a URL direta do diálogo OAuth do Facebook, com `state` assinado
 * para o callback verificar. Eliminamos o hop intermediário `/start`
 * (que gerava "token inválido/expirado" quando o segredo divergia entre
 * preview e produção, ou quando o popup demorava).
 */
export const createMetaOAuthStartUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { perfilId: string; targetAccount?: string; forceReauth?: boolean; logoutFacebookFirst?: boolean }) =>
    z.object({
      perfilId: z.string().uuid(),
      targetAccount: z.string().optional(),
      forceReauth: z.boolean().optional(),
      logoutFacebookFirst: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId) throw new Error("META_APP_ID não configurado");
    if (!appSecret) throw new Error("META_APP_SECRET não configurado");

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
    const nonce = crypto.randomUUID();
    const payload = `${data.perfilId}.${nonce}.${targetEncoded}`;
    const sig = createHmac("sha256", appSecret).update(payload).digest("hex").slice(0, 32);
    const state = `${payload}.${sig}`;

    const redirectUri = `${META_OAUTH_ORIGIN}/api/public/meta-oauth/callback`;
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    // Só força senha/reautenticação quando solicitado. No Planner Chico,
    // isso fazia o Facebook pedir a senha da conta Francisco desnecessariamente.
    if (data.forceReauth) {
      authUrl.searchParams.set("auth_type", "reauthenticate");
      authUrl.searchParams.set("auth_nonce", crypto.randomUUID());
    }
    authUrl.searchParams.set("display", "popup");

    if (data.logoutFacebookFirst) {
      // O Facebook não tem um equivalente confiável ao "selecionar conta" do Google.
      // Para conectar a Liga sem reaproveitar a sessão Francisco, encerramos a sessão
      // Facebook atual e só então abrimos o OAuth.
      const logoutUrl = new URL("https://www.facebook.com/logout.php");
      logoutUrl.searchParams.set("next", authUrl.toString());
      return { url: logoutUrl.toString() };
    }

    return { url: authUrl.toString() };
  });

