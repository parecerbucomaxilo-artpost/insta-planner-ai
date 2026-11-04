import { expect, it } from "vitest";
import { planoLigaAteDia7 } from "./liga-three-days";
import { objetivoEditorial } from "./editorial-choice";
it("one extra today at 21h and all four slots on November 5–7", () => {
  const p = planoLigaAteDia7();
  expect(p).toHaveLength(13);
  expect(p[0].quando).toBe("2026-11-05T00:00:00.000Z");
  expect(p.filter(i => i.diaSemana === "Sábado").map(i => i.horario)).toEqual(["09:00", "14:00", "18:00", "21:00"]);
  expect(p.filter(i => i.formato === "Carrossel")).toHaveLength(7);
  expect(p.every(i => i.rede === "instagram")).toBe(true);
});
it("explicit editorial choice wins and random retains the slot objective", () => {
  expect(objetivoEditorial("Curiosidades", "Educar")).toBe("Curiosidades");
  expect(objetivoEditorial("Aleatória(s)", "Prevenir")).toBe("Prevenir");
});