// Seleção de redes do "Publicar em" — regra única para UI, backend e testes.
export type Rede = "instagram" | "linkedin" | "google";
export const TODAS_AS_REDES: Rede[] = ["instagram", "linkedin", "google"];
export const HORARIOS_GOOGLE = ["10:00", "15:00"] as const;

export const todasSelecionadas = (sel: Rede[]) => TODAS_AS_REDES.every((r) => sel.includes(r));

/** "Todas as redes" liga as 3 (inclusive Google Business); clicar de novo volta só ao Instagram. */
export function alternarTodas(sel: Rede[]): Rede[] {
  return todasSelecionadas(sel) ? ["instagram"] : [...TODAS_AS_REDES];
}

export function alternarRede(sel: Rede[], r: Rede): Rede[] {
  return sel.includes(r) ? sel.filter((x) => x !== r) : [...sel, r];
}

/** Flags gravadas no post — é isso que o despachante do Google Business lê. */
export function flagsDeRede(sel: Rede[]) {
  return {
    postar_instagram: sel.includes("instagram"),
    postar_linkedin: sel.includes("linkedin"),
    postar_google: sel.includes("google"),
  };
}

/**
 * Status inicial honesto: Google nunca vira "Publicado" na hora — fica "Agendado"
 * até o despachante confirmar o envio.
 */
export function statusInicial(sel: Rede[], quando: "agora" | "data" | "7dias"): "Agendado" | "Publicado" {
  if (quando !== "agora") return "Agendado";
  if (sel.includes("instagram") || sel.includes("google")) return "Agendado";
  return "Publicado";
}
