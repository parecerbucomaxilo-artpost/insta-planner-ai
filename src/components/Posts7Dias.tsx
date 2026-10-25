import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, Check, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWeekTopics } from "@/lib/ai-post.functions";
import { montarSemana, emParalelo, proximaSegunda, type ItemSemana } from "@/lib/week-plan";
import { horariosDoDia } from "@/lib/post-slots";
import { conflitosNoLote } from "@/lib/dedup";
import { cn } from "@/lib/utils";
import { PostReviewActions } from "@/components/PostReviewActions";

export type FormatoSemana = "Post Único" | "Carrossel" | "Story";
export type ResultadoPost = { id: string; urls: string[]; legenda: string };
/** Contexto de idempotência: mesma operação + mesmo slot nunca cria um segundo post. */
export type ContextoSlot = { operacaoId: string; slotKey: string; objetivo?: string; assuntoGuiado?: boolean };

type Estado = { status: "fila" | "gerando" | "ok" | "erro"; res?: ResultadoPost; erro?: string };

function novaOperacao() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
}) {
  const fetchTopics = useServerFn(getWeekTopics);
  const formatos = props.formatos ?? ["Post Único", "Carrossel", "Story"];
  const [porDia, setPorDia] = useState(1);
  const [formato, setFormato] = useState<FormatoSemana>(formatos[0]);
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
      const qtd = 7 * porDia;
      let temas: string[];
      if (props.temasFixos?.length) temas = props.temasFixos;
      else {
        const r = await fetchTopics({ data: { especialidade: props.especialidade ?? "Ambas", temaGuia: props.temaGuia ?? "", quantidade: qtd, inicioSemana: proximaSegunda().toISOString() } });
        temas = r.temas;
        if (r.aviso) toast.warning(r.aviso);
      }
      setPlano(montarSemana(temas, porDia));
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
  const gerarSemana = async () => {
    if (!plano || travaRef.current) return;
    travaRef.current = true;
    setBusy(true);
    try {
      // Dedup dentro do lote ANTES de gerar: repetidos/vazios ficam pendentes para edição.
      // Semântico: mesmo assunto-raiz na semana conta como repetido, mesmo com título diferente.
      const dupIdx = new Set(conflitosNoLote(plano.map((i) => ({ tema: i.tema, quando: i.quando })), { assuntoGuiado }));
      const bloqueados: Record<string, Estado> = {};
      plano.forEach((i, idx) => {
        if (estados[i.key]?.status === "ok") return;
        if (!i.tema.trim()) bloqueados[i.key] = { status: "erro", erro: "Sem tema inédito — escreva um tema para este horário." };
        else if (dupIdx.has(idx)) bloqueados[i.key] = { status: "erro", erro: "Mesmo assunto de outro horário desta semana — escreva um assunto diferente." };
      });
      if (Object.keys(bloqueados).length) toast.warning(`${Object.keys(bloqueados).length} item(ns) repetido(s) ou vazio(s) não foram gerados. Edite e gere de novo.`);
      const pendentes = plano.filter((i) => estados[i.key]?.status !== "ok" && !bloqueados[i.key]);
      setEstados((s) => ({ ...s, ...bloqueados, ...Object.fromEntries(pendentes.map((i) => [i.key, { status: "fila" } as Estado])) }));
      if (!pendentes.length) return;
      const tid = "posts-7-dias";
      let feitos = 0;
      toast.loading(`Posts 7 dias: 0/${pendentes.length} prontos…`, { id: tid });
      const operacaoId = operacaoRef.current;
      // 1 por vez: cada post é comparado ao histórico já salvo, incluindo os anteriores do lote.
      await emParalelo(pendentes, 1, async (item) => {
        setEstados((s) => ({ ...s, [item.key]: { status: "gerando" } }));
        try {
          const res = await props.gerar(item, formato, { operacaoId, slotKey: item.key, objetivo: item.objetivo, assuntoGuiado });
          setEstados((s) => ({ ...s, [item.key]: { status: "ok", res } }));
        } catch (e: any) {
          setEstados((s) => ({ ...s, [item.key]: { status: "erro", erro: e?.message || "Falha" } }));
        }
        feitos++;
        toast.loading(`Posts 7 dias: ${feitos}/${pendentes.length} prontos…`, { id: tid });
      });
      toast.success("Semana gerada. Os posts ficam aguardando sua aprovação no painel, já com data.", { id: tid });
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
        <div className="space-y-1">
          <Label className="text-xs">Posts por dia</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" onClick={() => setPorDia(n)} disabled={busy}
                className={cn("px-3 py-1.5 rounded-md text-xs font-semibold border", porDia === n ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Formato</Label>
          <div className="flex gap-1">
            {formatos.map((f) => (
              <button key={f} type="button" onClick={() => setFormato(f)} disabled={busy}
                className={cn("px-3 py-1.5 rounded-md text-xs font-semibold border", formato === f ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={planejar} disabled={busy}>Planejar semana</Button>
        {plano && <Button size="sm" onClick={gerarSemana} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar os posts da semana"}</Button>}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Horários (seu fuso local): <strong className="text-foreground">{horariosDoDia(porDia).join(" · ")}</strong>
        <span className="hidden sm:inline">— padrão completo: 09:00 · 14:00 · 18:00 · 21:00</span>
      </p>
      {plano && (
        <ul className="space-y-2">
          {plano.map((item, idx) => {
            const st = estados[item.key];
            return (
              <li key={item.key} className="border rounded-md p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-32 shrink-0">{item.diaSemana} {item.dataLabel}</span>
                  <Input value={item.tema} disabled={busy || st?.status === "ok"} className="h-8 text-xs" placeholder="Escreva um tema inédito"
                    aria-label={`Tema de ${item.diaSemana} ${item.dataLabel}`}
                    onChange={(e) => setPlano((p) => p?.map((x, i) => (i === idx ? { ...x, tema: e.target.value } : x)) ?? null)} />
                  <span className="hidden sm:inline shrink-0 text-muted-foreground">{item.objetivo}</span>
                  {st?.status === "gerando" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                  {st?.status === "ok" && <Check className="h-4 w-4 text-primary shrink-0" />}
                  {st?.status === "erro" && <X className="h-4 w-4 text-destructive shrink-0" />}
                </div>
                {st?.status === "erro" && <p className="text-destructive">{st.erro}</p>}
                {st?.res && (
                  <>
                    <PostReviewActions key={st.res.id} id={st.res.id} />
                    <div className="flex flex-wrap gap-2 min-w-0">
                      <div className="flex gap-1 shrink-0">
                        {st.res.urls.slice(0, 5).map((u) => <img key={u} src={u} alt={`Imagem do post de ${item.diaSemana}`} className="h-16 w-12 object-cover rounded" />)}
                      </div>
                      <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">{st.res.legenda}</p>
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
