import { describe, it, expect } from "vitest";
import { withRealism, REALISM_DIRECTIVE } from "./image-realism";

describe("padrão global de realismo", () => {
  it("anexa a diretiva a qualquer prompt", () => {
    expect(withRealism("capa sobre siso")).toContain("PADRÃO VISUAL GLOBAL");
  });
  it("não duplica a diretiva", () => {
    const once = withRealism("x");
    expect(withRealism(once).split("PADRÃO VISUAL GLOBAL").length).toBe(once.split("PADRÃO VISUAL GLOBAL").length);
  });
  it("não impõe paleta global (sem hex de cor)", () => {
    expect(REALISM_DIRECTIVE).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
