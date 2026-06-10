import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";
import { useServerFn } from "@tanstack/react-start";
import { weeklyPlan } from "@/lib/ai/weekly-plan.functions";
import { generateImage } from "@/lib/ai/generate-image.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles, Image as ImgIcon, Send, LayoutGrid, Smartphone, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { Perfil } from "@/components/ProfileSettings";
import { DirectReplyCard } from "./DirectReplyCard";
import { applyDoctorBadge, applyWatermark } from "@/lib/watermark";
import brandLogo from "@/assets/logo-clinica.png";

type PostPlano = {
  date: Date;
  label: string;
  titulo: string;
  legenda: string;
  mensagemDirect: string;
  promptImagem: string;
  horaAgendamento: string;
  formato: "Feed" | "Stories" | "Reels";
  imagem: string | null;
  status: "vazio" | "gerando" | "pronto";
};

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

// PERF: cache local do cronograma por semana (chave = ISO da segunda-feira)
const WEEK_CACHE_PREFIX = "planner_weekly_cache_v2:";
type CachedPost = Omit<PostPlano, "date"> & { dateIso: string };
function readWeekCache(weekStartIso: string): CachedPost[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WEEK_CACHE_PREFIX + weekStartIso);
    return raw ? (JSON.parse(raw) as CachedPost[]) : null;
  } catch { return null; }
}
function writeWeekCache(weekStartIso: string, posts: PostPlano[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedPost[] = posts.map(({ date, ...rest }) => ({ ...rest, dateIso: date.toISOString() }));
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

export function WeeklyCalendar({ perfil, onCreated, autoGenerate = false }: { perfil: Perfil | null; onCreated: () => void; autoGenerate?: boolean }) {
  const genPlan = useServerFn(weeklyPlan);
  const genImage = useServerFn(generateImage);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [formato, setFormato] = useState<"Feed" | "Stories" | "Reels">("Feed");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<PostPlano[]>(() =>
    DIAS.flatMap((label, i) => {
      const d = startOfWeek(new Date());
      d.setDate(d.getDate() + i);
      return [
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "10:00", formato: "Feed" as const, imagem: null, status: "vazio" as const },
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "14:00", formato: "Feed" as const, imagem: null, status: "vazio" as const }
      ];
    }),
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const rebuildEmpty = (start: Date, curFormato: "Feed" | "Stories" | "Reels") =>
    DIAS.flatMap((label, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return [
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "10:00", formato: curFormato, imagem: null, status: "vazio" as const },
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "14:00", formato: curFormato, imagem: null, status: "vazio" as const }
      ];
    });

  const navWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
    setPosts(rebuildEmpty(next, formato));
  };

  useEffect(() => {
    const cached = readWeekCache(weekStart.toISOString());
    if (cached && cached.length === 14) {
      setPosts(cached.map((c) => ({ ...c, date: new Date(c.dateIso) })));
    }
  }, [weekStart]);

  const autoGenTriggered = useRef(false);
  useEffect(() => {
    if (autoGenerate && !autoGenTriggered.current && !loading) {
      autoGenTriggered.current = true;
      handleGerar();
    }
  }, [autoGenerate, loading, posts]);

  const rangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 4);
    return `${fmtDate(weekStart)} – ${fmtDate(end)}`;
  }, [weekStart]);

  const handleGerar = async () => {
    if (loading) return;
    setLoading(true);
    const tId = toast.loading(`Gerando seu cronograma de 7 dias com 2 ${formato.toLowerCase()} por dia…`);
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
          formato: formato,
        },
      }) as any;

      if (!r.posts) throw new Error("Falha ao obter lista de posts.");

      setPosts((arr) =>
        arr.map((p, i) => ({
          ...p,
          titulo: r.posts[i]?.titulo ?? p.titulo,
          legenda: r.posts[i]?.legenda_instagram ?? "",
          mensagemDirect: r.posts[i]?.mensagem_direct ?? "",
          promptImagem: r.posts[i]?.prompt_imagem ?? "",
          horaAgendamento: r.posts[i]?.hora_agendamento ?? p.horaAgendamento,
          status: "gerando",
        })),
      );

      toast.loading("Gerando 14 imagens em paralelo…", { id: tId });

      const results = await Promise.allSettled(
        r.posts.map((p: any) => genImage({ data: { prompt: p.prompt_imagem, aspect: formato === "Feed" ? "1:1" : "9:16" } })),
      );

      setPosts((arr) => {
        const updated = arr.map((p, i) => {
          const res = results[i] as any;
          if (res && res.status === "fulfilled") {
            return { ...p, imagem: res.value.dataUrl, status: "pronto" as const };
          }
          return { ...p, status: "pronto" as const };
        });
        writeWeekCache(weekStart.toISOString(), updated);
        return updated;
      });

      // aplica badge do médico e logo se houver
      const next = await Promise.all(
        results.map(async (res: any) => {
          if (res.status !== "fulfilled") return null;
          let currentUrl = res.value.dataUrl;
          
          // Aplica logo da clínica
          try {
            currentUrl = await applyWatermark(currentUrl, brandLogo, {
              position: "tr", // Canto superior direito
              sizeRatio: 0.08,
              opacity: 0.8,
            });
          } catch (e) { console.error("Erro watermark logo:", e); }

          // Aplica barra do médico
          try {
            if (perfil?.nome_profissional || perfil?.cro_uf) {
              currentUrl = await applyDoctorBadge(currentUrl, {
                nome: perfil.nome_profissional ?? "",
                cro: perfil.cro_uf ?? "",
              });
            }
          } catch (e) { console.error("Erro badge médico:", e); }
          
          return currentUrl;
        }),
      );
      setPosts((arr) => {
        const updated = arr.map((p, i) => ({ ...p, imagem: next[i] ?? p.imagem }));
        writeWeekCache(weekStart.toISOString(), updated);
        return updated;
      });
      toast.success("Cronograma de 14 posts pronto! ✨", { id: tId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar cronograma", { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const salvarDia = async (i: number, agendar: boolean) => {
    const p = posts[i];
    if (!p.legenda.trim()) return toast.error("Texto vazio.");
    const data = new Date(p.date);
    const [h, m] = p.horaAgendamento.split(":").map(Number);
    data.setHours(h || 10, m || 0, 0, 0);
    let uid: string;
    try { uid = await getAuthedUserId(); } catch (e) { return toast.error(e instanceof Error ? e.message : "Sessão expirada"); }
    const { error } = await supabase.from("posts").insert({
      user_id: uid,
      tipo_post: "Post Único",
      estilo_layout: "Padrão",
      formato_midia: "Imagem",
      legenda: p.legenda,
      legenda_instagram: p.legenda,
      legenda_linkedin: null,
      postar_instagram: true,
      postar_linkedin: false,
      url_imagem: p.imagem,
      imagens_carrossel: [],
      data_agendamento: agendar ? data.toISOString() : null,
      status: agendar ? "Agendado" : "Rascunho",
      prompt_ia: p.promptImagem,
    });
    if (error) return toast.error(error.message);
    toast.success(agendar ? `Agendado para ${fmtDate(data)} às ${p.horaAgendamento}` : "Salvo como rascunho");
    onCreated();
    setOpenIdx(null);
  };

  const ativo = openIdx !== null ? posts[openIdx] : null;

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center gap-3 card-elevated">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-bold leading-tight">Calendário Editorial Semanal</h2>
            <p className="text-xs text-muted-foreground">{rangeLabel} · 7 dias (2 {formato}/dia)</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 ml-4">
          <button
            onClick={() => { setFormato("Feed"); setPosts(rebuildEmpty(weekStart, "Feed")); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
              formato === "Feed" ? "bg-white shadow-md text-primary ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Feed (7 Dias)
          </button>
          <button
            onClick={() => { setFormato("Stories"); setPosts(rebuildEmpty(weekStart, "Stories")); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
              formato === "Stories" ? "bg-white shadow-md text-primary ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Smartphone className="h-4 w-4" />
            Stories (7 Dias)
          </button>
          <button
            onClick={() => { setFormato("Reels"); setPosts(rebuildEmpty(weekStart, "Reels")); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
              formato === "Reels" ? "bg-white shadow-md text-primary ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Video className="h-4 w-4" />
            Reels (7 Dias)
          </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
        {DIAS.map((label, dayIdx) => {
          const dayPosts = posts.filter(p => p.label === label);
          const date = dayPosts[0]?.date;
          
          return (
            <div key={label} className="space-y-3">
              <div className="flex flex-col border-b pb-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {date ? fmtDate(date) : ""}
                </span>
              </div>
              
              <div className="space-y-3">
                {dayPosts.map((p) => {
                  const globalIdx = posts.findIndex(item => item === p);
                  return (
                    <button
                      key={`${label}-${p.horaAgendamento}`}
                      type="button"
                      onClick={() => p.status !== "vazio" && setOpenIdx(globalIdx)}
                      className="text-left w-full group"
                      disabled={p.status === "vazio"}
                    >
                      <Card
                        className={cn(
                          "p-2.5 h-full space-y-2 transition-all border-dashed",
                          p.status === "vazio"
                            ? "opacity-40 border-muted-foreground/30 bg-transparent"
                            : "card-elevated hover:border-primary/50 cursor-pointer border-solid bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[9px] px-1 h-4 font-bold border-primary/20 bg-primary/5 text-primary">
                            {p.horaAgendamento}
                          </Badge>
                          {p.status === "pronto" && (
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                          )}
                        </div>
                        
                        <div className={cn(
                          "aspect-[4/5] rounded overflow-hidden bg-muted relative border shadow-inner",
                          formato === "Feed" ? "aspect-square" : "aspect-[9/16]"
                        )}>
                          {p.imagem ? (
                            <img src={p.imagem} alt="" className="h-full w-full object-cover" />
                          ) : p.status === "gerando" ? (
                            <div className="h-full w-full flex items-center justify-center bg-slate-50">
                              <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
                            </div>
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center gap-1 opacity-20">
                              <ImgIcon className="h-5 w-5" />
                              <span className="text-[8px] font-bold">AGUARDANDO</span>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-[10px] font-bold leading-tight line-clamp-3 text-slate-700 min-h-[2.4rem]">
                          {p.titulo || "Post planejado"}
                        </p>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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
                    setPosts((arr: any) => arr.map((x: any, j: number) => (j === openIdx ? { ...x, legenda: e.target.value } : x)))
                  }
                  rows={6}
                />
              </div>
              <DirectReplyCard
                value={ativo.mensagemDirect}
                onChange={(v: string) =>
                  setPosts((arr: any) => arr.map((x: any, j: number) => (j === openIdx ? { ...x, mensagemDirect: v } : x)))
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
