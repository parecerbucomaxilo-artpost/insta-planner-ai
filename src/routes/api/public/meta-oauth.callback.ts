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

function htmlPage(title: string, body: string) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.card{max-width:480px;background:#1e293b;padding:32px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{margin:0 0 12px;font-size:22px}p{color:#cbd5e1;line-height:1.5}a{color:#60a5fa}</style></head>
<body><div class="card">${body}<p style="margin-top:24px"><a href="/settings">← Voltar para Configurações</a></p>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'meta-oauth-done'},'*');window.close()}catch(e){}}, 1500)</script>
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
        if (parts.length !== 3) return htmlPage("Erro", `<h1>❌ State inválido</h1>`);
        const [perfilId, nonce, sig] = parts;
        const expectedSig = createHmac("sha256", appSecret).update(`${perfilId}.${nonce}`).digest("hex").slice(0, 32);
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return htmlPage("Erro", `<h1>❌ State adulterado</h1>`);
        }

        const redirectUri = getRedirectUri(request);

        try {
          // 1. Exchange code for short user token
          const tokRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
          );
          const tokJson = await tokRes.json();
          if (!tokRes.ok || !tokJson.access_token) {
            return htmlPage("Erro", `<h1>❌ Falha ao trocar código</h1><p>${escapeHtml(JSON.stringify(tokJson))}</p>`);
          }
          const shortUserToken = tokJson.access_token;

          // 2. Exchange for long-lived user token (~60d)
          const longRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortUserToken}`,
          );
          const longJson = await longRes.json();
          if (!longRes.ok || !longJson.access_token) {
            return htmlPage("Erro", `<h1>❌ Falha no token longo</h1><p>${escapeHtml(JSON.stringify(longJson))}</p>`);
          }
          const longUserToken = longJson.access_token;

          // 3. List pages
          const pagesRes = await fetch(
            `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longUserToken}`,
          );
          const pagesJson = await pagesRes.json();
          if (!pagesRes.ok || !Array.isArray(pagesJson.data) || pagesJson.data.length === 0) {
            return htmlPage(
              "Erro",
              `<h1>❌ Nenhuma Página do Facebook encontrada</h1><p>Verifique se sua conta IG está vinculada a uma Página do Facebook que você administra.</p>`,
            );
          }

          // Find first page with IG business account
          const pageWithIg = pagesJson.data.find((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id);
          if (!pageWithIg) {
            return htmlPage(
              "Erro",
              `<h1>❌ Nenhuma conta IG Business vinculada</h1><p>Sua Página do Facebook não tem uma conta Instagram Business vinculada. Faça isso no app do Instagram em Configurações → Central de Contas.</p>`,
            );
          }

          const pageAccessToken: string = pageWithIg.access_token; // long-lived page token
          const igBusinessId: string = pageWithIg.instagram_business_account.id;

          // 4. Save to perfil_usuario
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("perfil_usuario")
            .update({
              instagram_access_token: pageAccessToken,
              instagram_business_account_id: igBusinessId,
            })
            .eq("id", perfilId);

          if (error) return htmlPage("Erro", `<h1>❌ Erro ao salvar</h1><p>${error.message}</p>`);

          return htmlPage(
            "Conectado!",
            `<h1>✅ Instagram conectado</h1><p><strong>Página:</strong> ${pageWithIg.name}</p><p><strong>IG ID:</strong> ${igBusinessId}</p><p>Tokens salvos com segurança. Esta janela fecha em instantes…</p>`,
          );
        } catch (e) {
          return htmlPage("Erro", `<h1>❌ Erro inesperado</h1><p>${e instanceof Error ? e.message : String(e)}</p>`);
        }
      },
    },
  },
});
