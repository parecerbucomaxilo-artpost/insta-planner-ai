import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

const META_OAUTH_ORIGIN = "https://insta-planner-ai.lovable.app";

function getRedirectUri(_request: Request) {
  return `${META_OAUTH_ORIGIN}/api/public/meta-oauth/callback`;
}

/**
 * Verifica o token assinado emitido por `createMetaOAuthStartUrl`
 * (server fn autenticada). Sem token válido, retorna null.
 */
function verifyAuthToken(token: string, appSecret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [perfilId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = createHmac("sha256", appSecret).update(`${perfilId}.${expStr}`).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return perfilId;
}

export const Route = createFileRoute("/api/public/meta-oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("token required", { status: 400 });

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        if (!appId || !appSecret) return new Response("Meta App not configured", { status: 500 });

        const perfilId = verifyAuthToken(token, appSecret);
        if (!perfilId) return new Response("Token inválido ou expirado", { status: 401 });

        // State assinado (já existente) que viaja no fluxo OAuth para o callback.
        const nonce = crypto.randomUUID();
        const payload = `${perfilId}.${nonce}`;
        const sig = createHmac("sha256", appSecret).update(payload).digest("hex").slice(0, 32);
        const state = `${payload}.${sig}`;

        const redirectUri = getRedirectUri(request);
        const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
        authUrl.searchParams.set("client_id", appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("response_type", "code");

        return Response.redirect(authUrl.toString(), 302);
      },
    },
  },
});
