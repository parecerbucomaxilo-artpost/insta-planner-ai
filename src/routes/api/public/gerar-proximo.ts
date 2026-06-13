import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

// Quantos dias à frente o agendador deve preencher.
const DIAS_JANELA = 7;

/**
 * Encontra o próximo slot do cronograma fixo (Seg-Sáb + Domingo) que ainda
 * não tem post agendado e o gera via IA.
 *
 * Roda 1 slot por chamada (a geração leva 30-90s por causa das imagens).
 * O cron deve chamar de 5 em 5 minutos: vai preenchendo a semana toda
 * gradualmente e, quando estiver completa, responde {ok:true, generated:0}.
 */
export const Route = createFileRoute("/api/public/gerar-proximo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async () => {
        try {
          const { buildScheduleSlots } = await import("@/lib/schedule-config");
          const { generateSinglePost } = await import("@/lib/ai-post.functions");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Janela: a partir de agora (ignora slots no passado).
          const agora = new Date();
          // Começa hoje para pegar slots ainda futuros do próprio dia.
          const slots = buildScheduleSlots(agora, DIAS_JANELA).filter(
            (s) => s.quando.getTime() > agora.getTime() + 60_000,
          );

          if (slots.length === 0) {
            return json({ ok: true, generated: 0, message: "Nenhum slot futuro na janela." });
          }

          // Posts já existentes na janela (qualquer status exceto Erro/Rascunho).
          const inicio = slots[0].quando.toISOString();
          const fim = slots[slots.length - 1].quando.toISOString();
          const { data: existentes, error: qErr } = await supabaseAdmin
            .from("posts")
            .select("data_agendamento,postar_instagram,postar_linkedin,estilo_layout,formato_midia")
            .gte("data_agendamento", inicio)
            .lte("data_agendamento", fim)
            .in("status", ["Agendado", "PendenteAprovacao", "Publicado"]);

          if (qErr) return json({ error: qErr.message }, 500);

          // Indexa por chave "minutoEpoch|rede|tipo".
          const ocupados = new Set<string>();
          for (const p of existentes ?? []) {
            if (!p.data_agendamento) continue;
            const min = Math.floor(new Date(p.data_agendamento).getTime() / 60_000);
            const tipo = (p.formato_midia || "").toLowerCase().includes("stor") ? "stories" : "feed";
            if (p.postar_instagram) ocupados.add(`${min}|instagram|${tipo}`);
            if (p.postar_linkedin) ocupados.add(`${min}|linkedin|${tipo}`);
          }

          // Encontra primeiro slot vazio.
          const proximo = slots.find((s) => {
            const min = Math.floor(s.quando.getTime() / 60_000);
            return !ocupados.has(`${min}|${s.rede}|${s.tipo}`);
          });

          if (!proximo) {
            return json({ ok: true, generated: 0, message: "Semana completa: todos os slots já têm post." });
          }

          // Define formato com base no slot.
          // Seg-sáb feed IG = Carrossel; Story = Story; LinkedIn feed = Post Único; Domingo IG feed = Post Único (mensagem).
          const isDomingo = proximo.diaSemana === 0;
          const formato: "Carrossel" | "Story" | "Post Único" =
            proximo.tipo === "stories"
              ? "Story"
              : proximo.rede === "instagram" && !isDomingo
                ? "Carrossel"
                : "Post Único";

          // Para slots de domingo, força tema de mensagem leve/inspiracional.
          const temaDomingo = isDomingo
            ? "Mensagem de domingo: descanso, gratidão e cuidado com a saúde bucomaxilofacial"
            : "";

          const result = await generateSinglePost({
            data: {
              tema: temaDomingo,
              especialidade: "Ambas",
              rede: proximo.rede,
              tipo: proximo.tipo,
              formato,
              quando: proximo.quando.toISOString(),
              inserirLogo: true,
              modelo: "google/gemini-3-flash-preview",
              modeloImagem: "google/gemini-3.1-flash-image-preview",
              ambasRedes: false,
              status: "Agendado",
            },
          });

          return json({
            ok: true,
            generated: 1,
            slot: {
              rede: proximo.rede,
              tipo: proximo.tipo,
              formato,
              quando: proximo.quando.toISOString(),
              dia_semana: proximo.diaSemana,
            },
            post_id: (result as any)?.id,
            faltando: slots.length - 1,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          try {
            const { logErrorForAllUsers } = await import("@/lib/notify-error.server");
            await logErrorForAllUsers({
              tipo: "geracao",
              titulo: "Falha ao gerar próximo post",
              mensagem: message,
              contexto: { endpoint: "gerar-proximo" },
            });
          } catch {}
          return json({ error: message }, 500);
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
