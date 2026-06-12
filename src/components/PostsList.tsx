import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar as CalIcon, Image as ImgIcon, Film, Eye, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { dispatchAlbato } from "@/lib/webhooks/albato.functions";
import { toast } from "sonner";
import type { PostRow } from "@/lib/posts-types";

const statusColor: Record<string, string> = {
  Rascunho: "bg-[var(--status-draft)]",
  Agendado: "bg-[var(--status-scheduled)]",
  Publicado: "bg-[var(--status-published)]",
  Erro: "bg-[var(--status-error)]",
};

export function PostsList({ posts, onChange }: { posts: PostRow[]; onChange: () => void }) {
  const sendAlbato = useServerFn(dispatchAlbato);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Post excluído"); onChange(); }
  };

  const handlePostNow = async (p: PostRow) => {
    if (publishingId) return;
    setPublishingId(p.id);
    const loadingId = toast.loading("Publicando agora nas redes integradas…");
    try {
      const rawMediaUrl = p.url_imagem ?? p.imagens_carrossel?.[0] ?? null;
      const mediaUrl = p.url_imagem ?? (p.imagens_carrossel?.[0] as string) ?? null;
      const caption = p.legenda_instagram || p.legenda_linkedin || p.legenda || "";
      const nowIso = new Date().toISOString();

      const r = await sendAlbato({
        data: {
          media_url: mediaUrl,
          caption,
          data_agendamento: nowIso,
          post_id: p.id,
          status: "Publicado",
        },
      });

      if (!r.ok) {
        toast.error(`Falha no webhook (status ${r.status})`, { id: loadingId });
        return;
      }

      const { error } = await supabase
        .from("posts")
        .update({ status: "Publicado", data_agendamento: nowIso })
        .eq("id", p.id);
      if (error) {
        toast.error(`Publicado nas redes, mas falhou ao atualizar status: ${error.message}`, { id: loadingId });
      } else {
        toast.success("✅ Post publicado agora!", { id: loadingId });
        onChange();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar", { id: loadingId });
    } finally {
      setPublishingId(null);
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
        const rawThumb = p.url_imagem ?? p.imagens_carrossel?.[0] ?? null;
        const thumb = p.url_imagem ?? (p.imagens_carrossel?.[0] as string) ?? null;
        const isVideo = p.formato_midia === "Vídeo/Reels";
        const isViral = (p.visualizacoes ?? 0) >= 500;
        const isPublishing = publishingId === p.id;
        const alreadyPublished = p.status === "Publicado";
        return (
          <Card
            key={p.id}
            className={`overflow-hidden flex flex-col card-elevated transition-all ${isViral ? "ring-2 ring-amber-500/50" : ""}`}
          >
            <div className="aspect-square bg-muted relative overflow-hidden">
              {isVideo && thumb ? (
                <video src={thumb} className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]" muted playsInline />
              ) : thumb ? (
                <img src={thumb} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.03]" />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground"><ImgIcon className="h-8 w-8" /></div>
              )}
              <Badge className={`absolute top-2 left-2 text-white ${statusColor[p.status]} shadow-sm`}>{p.status}</Badge>
              {isVideo && (
                <Badge className="absolute top-2 right-2 bg-violet-500 hover:bg-violet-500 text-white shadow-sm">
                  <Film className="h-3 w-3 mr-1" /> Reels
                </Badge>
              )}
              {!isVideo && p.tipo_post === "Carrossel" && (
                <Badge variant="secondary" className="absolute top-2 right-2 shadow-sm">{p.imagens_carrossel?.length ?? 0} imgs</Badge>
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
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {(p.visualizacoes ?? 0).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm line-clamp-3 flex-1 leading-relaxed">
                {p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}
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
                  disabled={isPublishing || alreadyPublished}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md hover:-translate-y-px disabled:opacity-60"
                >
                  {isPublishing ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Publicando…</>
                  ) : alreadyPublished ? (
                    <>✓ Publicado</>
                  ) : (
                    <><Send className="h-4 w-4 mr-1.5" /> Postar Agora</>
                  )}
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
    </div>
  );
}
