import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { weeklyPlan } from "@/lib/ai/weekly-plan.functions";
import { generateImage } from "@/lib/ai/generate-image.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles, Image as ImgIcon, Send } from "lucide-react";
import { toast } from "sonner";
import type { Perfil } from "@/components/ProfileSettings";
import { DirectReplyCard } from "./DirectReplyCard";
import { applyDoctorBadge } from "@/lib/watermark";

type DiaPlano = {
  date: Date;
  label: string; // Seg, Ter…
  titulo: string;
  legenda: string;
  mensagemDirect: string;
  promptImagem: string;
  imagem: string | null;
  status: "vazio" | "gerando" | "pronto";
};

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

// PERF: cache local do cronograma por semana (chave = ISO da segunda-feira)
const WEEK_CACHE_PREFIX = "planner_weekly_cache_v1:";
type CachedDia = Omit<DiaPlano, "date"> & { dateIso: string };
function readWeekCache(weekStartIso: string): CachedDia[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WEEK_CACHE_PREFIX + weekStartIso);
    return raw ? (JSON.parse(raw) as CachedDia[]) : null;
  } catch { return null; }
}
function writeWeekCache(weekStartIso: string, dias: DiaPlano[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedDia[] = dias.map(({ date, ...rest }) => ({ ...rest, dateIso: date.toISOString() }));
    window.localStorage.setItem(WEEK_CACHE_PREFIX + weekStartIso, JSON.stringify(payload));
  } catch { /* ignore quota */ }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 dom, 1 seg…
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function WeeklyCalendar({ perfil, onCreated }: { perfil: Perfil | null; onCreated: () => void }) {
  const genPlan = useServerFn(weeklyPlan);
  const genImage = useServerFn(generateImage);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [loading, setLoading] = useState(false);
  const [dias, setDias] = useState<DiaPlano[]>(() =>
    DIAS.map((label, i) => {
      const d = startOfWeek(new Date());
      d.setDate(d.getDate() + i);
      return {
        date: d,
        label,
        titulo: "",
        legenda: "",
        mensagemDirect: "",
        promptImagem: "",
        imagem: null,
        status: "vazio",
      };
    }),
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const rebuildEmpty = (start: Date) =>
    DIAS.map((label, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        date: d,
        label,
        titulo: "",
        legenda: "",
        mensagemDirect: "",
        promptImagem: "",
        imagem: null,
        status: "vazio" as const,
      };
    });

  const navWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
    setDias(rebuildEmpty(next));
  };

  const rangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 4);
    return `${fmtDate(weekStart)} – ${fmtDate(end)}`;
  }, [weekStart]);

  const handleGerar = async () => {
    setLoading(true);
    const tId = toast.loading("Claude está montando seu cronograma semanal…");
    try {
      const apiKey =
        (typeof window !== "undefined" && window.localStorage.getItem("anthropic_api_key")) || undefined;
      const r = await genPlan({
        data: {
          apiKey,
          perfil: perfil
            ? {
                nome: perfil.nome_profissional,
                cro_uf: perfil.cro_uf,
                subespecialidades: perfil.subespecialidades,
                tom_voz: perfil.tom_voz,
              }
            : undefined,
        },
      });
      // marca como "gerando" para imagens
      setDias((arr) =>
        arr.map((d, i) => ({
          ...d,
          titulo: r.dias[i]?.titulo ?? d.titulo,
          legenda: r.dias[i]?.legenda_instagram ?? "",
          mensagemDirect: r.dias[i]?.mensagem_direct ?? "",
          promptImagem: r.dias[i]?.prompt_imagem ?? "",
          status: "gerando",
        })),
      );
      toast.loading("Gerando 5 imagens Premium em paralelo…", { id: tId });

      const results = await Promise.allSettled(
        r.dias.map((d) => genImage({ data: { prompt: d.prompt_imagem, aspect: "1:1" } })),
      );
      setDias((arr) =>
        arr.map((d, i) => {
          const res = results[i];
          if (res && res.status === "fulfilled") {
            return { ...d, imagem: res.value.dataUrl, status: "pronto" };
          }
          return { ...d, status: "pronto" };
        }),
      );
      // aplica badge do médico se houver
      if (perfil?.nome_profissional || perfil?.cro_uf) {
        const next = await Promise.all(
          results.map(async (res) => {
            if (res.status !== "fulfilled") return null;
            try {
              return await applyDoctorBadge(res.value.dataUrl, {
                nome: perfil.nome_profissional ?? "",
                cro: perfil.cro_uf ?? "",
              });
            } catch {
              return res.value.dataUrl;
            }
          }),
        );
        setDias((arr) => arr.map((d, i) => ({ ...d, imagem: next[i] ?? d.imagem })));
      }
      toast.success("Cronograma da semana pronto! ✨", { id: tId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar cronograma", { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const salvarDia = async (i: number, agendar: boolean) => {
    const d = dias[i];
    if (!d.legenda.trim()) return toast.error("Texto vazio.");
    const data = new Date(d.date);
    data.setHours(9, 0, 0, 0);
    const { error } = await supabase.from("posts").insert({
      tipo_post: "Post Único",
      estilo_layout: "Padrão",
      formato_midia: "Imagem",
      legenda: d.legenda,
      legenda_instagram: d.legenda,
      legenda_linkedin: null,
      postar_instagram: true,
      postar_linkedin: false,
      url_imagem: d.imagem,
      imagens_carrossel: [],
      data_agendamento: agendar ? data.toISOString() : null,
      status: agendar ? "Agendado" : "Rascunho",
      prompt_ia: d.promptImagem,
    });
    if (error) return toast.error(error.message);
    toast.success(agendar ? `Agendado para ${fmtDate(data)}` : "Salvo como rascunho");
    onCreated();
    setOpenIdx(null);
  };

  const ativo = openIdx !== null ? dias[openIdx] : null;

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center gap-3 card-elevated">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-bold leading-tight">Calendário Editorial Semanal</h2>
            <p className="text-xs text-muted-foreground">{rangeLabel} · Segunda a Sexta</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={handleGerar} disabled={loading} className="h-10 font-semibold">
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Gerar Cronograma da Semana</>
            )}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {dias.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => d.status !== "vazio" && setOpenIdx(i)}
            className="text-left"
            disabled={d.status === "vazio"}
          >
            <Card
              className={`p-3 h-full space-y-2 transition-all ${
                d.status === "vazio"
                  ? "opacity-60"
                  : "card-elevated hover:-translate-y-0.5 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {d.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{fmtDate(d.date)}</span>
              </div>
              <div className="aspect-square rounded-md overflow-hidden bg-muted relative">
                {d.imagem ? (
                  <img src={d.imagem} alt="" className="h-full w-full object-cover" />
                ) : d.status === "gerando" ? (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <ImgIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
              <p className="text-xs font-semibold leading-snug line-clamp-2 min-h-[2.2rem]">
                {d.titulo || "—"}
              </p>
            </Card>
          </button>
        ))}
      </div>

      <Dialog open={openIdx !== null} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {ativo?.label} · {ativo && fmtDate(ativo.date)} — {ativo?.titulo}
            </DialogTitle>
          </DialogHeader>
          {ativo && openIdx !== null && (
            <div className="space-y-4">
              {ativo.imagem && (
                <img src={ativo.imagem} alt="" className="w-full aspect-video object-cover rounded-lg border" />
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">Legenda</Label>
                <Textarea
                  value={ativo.legenda}
                  onChange={(e) =>
                    setDias((arr) => arr.map((x, j) => (j === openIdx ? { ...x, legenda: e.target.value } : x)))
                  }
                  rows={6}
                />
              </div>
              <DirectReplyCard
                value={ativo.mensagemDirect}
                onChange={(v) =>
                  setDias((arr) => arr.map((x, j) => (j === openIdx ? { ...x, mensagemDirect: v } : x)))
                }
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => salvarDia(openIdx, false)}>
                  Salvar Rascunho
                </Button>
                <Button onClick={() => salvarDia(openIdx, true)} className="bg-primary">
                  <Send className="h-4 w-4 mr-2" /> Agendar para {fmtDate(ativo.date)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
