import { useEffect, useRef, useState } from "react";
import { Check, X, Eye, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { signPostMediaUrls } from "@/lib/storage-url";
import type { PostRow } from "@/lib/posts-types";
import {
  canReview,
  reviewStatus,
  POST_REVIEW_CHANGED,
  type ReviewDecision,
} from "@/lib/post-review";

export function PostReviewActions({
  id,
  status = "PendenteAprovacao",
  disabled = false,
  onChange,
}: {
  id: string;
  status?: PostRow["status"];
  disabled?: boolean;
  onChange?: (status: PostRow["status"]) => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [busy, setBusy] = useState<ReviewDecision | "visualizar" | null>(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [post, setPost] = useState<PostRow | null>(null);
  const [slide, setSlide] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  useEffect(() => {
    setCurrentStatus(status);
  }, [status, id]);
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; status: PostRow["status"] }>).detail;
      if (detail?.id === id) setCurrentStatus(detail.status);
    };
    window.addEventListener(POST_REVIEW_CHANGED, sync);
    return () => window.removeEventListener(POST_REVIEW_CHANGED, sync);
  }, [id]);
  useEffect(() => {
    setMediaError(false);
  }, [slide, post]);

  const visualizar = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy("visualizar");
    try {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
      if (error) throw error;
      const signed = await signPostMediaUrls(data as unknown as PostRow);
      setPost(signed as PostRow);
      setCurrentStatus(data.status as PostRow["status"]);
      setSlide(0);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o post.");
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const decidir = async (decision: ReviewDecision) => {
    if (lock.current || !canReview(currentStatus)) return;
    lock.current = true;
    setBusy(decision);
    try {
      const next = reviewStatus(decision);
      // Guard the previous state as well as the ID: stale reviews cannot overwrite publication.
      const { data, error } = await supabase
        .from("posts")
        .update({ status: next })
        .eq("id", id)
        .eq("status", "PendenteAprovacao")
        .select("id,status")
        .single();
      if (error || !data)
        throw new Error(
          error?.message ||
            "O post mudou ou você não tem permissão para revisá-lo. Atualize a prévia.",
        );
      setCurrentStatus(next);
      setConfirm(false);
      toast.success(
        decision === "aceitar"
          ? "Post aceito e salvo como rascunho. Não foi publicado."
          : "Post negado e arquivado.",
      );
      window.dispatchEvent(new CustomEvent(POST_REVIEW_CHANGED, { detail: { id, status: next } }));
      onChange?.(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a revisão.");
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const blocked = disabled || busy !== null;
  const images =
    post?.tipo_post === "Carrossel" && post.imagens_carrossel.length
      ? post.imagens_carrossel
      : post?.url_imagem
        ? [post.url_imagem]
        : [];
  const caption = post?.legenda || post?.legenda_instagram || post?.legenda_linkedin;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" aria-label="Revisão do post" aria-busy={busy !== null}>
        <Button size="sm" variant="outline" disabled={blocked} onClick={visualizar}>
          {busy === "visualizar" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Eye className="h-4 w-4 mr-1" />
          )}
          Visualizar
        </Button>
        <Button
          size="sm"
          disabled={blocked || !canReview(currentStatus)}
          onClick={() => decidir("aceitar")}
        >
          {busy === "aceitar" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Aceitar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={blocked || !canReview(currentStatus)}
          onClick={() => setConfirm(true)}
        >
          {busy === "negar" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <X className="h-4 w-4 mr-1" />
          )}
          Negar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {currentStatus === "PendenteAprovacao"
          ? "Aguardando revisão"
          : currentStatus === "Arquivado"
            ? "Negado / arquivado"
            : currentStatus === "Rascunho"
              ? "Rascunho — não publicado"
              : currentStatus}
      </p>
      <AlertDialog
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Negar este post?</AlertDialogTitle>
            <AlertDialogDescription>
              O post será arquivado, sem excluir a imagem ou a legenda. Ele não será publicado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={busy !== null} onClick={() => decidir("negar")}>
              {busy === "negar" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmar
              recusa
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar post completo</DialogTitle>
            <DialogDescription>
              {post?.tipo_post} · {post?.formato_midia}
              {post?.data_agendamento &&
                ` · ${format(new Date(post.data_agendamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted flex justify-center min-h-24">
              {mediaError ? (
                <p role="alert" className="p-4 text-destructive">
                  Não foi possível carregar a mídia. Feche e abra a prévia para tentar novamente.
                </p>
              ) : images[slide] ? (
                post?.formato_midia === "Vídeo/Reels" ? (
                  <video
                    src={images[slide]}
                    controls
                    playsInline
                    className="w-full max-h-[55vh] object-contain"
                    onError={() => setMediaError(true)}
                  />
                ) : (
                  <img
                    src={images[slide]}
                    alt={`Imagem ${slide + 1} de ${images.length}`}
                    className="w-full max-h-[55vh] object-contain"
                    onError={() => setMediaError(true)}
                  />
                )
              ) : (
                <p className="p-4 text-muted-foreground">Sem imagem disponível.</p>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex justify-center items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Slide anterior"
                  onClick={() => setSlide((i) => (i - 1 + images.length) % images.length)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span role="status">
                  {slide + 1} / {images.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Próximo slide"
                  onClick={() => setSlide((i) => (i + 1) % images.length)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap break-words">{caption || "Sem legenda."}</p>
            {post?.legenda_instagram && post.legenda_instagram !== caption && (
              <section>
                <h3 className="font-semibold">Legenda Instagram</h3>
                <p className="text-sm whitespace-pre-wrap break-words">{post.legenda_instagram}</p>
              </section>
            )}
            {post?.legenda_linkedin && post.legenda_linkedin !== caption && (
              <section>
                <h3 className="font-semibold">Legenda LinkedIn</h3>
                <p className="text-sm whitespace-pre-wrap break-words">{post.legenda_linkedin}</p>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
