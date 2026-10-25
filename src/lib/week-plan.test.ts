import { describe, it, expect } from "vitest";
import { montarSemana, proximaSegunda } from "./week-plan";
import { horariosDoDia, horarioNoFuso, diaNoFuso } from "./post-slots";
import { buildScheduleSlots } from "./schedule-config";
import { batchDuplicates, chaveIdempotencia, similarity } from "./dedup";

const quarta = new Date(2026, 9, 21, 10, 0); // quarta 21/10/2026 (local)
const temas = Array.from({ length: 28 }, (_, i) => `Tema distinto número ${i} sobre assunto ${String.fromCharCode(65 + (i % 26))}${i}`);

describe("Posts 7 dias — slots e horários", () => {
  it("começa na segunda e termina no domingo", () => {
    const s = montarSemana(temas, 1, quarta);
    expect(s).toHaveLength(7);
    expect(s[0].diaSemana).toBe("Segunda");
    expect(s[6].diaSemana).toBe("Domingo");
    expect(proximaSegunda(quarta).getDate()).toBe(26);
  });

  it("4 posts/dia saem exatamente às 09:00, 14:00, 18:00 e 21:00 (hora local)", () => {
    const s = montarSemana(temas, 4, quarta);
    expect(s).toHaveLength(28);
    const seg = s.slice(0, 4);
    expect(seg.map((i) => i.horario)).toEqual(["09:00", "14:00", "18:00", "21:00"]);
    expect(seg.map((i) => [new Date(i.quando).getHours(), new Date(i.quando).getMinutes()])).toEqual([[9, 0], [14, 0], [18, 0], [21, 0]]);
    expect(seg.every((i) => new Date(i.quando).getDate() === 26)).toBe(true);
  });

  it("1, 2 e 3 posts/dia usam horários dentre os 4 padrões, sem repetir", () => {
    expect(horariosDoDia(1)).toEqual(["09:00"]);
    expect(horariosDoDia(2)).toEqual(["09:00", "18:00"]);
    expect(horariosDoDia(3)).toEqual(["09:00", "14:00", "18:00"]);
    expect(horariosDoDia(9)).toEqual(["09:00", "14:00", "18:00", "21:00"]);
    expect(montarSemana(temas, 2, quarta)).toHaveLength(14);
    expect(montarSemana(temas, 3, quarta)).toHaveLength(21);
  });

  it("uma operação = um item por slot, e cada slot recebe tema próprio (sem rotação cíclica)", () => {
    const s = montarSemana(temas, 4, quarta);
    expect(new Set(s.map((i) => i.key)).size).toBe(s.length);
    expect(new Set(s.map((i) => i.tema)).size).toBe(s.length);
    expect(batchDuplicates(s.map((i) => i.tema))).toEqual([]);
    // Poucos temas: os slots restantes ficam vazios (para edição), nunca repetem o tema.
    const curto = montarSemana(["Siso", "Bruxismo"], 4, quarta);
    expect(curto.filter((i) => i.tema).map((i) => i.tema)).toEqual(["Siso", "Bruxismo"]);
  });

  it("nenhuma data no passado", () => {
    const seg = new Date(2026, 9, 26, 12, 0);
    for (const i of montarSemana(temas, 4, seg)) expect(new Date(i.quando).getTime()).toBeGreaterThan(seg.getTime());
  });
});

describe("Fuso do agendador automático", () => {
  it("09:00 em São Paulo = 12:00 UTC (sem deslocar para o fuso do servidor)", () => {
    expect(horarioNoFuso(2026, 9, 26, "09:00").toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(horarioNoFuso(2026, 9, 26, "21:00").toISOString()).toBe("2026-10-27T00:00:00.000Z");
  });

  it("feed do Instagram (seg-sáb) usa 09:00, 14:00, 18:00 e 21:00 no fuso do projeto", () => {
    const slots = buildScheduleSlots(new Date("2026-10-26T03:30:00Z"), 1) // segunda 00:30 em SP
      .filter((s) => s.rede === "instagram" && s.tipo === "feed");
    expect(slots.map((s) => s.quando.toISOString())).toEqual([
      "2026-10-26T12:00:00.000Z", "2026-10-26T17:00:00.000Z", "2026-10-26T21:00:00.000Z", "2026-10-27T00:00:00.000Z",
    ]);
    expect(diaNoFuso(slots[3].quando).dia).toBe(26); // 21:00 continua sendo segunda em SP
  });
});

describe("Idempotência por operação/slot", () => {
  const base = { rede: "instagram", quando: "2026-10-26T12:00:00.000Z" };
  it("double-click/retry no mesmo slot gera a mesma chave (o banco recusa o 2º insert)", () => {
    const a = chaveIdempotencia("u1", "Siso", "Carrossel", { ...base, operacaoId: "op1", slotKey: "2026-10-26T09:00" });
    const b = chaveIdempotencia("u1", "Siso", "Carrossel", { ...base, operacaoId: "op1", slotKey: "2026-10-26T09:00" });
    expect(a).toBe(b);
  });
  it("slots diferentes da mesma operação têm chaves diferentes", () => {
    const keys = ["09:00", "14:00", "18:00", "21:00"].map((h) => chaveIdempotencia("u1", `t${h}`, "Carrossel", { ...base, operacaoId: "op1", slotKey: `2026-10-26T${h}` }));
    expect(new Set(keys).size).toBe(4);
  });
  it("sem slot, mesmo tema no mesmo dia também é idempotente", () => {
    expect(chaveIdempotencia("u1", "Siso!", "Story", base)).toBe(chaveIdempotencia("u1", "siso", "Story", base));
  });
  it("4 textos de horários diferentes não são considerados iguais", () => {
    const textos = ["Siso incluso: quando operar", "Bruxismo noturno e dor na ATM", "Fratura de mandíbula após acidente", "Higiene oral na UTI reduz pneumonia"];
    expect(batchDuplicates(textos)).toEqual([]);
    expect(similarity(textos[0], textos[1])).toBeLessThan(0.5);
  });
});
