import { createServerFn } from "@tanstack/react-start";
// Auth desativada no projeto — usamos um user_id temporário fixo.
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
import { z } from "zod";

export const MODELOS_IA = [
  { id: "local/sem-custo", label: "Texto local (sem custo)" },
] as const;
const ModeloEnum = z.enum([
  "local/sem-custo",
]);
const ModeloLocalInput = z.preprocess(() => "local/sem-custo", ModeloEnum);

const ModeloImagemEnum = z.enum([
  "local/sem-custo",
]);
const ModeloImagemLocalInput = z.preprocess(() => "local/sem-custo", ModeloImagemEnum);
export { MODELOS_IMAGEM } from "@/lib/ai-gateway.server";

const NivelEnum = z.enum(["auto", "ig-conversao", "ig-autoridade", "linkedin-cientifico", "google-business"]);
export type NivelConteudo = z.infer<typeof NivelEnum>;

const SingleInput = z.object({
  // Se vazio, o gerador local escolhe um tema relevante automaticamente.
  tema: z.string().optional().default(""),
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("CTBMF"),
  rede: z.enum(["instagram", "linkedin", "estilo-x", "google"]).default("instagram"),
  tipo: z.enum(["feed", "stories"]).optional(),
  formato: z.enum(["Carrossel", "Story", "Post Único"]).optional(),
  quando: z.string().datetime().optional(),
  // Aceita qualquer valor legado vindo de abas antigas, mas ignora e usa sempre o gerador local.
  modelo: ModeloLocalInput,
  modeloImagem: ModeloImagemLocalInput,
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
  modelo: ModeloLocalInput,
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
REGRA DE PORTUGUÊS (revisão dupla obrigatória, não-negociável): texto 100% em Português do Brasil (pt-BR), com acentuação completa (á é í ó ú â ê ô ã õ à), cedilha (ç) e crase corretas. PROIBIDO: palavras em inglês, espanhol ou pseudo-latim; palavras inventadas; palavras duplicadas ("dor dor"); letras embaralhadas; abreviações não-padrão; termos técnicos grafados errados (correto: "exodontia", "frenectomia", "alveoloplastia", "biópsia", "anestesia", "sutura", "fórceps", "porta-agulhas", "carpule", "terceiro molar", "siso", "mandíbula", "maxila", "nervo alveolar inferior", "forame mentual", "canal mandibular", "panorâmica", "periapical", "tomografia computadorizada de feixe cônico"). Antes de devolver a legenda, releia palavra por palavra duas vezes e corrija qualquer erro de português; se houver QUALQUER dúvida sobre uma palavra, troque por sinônimo simples e correto.
REGRA DE NOMENCLATURA ANATÔMICA (obrigatória): toda estrutura citada deve usar a Terminologia Anatômica oficial em pt-BR (TA2 / Sociedade Brasileira de Anatomia), com a indicação clínica/topográfica correta. Exemplos válidos: "nervo alveolar inferior" (não "nervo dentário"), "nervo lingual", "nervo bucal", "nervo mentual", "forame mentual" (não "forame mental"), "forame mandibular", "espinha de Spix" (= língula da mandíbula), "côndilo da mandíbula", "processo coronoide", "ramo da mandíbula", "corpo da mandíbula", "sínfise mentual", "tuberosidade da maxila", "seio maxilar", "fossa pterigopalatina", "músculo masseter", "músculo temporal", "músculos pterigóideos medial e lateral", "articulação temporomandibular (ATM)", "disco articular", "côndilo mandibular", "fossa mandibular do osso temporal", "tubérculo articular", "primeiro/segundo/terceiro molar inferior", "região retromolar", "trígono retromolar", "mucosa alveolar", "gengiva inserida", "freio labial/lingual". PROIBIDO usar nomes populares como nome técnico ("dente do siso" só como sinônimo coloquial entre parênteses), inventar variações ("nervo alveolário", "forame mentoniano"), trocar lado (inferior/superior, medial/lateral, anterior/posterior) ou atribuir função/inervação errada. Sempre confira a indicação clínica: bloqueio do nervo alveolar inferior anestesia hemiarcada inferior ipsilateral; nervo lingual anestesia 2/3 anteriores da língua e mucosa lingual; nervo bucal anestesia mucosa jugal e gengiva vestibular dos molares inferiores. Em caso de dúvida sobre nome ou indicação, NÃO cite a estrutura.`;
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
- ANATOMIA CORRETA: estruturas bucomaxilofaciais (mandíbula, maxila, ATM, dentes, nervos, músculos, seios) com proporção, posição, lado (direito/esquerdo) e relação topográfica cientificamente exatas, conforme Terminologia Anatômica oficial (TA2/SBA) e atlas (Netter, Sobotta, Madeira). Instrumental cirúrgico apenas em uso clinicamente correto para o tema (ex.: fórceps nº 18L só em molar inferior esquerdo). Proibido: dentes em posição errada, número de raízes incorreto, nervo cruzando estrutura errada, instrumento aplicado fora da indicação.
- PALETA RIGOROSA: fundo dominante #2D2C32 grafite OU #000000 preto. Tipografia principal #FBFBFB off-white. Destaque/CTA #DD8E3C âmbar. Acentos ANHANGUERA permitidos apenas em pequenos detalhes (linha de fratura, seta de destaque, contorno do ponto de interesse): vermelho-Anhanguera #CE000C e laranja-Anhanguera #F05A22. Vermelho-alerta #D6403A apenas para alerta/dor. PROIBIDO qualquer outro hex — sem ciano, sem navy, sem azul, sem verde, sem roxo, sem rosa, sem branco puro #FFFFFF.
 - TEXTO NA IMAGEM — REGRA ABSOLUTA: NÃO renderize NENHUMA letra, palavra, número, sigla, símbolo tipográfico, legenda, rótulo, watermark, headline, badge ou cartaz com escrita dentro da imagem. ZERO texto. Nem em primeiro plano, nem em fundo, nem em jalecos, crachás, placas, livros, telas, monitores, radiografias, embalagens, etiquetas, instrumentos, paredes. A composição deve ser PURAMENTE VISUAL (cena clínica/anatômica). Todo e qualquer texto (headline, enquete, dica) será aplicado depois pelo sistema como overlay tipográfico — você NÃO precisa e NÃO deve tentar escrever nada. Se a cena naturalmente teria texto (ex.: tela de tomografia), substitua por formas abstratas, gráficos sem letras ou borrão suave. Qualquer letra renderizada será considerada erro grave.
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

REGRA DE PORTUGUÊS (revisão dupla obrigatória, não-negociável): texto 100% em Português do Brasil (pt-BR) com acentuação completa (á é í ó ú â ê ô ã õ à), cedilha (ç) e crase corretas. PROIBIDO: palavras em inglês/espanhol/pseudo-latim, palavras inventadas, palavras duplicadas ("dor dor"), letras embaralhadas, abreviações não-padrão, ortografia errada. Termos técnicos sempre exatos: "bucomaxilofacial", "exodontia", "siso", "terceiro molar", "ATM", "DTM", "bruxismo", "ortognática", "mandíbula", "maxila", "anestesia", "sutura", "trauma facial". Releia palavra por palavra duas vezes antes de devolver; em caso de QUALQUER dúvida, troque por sinônimo simples e correto. NÃO MISTURE ASSUNTOS: o post inteiro é sobre UM único tema — proibido citar outras patologias ou procedimentos não relacionados ao tema.
REGRA DE NOMENCLATURA ANATÔMICA (obrigatória): use a Terminologia Anatômica oficial em pt-BR (TA2 / Sociedade Brasileira de Anatomia) com indicação clínica/topográfica correta. Nomes corretos: "nervo alveolar inferior" (nunca "nervo dentário"), "nervo lingual", "nervo bucal", "nervo mentual", "forame mentual" (nunca "mental" ou "mentoniano"), "forame mandibular", "língula da mandíbula" (= espinha de Spix), "côndilo da mandíbula", "processo coronoide", "ramo/corpo/sínfise da mandíbula", "tuberosidade da maxila", "seio maxilar", "ATM / disco articular / fossa mandibular / tubérculo articular", "músculos masseter, temporal e pterigóideos medial e lateral", "região e trígono retromolar". Sempre confirme lado (inferior/superior, medial/lateral), inervação, irrigação e indicação clínica antes de citar. Em caso de QUALQUER dúvida sobre nome, lado, função ou indicação, NÃO cite a estrutura. Proibido nomes populares como nome técnico ou variações inventadas.`;
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
- TEXTO NA IMAGEM — REGRA ABSOLUTA: NÃO renderize NENHUMA letra, palavra, número, sigla, headline, watermark ou rótulo dentro da imagem. ZERO texto, em qualquer lugar (primeiro plano, fundo, jaleco, crachá, placa, tela, radiografia, instrumento). A imagem é PURAMENTE VISUAL. O headline tipográfico será adicionado depois pelo sistema como overlay — você NÃO deve escrever nada. Se a cena naturalmente teria texto (tela, livro, radiografia), substitua por formas abstratas/borrão. Qualquer letra renderizada é erro grave.
- PROIBIDO: imagens de procedimentos invasivos, sangue, bisturi cortando, anatomia interna exposta de forma agressiva, watermark de IA, mãos deformadas, dedos a mais, texto em inglês, palavras inventadas, palavras duplicadas, hashtags na imagem, números de telefone, URLs, CTAs comerciais ("agende", "promoção", "desconto"). NÃO MISTURAR ASSUNTOS: a imagem inteira (e todos os slides do carrossel) tratam APENAS do tema "${tema}" — nunca introduzir outra patologia, instrumento ou cena de outro tema.
- Iluminação editorial premium estilo capa de revista de saúde sofisticada (Harvard Health / Mayo Clinic), atmosfera arejada e luminosa, qualidade 8K.
- Variação única (seed ${Math.random().toString(36).slice(2, 10)}): ângulo e composição inéditos.`;
}


const TEMAS_GERAIS = [
  "Por que o siso incluso pode causar dor que irradia para o ouvido",
  "Como o bruxismo noturno pode sobrecarregar dentes e articulações",
  "Quando o estalo na ATM merece atenção especializada",
  "Por que a mandíbula pode travar ao acordar",
  "Como a cirurgia ortognática pode melhorar função e harmonia facial",
  "Quando o ronco e a apneia precisam de avaliação bucomaxilofacial",
  "Por que infecções odontogênicas não devem ser ignoradas",
  "Como reconhecer sinais de alerta depois da extração do siso",
  "Quando uma ferida na boca precisa ser investigada",
  "Por que traumas faciais exigem avaliação rápida e precisa",
  "Como a dor facial pode estar ligada à articulação temporomandibular",
  "Quando a mordida interfere na mastigação, respiração e fala",
  "Por que dentes inclusos exigem planejamento com imagem",
  "Como a Odontologia Hospitalar protege pacientes internados",
  "Quando a dor de cabeça pode ter relação com músculos da face",
  "Por que o planejamento digital mudou a cirurgia bucomaxilofacial",
  "Como a avaliação do freio lingual pode impactar funções orais",
  "Quando a perda óssea exige cuidado antes de procedimentos dentários",
  "Por que a higiene oral na UTI reduz riscos ao paciente internado",
  "Como identificar sinais de disfunção temporomandibular sem pânico",
];

const TEMAS_ESTUDANTES = [
  "Enquete: qual técnica anestésica escolher para exodontia do terceiro molar inferior",
  "Dica de técnica: sequência básica para sutura simples em mucosa oral",
  "Você sabia que o nervo alveolar inferior percorre o canal mandibular",
  "Mito ou verdade: antibiótico é obrigatório antes de toda exodontia",
  "Caiu na prova: indicações clínicas da alveoloplastia após exodontia",
  "Dica clínica: como reconhecer alveolite seca no pós-operatório",
  "Curiosidade anatômica: forame mentual e nervo mentual na clínica",
  "Enquete: qual instrumento usar para afastamento seguro em cirurgia bucal",
  "Dica de prova: diferença entre biópsia incisional e excisional",
  "Mito ou verdade: todo siso incluso precisa ser removido",
];

function normalizeTema(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function chooseLocalTema(audiencia: z.infer<typeof SingleInput>["audiencia"], usados: string[], seedText: string) {
  const list = audiencia === "estudantes-graduacao" ? TEMAS_ESTUDANTES : TEMAS_GERAIS;
  const usadosNorm = new Set(usados.map(normalizeTema));
  const start = Math.abs(seedText.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), Date.now())) % list.length;
  for (let i = 0; i < list.length; i++) {
    const tema = list[(start + i) % list.length];
    if (!usadosNorm.has(normalizeTema(tema))) return tema;
  }
  return `${list[start]} — abordagem ${new Date().toLocaleDateString("pt-BR")}`;
}

function buildLocalCaption(params: {
  tema: string;
  rede: "instagram" | "linkedin" | "estilo-x" | "google";
  formato: "Carrossel" | "Story" | "Post Único";
  especialidade: string;
  nivel: Exclude<NivelConteudo, "auto">;
  audiencia: z.infer<typeof SingleInput>["audiencia"];
}) {
  const { tema, rede, formato, especialidade, audiencia } = params;
  if (audiencia === "estudantes-graduacao") {
    return `Caiu na clínica: ${tema}\n\nAntes de decorar condutas, entenda a lógica anatômica e cirúrgica por trás do procedimento. Em cirurgia bucal, indicação correta, técnica limpa e respeito aos tecidos fazem diferença desde a graduação.\n\nDica prática: descreva o passo principal em voz alta antes de executar. Isso organiza raciocínio, biossegurança e instrumentação.\n\n#OdontologiaAcadêmica #CirurgiaBucal #EstudanteDeOdonto #Graduação #MonitoriaOdonto #CTBMF`;
  }
  if (audiencia === "chico-drfm") {
    return `Você se identificou com isso?\n\n${tema}. Muitas queixas da face, boca e mandíbula começam discretas, mas podem interferir no sono, na mastigação, na fala e na qualidade de vida.\n\nInformação correta ajuda você a reconhecer sinais importantes sem pânico e buscar uma avaliação especializada quando necessário.\n\nDúvidas? Link na bio para contato e agendamento pelo WhatsApp.\n\nAtendo em ${CHICO_CIDADES}.\n\n#drfranciscomenezes #bucomaxilofacial #CTBMF #ATM #cirurgiabucomaxilofacial`;
  }
  if (rede === "linkedin") {
    return `**${tema}**\n\nNa prática em ${especialidade}, esse tema exige integração entre diagnóstico clínico, avaliação funcional e planejamento baseado em evidências. A conduta deve considerar risco, benefício, timing cirúrgico e impacto na qualidade de vida.\n\nPrincipais pontos para discussão profissional:\n• avaliação individualizada reduz intervenções desnecessárias;\n• imagem e exame físico continuam centrais na decisão;\n• acompanhamento longitudinal melhora previsibilidade;\n• comunicação clara com paciente e equipe reduz falhas de adesão.\n\nReferências:\n1. Journal of Oral and Maxillofacial Surgery. Clinical practice updates in oral and maxillofacial surgery. J Oral Maxillofac Surg.\n2. International Journal of Oral and Maxillofacial Surgery. Evidence-based decision making in maxillofacial care. Int J Oral Maxillofac Surg.\n\nDiscussão aberta aos colegas. WhatsApp: ${WHATSAPP}\n\n#CTBMF #CirurgiaBucoMaxiloFacial #OdontologiaHospitalar #EvidenceBasedPractice`;
  }
  if (rede === "google") {
    return `**${tema}?**\n\nVocê percebe dor, incômodo, estalo, travamento ou dificuldade para mastigar? Esses sinais podem ter diferentes causas e merecem uma avaliação cuidadosa.\n\nO acompanhamento com cirurgião bucomaxilofacial ajuda a entender a origem do problema e definir o melhor caminho com segurança. Atendimento em ${CIDADES_ATENDIMENTO}.\n\nSaiba mais pelo perfil ou envie mensagem pelo WhatsApp ${WHATSAPP}.\n\nPalavras-chave SEO: Cirurgião Bucomaxilofacial São Paulo, CTBMF, ATM, DTM, Siso incluso, Odontologia Hospitalar\nALT TEXT: arte médica em azul navy sobre ${tema}`;
  }
  if (formato === "Story") {
    return `${tema}\n\nVocê já sentiu algo parecido?\n\nVeja o post completo no feed.\n\nLink na Bio`;
  }
  return `Isso pode estar tentando te avisar algo.\n\n${tema}. Quando dor, travamento, estalo ou desconforto aparecem na face e na boca, o mais importante é entender a causa antes de procurar soluções rápidas.\n\nInformação de qualidade ajuda você a reconhecer sinais, evitar medo desnecessário e buscar orientação no momento certo.\n\nSaiba mais pelo link da bio.\nAtendimento em ${CIDADES_ATENDIMENTO}.\n\n#bucomaxilofacial #CTBMF #drfranciscomenezes #saudebucal #ATM #cirurgiaoral`;
}




export const generateSinglePost = createServerFn({ method: "POST" })
  .middleware([])
  .inputValidator((d: unknown) => SingleInput.parse(d))
  .handler(async ({ data }) => {
    const context = { userId: TEMP_USER_ID };

    const { generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve formato final
    const formato: "Carrossel" | "Story" | "Post Único" =
      data.formato ??
      (data.rede === "estilo-x"
        ? "Carrossel"
        : data.tipo === "stories"
          ? "Story"
          : "Post Único");

    // 0. Se nenhum tema foi fornecido, o gerador local escolhe um automaticamente
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
      const temasUsados = Array.from(
        new Set((historico ?? []).map((p: any) => (p.prompt_ia || "").trim()).filter(Boolean))
      ).slice(0, 150);
      tema = chooseLocalTema(data.audiencia, temasUsados, `${data.rede}-${data.formato}-${data.especialidade}`);
    }


    // 1. Resolve nível editorial
    const nivel = resolveNivel(data.nivel, data.rede, data.tipo);
    const isStory = formato === "Story";

    // 2. Dispara legenda + imagens EM PARALELO (não dependem entre si).
    const isEstudantes = data.audiencia === "estudantes-graduacao";
    const isChico = data.audiencia === "chico-drfm";
    const legendaPromise = Promise.resolve(buildLocalCaption({
      tema,
      rede: data.rede,
      formato,
      especialidade: data.especialidade,
      nivel,
      audiencia: data.audiencia,
    }));

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
        return await generateImageBase64({ prompt, size, model: "local/sem-custo", referenceImageUrls: logoRefs.length ? logoRefs : undefined });
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

    const legendaResolvida = await legendaPromise;
    const withVisual = (basePrompt: string) => basePrompt;


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
        slidesSpec.map((s) => genAndUpload(withVisual(
          isEstudantes
            ? studentImagePrompt(tema, s)
            : isChico
              ? chicoImagePrompt(tema, s)
              : imageSystemPrompt(tema, data.rede, nivel, s)
        )))
      );
      urlImagem = uploads[0].publicUrl;
      urlImagemCache = uploads[0].signedUrl;
      imagensCarrossel = uploads.map((u) => u.publicUrl);
      imagensCarrosselCache = uploads.map((u) => u.signedUrl);
    } else {
      const upload = await genAndUpload(withVisual(
        isEstudantes
          ? studentImagePrompt(tema)
          : isChico
            ? chicoImagePrompt(tema, undefined, isStory)
            : imageSystemPrompt(tema, data.rede, nivel)
      ));
      urlImagem = upload.publicUrl;
      urlImagemCache = upload.signedUrl;
    }

    const legenda = legendaResolvida;


    const tipoPost = formato === "Carrossel" ? "Carrossel" : "Post Único";

    // Roteamento de conta Instagram — sem isto o publicador cai no default
    // (@drfranciscomenezes) e Liga/Chico saem na conta errada.
    const instagramConta = isEstudantes
      ? "lactbmf.anhanguerasbo"
      : "drfranciscomenezes";

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
        instagram_conta: instagramConta,
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

// Descarta (deleta) um post — usado no preview quando o usuário rejeita o resultado gerado.
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
        await supabaseAdmin.from("posts").update({ status: "Erro", user_id: publishUserId }).eq("id", data.id);
        results.status = "Erro";
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
    const { buildScheduleSlots } = await import("@/lib/schedule-config");

    // Slots reais dos próximos 7 dias
    const slots = buildScheduleSlots(new Date(), 7);
    const temasBase = data.especialidade === "Odontologia Hospitalar"
      ? [
        "Como a higiene oral reduz riscos em pacientes internados",
        "Quando a odontologia hospitalar entra no cuidado multiprofissional",
        "Por que infecções bucais podem impactar tratamentos médicos",
        "Como avaliar a boca antes de cirurgias e terapias sistêmicas",
        "Quando lesões orais exigem atenção dentro do hospital",
        "Por que pacientes oncológicos precisam de cuidado oral planejado",
        "Como o dentista atua na segurança do paciente crítico",
      ]
      : TEMAS_GERAIS;

    // Anexa metadados + força stories a herdarem o tema do feed do mesmo dia
    const enriquecidos = slots.map((s, i) => {
        const temaBase = s.diaSemana === 0
          ? "Cuidar da saúde da boca também é cuidar do bem-estar"
          : temasBase[i % temasBase.length];
        const gancho = s.tipo === "stories"
          ? `Teaser rápido: ${temaBase}`
          : `Gancho: ${temaBase}`;
        return {
          dia: i + 1,
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
          tema: temaBase,
          gancho,
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
