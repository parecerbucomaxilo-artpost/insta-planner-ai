// Plano "Posts 7 dias": segunda a domingo da PRÓXIMA semana (ou da atual, se hoje for segunda cedo).
// Determinístico, sem IA: a IA só é chamada depois, uma vez por post (legenda + imagens).
// Horários vêm de HORARIOS_POSTAGEM (09:00, 14:00, 18:00, 21:00) no fuso local do navegador.

import { horariosDoDia, parseHorario, type HorarioPostagem } from "./post-slots";

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export { HORARIOS_POSTAGEM } from "./post-slots";

export const OBJETIVOS = ["Educar", "Prevenir", "Orientar", "Informar", "Fortalecer autoridade"];

export type ItemSemana = {
  /** Chave estável do slot (data local + horário) — única dentro do plano. */
  key: string;
  diaSemana: string;
  dataLabel: string;
  horario: HorarioPostagem;
  quando: string; // ISO (UTC) do horário local escolhido
  tema: string;
  objetivo: string;
};

/** Próxima segunda-feira às 00:00 (hoje, se for segunda). */
export function proximaSegunda(agora: Date = new Date()): Date {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  const delta = (8 - d.getDay()) % 7; // 0 se já é segunda
  d.setDate(d.getDate() + delta);
  return d;
}

/** Monta 7 dias × postsPorDia (1–4), seg→dom. Um item por slot; temas não se repetem (vazios ficam vazios). */
export function montarSemana(temas: string[], postsPorDia = 1, agora: Date = new Date()): ItemSemana[] {
  const horarios = horariosDoDia(postsPorDia);
  const inicio = proximaSegunda(agora);
  const itens: ItemSemana[] = [];
  const vistos = new Set<string>();
  let k = 0;
  for (let dia = 0; dia < 7; dia++) {
    for (const horario of horarios) {
      const { hora, minuto } = parseHorario(horario);
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + dia);
      d.setHours(hora, minuto, 0, 0); // horário LOCAL do usuário
      if (d.getTime() < agora.getTime()) d.setDate(d.getDate() + 7);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${horario}`;
      if (vistos.has(key)) continue; // garante 1 item por slot
      vistos.add(key);
      itens.push({
        key,
        diaSemana: DIAS_SEMANA[d.getDay()],
        dataLabel: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${horario}`,
        horario,
        quando: d.toISOString(),
        // Sem rotação cíclica: tema faltante fica vazio para o usuário preencher (evita repetir).
        tema: (temas[k] ?? "").trim(),
        objetivo: OBJETIVOS[k % OBJETIVOS.length],
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
