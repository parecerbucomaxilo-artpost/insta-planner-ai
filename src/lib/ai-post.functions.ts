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
  modelo: ModeloEnum.optional().default("google/gemini-3-flash-preview"),
  modeloImagem: ModeloImagemEnum.optional().default("google/gemini-3.1-flash-image-preview"),
  // Cross-posting: publica simultaneamente em ambas as redes (ignora `rede` para destino).
  ambasRedes: z.boolean().optional().default(false),
  // Status inicial do post (PendenteAprovacao = revisão manual; Agendado = vai pro cron de publicação).
  status: z.enum(["PendenteAprovacao", "Agendado"]).optional().default("PendenteAprovacao"),
  // Nível editorial: define o tom/estrutura do conteúdo.
  nivel: NivelEnum.optional().default("auto"),
  // Audiência: "geral" (padrão) ou "estudantes-graduacao" (Planner Simplificado).
  audiencia: z.enum(["geral", "estudantes-graduacao", "chico-drfm"]).optional().default("geral"),
});


const WeekInput = z.object({
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("Ambas"),
  modelo: ModeloEnum.optional().default("google/gemini-3-flash-preview"),
});

const WHATSAPP = "https://wa.me/5511947684004";
const ASSINATURA = "PROF. FRANCISCO MENEZES | CROSP:53318";
const ASSINATURA_SUBTITULO = "Cirurgia e Traumatologia Bucomaxilofacial · Odontologia Hospitalar";
const CIDADES_ATENDIMENTO = "São Paulo, Santa Bárbara d'Oeste e Americana";
const LOCALIZACAO_OBRIGATORIA = `INCLUSÃO OBRIGATÓRIA DE LOCALIZAÇÃO: no fechamento da legenda (junto ao CTA ou na última linha antes das hashtags), inserir naturalmente a frase indicando que os atendimentos são realizados em ${CIDADES_ATENDIMENTO}. Ex.: "Atendimento em ${CIDADES_ATENDIMENTO}." — variar a redação, mas SEMPRE citar as TRÊS cidades, na ordem, com a grafia exata "Santa Bárbara d'Oeste".`;

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
  return `TOM: autoridade hospitalar de alto nível, ciência traduzida para leigos, SEM bibliografia, SEM DOI, SEM citação de revista científica. Posicionamento de professor universitário/cirurgião referência falando em linguagem clara para o público geral. Apresente o mecanismo do problema com analogias simples. Desperte confiança e busca espontânea por informação.`;
}

function captionSystem(rede: "instagram" | "linkedin" | "estilo-x" | "google", especialidade: string, nivel: Exclude<NivelConteudo, "auto">) {
  const isLI = nivel === "linkedin-cientifico";
  const isGoogle = nivel === "google-business";

  if (isGoogle) {
    return `Você é especialista em SEO Local Médico e copywriting para Google Business Profile (Google Meu Negócio) do ${ASSINATURA} (${ASSINATURA_SUBTITULO}).
Especialidade do post: ${especialidade}.
${tonePrompt(nivel)}

OBJETIVO DO POST GOOGLE BUSINESS PROFILE:
- NÃO é post científico. NÃO é post de Instagram. NÃO é post de LinkedIn.
- É uma CHAMADA curta de SEO local pensada para aparecer na busca do Google e nos cards do Google Maps quando alguém pesquisa sintomas/dúvidas na região.
- Função: despertar interesse imediato, gerar identificação com o sintoma, posicionar o consultório como referência local e levar a pessoa a entrar em contato e gerar consulta.

ESTRUTURA OBRIGATÓRIA (Google Business — CHAMADA CURTA SEO LOCAL):
1. TÍTULO em **negrito** com pergunta real do Google (até 70 caracteres) — ex.: "**Dor na mandíbula ao acordar? Pode ser DTM**". Use a palavra-chave principal logo no início.
2. 1 frase de identificação direta com o sintoma/problema ("Você sente...", "Já notou...", "Acorda com..."). Linguagem 100% leiga.
3. 2-3 frases curtas explicando, sem jargão, o que pode ser e por que avaliar com especialista importa. Reforce autoridade regional ("atendimento especializado em São Paulo", "referência em CTBMF e Odontologia Hospitalar") quando couber naturalmente.
4. 1 frase de CTA discreto e humano: convidar a conhecer mais pelo perfil OU enviar mensagem no WhatsApp ${WHATSAPP}. Nunca usar linguagem de oferta/promoção/desconto.
5. Linha "Palavras-chave SEO: ..." — 5 a 8 termos separados por vírgula, escolhidos para SEO local (ex.: Cirurgião Bucomaxilofacial São Paulo, Especialista em ATM, Tratamento de DTM, Bruxismo, Cirurgia Ortognática, Odontologia Hospitalar, Siso incluso, Trauma facial). Adapte ao tema.
6. Linha "ALT TEXT: ..." — 1 frase descrevendo a imagem para acessibilidade e SEO.

REGRAS DE FORMATO:
- TEXTO TOTAL entre 60 e 120 palavras (NUNCA ultrapassar 120). Parágrafos curtos (máx. 2 linhas).
- PT-BR Brasil impecável. SEM emojis, SEM hashtags, SEM inglês desnecessário, SEM bibliografia, SEM DOI, SEM citação de revista científica.
- Começar SEMPRE pelo TÍTULO em **negrito**, pular linha, depois corpo, Palavras-chave SEO e ALT TEXT.
- NÃO incluir a assinatura no corpo — entra como overlay na imagem.

${CTAS_PROIBIDOS}
${LOCALIZACAO_OBRIGATORIA}`;
  }

  const estrutura = isLI
    ? `OBJETIVO DO POST LINKEDIN:
- LinkedIn é REDE PROFISSIONAL CIENTÍFICA. Público: cirurgiões BMF, dentistas, médicos, residentes, professores, pesquisadores e gestores hospitalares.
- O post deve parecer um MICRO-ARTIGO CIENTÍFICO de alto nível (estética The Lancet/JOMS), não um post de Instagram traduzido. Densidade técnica, vocabulário próprio da área, evidência citada.
- Imagem é HORIZONTAL (capa de artigo científico).

ESTRUTURA OBRIGATÓRIA (LinkedIn Científico):
1. TÍTULO técnico em **negrito** (estilo título de paper, sem clickbait).
2. Contextualização clínica/epidemiológica em 2-3 frases com terminologia técnica precisa (CTBMF, ATM, DTM, ortognática, trauma maxilofacial, odontologia hospitalar etc.).
3. RESUMO DO ESTUDO/EVIDÊNCIA em 1 parágrafo (desenho do estudo, n, população, intervenção, desfecho principal).
4. PRINCIPAIS ACHADOS em 3-5 bullets curtos e técnicos (com números/percentuais quando o estudo fornecer — NUNCA inventar).
5. IMPACTO PARA A PRÁTICA em 2-3 frases (o que muda na decisão clínica do cirurgião BMF e na odontologia hospitalar).
6. REFLEXÃO PROFISSIONAL curta convidando colegas à discussão nos comentários OU ao contato via WhatsApp ${WHATSAPP}.
7. BLOCO FINAL "Referências:" — listar 1 a 3 referências bibliográficas no formato Vancouver resumido, com Revista, ano, volume(número):páginas e DOI quando disponível. Ex.: "Smith J, et al. Outcomes of orthognathic surgery in OSA. J Oral Maxillofac Surg. 2024;82(4):512-520. doi:10.1016/j.joms.2024.01.012". Use APENAS revistas reais do campo (The Lancet, Int J Oral Maxillofac Surg, J Oral Maxillofac Surg, OSOMOPOR, BJOMS, Int J Oral Sci, JADA, J Dent Res).
8. 3-5 hashtags técnicas ao final (#CTBMF #CirurgiaBucoMaxiloFacial #OdontologiaHospitalar #ATM #CirurgiaOrtognatica etc.).`
    : `ESTRUTURA OBRIGATÓRIA (Instagram) — ENXUTO:
1. Gancho emocional forte (1ª linha).
2. Problema em 1 frase.
3. Explicação simples (2-3 frases curtas).
4. Consequência em 1 frase.
5. CTA indireto.`;

  return `Você é diretor criativo e copywriter médico premium do ${ASSINATURA} (${ASSINATURA_SUBTITULO}).
Especialidade do post: ${especialidade}.
${tonePrompt(nivel)}

${estrutura}

${isLI ? CTAS_PERMITIDOS_LI : CTAS_PERMITIDOS_IG}
${CTAS_PROIBIDOS}
${LOCALIZACAO_OBRIGATORIA}

FORMATO DA LEGENDA:
${isLI
  ? `- LinkedIn: 1200-1800 caracteres (densidade científica real), parágrafos de no máximo 3 linhas, no máximo 1 emoji sóbrio (ou nenhum). Bloco "Referências:" obrigatório com DOI. Sem linguagem leiga, sem analogias infantis, sem chamadas de Instagram.`
  : `- Instagram: 400-700 caracteres (NUNCA ultrapasse 800), gancho na 1ª linha, 2-4 emojis estratégicos, parágrafos de 1-2 linhas, 4-6 hashtags ao final. CTA indireto na última linha.`}
NÃO inclua a assinatura no corpo do texto — ela aparece como overlay na imagem.`;
}


function themeLock(tema: string) {
  return `\n\n=== TRAVA DE TEMA (REGRA SUPREMA — VIOLAÇÃO = REJEIÇÃO) ===
- O ÚNICO assunto permitido nesta imagem é: "${tema}".
- TODOS os elementos visuais (cena, anatomia, instrumentos, ícones, headline, sublinhas, símbolos, ilustrações de fundo, gráficos) DEVEM representar literal e exclusivamente "${tema}".
- Em carrossel/thread: TODOS os slides são sobre "${tema}" — cada slide aborda um ÂNGULO DIFERENTE do MESMO tema (dor, mecanismo, solução, ganho, CTA), JAMAIS muda de assunto, JAMAIS introduz outra patologia, JAMAIS mistura temas.
- PROIBIDO: trocar de tema entre slides, inserir cena genérica de odontologia, mostrar procedimento diferente do tema, citar/ilustrar outra condição clínica, "encher" o slide com anatomia decorativa não relacionada.
- Se "${tema}" for siso, NÃO mostre ATM/ortognática/trauma. Se for ATM, NÃO mostre exodontia/implante. Se for trauma, NÃO mostre patologia/canal. UM TEMA POR POST.
- Antes de renderizar, confirme mentalmente: "esta imagem é INEQUIVOCAMENTE sobre ${tema}?" Se não, refaça.
=== FIM DA TRAVA DE TEMA ===\n`;
}

function imageSystemPrompt(tema: string, rede: string, nivel: Exclude<NivelConteudo, "auto">, slide?: { n: number; total: number; papel: string }) {

  // === FORMATO ESTILO X (TWEET REAL) — short-circuit ===
  // A imagem PRECISA parecer um print autêntico de um post publicado no X (antigo Twitter),
  // não uma cena médica com headline. Tweet card pixel-perfect, sem cena de fundo.
  if (rede === "estilo-x") {
    const slideTweetInfo = slide
      ? `\n- ESTE É O CARD ${slide.n}/${slide.total} de uma THREAD. Papel: ${slide.papel}. Mantenha a MESMA identidade visual (avatar, handle, paleta) em todos os cards.`
      : "";
    return themeLock(tema) + `MOCKUP DE TWEET ULTRA REALISTA — print autêntico de um post publicado no X (antigo Twitter), tema "${tema}".
- FORMATO horizontal 16:9 (1536x1024). Composição centralizada: card de tweet ocupando ~70% da largura, sobre fundo neutro suave (cinza claro #f7f9fa OU preto #000000 modo escuro do X — escolha 1 e mantenha consistência).
- ANATOMIA EXATA DE UM TWEET PUBLICADO no X (não inventar layout):
  1) Cabeçalho: avatar circular à esquerda (foto profissional sóbria de um cirurgião — jaleco branco / luvas, SEM rosto reconhecível de pessoa real); ao lado, em uma linha: nome em bold "Prof. Francisco Menezes" + selo de verificado azul X (checkmark branco em badge azul #1d9bf0) + nova linha com handle cinza "@franciscomenezes_bmf · 2h".
  2) Corpo do tweet: texto em tipografia Chirp/sans-serif do X, tamanho confortável, PT-BR Brasil impecável com acentuação perfeita. Conteúdo curto e impactante sobre "${tema}" (máx. ~240 caracteres, 2-4 frases curtas, tom de autoridade médica acessível, pode usar 1 emoji médico sóbrio 🦷 ou 🩺). SEM hashtags na imagem.
  3) Rodapé do tweet: linha cinza fina com os ícones nativos do X em ordem — balão de comentário, retweet (setas), coração (curtida), gráfico de views, compartilhar. Pode mostrar contadores plausíveis (ex.: 142, 89, 1.2K, 23K) em cinza claro.
- TIPOGRAFIA: idêntica ao X real (Chirp / system sans-serif). Hierarquia: nome bold preto/branco, handle cinza médio #536471, corpo preto/branco, contadores cinza.
- PALETA: usar EXATAMENTE as cores do X — fundo branco #ffffff + texto #0f1419 + cinza #536471 + accent azul #1d9bf0. (Variante dark: fundo #000000 + texto #e7e9ea + cinza #71767b.) NADA de navy #14366b ou ciano #2dd4ff aqui — essa paleta é só para os outros formatos.
- PROIBIDO: cena médica de fundo, ilustração anatômica, headline tipo cartaz, faixa de assinatura, logos inventados, "PC"/"FM"/"Planner", marca d'água, watermark de IA, texto em inglês, palavras duplicadas, ortografia errada, layout que não exista no X real.
- O conteúdo do tweet pode (opcionalmente) terminar com a frase natural "Atendimento em São Paulo, Santa Bárbara d'Oeste e Americana." — sem CTAs comerciais.${slideTweetInfo}
- Variação (seed ${Math.random().toString(36).slice(2, 10)}): variar avatar, contadores e fundo claro/escuro.`;
  }


  const isUltimoSlide = !!slide && slide.n === slide.total;
  const isInstagram = rede === "instagram";
  const isStory = !slide && nivel === "ig-conversao" && isInstagram; // heurística
  const isPostUnicoComCTA = !slide && !isStory && rede !== "linkedin"; // único IG/Google ganha CTA forte
  const slideInfo = slide
    ? `\n- ESTE É O SLIDE ${slide.n}/${slide.total} de um CARROSSEL. Papel deste slide: ${slide.papel}.${isUltimoSlide ? " SLIDE DE FECHAMENTO — caprichar ao máximo: hierarquia limpa, CTA elegante, espaço negativo generoso." : ""}`
    : "";
  const ctaForteInfo = (isUltimoSlide && rede !== "linkedin") || isPostUnicoComCTA
    ? `\n- CTA FORTE OBRIGATÓRIO: incluir o ÍCONE oficial do WHATSAPP (balão verde #25D366 com fone branco, estilo flat, NÃO inventar variações) no canto inferior direito + texto curto "LINK NA BIO" em tipografia bold grande. Pode incluir "+55 11 94768-4004" em corpo menor ao lado do ícone. Hierarquia limpa, sem poluir a composição.`
    : "";
  const assinaturaInfo = isInstagram
    ? `\n- Reserve um espaço discreto no rodapé (faixa estreita azul petróleo #0c2340 OU canto inferior limpo) para a assinatura textual "${ASSINATURA}" / "${ASSINATURA_SUBTITULO}" em tipografia pequena branca. Não dominar a composição.`
    : `\n- RODAPÉ OBRIGATÓRIO em 2 linhas pequenas, centralizado, tipografia bold sans-serif branca sobre faixa azul petróleo (#0c2340): "${ASSINATURA}" / "${ASSINATURA_SUBTITULO}".`;
  const semMarca = `\n- PROIBIDO desenhar QUALQUER logotipo, marca, monograma, escudo, cruz médica, símbolo de dente, "PC", "FM", "Planner" ou letreiro inventado. Sem áreas reservadas nos cantos para logo. A única identificação textual é a assinatura no rodapé.`;
  const semInvencao = `\n- NÃO INVENTE: proibido desenhar radiografias, tomografias, ressonâncias, anatomia interna detalhada, próteses, implantes, dispositivos com marcas, gráficos com números inventados, percentuais fictícios, citações de estudos, DOIs, nomes de revistas, autores ou datas dentro da imagem.`;
  const semDiagnostico = isInstagram
    ? `\n- PROIBIDO EXPRESSAR DIAGNÓSTICO na imagem: nada de "Você tem DTM", "Isso é bruxismo", "Diagnóstico: ...". A imagem desperta identificação com um SINTOMA/CENA do dia a dia, nunca afirma doença.`
    : "";
  const isPublicoGeral = nivel !== "linkedin-cientifico";
  const semBibliografia = isPublicoGeral
    ? `\n- PÚBLICO GERAL: ZERO bibliografia, ZERO DOI, ZERO nome de revista, ZERO citação acadêmica na imagem.`
    : "";

  // === Dimensões EXATAS por rede/formato ===
  const dimensoes = rede === "estilo-x"
    ? "FORMATO horizontal 16:9 (1536x1024) — estilo tweet visual."
    : rede === "google"
      ? "FORMATO horizontal 4:3 (1536x1024) — cartaz Google Meu Negócio, SEO local."
      : rede === "linkedin"
        ? "FORMATO horizontal 1.91:1 (1536x1024) — capa de artigo científico premium tipo The Lancet/JOMS."
        : isStory
          ? "FORMATO vertical 9:16 (1024x1536) — Instagram Stories, tela cheia mobile."
          : "FORMATO vertical 4:5 (1024x1536) — Instagram Feed/Carrossel, mobile-first.";

  // === Estilo visual: prioriza FOTOGRAFIA REALISTA premium. Quadrinho/colagem/infográfico foram REMOVIDOS por produzirem resultados ruins. ===
  const estilosPossiveis = [
    "ILUSTRAÇÃO MÉDICA HIPER-REALISTA ANATÔMICA estilo Netter / Gray's Anatomy / Frank Netter / Atlas de Sobotta: renderização semi-3D de estruturas anatômicas reais (mandíbula, ATM, dentes, nervo alveolar, seios, músculos), proporções cientificamente corretas, sombreamento volumétrico, textura realista de osso/mucosa/dentina, qualidade de atlas médico premium — NÃO é desenho infantil, NÃO é cartoon, NÃO é flat design",
    "ILUSTRAÇÃO MÉDICA HIPER-REALISTA ANATÔMICA estilo Netter / Gray's Anatomy: corte sagital ou coronal de cabeça/mandíbula com transparências realistas mostrando osso + dente + nervo, cores naturais de tecido (osso bege-marfim, mucosa rosada, esmalte branco-perolado), iluminação científica, fundo navy luminoso",
    "RENDER 3D MÉDICO ULTRA-REALISTA tipo BioDigital / Visible Body / Zygote: anatomia bucomaxilofacial fotorrealista, materiais PBR (osso poroso real, esmalte translúcido, gengiva com subsurface scattering), profundidade cirúrgica, qualidade de simulador médico premium",
    "FOTOGRAFIA EDITORIAL HIPER-REALISTA estilo Mayo/Cleveland Clinic: cena clínica autêntica, iluminação cinematográfica, instrumental cirúrgico real, mãos com luvas, ambiente premium — qualidade de capa de revista médica internacional",
  ];
  const estiloEscolhido = estilosPossiveis[Math.floor(Math.random() * estilosPossiveis.length)];

  const refEditorial = nivel === "linkedin-cientifico"
    ? "Referência visual: capa The Lancet / NEJM / JOMS."
    : "Referência visual: Mayo Clinic, Cleveland Clinic, Harvard Health — fotografia médica premium.";

  return themeLock(tema) + `IMAGEM MÉDICA ULTRA PREMIUM — autoridade hospitalar em CTBMF + Odontologia Hospitalar.
- ${refEditorial} ZERO cara de anúncio, banco de imagens, estoque, clipart ou "IA óbvia".
- ${dimensoes}
- ESTILO OBRIGATÓRIO: ${estiloEscolhido}.
- CENA LITERAL E RECONHECÍVEL do tema "${tema}": siso → região posterior da mandíbula; ATM → mão na região pré-auricular; trauma facial → cena de pronto-socorro plausível; apneia → pessoa dormindo / CPAP; infecção → edema cervical; ortognática → perfil facial; UTI/VAP → leito hospitalar com tubo orotraqueal. Jamais imagem genérica desconectada do tema.
- ANATOMIA CORRETA: proporções humanas reais, mãos com exatamente 5 dedos, dentes em número e posição corretos, instrumental plausível. Se a IA tiver dúvida, prefira enquadramento que esconda a região (mão na boca, perfil, plano fechado em instrumental, foco seletivo).
- TEXTO NA IMAGEM: NO MÁXIMO 1 headline IMPACTANTE de 3 a 6 palavras (gancho forte tipo "DOR NO SISO?", "ATM TRAVADA", "RONCO MATA"), tipografia bold sans-serif condensada, BRANCO ou AZUL CIANO #2dd4ff, PT-BR com acentuação perfeita. SEM parágrafos, listas, números, bullets ou legendas — texto longo vai na legenda.
- PALETA OBRIGATÓRIA (fundo dominante AZUL NAVY LUMINOSO #14366b — tom vibrante, NÃO escuro/preto — em toda a imagem): NAVY LUMINOSO #14366b = fundo principal com leve gradiente para AZUL CIANO #2dd4ff nos cantos (atmosfera arejada, "daylight"); CIANO #2dd4ff = highlights, linhas, headline; BRANCO = pele/instrumental/texto; VERMELHO #E11D2E só em ponto de dor. Proibido fundo branco, fundo preto, navy chapado escuro tipo meia-noite, roxo, verde, laranja, amarelo, rosa, magenta, filtros saturados.
- Iluminação CLARA, ARTICULADA e LUMINOSA tipo capa de revista médica premium (key light suave + rim light ciano), nada de cena noturna ou low-key pesado. Profundidade real, qualidade 8K, hierarquia limpa, muito espaço negativo navy luminoso.${assinaturaInfo}${ctaForteInfo}${semMarca}${semInvencao}${semDiagnostico}${semBibliografia}${slideInfo}
- PROIBIDO: rostos reconhecíveis de pessoas reais, watermark de IA, dentes hiper-saturados, sorrisos clichês de banco de imagens, mãos deformadas, dedos a mais, anatomia impossível, texto em inglês, palavras duplicadas, cores fora da paleta, chamadas comerciais.
- Variação única (seed ${Math.random().toString(36).slice(2, 10)}): composição, ângulo e enquadramento inéditos.`;

}

// === PLANNER SIMPLIFICADO — AUDIÊNCIA: ESTUDANTES DE GRADUAÇÃO EM ODONTOLOGIA ===
// Tom didático e simples sobre cirurgia bucal básica; inclui enquetes, curiosidades,
// dicas de técnica e mitos x verdades. Sem CTA comercial. Cores das logos da
// faculdade (navy escuro + verde-azulado/teal), SEM fundo branco. As 2 logos são
// aplicadas como overlay real (canto inf. esq. + canto inf. dir.) pelo pipeline —
// a IA NÃO desenha logos; apenas reserva os cantos inferiores limpos.
function studentCaptionSystem() {
  return `Você é professor universitário de Cirurgia Bucomaxilofacial escrevendo para ALUNOS DE GRADUAÇÃO em Odontologia.
TOM: didático, claro, simples, instrutivo, próximo do aluno. Como se fosse um post de monitoria.
TIPOS DE CONTEÚDO (varie a cada post): (a) ENQUETE — pergunta de múltipla escolha clínica curta ("Qual a técnica anestésica para exodontia de 38?"), (b) CURIOSIDADE — fato anatômico/histórico curto, (c) DICA DE TÉCNICA — passo-a-passo simples de cirurgia bucal básica (exodontia, sutura, anestesia, ulectomia, frenectomia, biópsia incisional, alveoloplastia), (d) MITO x VERDADE.
ESTRUTURA DA LEGENDA (Instagram, 400-700 caracteres):
1. Gancho de aluno na 1ª linha ("Provão chegando?", "Caiu na prova:", "Você sabia que...", "Enquete rápida:").
2. Corpo didático com 2-3 frases curtas, linguagem acadêmica acessível, podendo usar termos técnicos básicos COM tradução curta.
3. Se enquete: listar 3-4 alternativas (A, B, C, D) e pedir resposta nos comentários. Revelar a correta na próxima frase ou pedir para comentarem.
4. Fechamento com 1 dica prática para a clínica/prova.
5. 4-6 hashtags: #OdontologiaAcadêmica #CirurgiaBucal #EstudanteDeOdonto #Graduação #MonitoriaOdonto + 1 do tema.
PROIBIDO: chamadas comerciais ("agende", "promoção"), WhatsApp do consultório, bibliografia tipo Lancet/JOMS, jargão hospitalar pesado, tom de paciente leigo. Sem assinatura no corpo — entra como logos no overlay.
REGRA DE PORTUGUÊS (revisão dupla obrigatória, não-negociável): texto 100% em Português do Brasil (pt-BR), com acentuação completa (á é í ó ú â ê ô ã õ à), cedilha (ç) e crase corretas. PROIBIDO: palavras em inglês, espanhol ou pseudo-latim; palavras inventadas; palavras duplicadas ("dor dor"); letras embaralhadas; abreviações não-padrão; termos técnicos grafados errados (correto: "exodontia", "frenectomia", "alveoloplastia", "biópsia", "anestesia", "sutura", "fórceps", "porta-agulhas", "carpule", "terceiro molar", "siso", "mandíbula", "maxila", "nervo alveolar inferior", "forame mentual", "canal mandibular", "panorâmica", "periapical", "tomografia computadorizada de feixe cônico"). Antes de devolver a legenda, releia palavra por palavra duas vezes e corrija qualquer erro de português; se houver QUALQUER dúvida sobre uma palavra, troque por sinônimo simples e correto.`;
}

function studentImagePrompt(tema: string, slide?: { n: number; total: number; papel: string }) {
  const slideInfo = slide ? `\n- SLIDE ${slide.n}/${slide.total} de carrossel didático. Papel: ${slide.papel}.` : "";
  const isStory = /story|stories/i.test(slide?.papel ?? "");
  const formato = isStory
    ? "FORMATO vertical 9:16 (1024x1820) — Instagram Stories, mobile fullscreen."
    : "FORMATO vertical 4:5 (1024x1280) — Instagram Feed/Carrossel padrão.";
  const conceitosCriativos = [
    "FOTOGRAFIA CLÍNICA HIPER-REALISTA com anatomia bucomaxilofacial cientificamente correta: instrumental cirúrgico real (fórceps, porta-agulhas, seringa carpule, bisturi nº 15, descolador de Molt) em macro, profundidade rasa, foco preciso, iluminação cinematográfica de centro cirúrgico.",
    "RENDERIZAÇÃO MÉDICA 3D HIPER-REALISTA estilo Netter/Sobotta digital: corte sagital ou coronal mostrando anatomia exata (alvéolo, canal mandibular, nervo alveolar inferior, forame mentual, dente impactado), proporções científicas perfeitas, microanotações tipográficas elegantes.",
    "IMAGEM RADIOGRÁFICA OU TOMOGRÁFICA REALISTA (panorâmica, periapical ou TC de feixe cônico) de alta resolução, tons de cinza fiéis ao exame, com a estrutura do tema em destaque sutil e anotações clínicas mínimas.",
    "MACROFOTOGRAFIA CIRÚRGICA estilo National Geographic médico: close extremo de campo operatório real (sutura em mucosa, exodontia, biópsia, frenectomia), tecidos com cor e textura fiéis, iluminação dramática vinda de cima.",
  ];
  const conceito = conceitosCriativos[Math.floor(Math.random() * conceitosCriativos.length)];
  return themeLock(tema) + `IMAGEM EDUCACIONAL CIENTÍFICA para Liga Acadêmica de CTBMF — @lactbmf.anhanguerasbo (graduação em Odontologia).
- CONCEITO DESTA GERAÇÃO: ${conceito}
- ${formato}
- REALISMO ANATÔMICO OBRIGATÓRIO: todas as estruturas (dentes, ossos, nervos, mucosas, instrumentos) devem ser anatomicamente corretas e cientificamente verificáveis. PROIBIDO inventar estruturas, fantasiar anatomia, criar instrumentos inexistentes ou estilizar de forma infantil/cartoon.
- TEMA LITERAL "${tema}": represente a cena clínica exata — exodontia → fórceps + dente no alvéolo; anestesia → seringa carpule + ponto de punção anatômico; sutura → porta-agulhas + ponto em mucosa; frenectomia → freio labial/lingual + bisturi; biópsia → bisturi + tecido; alveoloplastia → lima/cinzel de osso; fratura mandibular → linha de fratura + fixação com placa de titânio.
- QUALIDADE TÉCNICA: renderização 8K ultra-detalhada (Octane Render / Unreal Engine 5 / Ray Tracing), texturas nítidas, equivalente a Canon EOS R5 + macro 100mm f/2.8 ISO 100.
- PALETA RIGOROSA: fundo dominante #2D2C32 grafite OU #000000 preto. Tipografia principal #FBFBFB off-white. Destaque/CTA #DD8E3C âmbar. Acentos ANHANGUERA permitidos apenas em pequenos detalhes (linha de fratura, seta de destaque, contorno do ponto de interesse): vermelho-Anhanguera #CE000C e laranja-Anhanguera #F05A22. Vermelho-alerta #D6403A apenas para alerta/dor. PROIBIDO qualquer outro hex — sem ciano, sem navy, sem azul, sem verde, sem roxo, sem rosa, sem branco puro #FFFFFF.
- TEXTO NA IMAGEM — REGRA CRÍTICA DE PORTUGUÊS BRASILEIRO (revisão dupla obrigatória):
  • Use APENAS palavras do seguinte vocabulário fechado, escritas EXATAMENTE assim (com acento e cedilha corretos): "ENQUETE", "VOCÊ SABIA?", "MITO OU VERDADE?", "CAIU NA PROVA", "DICA DE TÉCNICA", "ATENÇÃO ACADÊMICO", "RESPONDA", "ANATOMIA", "EXODONTIA", "ANESTESIA", "SUTURA", "FRENECTOMIA", "BIÓPSIA", "ALVEOLOPLASTIA", "NERVO ALVEOLAR INFERIOR", "FORAME MENTUAL", "CANAL MANDIBULAR", "FÓRCEPS", "BISTURI", "PORTA-AGULHAS", "CARPULE", "TERCEIRO MOLAR", "SISO", "MANDÍBULA", "MAXILA", "PERIAPICAL", "PANORÂMICA", "RADIOGRAFIA", "TOMOGRAFIA".
  • Máximo de 8 palavras no total na imagem inteira. Se for enquete: headline + opções "A)", "B)", "C)", "D)" seguidas de no máximo 2 palavras cada, todas do vocabulário acima.
  • PROIBIDO ABSOLUTO: inventar palavras, criar pseudo-latim, abreviar de forma estranha, juntar letras aleatórias, duplicar letras ("ANNATOMMIA"), trocar acentos, omitir cedilha, misturar inglês ("TOOTH", "SURGERY", "STUDY"), inserir símbolos decorativos no meio de palavras, criar palavras compostas inexistentes.
  • Antes de renderizar, revise CADA palavra duas vezes: (1) existe no Dicionário Houaiss brasileiro? (2) está com a acentuação e ortografia exatas? Se houver QUALQUER dúvida, REMOVA a palavra e deixe apenas o headline.
  • Tipografia bold sans-serif (Helvetica/Inter/Montserrat), kerning normal, letras nítidas e separadas, em #FBFBFB com destaque em #DD8E3C.
- LOGO: NÃO desenhe, redesenhe, parafraseie ou invente logos, marcas, escudos, brasões, monogramas ou siglas. APENAS reserve uma FAIXA INFERIOR CENTRAL LIMPA (largura total, ~14% da altura, sem texto, sem ilustração, sem moldura) — a logo REAL da LACTBMF será sobreposta pelo sistema, sem fundo, centralizada inferiormente.
- Iluminação editorial premium, hierarquia limpa, espaço negativo generoso na cor de fundo, sem ruído visual.
- PROIBIDO: rostos reconhecíveis de pessoas reais, watermark de IA, anatomia errada, mãos com dedos a mais, texto em inglês, palavras inventadas, palavras duplicadas, letras embaralhadas, caracteres tipográficos estranhos, glifos decorativos no meio de palavras, CTA comercial ("agende", "promoção", "desconto"), WhatsApp, visual de banco de imagens, clipart, flat design infantil, gradientes arco-íris, paleta fora do especificado.${slideInfo}
- Variação obrigatória (seed ${Math.random().toString(36).slice(2, 10)}): ângulo, enquadramento e composição inéditos em relação aos posts anteriores.`;
}


// =============================================================================
// PLANNER CHICO — conta @drfranciscomenezes
// Identidade visual exclusiva: Azul Marinho #1B2E40 + Branco + Azul Ciano #3BB5E8
// Tom empático, educativo, próximo. Nunca comercial. CTA "Link na bio para dúvidas
// e agendamento pelo WhatsApp". Atendimento: SP, Santa Bárbara d'Oeste, Americana.
// =============================================================================
const CHICO_NAVY = "#1B2E40";
const CHICO_CIANO = "#3BB5E8";
const CHICO_CIDADES = "São Paulo, Santa Bárbara d'Oeste e Americana";
const CHICO_CTA = `Dúvidas? Link na bio para contato e agendamento pelo WhatsApp.`;

function chicoCaptionSystem(formato: "Carrossel" | "Story" | "Post Único") {
  return `Você é copywriter médico do consultório do Dr. Francisco Menezes — Cirurgião Bucomaxilofacial. Atendimento em ${CHICO_CIDADES}.

PRINCÍPIO NORTEADOR: cada publicação deve fazer o leitor sentir que finalmente encontrou quem entende o problema dele — e que existe solução. NUNCA vender diretamente; sempre educar, gerar identificação e construir confiança. O link na bio faz o resto.

TOM: empático, educativo, próximo, humano. Linguagem leiga acessível, sem jargão (quando inevitável, traduzir entre parênteses). Comece SEMPRE pela DOR/queixa real ou pela pergunta de identificação ("Você sente...", "Já acordou com...", "Aquela dor que aparece do nada...").

ESTRUTURA OBRIGATÓRIA (Instagram ${formato}):
1. HEADLINE de identificação na 1ª linha (gancho emocional, pergunta ou frase-síntese).
2. Corpo educativo em 3-5 frases curtas: o que é o sintoma/condição, por que acontece, por que merece avaliação especializada.
3. Frase de acolhimento ("Se você se identificou...", "Não ignore o que o seu corpo está dizendo...").
4. CTA padrão exato: "${CHICO_CTA}"
5. Frase de localização: "Atendo em ${CHICO_CIDADES}."
6. 5-7 hashtags ao final, sempre incluindo #drfranciscomenezes #bucomaxilofacial + 3-5 do tema específico (#dentedosiso, #cirurgiaortognática, #ATM, #traumafacial, #patologiaoral, etc.).

REGRAS DE FORMATO:
- 500-900 caracteres no total (Story: 150-250).
- Parágrafos de 1-2 linhas com quebras generosas.
- 1-2 emojis sutis no máximo (ou nenhum). Sem emojis comerciais.
- PT-BR Brasil impecável, com acentuação completa e grafia exata "Santa Bárbara d'Oeste".

PROIBIDO ABSOLUTO: "agende sua consulta", "agende sua avaliação", "marque consulta", "promoção", "oferta", "desconto", "últimas vagas", linguagem comercial, urgência artificial, diagnóstico afirmativo ("você tem DTM").
NÃO inclua a assinatura no corpo — aparece como overlay na imagem.

REGRA DE PORTUGUÊS (revisão dupla obrigatória, não-negociável): texto 100% em Português do Brasil (pt-BR) com acentuação completa (á é í ó ú â ê ô ã õ à), cedilha (ç) e crase corretas. PROIBIDO: palavras em inglês/espanhol/pseudo-latim, palavras inventadas, palavras duplicadas ("dor dor"), letras embaralhadas, abreviações não-padrão, ortografia errada. Termos técnicos sempre exatos: "bucomaxilofacial", "exodontia", "siso", "terceiro molar", "ATM", "DTM", "bruxismo", "ortognática", "mandíbula", "maxila", "anestesia", "sutura", "trauma facial". Releia palavra por palavra duas vezes antes de devolver; em caso de QUALQUER dúvida, troque por sinônimo simples e correto. NÃO MISTURE ASSUNTOS: o post inteiro é sobre UM único tema — proibido citar outras patologias ou procedimentos não relacionados ao tema.`;
}

function chicoImagePrompt(tema: string, slide?: { n: number; total: number; papel: string }, isStory = false) {
  const isUltimo = !!slide && slide.n === slide.total;
  const formato = slide
    ? `FORMATO vertical 4:5 (1024x1280) — Instagram Feed/Carrossel.`
    : isStory
      ? `FORMATO vertical 9:16 (1024x1820) — Instagram Stories.`
      : `FORMATO vertical 4:5 (1024x1280) — Instagram Feed.`;
  const slideInfo = slide
    ? `\n- SLIDE ${slide.n}/${slide.total} de carrossel. Papel: ${slide.papel}.${isUltimo ? " SLIDE DE FECHAMENTO: capricho máximo, hierarquia limpa." : ""}`
    : "";
  const ctaForte = (isUltimo || !slide)
    ? `\n- CTA OBRIGATÓRIO no rodapé: tipografia bold em ${CHICO_CIANO} "LINK NA BIO" + ícone oficial do WHATSAPP (balão verde #25D366 com fone branco, flat oficial) discreto. Sem números de telefone, sem URLs longas.`
    : "";
  return themeLock(tema) + `IMAGEM PREMIUM para o Instagram @drfranciscomenezes — Cirurgião Bucomaxilofacial.
- ${formato}
- TEMA LITERAL "${tema}": represente a cena/sintoma de forma reconhecível (siso → região posterior; ATM → mão pré-auricular; trauma → cena clínica plausível; patologia → close de mucosa saudável; ortognática → perfil facial elegante).
- ESTILO: fotografia editorial sóbria OU ilustração anatômica realista limpa (estilo Netter contemporâneo). Sem clipart, sem flat design infantil, sem cartoon, sem banco de imagens.
- PALETA RIGOROSA — APENAS estas 3 cores (descumprir = rejeitado):
  • FUNDO DOMINANTE: AZUL MARINHO ESCURO ${CHICO_NAVY} (cobertura ~70-85% da composição, podendo ter leve gradiente sutil).
  • TEXTO PRINCIPAL: BRANCO #FFFFFF puro.
  • DESTAQUES, LINHAS, ÍCONES, NÚMERO/HEADLINE-CHAVE: AZUL CIANO ${CHICO_CIANO}.
  PROIBIDO: qualquer outro hex (sem verde, sem amarelo, sem laranja, sem roxo, sem rosa, sem vermelho — exceto micro-acento de dor se essencial). Sem fundo branco. Sem fundo preto.
- TIPOGRAFIA: sans-serif moderna bold (Montserrat / Inter). Headline curto de 3-8 palavras em PT-BR impecável ("DOR NO SISO?", "ATM TRAVADA AO ACORDAR", "FERIDA QUE NÃO CICATRIZA"). Headline em branco com 1 palavra-chave em ciano ${CHICO_CIANO}. Sem parágrafos, sem listas longas, sem números fictícios.
- COMPOSIÇÃO: limpa, hierarquia clara, muito espaço negativo navy, linhas finas em ciano como elementos gráficos (separadores, ícones, silhuetas de perfil facial).
- ROSTOS: se houver pessoa, expressão de ALÍVIO/CONFIANÇA (nunca dor exposta, nunca cena invasiva, nunca procedimento real). Plano fechado, foco em emoção. Sem rostos reconhecíveis de pessoas reais.
- LOGO DA CLÍNICA: NÃO desenhe, NÃO redesenhe, NÃO invente nenhum logo, monograma, escudo ou marca. Apenas RESERVE o CANTO INFERIOR DIREITO limpo (área ~12% da largura, sem texto, sem ilustração) — o sistema sobrepõe a logo real depois.${ctaForte}${slideInfo}
- PROIBIDO: imagens de procedimentos invasivos, sangue, bisturi cortando, anatomia interna exposta de forma agressiva, watermark de IA, mãos deformadas, dedos a mais, texto em inglês, palavras duplicadas, hashtags na imagem, números de telefone, URLs, CTAs comerciais ("agende", "promoção", "desconto").
- Iluminação editorial premium estilo capa de revista de saúde sofisticada (Harvard Health / Mayo Clinic), atmosfera arejada e luminosa, qualidade 8K.
- Variação única (seed ${Math.random().toString(36).slice(2, 10)}): ângulo e composição inéditos.`;
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
          : "Post Único");

    // 0. Se nenhum tema foi fornecido, a IA escolhe um automaticamente
    //    EVITANDO temas dos últimos 60 dias (máxima abrangência editorial).
    let tema = (data.tema ?? "").trim();
    // Modo Estudantes: lista fixa de temas didáticos de cirurgia bucal básica.
    if (!tema && data.audiencia === "estudantes-graduacao") {
      const temasAluno = [
        "Enquete: qual a técnica anestésica correta para exodontia do dente 38",
        "Dica de técnica: passo a passo da sutura simples em mucosa oral",
        "Você sabia que o nervo alveolar inferior corre dentro do canal mandibular",
        "Mito ou verdade: tomar antibiótico antes de toda exodontia é obrigatório",
        "Curiosidade anatômica sobre o forame mentual e o nervo mentoniano",
        "Caiu na prova: indicações clínicas da alveoloplastia após exodontia",
        "Dica de técnica: como posicionar o fórceps para extração de molar inferior",
        "Enquete: qual sutura usar em ferida cirúrgica intraoral de mucosa",
        "Mito ou verdade: deixar coágulo na boca após exodontia é prejudicial",
        "Curiosidade: por que o siso incluso é o dente mais extraído do mundo",
        "Dica clínica: como reconhecer e tratar a alveolite seca pós-exodontia",
        "Você sabia que a frenectomia lingual pode ser indicada já no bebê",
        "Enquete: qual a profundidade ideal da agulha no bloqueio do nervo alveolar inferior",
        "Caiu na prova: principais complicações da exodontia de terceiros molares",
        "Curiosidade histórica sobre a evolução do fórceps odontológico",
      ];
      tema = temasAluno[Math.floor(Math.random() * temasAluno.length)];
    }
    if (!tema) {
      const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: historico } = await supabaseAdmin
        .from("posts")
        .select("prompt_ia")
        .gte("created_at", desde)
        .not("prompt_ia", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      const temasUsados = Array.from(
        new Set((historico ?? []).map((p: any) => (p.prompt_ia || "").trim()).filter(Boolean))
      ).slice(0, 150);
      const usadosNorm = new Set(temasUsados.map(norm));

      const escolher = async (tentativa: number) => {
        const blocoEvitar = temasUsados.length
          ? `\n\nTEMAS JÁ PUBLICADOS NOS ÚLTIMOS 90 DIAS — É TERMINANTEMENTE PROIBIDO REPETIR, PARAFRASEAR OU TANGENCIAR QUALQUER UM DELES:\n${temasUsados.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
          : "";
        const { text } = await generateText({
          model,
          system: `Você é estrategista editorial de ${ASSINATURA}, cirurgião bucomaxilofacial e odontologista hospitalar. Sua missão é MAXIMIZAR ABRANGÊNCIA TEMÁTICA — JAMAIS repetir assunto.`,
          prompt: `Escolha 1 TEMA 100% INÉDITO de post para a rede ${data.rede} (formato ${formato}) dentro da especialidade "${data.especialidade}".${tentativa > 0 ? " TENTATIVA " + (tentativa + 1) + ": o tema anterior foi rejeitado por similaridade — escolha um SUBTÓPICO COMPLETAMENTE DIFERENTE." : ""}

PRIORIZE ASSUNTOS DE ALTO VOLUME DE BUSCA NO GOOGLE BRASIL sobre CTBMF + Odontologia Hospitalar: dor no siso, estalo na ATM, bruxismo, apneia do sono, ronco, mandíbula travada, cirurgia ortognática, trauma facial, infecção odontogênica, dor de ouvido por DTM, implante em fumante, câncer de boca, mucocele, freio lingual em bebê, anestesia geral em odontologia, siso incluso, fratura de mandíbula, pós-operatório de siso, tratamento de DTM, MRONJ por bisfosfonato, higiene bucal na UTI (VAP). Varie o grupo de dor a cada chamada.

REGRAS OBRIGATÓRIAS DE REDAÇÃO (descumprir = rejeitado):
1. Português do Brasil impecável, gramática e ortografia corretas, com acentuação completa.
2. UMA frase declarativa COMPLETA, com sujeito + verbo + complemento, fazendo sentido sozinha (NÃO é título de matéria, NÃO é lista de palavras-chave, NÃO é fragmento).
3. Entre 8 e 16 palavras. Tom claro, humano, específico, sem jargão técnico opaco e sem palavras soltas separadas por vírgula.
4. PROIBIDO: aspas, prefixos como "Tema:", emojis, hashtags, dois-pontos no início, abreviações estranhas, repetir palavras, misturar dois assuntos, frase truncada.
5. Exemplos de forma CORRETA: "Por que o siso incluso causa dor que irradia até o ouvido"; "Como o bruxismo noturno desgasta os dentes e estala a ATM"; "Quando a apneia do sono exige avaliação do cirurgião bucomaxilofacial".

Tema deve descrever uma DOR ou SITUAÇÃO REAL do paciente, com potencial de conversão e busca orgânica.${blocoEvitar}

Responda APENAS com a frase do tema, nada mais.`,
        });
        return text.trim().replace(/^["'`]+|["'`]+$/g, "").split("\n")[0];
      };

      for (let i = 0; i < 3; i++) {
        const candidato = await escolher(i);
        if (!candidato) continue;
        const cn = norm(candidato);
        const palavras = candidato.split(/\s+/).filter(Boolean);
        const formaInvalida =
          palavras.length < 8 ||
          palavras.length > 18 ||
          /[:;]\s*$/.test(candidato) ||
          /^(tema|assunto|título|titulo)\s*[:\-]/i.test(candidato) ||
          (candidato.match(/,/g)?.length ?? 0) >= 3; // lista de keywords
        const colide = usadosNorm.has(cn) || Array.from(usadosNorm).some((u) => {
          const a = new Set(cn.split(" ").filter((w) => w.length >= 4));
          const b = new Set(u.split(" ").filter((w) => w.length >= 4));
          let inter = 0; a.forEach((w) => { if (b.has(w)) inter++; });
          return inter >= 3;
        });
        tema = candidato;
        if (!colide && !formaInvalida) break;
      }
      if (!tema) throw new Error("IA não conseguiu escolher um tema.");
    }


    // 1. Resolve nível editorial
    const nivel = resolveNivel(data.nivel, data.rede, data.tipo);
    const isStory = formato === "Story";

    // 2. Dispara legenda + imagens EM PARALELO (não dependem entre si).
    const isEstudantes = data.audiencia === "estudantes-graduacao";
    const isChico = data.audiencia === "chico-drfm";
    const captionSys = isEstudantes
      ? studentCaptionSystem()
      : isChico
        ? chicoCaptionSystem(formato)
        : captionSystem(data.rede, data.especialidade, nivel);
    const legendaPromise = generateText({
      model,
      system: captionSys,
      prompt: isStory
        ? `Crie um TEXTO DE STORY (até 220 caracteres, 1-2 emojis, sem hashtags, CTA "Link na Bio") que CHAME ATENÇÃO para o post do FEED de hoje sobre: "${tema}". O story deve provocar curiosidade e mandar o usuário para o feed.`
        : `Crie a legenda completa para o post sobre: "${tema}".`,
    }).then((r) => r.text);

    // Tamanho ideal por plataforma (gateway suporta 1024x1024, 1024x1536, 1536x1024):
    // - IG Feed/Carrossel: vertical 4:5  → 1024x1536
    // - IG Stories: vertical 9:16        → 1024x1536
    // - LinkedIn: horizontal 1.91:1      → 1536x1024
    // - Google Business: horizontal 4:3  → 1536x1024
    // - Estilo X (tweet): horizontal 16:9 → 1536x1024
    const size: "1024x1024" | "1024x1536" | "1536x1024" =
      data.rede === "linkedin" || data.rede === "google" || data.rede === "estilo-x"
        ? "1536x1024"
        : isStory || formato === "Carrossel" || formato === "Post Único"
          ? "1024x1536"
          : "1024x1024";

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

    const { ensureJpegB64, overlayAlunoLogos, overlayLogo } = await import("@/lib/logo-overlay.server");
    // Modo Liga: passa as 2 logos como REFERÊNCIA VISUAL para o modelo amostrar
    // literalmente as cores reais delas (em vez de descrever hex).
    const logoRefs: string[] = [];
    if (isEstudantes) {
      const origin = process.env.PUBLIC_ORIGIN || "https://insta-planner-ai.lovable.app";
      const a1 = (await import("@/assets/logo-aluno-1.png.asset.json")).default;
      const a2 = (await import("@/assets/logo-aluno-2.png.asset.json")).default;
      logoRefs.push(`${origin}${a1.url}`, `${origin}${a2.url}`);
    }
    const generateImageWithRetry = async (prompt: string, attempt = 1): Promise<string> => {
      try {
        return await generateImageBase64({ apiKey: key, prompt, size, model: data.modeloImagem, referenceImageUrls: logoRefs.length ? logoRefs : undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable = /queue|quee|full|rate|429|503|tempor/i.test(message);
        if (!retryable || attempt >= 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        return generateImageWithRetry(prompt, attempt + 1);
      }
    };
    const applyOverlay = async (b64: string) => {
      if (isEstudantes) return overlayAlunoLogos(b64);
      if (isChico) return overlayLogo(b64, undefined, 10, { withLogo: true, position: "bottom-right", smart: true });
      return b64;
    };
    const genAndUpload = (prompt: string) =>
      generateImageWithRetry(prompt)
        .then((b64) => ensureJpegB64(b64))
        .then(applyOverlay)
        .then(uploadOne);

    let urlImagem: string;
    let imagensCarrossel: string[] = [];
    let urlImagemCache: string | null = null;
    let imagensCarrosselCache: string[] = [];

    if (formato === "Carrossel") {
      const fullSpec = [
        { n: 1, total: 5, papel: "CAPA: GANCHO forte de conversão (pergunta/dor real) + rodapé textual obrigatório. Layout impactante de revista. SEM bibliografia." },
        { n: 2, total: 5, papel: "PROBLEMA: aprofunda a dor em linguagem leiga, faz a pessoa se identificar. SEM anatomia clínica interna." },
        { n: 3, total: 5, papel: "MECANISMO: explica COMO o problema acontece com analogia visual simples. Reforço de autoridade hospitalar." },
        { n: 4, total: 5, papel: "SOLUÇÃO/GANHO: como o cirurgião resolve. Foco no GANHO CONCRETO do paciente (dormir bem, mastigar sem dor, voltar a sorrir, respirar melhor)." },
        { n: 5, total: 5, papel: "FECHAMENTO PREMIUM com CTA FORTE: tipografia grande 'LINK NA BIO' centralizada + ÍCONE oficial do WHATSAPP (balão verde #25D366 com fone branco, estilo flat oficial, canto inferior direito) + número '+55 11 94768-4004' em tipografia pequena ao lado do ícone. Hierarquia editorial impecável estilo capa de revista médica top de linha. É o slide mais bonito do carrossel." },
      ];
      const xSpec = [
        { n: 1, total: 3, papel: "TWEET 1: gancho/pergunta forte com assinatura." },
        { n: 2, total: 3, papel: "TWEET 2: explicação científica curta." },
        { n: 3, total: 3, papel: "TWEET 3: CTA WhatsApp/Link na Bio + assinatura." },
      ];
      const slidesSpec = data.rede === "estilo-x" ? xSpec : fullSpec;
      // Gera TODAS as imagens em paralelo (3-5x mais rápido que lotes sequenciais).
      const uploads = await Promise.all(
        slidesSpec.map((s) => genAndUpload(
          isEstudantes
            ? studentImagePrompt(tema, s)
            : isChico
              ? chicoImagePrompt(tema, s)
              : imageSystemPrompt(tema, data.rede, nivel, s)
        ))
      );
      urlImagem = uploads[0].publicUrl;
      urlImagemCache = uploads[0].signedUrl;
      imagensCarrossel = uploads.map((u) => u.publicUrl);
      imagensCarrosselCache = uploads.map((u) => u.signedUrl);
    } else {
      const upload = await genAndUpload(
        isEstudantes
          ? studentImagePrompt(tema)
          : isChico
            ? chicoImagePrompt(tema, undefined, isStory)
            : imageSystemPrompt(tema, data.rede, nivel)
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
        estilo_layout: data.rede === "estilo-x" ? "Estilo X" : data.rede === "google" ? "Google Business" : "Padrão",
        formato_midia: formato === "Story" ? "Story" : "Imagem",
        legenda,
        url_imagem: urlImagem,
        url_imagem_cache: urlImagemCache,
        url_imagem_cache_expires_at: urlImagemCache ? new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString() : null,
        imagens_carrossel: imagensCarrossel,
        imagens_carrossel_cache: imagensCarrosselCache,
        imagens_carrossel_cache_expires_at: imagensCarrosselCache.length ? new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString() : null,
        postar_instagram: data.rede === "google" ? false : (data.ambasRedes || data.rede !== "linkedin"),
        postar_linkedin: data.rede === "google" ? false : (data.ambasRedes || data.rede === "linkedin"),
        postar_google: data.rede === "google",
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
  .middleware([])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      acao: z.enum(["arquivar", "agendar", "publicar"]).default("arquivar"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.acao === "publicar") {
      // Lê post para descobrir destinos.
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("user_id,postar_instagram,postar_linkedin")
        .eq("id", data.id)
        .maybeSingle();
      const publishUserId = (post as any)?.user_id || TEMP_USER_ID;

      const results: any = { ok: true, status: "Publicado" };
      const warnings: string[] = [];

      if (post?.postar_linkedin) {
        try {
          const { publishLinkedInPostById } = await import("@/lib/social/linkedin-publish.server");
          const r = await publishLinkedInPostById({ supabaseAdmin, postId: data.id, userId: publishUserId });
          results.linkedin = r;
        } catch (err: any) {
          warnings.push(`LinkedIn: ${err?.message || err}`);
        }
      }

      if (post?.postar_instagram) {
        try {
          const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");
          const r = await publishInstagramPostById({ supabaseAdmin, postId: data.id, userId: publishUserId });
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
        await supabaseAdmin.from("posts").update({ status: "Agendado", user_id: publishUserId }).eq("id", data.id);
        results.status = "Agendado";
      } else {
        const nextStatus = results.instagram?.status === "EnviadoMake" ? "EnviadoMake" : "Publicado";
        await supabaseAdmin.from("posts").update({ status: nextStatus, user_id: publishUserId }).eq("id", data.id);
        results.status = nextStatus;
      }

      if (warnings.length) {
        results.warning = warnings.join(" | ");
        if (!results.linkedin && !results.instagram) throw new Error(results.warning);
      }
      return results;
    }
    const status = data.acao === "agendar" ? "Agendado" : "Rascunho";
    const patch: any = { status };
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
