// Plano "Posts 7 dias": segunda a domingo da PRÓXIMA semana (ou da atual, se hoje for segunda cedo).
// Determinístico, sem IA: a IA só é chamada depois, uma vez por post (legenda + imagens).

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const HORARIOS_PADRAO = [9, 15, 19];

export type ItemSemana = {
  key: string;
  diaSemana: string;
  dataLabel: string;
  quando: string; // ISO
  tema: string;
};

/** Próxima segunda-feira às 00:00 (hoje, se for segunda). */
export function proximaSegunda(agora: Date = new Date()): Date {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  const delta = (8 - d.getDay()) % 7; // 0 se já é segunda
  d.setDate(d.getDate() + delta);
  return d;
}

/** Monta 7 dias × postsPorDia (1–3), seg→dom, distribuindo temas sem repetir em sequência. */
export function montarSemana(temas: string[], postsPorDia = 1, agora: Date = new Date()): ItemSemana[] {
  const n = Math.min(3, Math.max(1, Math.round(postsPorDia)));
  const base = temas.filter((t) => t.trim()).length ? temas.filter((t) => t.trim()) : ["Tema livre"];
  const inicio = proximaSegunda(agora);
  const itens: ItemSemana[] = [];
  let k = 0;
  for (let dia = 0; dia < 7; dia++) {
    for (let p = 0; p < n; p++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + dia);
      d.setHours(HORARIOS_PADRAO[p], 0, 0, 0);
      // Se a data cair no passado (ex.: segunda de hoje às 9h já passou), empurra 1 semana.
      if (d.getTime() < agora.getTime()) d.setDate(d.getDate() + 7);
      itens.push({
        key: `${dia}-${p}`,
        diaSemana: DIAS_SEMANA[d.getDay()],
        dataLabel: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}h`,
        quando: d.toISOString(),
        tema: base[k % base.length],
      });
      k++;
    }
  }
  return itens;
}

/** Executa tarefas com concorrência limitada (evita estourar limite do provedor de imagem). */
export async function emParalelo<T>(itens: T[], limite: number, fn: (item: T, i: number) => Promise<void>) {
  let prox = 0;
  const worker = async () => {
    while (prox < itens.length) {
      const i = prox++;
      await fn(itens[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
}
