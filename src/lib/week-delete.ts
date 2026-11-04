import type { RunSalvo } from "./week-run";

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