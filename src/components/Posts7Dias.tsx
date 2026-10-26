import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, Check, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWeekTopics } from "@/lib/ai-post.functions";
import {
  montarSemana,
  montarSemanaCronograma,
  SLOTS_POR_SEMANA,
  rotuloRede,
  emParalelo,
  proximaSegunda,
  type ItemSemana,
} from "@/lib/week-plan";
import { horariosDoDia, POSTS_POR_DIA_PADRAO } from "@/lib/post-slots";
import { conflitosNoLote, espalharTemas } from "@/lib/dedup";
import { cn } from "@/lib/utils";
import { PostReviewActions } from "@/components/PostReviewActions";

export type FormatoSemana = "Post Único" | "Carrossel" | "Story";
export type ResultadoPost = { id: string; urls: string[]; legenda: string };
/** Contexto de idempotência: mesma operação + mesmo slot nunca cria um segundo post. */
export type ContextoSlot = {
  operacaoId: string;
  slotKey: string;
  objetivo?: string;
  assuntoGuiado?: boolean;
};

type Estado = { status: "fila" | "gerando" | "ok" | "erro"; res?: ResultadoPost; erro?: string };

function novaOperacao() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * "Posts 7 dias" — planeja segunda→domingo (1 a 4 posts/dia nos horários 09:00, 14:00, 18:00, 21:00)
 * e gera cada post com o fluxo do próprio planner (`gerar`). Um item por slot; temas repetidos
 * ou vazios não são gerados. Cada operação tem um ID: repetir o clique/retry reaproveita o post
 * já salvo daquele slot em vez de criar outro.
 */
export function Posts7Dias(props: {
  gerar: (item: ItemSemana, formato: FormatoSemana, ctx: ContextoSlot) => Promise<ResultadoPost>;
  especialidade?: "CTBMF" | "Odontologia Hospitalar" | "Ambas" | "Temas Diversos";
  temaGuia?: string;
  /** Temas próprios do planner (ex.: tratamentos). Se ausente, usa o banco de temas do app. */
  temasFixos?: string[];
  formatos?: FormatoSemana[];
  /** O planner está usando o escritor local (sem IA): planejar só temas que ele escreve com conteúdo próprio. */
  escritorLocal?: boolean;
  /** Padrão = 4/dia. Planners de agenda clínica passam 1. */
  postsPorDiaInicial?: number;
}) {
  const fetchTopics = useServerFn(getWeekTopics);
  const formatos = props.formatos ?? ["Post Único", "Carrossel", "Story"];
  const [porDia, setPorDia] = useState(props.postsPorDiaInicial ?? POSTS_POR_DIA_PADRAO);
  const temCronograma =
    !props.postsPorDiaInicial && formatos.includes("Story") && formatos.includes("Carrossel");
  // "Cronograma" = formato de cada horário (09h/18h story, 14h/21h carrossel de 5 slides).
  const [formato, setFormato] = useState<FormatoSemana | "Cronograma">(
    temCronograma ? "Cronograma" : formatos[0],
  );
  const [plano, setPlano] = useState<ItemSemana[] | null>(null);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [busy, setBusy] = useState(false);
  // Trava síncrona: o estado `busy` só muda no próximo render, então um duplo clique rápido
  // disparava duas gerações completas da semana (causa de posts duplicados/triplicados).
  const travaRef = useRef(false);
  const operacaoRef = useRef<string>(novaOperacao());

  const planejar = async () => {
    if (travaRef.current) return;
    travaRef.current = true;
    setBusy(true);
    try {
      const qtd = temCronograma ? SLOTS_POR_SEMANA : 7 * porDia;
      let temas: string[];
      if (props.temasFixos?.length) temas = props.temasFixos;
      else {
        const r = await fetchTopics({
          data: {
            especialidade: props.especialidade ?? "Ambas",
            temaGuia: props.temaGuia ?? "",
            // Folga de 4 temas: permite espalhar assuntos sem cair dois iguais no mesmo dia.
            quantidade: Math.min(60, qtd + (temCronograma ? 4 : 0)),
            inicioSemana: proximaSegunda().toISOString(),
            escritorLocal: Boolean(props.escritorLocal),
          },
        });
        temas = r.temas.filter((t) => t.trim());
        // Pauta sempre completa: se o banco do tema guiado esgotou, a IA repõe com temas gerais.
        if (temas.length < qtd) {
          const r2 = await fetchTopics({
            data: {
              especialidade: props.especialidade ?? "Ambas",
              temaGuia: "",
              quantidade: 60,
              inicioSemana: proximaSegunda().toISOString(),
              escritorLocal: Boolean(props.escritorLocal),
            },
          });
          const vistos = new Set(temas);
          temas = [...temas, ...r2.temas.filter((t) => t.trim() && !vistos.has(t))];
        }
        if (r.aviso && temas.length < qtd)
          toast.warning(r.aviso, {
            action: {
              label: "Gerar novos temas",
              onClick: () => {
                void planejar();
              },
            },
            duration: 15000,
          });
      }
      const base = temCronograma ? montarSemanaCronograma(temas) : montarSemana(temas, porDia);
      const ordem = espalharTemas(
        temas,
        base.map((i) => i.quando),
        {
          assuntoGuiado: Boolean(props.temaGuia?.trim()) && !props.temasFixos?.length,
        },
      );
      setPlano(base.map((i, k) => ({ ...i, tema: ordem[k] ?? "" })));
      setEstados({});
      operacaoRef.current = novaOperacao(); // novo plano = nova operação
    } catch (e: any) {
      toast.error(e?.message || "Falha ao planejar a semana.");
    } finally {
      travaRef.current = false;
      setBusy(false);
    }
  };

  const assuntoGuiado = Boolean(props.temaGuia?.trim()) && !props.temasFixos?.length;

  /** Pede à IA temas inéditos novos (histórico do backend) que não estejam já no plano. */
  const temasNovos = async (n: number, jaUsados: string[]): Promise<string[]> => {
    if (n <= 0) return [];
    const usados = new Set(jaUsados.map((t) => t.trim().toLowerCase()));
    const base = props.temasFixos?.length
      ? props.temasFixos
      : (
          await fetchTopics({
            data: {
              especialidade: props.especialidade ?? "Ambas",
              temaGuia: "", // reposição: banco geral + matriz editorial, sem depender do tema digitado
              quantidade: Math.min(60, n + 8),
              inicioSemana: proximaSegunda().toISOString(),
              escritorLocal: Boolean(props.escritorLocal),
            },
          })
        ).temas;
    return base.filter((t) => t.trim() && !usados.has(t.trim().toLowerCase())).slice(0, n);
  };

  /** Erro de conteúdo repetido/sem tema: a própria ferramenta troca o tema e tenta de novo. */
  const ehConteudo = (msg: string) =>
    /repet|duplic|parecid|mesmo assunto|inédit|igual|sem tema|nada foi salvo/i.test(msg);
  const TENTATIVAS_POR_SLOT = 3;

  const gerarSlot = async (item: ItemSemana, operacaoId: string, usados: string[]) => {
    let atual = item;
    let ultimoErro = "Falha";
    for (let t = 0; t < TENTATIVAS_POR_SLOT; t++) {
      setEstados((s) => ({ ...s, [item.key]: { status: "gerando" } }));
      try {
        const res = await props.gerar(
          atual,
          (formato === "Cronograma" ? atual.formato : formato) as FormatoSemana,
          {
            operacaoId,
            slotKey: t === 0 ? item.key : `${item.key}#${t}`,
            objetivo: atual.objetivo,
            assuntoGuiado,
          },
        );
        setEstados((s) => ({ ...s, [item.key]: { status: "ok", res } }));
        return true;
      } catch (e: any) {
        ultimoErro = e?.message || "Falha";
        if (!ehConteudo(ultimoErro) || t === TENTATIVAS_POR_SLOT - 1) break;
        const [novo] = await temasNovos(1, usados).catch(() => [] as string[]);
        if (!novo) break;
        usados.push(novo);
        atual = { ...atual, tema: novo };
        setPlano((p) => p?.map((x) => (x.key === item.key ? { ...x, tema: novo } : x)) ?? null);
      }
    }
    setEstados((s) => ({ ...s, [item.key]: { status: "erro", erro: ultimoErro } }));
    return false;
  };

  const gerarSemana = async () => {
    if (!plano || travaRef.current) return;
    travaRef.current = true;
    setBusy(true);
    const tid = "posts-7-dias";
    try {
      // 1) Pauta automática: horários vazios ou que repetem assunto do lote recebem tema da IA.
      const itens = [...plano];
      const conflito = new Set(
        conflitosNoLote(
          itens.map((i) => ({ tema: i.tema, quando: i.quando })),
          { assuntoGuiado },
        ),
      );
      const trocar = itens
        .map((i, idx) => ({ i, idx }))
        .filter(
          ({ i, idx }) => estados[i.key]?.status !== "ok" && (!i.tema.trim() || conflito.has(idx)),
        );
      if (trocar.length) {
        toast.loading(`Escolhendo ${trocar.length} tema(s) inédito(s) automaticamente…`, {
          id: tid,
        });
        const fixos = itens
          .filter((_, idx) => !trocar.some((x) => x.idx === idx))
          .map((i) => i.tema);
        const novos = await temasNovos(trocar.length + 4, fixos);
        const quandos = trocar.map(({ i }) => i.quando);
        const ordem = espalharTemas(novos, quandos, { assuntoGuiado: false });
        trocar.forEach(({ idx }, k) => {
          itens[idx] = { ...itens[idx], tema: ordem[k] ?? "" };
        });
        setPlano(itens);
      }
      const usados = itens.map((i) => i.tema);
      const pendentes = itens.filter((i) => estados[i.key]?.status !== "ok");
      setEstados((s) => ({
        ...s,
        ...Object.fromEntries(pendentes.map((i) => [i.key, { status: "fila" } as Estado])),
      }));
      if (!pendentes.length) return;
      let feitos = 0;
      let falhas = 0;
      toast.loading(`Posts 7 dias: 0/${pendentes.length} prontos…`, { id: tid });
      const operacaoId = operacaoRef.current;
      // 2) 1 por vez: cada post é comparado ao histórico já salvo, incluindo os anteriores do lote.
      await emParalelo(pendentes, 1, async (item) => {
        if (!item.tema.trim()) {
          falhas++;
          setEstados((s) => ({
            ...s,
            [item.key]: {
              status: "erro",
              erro: "A IA não encontrou tema inédito para este horário.",
            },
          }));
          return;
        }
        const ok = await gerarSlot(item, operacaoId, usados);
        if (ok) feitos++;
        else falhas++;
        toast.loading(`Posts 7 dias: ${feitos}/${pendentes.length} prontos…`, { id: tid });
      });
      // 3) Nunca alegar sucesso com calendário incompleto.
      if (falhas)
        toast.error(
          `${feitos} de ${pendentes.length} posts gerados. ${falhas} horário(s) falharam — veja o motivo em cada um e use "Tentar de novo".`,
          { id: tid, duration: 20000 },
        );
      else
        toast.success(
          `Semana completa: ${feitos} posts gerados, aguardando sua aprovação no painel, já com data.`,
          { id: tid },
        );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao montar a pauta automática.", { id: tid });
    } finally {
      travaRef.current = false;
      setBusy(false);
    }
  };

  const tentarSlot = async (item: ItemSemana) => {
    if (travaRef.current) return;
    travaRef.current = true;
    setBusy(true);
    try {
      const usados = (plano ?? []).map((i) => i.tema);
      let alvo = item;
      if (!alvo.tema.trim()) {
        const [novo] = await temasNovos(1, usados);
        if (!novo) throw new Error("A IA não encontrou tema inédito para este horário.");
        alvo = { ...alvo, tema: novo };
        usados.push(novo);
        setPlano((p) => p?.map((x) => (x.key === item.key ? alvo : x)) ?? null);
      }
      const ok = await gerarSlot(alvo, novaOperacao(), usados);
      if (ok) toast.success(`${item.diaSemana} ${item.dataLabel}: post gerado.`);
    } catch (e: any) {
      setEstados((s) => ({ ...s, [item.key]: { status: "erro", erro: e?.message || "Falha" } }));
    } finally {
      travaRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm">Posts 7 dias — semana completa (segunda a domingo)</h3>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {/* Planners de conteúdo seguem o cronograma global: sem escolha de quantidade/formato aqui. */}
        {!temCronograma && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Posts por dia</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPorDia(n)}
                    disabled={busy}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold border",
                      porDia === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Formato</Label>
              <div className="flex gap-1">
                {(temCronograma ? (["Cronograma", ...formatos] as const) : formatos).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormato(f)}
                    disabled={busy}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold border",
                      formato === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <Button size="sm" variant="outline" onClick={planejar} disabled={busy}>
          Planejar semana
        </Button>
        {plano && (
          <Button size="sm" onClick={gerarSemana} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar os posts da semana"}
          </Button>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Horários (seu fuso local):{" "}
        {!temCronograma && (
          <strong className="text-foreground">{horariosDoDia(porDia).join(" · ")}</strong>
        )}
        {temCronograma ? (
          <span>
            — Instagram: 09h Story · 14h Carrossel (5 slides) · 18h Story · 21h Carrossel (5 slides)
            · Google Business: 10h · 15h · LinkedIn: 09h · 13h ({SLOTS_POR_SEMANA} posts na semana)
          </span>
        ) : (
          <span className="hidden sm:inline">— padrão completo: 09:00 · 14:00 · 18:00 · 21:00</span>
        )}
      </p>
      {plano && (
        <ul className="space-y-2">
          {plano.map((item, idx) => {
            const st = estados[item.key];
            return (
              <li key={item.key} className="border rounded-md p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-32 shrink-0">
                    {item.diaSemana} {item.dataLabel}
                    {item.rede && (
                      <span className="block font-normal text-muted-foreground">
                        {rotuloRede(item.rede)} · {item.formato}
                      </span>
                    )}
                  </span>
                  <Input
                    value={item.tema}
                    disabled={busy || st?.status === "ok"}
                    className="h-8 text-xs"
                    placeholder="Opcional — a IA escolhe um tema inédito"
                    aria-label={`Tema de ${item.diaSemana} ${item.dataLabel}`}
                    onChange={(e) =>
                      setPlano(
                        (p) =>
                          p?.map((x, i) => (i === idx ? { ...x, tema: e.target.value } : x)) ??
                          null,
                      )
                    }
                  />
                  <span className="hidden sm:inline shrink-0 text-muted-foreground">
                    {item.objetivo}
                  </span>
                  {st?.status === "gerando" && (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  )}
                  {st?.status === "ok" && <Check className="h-4 w-4 text-primary shrink-0" />}
                  {st?.status === "erro" && <X className="h-4 w-4 text-destructive shrink-0" />}
                </div>
                {st?.status === "erro" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-destructive">{st.erro}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() => void tentarSlot(item)}
                    >
                      Tentar de novo
                    </Button>
                  </div>
                )}
                {st?.res && (
                  <>
                    <PostReviewActions key={st.res.id} id={st.res.id} />
                    <div className="flex flex-wrap gap-2 min-w-0">
                      <div className="flex gap-1 shrink-0">
                        {st.res.urls.slice(0, 5).map((u) => (
                          <img
                            key={u}
                            src={u}
                            alt={`Imagem do post de ${item.diaSemana}`}
                            className="h-16 w-12 object-cover rounded"
                          />
                        ))}
                      </div>
                      <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">
                        {st.res.legenda}
                      </p>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
