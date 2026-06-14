// Cronograma fixo de postagens do Dr. Francisco Menezes
// Segunda a Sábado: horários definidos. Domingo: posts especiais "mensagem de domingo".

export type SlotTipo = "feed" | "stories";
export type SlotRede = "instagram" | "linkedin" | "google";

export interface Slot {
  rede: SlotRede;
  tipo: SlotTipo;
  hora: number; // 0-23
  minuto: number; // 0-59
}

// Seg-Sáb (dia da semana 1..6 em getDay())
export const SLOTS_SEMANA: Slot[] = [
  // Instagram FEED
  { rede: "instagram", tipo: "feed", hora: 9, minuto: 0 },
  { rede: "instagram", tipo: "feed", hora: 15, minuto: 0 },
  { rede: "instagram", tipo: "feed", hora: 19, minuto: 0 },
  // Instagram STORIES
  { rede: "instagram", tipo: "stories", hora: 8, minuto: 0 },
  { rede: "instagram", tipo: "stories", hora: 13, minuto: 0 },
  { rede: "instagram", tipo: "stories", hora: 17, minuto: 0 },
  // LinkedIn
  { rede: "linkedin", tipo: "feed", hora: 9, minuto: 0 },
  { rede: "linkedin", tipo: "feed", hora: 17, minuto: 30 },
  // Google Business Profile (SEO local) — 1 post pela manhã + 1 à tarde
  { rede: "google", tipo: "feed", hora: 10, minuto: 30 },
  { rede: "google", tipo: "feed", hora: 16, minuto: 30 },
];

// Domingo: mensagem mais leve / inspiracional
export const SLOTS_DOMINGO: Slot[] = [
  { rede: "instagram", tipo: "feed", hora: 10, minuto: 0 },
  { rede: "instagram", tipo: "stories", hora: 9, minuto: 0 },
  { rede: "linkedin", tipo: "feed", hora: 11, minuto: 0 },
  { rede: "google", tipo: "feed", hora: 11, minuto: 30 },
];

/**
 * Gera todos os slots de postagem dos próximos N dias começando em `startDate`.
 * Retorna em ordem cronológica.
 */
export function buildScheduleSlots(startDate: Date, dias = 7) {
  const out: Array<Slot & { quando: Date; diaSemana: number }> = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dow = d.getDay(); // 0=domingo
    const slots = dow === 0 ? SLOTS_DOMINGO : SLOTS_SEMANA;
    for (const s of slots) {
      const quando = new Date(d);
      quando.setHours(s.hora, s.minuto, 0, 0);
      out.push({ ...s, quando, diaSemana: dow });
    }
  }
  return out.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

export const HORARIOS_RESUMO = {
  instagramFeed: "09h, 15h e 19h (seg-sáb)",
  instagramStories: "08h, 13h e 17h (seg-sáb)",
  linkedin: "09h e 17h30 (seg-sáb)",
  domingo: "Mensagem de domingo (IG 10h + story 9h, LinkedIn 11h)",
};
