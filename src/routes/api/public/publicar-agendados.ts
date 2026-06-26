import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const BATCH = 3;

// Publica posts com status "Agendado" cuja data_agendamento já passou.
// Processa até BATCH posts por chamada para evitar timeouts.
export const Route = createFileRoute("/api/public/publicar-agendados")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const { requireCronSecret } = await import("@/lib/cron-auth.server");
        const denied = requireCronSecret(request);
        if (denied) return denied;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");
          const { publishLinkedInPostById } = await import("@/lib/social/linkedin-publish.server");

          const nowIso = new Date().toISOString();
          const { data: pending, error } = await supabaseAdmin
            .from("posts")
            .select("id, postar_instagram, postar_linkedin")
            .eq("status", "Agendado")
            .not("data_agendamento", "is", null)
            .lte("data_agendamento", nowIso)
            .order("data_agendamento", { ascending: true })
            .limit(BATCH);

          if (error) return json({ ok: false, error: error.message }, 500);
          if (!pending || pending.length === 0) return json({ ok: true, published: 0 });

          const results: Array<{ id: string; ok: boolean; status?: string; via?: string; error?: string }> = [];
          for (const p of pending as Array<{ id: string; postar_instagram: boolean; postar_linkedin: boolean }>) {
            try {
              let instagramStatus: string | undefined;
              if (p.postar_instagram) {
                const result = await publishInstagramPostById({ supabaseAdmin, postId: p.id, userId: TEMP_USER_ID });
                instagramStatus = result.status;
                results.push({ id: p.id, ok: true, status: result.status, via: result.via });
              }
              if (p.postar_linkedin) {
                await publishLinkedInPostById({ supabaseAdmin, postId: p.id });
                if (instagramStatus === "EnviadoMake") {
                  await supabaseAdmin.from("posts").update({ status: "EnviadoMake" }).eq("id", p.id);
                }
                if (!p.postar_instagram) results.push({ id: p.id, ok: true, status: "Publicado", via: "linkedin" });
              }
              if (!p.postar_instagram && !p.postar_linkedin) {
                // Sem rede selecionada — marca como erro para não ficar reprocessando.
                await supabaseAdmin.from("posts").update({ status: "Erro" }).eq("id", p.id);
                results.push({ id: p.id, ok: false, error: "Nenhuma rede selecionada" });
                continue;
              }
            } catch (e: any) {
              await supabaseAdmin.from("posts").update({ status: "Erro" }).eq("id", p.id);
              results.push({ id: p.id, ok: false, error: e?.message || "Falha ao publicar" });
            }
          }

          return json({
            ok: true,
            published: results.filter((r) => r.ok && r.status === "Publicado").length,
            sent_to_make: results.filter((r) => r.ok && r.status === "EnviadoMake").length,
            failed: results.filter((r) => !r.ok).length,
            results,
          });
        } catch (e: any) {
          return json({ ok: false, error: e?.message || "Erro interno" }, 500);
        }
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
