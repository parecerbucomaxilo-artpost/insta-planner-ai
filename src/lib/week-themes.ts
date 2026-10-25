// Distribui temas para TODOS os slots do cronograma (Instagram story/feed, Google, LinkedIn).
// Causa raiz corrigida: antes os temas ciclavam (`i % base.length`) e os stories copiavam o
// tema do feed — o mesmo assunto aparecia em vários horários e redes. Agora cada slot recebe
// um tema com assunto-raiz próprio; slot sem tema inédito fica vazio (nunca copia).
import { planDistinctTopics } from "./dedup";
import type { Slot } from "./schedule-config";

export type FormatoSlot = "Carrossel" | "Story" | "Post Único";

export function formatoDoSlot(s: Pick<Slot, "rede" | "tipo">): FormatoSlot {
  if (s.tipo === "stories") return "Story";
  if (s.rede === "instagram") return "Carrossel"; // feed do IG = carrossel de 5 slides
  return "Post Único";
}

export type SlotTema = {
  rede: Slot["rede"];
  tipo: Slot["tipo"];
  quando: string;
  formato: FormatoSlot;
  tema: string;
  gancho: string;
};

export function distribuirTemas(
  slots: Array<Slot & { quando: Date }>,
  base: string[],
  historico: string[] = [],
): SlotTema[] {
  const temas = planDistinctTopics(base, historico, slots.length);
  return slots.map((s, i) => {
    const tema = temas[i] ?? "";
    const formato = formatoDoSlot(s);
    return {
      rede: s.rede,
      tipo: s.tipo,
      quando: s.quando.toISOString(),
      formato,
      tema,
      gancho: tema ? `${formato === "Story" ? "Story" : formato === "Carrossel" ? "Carrossel" : s.rede === "google" ? "Google" : "LinkedIn"}: ${tema}` : "",
    };
  });
}
