import { createServerFn } from "@tanstack/react-start";
// Auth desativada no projeto — usamos um user_id temporário fixo.
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const ModeloImagemEnum = z.enum([
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-2.5-flash-image",
  "openai/gpt-image-1-mini",
  "openai/gpt-image-2",
  "google/gemini-3-pro-image-preview",
]);
export { MODELOS_IMAGEM } from "@/lib/ai-gateway.server";

const NivelEnum = z.enum(["auto", "ig-conversao", "ig-autoridade", "linkedin-cientifico", "google-business"]);
export type NivelConteudo = z.infer<typeof NivelEnum>;

const SingleInput = z.object({
  // Se vazio, a IA escolhe um tema relevante automaticamente.
  tema: z.string().optional().default(""),
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("CTBMF"),
  rede: z.enum(["instagram", "linkedin", "estilo-x", "google"]).default("instagram"),
  tipo: z.enum(["feed", "stories"]).optional(),
  formato: z.enum(["Carrossel", "Story", "Post Único"]).optional(),
  quando: z.string().datetime().optional(),
  inserirLogo: z.boolean().optional().default(true),
  inserirAvatar: z.boolean().optional().default(false),
  modelo: ModeloEnum.optional().default("google/gemini-3-flash-preview"),
  modeloImagem: ModeloImagemEnum.optional().default("google/gemini-3.1-flash-image-preview"),
  // Cross-posting: publica simultaneamente em ambas as redes (ignora `rede` para destino).
  ambasRedes: z.boolean().optional().default(false),
  // Status inicial do post (PendenteAprovacao = revisão manual; Agendado = vai pro cron de publicação).
  status: z.enum(["PendenteAprovacao", "Agendado"]).optional().default("PendenteAprovacao"),
  // Nível editorial: define o tom/estrutura do conteúdo.
  nivel: NivelEnum.optional().default("auto"),
});


const WeekInput = z.object({
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("Ambas"),
  modelo: ModeloEnum.optional().default("google/gemini-3-flash-preview"),
});

const WHATSAPP = "https://wa.me/5511947684004";
const ASSINATURA = "Prof. Francisco Menezes | CROSP 53318";
const ASSINATURA_SUBTITULO = "Cirurgia e Traumatologia Bucomaxilofacial · Odontologia Hospitalar";

const CTAS_PROIBIDOS = `PROIBIDO ABSOLUTO nos textos: "agende sua consulta", "agende sua avaliação", "marque consulta", "marque avaliação", "promoção", "oferta", "desconto", "últimas vagas", qualquer chamada comercial explícita.`;
const CTAS_PERMITIDOS_IG = `CTAs PERMITIDOS (IG/X): "Saiba mais pelo link da bio." | "Expliquei esse assunto em detalhes no link da bio." | "Veja o conteúdo completo através do link da bio." | "Link na Bio".`;
const CTAS_PERMITIDOS_LI = `CTA permitido (LinkedIn): convite à discussão profissional entre colegas ou WhatsApp ${WHATSAPP} ("Fale comigo no WhatsApp").`;

function resolveNivel(nivel: NivelConteudo, rede: "instagram" | "linkedin" | "estilo-x" | "google", tipo?: "feed" | "stories"): Exclude<NivelConteudo, "auto"> {
  if (nivel !== "auto") return nivel;
  if (rede === "google") return "google-business";
  if (rede === "linkedin") return "linkedin-cientifico";
  if (tipo === "stories") return "ig-conversao";
  return "ig-autoridade";
}

function tonePrompt(nivel: Exclude<NivelConteudo, "auto">) {
  if (nivel === "linkedin-cientifico") {
    return `TOM: professor universitário, pesquisador e líder de opinião em Cirurgia e Traumatologia Bucomaxilofacial. Público: cirurgiões BMF, dentistas, médicos, residentes, gestores hospitalares, professores e pesquisadores. Linguagem científica formal, evidência sempre. Cite fonte (The Lancet, Int. J. Oral Maxillofac. Surg., J. Oral Maxillofac. Surg., OSOMOPOR, BJOMS, Int. J. Oral Sci.) e DOI quando aplicável. Sem opiniões sem respaldo.`;
  }
  if (nivel === "ig-conversao") {
    return `TOM: linguagem ACESSÍVEL ao público leigo (25-75 anos), empática, neuromarketing médico. Comece pela DOR/queixa real ("Você sente...", "Já acordou com..."). Faça a pessoa se identificar. Sem jargão; quando inevitável, traduzir entre parênteses.`;
  }
  if (nivel === "google-business") {
    return `TOM: SEO local médico, didático, humano e profissional. Público: pacientes leigos que pesquisam no Google sintomas e dúvidas sobre cirurgia bucomaxilofacial, ATM, DTM, bruxismo, siso, cirurgia ortognática, trauma facial, apneia. Texto pensado para Google Meu Negócio: responde à intenção de busca, fortalece autoridade regional e melhora ranqueamento local.`;
  }
  // ig-autoridade
  return `TOM: autoridade hospitalar de alto nível, ciência traduzida para leigos. Posicionamento de professor universitário/cirurgião referência. Apresente casos, dados e mecanismos com clareza, mas sem jargão impenetrável. Desperte confiança e busca espontânea por informação.`;
}

function captionSystem(rede: "instagram" | "linkedin" | "estilo-x" | "google", especialidade: string, nivel: Exclude<NivelConteudo, "auto">) {
  const isLI = nivel === "linkedin-cientifico";
  const isGoogle = nivel === "google-business";

  if (isGoogle) {
    return `Você é especialista em SEO Local Médico, Google Business Profile (Google Meu Negócio) e posicionamento digital em saúde do ${ASSINATURA} (${ASSINATURA_SUBTITULO}).
Especialidade do post: ${especialidade}.
${tonePrompt(nivel)}

ESTRUTURA OBRIGATÓRIA (Google Business Profile):
1. TÍTULO SEO curto (até 70 caracteres) que reproduza uma pergunta real pesquisada no Google.
2. Resposta direta em 1-2 frases.
3. Explicação objetiva e didática (entre 150 e 300 palavras no total).
4. Orientação educativa e sinais de especialização.
5. CTA discreto: convidar o paciente a conhecer mais pelo perfil ou falar pelo WhatsApp ${WHATSAPP}.
6. Bloco final com: "Palavras-chave SEO: ..." (5 a 8 termos, separados por vírgula, incluindo naturalmente: Cirurgião Bucomaxilofacial, Bucomaxilo, Cirurgia Bucomaxilofacial, Especialista em ATM, Odontologia Hospitalar, DTM, Bruxismo, Cirurgia Ortognática quando fizer sentido).
7. Linha "ALT TEXT: ..." (texto alternativo objetivo descrevendo a imagem sugerida, 1 frase).

FORMATO DA SAÍDA: texto corrido em PT-BR Brasil impecável, parágrafos curtos, sem emojis, sem hashtags, sem palavras duplicadas, sem inglês desnecessário. Comece pelo TÍTULO em negrito (use ** ao redor), pule linha, depois corpo, palavras-chave e ALT TEXT.
${CTAS_PROIBIDOS}
NÃO inclua a assinatura no corpo do texto — ela aparece como overlay na imagem.`;
  }

  const estrutura = isLI
    ? `ESTRUTURA OBRIGATÓRIA (LinkedIn Científico):
1. Título técnico forte.
2. Contextualização clínica.
3. Resumo do estudo (1-2 parágrafos curtos).
4. Principais achados (bullets).
5. Impacto para a prática clínica em CTBMF e Odontologia Hospitalar.
6. Reflexão profissional do Prof. Francisco Menezes.
7. Fonte consultada + DOI quando aplicável.`
    : `ESTRUTURA OBRIGATÓRIA (Instagram):
1. Gancho emocional forte (1ª linha).
2. Problema frequentemente ignorado.
3. Explicação simples e didática.
4. Consequências da negligência.
5. Soluções disponíveis (sem comercializar).
6. Encerramento com CTA indireto permitido.`;

  return `Você é diretor criativo e copywriter médico premium do ${ASSINATURA} (${ASSINATURA_SUBTITULO}).
Especialidade do post: ${especialidade}.
${tonePrompt(nivel)}

${estrutura}

${isLI ? CTAS_PERMITIDOS_LI : CTAS_PERMITIDOS_IG}
${CTAS_PROIBIDOS}

FORMATO DA LEGENDA:
${isLI
  ? `- LinkedIn: 1200-2000 caracteres, parágrafos curtos, no máximo 1-2 emojis sóbrios. 3-6 hashtags técnicas ao final. Inclua "Fonte: …" e DOI quando citar estudo.`
  : `- Instagram: gancho na 1ª linha, 3-6 emojis estratégicos, parágrafos curtos, 5-8 hashtags ao final relevantes ao tema. CTA indireto na última linha.`}
NÃO inclua a assinatura no corpo do texto — ela aparece como overlay na imagem.`;
}

function imageSystemPrompt(tema: string, rede: string, nivel: Exclude<NivelConteudo, "auto">, slide?: { n: number; total: number; papel: string }, inserirLogo: boolean = true, inserirAvatar: boolean = false) {
  const slideInfo = slide
    ? `\n- ESTE É O SLIDE ${slide.n}/${slide.total} de um CARROSSEL. Papel deste slide: ${slide.papel}.`
    : "";
  const assinaturaInfo = slide
    ? slide.n === 1 || slide.n === slide.total
      ? `\n- Rodapé OBRIGATÓRIO em 2 linhas pequenas: "${ASSINATURA}" / "${ASSINATURA_SUBTITULO}".`
      : `\n- NÃO inclua a assinatura neste slide (vai apenas no 1º e último).`
    : `\n- Rodapé discreto em 2 linhas: "${ASSINATURA}" / "${ASSINATURA_SUBTITULO}".`;
  const logoInstr = inserirLogo
    ? `\n- ÁREA DE LOGO (NÃO DESENHAR): RESERVE o canto superior direito (~14% × 14%) com fundo LIMPO/uniforme. PROIBIDO inventar logotipo, marca, monograma, escudo, cruz médica, símbolo de dente, "PC", "FM", "Planner", "Chico" ou qualquer letreiro — a LOGO REAL será sobreposta DEPOIS pelo sistema.`
    : `\n- SEM logo nesta imagem. Não desenhe nenhum letreiro/símbolo de marca no canto superior direito.`;
  const avatarInstr = inserirAvatar
    ? `\n- ÁREA DE AVATAR (NÃO DESENHAR): RESERVE o canto superior esquerdo (~14% × 14%, circular) com fundo LIMPO/uniforme. PROIBIDO desenhar rosto, retrato, médico genérico ou qualquer pessoa nesse círculo — a FOTO REAL do Prof. Francisco Menezes será sobreposta DEPOIS pelo sistema.`
    : "";
  const refEditorial = nivel === "linkedin-cientifico"
    ? "Referência editorial: The Lancet, NEJM, JOMS — capa de revista científica top-tier, estética acadêmica premium."
    : "Referência editorial: Harvard Health, Mayo Clinic, Cleveland Clinic — hospital premium, autoridade institucional, luxo discreto.";
  return `CARTAZ MÉDICO ULTRA PREMIUM — autoridade hospitalar em Cirurgia e Traumatologia Bucomaxilofacial + Odontologia Hospitalar.
- ${refEditorial} Minimalismo editorial, ZERO aparência de anúncio ou banco de imagens.
- Paleta OBRIGATÓRIA: azul petróleo profundo (#0c2340), azul ciano (#2dd4ff), branco puro, preto sofisticado. Vermelho APENAS para sinalizar DOR/alerta clínico.
- Iluminação cinematográfica, profundidade, micro-texturas, qualidade 8K, hierarquia visual forte.
- Tipografia bold sans-serif premium (Inter/Söhne), alto contraste, kerning impecável.
- Texto curto em PT-BR (Português do Brasil) com acentuação correta, ortografia impecável, SEM palavras duplicadas/repetidas, SEM erros de concordância, SEM letras trocadas, SEM caracteres estranhos. Tema: "${tema}".${assinaturaInfo}${logoInstr}${avatarInstr}
- Rede de destino: ${rede}. ${rede === "estilo-x" ? "Estilo TWEET visual, 16:9." : rede === "google" ? "Google Meu Negócio: cartaz horizontal 4:3 (1200x900), estilo Mayo/Cleveland Clinic, autoridade médica regional, foco em SEO local." : "Formato quadrado 1:1 (ou 4:5 quando aplicável)."}${slideInfo}
- PROIBIDO ABSOLUTO: inventar logotipo/marca, texto em inglês, palavras repetidas duas vezes seguidas, tipografia com glitch, watermark de IA, estética de banco de imagens, dentes hiper-saturados, sorrisos clichês, cores chapadas/saturadas demais, layout amador, chamadas comerciais como "agende consulta" / "promoção" / "desconto".`;
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

    // 1. Resolve nível editorial
    const nivel = resolveNivel(data.nivel, data.rede, data.tipo);
    const isStory = formato === "Story";

    // 2. Dispara legenda + imagens EM PARALELO (não dependem entre si).
    const legendaPromise = generateText({
      model,
      system: captionSystem(data.rede, data.especialidade, nivel),
      prompt: isStory
        ? `Crie um TEXTO DE STORY (até 220 caracteres, 1-2 emojis, sem hashtags, CTA "Link na Bio") que CHAME ATENÇÃO para o post do FEED de hoje sobre: "${tema}". O story deve provocar curiosidade e mandar o usuário para o feed.`
        : `Crie a legenda completa para o post sobre: "${tema}".`,
    }).then((r) => r.text);

    const size: "1024x1024" | "1536x1024" =
      data.rede === "estilo-x" ? "1536x1024" : "1024x1024";

    // Upload faz parte do pipeline; cada imagem é enviada assim que sai do modelo,
    // em vez de esperar todas terminarem.
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

    const { overlayLogo } = await import("@/lib/logo-overlay.server");
    const genAndUpload = (prompt: string, applyLogo: boolean) =>
      generateImageBase64({ apiKey: key, prompt, size, model: data.modeloImagem })
        .then((b64) => (applyLogo ? overlayLogo(b64) : Promise.resolve(b64)))
        .then(uploadOne);

    let urlImagem: string;
    let imagensCarrossel: string[] = [];
    let urlImagemCache: string | null = null;
    let imagensCarrosselCache: string[] = [];

    if (formato === "Carrossel") {
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
      const uploads = await Promise.all(
        slidesSpec.map((s) => {
          // Regra: logo só na 1ª e última imagem do carrossel (e respeitando inserirLogo)
          const applyLogo = !!data.inserirLogo && (s.n === 1 || s.n === s.total);
          return genAndUpload(imageSystemPrompt(tema, data.rede, nivel, s, data.inserirLogo, data.inserirAvatar), applyLogo);
        }),
      );
      urlImagem = uploads[0].publicUrl;
      urlImagemCache = uploads[0].signedUrl;
      imagensCarrossel = uploads.map((u) => u.publicUrl);
      imagensCarrosselCache = uploads.map((u) => u.signedUrl);
    } else {
      const upload = await genAndUpload(
        imageSystemPrompt(tema, data.rede, nivel, undefined, data.inserirLogo, data.inserirAvatar),
        !!data.inserirLogo,
      );
      urlImagem = upload.publicUrl;
      urlImagemCache = upload.signedUrl;
    }

    const legenda = await legendaPromise;


    const tipoPost = formato === "Carrossel" ? "Carrossel" : "Post Único";

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: context.userId,
        tipo_post: tipoPost,
        estilo_layout: data.rede === "estilo-x" ? "Estilo X" : "Padrão",
        formato_midia: "Imagem",
        legenda,
        url_imagem: urlImagem,
        url_imagem_cache: urlImagemCache,
        url_imagem_cache_expires_at: urlImagemCache ? new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString() : null,
        imagens_carrossel: imagensCarrossel,
        imagens_carrossel_cache: imagensCarrosselCache,
        imagens_carrossel_cache_expires_at: imagensCarrosselCache.length ? new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString() : null,
        postar_instagram: data.ambasRedes || data.rede !== "linkedin",
        postar_linkedin: data.ambasRedes || data.rede === "linkedin",
        status: data.status,
        data_agendamento: data.quando ?? null,
        prompt_ia: tema,
      } as any)
      .select()
      .single();
    if (insErr) throw new Error(`DB: ${insErr.message}`);

    // Para preview usamos URLs assinadas (cache) porque o bucket é privado;
    // fallback para a URL pública caso a assinada não exista.
    const urls = imagensCarrosselCache.length
      ? imagensCarrosselCache
      : [urlImagemCache || urlImagem];
    return { id: (inserted as any).id, url: urlImagemCache || urlImagem, legenda, slides: urls.length, urls };
  });

// Descarta (deleta) um post — usado no preview quando o usuário rejeita o resultado da IA.
export const discardPost = createServerFn({ method: "POST" })
  .middleware([])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.id);
    if (error) throw new Error(`DB: ${error.message}`);
    return { ok: true };
  });

// Aprova um post pendente de revisão — define status final (Rascunho/Agendado/Publicado).
export const approvePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      acao: z.enum(["arquivar", "agendar", "publicar"]).default("arquivar"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.acao === "publicar") {
      // Lê post para descobrir destinos.
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("postar_instagram,postar_linkedin")
        .eq("id", data.id)
        .maybeSingle();

      const results: any = { ok: true, status: "Publicado" };
      const warnings: string[] = [];

      if (post?.postar_linkedin) {
        try {
          const { publishLinkedInPostById } = await import("@/lib/social/linkedin-publish.server");
          const r = await publishLinkedInPostById({ supabaseAdmin, postId: data.id, userId: context.userId });
          results.linkedin = r;
        } catch (err: any) {
          warnings.push(`LinkedIn: ${err?.message || err}`);
        }
      }

      if (post?.postar_instagram) {
        try {
          const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");
          const r = await publishInstagramPostById({ supabaseAdmin, postId: data.id, userId: context.userId });
          results.instagram = r;
        } catch (err: any) {
          const msg = String(err?.message || "");
          if (/webhook do Make|Instagram oficial|Configure seu perfil/i.test(msg)) {
            warnings.push(`Instagram não configurado: ${msg}`);
          } else {
            warnings.push(`Instagram: ${msg}`);
          }
        }
      }

      // Se nada publicou, marca como Agendado para retry.
      if (!results.linkedin && !results.instagram) {
        await supabaseAdmin.from("posts").update({ status: "Agendado", user_id: context.userId }).eq("id", data.id);
        results.status = "Agendado";
      } else {
        await supabaseAdmin.from("posts").update({ status: "Publicado", user_id: context.userId }).eq("id", data.id);
      }

      if (warnings.length) results.warning = warnings.join(" | ");
      return results;
    }
    const status = data.acao === "agendar" ? "Agendado" : "Rascunho";
    const patch: any = { status, user_id: context.userId };
    const { error } = await supabaseAdmin.from("posts").update(patch).eq("id", data.id);
    if (error) throw new Error(`DB: ${error.message}`);
    return { ok: true, status };
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
