import { describe, expect, it } from "vitest";
import { ASSINATURA_CHICO, EIXOS_CHICO, PAUTAS_CHICO, TEMAS_CTBMF_CHICO, conteudoEditorialChico } from "./chico-editorial";
import { PLANNERS_TEMAS } from "./free-studio";
import { TEMAS_ESTUDANTES, TEMAS_CLINICA_ESCOLA, TRATAMENTOS } from "./planner-temas";
import { PERFIS } from "./studio-profiles";

describe("linha editorial isolada do Chico", () => {
  it("cobre todos os eixos solicitados com pautas únicas", () => {
    for (const id of ["trauma-facial", "fraturas-faciais", "trauma-dentoalveolar", "ortognatica", "patologias-maxilares", "cistos-maxilares", "infeccoes", "atm", "dentes-inclusos", "reconstrucao", "diagnostico", "prevencao-atendimento"]) {
      const eixo = EIXOS_CHICO.find(e => e.id === id);
      expect(eixo?.temas.length).toBeGreaterThan(0);
    }
    expect(new Set(PAUTAS_CHICO.map(p => p.id)).size).toBe(PAUTAS_CHICO.length);
    expect(new Set(TEMAS_CTBMF_CHICO).size).toBe(TEMAS_CTBMF_CHICO.length);
  });
  it("não altera os catálogos de outros planners", () => {
    expect(PLANNERS_TEMAS.chico.temas).toBe(TEMAS_CTBMF_CHICO);
    expect(PLANNERS_TEMAS.liga.temas).toBe(TEMAS_ESTUDANTES);
    expect(PLANNERS_TEMAS["clinica-escola"].temas).toBe(TEMAS_CLINICA_ESCOLA);
    expect(PLANNERS_TEMAS["cirurgia-biopsias"].temas).toEqual(TRATAMENTOS.map(t => t.label));
  });
  it("oferece os quatro formatos sem executar geração ou salvar posts", () => {
    expect(new Set(PAUTAS_CHICO.map(p => p.formato))).toEqual(new Set(["Carrossel", "Post único", "Roteiro de reel", "Stories"]));
    for (const p of PAUTAS_CHICO) for (const formato of ["Carrossel", "Post único", "Roteiro de reel", "Stories"] as const) {
      expect(conteudoEditorialChico(p.tema, formato)?.length).toBeGreaterThan(0);
    }
    expect(conteudoEditorialChico("Tema não cadastrado", "Post único")).toBeNull();
  });
  it("mantém assinatura exata única e identidade visual sem alterar o arquivo de logo", () => {
    expect(ASSINATURA_CHICO).toBe("Francisco Menezes — CROSP 53318");
    expect(PERFIS.chico.assinatura).toBe(ASSINATURA_CHICO);
    for (const formato of ["Carrossel", "Post único", "Roteiro de reel", "Stories"] as const) {
      expect(conteudoEditorialChico(PAUTAS_CHICO[0].tema, formato)?.split(ASSINATURA_CHICO).length).toBe(2);
    }
    expect(PERFIS.chico.paleta.fundo1).toBe("#0c2340");
    expect(PERFIS.chico.paleta.destaque).toBe("#2dd4ff");
    expect(PERFIS.chico.logo).toBe("planner");
  });
});