import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SingleInput = z.object({
  // Se vazio, a IA escolhe um tema relevante automaticamente.
  tema: z.string().optional().default(""),
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("CTBMF"),
  rede: z.enum(["instagram", "linkedin", "estilo-x"]).default("instagram"),
  tipo: z.enum(["feed", "stories"]).optional(),
  formato: z.enum(["Carrossel", "Story", "Post Único"]).optional(),
  quando: z.string().datetime().optional(),
});

const WeekInput = z.object({
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("Ambas"),
});

const WHATSAPP = "https://wa.me/5511947684004";
const ASSINATURA = "Prof. Francisco Menezes — CROSP 53318";

function tonePrompt(rede: "instagram" | "linkedin" | "estilo-x") {
  if (rede === "linkedin") {
    return "TOM: formal, científico, dirigido a colegas dentistas/médicos. Pode usar terminologia técnica e dados epidemiológicos. Cite evidência quando possível.";
  }
  return "TOM: linguagem ACESSÍVEL ao público leigo, empática, que faz o paciente se identificar com a DOR/QUEIXA (ex.: 'Você sente...', 'Já acordou com...'). Sem jargão; quando inevitável, traduzir entre parênteses.";
}

function captionSystem(rede: "instagram" | "linkedin" | "estilo-x", especialidade: string) {
  return `Você é o copywriter do ${ASSINATURA}, cirurgião bucomaxilofacial e odontologista hospitalar.
Tema da especialidade neste post: ${especialidade}.
${tonePrompt(rede)}
REGRAS DE CTA:
- NUNCA use "agende sua consulta", "agende sua avaliação" ou similares.
- Use SEMPRE como CTA: "Link na Bio" (IG/X) ou o link do WhatsApp: ${WHATSAPP} (LinkedIn).
FORMATO: legenda pronta para postar, com gancho forte na 1ª linha, 3-6 emojis estratégicos, 5-8 hashtags ao final relevantes ao tema.
NÃO inclua a assinatura "${ASSINATURA}" no texto (ela vai como overlay na imagem).`;
}

function imageSystemPrompt(tema: string, rede: string, slide?: { n: number; total: number; papel: string }) {
  const slideInfo = slide
    ? `\n- ESTE É O SLIDE ${slide.n}/${slide.total} de um CARROSSEL. Papel deste slide: ${slide.papel}.`
    : "";
  const assinaturaInfo = slide
    ? slide.n === 1 || slide.n === slide.total
      ? `\n- Rodapé OBRIGATÓRIO: "${ASSINATURA}".`
      : `\n- NÃO inclua a assinatura neste slide (vai apenas no 1º e último).`
    : `\n- Rodapé discreto: "${ASSINATURA}".`;
  return `Cartaz médico premium em estilo Dr. Francisco Menezes:
- Paleta: azul profundo (#0c2340), branco, azul elétrico (#2dd4ff). Vermelho APENAS para indicar dor.
- Tipografia bold, alto contraste, layout limpo e autoridade médica premium.
- Texto curto em PT-BR (com acentos corretos) sobre: "${tema}".${assinaturaInfo}
- Rede de destino: ${rede}. ${rede === "estilo-x" ? "Estilo TWEET visual, 16:9." : "Formato quadrado 1:1."}${slideInfo}
- Sem texto inglês. Sem watermark de IA.`;
}

export const generateSinglePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SingleInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider, generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    // Resolve formato final
    const formato: "Carrossel" | "Story" | "Post Único" =
      data.formato ??
      (data.rede === "estilo-x"
        ? "Carrossel"
        : data.tipo === "stories"
          ? "Story"
          : data.tipo === "feed" && data.rede === "instagram"
            ? "Carrossel"
            : "Post Único");

    // 0. Se nenhum tema foi fornecido, a IA escolhe um automaticamente.
    let tema = (data.tema ?? "").trim();
    if (!tema) {
      const { text: temaEscolhido } = await generateText({
        model,
        system: `Você é estrategista de conteúdo de ${ASSINATURA}, cirurgião bucomaxilofacial e odontologista hospitalar (CTBMF + Odontologia Hospitalar).`,
        prompt: `Escolha 1 TEMA de post para a rede ${data.rede} (formato ${formato}) dentro da especialidade "${data.especialidade}".
Tema deve ser sobre uma DOR REAL do paciente (siso, ATM, trauma facial, infecção odontogênica, apneia obstrutiva, cirurgia ortognática, atendimento hospitalar, etc.) e ter potencial de conversão.
Responda APENAS com o tema em 1 frase curta (máx. 12 palavras), sem aspas, sem prefixos, sem explicação.`,
      });
      tema = temaEscolhido.trim().replace(/^["'`]+|["'`]+$/g, "").split("\n")[0];
      if (!tema) throw new Error("IA não conseguiu escolher um tema.");
    }

    // 1. Legenda (stories = texto curtíssimo)
    const isStory = formato === "Story";
    const { text: legenda } = await generateText({
      model,
      system: captionSystem(data.rede, data.especialidade),
      prompt: isStory
        ? `Crie um TEXTO DE STORY (até 220 caracteres, 1-2 emojis, sem hashtags, CTA "Link na Bio") que CHAME ATENÇÃO para o post do FEED de hoje sobre: "${tema}". O story deve provocar curiosidade e mandar o usuário para o feed.`
        : `Crie a legenda completa para o post sobre: "${tema}".`,
    });

    // 2. Imagens — Carrossel = 3 slides em paralelo, demais = 1 imagem
    const size: "1024x1024" | "1536x1024" =
      data.rede === "estilo-x" ? "1536x1024" : "1024x1024";

    const uploadOne = async (b64: string) => {
      const buf = Buffer.from(b64, "base64");
      const fileName = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error } = await supabaseAdmin.storage
        .from("post-images")
        .upload(fileName, buf, { contentType: "image/png", upsert: false });
      if (error) throw new Error(`Upload: ${error.message}`);
      return supabaseAdmin.storage.from("post-images").getPublicUrl(fileName).data.publicUrl;
    };

    let urlImagem: string;
    let imagensCarrossel: string[] = [];

    if (formato === "Carrossel") {
      const slidesSpec = [
        { n: 1, total: 3, papel: "GANCHO forte de conversão (pergunta/dor) + assinatura" },
        { n: 2, total: 3, papel: "DESENVOLVIMENTO: explicação clara da causa/solução, citação científica curta no rodapé (sem assinatura)" },
        { n: 3, total: 3, papel: "CTA final: WhatsApp/Link na Bio + assinatura" },
      ];
      const b64s = await Promise.all(
        slidesSpec.map((s) =>
          generateImageBase64({
            apiKey: key,
            prompt: imageSystemPrompt(tema, data.rede, s),
            size,
          }),
        ),
      );
      const urls = await Promise.all(b64s.map(uploadOne));
      urlImagem = urls[0];
      imagensCarrossel = urls;
    } else {
      const b64 = await generateImageBase64({
        apiKey: key,
        prompt: imageSystemPrompt(tema, data.rede),
        size,
      });
      urlImagem = await uploadOne(b64);
    }

    const tipoPost = formato === "Carrossel" ? "Carrossel" : "Post Único";

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: context.userId,
        tipo_post: tipoPost,
        estilo_layout: data.rede === "estilo-x" ? "Estilo X" : "Padrão",
        formato_midia: isStory ? "Story" : "Imagem",
        legenda,
        url_imagem: urlImagem,
        imagens_carrossel: imagensCarrossel,
        postar_instagram: data.rede !== "linkedin",
        postar_linkedin: data.rede === "linkedin",
        status: data.quando ? "Agendado" : "Rascunho",
        data_agendamento: data.quando ?? null,
        prompt_ia: tema,
      } as any)
      .select()
      .single();
    if (insErr) throw new Error(`DB: ${insErr.message}`);

    return { id: (inserted as any).id, url: urlImagem, legenda, slides: imagensCarrossel.length || 1 };
  });

export const generateWeekThemes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WeekInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const { buildScheduleSlots } = await import("@/lib/schedule-config");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    // Slots reais dos próximos 7 dias
    const slots = buildScheduleSlots(new Date(), 7);
    const slotsResumo = slots.map((s, i) => {
      const dow = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"][s.diaSemana];
      const hhmm = `${String(s.hora).padStart(2,"0")}:${String(s.minuto).padStart(2,"0")}`;
      const dominical = s.diaSemana === 0 ? " [MENSAGEM DE DOMINGO — tom leve/inspiracional]" : "";
      return `${i + 1}. ${dow} ${hhmm} · ${s.rede} ${s.tipo}${dominical}`;
    }).join("\n");

    const schema = z.object({
      temas: z.array(z.object({
        slotIndex: z.number(),
        tema: z.string(),
        gancho: z.string(),
      })).length(slots.length),
    });

    const { experimental_output: out } = await generateText({
      model,
      experimental_output: Output.object({ schema }),
      system: `Você é estrategista de conteúdo de ${ASSINATURA}, cirurgião bucomaxilofacial e odontologista hospitalar.
Crie 1 tema por slot do cronograma abaixo (${slots.length} slots), sobre: ${data.especialidade}.
Mistura obrigatória: IG feed (CARROSSEL, linguagem leiga/empática + ganchos de dor), IG stories (teaser/chamada do FEED do MESMO DIA — pode ser repetição/pergunta sobre o tema do feed), LinkedIn (formal/científico, dados/evidência).
IMPORTANTE: o tema dos STORIES deve coincidir com o tema do POST FEED do mesmo dia (story de manhã ↔ feed de 9h, story de tarde ↔ feed de 15h, story de noite ↔ feed de 19h). Não invente temas novos para stories — eles divulgam o feed.
Domingos = tom leve, motivacional, agradecimento, reflexão sobre cuidado e bem-estar — SEM gancho agressivo de dor.
Cada tema deve atacar uma DOR REAL (siso, ATM, trauma facial, infecção odontogênica, apneia, etc.) salvo nos domingos.
NUNCA CTA "agende consulta" — sempre WhatsApp/Link na Bio.

Slots:
${slotsResumo}`,
      prompt: "Gere os temas agora, um por slot, na ordem.",
    });

    // Anexa metadados + força stories a herdarem o tema do feed do mesmo dia
    const enriquecidos = out.temas
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((t) => {
        const s = slots[t.slotIndex - 1] ?? slots[0];
        return {
          dia: t.slotIndex,
          rede: s.rede,
          tipo: s.tipo,
          quando: s.quando.toISOString(),
          dataKey: s.quando.toISOString().slice(0, 10),
          hora: s.hora,
          formato: (s.rede === "instagram" && s.tipo === "feed"
            ? "Carrossel"
            : s.tipo === "stories"
              ? "Story"
              : "Post Único") as "Carrossel" | "Story" | "Post Único",
          tema: t.tema,
          gancho: t.gancho,
        };
      });

    // Para cada story, copia o tema/gancho do feed IG mais próximo (mesmo dia)
    const feedsIgPorDia = new Map<string, typeof enriquecidos>();
    for (const e of enriquecidos) {
      if (e.rede === "instagram" && e.tipo === "feed") {
        const arr = feedsIgPorDia.get(e.dataKey) ?? [];
        arr.push(e);
        feedsIgPorDia.set(e.dataKey, arr);
      }
    }
    for (const e of enriquecidos) {
      if (e.rede === "instagram" && e.tipo === "stories") {
        const feeds = feedsIgPorDia.get(e.dataKey) ?? [];
        if (feeds.length === 0) continue;
        const mais = feeds.reduce((best, f) =>
          Math.abs(f.hora - e.hora) < Math.abs(best.hora - e.hora) ? f : best,
        );
        e.tema = mais.tema;
        e.gancho = `Teaser do feed ${String(mais.hora).padStart(2, "0")}h: ${mais.gancho}`;
      }
    }

    const temas = enriquecidos.map(({ dataKey, hora, ...rest }) => rest);
    return { temas };
  });
