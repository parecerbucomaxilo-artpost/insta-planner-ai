import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, Check, X, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { postsDaSemana, semanasSalvas } from "@/lib/week-delete";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWeekTopics, discardPost } from "@/lib/ai-post.functions";
import {
  montarSemana,
  montarSemanaCronograma,
  SLOTS_POR_SEMANA,
  rotuloRede,
  proximaSegunda,
  type ItemSemana,
} from "@/lib/week-plan";
import { horariosDoDia, POSTS_POR_DIA_PADRAO } from "@/lib/post-slots";
import { conflitosNoLote, espalharTemas } from "@/lib/dedup";
import {
  carregarRun,
  executarSemana,
  pendentes as slotsPendentes,
  progresso,
  salvarRun,
  type EstadoSlot,
  type ResultadoPost,
} from "@/lib/week-run";
import { cn } from "@/lib/utils";
import { PostReviewActions } from "@/components/PostReviewActions";

export type FormatoSemana = "Post Único" | "Carrossel" | "Story";
export type { ResultadoPost };
/** Contexto de idempotência: mesma operação + mesmo slot nunca cria um segundo post. */
export type ContextoSlot = {
  operacaoId: string;
  slotKey: string;
  objetivo?: string;
  assuntoGuiado?: boolean;
  /** Se a imagem falhar, o servidor salva o texto e devolve `imagemErro` (nunca imagem genérica). */
  salvarTextoSeImagemFalhar?: boolean;
};

type Estado = EstadoSlot;

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
  perfilEditorial?: "chico";
  /** Temas próprios do planner (ex.: tratamentos). Se ausente, usa o banco de temas do app. */
  temasFixos?: string[];
  formatos?: FormatoSemana[];
  /** O planner está usando o escritor local (sem IA): planejar só temas que ele escreve com conteúdo próprio. */
  escritorLocal?: boolean;
  /** Padrão = 4/dia. Planners de agenda clínica passam 1. */
  postsPorDiaInicial?: number;
  /** Identifica o planner para retomar a semana após recarregar a página. */
  idRetomada?: string;
}) {
  const fetchTopics = useServerFn(getWeekTopics);
  const discardPostFn = useServerFn(discardPost);
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
  const [ultimoGerado, setUltimoGerado] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apagando, setApagando] = useState(false);
  // Trava síncrona: o estado `busy` só muda no próximo render, então um duplo clique rápido
  // disparava duas gerações completas da semana (causa de posts duplicados/triplicados).
  const travaRef = useRef(false);
  const operacaoRef = useRef<string>(novaOperacao());

  // Antes, "Planejar semana" só montava a lista e a geração dependia de um 2º botão;
  // agora o clique planeja E gera os slots em seguida.
  const planejar = async () => {
    if (travaRef.current) return;
    let planoGerar: ItemSemana[] | null = null;
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
            perfilEditorial: props.perfilEditorial,
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
              perfilEditorial: props.perfilEditorial,
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
      const novo = base.map((i, k) => ({ ...i, tema: ordem[k] ?? "" }));
      setPlano(novo);
      setEstados({});
      operacaoRef.current = novaOperacao(); // novo plano = nova operação
      planoGerar = novo;
    } catch (e: any) {
      toast.error(e?.message || "Falha ao planejar a semana.");
    } finally {
      travaRef.current = false;
      setBusy(false);
    }
    if (planoGerar) await gerarSemana(planoGerar, {});
  };

  const assuntoGuiado = Boolean(props.temaGuia?.trim()) && !props.temasFixos?.length;
  const chave = `posts7dias:${props.idRetomada ?? "geral"}:${props.especialidade ?? "Ambas"}`;
  const pararRef = useRef(false);

  // Retomada: plano e estado de cada slot ficam salvos neste navegador. Recarregar a página
  // (ou uma atualização do app) interrompia o lote no meio e o plano sumia sem aviso.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const run = carregarRun(window.localStorage, chave);
    if (!run) return;
    setPlano(run.plano);
    setEstados(run.estados);
    operacaoRef.current = run.operacaoId;
  }, [chave]);
  useEffect(() => {
    if (typeof window === "undefined" || !plano) return;
    salvarRun(window.localStorage, chave, { plano, estados, operacaoId: operacaoRef.current });
  }, [chave, plano, estados]);
  useEffect(() => {
    if (!busy) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [busy]);

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
              perfilEditorial: props.perfilEditorial,
              temaGuia: "",
              quantidade: Math.min(60, n + 8),
              inicioSemana: proximaSegunda().toISOString(),
              escritorLocal: Boolean(props.escritorLocal),
            },
          })
        ).temas;
    return base.filter((t) => t.trim() && !usados.has(t.trim().toLowerCase())).slice(0, n);
  };

  const gerarItem = (item: ItemSemana, slotKey: string, operacaoId: string) =>
    props.gerar(item, (formato === "Cronograma" ? item.formato : formato) as FormatoSemana, {
      operacaoId,
      slotKey,
      objetivo: item.objetivo,
      assuntoGuiado,
      salvarTextoSeImagemFalhar: true,
    });

  const rodar = async (itens: ItemSemana[], operacaoId: string) => {
    const tid = "posts-7-dias";
    let feitos = 0;
    toast.loading(`Gerando a semana: 0/${itens.length} horários…`, { id: tid });
    const r = await executarSemana({
      itens,
      concorrencia: 2, // lotes pequenos: respeita o limite do provedor de imagem
      gerar: (item, slotKey) => gerarItem(item, slotKey, operacaoId),
      novoTema: async (usados) => (await temasNovos(1, usados))[0],
      onTema: (key, tema) =>
        setPlano((p) => p?.map((x) => (x.key === key ? { ...x, tema } : x)) ?? null),
      onEstado: (key, e) => {
        setEstados((s) => ({ ...s, [key]: e }));
        // Prévia automática do post mais recente concluído (não aprova nem publica).
        const rid = (e as { res?: { id?: string } }).res?.id;
        if (rid && e.status !== "gerando") setUltimoGerado(rid);
        if (e.status !== "gerando") {
          feitos++;
          toast.loading(`Gerando a semana: ${feitos}/${itens.length} horários…`, { id: tid });
        }
      },
      deveParar: () => pararRef.current,
    });
    if (r.interrompido)
      toast.error(
        `Geração pausada: ${r.interrompido}. Nada foi simulado; os horários restantes ficaram pendentes.`,
        { id: tid, duration: 30000 },
      );
    else if (r.erro || r.imagem)
      toast.error(
        `${r.ok} post(s) completos, ${r.imagem} com texto salvo mas imagem pendente, ${r.erro} com falha. Veja cada horário e use "Tentar novamente".`,
        { id: tid, duration: 30000 },
      );
    else if (pararRef.current) toast.info(`Geração pausada: ${r.ok} post(s) prontos.`, { id: tid });
    else
      toast.success(
        `Semana completa: ${r.ok} posts com texto e imagem, aguardando sua aprovação.`,
        { id: tid },
      );
  };

  const gerarSemana = async (planoAtual = plano, estadosAtuais = estados) => {
    if (!planoAtual || travaRef.current) return;
    travaRef.current = true;
    pararRef.current = false;
    setBusy(true);
    try {
      // Pauta automática: horários vazios ou que repetem assunto do lote recebem tema da IA.
      const itens = [...planoAtual];
      const conflito = new Set(
        conflitosNoLote(
          itens.map((i) => ({ tema: i.tema, quando: i.quando })),
          { assuntoGuiado },
        ),
      );
      const trocar = itens
        .map((i, idx) => ({ i, idx }))
        .filter(
          ({ i, idx }) => !estadosAtuais[i.key]?.res && (!i.tema.trim() || conflito.has(idx)),
        );
      if (trocar.length) {
        const fixos = itens
          .filter((_, idx) => !trocar.some((x) => x.idx === idx))
          .map((i) => i.tema);
        const novos = await temasNovos(trocar.length + 4, fixos);
        const ordem = espalharTemas(
          novos,
          trocar.map(({ i }) => i.quando),
          { assuntoGuiado: false },
        );
        trocar.forEach(({ idx }, k) => {
          itens[idx] = { ...itens[idx], tema: ordem[k] ?? "" };
        });
        setPlano(itens);
      }
      const fila = slotsPendentes(itens, estadosAtuais);
      setEstados((s) => ({
        ...s,
        ...Object.fromEntries(fila.map((i) => [i.key, { status: "fila" } as Estado])),
      }));
      if (!fila.length) {
        toast.info("Nenhum horário pendente nesta semana.");
        return;
      }
      await rodar(fila, operacaoRef.current);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao montar a pauta automática.", { id: "posts-7-dias" });
    } finally {
      travaRef.current = false;
      setBusy(false);
    }
  };

  /** Tenta de novo só este horário. Imagem pendente: descarta o texto sem imagem e gera o post inteiro de novo. */
  const tentarSlot = async (item: ItemSemana) => {
    if (travaRef.current) return;
    travaRef.current = true;
    setBusy(true);
    try {
      const st = estados[item.key];
      if (st?.status === "imagem" && st.res?.id) await discardPostFn({ data: { id: st.res.id } });
      setEstados((s) => ({ ...s, [item.key]: { status: "fila" } }));
      await rodar([item], novaOperacao());
    } catch (e: any) {
      setEstados((s) => ({ ...s, [item.key]: { status: "erro", erro: e?.message || "Falha" } }));
    } finally {
      travaRef.current = false;
      setBusy(false);
    }
  };

  const prog = plano ? progresso(plano, estados) : null;
  const temPendente = plano ? slotsPendentes(plano, estados).length > 0 : false;

  const apagarSemanas = async () => {
    if (travaRef.current || apagando) return;
    if (!window.confirm("Apagar todos os planos de 7 dias deste navegador, de todos os planners, e os posts vinculados? Outros posts e publicações nas redes não serão removidos.")) return;
    travaRef.current = true;
    setApagando(true);
    try {
      const runs = semanasSalvas(window.localStorage);
      const atual = plano ? { plano, estados, operacaoId: operacaoRef.current, salvoEm: Date.now() } : null;
      const ids = [...new Set([...runs.flatMap(r => postsDaSemana(r.run)), ...(atual ? postsDaSemana(atual) : [])])];
      let removidos = 0;
      if (ids.length) {
        const { data: existentes, error: leitura } = await supabase.from("posts").select("id").in("id", ids);
        if (leitura) throw leitura;
        const { data: apagados, error } = await supabase.from("posts").delete().in("id", ids).select("id");
        if (error) throw error;
        removidos = apagados?.length ?? 0;
        if (removidos !== (existentes?.length ?? 0)) throw new Error("Nem todos os posts vinculados puderam ser apagados. A lista foi preservada para nova tentativa.");
        const { data: restantes, error: verificacao } = await supabase.from("posts").select("id").in("id", ids);
        if (verificacao || restantes?.length) throw new Error("Não foi possível confirmar a exclusão. A lista foi preservada.");
      }
      runs.forEach(r => window.localStorage.removeItem(r.chave));
      window.localStorage.removeItem(chave);
      setPlano(null);
      setEstados({});
      setUltimoGerado(null);
      operacaoRef.current = novaOperacao();
      toast.success(`${removidos} posts removidos. Listas de 7 dias apagadas deste navegador.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar os posts da semana.");
    } finally {
      travaRef.current = false;
      setApagando(false);
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
        <Button size="sm" variant="outline" onClick={planejar} disabled={busy || apagando}>
          Planejar semana
        </Button>
        {plano && !busy && temPendente && (
          <Button size="sm" disabled={apagando} onClick={() => void gerarSemana()}>
            Continuar geração
          </Button>
        )}
        {busy && (
          <Button size="sm" variant="secondary" onClick={() => (pararRef.current = true)}>
            <Loader2 className="h-4 w-4 animate-spin mr-1" /> Pausar
          </Button>
        )}
        {plano && (
          <Button size="sm" variant="destructive" disabled={busy || apagando} onClick={() => void apagarSemanas()}>
            {apagando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Apagar todas as semanas
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
      {prog && (
        <div className="space-y-1" aria-live="polite">
          <div className="h-2 w-full rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${((prog.total - prog.pendentes) / Math.max(1, prog.total)) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {prog.ok}/{prog.total} completos · {prog.imagem} com imagem pendente · {prog.erro} com
            falha · {prog.pendentes} na fila
            {!busy && temPendente && " — clique em “Continuar geração” para retomar sem duplicar."}
          </p>
        </div>
      )}
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
                    disabled={busy || Boolean(st?.res)}
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
                  {(st?.status === "erro" || st?.status === "imagem") && (
                    <X className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  {st?.status === "fila" && (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
                {(st?.status === "erro" || st?.status === "imagem") && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-destructive">{st.erro}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() => void tentarSlot(item)}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
                {st?.res && (
                  <>
                    <PostReviewActions key={st.res.id} id={st.res.id} autoOpen={st.res.id === ultimoGerado} />
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
