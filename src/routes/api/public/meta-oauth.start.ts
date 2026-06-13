import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

function getRedirectUri(request: Request) {
  const url = new URL(request.url);
  return `${url.origin}/api/public/meta-oauth/callback`;
}

export const Route = createFileRoute("/api/public/meta-oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const perfilId = url.searchParams.get("perfil_id");
        if (!perfilId) return new Response("perfil_id required", { status: 400 });

        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        if (!appId || !appSecret) return new Response("Meta App not configured", { status: 500 });

        // Signed state to prevent tampering
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
