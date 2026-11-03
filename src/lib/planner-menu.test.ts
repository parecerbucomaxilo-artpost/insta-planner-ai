import { describe, expect, it, vi } from "vitest";
import { itemAtual, selecionarItemMenu } from "./planner-menu";

describe("menu deslizante do Planner", () => {
  it("selecionar item navega para a seção e fecha o menu", () => {
    const setTab = vi.fn();
    const setMenu = vi.fn();
    selecionarItemMenu({ v: "calendario" }, setTab, setMenu);
    expect(setTab).toHaveBeenCalledWith("calendario");
    expect(setMenu).toHaveBeenCalledWith(false);
  });

  it("fecha o menu mesmo se a ação extra do item falhar", () => {
    const setMenu = vi.fn();
    expect(() =>
      selecionarItemMenu({ v: "todos", onSel: () => { throw new Error("x"); } }, vi.fn(), setMenu),
    ).toThrow();
    expect(setMenu).toHaveBeenCalledWith(false);
  });

  it("botão mostra a seção atual ou a primeira", () => {
    const itens = [{ v: "criar" }, { v: "perfil" }];
    expect(itemAtual(itens, "perfil").v).toBe("perfil");
    expect(itemAtual(itens, "inexistente").v).toBe("criar");
  });
});
