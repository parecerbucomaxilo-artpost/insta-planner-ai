// Horários padrão de postagem (horário local) e conversão segura de fuso.
// Fonte única para Posts 7 dias, planners e o agendador automático.

export const HORARIOS_POSTAGEM = ["09:00", "14:00", "18:00", "21:00"] as const;
export type HorarioPostagem = (typeof HORARIOS_POSTAGEM)[number];
export const FUSO_PADRAO = "America/Sao_Paulo";

/** Quais horários usar para 1–4 posts/dia (sempre dentre os 4 padrões, sem repetir). */
export function horariosDoDia(postsPorDia: number): HorarioPostagem[] {
  const n = Math.min(4, Math.max(1, Math.round(postsPorDia || 1)));
  const escolha: Record<number, HorarioPostagem[]> = {
    1: ["09:00"],
    2: ["09:00", "18:00"],
    3: ["09:00", "14:00", "18:00"],
    4: ["09:00", "14:00", "18:00", "21:00"],
  };
  return escolha[n];
}

export function parseHorario(h: string): { hora: number; minuto: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(h);
  if (!m) throw new Error(`Horário inválido: ${h}`);
  return { hora: Number(m[1]), minuto: Number(m[2]) };
}

/** Deslocamento (minutos) do fuso `tz` em relação ao UTC no instante `d`. */
function offsetMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** Instante UTC correspondente a ano/mês/dia + "HH:MM" no fuso `tz` (sem depender do fuso do servidor). */
export function horarioNoFuso(ano: number, mes0: number, dia: number, horario: string, tz = FUSO_PADRAO): Date {
  const { hora, minuto } = parseHorario(horario);
  const guess = new Date(Date.UTC(ano, mes0, dia, hora, minuto));
  const off = offsetMinutes(guess, tz);
  const result = new Date(guess.getTime() - off * 60000);
  const off2 = offsetMinutes(result, tz); // ajuste em transição de horário de verão
  return off2 === off ? result : new Date(guess.getTime() - off2 * 60000);
}

/** Ano/mês/dia de um instante visto no fuso `tz`. */
export function diaNoFuso(d: Date, tz = FUSO_PADRAO): { ano: number; mes0: number; dia: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { ano: Number(get("year")), mes0: Number(get("month")) - 1, dia: Number(get("day")), dow: dows.indexOf(get("weekday")) };
}
