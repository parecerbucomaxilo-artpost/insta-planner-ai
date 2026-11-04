import { lifecycleFromOAuth, validOAuthNonce } from "@/lib/instagram-connection";
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const META_OAUTH_ORIGIN = "https://insta-planner-ai.lovable.app";

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeInstagramAccount(value: string | null | undefined) {
  const normalized = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9._]{2,80}$/.test(normalized) ? normalized : null;
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function htmlPage(title: string, body: string) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.card{max-width:520px;background:#1e293b;padding:32px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{margin:0 0 12px;font-size:22px}p{color:#cbd5e1;line-height:1.5}a{color:#60a5fa}</style></head>
<body><div class="card">${body}<p style="margin-top:24px"><a href="/settings">← Voltar para Configurações</a></p>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'instagram-oauth-done'},'https://insta-planner-ai.lovable.app');window.close()}catch(e){}}, 1500)</script>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/instagram-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorMsg = url.searchParams.get("error_description") || url.searchParams.get("error_reason") || url.searchParams.get("error");
        if (errorMsg) return htmlPage("Erro", `<h1>❌ Autorização cancelada</h1><p>${escapeHtml(errorMsg)}</p>`);
        if (!code || !state) return htmlPage("Erro", `<h1>❌ Parâmetros inválidos</h1>`);

        const appId = process.env.META_INSTAGRAM_APP_ID || process.env.META_APP_ID;
        const appSecret = process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
        if (!appId || !appSecret) return htmlPage("Erro", `<h1>❌ Instagram App não configurado</h1>`);

        const parts = state.split(".");
        if (parts.length !== 5 || parts[3] !== "ig") return htmlPage("Erro", `<h1>❌ State inválido</h1>`);
        const [perfilId, nonce, targetEncoded, marker, sig] = parts;
        if (!validOAuthNonce(nonce)) return htmlPage("Erro", "<h1>Autorização expirada</h1><p>Inicie novamente a conexão. A conta salva foi preservada.</p>");
        const signedPayload = `${perfilId}.${nonce}.${targetEncoded}.${marker}`;
        const expectedSig = createHmac("sha256", appSecret).update(signedPayload).digest("hex").slice(0, 32);
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return htmlPage("Erro", `<h1>❌ State adulterado</h1>`);
        }
        const targetAccount = targetEncoded === "_" ? null : normalizeInstagramAccount(base64UrlDecode(targetEncoded));
        const redirectUri = `${META_OAUTH_ORIGIN}/api/public/instagram-oauth/callback`;

        try {
          const tokenBody = new URLSearchParams();
          tokenBody.set("client_id", appId);
          tokenBody.set("client_secret", appSecret);
          tokenBody.set("grant_type", "authorization_code");
          tokenBody.set("redirect_uri", redirectUri);
          tokenBody.set("code", code);

          const shortRes = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: tokenBody });
          const shortJson = await shortRes.json().catch(() => ({}));
          const shortData = Array.isArray(shortJson?.data) ? shortJson.data[0] : shortJson;
          const shortToken = shortData?.access_token;
          if (!shortRes.ok || !shortToken) {
            return htmlPage("Erro", `<h1>❌ Falha ao trocar código Instagram</h1><p>${"Não foi possível concluir a autorização. Tente reconectar."}</p>`);
          }

          const longUrl = new URL("https://graph.instagram.com/access_token");
          longUrl.searchParams.set("grant_type", "ig_exchange_token");
          longUrl.searchParams.set("client_secret", appSecret);
          longUrl.searchParams.set("access_token", shortToken);
          const longRes = await fetch(longUrl);
          const longJson = await longRes.json().catch(() => ({}));
          const longToken = longJson?.access_token;
          if (!longRes.ok || !longToken) {
            return htmlPage("Erro", `<h1>❌ Falha no token longo Instagram</h1><p>${"Não foi possível concluir a autorização. Tente reconectar."}</p>`);
          }

          const meUrl = new URL("https://graph.instagram.com/me");
          meUrl.searchParams.set("fields", "user_id,username");
          meUrl.searchParams.set("access_token", longToken);
          const meRes = await fetch(meUrl);
          const meJson = await meRes.json().catch(() => ({}));
          const meData = Array.isArray(meJson?.data) ? meJson.data[0] : meJson;
          const igBusinessId = String(meData?.user_id || meData?.id || "");
          const igUsername = normalizeInstagramAccount(meData?.username);
          if (!meRes.ok || !igBusinessId || !igUsername) {
            return htmlPage("Erro", `<h1>❌ Não foi possível identificar o Instagram</h1><p>${"Não foi possível concluir a autorização. Tente reconectar."}</p>`);
          }
          if (targetAccount && igUsername !== targetAccount) {
            return htmlPage(
              "Erro",
              `<h1>❌ Instagram incorreto</h1><p>Você autorizou @${escapeHtml(igUsername)}, mas este destino é @${escapeHtml(targetAccount)}. Entre no Instagram da Liga e tente novamente.</p>`,
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.rpc("save_instagram_connection", {
            p_perfil: perfilId, p_account: igUsername || "", p_ig_id: igBusinessId, p_token: longToken,
            p_metadata: lifecycleFromOAuth("instagram", Number(longJson.expires_in)),
          });

          if (error) return htmlPage("Erro", `<h1>❌ Erro ao salvar</h1><p>${escapeHtml(error.message)}</p>`);

          return htmlPage(
            "Conectado!",
            `<h1>✅ Instagram conectado diretamente</h1><p><strong>Conta:</strong> @${escapeHtml(igUsername)}</p><p><strong>IG ID:</strong> ${escapeHtml(igBusinessId)}</p><p>Agora a Liga pode publicar sem reutilizar a sessão Facebook do Francisco.</p>`,
          );
        } catch (e) {
          return htmlPage("Erro", `<h1>❌ Erro inesperado</h1><p>${"Não foi possível concluir a autorização. A conexão anterior foi preservada."}</p>`);
        }
      },
    },
  },
});