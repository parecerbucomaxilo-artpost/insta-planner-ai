import { describe, expect, it } from "vitest";
import { PERFIS } from "./studio-profiles";
import { getLogoOption, getLogoOptions } from "./logos-catalog";
import { MARCAS } from "./advanced-ai";

describe("logos por perfil", () => {
  it("Clínica Escola usa somente Anhanguera, sem inventar logo próprio", () => {
    expect(PERFIS["clinica-escola"].logo).toBe("anhanguera");
    expect(getLogoOptions([PERFIS["clinica-escola"].logo]).map(l => l.key)).toEqual(["anhanguera"]);
    expect(MARCAS["clinica-escola"].logo).toBe("anhanguera");
  });
  it.each([
    ["chico", "planner"],
    ["cirurgia-biopsias", "clinica-escola"],
    ["liga", "liga-ctbmf"],
  ] as const)("preserva a logo de %s", (id, key) => {
    expect(PERFIS[id].logo).toBe(key);
    expect(getLogoOptions([PERFIS[id].logo]).map(l => l.key)).toEqual(id === "chico" ? [key] : [key, "anhanguera"]);
    expect(getLogoOption(PERFIS[id].logo)?.url).toBeTruthy();
  });
  it("não duplica Anhanguera e respeita a escolha sem logo", () => {
    expect(getLogoOptions(["liga-ctbmf", "anhanguera"]).map(l => l.key)).toEqual(["liga-ctbmf", "anhanguera"]);
    expect(getLogoOptions(["nenhuma"])).toEqual([]);
  });
});