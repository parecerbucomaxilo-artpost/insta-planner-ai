import { z } from "zod";

/** Regras puras (sem rede) do modo IA Avançada: briefing, variantes, ajustes e prompts. */

import { PERFIS, type PerfilId } from "@/lib/studio-profiles";

/** Perfis do Estúdio: Planner Chico, Cirurgia e Biópsias, Clínica Escola. */
export const MARCAS = PERFIS;
export type Marca = PerfilId;

export const REDES_IA = { instagram: "Instagram", linkedin: "LinkedIn", google: "Google Business" } as const;
export type RedeIA = keyof typeof REDES_IA;

export const VARIANTES = {
  curta: "Legenda curta",
  media: "Legenda média",
  aprofundada: "Legenda aprofundada",
  humanizada: "Versão humanizada",
  tecnica: "Versão técnica",
  instagram: "Adaptação Instagram",
  linkedin: "Adaptação LinkedIn",
  google: "Adaptação Google Business",
} as const;
export type Variante = keyof typeof VARIANTES;

export const AJUSTES = {
  aprofundar: "Aprofundar",
  simplificar: "Simplificar",
  "mais-tecnico": "Mais técnico",
  "mais-didatico": "Mais didático",
  "melhorar-gancho": "Melhorar gancho",
  reescrever: "Reescrever",
  "revisar-precisao": "Revisar precisão",
} as const;
export type Ajuste = keyof typeof AJUSTES;

const INSTRUCAO_AJUSTE: Record<Ajuste, string> = {
  aprofundar: "Aprofunde: acrescente mecanismo, implicações práticas e limites do conhecimento, sem inventar dados.",
  simplificar: "Simplifique: frases curtas, sem jargão, explicando qualquer termo técnico necessário.",
  "mais-tecnico": "Torne mais técnico: terminologia correta da CTBMF e explicação mais densa, mantendo precisão.",
  "mais-didatico": "Torne mais didático: explique passo a passo, com exemplo cotidiano plausível.",
  "melhorar-gancho": "Reescreva apenas o gancho/título para ser específico e forte, sem clickbait; mantenha o resto coerente.",
  reescrever: "Reescreva por completo com nova estrutura, preservando briefing e fatos.",
  "revisar-precisao": "Revise a precisão clínica: remova afirmações sem base, promessas, doses, estatísticas ou referências não verificáveis.",
};

export const FORMATOS_IA = {
  feed: { nome: "Feed 4:5", w: 1080, h: 1350, size: "1024x1536" },
  story: { nome: "Story/Reels 9:16", w: 1080, h: 1920, size: "1024x1536" },
  linkedin: { nome: "LinkedIn 1.91:1", w: 1200, h: 628, size: "1536x1024" },
} as const;
export type FormatoIA = keyof typeof FORMATOS_IA;

export const BriefingSchema = z.object({
  marca: z.enum(["chico", "cirurgia-biopsias", "clinica-escola", "liga"]),
  telefone: z.string().trim().max(40).default(""),
  tema: z.string().trim().min(3).max(300),
  objetivo: z.string().trim().max(120).default("Educar"),
  rede: z.enum(["instagram", "linkedin", "google"]),
  formato: z.string().trim().max(60).default("Post único"),
  nivel: z.enum(["leigo", "intermediario", "tecnico"]),
  tamanho: z.enum(["curto", "medio", "longo"]).default("medio"),
  tom: z.string().trim().max(80).default(""),
  cta: z.string().trim().max(160).default(""),
});
export type Briefing = z.infer<typeof BriefingSchema>;

export const TextoInput = z.object({
  briefing: BriefingSchema,
  variantes: z.array(z.enum(Object.keys(VARIANTES) as [Variante, ...Variante[]])).min(1).max(8),
  ajuste: z.enum(Object.keys(AJUSTES) as [Ajuste, ...Ajuste[]]).optional(),
  anterior: z.string().max(20000).optional(),
  modelo: z.string().optional(),
});

export const ImagemInput = z.object({
  briefing: BriefingSchema,
  formato: z.enum(["feed", "story", "linkedin"]),
  tipo: z.enum(["capa", "unico", "slide"]),
  slide: z.number().int().min(1).max(10).optional(),
  textoSlide: z.string().max(600).optional(),
  modelo: z.string().optional(),
});

export const ResultadoSchema = z.object({
  titulo: z.string(),
  ideiaCentral: z.string(),
  variantes: z.record(z.string(), z.string()),
  hashtags: z.array(z.string()).default([]),
  auditoria: z.array(z.object({ criterio: z.string(), ok: z.boolean(), nota: z.string().default("") })).default([]),
  precisaFonte: z.boolean().default(false),
  observacoes: z.string().default(""),
});
export type Resultado = z.infer<typeof ResultadoSchema>;

export const CRITERIOS_AUDITORIA = [
  "especificidade", "clareza", "profundidade", "coerência com o tema", "utilidade prática",
  "precisão clínica", "adequação à marca", "CTA permitido", "localização/assinatura exigidas",
  "limite de caracteres da rede", "ausência de repetições",
];

export const LIMITE_REDE: Record<RedeIA, number> = { instagram: 2200, linkedin: 3000, google: 1500 };

/** Prompt de usuário do modo avançado. O system com marca/CTAs vem do servidor. */
export function montarPromptTexto(b: Briefing, variantes: Variante[], ajuste?: Ajuste, anterior?: string): string {
  const linhas = [
    "BRIEFING ESTRUTURADO:",
    `- Marca/perfil: ${MARCAS[b.marca].nome}`,
    `- Público: ${MARCAS[b.marca].publico}`,
    b.telefone ? `- Telefone de contato (usar exatamente este): ${b.telefone}` : "",
    `- Tema: ${b.tema}`,
    `- Objetivo: ${b.objetivo}`,
    `- Rede principal: ${REDES_IA[b.rede]} (limite ${LIMITE_REDE[b.rede]} caracteres)`,
    `- Formato: ${b.formato}`,
    `- Nível técnico: ${b.nivel}`,
    `- Tamanho: ${b.tamanho}`,
    b.tom ? `- Tom desejado: ${b.tom}` : "",
    b.cta ? `- Chamada desejada (usar só se estiver entre as CTAs permitidas): ${b.cta}` : "",
    "",
    "PROCESSO: planeje internamente (não mostre o raciocínio). Cada texto deve conter, quando pertinente: gancho específico; ideia central; explicação clara; mecanismo/causas; implicações práticas; opções de conduta/tratamento em termos gerais; limites do conhecimento; sinais de alerta/quando procurar avaliação; CTA permitido.",
    "PROIBIDO: inventar diagnóstico individual, dose, estatística, estudo, referência ou promessa terapêutica; frases vazias; clickbait; listas sem explicação. Não há pesquisa bibliográfica ao vivo: não cite referências; se o tema exigir evidência atual, marque precisaFonte=true e escreva 'sem pesquisa bibliográfica ao vivo' em observacoes.",
    "Diferencie informação geral de orientação individual (cada caso exige avaliação profissional).",
    `VARIANTES A GERAR (somente estas chaves): ${variantes.map((v) => `${v} = ${VARIANTES[v]}`).join("; ")}.`,
    `AUDITORIA: antes de responder, avalie cada texto nos critérios: ${CRITERIOS_AUDITORIA.join(", ")}. Se algum falhar, revise o texto e só então responda. Reporte o resultado final em "auditoria".`,
  ];
  if (ajuste && anterior) {
    linhas.push("", `AJUSTE SOLICITADO: ${INSTRUCAO_AJUSTE[ajuste]}`, "TEXTO ANTERIOR (mantenha o mesmo briefing):", anterior);
  }
  linhas.push(
    "",
    'RESPONDA SOMENTE JSON válido: {"titulo": string, "ideiaCentral": string, "variantes": {<chave>: string}, "hashtags": string[], "auditoria": [{"criterio": string, "ok": boolean, "nota": string}], "precisaFonte": boolean, "observacoes": string}. Google Business sem hashtags. PT-BR impecável.',
  );
  return linhas.filter((l) => l !== "").join("\n");
}

export function lerResultado(bruto: string): Resultado {
  const ini = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("A IA não devolveu um resultado estruturado. Nada foi salvo; tente novamente.");
  let json: unknown;
  try { json = JSON.parse(bruto.slice(ini, fim + 1)); } catch { throw new Error("A resposta da IA veio incompleta. Nada foi salvo; tente novamente."); }
  const r = ResultadoSchema.safeParse(json);
  if (!r.success) throw new Error("A resposta da IA não seguiu o formato esperado. Nada foi salvo; tente novamente.");
  return r.data;
}

/** Prompt de imagem: sempre SEM texto e SEM logo; headline e logo oficial entram como camada no app. */
export function montarPromptImagem(b: Briefing, formato: FormatoIA, tipo: "capa" | "unico" | "slide", slide?: number, textoSlide?: string): string {
  const f = FORMATOS_IA[formato];
  const papel = tipo === "capa" ? "capa de carrossel" : tipo === "slide" ? `slide ${slide ?? 1} de carrossel` : "post único";
  return [
    `Imagem fotográfica profissional para ${papel}, formato ${f.nome}, perfil ${MARCAS[b.marca].nome}.`,
    ["CHICO", "LIGA"].includes(MARCAS[b.marca].visual) ? "" : MARCAS[b.marca].visual,
    `Tema exato: ${b.tema}. Objetivo: ${b.objetivo}.`,
    textoSlide ? `A cena deve ilustrar com precisão esta mensagem do slide: ${textoSlide}` : "",
    "Composição com hierarquia visual clara e uma área calma (terço superior ou inferior) para uma headline que será aplicada depois pelo sistema.",
    "NÃO escreva nenhum texto, letra, número, marca d'água ou logotipo na imagem. Não desenhe logos.",
    "Anatomia correta, instrumentos odontológicos plausíveis e não deformados, ambiente clínico/hospitalar verossímil, sem sangue ou sensacionalismo.",
  ].filter(Boolean).join("\n");
}
