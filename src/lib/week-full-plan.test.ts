import { describe, it, expect } from "vitest";
import { montarSemanaCronograma, SLOTS_POR_SEMANA } from "./week-plan";
import { planDistinctTopics, conflitosNoLote, espalharTemas, ANGULOS_EDITORIAIS } from "./dedup";
const TEMAS_GERAIS = [
  "Por que o siso incluso pode causar dor que irradia para o ouvido",
  "Como o bruxismo noturno pode sobrecarregar dentes e articulações",
  "Quando o estalo na ATM merece atenção especializada",
  "Por que a mandíbula pode travar ao acordar",
  "Como a cirurgia ortognática pode melhorar função e harmonia facial",
  "Quando o ronco e a apneia precisam de avaliação bucomaxilofacial",
  "Por que infecções odontogênicas não devem ser ignoradas",
  "Como reconhecer sinais de alerta depois da extração do siso",
  "Quando uma ferida na boca precisa ser investigada",
  "Por que traumas faciais exigem avaliação rápida e precisa",
  "Como a dor facial pode estar ligada à articulação temporomandibular",
  "Quando a mordida interfere na mastigação, respiração e fala",
  "Por que dentes inclusos exigem planejamento com imagem",
  "Como a Odontologia Hospitalar protege pacientes internados",
  "Quando a dor de cabeça pode ter relação com músculos da face",
  "Por que o planejamento digital mudou a cirurgia bucomaxilofacial",
  "Como a avaliação do freio lingual pode impactar funções orais",
  "Quando a perda óssea exige cuidado antes de procedimentos dentários",
  "Por que a higiene oral na UTI reduz riscos ao paciente internado",
  "Como identificar sinais de disfunção temporomandibular sem pânico",
  "Cistos odontogênicos: quando um achado radiográfico vira cirurgia",
  "Tumores benignos da mandíbula: por que a biópsia muda tudo",
  "Fratura de mandíbula: sinais que ninguém pode ignorar",
  "Fratura de zigoma: quando o afundamento facial é urgência",
  "Fratura de órbita: quando a visão dupla acende o alerta",
  "Trauma dentoalveolar no esporte: o que fazer nos primeiros minutos",
  "Reimplante dentário após avulsão: a janela de ouro de 60 minutos",
  "Sinusite maxilar de origem odontogênica: quando o dente é o culpado",
  "Comunicação bucossinusal após extração: como identificar e tratar",
  "Osteonecrose dos maxilares por bisfosfonatos: quem precisa avisar o dentista",
];

const agora = new Date(2026, 9, 25, 12, 0, 0); // domingo

describe("Planejar semana — cronograma global completo", () => {
  const temas = planDistinctTopics([...TEMAS_GERAIS], [], SLOTS_POR_SEMANA + 4, ANGULOS_EDITORIAIS);
  const bruto = montarSemanaCronograma(temas, agora);
  const ordem = espalharTemas(
    temas,
    bruto.map((i) => i.quando),
  );
  const plano = bruto.map((i, k) => ({ ...i, tema: ordem[k] }));

  it("gera 56 temas, não 2", () => {
    expect(temas.length).toBeGreaterThanOrEqual(56);
    expect(plano).toHaveLength(56);
    expect(plano.every((i) => i.tema.length > 0)).toBe(true);
  });

  it("quantidade por plataforma em 7 dias", () => {
    const por = (r: string) => plano.filter((i) => i.rede === r);
    expect(por("instagram")).toHaveLength(28);
    expect(por("google")).toHaveLength(14);
    expect(por("linkedin")).toHaveLength(14);
  });

  it("horários e formatos por rede", () => {
    const h = (r: string) =>
      [
        ...new Set(plano.filter((i) => i.rede === r).map((i) => `${i.horario} ${i.formato}`)),
      ].sort();
    expect(h("instagram")).toEqual([
      "09:00 Story",
      "14:00 Carrossel",
      "18:00 Story",
      "21:00 Carrossel",
    ]);
    expect(h("google")).toEqual(["10:00 Post Único", "15:00 Post Único"]);
    expect(h("linkedin")).toEqual(["09:00 Post Único", "13:00 Post Único"]);
  });

  it("cada conteúdo é diferente e o lote não acusa conflito", () => {
    expect(new Set(plano.map((i) => i.tema)).size).toBe(56);
    expect(new Set(plano.map((i) => i.key)).size).toBe(56);
    expect(conflitosNoLote(plano.map((i) => ({ tema: i.tema, quando: i.quando })))).toEqual([]);
  });

  it("tema guiado também preenche a semana inteira (antes sobravam 2)", () => {
    const guia = ["visão geral", "sinais de alerta"].map((a) => `Siso: ${a}`);
    const hist = guia.map((g) => `${g} — mito e verdade`);
    let t = planDistinctTopics(guia, hist, 56, ANGULOS_EDITORIAIS);
    t = [
      ...t,
      ...planDistinctTopics([...TEMAS_GERAIS], [...hist, ...t], 56 - t.length, ANGULOS_EDITORIAIS),
    ];
    expect(t).toHaveLength(56);
    expect(new Set(t).size).toBe(56);
  });
});
