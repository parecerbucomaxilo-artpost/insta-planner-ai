import { describe, it, expect } from "vitest";
import { canReview, reviewStatus } from "./post-review";

describe("Revisão interna", () => {
  it("aceitar salva como rascunho, nunca agenda ou publica", () => {
    expect(reviewStatus("aceitar")).toBe("Rascunho");
  });
  it("negar preserva o post arquivado", () => {
    expect(reviewStatus("negar")).toBe("Arquivado");
  });
  it("permite decidir somente posts pendentes", () => {
    expect(canReview("PendenteAprovacao")).toBe(true);
    for (const status of ["Rascunho", "Agendado", "Publicado", "EnviadoMake", "Erro", "Arquivado"] as const) {
      expect(canReview(status)).toBe(false);
    }
  });
});