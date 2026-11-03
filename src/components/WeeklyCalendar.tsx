import { useGuardaIA } from "@/components/GenerationMode";
import { useState, useMemo, useEffect, useRef } from "react";
import { salvarPostInedito } from "@/lib/post-guard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedUserId } from "@/lib/auth-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles, Image as ImgIcon, Send, LayoutGrid, Smartphone, Video, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { Perfil } from "@/components/ProfileSettings";
import { DirectReplyCard } from "./DirectReplyCard";
// import { applyDoctorBadge, applyWatermark } from "@/lib/watermark";
import brandLogo from "@/assets/logo-clinica.png";
import { useServerFn } from "@tanstack/react-start";
import { generateSinglePost } from "@/lib/ai-post.functions";
import { horariosDoDia, parseHorario, POSTS_POR_DIA_PADRAO } from "@/lib/post-slots";
import { PostReviewActions } from "@/components/PostReviewActions";
import type { PostRow } from "@/lib/posts-types";
// import { suggestIdea } from "@/lib/ai/suggest-idea.functions";

type PostPlano = {
  postId?: string;
  reviewStatus?: PostRow["status"];
  date: Date;
  label: string;
  titulo: string;
  legenda: string;
  mensagemDirect: string;
  promptImagem: string;
  horaAgendamento: string;
  formato: "Feed" | "Stories" | "Reels" | "Carrossel";
  imagem: string | null;
  imagens: string[]; // Para carrossel
  status: "vazio" | "gerando" | "pronto" | "regerando";
  slidesData?: Array<{
    titulo_slide: string;
    subtitulo_slide?: string;
    prompt_visual: string;
    bullets?: string[];
  }>;
};

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

function ImageCarousel({ images, className }: { images: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 50) handleNext();
    if (diff < -50) handlePrev();
    setTouchStart(null);
  };

  return (
    <div 
      className={cn("relative group/carousel overflow-hidden touch-pan-y", className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative h-full w-full flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {images.map((img, i) => (
          <img key={i} src={img} alt="" className="h-full w-full flex-shrink-0 object-cover" />
        ))}
      </div>
      
      {images.length > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300", 
                  i === idx ? "bg-white w-4" : "bg-white/40 w-1.5 hover:bg-white/60"
                )} 
              />
            ))}
          </div>
          
          <button 
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <button 
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

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

export function WeeklyCalendar({ perfil: _perfil, onCreated, autoGenerate = false }: { perfil: Perfil | null; onCreated: () => void; autoGenerate?: boolean }) {
  const gerarPostFn = useGuardaIA("Gerar publicação", useServerFn(generateSinglePost));
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [formato, setFormato] = useState<"Feed" | "Stories" | "Reels" | "Carrossel">("Feed");
  const [loading, setLoading] = useState(false);
  const [ultimoGerado, setUltimoGerado] = useState<string | null>(null);
  const [generateImages, setGenerateImages] = useState(true);
  const [posts, setPosts] = useState<PostPlano[]>(() =>
    DIAS.flatMap((label, i) => {
      const d = startOfWeek(new Date());
      d.setDate(d.getDate() + i);
      return [
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "10:00", formato: "Feed" as const, imagem: null, imagens: [], status: "vazio" as const },
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "14:00", formato: "Feed" as const, imagem: null, imagens: [], status: "vazio" as const }
      ];
    }),
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const rebuildEmpty = (start: Date, curFormato: "Feed" | "Stories" | "Reels" | "Carrossel") =>
    DIAS.flatMap((label, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return [
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "10:00", formato: curFormato, imagem: null, imagens: [], status: "vazio" as const },
        { date: d, label, titulo: "", legenda: "", mensagemDirect: "", promptImagem: "", horaAgendamento: "14:00", formato: curFormato, imagem: null, imagens: [], status: "vazio" as const }
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

  const handleRegenerar = async (idx: number) => {
    toast.info("A IA foi resetada para reconstrução.");
  };

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

  const gerandoRef = useRef(false);
  const handleGerar = async () => {
    // Trava síncrona: `loading` só muda no próximo render; duplo clique/efeito duplo disparava 2 lotes.
    if (loading || gerandoRef.current) return;
    gerandoRef.current = true;
    setLoading(true);
    const especialidade = "CTBMF" as const;
    const operacaoId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now()}`;
    // 4 publicações por dia x 7 dias = 28 slots (09:00, 14:00, 18:00, 21:00, fuso local); cada slot tem tema próprio
    const slots: { quando: Date; tipo: "feed" | "stories"; key: string }[] = [];
    for (let d = 0; d < 7; d++) {
      for (const h of horariosDoDia(POSTS_POR_DIA_PADRAO)) {
        const { hora, minuto } = parseHorario(h);
        const q = new Date(weekStart);
        q.setDate(q.getDate() + d);
        q.setHours(hora, minuto, 0, 0);
        slots.push({ quando: q, tipo: "feed", key: `${q.toDateString()}T${h}` });
      }
    }

    toast.info(`Gerando ${slots.length} publicações para os próximos 7 dias…`);
    let ok = 0; let fail = 0;
    try {
      // SEQUENCIAL: antes eram 14 gerações em paralelo com tema vazio; todas liam o mesmo histórico
      // antes de qualquer uma salvar e escolhiam o mesmo tema → posts duplicados/triplicados.
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        try {
          const result = await gerarPostFn({
            data: {
              tema: "",
              especialidade,
              rede: "instagram",
              tipo: s.tipo,
              quando: s.quando.toISOString(),
              status: "PendenteAprovacao",
              nivel: "auto",
              audiencia: "geral",
              ambasRedes: false,
              operacaoId,
              slotKey: s.key,
            },
          });
          setPosts((items) => items.map((item, index) => index === i ? {
            ...item,
            postId: result.id,
            reviewStatus: "PendenteAprovacao",
            date: s.quando,
            horaAgendamento: s.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            legenda: result.legenda,
            titulo: result.legenda.split("\n")[0],
            imagem: result.urls[0] ?? null,
            imagens: result.urls,
            status: "pronto",
          } : item));
          setUltimoGerado(result.id);
          ok++;
        } catch (e) {
          console.error("[WeeklyCalendar] gerar falhou", e);
          fail++;
        }
      }
    } finally {
      gerandoRef.current = false;
      setLoading(false);
    }
    if (ok > 0) toast.success(`${ok} publicações geradas para revisão. Ainda não estão agendadas.`);
    if (fail > 0) toast.error(`${fail} não foram geradas (falha ou conteúdo repetido) — nada duplicado foi salvo.`);
    onCreated();
  };

  const salvarDia = async (i: number, agendar: boolean) => {
    const p = posts[i];
    if (!p.legenda.trim()) return toast.error("Texto vazio.");
    const data = new Date(p.date);
    const [h, m] = p.horaAgendamento.split(":").map(Number);
    data.setHours(h || 10, m || 0, 0, 0);
    let uid: string;
    try { uid = await getAuthedUserId(); } catch (e) { return toast.error(e instanceof Error ? e.message : "Sessão expirada"); }
    if (p.postId) {
      const { error } = await supabase.from("posts").update({
        legenda: p.legenda,
        legenda_instagram: p.legenda,
        data_agendamento: agendar ? data.toISOString() : null,
        status: agendar ? "Agendado" : "Rascunho",
      }).eq("id", p.postId).select("id").single();
      if (error) return toast.error(error.message);
      setPosts((items) => items.map((item, index) => index === i ? { ...item, reviewStatus: agendar ? "Agendado" : "Rascunho" } : item));
      toast.success(agendar ? "Post agendado." : "Rascunho atualizado.");
      onCreated();
      setOpenIdx(null);
      return;
    }
    try {
      const salvo = await salvarPostInedito(supabase, uid, {
      tipo_post: p.formato === "Carrossel" ? "Carrossel" : "Post Único",
      estilo_layout: "Padrão",
      formato_midia: p.formato === "Carrossel" ? "Carrossel" : "Imagem",
      legenda: p.legenda,
      legenda_instagram: p.legenda,
      legenda_linkedin: null,
      postar_instagram: true,
      postar_linkedin: false,
      url_imagem: p.formato === "Carrossel" ? (p.imagens[0] || p.imagem) : p.imagem,
      imagens_carrossel: p.formato === "Carrossel" ? p.imagens : [],
      data_agendamento: agendar ? data.toISOString() : null,
      status: agendar ? "Agendado" : "Rascunho",
      prompt_ia: p.promptImagem,
      });
      if (salvo.existente) { toast.info("Este post já estava salvo — nenhuma cópia criada."); onCreated(); return; }
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
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
          <button
            onClick={() => { setFormato("Carrossel"); setPosts(rebuildEmpty(weekStart, "Carrossel")); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
              formato === "Carrossel" ? "bg-white shadow-md text-primary ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="h-4 w-4 rotate-45" />
            Carrossel (7 Dias)
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <input 
              type="checkbox" 
              id="gen-images" 
              checked={generateImages} 
              onChange={(e) => setGenerateImages(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="gen-images" className="text-xs font-medium cursor-pointer">Gerar imagens locais</Label>
          </div>

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
                    <div key={`${label}-${p.horaAgendamento}`} className="relative group/post">
                      <button
                        type="button"
                        onClick={() => p.status !== "vazio" && p.status !== "regerando" && setOpenIdx(globalIdx)}
                        className="text-left w-full"
                        disabled={p.status === "vazio" || p.status === "regerando"}
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
                            {p.imagens && p.imagens.length > 0 ? (
                              <ImageCarousel images={p.imagens} className="h-full w-full" />
                            ) : p.imagem ? (
                              <img src={p.imagem} alt="" className="h-full w-full object-cover" />
                            ) : (p.status === "gerando" || p.status === "regerando") ? (
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
                      {p.postId && <div className="mt-2"><PostReviewActions id={p.postId} autoOpen={p.postId === ultimoGerado} status={p.reviewStatus} disabled={loading} onChange={(status) => {
                        setPosts((items) => items.map((item, index) => index === globalIdx ? { ...item, reviewStatus: status } : item));
                        onCreated();
                      }} /></div>}
                      
                      {p.status === "pronto" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRegenerar(globalIdx); }}
                          className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-white shadow-md border flex items-center justify-center text-primary opacity-0 group-hover/post:opacity-100 transition-opacity z-10 hover:bg-slate-50"
                          title="Gerar nova ideia para este horário"
                        >
                          <RefreshCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
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
              {ativo.imagens && ativo.imagens.length > 0 ? (
                <ImageCarousel images={ativo.imagens} className="w-full aspect-video rounded-lg border shadow-sm" />
              ) : ativo.imagem ? (
                <img src={ativo.imagem} alt="" className="w-full aspect-video object-cover rounded-lg border" />
              ) : null}
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
              {ativo.postId && <PostReviewActions id={ativo.postId} status={ativo.reviewStatus} onChange={(status) => {
                setPosts((items) => items.map((item, index) => index === openIdx ? { ...item, reviewStatus: status } : item));
                onCreated();
              }} />}
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
