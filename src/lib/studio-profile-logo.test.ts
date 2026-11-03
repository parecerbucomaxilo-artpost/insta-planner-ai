import { describe, expect, it } from "vitest";
import { PERFIS } from "./studio-profiles";
import { getLogoOption, getLogoOptions } from "./logos-catalog";
import { MARCAS } from "./advanced-ai";

describe("logos por perfil", () => {
  it("Clínica Escola não resolve nenhum overlay, inclusive no briefing IA", () => {
    expect(PERFIS["clinica-escola"].logo).toBe("nenhuma");
    expect(getLogoOption(PERFIS["clinica-escola"].logo)?.url).toBe("");
    expect(getLogoOptions([PERFIS["clinica-escola"].logo])).toEqual([]);
    expect(MARCAS["clinica-escola"].logo).toBe("nenhuma");
  });
  it.each([
    ["chico", "planner"],
    ["cirurgia-biopsias", "clinica-escola"],
    ["liga", "liga-ctbmf"],
  ] as const)("preserva a logo de %s", (id, key) => {
    expect(PERFIS[id].logo).toBe(key);
    expect(getLogoOptions([PERFIS[id].logo])).toHaveLength(1);
    expect(getLogoOption(PERFIS[id].logo)?.url).toBeTruthy();
  });
});