import { describe, it, expect } from "vitest";
import { montarPromptTexto, montarPromptImagem, lerResultado, BriefingSchema, MARCAS } from "./advanced-ai";

const b = BriefingSchema.parse({ marca: "drfm", tema: "fratura de mandíbula", rede: "instagram", nivel: "leigo" });

describe("advanced-ai", () => {
  it("separa marcas por audiência e logo oficial", () => {
    expect(MARCAS.drfm.audiencia).toBe("chico-drfm");
    expect(MARCAS.lactbmf.audiencia).toBe("estudantes-graduacao");
    expect(MARCAS.drfm.logo).toBe("planner");
    expect(MARCAS.lactbmf.logo).toBe("liga-ctbmf");
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
