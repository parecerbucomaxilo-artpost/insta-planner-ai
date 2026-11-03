/** Modo de geração compartilhado por todos os pontos de criação (Estúdio, composer, planners, semana).
 * "gratuito" = só ferramentas locais (modelo fixo, não é IA); "ia" = gateway real com confirmação de créditos. */
export type ModoGeracao = "gratuito" | "ia";
export const CHAVE_MODO = "estudio-modo";
export const JANELA_CONFIRMACAO_MS = 10 * 60 * 1000;

type Ouvinte = (m: ModoGeracao) => void;
let modoAtual: ModoGeracao = "ia";
const ouvintes = new Set<Ouvinte>();

export function lerModo(): ModoGeracao {
  return modoAtual;
}
export function carregarModoSalvo(storage: Pick<Storage, "getItem"> | undefined) {
  const v = storage?.getItem(CHAVE_MODO);
  if (v === "gratuito" || v === "ia") definirModo(v, undefined);
}
export function definirModo(m: ModoGeracao, storage: Pick<Storage, "setItem"> | undefined) {
  modoAtual = m;
  storage?.setItem(CHAVE_MODO, m);
  ouvintes.forEach((o) => o(m));
}
export function ouvirModo(o: Ouvinte) {
  ouvintes.add(o);
  return () => { ouvintes.delete(o); };
}

export class ModoGratuitoError extends Error {
  constructor(acao: string) {
    super(`Modo Gratuito ativo: "${acao}" usa IA e não foi executado. Nenhum texto de modelo fixo foi gerado no lugar. Mude para "IA Avançada" para gerar com IA, ou use o Estúdio (modelos fixos/locais — não é IA).`);
    this.name = "ModoGratuitoError";
  }
}

/** Confirmador injetável (UI mostra diálogo). Retorna true se o usuário aceitou. */
export type Confirmador = (acao: string) => Promise<boolean>;
let confirmador: Confirmador = async () => false;
let confirmadoAte = 0;
export function registrarConfirmador(c: Confirmador) {
  confirmador = c;
}
export function resetarConfirmacao() {
  confirmadoAte = 0;
}

/** Envolve uma chamada de IA: bloqueia no modo gratuito, pede confirmação de créditos
 * (válida por uma janela curta para lotes, ex.: semana inteira) e repassa erros reais sem fallback. */
export function comGuardaIA<A extends unknown[], R>(acao: string, fn: (...a: A) => Promise<R>, agora: () => number = Date.now) {
  return async (...args: A): Promise<R> => {
    if (lerModo() !== "ia") throw new ModoGratuitoError(acao);
    if (agora() > confirmadoAte) {
      const ok = await confirmador(acao);
      if (!ok) throw new Error("Geração cancelada. Nenhum crédito foi usado e nada foi gerado.");
      confirmadoAte = agora() + JANELA_CONFIRMACAO_MS;
    }
    return fn(...args);
  };
}
