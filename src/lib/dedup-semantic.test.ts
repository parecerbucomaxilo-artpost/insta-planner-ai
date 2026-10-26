import { describe, expect, it } from "vitest";
import {
  acharConflito,
  assuntoPrincipal,
  conflitosNoLote,
  corpoEditorial,
  planDistinctTopics,
  chaveIdempotencia,
} from "./dedup";
import { horariosDoDia } from "./post-slots";

// Casos reais do lote de 25/10/2026 que passaram como "inéditos" e eram o mesmo assunto.
const ORTO = [
  "Distração osteogênica em deformidades craniofaciais — mito ou verdade",
  "Cirurgia ortognática Classe III: prognatismo e planejamento facial — passo a passo do tratamento",
  "Quando a mordida interfere na mastigação, respiração e fala — pergunta frequente do consultório",
];
const MASSETER = [
  "Toxina botulínica em hipertrofia de masseter: indicação técnica correta — caso clínico ilustrativo",
  "Cefaleia de origem miofascial: quando o masseter é o vilão — sinais de alerta que muita gente ignora",
];

describe("dedup semântico — assunto-raiz", () => {
  it("títulos diferentes sobre o mesmo assunto caem no mesmo assunto-raiz", () => {
    expect(new Set(ORTO.map(assuntoPrincipal))).toEqual(new Set(["ortognatica-deformidades"]));
    expect(new Set(MASSETER.map(assuntoPrincipal))).toEqual(new Set(["bruxismo-masseter"]));
    expect(assuntoPrincipal("Implante zigomático: maxila reabsorvida")).toBe("implantes-enxertos");
    expect(assuntoPrincipal("Fratura de zigoma: afundamento facial")).toBe("trauma-facial");
    expect(assuntoPrincipal("Odontoma: o tumor mais comum dos maxilares")).not.toBe(
      assuntoPrincipal("Sialolitíase: pedra na glândula salivar"),
    );
  });

  it("no mesmo lote, mantém só o primeiro de cada assunto (exato e semântico)", () => {
    const lote = [
      ORTO[0],
      MASSETER[0],
      "Sialolitíase: pedra na glândula salivar — o que a ciência recente mostra",
      ORTO[1],
      MASSETER[1],
      ORTO[2],
      "Odontoma: o tumor mais comum dos maxilares — erro comum e como evitar",
      ORTO[0], // duplicata exata
    ].map((tema) => ({ tema, quando: "2026-10-26T12:00:00.000Z" }));
    expect(conflitosNoLote(lote)).toEqual([3, 4, 5, 7]);
  });

  it("contra o histórico: mesmo assunto a menos de 6 dias é bloqueado; negado (arquivado) libera", () => {
    const hist = [{ tema: ORTO[1], quando: "2026-10-28T12:00:00.000Z" }];
    // Mesmo assunto, ângulo diferente: bloqueado no mesmo dia, aceito em outro dia.
    expect(acharConflito({ tema: ORTO[2], quando: "2026-10-28T20:00:00.000Z" }, hist)?.motivo).toBe(
      "assunto-na-janela",
    );
    expect(acharConflito({ tema: ORTO[2], quando: "2026-10-30T12:00:00.000Z" }, hist)).toBeNull();
    // Sem ângulo explícito, vale a janela inteira.
    expect(acharConflito({ tema: "Cirurgia ortognática", quando: "2026-10-30T12:00:00.000Z" }, [{ tema: "Mordida cruzada", quando: "2026-10-28T12:00:00.000Z" }])?.motivo).toBe("assunto-na-janela");
    expect(acharConflito({ tema: ORTO[2], quando: "2026-11-10T12:00:00.000Z" }, hist)).toBeNull();
    expect(
      acharConflito({ tema: ORTO[2], quando: "2026-10-30T12:00:00.000Z" }, [
        { ...hist[0], status: "Arquivado" },
      ]),
    ).toBeNull();
  });

  it("mesmo assunto + mesmo ângulo é repetição em qualquer data recente", () => {
    const hist = [{ tema: "Siso incluso — mito ou verdade", quando: "2026-09-01T12:00:00.000Z" }];
    expect(
      acharConflito(
        {
          tema: "Coronectomia do terceiro molar — mito ou verdade",
          quando: "2026-10-30T12:00:00.000Z",
        },
        hist,
      )?.motivo,
    ).toBe("assunto-e-angulo");
  });

  it("detecta corpo essencialmente igual com título diferente, ignorando assinatura/CTA/hashtags", () => {
    const corpo =
      "Isso acontece porque dor, inflamação, sobrecarga muscular, posição dos dentes e alterações anatômicas podem produzir sintomas parecidos. O caminho seguro é avaliação clínica, exame de imagem quando necessário e plano individual com orientação e tratamento específico.";
    const a = {
      tema: "",
      titulo: "Ameloblastoma exige margem",
      corpo: `Ameloblastoma exige margem\n\n${corpo}\n\nSaiba mais pelo link da bio.\n#cirurgia`,
    };
    const b = {
      tema: "",
      titulo: "Odontoma é comum",
      corpo: `Odontoma é comum\n\n${corpo}\n\nAtendimento em São Paulo.`,
    };
    expect(acharConflito(a, [b])?.motivo).toBe("corpo");
  });

  it("textos diferentes que só compartilham assinatura e hashtags NÃO são duplicata", () => {
    const fim =
      "\n\nSaiba mais pelo link da bio.\nAtendimento em São Paulo, Santa Bárbara d'Oeste e Americana.\n#drfranciscomenezes #bucomaxilofacial";
    const a = {
      tema: "",
      titulo: "Odontoma",
      corpo: `O odontoma é o tumor odontogênico benigno mais frequente dos ossos maxilares, formado por tecidos dentários organizados de maneira desordenada, e costuma impedir a erupção do dente vizinho.${fim}`,
    };
    const b = {
      tema: "",
      titulo: "Sialolitíase",
      corpo: `Sentir a mandíbula inchar e doer bem na hora da refeição costuma ser sinal de sialolitíase, a formação de pequenos cálculos que obstruem o ducto da glândula salivar.${fim}`,
    };
    expect(corpoEditorial(a.corpo)).not.toMatch(/link da bio|#/);
    expect(acharConflito(a, [b])).toBeNull();
  });

  it("semana guiada pelo usuário aceita o mesmo assunto com ângulos diferentes, mas não o mesmo ângulo", () => {
    const lote = ["ATM: visão geral", "ATM: sinais de alerta", "ATM: visão geral"].map((tema) => ({
      tema,
      quando: null,
    }));
    expect(conflitosNoLote(lote, { assuntoGuiado: true })).toEqual([2]);
  });
});

describe("3 posts por dia = 3 assuntos distintos", () => {
  const BANCO = [
    ...ORTO.map((t) => t.split(" — ")[0]),
    ...MASSETER.map((t) => t.split(" — ")[0]),
    "Sialolitíase: pedra na glândula salivar",
    "Odontoma: o tumor mais comum dos maxilares",
    "Fratura de zigoma: quando o afundamento facial é urgência",
    "Neuralgia do trigêmeo: quando a dor facial não é dentária",
    "Odontologia hospitalar em UTI: prevenção da pneumonia",
    "Câncer de boca: os 5 sinais que exigem biópsia imediata",
    "Implante zigomático: solução para maxila reabsorvida",
    "Anquiloglossia no adulto: frenectomia lingual",
    "Cistos odontogênicos: achado radiográfico",
    "Osteonecrose dos maxilares por bisfosfonatos",
    "Sinusite maxilar de origem odontogênica",
  ];
  it("usa 09:00, 14:00 e 18:00 e cada post do dia tem assunto e ângulo próprios", () => {
    expect(horariosDoDia(3)).toEqual(["09:00", "14:00", "18:00"]);
    const plano = planDistinctTopics(BANCO, [], 3 * 3);
    expect(plano).toHaveLength(9);
    const assuntos = plano.map(assuntoPrincipal);
    expect(new Set(assuntos).size).toBe(9);
    expect(new Set(plano.map((t) => t.split(" — ")[1])).size).toBe(9);
    expect(conflitosNoLote(plano.map((tema) => ({ tema, quando: null })))).toEqual([]);
  });
  it("assuntos livres vêm primeiro; o restante é completado com ângulos novos, sem repetir", () => {
    const plano = planDistinctTopics(BANCO, [], 50, undefined, {
      assuntosBloqueados: ["ortognatica-deformidades"],
    });
    const livres = new Set(BANCO.map(assuntoPrincipal)).size - 1;
    const primeiros = plano.slice(0, livres);
    expect(primeiros.some((t) => assuntoPrincipal(t) === "ortognatica-deformidades")).toBe(false);
    expect(new Set(primeiros.map(assuntoPrincipal)).size).toBe(primeiros.length);
    expect(plano.length).toBe(50);
    expect(new Set(plano).size).toBe(50);
    expect(conflitosNoLote(plano.map((tema) => ({ tema })))).toEqual([]);
  });
});

describe("idempotência de double-click/retry", () => {
  it("mesma operação + mesmo slot → mesma chave, independente do tema reescolhido", () => {
    const ctx = { rede: "instagram", operacaoId: "op-1", slotKey: "2026-10-26T14:00" };
    expect(chaveIdempotencia("u", "Tema A", "Post Único", ctx)).toBe(
      chaveIdempotencia("u", "Tema B", "Post Único", ctx),
    );
    expect(chaveIdempotencia("u", "Tema A", "Post Único", ctx)).not.toBe(
      chaveIdempotencia("u", "Tema A", "Post Único", { ...ctx, slotKey: "2026-10-26T18:00" }),
    );
  });
});

import { montarSemana } from "./week-plan";
import { POSTS_POR_DIA_PADRAO } from "./post-slots";
describe("padrão de 4 posts/dia", () => {
  it("padrão é 4 por dia nos horários 09:00, 14:00, 18:00 e 21:00, um slot por item", () => {
    expect(POSTS_POR_DIA_PADRAO).toBe(4);
    const temas = Array.from({ length: 28 }, (_, i) => `Tema ${i}`);
    const semana = montarSemana(temas, undefined, new Date(2026, 9, 25, 12));
    expect(semana).toHaveLength(28);
    expect(semana.slice(0, 4).map((s) => s.horario)).toEqual(["09:00", "14:00", "18:00", "21:00"]);
    expect(new Set(semana.map((s) => s.key)).size).toBe(28);
  });
  it("faltando temas inéditos, slots ficam vazios em vez de copiar", () => {
    const semana = montarSemana(["A", "B"], undefined, new Date(2026, 9, 25, 12));
    expect(semana.filter((s) => s.tema).map((s) => s.tema)).toEqual(["A", "B"]);
  });
});
