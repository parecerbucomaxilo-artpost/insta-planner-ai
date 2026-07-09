import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar as CalIcon, Image as ImgIcon, Film, Eye, Send, Loader2, ChevronLeft, ChevronRight, Clock, RotateCcw, ScanEye, Copy, Download, Pencil, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PostRow } from "@/lib/posts-types";
import { publishInstagramNow } from "@/lib/social/instagram-publish.functions";
import { LogoPreviewDialog } from "@/components/LogoPreviewDialog";

const statusColor: Record<string, string> = {
  Rascunho: "bg-[var(--status-draft)]",
  Agendado: "bg-[var(--status-scheduled)]",
  EnviadoMake: "bg-[var(--status-sent)]",
  Publicado: "bg-[var(--status-published)]",
  Erro: "bg-[var(--status-error)]",
};

const statusLabel: Record<string, string> = {
  EnviadoMake: "Pendente Meta",
};

const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";

function normalizeInstagramAccount(value: string | null | undefined) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function getSlideCaption(legenda: string | null | undefined, index: number) {
  const txt = String(legenda || "").trim();
  if (!txt) return "";
  const matches = Array.from(txt.matchAll(/(?:^|\n)(Slide\s*(\d+)\s*[:—-]\s*[\s\S]*?)(?=\n\s*Slide\s*\d+\s*[:—-]|\n\s*Saiba mais|\n\s*Atendimento|\n\s*Salve|\n\s*#|$)/gi));
  const found = matches.find((m) => Number(m[2]) === index + 1)?.[1]?.trim();
  return found || txt;
}

export function PostsList({ posts, onChange }: { posts: PostRow[]; onChange: () => void }) {
  // const sendAlbato = useServerFn(dispatchAlbato); // Removido para reset logic
  const publishIg = useServerFn(publishInstagramNow);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState<Record<string, number>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (p: PostRow) => {
    setEditingId(p.id);
    setEditingText(String(p.legenda || ""));
  };
  const cancelEdit = () => { setEditingId(null); setEditingText(""); };
  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("posts").update({ legenda: editingText }).eq("id", id);
      if (error) throw error;
      toast.success("Legenda atualizada.");
      cancelEdit();
      onChange();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar legenda.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Post excluído"); 
      onChange(); 
    } catch (error: any) {
      console.error("[Reset] Erro ao excluir:", error);
      toast.error(error.message || "Erro ao excluir post");
    }
  };

  const handlePostNow = async (p: PostRow) => {
    setPublishingId(p.id);
    try {
      const out = await publishIg({ data: { id: p.id } });
      if (out && "ok" in out && out.ok === false) {
        throw new Error("error" in out ? out.error : "Falha ao publicar no Instagram.");
      }
      const isLiga = normalizeInstagramAccount(p.instagram_conta) === LIGA_ACCOUNT;
      toast.success(isLiga ? "Publicado via @drfranciscomenezes com convite à Liga!" : "Publicado no Instagram pela Meta!");
      onChange();
    } catch (e: any) {
      toast.error(e.message || "Falha ao publicar");
    } finally {
      setPublishingId(null);
    }
  };

  const copiarTexto = async (texto: string, mensagem = "Texto copiado.") => {
    if (!texto.trim()) return toast.error("Não há legenda para copiar.");
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    toast.success(mensagem);
  };

  const baixarMidia = async (url: string, nome: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Não foi possível baixar a imagem.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast.error(e.message || "Falha ao baixar.");
    }
  };


  if (posts.length === 0) {
    return (
      <Card className="p-12 text-center card-elevated">
        <ImgIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhum post ainda. Crie o primeiro!</p>
      </Card>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {posts.map((p) => {
        const carrosselUrls: string[] = Array.isArray(p.imagens_carrossel) ? (p.imagens_carrossel as string[]) : [];
        const isCarrossel = p.tipo_post === "Carrossel" && carrosselUrls.length > 1;
        const idx = slideIdx[p.id] ?? 0;
        const safeIdx = isCarrossel ? Math.min(idx, carrosselUrls.length - 1) : 0;
        const thumb = isCarrossel
          ? carrosselUrls[safeIdx]
          : (p.url_imagem ?? (p as any).url_da_imagem ?? carrosselUrls[0] ?? null);
        const isVideo = p.formato_midia === "Vídeo/Reels";
        const isViral = (p.visualizacoes ?? 0) >= 500;
        const isPublishing = publishingId === p.id;
        const alreadyPublished = p.status === "Publicado";
        const failedPublish = p.status === "Erro";
        const isLigaPost = normalizeInstagramAccount(p.instagram_conta) === LIGA_ACCOUNT;
        const legendaExibida = isCarrossel ? getSlideCaption(p.legenda, safeIdx) : p.legenda;
        const goPrev = () =>
          setSlideIdx((s) => ({ ...s, [p.id]: (safeIdx - 1 + carrosselUrls.length) % carrosselUrls.length }));
        const goNext = () =>
          setSlideIdx((s) => ({ ...s, [p.id]: (safeIdx + 1) % carrosselUrls.length }));
        return (
          <Card
            key={p.id}
            className={`overflow-hidden flex flex-col card-elevated transition-all ${isViral ? "ring-2 ring-amber-500/50" : ""}`}
          >
            <div className="aspect-square bg-muted relative overflow-hidden group">
              {isVideo && thumb ? (
                <video src={thumb} className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]" muted playsInline />
              ) : thumb ? (
                <img src={thumb} alt="" className="w-full h-full object-cover transition-transform duration-500" />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground"><ImgIcon className="h-8 w-8" /></div>
              )}
              <Badge className={`absolute top-2 left-2 text-white ${statusColor[p.status] ?? "bg-[var(--status-draft)]"} shadow-sm`}>{statusLabel[p.status] ?? p.status}</Badge>
              {isVideo && (
                <Badge className="absolute top-2 right-2 bg-violet-500 hover:bg-violet-500 text-white shadow-sm">
                  <Film className="h-3 w-3 mr-1" /> Reels
                </Badge>
              )}
              {!isVideo && p.tipo_post === "Carrossel" && (
                <Badge variant="secondary" className="absolute top-2 right-2 shadow-sm">
                  {isCarrossel ? `${safeIdx + 1}/${carrosselUrls.length}` : `${carrosselUrls.length} imgs`}
                </Badge>
              )}
              {isCarrossel && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Slide anterior"
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Próximo slide"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {carrosselUrls.map((_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === safeIdx ? "bg-white" : "bg-white/40"}`} />
                    ))}
                  </div>
                </>
              )}
              {isViral && (
                <Badge className="absolute bottom-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 animate-pulse shadow-sm">
                  🔥 500+ Views!
                </Badge>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col gap-3">
              <div className="flex gap-1 flex-wrap items-center">
                <Badge variant="outline" className="text-xs">{p.tipo_post}</Badge>
                <Badge variant="outline" className="text-xs">{p.estilo_layout}</Badge>
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {(p as any).created_at && (
                    <span className="flex items-center gap-1" title="Criado em">
                      <Clock className="h-3 w-3" />
                      {format(new Date((p as any).created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  <span className="flex items-center gap-1" title="Visualizações">
                    <Eye className="h-3 w-3" /> {(p.visualizacoes ?? 0).toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <p className="text-sm line-clamp-3 flex-1 leading-relaxed">
                {legendaExibida || <span className="text-muted-foreground">(sem legenda)</span>}
              </p>
              {p.data_agendamento && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalIcon className="h-3 w-3" /> {format(new Date(p.data_agendamento), "Pp", { locale: ptBR })}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handlePostNow(p)}
                  disabled={isPublishing}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md hover:-translate-y-px disabled:opacity-60"
                >
                  {isPublishing ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Publicando…</>
                  ) : failedPublish ? (
                    <><RotateCcw className="h-4 w-4 mr-1.5" /> Tentar novamente</>
                  ) : alreadyPublished ? (
                    <><Send className="h-4 w-4 mr-1.5" /> Republicar Agora</>
                  ) : isLigaPost ? (
                    <><Send className="h-4 w-4 mr-1.5" /> Publicar + Convidar Liga</>
                  ) : (
                    <><Send className="h-4 w-4 mr-1.5" /> Postar Agora</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPreviewId(p.id)}
                  disabled={isPublishing}
                  aria-label="Pré-visualizar com logo"
                  title="Pré-visualizar com logo"
                >
                  <ScanEye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(p.id)}
                  disabled={isPublishing}
                  aria-label="Excluir post"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

            </div>
          </Card>
        );
      })}
      <LogoPreviewDialog postId={previewId} open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)} />
    </div>
  );
}
