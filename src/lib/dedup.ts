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
 * recebe um ângulo editorial diferente E um assunto-raiz diferente (3 posts/dia = 3 assuntos,
 * não 3 variações do mesmo). `assuntosBloqueados` = assuntos já usados perto destas datas.
 * Se nada inédito couber, retorna menos itens (o chamador avisa o usuário).
 */
const baseTemaPlano = (t: string) => (t || "").split(" — ")[0];

export function planDistinctTopics(
  base: string[],
  historico: string[],
  quantidade: number,
  angulos = ANGULOS_EDITORIAIS,
  opts: { assuntosBloqueados?: Iterable<string> } = {},
): string[] {
  const escolhidos: string[] = [];
  const bloqueados = [...historico];
  const assuntosUsados = new Set<string>(opts.assuntosBloqueados ?? []);
  let a = 0;
  for (const t of base) {
    if (escolhidos.length >= quantidade) break;
    const raw = t.trim();
    if (!raw || findDuplicate(raw, bloqueados)) continue;
    // Tema já usado no histórico (mesmo com outro ângulo) conta como repetido.
    if (historico.some((h) => similarity(raw, baseTemaPlano(h)) >= 0.95)) continue;
    const assunto = assuntoPrincipal(raw);
    if (assunto && assuntosUsados.has(assunto)) continue;
    const cand = `${raw} — ${angulos[a % angulos.length]}`;
    if (findDuplicate(cand, bloqueados)) continue;
    a++; // o ângulo só é consumido quando o tema é aceito → ângulos nunca repetem no lote
    escolhidos.push(cand);
    bloqueados.push(cand);
    if (assunto) assuntosUsados.add(assunto);
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

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA SEMÂNTICA — "assunto-raiz" + ângulo + intenção + título + corpo.
// A comparação de palavras sozinha deixava passar posts essencialmente iguais com
// palavras diferentes (ex.: "Cirurgia ortognática Classe III", "Quando a mordida
// interfere na mastigação" e "Distração osteogênica em deformidades" na mesma semana).
// Cada tema é mapeado para um assunto-raiz clínico; dois posts com o mesmo assunto-raiz
// na mesma janela de dias são o MESMO assunto, mesmo com títulos diferentes.
// ─────────────────────────────────────────────────────────────────────────────

/** Ordem importa: o primeiro assunto que casar é o assunto principal do tema. */
export const ASSUNTOS_RAIZ: Array<{ id: string; re: RegExp }> = [
  { id: "anestesia-local", re: /\b(anestesi|bloqueio do nervo|carpule|agulha)/ },
  { id: "sutura", re: /\bsutura/ },
  { id: "forceps-exodontia", re: /\b(forceps|alveoloplastia)/ },
  { id: "alveolite-posoperatorio", re: /\b(alveolite|trismo|pos ?operatori|coagulo)/ },
  { id: "terceiro-molar", re: /\b(siso|terceiros? molar|coronectomia|inclus)/ },
  {
    id: "bruxismo-masseter",
    re: /\b(bruxismo|apertamento|masseter|miofascia|cefaleia|dor de cabeca|musculos da face)/,
  },
  {
    id: "atm",
    re: /\b(atm|temporomandibular|disco articular|estalo|travar|trava|luxacao|osteoartrose|condil)/,
  },
  {
    id: "ortognatica-deformidades",
    re: /\b(ortognatic|prognatismo|retrognatismo|mordida|deformidade|distracao osteogenica|assimetria|harmonia facial)/,
  },
  { id: "apneia-ronco", re: /\b(apneia|ronco|avanco maxilomandibular)/ },
  { id: "infeccao-odontogenica", re: /\b(infecc|ludwig|osteomielite|abscesso)/ },
  { id: "trauma-facial", re: /\b(trauma facia|traumas facia|fratura|zigoma\b|orbita)/ },
  { id: "trauma-dental", re: /\b(avulsao|reimplante|dentoalveolar)/ },
  { id: "seio-maxilar", re: /\b(seio maxilar|sinusite|bucossinusal)/ },
  {
    id: "implantes-enxertos",
    re: /\b(implante|enxerto|all on 4|pre protetica|perda ossea|cirurgia guiada)/,
  },
  { id: "planejamento-digital", re: /\b(planejamento digital|computador|impressao 3d)/ },
  { id: "cistos", re: /\b(cisto|queratocisto)/ },
  { id: "tumores-odontogenicos", re: /\b(odontoma|ameloblastoma|tumor|tumores)/ },
  { id: "displasia-fibrosa", re: /\bdisplasia fibrosa/ },
  { id: "cancer-boca", re: /\b(cancer|ferida na boca|carcinoma|biopsia imediata)/ },
  { id: "lesoes-potencialmente-malignas", re: /\b(leucoplasia|eritroplasia|liquen)/ },
  {
    id: "glandulas-salivares",
    re: /\b(sialolit|mucocele|ranula|xerostomia|glandula salivar|glandulas salivares|parotid)/,
  },
  {
    id: "nervos-dor-facial",
    re: /\b(neuralgia|trigemeo|parestesia|nervo alveolar|paralisia facial|eagle|estiloide)/,
  },
  { id: "osteonecrose", re: /\b(osteonecrose|bisfosfonato|osteorradionecrose)/ },
  { id: "oncologia-radioterapia", re: /\b(oncologic|radioterapia|mucosite|quimio)/ },
  { id: "hospitalar-uti", re: /\b(uti|internad|ventilacao|hospitalar|pneumonia)/ },
  { id: "pacientes-sistemicos", re: /\b(cardiopata|diabetic|anticoagulad|gestante)/ },
  { id: "freio-lingual", re: /\b(freio lingual|frenectomia|anquiloglossia)/ },
  { id: "fissuras", re: /\bfissura/ },
  { id: "ancoragem-ortodontica", re: /\b(miniparafuso|marpe|expansao maxilar)/ },
  { id: "estetica-facial", re: /\b(toxina botulinica|preenchedor|harmonizacao)/ },
  { id: "supranumerarios", re: /\bsupranumerari/ },
];

const baseTema = (t: string) => (t || "").split(" — ")[0];

/** Todos os assuntos-raiz citados num texto (tema, título ou corpo). */
export function assuntosDe(texto: string): string[] {
  const n = ` ${normalizeText(texto)} `;
  return ASSUNTOS_RAIZ.filter((a) => a.re.test(n)).map((a) => a.id);
}

/** Assunto principal do tema. Sem correspondência no mapa: radicais principais do tema. */
export function assuntoPrincipal(tema: string): string {
  const [primeiro] = assuntosDe(baseTema(tema));
  if (primeiro) return primeiro;
  const t = [...tokens(baseTema(tema))].slice(0, 2).sort();
  return t.length ? `t:${t.join("+")}` : "";
}

/** Ângulo editorial (sufixo " — ângulo" do planner), normalizado. */
export function anguloDe(tema: string): string {
  const parts = (tema || "").split(" — ");
  return parts.length > 1 ? normalizeText(parts.slice(1).join(" ")) : "";
}

const BOILERPLATE =
  /(#|link na bio|link da bio|atend|prof\.? francisco|francisco menezes|crosp|wa\.me|whatsapp|duvidas\?|hook_imagem|alt text|cirurgia e traumatologia bucomaxilofacia|odontologia hospitalar$)/i;

/** Corpo editorial sem assinatura, CTA fixo, cidades e hashtags (que são iguais em todos os posts). */
export function corpoEditorial(legenda: string): string {
  return (legenda || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !BOILERPLATE.test(l))
    .join("\n");
}

/** Fração dos trechos de 4 palavras do menor texto que aparecem no outro (frases reaproveitadas). */
export function overlapTrechos(a: string, b: string, n = 4): number {
  const sh = (s: string) => {
    const w = normalizeText(s).split(" ").filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
    return out;
  };
  const sa = sh(a);
  const sb = sh(b);
  if (sa.size < 8 || sb.size < 8) return 0;
  const [menor, maior] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  let inter = 0;
  for (const s of menor) if (maior.has(s)) inter++;
  return inter / menor.size;
}

export type AssinaturaPost = {
  tema: string;
  titulo?: string;
  corpo?: string;
  objetivo?: string;
  /** ISO da data agendada (null = sem data; não entra na regra de janela). */
  quando?: string | null;
  status?: string | null;
};

export type ConflitoPost = {
  motivo: "tema" | "assunto-na-janela" | "assunto-e-angulo" | "titulo" | "corpo";
  com: string;
};

export type OpcoesConflito = {
  /** Dias ao redor do slot em que o mesmo assunto-raiz não pode repetir. */
  janelaDias?: number;
  /** Semana guiada por um tema escolhido pelo usuário: mesmo assunto permitido, ângulos não. */
  assuntoGuiado?: boolean;
};

export const JANELA_ASSUNTO_DIAS = 6;

function dentroDaJanela(a?: string | null, b?: string | null, dias = JANELA_ASSUNTO_DIAS) {
  // Post sem data agendada não ocupa posição no feed: só as regras de tema/ângulo/texto valem.
  if (!a || !b) return false;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return true;
  return Math.abs(da - db) <= dias * 24 * 60 * 60 * 1000;
}

/** Decide se `cand` repete `hist` (tema + intenção + ângulo + título + corpo). */
export function conflitoSemantico(
  cand: AssinaturaPost,
  hist: AssinaturaPost,
  opts: OpcoesConflito = {},
): ConflitoPost | null {
  const com = hist.titulo || hist.tema;
  if (cand.tema && hist.tema) {
    if (
      similarity(cand.tema, hist.tema) >= DUP_THRESHOLD ||
      similarity(baseTema(cand.tema), baseTema(hist.tema)) >= 0.95
    ) {
      const angA = anguloDe(cand.tema);
      const angB = anguloDe(hist.tema);
      // Mesmo assunto com ângulo explicitamente diferente só é aceito em semana guiada.
      if (!(opts.assuntoGuiado && angA && angB && angA !== angB)) return { motivo: "tema", com };
    }
    const aA = assuntoPrincipal(cand.tema);
    const aB = assuntoPrincipal(hist.tema);
    if (aA && aA === aB) {
      const angA = anguloDe(cand.tema);
      const angB = anguloDe(hist.tema);
      if (angA && angA === angB) return { motivo: "assunto-e-angulo", com };
      if (
        !opts.assuntoGuiado &&
        hist.status !== "Arquivado" &&
        dentroDaJanela(cand.quando, hist.quando, opts.janelaDias)
      )
        return { motivo: "assunto-na-janela", com };
    }
  }
  if (cand.titulo && hist.titulo && similarity(cand.titulo, hist.titulo) >= 0.8)
    return { motivo: "titulo", com };
  const ca = corpoEditorial(cand.corpo || "");
  const cb = corpoEditorial(hist.corpo || "");
  if (ca.length >= 120 && cb.length >= 120) {
    if (similarity(ca.slice(0, 900), cb.slice(0, 900)) >= 0.6 || overlapTrechos(ca, cb) >= 0.3)
      return { motivo: "corpo", com };
  }
  return null;
}

export function acharConflito(
  cand: AssinaturaPost,
  historico: AssinaturaPost[],
  opts: OpcoesConflito = {},
): ConflitoPost | null {
  for (const h of historico) {
    const c = conflitoSemantico(cand, h, opts);
    if (c) return c;
  }
  return null;
}

/** Índices do lote que repetem um item anterior (o primeiro de cada grupo fica). */
export function conflitosNoLote(itens: AssinaturaPost[], opts: OpcoesConflito = {}): number[] {
  const aceitos: AssinaturaPost[] = [];
  const dups: number[] = [];
  itens.forEach((it, i) => {
    if (!it.tema.trim()) return;
    if (acharConflito(it, aceitos, opts)) dups.push(i);
    else aceitos.push(it);
  });
  return dups;
}

export function mensagemConflito(c: ConflitoPost): string {
  const alvo = `"${c.com.slice(0, 70)}"`;
  switch (c.motivo) {
    case "assunto-na-janela":
      return `Mesmo assunto de um post próximo (${alvo}). Escolha um assunto diferente para esta semana.`;
    case "assunto-e-angulo":
      return `Mesmo assunto e mesma abordagem de um post recente (${alvo}).`;
    case "tema":
      return `Tema repetido: já usado em ${alvo}.`;
    case "titulo":
      return `Título muito parecido com ${alvo}.`;
    case "corpo":
      return `Texto essencialmente igual a ${alvo}.`;
  }
}
