import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Cron endpoint chamado a cada 5 minutos.
 * Localiza posts Google Business com status=Agendado, data_agendamento <= now(),
 * e ainda não despachados (google_dispatched_at IS NULL).
 * Envia para o webhook do Make (MAKE_GBP_WEBHOOK_URL), que publica no GBP do usuário.
 * Ao receber 2xx do Make, marca status=Publicado + google_dispatched_at=now().
 */
export const Route = createFileRoute("/api/public/dispatch-gbp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const { requireCronSecret } = await import("@/lib/cron-auth.server");
        const denied = requireCronSecret(request);
        if (denied) return denied;
        const webhookUrl = process.env.MAKE_GBP_WEBHOOK_URL;
        if (!webhookUrl) {
          return json({ error: "MAKE_GBP_WEBHOOK_URL não configurado" }, 500);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: posts, error } = await supabaseAdmin
          .from("posts")
          .select("id,legenda,url_imagem,data_agendamento,estilo_layout")
          .eq("postar_google", true)
          .eq("status", "Agendado")
          .is("google_dispatched_at", null)
          .lte("data_agendamento", new Date().toISOString())
          .limit(10);

        if (error) return json({ error: error.message }, 500);
        if (!posts || posts.length === 0) return json({ ok: true, dispatched: 0 });

        const results: Array<{ id: string; ok: boolean; error?: string }> = [];

        for (const p of posts) {
          try {
            const linhas = (p.legenda || "").split("\n").filter(Boolean);
            const titulo = (linhas[0] || "").replace(/^#+\s*/, "").slice(0, 80);
            const texto = p.legenda || "";

            const res = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: p.id,
                titulo,
                texto,
                imagem_url: p.url_imagem,
                cta_url: "https://wa.me/5511947684004",
                cta_label: "Saiba mais",
                assinatura: "Prof. Francisco Menezes | CROSP 53318",
                agendado_para: p.data_agendamento,
              }),
            });

            if (!res.ok) {
              const body = await res.text();
              results.push({ id: p.id, ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` });
              continue;
            }

            await supabaseAdmin
              .from("posts")
              .update({
                status: "Publicado",
                google_dispatched_at: new Date().toISOString(),
              })
              .eq("id", p.id);

            results.push({ id: p.id, ok: true });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro desconhecido";
            results.push({ id: p.id, ok: false, error: msg });
          }
        }

        return json({ ok: true, dispatched: results.filter((r) => r.ok).length, results });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
