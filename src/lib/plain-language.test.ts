import { describe, it, expect } from "vitest";
import { plainLanguageRule, isPublicoTecnico } from "./plain-language";

describe("linguagem por público", () => {
  it("público geral recebe a regra de linguagem simples", () => {
    expect(plainLanguageRule({ audiencia: "geral" })).toContain("PÚBLICO GERAL");
  });
  it("estudantes mantêm nível técnico", () => {
    expect(isPublicoTecnico({ audiencia: "estudantes-graduacao" })).toBe(true);
    expect(plainLanguageRule({ audiencia: "estudantes-graduacao" })).toContain("público técnico");
  });
  it("LinkedIn científico mantém nível técnico", () => {
    expect(isPublicoTecnico({ nivel: "linkedin-cientifico" })).toBe(true);
  });
  it("IG conversão usa linguagem simples", () => {
    expect(isPublicoTecnico({ audiencia: "geral", nivel: "ig-conversao" })).toBe(false);
  });
});
