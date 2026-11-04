import { expect, it } from "vitest";
import { postsDaSemana, semanasSalvas, noPeriodoExclusao } from "./week-delete";
import type { RunSalvo } from "./week-run";

it("includes all November 9–15 in Sao Paulo, excluding adjacent days", () => {
  expect(noPeriodoExclusao("2026-11-09T00:00:00-03:00")).toBe(true);
  expect(noPeriodoExclusao("2026-11-15T23:59:59-03:00")).toBe(true);
  expect(noPeriodoExclusao("2026-11-08T23:59:59-03:00")).toBe(false);
  expect(noPeriodoExclusao("2026-11-16T00:00:00-03:00")).toBe(false);
});

it("only selects post IDs linked to weekly slots, deduplicated", () => {
  const run = { plano: [{ key: "a" }, { key: "b" }, { key: "c" }], estados: { a: { res: { id: "weekly" } }, b: { res: { id: "weekly" } }, other: { res: { id: "outside" } } } } as unknown as RunSalvo;
  expect(postsDaSemana(run)).toEqual(["weekly"]);
});
it("finds weekly plans across planners without selecting other storage", () => {
  const data = { "posts7dias:liga:CTBMF": JSON.stringify({ plano: [], estados: {}, operacaoId: "liga" }), "posts7dias:chico:CTBMF": JSON.stringify({ plano: [], estados: {}, operacaoId: "chico" }), "draft": "private", "posts7dias:broken": "bad" };
  const entries = Object.entries(data);
  expect(semanasSalvas({ length: entries.length, key: i => entries[i]?.[0] ?? null, getItem: k => entries.find(([key]) => key === k)?.[1] ?? null }).map(r => r.run.operacaoId)).toEqual(["liga", "chico"]);
});