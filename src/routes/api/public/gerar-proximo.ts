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

      POST: async ({ request }) => {
        const { requireCronSecret } = await import("@/lib/cron-auth.server");
        const denied = requireCronSecret(request);
        if (denied) return denied;
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
            .select("data_agendamento,postar_instagram,postar_linkedin,postar_google,estilo_layout,formato_midia")
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
            if ((p as any).postar_google) ocupados.add(`${min}|google|${tipo}`);
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
          // Seg-sáb feed IG = Carrossel; Story = Story; LinkedIn/Google feed = Post Único; Domingo IG feed = Post Único (mensagem).
          const isDomingo = proximo.diaSemana === 0;
          const formato: "Carrossel" | "Story" | "Post Único" =
            proximo.tipo === "stories"
              ? "Story"
              : proximo.rede === "instagram" && !isDomingo
                ? "Carrossel"
                : "Post Único";

          // Para slots de domingo, força tema de mensagem leve/inspiracional.
          const temaDomingo = isDomingo && proximo.rede !== "google"
            ? "Mensagem de domingo: descanso, gratidão e cuidado com a saúde bucomaxilofacial"
            : "";

          // Define nível editorial:
          // - Google → SEO local (google-business)
          // - LinkedIn → científico
          // - IG stories → conversão (dor/teaser do feed)
          // - IG feed → alterna entre conversão (manhã 9h) e autoridade (15h/19h)
          const nivel: "ig-conversao" | "ig-autoridade" | "linkedin-cientifico" | "google-business" =
            proximo.rede === "google"
              ? "google-business"
              : proximo.rede === "linkedin"
                ? "linkedin-cientifico"
                : proximo.tipo === "stories"
                  ? "ig-conversao"
                  : proximo.hora <= 9
                    ? "ig-conversao"
                    : "ig-autoridade";

          // TEMA DO DIA: reaproveita o tema do 1º post já gerado no mesmo dia,
          // para que todas as postagens do dia tratem do MESMO assunto com
          // abordagens diferentes (sem repetir texto nem imagem — isso é
          // garantido pelos prompts de geração).
          const inicioDia = new Date(proximo.quando); inicioDia.setHours(0, 0, 0, 0);
          const fimDia = new Date(proximo.quando); fimDia.setHours(23, 59, 59, 999);
          const { data: doDia } = await supabaseAdmin
            .from("posts")
            .select("prompt_ia,data_agendamento")
            .gte("data_agendamento", inicioDia.toISOString())
            .lte("data_agendamento", fimDia.toISOString())
            .not("prompt_ia", "is", null)
            .order("data_agendamento", { ascending: true })
            .limit(1);
          let temaDoDia = doDia?.[0]?.prompt_ia?.trim();

          // NÃO REPETIR ASSUNTO em dias próximos: coleta temas usados nos
          // 3 dias anteriores e nos 3 dias seguintes (janela ±3 dias).
          const janelaAntes = new Date(inicioDia); janelaAntes.setDate(janelaAntes.getDate() - 3);
          const janelaDepois = new Date(fimDia); janelaDepois.setDate(janelaDepois.getDate() + 3);
          const { data: vizinhos } = await supabaseAdmin
            .from("posts")
            .select("prompt_ia,data_agendamento")
            .gte("data_agendamento", janelaAntes.toISOString())
            .lte("data_agendamento", janelaDepois.toISOString())
            .lt("data_agendamento", inicioDia.toISOString()) // só dias diferentes (antes)
            .not("prompt_ia", "is", null);
          const { data: vizinhosDepois } = await supabaseAdmin
            .from("posts")
            .select("prompt_ia,data_agendamento")
            .gt("data_agendamento", fimDia.toISOString())
            .lte("data_agendamento", janelaDepois.toISOString())
            .not("prompt_ia", "is", null);
          const temasProibidos = Array.from(
            new Set(
              [...(vizinhos ?? []), ...(vizinhosDepois ?? [])]
                .map((p: any) => (p.prompt_ia || "").trim())
                .filter(Boolean),
            ),
          );

          // Se o "tema do dia" reaproveitado bater com um tema de dia vizinho,
          // descarta para forçar geração de um novo tema.
          if (temaDoDia && temasProibidos.some((t) => t.toLowerCase() === temaDoDia!.toLowerCase())) {
            temaDoDia = undefined;
          }

          const result = await generateSinglePost({
            data: {
              tema: temaDomingo || temaDoDia || "",
              especialidade: "Ambas",
              rede: proximo.rede,
              tipo: proximo.tipo,
              formato,
              quando: proximo.quando.toISOString(),
              modelo: "local/sem-custo",
              modeloImagem: "local/sem-custo",
              ambasRedes: false,
              // Aguarda aprovação manual no preview — nunca publica direto.
              status: "PendenteAprovacao",
              nivel,
              temasProibidos,
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
