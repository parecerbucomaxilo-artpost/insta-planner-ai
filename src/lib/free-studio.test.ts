import { describe, it, expect } from "vitest";
import { statusRede, revisarTexto, sugerirHashtags, gerarGanchos, modeloLegenda, CTAS_PERMITIDOS, TERMOS_PROIBIDOS } from "./free-studio";

describe("free-studio", () => {
  it("limites por rede: Instagram 2200, LinkedIn 3000, Google 1500", () => {
    expect(statusRede("a".repeat(2201), "instagram").excedeu).toBe(true);
    expect(statusRede("a".repeat(2200), "instagram").excedeu).toBe(false);
    expect(statusRede("a".repeat(3000), "linkedin").excedeu).toBe(false);
    expect(statusRede("a".repeat(1501), "google").excedeu).toBe(true);
  });
  it("emoji composto conta como 1 caractere", () => {
    expect(statusRede("👨‍⚕️", "instagram").usado).toBe(1);
  });
  it("sinaliza CTAs proibidas e preços", () => {
    const tipos = revisarTexto("Agende sua consulta hoje com desconto por R$ 100").map((p) => p.tipo);
    expect(tipos.filter((t) => t === "marca").length).toBeGreaterThanOrEqual(3);
  });
  it("detecta palavra repetida e erro comum", () => {
    const msgs = revisarTexto("Isso é é importante, concerteza.").map((p) => p.mensagem).join(" ");
    expect(msgs).toContain("é é");
    expect(msgs).toContain("com certeza");
  });
  it("Google Business não recebe hashtags; LinkedIn no máximo 5", () => {
    expect(sugerirHashtags("siso", "google")).toEqual([]);
    expect(sugerirHashtags("siso", "linkedin").length).toBeLessThanOrEqual(5);
    expect(sugerirHashtags("siso", "instagram")).toContain("#dentedosiso");
  });
  it("CTAs permitidas não contêm termos proibidos", () => {
    for (const lista of Object.values(CTAS_PERMITIDOS)) for (const c of lista) for (const t of TERMOS_PROIBIDOS) expect(c.toLowerCase()).not.toContain(t);
  });
  it("modelos e ganchos usam o tema", () => {
    expect(gerarGanchos("")).toEqual([]);
    expect(gerarGanchos("bruxismo")[0]).toContain("Bruxismo");
    expect(modeloLegenda("educativo", "bruxismo", "instagram")).toContain("bruxismo");
  });
});

import { sortearTema, PLANNERS_TEMAS } from "./free-studio";
describe("sortearTema", () => {
  it("sorteia do planner escolhido e não repete os recentes", () => {
    const lista = PLANNERS_TEMAS.liga.temas;
    const recentes = lista.slice(0, lista.length - 1);
    expect(sortearTema("liga", [...recentes], () => 0)).toBe(lista[lista.length - 1]);
    expect(PLANNERS_TEMAS.chico.temas).toContain(sortearTema("chico", []));
  });
});
