import { describe, it, expect } from "vitest";
import { aplicarDashboard, contextoDashboard, perfilDashboardDe } from "./dashboard-context";

const U = "user-1";
const chico = { user_id: U, nome_profissional: "Francisco Menezes", instagram_arroba: "@drfranciscomenezes", arroba_usuario: "", cro_uf: "SP", subespecialidades: ["Ortognática"], tom_voz: "Humanizado" };
const liga = { user_id: U, nome_profissional: "Liga LACTBMF", instagram_arroba: "lactbmf.anhanguerasbo", arroba_usuario: "", cro_uf: "", subespecialidades: [], tom_voz: "Científico" };
const vazio = { objetivo: "", tom: "", contexto: "" };

describe("Contexto do Dashboard no Planner", () => {
  it("perfil completo preenche contexto e tom com valores reais", () => {
    const c = contextoDashboard(perfilDashboardDe([chico, liga], "chico", U));
    expect(aplicarDashboard(vazio, c, new Set())).toEqual({ objetivo: "", tom: "Humanizado", contexto: "Profissional: Francisco Menezes · Área de atuação: Ortognática · SP" });
  });
  it("objetivo cadastrado é usado; ausente fica vazio", () => {
    expect(aplicarDashboard(vazio, contextoDashboard({ ...chico, objetivo: "Fortalecer autoridade" }), new Set()).objetivo).toBe("Fortalecer autoridade");
    expect(contextoDashboard({ user_id: U }).objetivo).toBe("");
    expect(aplicarDashboard(vazio, contextoDashboard({ user_id: U }), new Set())).toEqual(vazio);
  });
  it("texto manual é preservado; só o botão substitui", () => {
    const c = contextoDashboard(chico);
    const manual = { objetivo: "Prevenir", tom: "leve", contexto: "meu texto" };
    expect(aplicarDashboard(manual, c, new Set(["tom", "contexto", "objetivo"] as const))).toEqual(manual);
    expect(aplicarDashboard({ ...vazio, tom: "" }, c, new Set(["tom"] as const)).tom).toBe("");
    expect(aplicarDashboard(manual, c, new Set(["tom"] as const), true).tom).toBe("Humanizado");
  });
  it("isolamento: perfis e usuários não misturam dados", () => {
    expect(perfilDashboardDe([chico, liga], "liga", U)?.nome_profissional).toBe("Liga LACTBMF");
    expect(perfilDashboardDe([chico], "liga", U)).toBeNull();
    expect(perfilDashboardDe([chico], "clinica-escola", U)).toBeNull();
    expect(perfilDashboardDe([chico], "chico", "outro-user")).toBeNull();
  });
});
