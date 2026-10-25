// Prevenção de duplicidade editorial — compartilhada por todos os planners e pelo backend.
// Comparação normalizada + similaridade de tokens (Jaccard/containment com radicais simples),
// que pega paráfrases curtas ("Dor na ATM: sinais" × "Sinais de dor da ATM") sem depender
// de igualdade literal. Sem chamada de IA: barato, determinístico e testável.

const STOP = new Set(
  "a o as os um uma uns umas de da do das dos em na no nas nos por para pra com sem sob sobre e ou que se seu sua seus suas voce voces isso esse essa este esta como quando qual quais porque por que mais menos muito pouco ja nao sim ao aos ate entre pode podem ser sao foi tem ter".split(
    " ",
  ),
);

export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(w: string): string {
  // Radical simples PT-BR: remove plurais/sufixos comuns para aproximar variações.
  return w
    .replace(/(mente|coes|cao|oes|ais|eis|ores|ados|idas|idos|ada|ado|ida|ido|es|s)$/, "")
    .slice(0, 7);
}

export function tokens(s: string): Set<string> {
  return new Set(
    normalizeText(s)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem)
      .filter((w) => w.length > 2),
  );
}

/** 0..1 — máximo entre Jaccard e "containment" (um texto curto contido no outro). */
export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  // containment só conta quando o menor texto tem conteúdo suficiente
  return Math.max(jaccard, Math.min(ta.size, tb.size) >= 3 ? containment * 0.9 : 0);
}

export const DUP_THRESHOLD = 0.72;

export function findDuplicate(
  candidate: string,
  history: string[],
  threshold = DUP_THRESHOLD,
): string | null {
  for (const h of history) if (h && similarity(candidate, h) >= threshold) return h;
  return null;
}

/** Primeira linha útil (título/gancho) de uma legenda, sem marcadores. */
export function titleOf(legenda: string): string {
  const line = (legenda || "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(slide\s*\d+\s*[:\-–]?|#+|\*+|[-•]\s*)/i, "")
        .replace(/\*+/g, "")
        .trim(),
    )
    .find((l) => l.length > 3);
  return (line || "").slice(0, 160);
}

/** Chave determinística de conteúdo normalizado (idempotência de duplo clique/retry). */
export function contentKey(parts: Array<string | null | undefined>): string {
  const s = parts.map((p) => normalizeText(p || "")).join("|");
  // FNV-1a 64 bits (duas metades) — sem dependências de Node, roda no Worker e no navegador.
  let h1 = 0x811c9dc5,
    h2 = 0xcbf29ce4;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Ângulos editoriais distintos — cada item da semana recebe um diferente. */
export const ANGULOS_EDITORIAIS = [
  "caso clínico ilustrativo (sem identificar paciente)",
  "mito ou verdade",
  "sinais de alerta que muita gente ignora",
  "passo a passo do tratamento",
  "pergunta frequente do consultório",
  "o que a ciência recente mostra",
  "erro comum e como evitar",
  "antes de decidir: o que avaliar",
  "curiosidade anatômica",
  "cuidados no pós-operatório",
  "comparação entre duas condutas",
  "bastidores do centro cirúrgico",
];

/**
 * Seleciona `quantidade` temas sem repetir o histórico nem o próprio lote. Cada tema
 * recebe um ângulo editorial diferente. Quando a lista base acaba, combina tema+ângulo
 * inéditos; se nada inédito couber, retorna menos itens (o chamador avisa o usuário).
 */
export function planDistinctTopics(
  base: string[],
  historico: string[],
  quantidade: number,
  angulos = ANGULOS_EDITORIAIS,
): string[] {
  const escolhidos: string[] = [];
  const bloqueados = [...historico];
  let a = 0;
  const tentar = (t: string) => {
    if (escolhidos.length >= quantidade) return;
    if (findDuplicate(t, bloqueados)) return;
    escolhidos.push(t);
    bloqueados.push(t);
  };
  for (const t of base) {
    if (escolhidos.length >= quantidade) break;
    const raw = t.trim();
    if (!raw || findDuplicate(raw, bloqueados)) continue;
    tentar(`${raw} — ${angulos[a++ % angulos.length]}`);
  }
  // Segunda passada: mesmo assunto, ângulo novo (só se o assunto não repetir no lote).
  for (let ang = 0; escolhidos.length < quantidade && ang < angulos.length; ang++) {
    for (const t of base) {
      if (escolhidos.length >= quantidade) break;
      const cand = `${t.trim()} — ${angulos[(ang + 5) % angulos.length]}`;
      const assuntoUsadoNoLote = escolhidos.some((e) => similarity(e.split(" — ")[0], t) >= 0.95);
      if (!assuntoUsadoNoLote) tentar(cand);
    }
  }
  return escolhidos;
}

/** Marca índices duplicados dentro de um lote (o primeiro de cada grupo fica). */
export function batchDuplicates(items: string[], threshold = DUP_THRESHOLD): number[] {
  const dups: number[] = [];
  items.forEach((t, i) => {
    if (
      findDuplicate(
        t,
        items.slice(0, i).filter((_, j) => !dups.includes(j)),
        threshold,
      )
    )
      dups.push(i);
  });
  return dups;
}

/** Repete `gerar` até achar algo inédito, com limite finito. Retorna null se esgotar. */
export async function retryDistinct<T>(
  gerar: (tentativa: number) => Promise<T>,
  chave: (v: T) => string,
  historico: string[],
  maxTentativas = 3,
): Promise<{ valor: T; tentativas: number } | null> {
  for (let i = 0; i < maxTentativas; i++) {
    const v = await gerar(i);
    if (!findDuplicate(chave(v), historico)) return { valor: v, tentativas: i + 1 };
  }
  return null;
}

/** Chave de idempotência: por operação+slot quando informados; senão por conteúdo+dia. */
export function chaveIdempotencia(
  userId: string,
  tema: string,
  formato: string,
  data: { operacaoId?: string; slotKey?: string; rede: string; quando?: string },
) {
  if (data.operacaoId && data.slotKey)
    return contentKey([userId, "op", data.operacaoId, data.slotKey, data.rede, formato]);
  return contentKey([
    userId,
    tema,
    formato,
    data.rede,
    (data.quando ?? new Date().toISOString()).slice(0, 10),
  ]);
}
