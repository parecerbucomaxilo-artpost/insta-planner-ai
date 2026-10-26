import { describe, it, expect } from "vitest";
import { alternarTodas, alternarRede, flagsDeRede, statusInicial, todasSelecionadas, HORARIOS_GOOGLE } from "./networks";
import { SLOTS_SEMANA } from "./schedule-config";

describe("Publicar em", () => {
  it("Todas as redes inclui Google Business e envia postar_google=true", () => {
    const sel = alternarTodas(["instagram"]);
    expect(sel).toContain("google");
    expect(todasSelecionadas(sel)).toBe(true);
    expect(flagsDeRede(sel)).toEqual({ postar_instagram: true, postar_linkedin: true, postar_google: true });
  });
  it("Google Business sozinho só marca Google", () => {
    const sel = alternarRede([], "google");
    expect(flagsDeRede(sel)).toEqual({ postar_instagram: false, postar_linkedin: false, postar_google: true });
    expect(todasSelecionadas(sel)).toBe(false);
  });
  it("Google 'agora' nunca simula Publicado", () => {
    expect(statusInicial(["google"], "agora")).toBe("Agendado");
  });
  it("horários do Google são 10h e 15h no cronograma", () => {
    expect(HORARIOS_GOOGLE).toEqual(["10:00", "15:00"]);
    const g = JSON.stringify(SLOTS_SEMANA).toLowerCase();
    expect(g).toContain("google");
  });
});
