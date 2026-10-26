// Execução da semana do "Posts 7 dias": fila por slot com estado persistido, retomada sem
// duplicar (operacaoId + slotKey idempotentes no servidor), retry limitado e erro por slot.
// Puro (sem React): o componente só liga o clique a `executarSemana`.

import type { ItemSemana } from "./week-plan";

export type ResultadoPost = { id: string; urls: string[]; legenda: string; imagemErro?: string };

export type StatusSlot = "fila" | "gerando" | "ok" | "imagem" | "erro";
export type EstadoSlot = { status: StatusSlot; res?: ResultadoPost; erro?: string };
export type Estados = Record<string, EstadoSlot>;

export type GerarSlot = (item: ItemSemana, slotKey: string) => Promise<ResultadoPost>;

/** Texto salvo sem imagem nunca conta como post completo. */
export function classificar(res: ResultadoPost): EstadoSlot {
  const semImagem = !res.urls.filter(Boolean).length;
  if (res.imagemErro || semImagem)
    return {
      status: "imagem",
      res,
      erro: `Texto salvo, mas a imagem falhou: ${res.imagemErro || "nenhuma imagem foi gerada"}.`,
    };
  return { status: "ok", res };
}

export const concluido = (s?: EstadoSlot) => s?.status === "ok";

/** Slots que ainda precisam rodar (inclui os interrompidos por recarregar a página). */
export function pendentes(plano: ItemSemana[], estados: Estados): ItemSemana[] {
  return plano.filter((i) => {
    const s = estados[i.key]?.status;
    return !s || s === "fila" || s === "gerando";
  });
}

export function progresso(plano: ItemSemana[], estados: Estados) {
  const c = { total: plano.length, ok: 0, imagem: 0, erro: 0, pendentes: 0 };
  for (const i of plano) {
    const s = estados[i.key]?.status;
    if (s === "ok") c.ok++;
    else if (s === "imagem") c.imagem++;
    else if (s === "erro") c.erro++;
    else c.pendentes++;
  }
  return c;
}

// ---------- persistência (retomada após recarregar/fechar a aba) ----------

export type RunSalvo = {
  plano: ItemSemana[];
  estados: Estados;
  operacaoId: string;
  salvoEm: number;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function salvarRun(storage: Storage, chave: string, run: Omit<RunSalvo, "salvoEm">) {
  try {
    storage.setItem(chave, JSON.stringify({ ...run, salvoEm: Date.now() }));
  } catch {
    /* armazenamento cheio/indisponível: segue sem retomada */
  }
}

/** Carrega o run salvo; slots que estavam "gerando" voltam para a fila (serão retomados). */
export function carregarRun(
  storage: Storage,
  chave: string,
  maxIdadeMs = 7 * 864e5,
): RunSalvo | null {
  try {
    const raw = storage.getItem(chave);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunSalvo;
    if (!Array.isArray(run.plano) || !run.operacaoId || Date.now() - run.salvoEm > maxIdadeMs)
      return null;
    const estados: Estados = {};
    for (const [k, v] of Object.entries(run.estados ?? {}))
      estados[k] = v.status === "gerando" ? { status: "fila" } : v;
    return { ...run, estados };
  } catch {
    return null;
  }
}

// ---------- classificação de erros ----------

/** Conteúdo repetido/sem tema: a ferramenta troca o tema sozinha. */
export const ehErroDeConteudo = (msg: string) =>
  /repet|duplic|parecid|mesmo assunto|inédit|igual|sem tema|nada foi salvo/i.test(msg) &&
  !ehErroTransitorio(msg);
/** Limite momentâneo / rede: espera e tenta de novo. */
export const ehErroTransitorio = (msg: string) =>
  /\b429\b|rate.?limit|too many|tempor|timeout|timed out|\b50[234]\b|network|failed to fetch|econnreset/i.test(
    msg,
  );
/** Créditos/permissão: parar o lote inteiro (não adianta insistir). */
export const ehErroBloqueante = (msg: string) =>
  /\b402\b|\b403\b|crédit|credit|payment|insufficient|não autorizado|unauthorized|permission/i.test(
    msg,
  );

// ---------- execução ----------

export type OpcoesExecucao = {
  itens: ItemSemana[];
  gerar: GerarSlot;
  /** Novo tema inédito quando o conteúdo do slot colide com outro post. */
  novoTema: (usados: string[]) => Promise<string | undefined>;
  onEstado: (key: string, e: EstadoSlot, item: ItemSemana) => void;
  onTema?: (key: string, tema: string) => void;
  concorrencia?: number;
  tentativasConteudo?: number;
  tentativasTransitorio?: number;
  esperar?: (ms: number) => Promise<void>;
  deveParar?: () => boolean;
};

export type ResumoExecucao = { ok: number; imagem: number; erro: number; interrompido?: string };

export async function executarSemana(o: OpcoesExecucao): Promise<ResumoExecucao> {
  const conc = Math.max(1, o.concorrencia ?? 2);
  const maxConteudo = o.tentativasConteudo ?? 3;
  const maxTransit = o.tentativasTransitorio ?? 2;
  const esperar = o.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const usados = o.itens.map((i) => i.tema).filter(Boolean);
  const r: ResumoExecucao = { ok: 0, imagem: 0, erro: 0 };
  let prox = 0;

  const rodarSlot = async (item: ItemSemana) => {
    let atual = item;
    let trocas = 0;
    let transit = 0;
    let tentativa = 0;
    for (;;) {
      if (r.interrompido) {
        o.onEstado(item.key, { status: "erro", erro: `Pausado: ${r.interrompido}` }, atual);
        r.erro++;
        return;
      }
      if (!atual.tema.trim()) {
        const t = await o.novoTema(usados).catch(() => undefined);
        if (!t) {
          o.onEstado(
            item.key,
            { status: "erro", erro: "A IA não encontrou tema inédito para este horário." },
            atual,
          );
          r.erro++;
          return;
        }
        usados.push(t);
        atual = { ...atual, tema: t };
        o.onTema?.(item.key, t);
      }
      o.onEstado(item.key, { status: "gerando" }, atual);
      try {
        // Trocar o tema muda o pedido: nova chave de slot; a original segue idempotente.
        const res = await o.gerar(atual, tentativa === 0 ? item.key : `${item.key}#${tentativa}`);
        const e = classificar(res);
        o.onEstado(item.key, e, atual);
        if (e.status === "ok") r.ok++;
        else r.imagem++;
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err || "Falha desconhecida");
        if (ehErroBloqueante(msg)) {
          r.interrompido = msg;
          o.onEstado(item.key, { status: "erro", erro: msg }, atual);
          r.erro++;
          return;
        }
        if (ehErroTransitorio(msg) && transit < maxTransit) {
          transit++;
          await esperar(2000 * 2 ** transit + Math.floor(Math.random() * 500));
          continue; // mesma chave: se o servidor já salvou, devolve o mesmo post
        }
        if (ehErroDeConteudo(msg) && trocas < maxConteudo - 1) {
          const t = await o.novoTema(usados).catch(() => undefined);
          if (t) {
            trocas++;
            tentativa++;
            usados.push(t);
            atual = { ...atual, tema: t };
            o.onTema?.(item.key, t);
            continue;
          }
        }
        o.onEstado(item.key, { status: "erro", erro: msg }, atual);
        r.erro++;
        return;
      }
    }
  };

  const worker = async () => {
    while (prox < o.itens.length) {
      if (o.deveParar?.()) return;
      const item = o.itens[prox++];
      await rodarSlot(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(conc, o.itens.length) }, worker));
  return r;
}
