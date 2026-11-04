import { describe, expect, it, vi } from "vitest";
import { logosEscolhidos, carregarLogoManual, apresentacaoLogo } from "./post-logo";

describe("logos somente por escolha explícita", () => {
  it("Liga usa logos maiores e opacos sem ativar inserção automática", () => {
    expect(apresentacaoLogo("estudantes-graduacao")).toEqual({ sizePct: 18, prominent: true });
    expect(logosEscolhidos()).toEqual([]);
  });
  it("outros planners preservam a apresentação existente", () => {
    expect(apresentacaoLogo("chico-drfm")).toEqual({ sizePct: 10, prominent: false });
    expect(apresentacaoLogo("geral")).toEqual({ sizePct: 10, prominent: false });
  });
  it("novos posts sem seleção não recebem logo", () => {
    expect(logosEscolhidos()).toEqual([]);
    expect(logosEscolhidos([])).toEqual([]);
  });
  it("seleção vazia ou nenhuma não herda logo legado", () => {
    expect(logosEscolhidos([], "planner")).toEqual([]);
    expect(logosEscolhidos(["nenhuma", "planner"])).toEqual([]);
  });
  it("preserva escolha manual e remove duplicações", () => {
    expect(logosEscolhidos(["liga-ctbmf", "anhanguera", "liga-ctbmf"])).toEqual(["liga-ctbmf", "anhanguera"]);
    expect(logosEscolhidos(undefined, "planner")).toEqual(["planner"]);
  });
  it("editor desativado não carrega nenhum logo", async () => {
    const load = vi.fn(async () => "arquivo-original");
    expect(await carregarLogoManual(false, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it("editor só carrega arquivo ao habilitar manualmente", async () => {
    const load = vi.fn(async () => "arquivo-original");
    expect(await carregarLogoManual(true, load)).toBe("arquivo-original");
    expect(load).toHaveBeenCalledTimes(1);
  });
});