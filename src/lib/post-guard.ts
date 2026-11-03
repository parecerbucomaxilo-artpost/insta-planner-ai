/* eslint-disable @typescript-eslint/no-explicit-any -- cliente genérico (navegador/servidor) e dublê de teste */
// Pipeline compartilhado de criação de posts (todas as formas: post único, carrossel,
// story, "outra publicação", lote e planner semanal). Qualquer caminho que salve um
// post NOVO — gerado por IA (generateSinglePost) ou escrito à mão — passa por aqui:
// mesmo histórico, mesma dedup exata+semântica, mesma chave de idempotência.
import {
  JANELA_ASSUNTO_DIAS,
  acharConflito,
  contentKey,
  corpoEditorial,
  mensagemConflito,
  normalizeText,
  overlapTrechos,
  similarity,
  titleOf,
  type AssinaturaPost,
  type ConflitoPost,
} from "./dedup";

export const HISTORICO_DIAS = 60;
export const AGENDA_PASSADA_DIAS = 7;

export type LinhaHistorico = {
  prompt_ia?: string | null;
  legenda?: string | null;
  data_agendamento?: string | null;
  status?: string | null;
};

/** Converte linhas de `posts` em assinaturas comparáveis (mesma regra para todos os planners). */
export function assinaturasDoHistorico(linhas: LinhaHistorico[]): AssinaturaPost[] {
  return linhas
    .filter((r) => r.status !== "Erro")
    .map((r) => ({
      tema: r.prompt_ia || "",
      titulo: r.legenda ? titleOf(r.legenda) : "",
      corpo: (r.legenda || "").slice(0, 1500),
      quando: r.data_agendamento ?? null,
      status: r.status ?? null,
    }));
}

/** Filtro de período padrão do histórico (criados nos últimos 60 dias ou agendados a partir de 7 dias atrás). */
export function filtroHistorico(agora = Date.now()) {
  const desde = new Date(agora - HISTORICO_DIAS * 864e5).toISOString();
  const desdeAgenda = new Date(agora - AGENDA_PASSADA_DIAS * 864e5).toISOString();
  return `created_at.gte.${desde},data_agendamento.gte.${desdeAgenda}`;
}

/** Chave de conteúdo para posts escritos à mão: mesmo texto normalizado = mesmo post. */
export function chaveConteudoManual(userId: string, legenda: string) {
  return contentKey([
    userId,
    "manual",
    normalizeText(corpoEditorial(legenda) || legenda).slice(0, 600),
  ]);
}

/** Verifica um texto novo contra histórico + lote atual. */
export function verificarInedito(
  cand: { tema?: string; legenda: string; quando?: string | null },
  historico: AssinaturaPost[],
): ConflitoPost | null {
  const limpo = (cand.legenda || "").trim();
  return acharConflito(
    {
      tema: cand.tema ?? "",
      titulo: titleOf(limpo),
      corpo: limpo.slice(0, 1500),
      quando: cand.quando ?? null,
    },
    historico,
    { janelaDias: JANELA_ASSUNTO_DIAS },
  );
}

/**
 * Slides do MESMO carrossel: devem ser progressivos dentro do mesmo tema. Não são posts
 * duplicados entre si, mas um slide que repete o texto de outro é sinal de conteúdo fraco.
 * Retorna os índices (0-based) dos slides que repetem um slide anterior.
 */
export function slidesRepetidos(slides: string[]): number[] {
  const rep: number[] = [];
  const vistos: string[] = [];
  slides.forEach((s, i) => {
    const t = normalizeText(s || "");
    if (t.length < 25) {
      vistos.push(t);
      return;
    }
    if (
      vistos.some(
        (v) =>
          v.length >= 25 && (v === t || similarity(v, t) >= 0.75 || overlapTrechos(v, t) >= 0.5),
      )
    )
      rep.push(i);
    vistos.push(t);
  });
  return rep;
}

type Cliente = {
  from: (t: "posts") => any;
};

/**
 * Salva um post novo escrito/editado pelo usuário usando a mesma prevenção do gerador:
 * idempotente (double-click/retry devolve o mesmo id) e bloqueia cópias exatas/semânticas.
 */
export async function salvarPostInedito(
  client: Cliente,
  userId: string,
  row: Record<string, unknown> & {
    legenda: string;
    data_agendamento?: string | null;
    prompt_ia?: string | null;
  },
): Promise<{ id: string; existente: boolean }> {
  const key = row.legenda.trim()
    ? chaveConteudoManual(userId, row.legenda)
    : contentKey([userId, "manual-media", row.prompt_ia ?? "", JSON.stringify(row.imagens_carrossel ?? row.url_imagem ?? "")]);
  const { data: ja } = await client
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .eq("content_key", key)
    .maybeSingle();
  if (ja?.id) return { id: ja.id, existente: true };

  const { data: recentes, error: hErr } = await client
    .from("posts")
    .select("prompt_ia, legenda, data_agendamento, status")
    .eq("user_id", userId)
    .neq("status", "Erro")
    .or(filtroHistorico())
    .order("created_at", { ascending: false })
    .limit(400);
  if (hErr)
    throw new Error(
      "Não foi possível verificar duplicatas no histórico. Nada foi salvo; tente novamente.",
    );
  const conflito = verificarInedito(
    { tema: row.prompt_ia ?? "", legenda: row.legenda, quando: row.data_agendamento ?? null },
    assinaturasDoHistorico(recentes ?? []),
  );
  if (conflito) throw new Error(`${mensagemConflito(conflito)} Nada foi salvo.`);

  const { data, error } = await client
    .from("posts")
    .insert({ ...row, user_id: userId, content_key: key })
    .select("id")
    .single();
  if (error) {
    // Corrida entre duas abas/cliques: o índice único devolve o post já salvo.
    if ((error as { code?: string }).code === "23505") {
      const { data: e2 } = await client
        .from("posts")
        .select("id")
        .eq("user_id", userId)
        .eq("content_key", key)
        .maybeSingle();
      if (e2?.id) return { id: e2.id, existente: true };
    }
    throw error;
  }
  return { id: data.id, existente: false };
}
