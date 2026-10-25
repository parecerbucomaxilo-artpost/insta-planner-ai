import { describe, it, expect } from "vitest";
import { SLOTS_SEMANA, buildScheduleSlots } from "./schedule-config";
import { FORMATO_POR_HORARIO_IG } from "./post-slots";
import { montarSemana } from "./week-plan";

const hh = (r: string, t?: string) => SLOTS_SEMANA.filter((s) => s.rede === r && (!t || s.tipo === t)).map((s) => `${String(s.hora).padStart(2, "0")}:${String(s.minuto).padStart(2, "0")}`);

describe("cronograma do Prof. Francisco (seg-sáb)", () => {
  it("Instagram: 09h story, 14h feed, 18h story, 21h feed", () => {
    expect(hh("instagram", "stories")).toEqual(["09:00", "18:00"]);
    expect(hh("instagram", "feed")).toEqual(["14:00", "21:00"]);
    expect(FORMATO_POR_HORARIO_IG).toEqual({ "09:00": "Story", "14:00": "Carrossel", "18:00": "Story", "21:00": "Carrossel" });
  });
  it("Google 10h e 15h; LinkedIn 09h e 13h", () => {
    expect(hh("google")).toEqual(["10:00", "15:00"]);
    expect(hh("linkedin")).toEqual(["09:00", "13:00"]);
  });
  it("horários no fuso de São Paulo: 14h local = 17h UTC numa terça", () => {
    const s = buildScheduleSlots(new Date("2026-10-27T03:30:00Z"), 1).find((x) => x.rede === "instagram" && x.tipo === "feed" && x.hora === 14)!;
    expect(s.quando.toISOString()).toBe("2026-10-27T17:00:00.000Z");
  });
  it("Posts 7 dias: cada horário recebe o formato do cronograma", () => {
    const sem = montarSemana(Array.from({ length: 28 }, (_, i) => `t${i}`), 4, new Date(2026, 9, 25, 12));
    expect(sem.slice(0, 4).map((i) => `${i.horario} ${i.formato}`)).toEqual(["09:00 Story", "14:00 Carrossel", "18:00 Story", "21:00 Carrossel"]);
  });
});
