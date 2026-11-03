import { describe, it, expect } from "vitest";
import { montarPromptTexto, montarPromptImagem, lerResultado, BriefingSchema, MARCAS } from "./advanced-ai";

const b = BriefingSchema.parse({ marca: "chico", tema: "fratura de mandíbula", rede: "instagram", nivel: "leigo" });

describe("advanced-ai", () => {
  it("tem os quatro perfis do Estúdio, cada um com seus dados", () => {
    expect(Object.keys(MARCAS)).toEqual(["chico", "cirurgia-biopsias", "clinica-escola", "liga"]);
    expect(MARCAS.chico.nome).toBe("Planner Chico");
    expect(MARCAS.chico.audiencia).toBe("chico-drfm");
    expect(MARCAS.chico.logo).toBe("planner");
    expect(MARCAS["cirurgia-biopsias"].telefone).toBe("(19) 99018-0802");
    expect(MARCAS["cirurgia-biopsias"].paleta.destaque).toBe("#dd8e3c");
    expect(MARCAS["clinica-escola"].telefone).toBe("");
    expect(MARCAS["clinica-escola"].paleta.destaque).not.toBe("#dd8e3c");
  });
  it("briefing e imagem levam o perfil escolhido sem misturar", () => {
    const c = BriefingSchema.parse({ marca: "cirurgia-biopsias", tema: "biópsia bucal", rede: "instagram", nivel: "leigo", telefone: "(19) 99018-0802" });
    expect(montarPromptTexto(c, ["media"])).toContain("(19) 99018-0802");
    expect(montarPromptImagem(c, "feed", "capa")).toContain("#dd8e3c");
    expect(montarPromptImagem(c, "feed", "capa")).not.toContain("#2dd4ff");
  });
  it("pede só as variantes selecionadas e proíbe referências inventadas", () => {
    const p = montarPromptTexto(b, ["curta"]);
    expect(p).toContain("curta = Legenda curta");
    expect(p).not.toContain("aprofundada = ");
    expect(p).toContain("sem pesquisa bibliográfica ao vivo");
  });
  it("inclui texto anterior apenas em ajustes", () => {
    expect(montarPromptTexto(b, ["media"], "simplificar", "ANTERIOR")).toContain("ANTERIOR");
    expect(montarPromptTexto(b, ["media"])).not.toContain("AJUSTE SOLICITADO");
  });
  it("imagem nunca pede texto nem logo", () => {
    expect(montarPromptImagem(b, "feed", "capa")).toContain("NÃO escreva nenhum texto");
  });
  it("rejeita resposta sem estrutura em vez de simular", () => {
    expect(() => lerResultado("texto solto")).toThrow();
    const r = lerResultado('xx {"titulo":"T","ideiaCentral":"I","variantes":{"media":"M"}} yy');
    expect(r.variantes.media).toBe("M");
  });
});
