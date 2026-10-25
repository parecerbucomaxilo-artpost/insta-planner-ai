import { describe, it, expect } from "vitest";
import { montarSemana, proximaSegunda } from "./week-plan";

describe("Posts 7 dias", () => {
  const quarta = new Date(2026, 9, 21, 10, 0); // quarta 21/10/2026
  it("começa na segunda e termina no domingo", () => {
    const s = montarSemana(["a", "b"], 1, quarta);
    expect(s).toHaveLength(7);
    expect(s[0].diaSemana).toBe("Segunda");
    expect(s[6].diaSemana).toBe("Domingo");
    expect(proximaSegunda(quarta).getDate()).toBe(26);
  });
  it("1 post por dia por padrão e até 3 quando editado", () => {
    expect(montarSemana(["a"], undefined, quarta)).toHaveLength(7);
    expect(montarSemana(["a"], 2, quarta)).toHaveLength(14);
    expect(montarSemana(["a"], 9, quarta)).toHaveLength(21);
  });
  it("nenhuma data no passado", () => {
    const seg = new Date(2026, 9, 26, 12, 0);
    for (const i of montarSemana(["a"], 1, seg)) expect(new Date(i.quando).getTime()).toBeGreaterThan(seg.getTime());
  });
});
