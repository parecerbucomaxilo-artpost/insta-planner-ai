import type { RunSalvo } from "./week-run";

export const PERIODO_EXCLUSAO = { inicio: "2026-11-09T00:00:00-03:00", fim: "2026-11-16T00:00:00-03:00" };

export function noPeriodoExclusao(quando: string) {
  const t = Date.parse(quando);
  return t >= Date.parse(PERIODO_EXCLUSAO.inicio) && t < Date.parse(PERIODO_EXCLUSAO.fim);
}

export function semanaNoPeriodo(run: RunSalvo): RunSalvo {
  return { ...run, plano: run.plano.filter(item => noPeriodoExclusao(item.quando)) };
}

export function postsDaSemana(run: RunSalvo): string[] {
  return [...new Set(run.plano.flatMap(item => {
    const id = run.estados[item.key]?.res?.id;
    return id ? [id] : [];
  }))];
}

export function semanasSalvas(storage: Pick<Storage, "length" | "key" | "getItem">) {
  const runs: Array<{ chave: string; run: RunSalvo }> = [];
  for (let i = 0; i < storage.length; i++) {
    const chave = storage.key(i);
    if (!chave?.startsWith("posts7dias:")) continue;
    try {
      const run = JSON.parse(storage.getItem(chave) ?? "null");
      if (run && Array.isArray(run.plano) && run.estados && run.operacaoId) runs.push({ chave, run: run as RunSalvo });
    } catch { /* Ignore unrelated or malformed storage. */ }
  }
  return runs;
}