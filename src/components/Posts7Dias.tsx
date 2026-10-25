import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWeekTopics } from "@/lib/ai-post.functions";
import { montarSemana, emParalelo, type ItemSemana } from "@/lib/week-plan";
import { cn } from "@/lib/utils";

export type FormatoSemana = "Post Único" | "Carrossel" | "Story";
export type ResultadoPost = { id: string; urls: string[]; legenda: string };

type Estado = { status: "fila" | "gerando" | "ok" | "erro"; res?: ResultadoPost; erro?: string };

/**
 * "Posts 7 dias" — planeja segunda→domingo (1 post/dia por padrão, até 3) e gera cada post
 * com o fluxo do próprio planner (`gerar`). Temas vêm de um plano único; a IA é chamada
 * só uma vez por post. Até 2 posts são gerados ao mesmo tempo para respeitar limites.
 */
export function Posts7Dias(props: {
  gerar: (item: ItemSemana, formato: FormatoSemana) => Promise<ResultadoPost>;
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

  const planejar = async () => {
    setBusy(true);
    try {
      const qtd = 7 * porDia;
      const temas = props.temasFixos?.length
        ? props.temasFixos
        : (await fetchTopics({ data: { especialidade: props.especialidade ?? "Ambas", temaGuia: props.temaGuia ?? "", quantidade: qtd } })).temas;
      setPlano(montarSemana(temas, porDia));
      setEstados({});
    } catch (e: any) {
      toast.error(e?.message || "Falha ao planejar a semana.");
    } finally {
      setBusy(false);
    }
  };

  const gerarSemana = async () => {
    if (!plano) return;
    setBusy(true);
    const pendentes = plano.filter((i) => estados[i.key]?.status !== "ok");
    setEstados((s) => Object.fromEntries([...Object.entries(s), ...pendentes.map((i) => [i.key, { status: "fila" } as Estado])]));
    const tid = "posts-7-dias";
    let feitos = 0;
    toast.loading(`Posts 7 dias: 0/${pendentes.length} prontos…`, { id: tid });
    await emParalelo(pendentes, 2, async (item) => {
      setEstados((s) => ({ ...s, [item.key]: { status: "gerando" } }));
      try {
        const res = await props.gerar(item, formato);
        setEstados((s) => ({ ...s, [item.key]: { status: "ok", res } }));
      } catch (e: any) {
        setEstados((s) => ({ ...s, [item.key]: { status: "erro", erro: e?.message || "Falha" } }));
      }
      feitos++;
      toast.loading(`Posts 7 dias: ${feitos}/${pendentes.length} prontos…`, { id: tid });
    });
    toast.success("Semana gerada. Os posts ficam aguardando sua aprovação no painel, já com data.", { id: tid });
    setBusy(false);
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
            {[1, 2, 3].map((n) => (
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
      {plano && (
        <ul className="space-y-2">
          {plano.map((item, idx) => {
            const st = estados[item.key];
            return (
              <li key={item.key} className="border rounded-md p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-28 shrink-0">{item.diaSemana} {item.dataLabel}</span>
                  <Input value={item.tema} disabled={busy || st?.status === "ok"} className="h-8 text-xs"
                    onChange={(e) => setPlano((p) => p!.map((x, i) => (i === idx ? { ...x, tema: e.target.value } : x)))} />
                  {st?.status === "gerando" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                  {st?.status === "ok" && <Check className="h-4 w-4 text-primary shrink-0" />}
                  {st?.status === "erro" && <X className="h-4 w-4 text-destructive shrink-0" />}
                </div>
                {st?.status === "erro" && <p className="text-destructive">{st.erro}</p>}
                {st?.res && (
                  <div className="flex gap-2">
                    <div className="flex gap-1 shrink-0">
                      {st.res.urls.slice(0, 5).map((u) => <img key={u} src={u} alt={`Imagem do post de ${item.diaSemana}`} className="h-16 w-12 object-cover rounded" />)}
                    </div>
                    <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">{st.res.legenda}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
