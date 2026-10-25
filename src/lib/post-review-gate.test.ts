import { describe, it, expect } from "vitest";
import { duplicadosNoLote, podeAprovar, problemasPrevia } from "./post-review";

const base = { legenda: "Texto completo de legenda válida para o post.", tipo_post: "Post Único" } as any;
const pd = (o: any = {}, m: any = {}) => ({ post: { ...base, ...o }, media: ["u"], mediaFalhas: [], mediaAusente: [], ...m });

describe("prévia obrigatória", () => {
  it("sem prévia não aprova", () => expect(podeAprovar({ visto: false, problemas: [], ignorado: false })).toBe(false));
  it("prévia ok aprova", () => expect(podeAprovar({ visto: true, problemas: [], ignorado: false })).toBe(true));
  it("mídia ausente exige ignorar explícito", () => {
    const p = problemasPrevia(pd({}, { media: [null], mediaAusente: [0] }));
    expect(p).toContain("midia-ausente");
    expect(podeAprovar({ visto: true, problemas: p, ignorado: false })).toBe(false);
    expect(podeAprovar({ visto: true, problemas: p, ignorado: true })).toBe(true);
  });
  it("imagem que falhou e texto vazio são detectados", () => {
    expect(problemasPrevia(pd({ legenda: "" }, { mediaFalhas: [0] }))).toEqual(["sem-texto", "midia-falhou"]);
  });
  it("duplicado nunca aprova, mesmo ignorando", () =>
    expect(podeAprovar({ visto: true, problemas: ["duplicado"], ignorado: true })).toBe(false));
  it("lote: segundo post igual é marcado como duplicado", () => {
    const t = "Bruxismo: dentes gastos\n\nO bruxismo desgasta os dentes durante o sono e pode causar dor na face ao acordar. A placa de proteção feita sob medida ajuda a reduzir o desgaste e a tensão muscular.";
    expect(duplicadosNoLote([{ legenda: t }, { legenda: "Fratura de mandíbula\n\nOutro assunto totalmente diferente sobre acidentes de moto e uso de capacete." }, { legenda: t }])).toEqual([2]);
  });
});
