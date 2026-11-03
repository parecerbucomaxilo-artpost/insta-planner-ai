/**
 * Estúdio Gratuito — regras e modelos locais de texto.
 * Nada aqui chama IA ou serviços externos: tudo é template + regra determinística.
 */

export type RedeTexto = "instagram" | "linkedin" | "google";

export const LIMITES_REDE: Record<RedeTexto, { nome: string; limite: number; visivel: number; hashtagsMax: number }> = {
  instagram: { nome: "Instagram", limite: 2200, visivel: 125, hashtagsMax: 30 },
  linkedin: { nome: "LinkedIn", limite: 3000, visivel: 210, hashtagsMax: 5 },
  google: { nome: "Google Business", limite: 1500, visivel: 150, hashtagsMax: 0 },
};

export function contarCaracteres(texto: string): number {
  // Conta grafemas (emojis compostos contam como 1), como as redes exibem.
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
    let n = 0;
    for (const _ of seg.segment(texto)) n++;
    return n;
  }
  return Array.from(texto).length;
}

export function contarHashtags(texto: string): number {
  return (texto.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export type StatusLimite = { usado: number; limite: number; restante: number; excedeu: boolean; hashtags: number; hashtagsExcedeu: boolean };

export function statusRede(texto: string, rede: RedeTexto): StatusLimite {
  const { limite, hashtagsMax } = LIMITES_REDE[rede];
  const usado = contarCaracteres(texto);
  const hashtags = contarHashtags(texto);
  return { usado, limite, restante: limite - usado, excedeu: usado > limite, hashtags, hashtagsExcedeu: hashtags > hashtagsMax };
}

export type Objetivo = "autoridade" | "educativo" | "engajamento" | "institucional";

export const OBJETIVOS: Record<Objetivo, string> = {
  autoridade: "Autoridade",
  educativo: "Educativo",
  engajamento: "Engajamento",
  institucional: "Institucional",
};

/** CTAs alinhadas às regras da marca (sem "agende consulta", promoção, desconto etc.). */
export const CTAS_PERMITIDOS: Record<RedeTexto, string[]> = {
  instagram: ["Link na Bio", "Saiba mais pelo link da bio", "Salve este post para consultar depois", "Compartilhe com quem precisa saber disso", "Você já sentiu isso? Conte nos comentários"],
  linkedin: ["Fale comigo pelo WhatsApp: https://wa.me/5511947684004", "Comente sua experiência clínica sobre o tema", "Compartilhe com colegas da área"],
  google: ["Saiba mais pelo link do perfil", "Fale conosco pelo WhatsApp: https://wa.me/5511947684004"],
};

export const TERMOS_PROIBIDOS = ["agende consulta", "agende sua consulta", "agende avaliação", "agende sua avaliação", "marque horário", "promoção", "oferta", "desconto", "últimas vagas"];

export function modeloLegenda(objetivo: Objetivo, tema: string, rede: RedeTexto): string {
  const t = tema.trim() || "[tema]";
  const cta = CTAS_PERMITIDOS[rede][0];
  const modelos: Record<Objetivo, string> = {
    autoridade: `${capitalizar(t)}: o que a experiência clínica mostra\n\nNa prática hospitalar e no consultório, vemos com frequência dúvidas sobre ${t}.\n\nO que é importante saber:\n• [ponto 1, explicado de forma simples]\n• [ponto 2]\n• [ponto 3]\n\nCada caso exige avaliação individual por um profissional habilitado.\n\n${cta}`,
    educativo: `Você sabe o que é ${t}?\n\nEm palavras simples: [explicação curta, sem jargões].\n\nPor que isso importa:\n1. [motivo 1]\n2. [motivo 2]\n3. [motivo 3]\n\nInformação de qualidade ajuda a cuidar melhor da saúde.\n\n${cta}`,
    engajamento: `Você já passou por isso? 👇\n\n[Situação comum do dia a dia ligada a ${t}.]\n\nMuita gente acha que é normal, mas vale prestar atenção.\n\nConte nos comentários: isso já aconteceu com você?\n\n${cta}`,
    institucional: `${capitalizar(t)}\n\n[Apresente o serviço, a equipe ou o compromisso com a qualidade do atendimento.]\n\nNosso foco é segurança, clareza e cuidado em cada etapa.\n\n${cta}`,
  };
  return modelos[objetivo];
}

const PADROES_GANCHO = [
  "{T}: o que ninguém te explicou",
  "3 sinais de alerta sobre {t}",
  "Mito ou verdade: {t}",
  "O erro mais comum sobre {t}",
  "{T} em linguagem simples",
  "Quando procurar ajuda sobre {t}?",
  "O que acontece quando {t} é ignorado",
  "Você sabia? {T} explicado em 1 minuto",
  "Antes de se preocupar com {t}, leia isto",
  "Perguntas frequentes sobre {t}",
];

/** Gera ganchos a partir de modelos fixos — não é IA, apenas substituição de texto. */
export function gerarGanchos(tema: string): string[] {
  const t = tema.trim().toLowerCase();
  if (!t) return [];
  return PADROES_GANCHO.map((p) => p.replaceAll("{T}", capitalizar(t)).replaceAll("{t}", t));
}

export const ESTRUTURA_LEGENDA = [
  { etapa: "Gancho", dica: "Primeira linha curta que desperta curiosidade (aparece antes do “mais”)." },
  { etapa: "Contexto", dica: "Situação real ou dúvida comum do público." },
  { etapa: "Desenvolvimento", dica: "2 a 4 pontos claros, um por linha." },
  { etapa: "Reflexão", dica: "Por que isso importa para quem está lendo." },
  { etapa: "Chamada para ação", dica: "Uma única CTA permitida." },
  { etapa: "Hashtags", dica: "Poucas e relevantes, no final." },
];

const HASHTAGS_BASE = ["#odontologia", "#saudebucal", "#dentista", "#odontologiahospitalar", "#cirurgiabucomaxilofacial", "#bucomaxilo"];
const HASHTAGS_TEMA: Array<{ chaves: string[]; tags: string[] }> = [
  { chaves: ["siso", "terceiro molar", "dente do juízo"], tags: ["#dentedosiso", "#terceiromolar", "#extracaodesiso"] },
  { chaves: ["atm", "mandíbula", "estalo", "bruxismo"], tags: ["#atm", "#dtm", "#bruxismo", "#dorfacial"] },
  { chaves: ["trauma", "fratura", "acidente"], tags: ["#traumafacial", "#fraturafacial", "#traumatologia"] },
  { chaves: ["implante", "enxerto"], tags: ["#implantedentario", "#enxertoosseo", "#reabilitacaooral"] },
  { chaves: ["biópsia", "biopsia", "lesão", "câncer", "cancer", "ferida"], tags: ["#biopsia", "#estomatologia", "#cancerdeboca", "#diagnosticobucal"] },
  { chaves: ["hospital", "uti", "internado"], tags: ["#odontologiahospitalar", "#uti", "#cuidadosintensivos"] },
  { chaves: ["ronco", "apneia"], tags: ["#apneiadosono", "#ronco", "#sono"] },
  { chaves: ["ortognática", "ortognatica", "face"], tags: ["#cirurgiaortognatica", "#harmoniafacial"] },
  { chaves: ["estudante", "graduação", "liga"], tags: ["#estudantedeodontologia", "#ligaacademica", "#odontologiauniversitaria"] },
];

export function sugerirHashtags(tema: string, rede: RedeTexto): string[] {
  const max = LIMITES_REDE[rede].hashtagsMax;
  if (max === 0) return [];
  const t = tema.toLowerCase();
  const doTema = HASHTAGS_TEMA.filter((g) => g.chaves.some((c) => t.includes(c))).flatMap((g) => g.tags);
  const unicas = Array.from(new Set([...doTema, ...HASHTAGS_BASE]));
  return unicas.slice(0, Math.min(max, rede === "instagram" ? 12 : max));
}

export type Problema = { tipo: "ortografia" | "clareza" | "marca" | "formato"; mensagem: string };

const ERROS_COMUNS: Record<string, string> = {
  "concerteza": "com certeza", "derrepente": "de repente", "agente vai": "a gente vai", "mais sedo": "mais cedo",
  "excessão": "exceção", "previlégio": "privilégio", "ancioso": "ansioso", "beneficiente": "beneficente",
  "mendingo": "mendigo", "seje": "seja", "esteje": "esteja", "menas": "menos", "a nível de": "em nível de",
  "encima": "em cima", "porisso": "por isso", "apartir": "a partir", "cirurgia bucomaxilo facial": "cirurgia bucomaxilofacial",
};

/** Revisão básica por regras. Não substitui revisão humana. */
export function revisarTexto(texto: string): Problema[] {
  const p: Problema[] = [];
  const baixo = texto.toLowerCase();
  for (const [erro, certo] of Object.entries(ERROS_COMUNS)) {
    if (new RegExp(`(^|[^\\p{L}])${erro}([^\\p{L}]|$)`, "u").test(baixo)) p.push({ tipo: "ortografia", mensagem: `“${erro}” → prefira “${certo}”.` });
  }
  const dup = texto.match(/(^|[^\p{L}])([\p{L}]+)\s+\2(?=[^\p{L}]|$)/iu);
  if (dup) p.push({ tipo: "ortografia", mensagem: `Palavra repetida: “${dup[2]} ${dup[2]}”.` });
  if (/ {2,}/.test(texto)) p.push({ tipo: "formato", mensagem: "Há espaços duplos." });
  if (/\s[,.;:!?]/.test(texto)) p.push({ tipo: "formato", mensagem: "Há espaço antes de pontuação." });
  if (/[.!?]\s+[a-zà-ú]/.test(texto)) p.push({ tipo: "formato", mensagem: "Frase iniciando com letra minúscula após ponto." });
  if (/[!?]{2,}/.test(texto)) p.push({ tipo: "clareza", mensagem: "Evite pontuação repetida (!! ou ??)." });
  for (const termo of TERMOS_PROIBIDOS) {
    if (baixo.includes(termo)) p.push({ tipo: "marca", mensagem: `Termo não permitido pela marca: “${termo}”.` });
  }
  if (/r\$\s?\d|\bpreço\b|\bvalor(es)? (da|do) (consulta|procedimento)/i.test(texto)) p.push({ tipo: "marca", mensagem: "Não divulgar preços em materiais públicos." });
  const frases = texto.split(/[.!?\n]+/).map((f) => f.trim()).filter(Boolean);
  const longas = frases.filter((f) => f.split(/\s+/).length > 30).length;
  if (longas) p.push({ tipo: "clareza", mensagem: `${longas} frase(s) com mais de 30 palavras — tente dividir.` });
  const siglas = Array.from(new Set(texto.match(/\b[A-Z]{3,}\b/g) ?? [])).filter((s) => !["CROSP", "CTBMF", "WHATSAPP"].includes(s));
  if (siglas.length) p.push({ tipo: "clareza", mensagem: `Siglas que podem precisar de explicação: ${siglas.slice(0, 5).join(", ")}.` });
  return p;
}

function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

import { TEMAS_GERAIS, TEMAS_DIVERSOS, TEMAS_ESTUDANTES, TRATAMENTOS, TEMAS_CLINICA_ESCOLA } from "./planner-temas";

export type PlannerTemas = "chico" | "liga" | "cirurgia-biopsias" | "clinica-escola" | "diversos";

export const PLANNERS_TEMAS: Record<PlannerTemas, { nome: string; temas: readonly string[] }> = {
  chico: { nome: "Planner Simplificado Chico", temas: TEMAS_GERAIS },
  liga: { nome: "Planner Simplificado Liga (estudantes)", temas: TEMAS_ESTUDANTES },
  "cirurgia-biopsias": { nome: "Cirurgia e Biópsias", temas: TRATAMENTOS.map((t) => t.label) },
  "clinica-escola": { nome: "Planner Clínica Escola", temas: TEMAS_CLINICA_ESCOLA },
  diversos: { nome: "Temas diversos", temas: TEMAS_DIVERSOS },
};

/** Sorteio local de um tema do planner, evitando os já sorteados recentemente. Não usa IA. */
export function sortearTema(planner: PlannerTemas, recentes: string[], aleatorio: () => number = Math.random): string {
  const lista = PLANNERS_TEMAS[planner].temas;
  const livres = lista.filter((t) => !recentes.includes(t));
  const base = livres.length ? livres : lista;
  return base[Math.floor(aleatorio() * base.length) % base.length];
}
