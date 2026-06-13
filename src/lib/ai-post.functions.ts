import { createServerFn } from "@tanstack/react-start";
// Auth desativada no projeto — usamos um user_id temporário fixo.
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
import { z } from "zod";

export const MODELOS_IA = [
  { id: "google/gemini-3-flash-preview", label: "Gemini Flash (rápido, padrão)" },
  { id: "google/gemini-2.5-pro", label: "Gemini Pro (mais profundo)" },
  { id: "openai/gpt-5", label: "GPT-5 (premium)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini (rápido OpenAI)" },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Anthropic)" },
] as const;
const ModeloEnum = z.enum([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4-5",
]);

const SingleInput = z.object({
  // Se vazio, a IA escolhe um tema relevante automaticamente.
  tema: z.string().optional().default(""),
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("CTBMF"),
  rede: z.enum(["instagram", "linkedin", "estilo-x"]).default("instagram"),
  tipo: z.enum(["feed", "stories"]).optional(),
  formato: z.enum(["Carrossel", "Story", "Post Único"]).optional(),
  quando: z.string().datetime().optional(),
  inserirLogo: z.boolean().optional().default(true),
  modelo: ModeloEnum.optional().default("google/gemini-3-flash-preview"),
});


const WeekInput = z.object({
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("Ambas"),
  modelo: ModeloEnum.optional().default("google/gemini-3-flash-preview"),
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

function imageSystemPrompt(tema: string, rede: string, slide?: { n: number; total: number; papel: string }, inserirLogo: boolean = true) {
  const slideInfo = slide
    ? `\n- ESTE É O SLIDE ${slide.n}/${slide.total} de um CARROSSEL. Papel deste slide: ${slide.papel}.`
    : "";
  const assinaturaInfo = slide
    ? slide.n === 1 || slide.n === slide.total
      ? `\n- Rodapé OBRIGATÓRIO: "${ASSINATURA}".`
      : `\n- NÃO inclua a assinatura neste slide (vai apenas no 1º e último).`
    : `\n- Rodapé discreto: "${ASSINATURA}".`;
  const logoInstr = inserirLogo
    ? `\n- ÁREA DE LOGO (NÃO DESENHAR): RESERVE o canto superior direito (~14% da largura por ~14% da altura) com fundo LIMPO/uniforme (sem texto, sem ícone, sem símbolo, sem brasão). É PROIBIDO inventar logotipo, marca, monograma, escudo, cruz médica, símbolo de dente, "PC", "FM", "Planner", "Chico" ou qualquer letreiro nessa região — a LOGO REAL do Planner Chico será sobreposta DEPOIS pelo sistema. Apenas deixe o espaço limpo.`
    : `\n- SEM logo nesta imagem (cliente solicitou explicitamente). Não desenhe nenhum letreiro/símbolo de marca.`;
  return `CARTAZ MÉDICO ULTRA PREMIUM — autoridade hospitalar de cirurgia bucomaxilofacial, nível editorial Lancet/NEJM/Vogue Saúde:
- ESTILO: ultra premium, alto luxo médico, cinematográfico, fotografia clínica de revista científica top-tier. Iluminação dramática, profundidade, micro-texturas, qualidade 8K, ZERO aparência amadora ou "stock photo barato".
- Paleta: azul profundo (#0c2340), branco puro, azul elétrico (#2dd4ff). Vermelho APENAS para sinalizar DOR/alerta clínico.
- Tipografia bold sans-serif premium (estilo Inter/Söhne), alto contraste, hierarquia clara, kerning impecável.
- Texto curto em PT-BR (com acentos corretos e ortografia perfeita) sobre: "${tema}".${assinaturaInfo}${logoInstr}
- Rede de destino: ${rede}. ${rede === "estilo-x" ? "Estilo TWEET visual, 16:9." : "Formato quadrado 1:1."}${slideInfo}
- PROIBIDO ABSOLUTO: inventar logotipo/marca/símbolo de marca em qualquer parte da imagem, texto em inglês, watermark de IA, estética genérica de banco de imagens, dentes hiper-saturados, sorrisos clichês, cores chapadas/saturadas demais, layout amador.`;
}


export const generateSinglePost = createServerFn({ method: "POST" })
  .middleware([])
  .inputValidator((d: unknown) => SingleInput.parse(d))
  .handler(async ({ data }) => {
    const context = { userId: TEMP_USER_ID };
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider, generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(data.modelo);

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
      const fileName = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabaseAdmin.storage
        .from("post-images")
        .upload(fileName, buf, { contentType: "image/jpeg", upsert: false, cacheControl: "604800" });
      if (error) throw new Error(`Upload: ${error.message}`);
      const publicUrl = supabaseAdmin.storage.from("post-images").getPublicUrl(fileName).data.publicUrl;
      const { data: signed } = await supabaseAdmin.storage.from("post-images").createSignedUrl(fileName, 60 * 60 * 24 * 7);
      return { publicUrl, signedUrl: signed?.signedUrl ?? publicUrl };
    };

    let urlImagem: string;
    let imagensCarrossel: string[] = [];
    let urlImagemCache: string | null = null;
    let imagensCarrosselCache: string[] = [];

    if (formato === "Carrossel") {
      // Estilo X (tweet 16:9) limita a 3 slides; demais carrosséis = 5 cards.
      const fullSpec = [
        { n: 1, total: 5, papel: "CAPA: GANCHO forte de conversão (pergunta/dor) + assinatura. Layout impactante de revista." },
        { n: 2, total: 5, papel: "PROBLEMA: aprofunda a dor/sintoma. Imagem clínica forte. Sem assinatura." },
        { n: 3, total: 5, papel: "CAUSA / EXPLICAÇÃO CIENTÍFICA: didática, com citação curta no rodapé (Lancet/IJOMS/JOMS). Sem assinatura." },
        { n: 4, total: 5, papel: "SOLUÇÃO / TRATAMENTO: como o cirurgião resolve. Tom de autoridade. Sem assinatura." },
        { n: 5, total: 5, papel: "CTA FINAL: WhatsApp / Link na Bio + assinatura. Slide de fechamento." },
      ];
      const xSpec = [
        { n: 1, total: 3, papel: "TWEET 1: gancho/pergunta forte com assinatura." },
        { n: 2, total: 3, papel: "TWEET 2: explicação científica curta." },
        { n: 3, total: 3, papel: "TWEET 3: CTA WhatsApp/Link na Bio + assinatura." },
      ];
      const slidesSpec = data.rede === "estilo-x" ? xSpec : fullSpec;
      const b64s = await Promise.all(
        slidesSpec.map((s) =>
          generateImageBase64({
            apiKey: key,
            prompt: imageSystemPrompt(tema, data.rede, s, data.inserirLogo),
            size,
          }),
        ),
      );
      const uploads = await Promise.all(b64s.map(uploadOne));
      urlImagem = uploads[0].publicUrl;
      urlImagemCache = uploads[0].signedUrl;
      imagensCarrossel = uploads.map((upload) => upload.publicUrl);
      imagensCarrosselCache = uploads.map((upload) => upload.signedUrl);
    } else {
      const b64 = await generateImageBase64({
        apiKey: key,
        prompt: imageSystemPrompt(tema, data.rede, undefined, data.inserirLogo),
        size,
      });
      const upload = await uploadOne(b64);
      urlImagem = upload.publicUrl;
      urlImagemCache = upload.signedUrl;
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
        url_imagem_cache: urlImagemCache,
        url_imagem_cache_expires_at: urlImagemCache ? new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString() : null,
        imagens_carrossel: imagensCarrossel,
        imagens_carrossel_cache: imagensCarrosselCache,
        imagens_carrossel_cache_expires_at: imagensCarrosselCache.length ? new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString() : null,
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
  .middleware([])
  .inputValidator((d: unknown) => WeekInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const { buildScheduleSlots } = await import("@/lib/schedule-config");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(data.modelo);

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
