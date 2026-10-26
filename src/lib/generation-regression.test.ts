import { describe, it, expect } from "vitest";
import { completeCaptionIfNeeded, slidesNaoChico } from "./ai-post.functions";
import { acharConflito } from "./dedup";
import { quantidadeSlides } from "./carousel-slides";
import { POSTS_POR_DIA_PADRAO } from "./post-slots";

// Regressão: "o app não gera nada". Legendas curtas de temas sem roteiro próprio recebiam
// os mesmos parágrafos fixos; a dedup via texto igual ao histórico e recusava as 3 tentativas.
const base = { rede: "instagram" as const, formato: "Post Único" as const, audiencia: "pacientes" as any, especialidade: "CTBMF" };

describe("geração não trava em texto de preenchimento", () => {
  it("tema genérico curto não recebe parágrafos fixos", () => {
    const out = completeCaptionIfNeeded({ ...base, tema: "Cuidar da saúde da boca", legenda: "Texto curto sobre boca." });
    expect(out).not.toMatch(/Ganho real: entender a causa real/);
    expect(out).not.toMatch(/Por que acontece: dor, inflamação/);
  });

  it("dois posts genéricos diferentes não viram duplicata entre si", () => {
    const a = completeCaptionIfNeeded({ ...base, tema: "Cuidar da saúde da boca", legenda: "Escovar à noite protege a gengiva e evita mau hálito persistente pela manhã." });
    const b = completeCaptionIfNeeded({ ...base, tema: "Bem-estar e sorriso", legenda: "Beber água ao longo do dia ajuda a saliva a limpar os dentes naturalmente." });
    expect(acharConflito({ tema: "", corpo: a }, [{ tema: "", corpo: b }])).toBeNull();
  });

  it("story genérico não recebe bloco fixo", () => {
    const out = completeCaptionIfNeeded({ ...base, formato: "Story", tema: "Cuidar da saúde da boca", legenda: "Curto." });
    expect(out).not.toMatch(/O que fazer: o caminho seguro/);
  });

  it("carrossel IG feed usa os 5 slides escritos pela IA", () => {
    const n = quantidadeSlides({ rede: "instagram", formato: "Carrossel", tipo: "feed" } as any);
    expect(n).toBe(5);
    const legenda = [1, 2, 3, 4, 5].map((i) => `Slide ${i}: conteúdo próprio número ${i} sobre escovação.`).join("\n\n");
    expect(slidesNaoChico(legenda, "Cuidar da saúde da boca", "pacientes" as any, n)).toHaveLength(5);
  });

  it("carrossel genérico sem slides da IA dá erro claro em vez de roteiro repetido", () => {
    expect(() => slidesNaoChico("texto sem slides", "Cuidar da saúde da boca", "pacientes" as any, 5)).toThrow(/Nada foi salvo/);
  });

  it("Posts 7 dias mantém 4 posts por dia", () => {
    expect(POSTS_POR_DIA_PADRAO).toBe(4);
  });
});
