import { describe, expect, it } from "vitest";
import { PERFIS } from "./studio-profiles";
import { BRAND_BOOK, BRAND_IMAGE_STYLE } from "./brand-book";
import { BriefingSchema, montarPromptImagem } from "./advanced-ai";

describe("referências laranja dos três perfis", () => {
  it.each(["cirurgia-biopsias", "clinica-escola", "liga"] as const)("%s aplica laranja, preto e branco em todos os formatos", (marca) => {
    expect(PERFIS[marca].paleta).toEqual({ fundo1: "#000000", fundo2: "#545454", destaque: "#FF5A00", texto: "#FFFFFF", confirmada: true });
    const briefing = BriefingSchema.parse({ marca, tema: "Cuidados após cirurgia", rede: "instagram", nivel: "leigo" });
    for (const formato of ["feed", "story"] as const) {
      for (const tipo of ["unico", "capa", "slide"] as const) {
        const prompt = montarPromptImagem(briefing, formato, tipo, 2, "Cuidados com a recuperação");
        expect(prompt).toContain("#FF5A00");
        expect(prompt).toContain("#000000");
        expect(prompt).toContain("#FFFFFF");
      }
    }
  });
  it("mantém a Liga sincronizada com o gerador compartilhado", () => {
    expect(BRAND_BOOK.lactbmf.paleta.secondary).toBe(PERFIS.liga.paleta.destaque);
    expect(BRAND_IMAGE_STYLE.lactbmf.identidade).toContain("#FF5A00");
  });
  it("preserva Chico e a ausência de logo da Clínica Escola", () => {
    expect(PERFIS.chico.paleta.destaque).toBe("#2dd4ff");
    expect(BRAND_BOOK.drfranciscomenezes.paleta.primary).toBe("#0c2340");
    expect(PERFIS["clinica-escola"].logo).toBe("nenhuma");
    expect(PERFIS["clinica-escola"].telefone).toBe("");
  });
});