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
function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeInstagramAccount(value: string | null | undefined) {
  const normalized = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9._]{2,80}$/.test(normalized) ? normalized : null;
}

function verifyAuthToken(token: string, appSecret: string): { perfilId: string; targetAccount: string | null; targetEncoded: string; reason?: string } | { error: "expired" | "invalid" } {
  const parts = token.split(".");
  if (parts.length !== 3 && parts.length !== 4) return { error: "invalid" };
  const [perfilId, expStr] = parts;
  const targetEncoded = parts.length === 4 ? parts[2] : "_";
  const sig = parts.length === 4 ? parts[3] : parts[2];
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return { error: "invalid" };
  const payload = parts.length === 4 ? `${perfilId}.${expStr}.${targetEncoded}` : `${perfilId}.${expStr}`;
  const expected = createHmac("sha256", appSecret).update(payload).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: "invalid" };
  if (exp < Date.now()) return { error: "expired" };
  const targetAccount = targetEncoded === "_" ? null : normalizeInstagramAccount(base64UrlDecode(targetEncoded));
  return { perfilId, targetAccount, targetEncoded: targetAccount ? targetEncoded : "_" };
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

        const verified = verifyAuthToken(token, appSecret);
        if (!verified) return new Response("Token inválido ou expirado", { status: 401 });

        // State assinado (já existente) que viaja no fluxo OAuth para o callback.
        const nonce = crypto.randomUUID();
        const payload = `${verified.perfilId}.${nonce}.${verified.targetEncoded}`;
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
