import { z } from "zod";
import { PERFIS, type PerfilId } from "@/lib/studio-profiles";
import { PLANNERS_TEMAS } from "@/lib/free-studio";

/** Sugestão de temas do Estúdio: IA real (modo IA Avançada) ou regras locais (modo Gratuito). */

export const RedeTema = z.enum(["instagram", "linkedin", "google"]);
export type RedeTema = z.infer<typeof RedeTema>;

export const SugerirTemasInput = z.object({
  perfil: z.enum(["chico", "cirurgia-biopsias", "clinica-escola", "liga"]),
  objetivo: z.string().trim().max(120).default("Educar"),
  rede: RedeTema.default("instagram"),
  quantidade: z.number().int().min(3).max(6).default(4),
  evitar: z.array(z.string().max(300)).max(30).default([]),
  modelo: z.string().optional(),
});
export type SugerirTemasInput = z.infer<typeof SugerirTemasInput>;

export const SugestaoSchema = z.object({
  tema: z.string().trim().min(3).max(300),
  motivo: z.string().trim().min(3).max(500),
  formato: z.string().trim().max(80).default(""),
  abordagem: z.string().trim().max(200).default(""),
});
export type Sugestao = z.infer<typeof SugestaoSchema> & { origem: "ia" | "regras" };

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Verdadeiro se o tema repete (ou está contido em) algum item do histórico. */
export function repeteHistorico(tema: string, historico: string[]): boolean {
  const n = normalizar(tema);
  if (!n) return true;
  return historico.some((h) => {
    const x = normalizar(h);
    return !!x && (x === n || (n.length > 12 && x.includes(n)) || (x.length > 12 && n.includes(x)));
  });
}

export function montarPromptSugestoes(i: SugerirTemasInput, historico: string[]): { system: string; prompt: string } {
  const p = PERFIS[i.perfil];
  const system = [
    "Você é estrategista editorial de conteúdo odontológico (CTBMF e Odontologia Hospitalar) e escreve em português brasileiro impecável.",
    `Perfil: ${p.nome}. Público: ${p.publico}. Nível: ${p.nivel}.`,
    "Sugira temas específicos, úteis e inéditos para este perfil e público. Não invente dados, estatísticas, telefones ou credenciais.",
  ].join("\n");
  const prompt = [
    `Gere ${i.quantidade} sugestões de tema para ${i.rede === "google" ? "Google Business" : i.rede === "linkedin" ? "LinkedIn" : "Instagram"}, objetivo: ${i.objetivo}.`,
    `Exemplos de temas do perfil (referência de escopo, não copie literalmente): ${PLANNERS_TEMAS[p.temas].temas.slice(0, 12).join(" | ")}`,
    historico.length ? `ANTIRREPETIÇÃO — NÃO repita assunto nem ângulo destes conteúdos já gerados/publicados ou já sugeridos:\n- ${historico.slice(0, 40).join("\n- ")}` : "Sem histórico recente.",
    "Cada sugestão deve ter assunto diferente das demais.",
    'Responda SOMENTE JSON: {"sugestoes":[{"tema": string, "motivo": "1-2 frases explicando por que recomenda", "formato": "ex.: Carrossel 5 slides / Post único / Story", "abordagem": "ex.: mito x verdade, passo a passo"}]}',
  ].join("\n\n");
  return { system, prompt };
}

export function lerSugestoes(bruto: string, historico: string[]): Sugestao[] {
  const ini = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("A IA não devolveu sugestões de tema. Nada foi gerado; tente novamente.");
  let json: unknown;
  try { json = JSON.parse(bruto.slice(ini, fim + 1)); } catch { throw new Error("A resposta da IA veio incompleta. Tente novamente."); }
  const r = z.object({ sugestoes: z.array(SugestaoSchema).min(1) }).safeParse(json);
  if (!r.success) throw new Error("As sugestões da IA vieram fora do formato esperado. Tente novamente.");
  const vistos: string[] = [];
  const out = r.data.sugestoes.filter((s) => {
    if (repeteHistorico(s.tema, [...historico, ...vistos])) return false;
    vistos.push(s.tema);
    return true;
  });
  if (!out.length) throw new Error("Todas as sugestões da IA repetiam temas já usados. Peça outras sugestões.");
  return out.map((s) => ({ ...s, origem: "ia" as const }));
}

/** Fluxo completo com o gerador injetado (o servidor passa o gateway real). Erros sobem sem fallback. */
export async function sugerirTemasComIA(
  i: SugerirTemasInput,
  historico: string[],
  gerar: (a: { system: string; prompt: string; model?: string }) => Promise<string>,
): Promise<Sugestao[]> {
  const todos = [...historico, ...i.evitar];
  const { system, prompt } = montarPromptSugestoes(i, todos);
  const bruto = await gerar({ system, prompt, model: i.modelo });
  return lerSugestoes(bruto, todos);
}

const FORMATO_REDE: Record<RedeTema, string> = {
  instagram: "Carrossel 5 slides",
  linkedin: "Post único (texto mais aprofundado)",
  google: "Publicação Google curta",
};

/** Modo Gratuito: sugestões por REGRAS (sem IA). Ordem fixa da lista do perfil, pulando o que já foi usado/sugerido. */
export function sugerirTemasLocais(perfil: PerfilId, rede: RedeTema, evitar: string[], quantidade = 4): Sugestao[] {
  const lista = PLANNERS_TEMAS[PERFIS[perfil].temas].temas;
  const livres = lista.filter((t) => !repeteHistorico(t, evitar));
  return livres.slice(0, quantidade).map((tema) => ({
    tema,
    motivo: `Regra local: tema da lista do perfil ${PERFIS[perfil].nome} ainda não usado nesta sessão.`,
    formato: FORMATO_REDE[rede],
    abordagem: PERFIS[perfil].nivel === "tecnico" ? "explicação técnica objetiva" : "linguagem simples, dúvidas comuns",
    origem: "regras" as const,
  }));
}
