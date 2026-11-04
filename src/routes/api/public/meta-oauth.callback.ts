import { lifecycleFromOAuth } from "@/lib/instagram-connection";
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const META_OAUTH_ORIGIN = "https://insta-planner-ai.lovable.app";

function getRedirectUri(request: Request) {
  return `${META_OAUTH_ORIGIN}/api/public/meta-oauth/callback`;
}

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
.card{max-width:480px;background:#1e293b;padding:32px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{margin:0 0 12px;font-size:22px}p{color:#cbd5e1;line-height:1.5}a{color:#60a5fa}</style></head>
<body><div class="card">${body}<p style="margin-top:24px"><a href="/settings">← Voltar para Configurações</a></p>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'meta-oauth-done'},'https://insta-planner-ai.lovable.app');window.close()}catch(e){}}, 1500)</script>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/meta-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorMsg = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (errorMsg) return htmlPage("Erro", `<h1>❌ Autorização cancelada</h1><p>${escapeHtml(errorMsg)}</p>`);
        if (!code || !state) return htmlPage("Erro", `<h1>❌ Parâmetros inválidos</h1>`);

        const appId = process.env.META_APP_ID!;
        const appSecret = process.env.META_APP_SECRET!;
        if (!appId || !appSecret) return htmlPage("Erro", `<h1>❌ Meta App não configurado</h1>`);

        // Validate state
        const parts = state.split(".");
        if (parts.length !== 3 && parts.length !== 4) return htmlPage("Erro", `<h1>❌ State inválido</h1>`);
        const [perfilId, nonce] = parts;
        const targetEncoded = parts.length === 4 ? parts[2] : "_";
        const sig = parts.length === 4 ? parts[3] : parts[2];
        const signedPayload = parts.length === 4 ? `${perfilId}.${nonce}.${targetEncoded}` : `${perfilId}.${nonce}`;
        const expectedSig = createHmac("sha256", appSecret).update(signedPayload).digest("hex").slice(0, 32);
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return htmlPage("Erro", `<h1>❌ State adulterado</h1>`);
        }
        const targetAccount = targetEncoded === "_" ? null : normalizeInstagramAccount(base64UrlDecode(targetEncoded));

        const redirectUri = getRedirectUri(request);

        try {
          // 1. Exchange code for short user token
          const tokRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
          );
          const tokJson = await tokRes.json();
          if (!tokRes.ok || !tokJson.access_token) {
            return htmlPage("Erro", `<h1>❌ Falha ao trocar código</h1><p>${"Não foi possível concluir a autorização. Tente reconectar."}</p>`);
          }
          const shortUserToken = tokJson.access_token;

          // 2. Exchange for long-lived user token (~60d)
          const longRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortUserToken}`,
          );
          const longJson = await longRes.json();
          if (!longRes.ok || !longJson.access_token) {
            return htmlPage("Erro", `<h1>❌ Falha no token longo</h1><p>${"Não foi possível concluir a autorização. Tente reconectar."}</p>`);
          }
          const longUserToken = longJson.access_token;

          // 3. List pages
          const pagesRes = await fetch(
            `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longUserToken}`,
          );
          const pagesJson = await pagesRes.json();
          if (!pagesRes.ok || !Array.isArray(pagesJson.data) || pagesJson.data.length === 0) {
            return htmlPage(
              "Erro",
              `<h1>❌ Nenhuma Página do Facebook encontrada</h1><p>Verifique se sua conta IG está vinculada a uma Página do Facebook que você administra.</p>`,
            );
          }

          type MetaPage = { name?: string; access_token: string; instagram_business_account?: { id: string; username?: string } };
          const pagesWithIg = (pagesJson.data as MetaPage[]).filter((p) => p.instagram_business_account?.id);
          const pageWithIg = targetAccount
            ? pagesWithIg.find((p) => normalizeInstagramAccount(p.instagram_business_account?.username) === targetAccount)
            : pagesWithIg[0];
          if (!pageWithIg) {
            if (targetAccount) {
              const found = pagesWithIg
                .map((p) => p.instagram_business_account?.username)
                .filter(Boolean)
                .map((u) => `@${u}`)
                .join(", ");
              return htmlPage(
                "Erro",
                `<h1>❌ Conta da Liga não encontrada</h1><p>O Facebook conectado não administra @${escapeHtml(targetAccount)}. Contas encontradas: ${escapeHtml(found || "nenhuma")}. Entre com o Facebook correto da Liga.</p>`,
              );
            }
            return htmlPage(
              "Erro",
              `<h1>❌ Nenhuma conta IG Business vinculada</h1><p>Sua Página do Facebook não tem uma conta Instagram Business vinculada. Faça isso no app do Instagram em Configurações → Central de Contas.</p>`,
            );
          }
          if (!pageWithIg.instagram_business_account?.id) {
            return htmlPage("Erro", `<h1>❌ Conta Instagram Business inválida</h1>`);
          }

          const pageAccessToken: string = pageWithIg.access_token; // long-lived page token
          const igBusinessId: string = pageWithIg.instagram_business_account.id;
          const igUsername = normalizeInstagramAccount(pageWithIg.instagram_business_account.username) || targetAccount;

          // 4. Save to perfil_usuario
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.rpc("save_instagram_connection", {
            p_perfil: perfilId, p_account: igUsername || "", p_ig_id: igBusinessId, p_token: pageAccessToken,
            p_metadata: lifecycleFromOAuth("facebook", undefined),
          });

          if (error) return htmlPage("Erro", `<h1>❌ Erro ao salvar</h1><p>${escapeHtml(error.message)}</p>`);

          return htmlPage(
            "Conectado!",
            `<h1>✅ Instagram conectado</h1><p><strong>Conta:</strong> ${escapeHtml(igUsername ? `@${igUsername}` : "Instagram Business")}</p><p><strong>Página:</strong> ${escapeHtml(pageWithIg.name || "Página vinculada")}</p><p><strong>IG ID:</strong> ${escapeHtml(igBusinessId)}</p><p>Tokens salvos com segurança. Esta janela fecha em instantes…</p>`,
          );
        } catch (e) {
          return htmlPage("Erro", `<h1>❌ Erro inesperado</h1><p>${"Não foi possível concluir a autorização. A conexão anterior foi preservada."}</p>`);
        }
      },
    },
  },
});
