import { createServerFn } from "@tanstack/react-start";
// Auth desativada no projeto — usamos um user_id temporário fixo.
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
import { z } from "zod";

export const MODELOS_IA = [
  { id: "local/sem-custo", label: "Local sem custo (texto)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini (texto)" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano (texto)" },
  { id: "openai/gpt-5", label: "GPT-5 (texto)" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini (texto)" },
  { id: "openai/gpt-5.4", label: "GPT-5.4 (texto)" },
  { id: "openai/gpt-5.5", label: "GPT-5.5 (texto)" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (texto)" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (texto)" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash (texto)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (texto)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (texto)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (texto)" },
] as const;
const ModeloLocalInput = z
  .string()
  .optional()
  .transform((v) => v || "local/sem-custo");

export const MODELOS_IMAGEM = [
  { id: "local/sem-custo", label: "Local sem custo (imagem)" },
  { id: "google/gemini-3.1-flash-image", label: "Gemini Nano Banana 2 (imagem)" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image (imagem)" },
  { id: "google/gemini-2.5-flash-image", label: "Gemini Nano Banana (imagem)" },
  { id: "openai/gpt-image-2", label: "GPT Image 2 (imagem)" },
  { id: "openai/gpt-image-1-mini", label: "GPT image 1 mini (imagem)" },
] as const;
const ModeloImagemLocalInput = z
  .string()
  .optional()
  .transform((v) => v || "local/sem-custo");

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

type TopicGuidance = {
  oQue: string;
  porQue: string;
  conduta: string;
  alerta: string;
  ganho: string;
};

// REGRA SUPREMA DE COERÊNCIA CLÍNICA — aplicada a TODOS os tipos de post (IG, LinkedIn, Google, Chico, Liga).
// Resolve a falha recorrente: posts apresentam a patologia mas não dizem como tratar / o que fazer.
const CONTEUDO_COMPLETO = `\n\n=== REGRA SUPREMA — CONTEÚDO COMPLETO (NÃO PODE FALTAR) ===
Todo post DEVE responder, de forma equilibrada, às 4 perguntas do leitor — não basta descrever a patologia:
1) O QUE É (sintoma/condição em 1 frase).
2) POR QUE ACONTECE (mecanismo simples, 1-2 frases).
3) COMO SE TRATA / O QUE FAZER (conduta clínica, abordagem terapêutica ou dicas práticas — OBRIGATÓRIO, nunca omitir). Cite opções reais usadas na prática (ex.: placa oclusal para bruxismo/DTM; exodontia minimamente traumática para siso; fisioterapia + controle inflamatório para ATM; redução e fixação interna rígida para fraturas; CPAP/cirurgia ortognática para apneia; biópsia para lesões suspeitas etc.) — sem prometer cura, sem prescrever dose, sem afirmar diagnóstico individual.
4) QUANDO PROCURAR ESPECIALISTA (sinal de alerta + CTA).
PROIBIDO: post que só descreve a doença/sintoma e termina sem orientação prática; post que diz "procure um especialista" sem antes explicar QUAIS são as condutas/tratamentos disponíveis.
A IMAGEM e a LEGENDA devem contar a MESMA história nessa ordem (problema → mecanismo → solução → CTA). Em carrossel, os slides centrais OBRIGATORIAMENTE mostram a SOLUÇÃO/TRATAMENTO, não só a dor.
=== FIM DA REGRA DE CONTEÚDO COMPLETO ===\n`;

// === METODOLOGIAS DE COPYWRITING / CONEXÃO ===
// Rotacionadas aleatoriamente a cada post para evitar repetição de estrutura
// e gerar maior identificação emocional com o leitor. Cada método ENVELOPA
// a estrutura padrão (não substitui) — orienta o RITMO, a ABERTURA e o
// FECHAMENTO da legenda.
const METODOLOGIAS_COPY = [
  {
    nome: "AIDA (Atenção · Interesse · Desejo · Ação)",
    guia: "Abra com uma frase-choque que ROUBA a atenção em 5 palavras (ex.: 'Acorda com a mandíbula travada?'). Desperte INTERESSE com 1 fato pouco conhecido. Crie DESEJO mostrando o alívio possível. Feche com AÇÃO clara (link na bio).",
  },
  {
    nome: "PAS (Problema · Agitação · Solução)",
    guia: "Apresente o PROBLEMA real do leitor em 1 frase curta. AGITE: descreva o que acontece se ele ignorar (dor que piora, função que se perde, qualidade de vida que cai). SOLUÇÃO: revele a conduta clínica disponível hoje.",
  },
  {
    nome: "BAB (Before · After · Bridge)",
    guia: "BEFORE: descreva o cenário atual de sofrimento/limitação do leitor. AFTER: pinte o cenário pós-tratamento (dormir bem, mastigar sem dor, voltar ao trabalho). BRIDGE: a ponte entre os dois é a avaliação especializada.",
  },
  {
    nome: "Storytelling clínico (mini-caso)",
    guia: "Abra com um mini-caso anônimo em 2 frases ('Paciente chegou com X há meses, achava que era Y...'). Conduza pelo raciocínio clínico. Encerre com o desfecho e a lição que vale para QUEM lê.",
  },
  {
    nome: "FAB (Feature · Advantage · Benefit)",
    guia: "FEATURE: cite a característica técnica (técnica minimamente traumática, planejamento digital, fixação rígida). ADVANTAGE: o que ela faz de diferente. BENEFIT: o que MUDA na vida do paciente (menos edema, menos dias parado, mais segurança).",
  },
  {
    nome: "4U (Útil · Único · Urgente · Ultra-específico)",
    guia: "Cada frase deve ser ÚTIL (ensina algo), ÚNICA (ângulo não-óbvio), URGENTE (por que importa AGORA) e ULTRA-ESPECÍFICA (cite a estrutura anatômica, o sintoma exato, o tempo correto).",
  },
  {
    nome: "PASTOR (Problema · Amplifica · Solução · Testemunho · Oferta · Resposta)",
    guia: "Problema em 1 linha. Amplifica a dor real. Solução clínica. Testemunho científico (1 dado/estudo sem inventar). Oferta = acesso à avaliação especializada. Resposta = CTA link na bio.",
  },
  {
    nome: "4Cs (Claro · Conciso · Convincente · Crível)",
    guia: "Cada frase passa nos 4 filtros antes de ficar: está CLARA (leigo entende)? CONCISA (sem gordura)? CONVINCENTE (gera ação)? CRÍVEL (sem exagero e sem promessa de cura)?",
  },
  {
    nome: "Empatia radical (Brené Brown aplicado à saúde)",
    guia: "Comece nomeando a EMOÇÃO do leitor ('Sei que dói dormir mal há meses', 'Entendo o medo de uma cirurgia'). Valide o sentimento ANTES de oferecer a informação técnica. Só depois entre na conduta.",
  },
  {
    nome: "Pergunta socrática",
    guia: "Estruture a legenda em 3 perguntas que o próprio leitor faria ao especialista ('Por que dói só de um lado?', 'É normal estalar?', 'Tem como tratar sem cirurgia?'). Responda cada uma em 1-2 frases curtas. Feche com convite.",
  },
];

function pickMetodologiaCopy() {
  const m = METODOLOGIAS_COPY[Math.floor(Math.random() * METODOLOGIAS_COPY.length)];
  return `\n\n=== METODOLOGIA DE CONEXÃO DESTE POST (use como esqueleto do texto, sem citar o nome do método) ===\nMétodo: ${m.nome}\nComo aplicar: ${m.guia}\nRegra: aplique o método de forma natural — NÃO escreva "AIDA", "PAS" etc. na legenda; apenas siga o ritmo descrito. Em posts seguidos NÃO repita a mesma abertura.\n\n=== HOOK PARA A IMAGEM (OBRIGATÓRIO — APLICAR A METODOLOGIA AO NICHO/TEMA) ===\nNa PRIMEIRA linha da sua resposta, ANTES de qualquer coisa, escreva exatamente assim:\nHOOK_IMAGEM: "<frase de 3 a 6 palavras, PT-BR, MAIÚSCULAS, no ESPÍRITO do método "${m.nome}", citando o sintoma/estrutura/condição do TEMA do post (ex.: 'DOR NO SISO?', 'RONCO PODE MATAR', 'ATM TRAVADA?', 'CÂNCER NA BOCA?', 'MAXILAR QUEBRADO?', 'SANGRA AO ESCOVAR?')>"\nEssa frase será renderizada DENTRO da imagem da capa (ou single) como gancho visual. PROIBIDO citar nome do profissional, "Dr.", "Prof.", clínica ou marca. Depois pule uma linha e siga com a legenda normal.\n=== FIM DA METODOLOGIA ===\n`;
}

function extractHookImagem(txt: string): string {
  const m = (txt || "").match(/HOOK_IMAGEM\s*:\s*["“']?([^"”'\n]+)["”']?/i);
  if (!m) return "";
  return m[1].trim().toUpperCase().slice(0, 60);
}

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
${CTAS_PROIBIDOS}
${LOCALIZACAO_OBRIGATORIA}
${CONTEUDO_COMPLETO}${pickMetodologiaCopy()}`;
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
NÃO inclua a assinatura no corpo do texto — ela aparece como overlay na imagem.
${CONTEUDO_COMPLETO}${pickMetodologiaCopy()}`;
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
- TEXTO NA IMAGEM (CAPA / 1ª imagem): OBRIGATÓRIO 1 headline-GANCHO ULTRA FORTE de 3 a 6 palavras — pergunta direta de dor, dado-choque ou frase de identificação imediata sobre o TEMA (ex.: "DOR NO SISO?", "ATM TRAVADA?", "RONCO MATA", "PERDEU UM DENTE?", "INCHAÇO NO ROSTO?") — tipografia bold sans-serif condensada gigante, BRANCO ou AZUL CIANO #2dd4ff, PT-BR com acentuação perfeita. PROIBIDO citar "@drfranciscomenezes", nome do profissional, "Dr.", "Prof.", clínica, consultório ou marca (assinatura entra como overlay do sistema). SEM parágrafos, listas, números, bullets ou legendas — texto longo vai na legenda.
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
REGRA DE NOMENCLATURA ANATÔMICA (obrigatória): toda estrutura citada deve usar a Terminologia Anatômica oficial em pt-BR (TA2 / Sociedade Brasileira de Anatomia), com a indicação clínica/topográfica correta. Exemplos válidos: "nervo alveolar inferior" (não "nervo dentário"), "nervo lingual", "nervo bucal", "nervo mentual", "forame mentual" (não "forame mental"), "forame mandibular", "espinha de Spix" (= língula da mandíbula), "côndilo da mandíbula", "processo coronoide", "ramo da mandíbula", "corpo da mandíbula", "sínfise mentual", "tuberosidade da maxila", "seio maxilar", "fossa pterigopalatina", "músculo masseter", "músculo temporal", "músculos pterigóideos medial e lateral", "articulação temporomandibular (ATM)", "disco articular", "côndilo mandibular", "fossa mandibular do osso temporal", "tubérculo articular", "primeiro/segundo/terceiro molar inferior", "região retromolar", "trígono retromolar", "mucosa alveolar", "gengiva inserida", "freio labial/lingual". PROIBIDO usar nomes populares como nome técnico ("dente do siso" só como sinônimo coloquial entre parênteses), inventar variações ("nervo alveolário", "forame mentoniano"), trocar lado (inferior/superior, medial/lateral, anterior/posterior) ou atribuir função/inervação errada. Sempre confira a indicação clínica: bloqueio do nervo alveolar inferior anestesia hemiarcada inferior ipsilateral; nervo lingual anestesia 2/3 anteriores da língua e mucosa lingual; nervo bucal anestesia mucosa jugal e gengiva vestibular dos molares inferiores. Em caso de dúvida sobre nome ou indicação, NÃO cite a estrutura.
${CONTEUDO_COMPLETO}${pickMetodologiaCopy()}`;
}

function studentImagePrompt(tema: string, slide?: { n: number; total: number; papel: string }) {
  const slideInfo = slide ? `\n- SLIDE ${slide.n}/${slide.total} de carrossel didático. Papel: ${slide.papel}.` : "";
  const isStory = /story|stories/i.test(slide?.papel ?? "");
  const formato = isStory
    ? "FORMATO vertical 9:16 (1024x1820) — Instagram Stories, mobile fullscreen."
    : "FORMATO vertical 4:5 (1024x1280) — Instagram Feed/Carrossel padrão.";
  const conceitosCriativos = [
    "FOTOGRAFIA CLÍNICA HIPER-REALISTA com anatomia bucomaxilofacial cientificamente correta: instrumental cirúrgico real (fórceps, porta-agulhas, seringa carpule, bisturi nº 15, descolador de Molt) em macro, profundidade rasa, foco preciso, iluminação cinematográfica de centro cirúrgico.",
    "RENDERIZAÇÃO MÉDICA 3D HIPER-REALISTA estilo Netter/Sobotta digital: corte sagital ou coronal mostrando anatomia exata (alvéolo, canal mandibular, nervo alveolar inferior, forame mentual, dente impactado), proporções científicas perfeitas, destaques visuais sem letras, números ou rótulos.",
    "IMAGEM RADIOGRÁFICA OU TOMOGRÁFICA REALISTA (panorâmica, periapical ou TC de feixe cônico) de alta resolução, tons de cinza fiéis ao exame, com a estrutura do tema em destaque sutil por luz/contorno, sem anotações escritas.",
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
REGRA DE NOMENCLATURA ANATÔMICA (obrigatória): use a Terminologia Anatômica oficial em pt-BR (TA2 / Sociedade Brasileira de Anatomia) com indicação clínica/topográfica correta. Nomes corretos: "nervo alveolar inferior" (nunca "nervo dentário"), "nervo lingual", "nervo bucal", "nervo mentual", "forame mentual" (nunca "mental" ou "mentoniano"), "forame mandibular", "língula da mandíbula" (= espinha de Spix), "côndilo da mandíbula", "processo coronoide", "ramo/corpo/sínfise da mandíbula", "tuberosidade da maxila", "seio maxilar", "ATM / disco articular / fossa mandibular / tubérculo articular", "músculos masseter, temporal e pterigóideos medial e lateral", "região e trígono retromolar". Sempre confirme lado (inferior/superior, medial/lateral), inervação, irrigação e indicação clínica antes de citar. Em caso de QUALQUER dúvida sobre nome, lado, função ou indicação, NÃO cite a estrutura. Proibido nomes populares como nome técnico ou variações inventadas.
${CONTEUDO_COMPLETO}${pickMetodologiaCopy()}`;
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

function topicGuidance(tema: string): TopicGuidance {
  const t = normalizeTema(tema);
  if (/anestesia|anestesica|bloqueio|agulha|carpule|alveolar inferior/.test(t)) {
    return {
      oQue: "a técnica anestésica precisa atingir o nervo correto para permitir uma cirurgia bucal confortável e segura",
      porQue: "mandíbula, maxila e mucosas têm inervações diferentes; escolher o bloqueio errado reduz a anestesia e aumenta desconforto",
      conduta: "a conduta é revisar anatomia, localizar referências intraorais, aspirar antes de depositar o anestésico e escolher a técnica compatível com o dente e o procedimento",
      alerta: "parestesia, dor intensa, falha repetida de anestesia ou sangramento inesperado exigem revisão técnica e supervisão",
      ganho: "executar o procedimento com previsibilidade, conforto e menor risco anatômico",
    };
  }
  if (/sutura|porta agulhas|fio|ponto|ferida cirurgica|mucosa oral/.test(t)) {
    return {
      oQue: "a sutura aproxima as bordas da mucosa e ajuda a estabilizar o coágulo no pós-operatório",
      porQue: "tensão, nó mal posicionado ou escolha inadequada do fio podem atrasar cicatrização e aumentar desconforto",
      conduta: "a conduta é fazer pontos com bordas bem aproximadas, sem estrangular o tecido, usando porta-agulhas adequado, nó estável e orientação de higiene",
      alerta: "deiscência, sangramento persistente, secreção, dor crescente ou ponto soltando cedo merecem avaliação",
      ganho: "melhorar cicatrização, proteger o coágulo e reduzir intercorrências no pós-operatório",
    };
  }
  if (/antibiotico|antibiótico|medicacao|profilaxia/.test(t)) {
    return {
      oQue: "antibiótico não é obrigatório em toda cirurgia bucal e deve ter indicação clínica clara",
      porQue: "uso desnecessário aumenta resistência bacteriana e efeitos adversos, enquanto infecção ativa ou risco sistêmico exigem avaliação cuidadosa",
      conduta: "a conduta é avaliar história médica, sinais de infecção, extensão cirúrgica e risco do paciente antes de indicar ou não antibioticoterapia",
      alerta: "febre, aumento progressivo de edema, secreção, trismo, mal-estar ou comprometimento sistêmico precisam de avaliação",
      ganho: "usar medicação com segurança, evitando tanto excesso quanto falta de tratamento quando há indicação",
    };
  }
  if (/alveoloplastia|regularizacao ossea|regularização óssea|rebordo|lima|cinzel/.test(t)) {
    return {
      oQue: "a alveoloplastia regulariza o rebordo ósseo após extrações quando há espículas, irregularidades ou necessidade protética",
      porQue: "bordas ósseas traumáticas podem machucar a mucosa, atrapalhar cicatrização e dificultar prótese ou reabilitação",
      conduta: "a conduta envolve avaliação do rebordo, regularização conservadora com instrumental adequado, irrigação, sutura sem tensão e orientação pós-operatória",
      alerta: "dor localizada, ferida que machuca, espícula exposta, prótese ferindo ou cicatrização ruim pedem avaliação",
      ganho: "deixar o rebordo mais confortável, cicatrização mais previsível e preparo melhor para reabilitação",
    };
  }
  if (/forceps|fórceps|extracao|extração|exodontia|molar inferior|dente no alveolo/.test(t)) {
    return {
      oQue: "a exodontia é a remoção planejada de um dente quando ele não pode ser mantido com segurança ou quando há indicação cirúrgica",
      porQue: "raiz, osso, posição do dente e proximidade com nervos influenciam força, movimento e risco do procedimento",
      conduta: "a conduta é planejar por exame e imagem, fazer luxação controlada, usar fórceps ou alavancas compatíveis, preservar tecidos e orientar pós-operatório",
      alerta: "dor intensa, sangramento persistente, edema progressivo, febre, mau gosto ou dormência precisam de avaliação",
      ganho: "remover a causa do problema com menor trauma e recuperação mais previsível",
    };
  }
  if (/forame mentual|nervo mentual|canal mandibular/.test(t)) {
    return {
      oQue: "o forame mentual é a saída do nervo mentual, estrutura importante na região de pré-molares inferiores",
      porQue: "procedimentos próximos ao forame podem irritar ou lesar o nervo se a anatomia não for reconhecida",
      conduta: "a conduta é identificar a região por exame e imagem, respeitar distância de segurança e evitar incisões ou pressão instrumental direta sobre o trajeto nervoso",
      alerta: "formigamento, dormência no lábio inferior ou alteração de sensibilidade após procedimento deve ser avaliada",
      ganho: "planejar com mais segurança e reduzir risco neurossensorial",
    };
  }
  if (/alveolite|coagulo|pos exodontia|pos operatorio/.test(t)) {
    return {
      oQue: "dor intensa alguns dias após a extração pode indicar inflamação do alvéolo quando o coágulo se perde ou não protege bem a ferida",
      porQue: "o osso fica exposto, a cicatrização atrasa e a dor costuma irradiar para ouvido ou têmpora",
      conduta: "a conduta envolve avaliação, limpeza delicada do alvéolo, curativo local quando indicado, controle da dor e orientação de higiene, sem cutucar a região",
      alerta: "dor que piora depois do terceiro dia, mau gosto, mau hálito ou alvéolo vazio merecem avaliação",
      ganho: "controlar a dor, proteger a cicatrização e evitar complicações",
    };
  }
  if (/siso|terceiro molar|38|dente incluso|incluso/.test(t)) {
    return {
      oQue: "o siso pode ficar sem espaço, parcialmente coberto por gengiva ou em contato próximo com estruturas importantes",
      porQue: "essa posição favorece inflamação, dor irradiada, dificuldade de higienização e risco ao dente vizinho",
      conduta: "o tratamento começa com exame clínico e imagem; quando indicado, a exodontia planejada é feita com técnica minimamente traumática e cuidados pós-operatórios",
      alerta: "dor recorrente, inchaço, pus, mau gosto ou dificuldade para abrir a boca pedem avaliação",
      ganho: "resolver a causa do incômodo com mais previsibilidade e segurança",
    };
  }
  if (/atm|dtm|bruxismo|mandibula|estalo|trav|dor facial|dor de cabeca|masseter/.test(t)) {
    return {
      oQue: "dor, estalos, travamento ou cansaço na mandíbula podem vir da articulação temporomandibular e dos músculos mastigatórios",
      porQue: "sobrecarga, apertamento, inflamação e alterações na mordida podem desorganizar o movimento mandibular",
      conduta: "a abordagem pode incluir orientação de hábitos, placa oclusal, fisioterapia, controle inflamatório e investigação de fatores articulares ou musculares",
      alerta: "travamento, dor diária, limitação para abrir a boca ou dor que irradia para ouvido e cabeça precisam de avaliação",
      ganho: "reduzir sobrecarga, recuperar função e mastigar com mais conforto",
    };
  }
  if (/ortognatica|mordida|perfil facial|harmonia|respiracao|fala/.test(t)) {
    return {
      oQue: "alterações importantes da mordida podem afetar mastigação, fala, respiração e equilíbrio facial",
      porQue: "maxila e mandíbula podem crescer em posições diferentes, criando compensações dentárias e musculares",
      conduta: "o caminho costuma envolver diagnóstico facial, documentação, planejamento digital, ortodontia e cirurgia ortognática quando indicada",
      alerta: "dificuldade para mastigar, fechar os lábios, respirar bem ou morder corretamente merece avaliação especializada",
      ganho: "buscar função, estabilidade e harmonia facial de forma planejada",
    };
  }
  if (/apneia|ronco|cpap|sono|dormir/.test(t)) {
    return {
      oQue: "ronco intenso e pausas respiratórias durante o sono podem indicar obstrução das vias aéreas",
      porQue: "a anatomia facial, a posição da mandíbula e tecidos da garganta podem reduzir a passagem de ar",
      conduta: "a avaliação pode envolver exame do sono, CPAP, dispositivos intraorais e, em casos selecionados, cirurgia ortognática ou abordagem das vias aéreas",
      alerta: "sonolência diurna, engasgos à noite, pressão alta ou ronco com pausas respiratórias precisam de investigação",
      ganho: "respirar melhor, dormir com mais qualidade e reduzir riscos sistêmicos",
    };
  }
  if (/ferida|lesao|biopsia|patologia|mucosa|cicatriza/.test(t)) {
    return {
      oQue: "feridas, manchas ou aumentos de volume na boca que não cicatrizam precisam ser observados com seriedade",
      porQue: "traumas locais, inflamações, infecções e lesões potencialmente relevantes podem ter aparência parecida",
      conduta: "a conduta é examinar, remover fatores irritantes e indicar biópsia quando a lesão é persistente ou suspeita",
      alerta: "lesão por mais de 14 dias, sangramento, endurecimento, crescimento ou dor persistente exigem avaliação",
      ganho: "chegar ao diagnóstico correto cedo e definir o tratamento adequado",
    };
  }
  if (/trauma|fratura|acidente|face/.test(t)) {
    return {
      oQue: "traumas na face podem envolver dentes, mandíbula, maxila, órbita e articulação temporomandibular",
      porQue: "impactos alteram o encaixe dos ossos e podem comprometer mordida, respiração, visão ou abertura da boca",
      conduta: "a conduta envolve avaliação rápida, exames de imagem e, quando necessário, redução e fixação interna rígida das fraturas",
      alerta: "mordida alterada, assimetria, dormência, sangramento, visão dupla ou dificuldade para abrir a boca são sinais de alerta",
      ganho: "restaurar forma, função e segurança no tempo certo",
    };
  }
  if (/frenectomia|freio|lingual|labial/.test(t)) {
    return {
      oQue: "freios labiais ou linguais podem limitar movimento, higiene, fala ou estabilidade gengival em alguns casos",
      porQue: "a inserção do tecido pode criar tração mecânica ou restringir funções orais",
      conduta: "a conduta é avaliar função e indicação; quando necessário, a frenectomia remove ou reposiciona o freio com técnica controlada",
      alerta: "dificuldade funcional, retração gengival, espaço persistente entre dentes ou limitação de língua merecem avaliação",
      ganho: "melhorar função oral com indicação correta, sem procedimento desnecessário",
    };
  }
  if (/uti|pneumonia|vap|ventilacao|intubad|higiene oral|paciente critico|internad/.test(t)) {
    return {
      oQue: "a boca do paciente internado pode acumular biofilme e microrganismos que aumentam o risco de complicações sistêmicas",
      porQue: "em UTI, ventilação mecânica, boca seca e dificuldade de higiene favorecem colonização bacteriana e inflamação",
      conduta: "a conduta envolve protocolo de higiene oral, avaliação odontológica hospitalar, controle de focos infecciosos e integração com a equipe multiprofissional",
      alerta: "sangramento, secreção, lesões, dentes com mobilidade, próteses soltas ou piora do quadro respiratório exigem avaliação",
      ganho: "reduzir risco infeccioso, proteger a mucosa e aumentar a segurança do cuidado hospitalar",
    };
  }
  if (/oncolog|quimioterapia|radioterapia|mronj|bisfosfonato|osteonecrose|terapia sistemica/.test(t)) {
    return {
      oQue: "tratamentos oncológicos e medicamentos antirreabsortivos podem deixar a boca mais vulnerável a infecção, mucosite e alterações ósseas",
      porQue: "a imunidade, a vascularização, a salivação e a remodelação óssea podem ser impactadas pelo tratamento sistêmico",
      conduta: "o cuidado começa com avaliação odontológica prévia, remoção de focos infecciosos, higiene orientada, acompanhamento durante a terapia e condutas conservadoras quando há risco ósseo",
      alerta: "dor óssea, exposição de osso, feridas que não cicatrizam, febre, secreção ou dificuldade para se alimentar precisam de avaliação",
      ganho: "atravessar o tratamento médico com menos interrupções, menos infecção e mais segurança oral",
    };
  }
  if (/hospitalar|equipe multiprofissional|cirurgia medica|pre operatorio|pos operatorio|risco cirurgico|foco infeccioso/.test(t)) {
    return {
      oQue: "a Odontologia Hospitalar identifica riscos bucais que podem interferir em cirurgias, internações e terapias médicas",
      porQue: "infecções dentárias, doença periodontal, próteses instáveis e lesões de mucosa podem piorar inflamação, dor e risco infeccioso",
      conduta: "a conduta inclui avaliação no leito ou ambulatorial, controle de focos, adequação de higiene, parecer odontológico e plano integrado com a equipe médica",
      alerta: "dor, febre sem foco claro, secreção, sangramento oral, trauma por prótese ou lesão persistente durante internação merecem cuidado especializado",
      ganho: "dar mais segurança ao tratamento médico e reduzir complicações evitáveis relacionadas à boca",
    };
  }
  return {
    oQue: "um sinal na boca, face ou mandíbula pode ter causas diferentes e não deve ser interpretado isoladamente",
    porQue: "dor, inflamação, sobrecarga muscular, posição dos dentes e alterações anatômicas podem produzir sintomas parecidos",
    conduta: "o caminho seguro é avaliação clínica, exame de imagem quando necessário e plano individual com orientação, controle dos fatores de risco e tratamento específico",
    alerta: "dor persistente, inchaço, travamento, sangramento, febre ou piora progressiva pedem avaliação especializada",
    ganho: "entender a causa real e escolher a conduta certa, sem soluções genéricas",
  };
}

function visualSceneForTopic(tema: string, g: TopicGuidance, audiencia: z.infer<typeof SingleInput>["audiencia"], slideIndex?: number) {
  const t = normalizeTema(tema);
  const etapa = typeof slideIndex === "number" ? slideIndex : -1;
  const estudante = audiencia === "estudantes-graduacao";
  const prefixo = estudante ? "Cena didática acadêmica" : "Cena clínica premium";

  if (/anestesia|anestesica|bloqueio|agulha|carpule|alveolar inferior/.test(t)) {
    const cenas = [
      `${prefixo} mostrando seringa carpule posicionada próxima à região do forame mandibular em manequim anatômico realista`,
      `${prefixo} mostrando referências intraorais do bloqueio do nervo alveolar inferior com afastamento seguro`,
      `${prefixo} com corte anatômico da mandíbula evidenciando nervo alveolar inferior, língula da mandíbula e canal mandibular`,
      `${prefixo} mostrando aspiração e deposição controlada do anestésico com técnica limpa e supervisão acadêmica`,
      `${prefixo} mostrando aluno revisando anatomia e técnica anestésica em ambiente clínico universitário`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/sutura|porta agulhas|fio|ponto|ferida cirurgica|mucosa oral/.test(t)) {
    const cenas = [
      `${prefixo} mostrando porta-agulhas segurando agulha curva sobre mucosa oral simulada, sem sangue`,
      `${prefixo} mostrando bordas de mucosa aproximadas com ponto simples em modelo anatômico realista`,
      `${prefixo} com macro realista do nó cirúrgico estável sem tensão e coágulo protegido`,
      `${prefixo} mostrando sequência didática de aproximação das bordas e orientação de higiene pós-operatória`,
      `${prefixo} mostrando cicatrização organizada em mucosa oral com material de sutura adequado`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/antibiotico|antibiótico|medicacao|profilaxia/.test(t)) {
    const cenas = [
      `${prefixo} mostrando prontuário clínico sem letras, cápsulas neutras e avaliação oral como decisão baseada em indicação`,
      `${prefixo} mostrando comparação visual entre cirurgia simples sem infecção e quadro com sinais inflamatórios, sem texto`,
      `${prefixo} com equipe avaliando sinais sistêmicos e foco infeccioso oral em ambiente clínico`,
      `${prefixo} mostrando decisão segura de antibioticoterapia associada a controle do foco e acompanhamento`,
      `${prefixo} mostrando paciente orientado com medicação apenas quando indicada e retorno programado`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/alveoloplastia|regularizacao ossea|regularização óssea|rebordo|lima|cinzel/.test(t)) {
    const cenas = [
      `${prefixo} mostrando rebordo alveolar irregular em render anatômico realista após extração`,
      `${prefixo} mostrando espícula óssea traumática sob mucosa fina em modelo anatômico limpo`,
      `${prefixo} com instrumento de regularização óssea trabalhando suavemente no rebordo, sem sangue`,
      `${prefixo} mostrando rebordo regularizado, irrigação e sutura sem tensão como etapa de solução`,
      `${prefixo} mostrando mucosa confortável e rebordo preparado para reabilitação`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/forceps|fórceps|extracao|extração|exodontia|molar inferior|dente no alveolo/.test(t)) {
    const cenas = [
      `${prefixo} mostrando dente indicado para exodontia com fórceps compatível e campo clínico limpo`,
      `${prefixo} mostrando anatomia de raiz e alvéolo que orienta movimento controlado de luxação`,
      `${prefixo} com corte anatômico da mandíbula mostrando raiz, osso alveolar e canal mandibular em posição correta`,
      `${prefixo} mostrando exodontia planejada com luxação controlada, preservação tecidual e irrigação`,
      `${prefixo} mostrando alvéolo protegido, gaze e orientações pós-operatórias representadas sem texto`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/forame mentual|nervo mentual|canal mandibular/.test(t)) {
    const cenas = [
      `${prefixo} mostrando região de pré-molares inferiores com destaque anatômico para o forame mentual`,
      `${prefixo} mostrando trajeto do nervo mentual saindo do forame mentual em render realista da mandíbula`,
      `${prefixo} com corte anatômico do canal mandibular terminando no forame mentual, relação com raízes de pré-molares`,
      `${prefixo} mostrando planejamento de incisão e afastamento respeitando distância de segurança do nervo mentual`,
      `${prefixo} mostrando avaliação sensitiva do lábio inferior em contexto clínico seguro`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/siso|terceiro molar|38|dente incluso|incluso/.test(t)) {
    const cenas = [
      `${prefixo} mostrando terceiro molar inferior impactado na região retromolar, com mandíbula posterior em destaque`,
      `${prefixo} mostrando gengiva inflamada sobre siso parcialmente erupcionado, sem sangue e sem diagnóstico escrito`,
      `${prefixo} com corte anatômico limpo mostrando a proximidade do terceiro molar com o canal mandibular e o nervo alveolar inferior`,
      `${prefixo} mostrando planejamento de exodontia minimamente traumática com instrumental cirúrgico real ao lado de imagem anatômica`,
      `${prefixo} mostrando paciente tranquilo após orientação pós-operatória, com foco visual em cuidado e segurança`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/atm|dtm|bruxismo|mandibula|estalo|trav|dor facial|dor de cabeca|masseter/.test(t)) {
    const cenas = [
      `${prefixo} mostrando mão tocando a região pré-auricular da ATM com expressão discreta de desconforto`,
      `${prefixo} mostrando sobrecarga do músculo masseter e articulação temporomandibular em render anatômico realista`,
      `${prefixo} com corte lateral da ATM, côndilo mandibular e disco articular em relação anatômica correta`,
      `${prefixo} mostrando placa oclusal translúcida, orientação de hábitos e fisioterapia como abordagem integrada`,
      `${prefixo} mostrando recuperação funcional com abertura bucal confortável e ambiente clínico sofisticado`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/apneia|ronco|cpap|sono|dormir/.test(t)) {
    const cenas = [
      `${prefixo} mostrando pessoa dormindo de perfil com via aérea superior indicada por iluminação anatômica sutil`,
      `${prefixo} mostrando obstrução das vias aéreas superiores relacionada à posição mandibular, sem dramatização`,
      `${prefixo} com perfil facial e trajeto da respiração em render anatômico limpo`,
      `${prefixo} mostrando CPAP, dispositivo intraoral e planejamento bucomaxilofacial como opções de cuidado`,
      `${prefixo} mostrando sono tranquilo e respiração estável em atmosfera médica luminosa`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/trauma|fratura|acidente|face/.test(t)) {
    const cenas = [
      `${prefixo} mostrando avaliação de trauma facial em pronto atendimento, com foco em mandíbula e oclusão`,
      `${prefixo} mostrando assimetria facial discreta e mordida alterada como sinais de alerta, sem sangue`,
      `${prefixo} com render anatômico de linha de fratura mandibular e relação com dentes e nervo alveolar inferior`,
      `${prefixo} mostrando placas de titânio e planejamento de redução e fixação interna rígida em contexto cirúrgico limpo`,
      `${prefixo} mostrando retorno de simetria, função e segurança após tratamento planejado`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/ferida|lesao|biopsia|patologia|mucosa|cicatriza/.test(t)) {
    const cenas = [
      `${prefixo} mostrando close não invasivo de mucosa oral com área suspeita discreta e foco em avaliação`,
      `${prefixo} mostrando comparação visual entre irritação traumática e lesão persistente sem afirmar diagnóstico`,
      `${prefixo} com instrumento de exame e luz clínica avaliando mucosa oral, sem corte e sem sangue`,
      `${prefixo} mostrando biópsia representada de forma não gráfica por frasco de anatomopatológico sem texto e instrumental estéril`,
      `${prefixo} mostrando acompanhamento e orientação segura após investigação de lesão oral`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/uti|pneumonia|vap|ventilacao|intubad|higiene oral|paciente critico|internad/.test(t)) {
    const cenas = [
      `${prefixo} mostrando cuidado oral seguro em paciente hospitalar, com equipe usando materiais de higiene sem exposição invasiva`,
      `${prefixo} mostrando biofilme oral como risco em paciente internado por meio de macrofotografia educativa sem nojo ou sensacionalismo`,
      `${prefixo} com leito de UTI e cavidade oral representada de forma limpa, conectando higiene bucal e segurança respiratória`,
      `${prefixo} mostrando protocolo de higiene oral e avaliação odontológica hospitalar em integração multiprofissional`,
      `${prefixo} mostrando paciente hospitalar mais seguro com equipe multiprofissional ao redor, ambiente claro e humanizado`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  if (/oncolog|quimioterapia|radioterapia|mronj|bisfosfonato|osteonecrose|terapia sistemica/.test(t)) {
    const cenas = [
      `${prefixo} mostrando avaliação oral pré-tratamento oncológico em ambiente hospitalar, sem marcas ou textos`,
      `${prefixo} mostrando mucosa oral sensível e cuidado de suporte durante terapia sistêmica, sem lesões explícitas`,
      `${prefixo} com mandíbula em render anatômico realista destacando remodelação óssea e risco de cicatrização`,
      `${prefixo} mostrando higiene orientada, remoção de focos infecciosos e acompanhamento conservador como plano de segurança`,
      `${prefixo} mostrando continuidade do tratamento médico com boca protegida e equipe integrada`,
    ];
    return cenas[Math.max(0, Math.min(cenas.length - 1, etapa))] || cenas[0];
  }
  return `${prefixo} sobre "${tema}" mostrando especificamente: ${g.oQue}; mecanismo visual: ${g.porQue}; solução representada: ${g.conduta}`;
}

function clinicalContract(tema: string, audiencia: z.infer<typeof SingleInput>["audiencia"], slideIndex?: number) {
  const g = topicGuidance(tema);
  return `CONTRATO CLÍNICO DO POST — FONTE ÚNICA DE VERDADE:
- Tema único: ${tema}
- O que é: ${g.oQue}
- Por que acontece: ${g.porQue}
- Conduta/tratamento obrigatório: ${g.conduta}
- Alerta: ${g.alerta}
- Ganho forte: ${g.ganho}
- Cena visual obrigatória: ${visualSceneForTopic(tema, g, audiencia, slideIndex)}
REGRAS: legenda e imagem devem seguir exatamente este contrato; proibido trocar o assunto, falar só da doença sem conduta, ou criar imagem genérica de odontologia.`;
}

function completeCaptionIfNeeded(params: {
  legenda: string;
  tema: string;
  rede: "instagram" | "linkedin" | "estilo-x" | "google";
  formato: "Carrossel" | "Story" | "Post Único";
  audiencia: z.infer<typeof SingleInput>["audiencia"];
  especialidade: string;
}) {
  const raw = (params.legenda || "").trim();
  if (!raw) return buildLocalCaption({ tema: params.tema, rede: params.rede, formato: params.formato, especialidade: params.especialidade, nivel: resolveNivel("auto", params.rede), audiencia: params.audiencia });
  const g = topicGuidance(params.tema);
  const norm = normalizeTema(raw);
  const hasConduta = /(trat|conduta|avaliacao|avaliar|planej|fisioterapia|placa|cpap|biopsia|exodontia|higiene|protocolo|fixacao|orientacao|controle|acompanhamento)/.test(norm);
  const hasWhy = /(porque|por que|acontece|mecanismo|causa|favorece|sobrecarga|inflamacao|risco)/.test(norm);
  const hasAlert = /(alerta|procure|avaliacao|especialista|persistente|piora|febre|inchaco|sangramento|travamento)/.test(norm);
  const tooShort = raw.length < (params.formato === "Story" ? 120 : 320);
  if (!tooShort && hasConduta && hasWhy && hasAlert) return raw;

  if (params.formato === "Story") {
    return `${raw}\n\nO que fazer: ${g.conduta}.\n\nAtenção: ${g.alerta}.\n\nLink na Bio`;
  }
  if (params.rede === "linkedin") {
    return `${raw}\n\nConduta prática: ${g.conduta}. O objetivo é ${g.ganho}.\n\nSinais de alerta: ${g.alerta}.`;
  }
  const fechamento = params.audiencia === "estudantes-graduacao"
    ? "Salve para revisar e compare com sua conduta na clínica."
    : `Saiba mais pelo link da bio.\nAtendimento em ${CIDADES_ATENDIMENTO}.`;
  return `${raw}\n\nComo conduzir: ${g.conduta}.\n\nQuando ligar o alerta: ${g.alerta}.\n\nGanho esperado: ${g.ganho}.\n\n${fechamento}`;
}

function buildSlideNarratives(tema: string, audiencia: z.infer<typeof SingleInput>["audiencia"]) {
  const g = topicGuidance(tema);
  if (audiencia === "estudantes-graduacao") {
    return [
      `Slide 1 — Gancho acadêmico: ${tema}. O aluno precisa reconhecer o problema antes de pensar em instrumento ou técnica.`,
      `Slide 2 — Reconhecimento clínico: ${g.oQue}. Observe sinais, tempo de evolução e relação com anatomia local.`,
      `Slide 3 — Mecanismo/anatomia: ${g.porQue}. A decisão depende da estrutura envolvida e do risco cirúrgico.`,
      `Slide 4 — Conduta prática: ${g.conduta}. Esse é o slide da solução, com raciocínio técnico e seguro.`,
      `Slide 5 — Fechamento: ${g.alerta}. Salve para revisar e compare com o que você faria na clínica.`
    ];
  }
  return [
    `Slide 1 — Identificação: ${g.oQue}. Gancho visual de dor, dúvida ou desconforto real do paciente.`,
    `Slide 2 — Problema: ${g.porQue}. Mostrar por que o sintoma não deve ser banalizado.`,
    `Slide 3 — Caminho de tratamento: ${g.conduta}. Este slide obrigatoriamente mostra a solução/conduta, não só a doença.`,
    `Slide 4 — Ganho concreto: ${g.ganho}. Traduzir o tratamento em benefício de vida real.`,
    `Slide 5 — CTA: ${g.alerta}. Link na bio / WhatsApp com fechamento elegante e seguro.`
  ];
}

function ensureCarouselCaption(base: string, slideNarratives: string[], audiencia: z.infer<typeof SingleInput>["audiencia"]) {
  if (!slideNarratives.length) return base;
  const firstLine = (base || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !/^slide\s*\d/i.test(l) && !/^#/.test(l)) || "Carrossel educativo";
  const blocks = slideNarratives.map((texto, i) => `Slide ${i + 1}: ${texto.replace(/^Slide\s*\d+\s*[—:-]\s*/i, "").trim()}`);
  const fechamento = audiencia === "estudantes-graduacao"
    ? "Salve para revisar e comente qual conduta você escolheria."
    : `Saiba mais pelo link da bio.\nAtendimento em ${CIDADES_ATENDIMENTO}.`;
  const hashtags = audiencia === "estudantes-graduacao"
    ? "#OdontologiaAcadêmica #CirurgiaBucal #EstudanteDeOdonto #Graduação #MonitoriaOdonto #CTBMF"
    : "#bucomaxilofacial #CTBMF #drfranciscomenezes #cirurgiabucomaxilofacial #saudebucal";
  return `${firstLine}\n\n${blocks.join("\n\n")}\n\n${fechamento}\n\n${hashtags}`;
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
  const g = topicGuidance(tema);
  if (formato === "Carrossel") {
    const slides = buildSlideNarratives(tema, audiencia);
    const fechamento = audiencia === "estudantes-graduacao"
      ? "Comente qual conduta você escolheria e salve para revisar antes da clínica."
      : `Saiba mais pelo link da bio.\nAtendimento em ${CIDADES_ATENDIMENTO}.`;
    const hashtags = audiencia === "estudantes-graduacao"
      ? "#OdontologiaAcadêmica #CirurgiaBucal #EstudanteDeOdonto #Graduação #MonitoriaOdonto #CTBMF"
      : "#bucomaxilofacial #CTBMF #drfranciscomenezes #cirurgiabucomaxilofacial #saudebucal";
    return `${tema}\n\n${slides.join("\n\n")}\n\n${fechamento}\n\n${hashtags}`;
  }
  if (audiencia === "estudantes-graduacao") {
    return `Caiu na clínica: ${tema}\n\nO que observar: ${g.oQue}.\n\nPor que acontece: ${g.porQue}.\n\nConduta prática: ${g.conduta}.\n\nSinal de alerta: ${g.alerta}.\n\n#OdontologiaAcadêmica #CirurgiaBucal #EstudanteDeOdonto #Graduação #MonitoriaOdonto #CTBMF`;
  }
  if (audiencia === "chico-drfm") {
    return `Você se identificou com isso?\n\n${g.oQue}.\n\nIsso acontece porque ${g.porQue}.\n\nO tratamento não é uma receita pronta: ${g.conduta}.\n\nSe você percebe ${g.alerta}, vale investigar com segurança.\n\nDúvidas? Link na bio para contato e agendamento pelo WhatsApp.\n\nAtendo em ${CHICO_CIDADES}.\n\n#drfranciscomenezes #bucomaxilofacial #CTBMF #cirurgiabucomaxilofacial #saudebucal`;
  }
  if (rede === "linkedin") {
    return `**${tema}**\n\nNa prática em ${especialidade}, a apresentação clínica exige diferenciar sintoma, mecanismo e indicação terapêutica. ${g.oQue}.\n\nMecanismo provável: ${g.porQue}. A decisão clínica deve considerar exame físico, imagem quando indicada, risco anatômico e impacto funcional.\n\nImpacto para a prática:\n• ${g.conduta};\n• ${g.alerta};\n• o objetivo é ${g.ganho}.\n\nReferências:\n1. Journal of Oral and Maxillofacial Surgery. Clinical practice updates in oral and maxillofacial surgery. J Oral Maxillofac Surg.\n2. International Journal of Oral and Maxillofacial Surgery. Evidence-based decision making in maxillofacial care. Int J Oral Maxillofac Surg.\n\nDiscussão aberta aos colegas. WhatsApp: ${WHATSAPP}\n\n#CTBMF #CirurgiaBucoMaxiloFacial #OdontologiaHospitalar #EvidenceBasedPractice`;
  }
  if (rede === "google") {
    return `**${tema}?**\n\n${g.oQue}. Isso pode acontecer porque ${g.porQue}.\n\nO acompanhamento com cirurgião bucomaxilofacial ajuda a definir o melhor caminho: ${g.conduta}. Atendimento em ${CIDADES_ATENDIMENTO}.\n\nSaiba mais pelo perfil ou envie mensagem pelo WhatsApp ${WHATSAPP}.\n\nPalavras-chave SEO: Cirurgião Bucomaxilofacial São Paulo, CTBMF, tratamento bucomaxilofacial, ${tema}, Odontologia Hospitalar\nALT TEXT: cena médica realista sobre ${tema} mostrando problema, mecanismo e conduta`;
  }
  if (formato === "Story") {
    return `${tema}\n\n${g.oQue}.\n\nO caminho seguro: ${g.conduta}.\n\nLink na Bio`;
  }
  return `Isso pode estar tentando te avisar algo.\n\n${g.oQue}.\n\nPor trás disso, geralmente existe um mecanismo: ${g.porQue}.\n\nA solução começa entendendo a causa. Na prática, ${g.conduta}.\n\n${g.alerta}.\n\nSaiba mais pelo link da bio.\nAtendimento em ${CIDADES_ATENDIMENTO}.\n\n#bucomaxilofacial #CTBMF #drfranciscomenezes #saudebucal #cirurgiaoral`;
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
        "Curiosidade anatômica sobre o forame mentual e o nervo mentual",
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

    // 2. Primeiro gera/fecha a legenda e o contrato clínico. As imagens só nascem
    //    depois disso, para evitar arte genérica ou legenda incompleta.
    const isEstudantes = data.audiencia === "estudantes-graduacao";
    const isChico = data.audiencia === "chico-drfm";
    const localCaption = () => buildLocalCaption({
      tema,
      rede: data.rede,
      formato,
      especialidade: data.especialidade,
      nivel,
      audiencia: data.audiencia,
    });
    const legendaPromise = (async () => {
      if (!process.env.LOVABLE_API_KEY || data.modelo === "local/sem-custo") return localCaption();
      try {
        const { generateTextAI } = await import("@/lib/ai-gateway.server");
        const system = isChico
          ? chicoCaptionSystem(formato)
          : isEstudantes
            ? `Você é monitor sênior de Cirurgia Bucal escrevendo para estudantes de graduação em Odontologia (Liga de CTBMF). PT-BR Brasil impecável, ZERO inglês, sem repetições, sem palavras inventadas. Tom didático, direto, próximo do aluno; linguagem clínica correta com terminologia anatômica oficial (TA2/SBA). PROIBIDO copy comercial, diagnóstico afirmativo, "agende", "promoção". Encerre com 5-7 hashtags acadêmicas (#CTBMF #LigaAcademica #CirurgiaBucal #EstudanteDeOdontologia #Graduacao). Formato: ${formato}.${CONTEUDO_COMPLETO}${pickMetodologiaCopy()}`
            : `Você é o copywriter sênior do Prof. Francisco Menezes (CTBMF + Odontologia Hospitalar). PT-BR Brasil impecável, ZERO palavras em inglês, sem repetições. Tom segue o nível editorial: ${nivel}. ${CTAS_PROIBIDOS} ${data.rede === "linkedin" ? CTAS_PERMITIDOS_LI : CTAS_PERMITIDOS_IG}. ${LOCALIZACAO_OBRIGATORIA} Encerre com a assinatura "${ASSINATURA}" e o subtítulo "${ASSINATURA_SUBTITULO}" quando fizer sentido. Não inventar diagnóstico.${CONTEUDO_COMPLETO}${pickMetodologiaCopy()}`;
        const contrato = clinicalContract(tema, data.audiencia);
        const roteiroCarrossel = formato === "Carrossel"
          ? `\n\nREGRA ESPECÍFICA DO CARROSSEL — CORRIGIR REPETIÇÃO:\nA legenda final DEVE conter 5 blocos distintos, um por slide, explicitamente marcados como "Slide 1", "Slide 2", "Slide 3", "Slide 4" e "Slide 5".\nCada bloco precisa ter uma mensagem DIFERENTE e progressiva:\nSlide 1 = gancho/identificação; Slide 2 = problema; Slide 3 = mecanismo; Slide 4 = tratamento/conduta/ganho; Slide 5 = CTA.\nPROIBIDO repetir a mesma frase, o mesmo parágrafo ou a mesma legenda em slides diferentes. Cada imagem deve ter seu próprio sentido textual e visual.`
          : "";
        const prompt = `${contrato}\n\nTema: ${tema}\nRede: ${data.rede}\nFormato: ${formato}\nEspecialidade: ${data.especialidade}\nAudiência: ${data.audiencia}${roteiroCarrossel}\n\nTAREFA: escreva a legenda final pronta para publicação. Ela só será aceita se mencionar explicitamente O QUE É, POR QUE ACONTECE, COMO SE CONDUZ/TRATA e QUANDO PROCURAR AJUDA. Não termine antes da conduta/tratamento.\n\nIMPORTANTE: responda APENAS em Português do Brasil (pt-BR). Não use NENHUMA palavra em inglês (inclusive em hashtags — use #CirurgiaBucal, não #OralSurgery). Sem comentários meta, sem traduções, sem aspas envolvendo o texto.`;
        const txt = await generateTextAI({ system, prompt, model: data.modelo, maxTokens: data.rede === "linkedin" ? 1700 : formato === "Carrossel" ? 1200 : 950 });
        return txt || localCaption();
      } catch (err) {
        console.warn("[ai-post] legenda caiu para local:", err instanceof Error ? err.message : err);
        return localCaption();
      }
    })();

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
        return await generateImageBase64({ prompt, size, model: data.modeloImagem, referenceImageUrls: logoRefs.length ? logoRefs : undefined });
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

    const legendaBaseResolvida = completeCaptionIfNeeded({
      legenda: await legendaPromise,
      tema,
      rede: data.rede,
      formato,
      audiencia: data.audiencia,
      especialidade: data.especialidade,
    });
    const slideNarratives = formato === "Carrossel" ? buildSlideNarratives(tema, data.audiencia) : [];
    const legendaResolvida = formato === "Carrossel"
      ? ensureCarouselCaption(legendaBaseResolvida, slideNarratives, data.audiencia)
      : legendaBaseResolvida;

    // === NEXO LEGENDA ↔ IMAGEM ===
    // Extrai HEADLINE (1ª linha não-vazia) + ALT TEXT da legenda e, quando possível,
    // pede ao LLM uma "cena visual" 1-frase fiel ao que a legenda diz. Esse briefing
    // é injetado em TODO prompt de imagem para que a arte conte a MESMA história.
    const extractHeadline = (txt: string) => {
      const linhas = (txt || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return (linhas[0] || "").replace(/^[#*>\-•\d.\)\s]+/, "").slice(0, 120);
    };
    const extractAlt = (txt: string) => {
      const m = (txt || "").match(/ALT\s*TEXT\s*:\s*([^\n]+)/i);
      return m ? m[1].trim().slice(0, 240) : "";
    };
    const hookImagem = extractHookImagem(legendaResolvida);
    // remove a linha HOOK_IMAGEM da legenda exibida/publicada
    const legendaSemHook = (legendaResolvida || "").replace(/^\s*HOOK_IMAGEM\s*:[^\n]*\n?/i, "").trim();
    const headlineLegenda = extractHeadline(legendaSemHook) || hookImagem;
    const altLegenda = extractAlt(legendaSemHook);
    const guiaTema = topicGuidance(tema);
    let cenaVisualNexo = visualSceneForTopic(tema, guiaTema, data.audiencia);
    let cenasPorSlide: string[] = slideNarratives.map((_, i) => visualSceneForTopic(tema, guiaTema, data.audiencia, i));
    try {
      if (process.env.LOVABLE_API_KEY && data.modelo !== "local/sem-custo") {
        const { generateTextAI } = await import("@/lib/ai-gateway.server");
        const briefSys = `Você é diretor de arte médico. Use o CONTRATO CLÍNICO como fonte única de verdade e devolva UMA ÚNICA FRASE em PT-BR (máx. 240 caracteres) descrevendo a CENA VISUAL LITERAL que ilustra exatamente tema + conduta. Sem metáforas vagas, sem texto na imagem, sem cor nomeada, sem pessoa real. Se a legenda estiver genérica, siga o contrato.`;
        const briefPrompt = `${clinicalContract(tema, data.audiencia)}\n\nLEGENDA:\n${legendaResolvida.slice(0, 1800)}\n\nResponda só com a frase da cena.`;
        const cenaIA = (await generateTextAI({ system: briefSys, prompt: briefPrompt, model: data.modelo, maxTokens: 140 }) || "").trim().replace(/^["'`]+|["'`]+$/g, "");
        const cenaIANorm = normalizeTema(cenaIA);
        const palavrasTema = normalizeTema(tema).split(" ").filter((p) => p.length > 4);
        const palavrasContrato = normalizeTema(`${guiaTema.oQue} ${guiaTema.conduta}`).split(" ").filter((p) => p.length > 5);
        const cenaAncorada = [...palavrasTema, ...palavrasContrato].some((p) => cenaIANorm.includes(p));
        if (cenaIA && cenaAncorada) cenaVisualNexo = cenaIA;

        // Carrossel: gera 1 cena DISTINTA por slide, ancorada na legenda + papel narrativo.
        if (formato === "Carrossel") {
          const papeis = data.rede === "estilo-x"
            ? ["TWEET 1: gancho/pergunta", "TWEET 2: explicação científica curta", "TWEET 3: CTA fechamento"]
            : [
                "CAPA: GANCHO ULTRA FORTE 3-6 palavras (dor real/pergunta direta sobre o TEMA, sem citar marca ou @drfranciscomenezes)",
                "PROBLEMA: aprofundar o sintoma em linguagem leiga",
                "MECANISMO: como o problema acontece (analogia anatômica simples)",
                "SOLUÇÃO/GANHO: como o cirurgião resolve, foco no ganho do paciente",
                "FECHAMENTO: CTA premium Link na Bio + WhatsApp",
              ];
          try {
            const carrosselSys = `Você é diretor de arte médico. Para o tema "${tema}", use o CONTRATO CLÍNICO como fonte única de verdade. Descreva ${papeis.length} CENAS VISUAIS DISTINTAS — uma por slide — na ordem problema → mecanismo → conduta/tratamento → ganho → CTA. Cada cena: 1 frase em PT-BR (máx. 220 caracteres), literal, sujeito + ação + contexto anatômico/clínico. Sem texto na imagem, sem cor nomeada, sem pessoa real. Responda APENAS um JSON array de ${papeis.length} strings.`;
            const carrosselPrompt = `${clinicalContract(tema, data.audiencia)}\n\nLEGENDA:\n${legendaResolvida.slice(0, 1800)}\n\nROTEIRO TEXTUAL OBRIGATÓRIO POR SLIDE:\n${slideNarratives.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nPAPÉIS DOS SLIDES (na ordem):\n${papeis.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nResponda só o JSON array.`;
            const raw = (await generateTextAI({ system: carrosselSys, prompt: carrosselPrompt, model: data.modelo, maxTokens: 600 }) || "").trim();
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const arr = JSON.parse(jsonMatch[0]);
                if (Array.isArray(arr) && arr.length >= cenasPorSlide.length) {
                  const parsed = arr.map((s) => String(s || "").trim()).filter(Boolean);
                  cenasPorSlide = cenasPorSlide.map((fallback, i) => parsed[i] || fallback);
                }
            }
          } catch (err) {
            console.warn("[ai-post] cenas por slide caíram:", err instanceof Error ? err.message : err);
          }
        }
      }
    } catch (err) {
      console.warn("[ai-post] brief visual caiu:", err instanceof Error ? err.message : err);
    }
    const briefingNexoBase = [
      headlineLegenda ? `HEADLINE DA LEGENDA (use como ESPÍRITO da cena, NÃO escreva na imagem): "${headlineLegenda}"` : "",
      altLegenda ? `ALT TEXT GUIA (a cena PRECISA bater com isso): "${altLegenda}"` : "",
    ].filter(Boolean).join("\n");
    const withVisual = (basePrompt: string, slideIndex?: number) => {
      const cenaSlide = typeof slideIndex === "number" ? cenasPorSlide[slideIndex] : "";
      const narrativaSlide = typeof slideIndex === "number" ? slideNarratives[slideIndex] : "";
      const cena = cenaSlide || visualSceneForTopic(tema, guiaTema, data.audiencia, slideIndex) || cenaVisualNexo;
      const contrato = clinicalContract(tema, data.audiencia, slideIndex);
      const blocos = [
        contrato,
        briefingNexoBase,
        narrativaSlide ? `LEGENDA/ROTEIRO EXCLUSIVO DESTE SLIDE (não repetir nos outros): ${narrativaSlide}` : "",
        cena ? `CENA OBRIGATÓRIA (ilustre EXATAMENTE isto, sem inventar elemento alheio à legenda): ${cena}` : "",
      ].filter(Boolean).join("\n");
      return blocos
        ? `=== NEXO OBRIGATÓRIO COM A LEGENDA (PRIORIDADE MÁXIMA) ===\n${blocos}\nA imagem deve mostrar a CONDUTA/TRATAMENTO quando o slide pedir solução. Se houver conflito com o prompt base, ESTE NEXO vence.\n=== FIM DO NEXO ===\n\n${basePrompt}`
        : basePrompt;
    };


    let urlImagem: string;
    let imagensCarrossel: string[] = [];
    let urlImagemCache: string | null = null;
    let imagensCarrosselCache: string[] = [];

    if (formato === "Carrossel") {
      const fullSpec = [
        { n: 1, total: 5, papel: "CAPA: GANCHO ULTRA FORTE de conversão obrigatório em tipografia gigante (3-6 palavras, bold sans-serif condensada, BRANCO ou CIANO #2dd4ff sobre navy luminoso) — pergunta direta de dor real, dado de impacto ou frase-choque do TIPO 'DOR NO SISO?', 'SEU MAXILAR TRAVA?', 'RONCO PODE MATAR', 'ESSE CARO NÃO É NORMAL', 'PERDEU UM DENTE?'. O gancho fala DIRETO ao paciente sobre o TEMA — NÃO menciona '@drfranciscomenezes', nome do profissional, marca, clínica ou consultório (a assinatura entra como overlay do sistema). Layout impactante de capa de revista médica, hierarquia visual brutal, ZERO bibliografia, ZERO logo desenhada." },
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
        slidesSpec.map((s, idx) => genAndUpload(withVisual(
          isEstudantes
            ? studentImagePrompt(tema, s)
            : isChico
              ? chicoImagePrompt(tema, s)
              : imageSystemPrompt(tema, data.rede, nivel, s),
          idx,
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
    return { id: (inserted as any).id, url: urlImagemCache || urlImagem, legenda, slides: urls.length, urls, slideLegendas: slideNarratives.slice(0, urls.length) };
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
          if (/Instagram oficial|Configure seu perfil|token Meta|Meta/i.test(msg)) {
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
        const nextStatus = results.instagram?.via === "manual-liga" && !results.linkedin ? "Rascunho" : "Publicado";
        await supabaseAdmin.from("posts").update({ status: nextStatus, user_id: publishUserId }).eq("id", data.id);
        results.status = nextStatus;
      }

      if (warnings.length) {
        results.warning = warnings.join(" | ");
        if (!results.linkedin && !results.instagram) throw new Error(results.warning);
      }
      return results;
    }
    const { data: postMeta } = await supabaseAdmin
      .from("posts")
      .select("instagram_conta")
      .eq("id", data.id)
      .maybeSingle();
    const contaMeta = String((postMeta as any)?.instagram_conta || "").trim().replace(/^@+/, "").toLowerCase();
    const status = data.acao === "agendar" && contaMeta !== "lactbmf.anhanguerasbo" ? "Agendado" : "Rascunho";
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
