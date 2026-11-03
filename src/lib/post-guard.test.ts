/* eslint-disable @typescript-eslint/no-explicit-any -- cliente genérico (navegador/servidor) e dublê de teste */
import { describe, it, expect } from "vitest";
import {
  assinaturasDoHistorico,
  chaveConteudoManual,
  salvarPostInedito,
  slidesRepetidos,
  verificarInedito,
} from "./post-guard";
import { chaveIdempotencia, conflitosNoLote } from "./dedup";
import { horariosDoDia, POSTS_POR_DIA_PADRAO } from "./post-slots";

const corpo =
  "A cirurgia ortognática corrige a posição dos ossos da face quando a mordida não encaixa. O planejamento envolve ortodontia antes e depois, exames de imagem e avaliação da respiração. A recuperação inicial leva algumas semanas com dieta líquida e acompanhamento próximo.";
const hist = assinaturasDoHistorico([
  {
    prompt_ia: "Cirurgia ortognática: quando indicar",
    legenda: "Quando a mordida não encaixa\n\n" + corpo,
    data_agendamento: "2026-10-27T12:00:00Z",
    status: "PendenteAprovacao",
  },
]);

describe("pipeline global de criação", () => {
  it("post único: texto idêntico ao histórico é bloqueado", () => {
    expect(
      verificarInedito({ legenda: "Quando a mordida não encaixa\n\n" + corpo }, hist),
    ).not.toBeNull();
  });
  it("outra publicação: mesmo assunto-raiz na mesma semana é bloqueado mesmo com título novo", () => {
    expect(
      verificarInedito(
        {
          tema: "Ortognática e qualidade de vida",
          legenda: "Novo título",
          quando: "2026-10-28T12:00:00Z",
        },
        hist,
      )?.motivo,
    ).toBe("assunto-na-janela");
  });
  it("outra publicação: assunto realmente novo passa", () => {
    expect(
      verificarInedito(
        {
          tema: "Fratura de mandíbula em acidentes de moto",
          legenda: "Capacete salva a face",
          quando: "2026-10-28T12:00:00Z",
        },
        hist,
      ),
    ).toBeNull();
  });
  it("carrossel: slides progressivos passam, slide repetido é apontado", () => {
    const s = [
      "Slide 1: o que é a disfunção da ATM e como ela aparece",
      "Slide 2: sinais de alerta como estalos e dor ao mastigar",
      "Slide 3: como é feito o diagnóstico com exame clínico",
    ];
    expect(slidesRepetidos(s)).toEqual([]);
    expect(slidesRepetidos([...s, s[1]])).toEqual([3]);
  });
  it("lote: dois posts do mesmo assunto-raiz no mesmo dia → o segundo é conflito", () => {
    const q = "2026-10-28T12:00:00Z";
    expect(
      conflitosNoLote([
        { tema: "Siso incluso: quando extrair", quando: q },
        { tema: "Terceiro molar e dor na gengiva", quando: q },
        { tema: "Bruxismo noturno", quando: q },
      ]),
    ).toEqual([1]);
  });
  it("planners diferentes usam o mesmo padrão de 4 horários locais", () => {
    expect(horariosDoDia(POSTS_POR_DIA_PADRAO)).toEqual(["09:00", "14:00", "18:00", "21:00"]);
    expect(horariosDoDia(3)).toEqual(["09:00", "14:00", "18:00"]);
  });
  it("idempotência: mesma operação+slot = mesma chave; slots diferentes = chaves diferentes", () => {
    const a = chaveIdempotencia("u", "t", "Feed", {
      operacaoId: "op1",
      slotKey: "2026-10-28-09:00",
      rede: "instagram",
    });
    const b = chaveIdempotencia("u", "t2", "Feed", {
      operacaoId: "op1",
      slotKey: "2026-10-28-09:00",
      rede: "instagram",
    });
    const c = chaveIdempotencia("u", "t", "Feed", {
      operacaoId: "op1",
      slotKey: "2026-10-28-14:00",
      rede: "instagram",
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(chaveConteudoManual("u", "Olá mundo!!")).toBe(chaveConteudoManual("u", "olá   mundo"));
  });
});

function fakeClient(rows: any[]) {
  const q = (filter: (r: any) => boolean = () => true) => {
    const b: any = {
      select: () => b,
      eq: (k: string, v: any) => q((r) => filter(r) && r[k] === v),
      neq: () => b,
      or: () => b,
      order: () => b,
      limit: () => Promise.resolve({ data: rows.filter(filter), error: null }),
      maybeSingle: () => Promise.resolve({ data: rows.filter(filter)[0] ?? null }),
      insert: (row: any) => {
        const r = { ...row, id: `id${rows.length}` };
        rows.push(r);
        return { select: () => ({ single: () => Promise.resolve({ data: r, error: null }) }) };
      },
    };
    return b;
  };
  return { from: () => q() };
}

describe("salvarPostInedito (post manual em qualquer planner)", () => {
  it("artes sem legenda não colidem na chave vazia de texto", async () => {
    const rows: any[] = []; const c = fakeClient(rows);
    const a = await salvarPostInedito(c, "u", { legenda: "", url_imagem: "https://media.example/a.jpg" });
    const b = await salvarPostInedito(c, "u", { legenda: "", url_imagem: "https://media.example/b.jpg" });
    expect(a.id).not.toBe(b.id); expect(rows).toHaveLength(2);
    const retry = await salvarPostInedito(c, "u", { legenda: "", url_imagem: "https://media.example/a.jpg" });
    expect(retry).toEqual({ id: a.id, existente: true }); expect(rows).toHaveLength(2);
  });
  it("double-click não cria cópia e cópia semântica é recusada", async () => {
    const rows: any[] = [];
    const c = fakeClient(rows);
    const a = await salvarPostInedito(c, "u", {
      legenda: "Bruxismo: dentes gastos\n\n" + corpo.replace(/ortognática/g, "x"),
    });
    const b = await salvarPostInedito(c, "u", {
      legenda: "Bruxismo: dentes gastos\n\n" + corpo.replace(/ortognática/g, "x"),
    });
    expect(b).toEqual({ id: a.id, existente: true });
    expect(rows).toHaveLength(1);
    await expect(
      salvarPostInedito(c, "u", {
        legenda: "Outro título qualquer\n\n" + corpo.replace(/ortognática/g, "x") + " Fim.",
      }),
    ).rejects.toThrow(/Nada foi salvo/);
    expect(rows).toHaveLength(1);
  });
});
