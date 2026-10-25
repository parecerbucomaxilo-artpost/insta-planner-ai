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

import { FUSO_PADRAO, diaNoFuso, horarioNoFuso } from "./post-slots";

// Seg-Sáb (dia da semana 1..6 em getDay())
export const SLOTS_SEMANA: Slot[] = [
  // Instagram — 4/dia: 09h story · 14h feed (carrossel 5 slides) · 18h story · 21h feed (carrossel 5 slides)
  { rede: "instagram", tipo: "stories", hora: 9, minuto: 0 },
  { rede: "instagram", tipo: "feed", hora: 14, minuto: 0 },
  { rede: "instagram", tipo: "stories", hora: 18, minuto: 0 },
  { rede: "instagram", tipo: "feed", hora: 21, minuto: 0 },
  // LinkedIn — 2/dia
  { rede: "linkedin", tipo: "feed", hora: 9, minuto: 0 },
  { rede: "linkedin", tipo: "feed", hora: 13, minuto: 0 },
  // Google Business Profile — 2/dia
  { rede: "google", tipo: "feed", hora: 10, minuto: 0 },
  { rede: "google", tipo: "feed", hora: 15, minuto: 0 },
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
export function buildScheduleSlots(startDate: Date, dias = 7, tz = FUSO_PADRAO) {
  // Horários são do fuso do projeto (não do servidor, que roda em UTC): 09:00 = 09:00 em São Paulo.
  const out: Array<Slot & { quando: Date; diaSemana: number }> = [];
  const hoje = diaNoFuso(startDate, tz);
  for (let i = 0; i < dias; i++) {
    const base = new Date(Date.UTC(hoje.ano, hoje.mes0, hoje.dia + i, 12));
    const ano = base.getUTCFullYear(),
      mes0 = base.getUTCMonth(),
      dia = base.getUTCDate();
    const dow = base.getUTCDay(); // 0=domingo
    const slots = dow === 0 ? SLOTS_DOMINGO : SLOTS_SEMANA;
    for (const s of slots) {
      const hhmm = `${String(s.hora).padStart(2, "0")}:${String(s.minuto).padStart(2, "0")}`;
      out.push({ ...s, quando: horarioNoFuso(ano, mes0, dia, hhmm, tz), diaSemana: dow });
    }
  }
  return out.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

export const HORARIOS_RESUMO = {
  instagramFeed: "14h e 21h — carrossel de 5 slides (seg-sáb)",
  instagramStories: "09h e 18h (seg-sáb)",
  linkedin: "09h e 13h (seg-sáb)",
  google: "10h e 15h (seg-sáb)",
  domingo: "Mensagem de domingo (IG 10h + story 9h, LinkedIn 11h)",
};
