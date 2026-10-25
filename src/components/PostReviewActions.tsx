import { useEffect, useRef, useState } from "react";
import { Check, X, Eye, Loader2, ChevronLeft, ChevronRight, Pencil, Save, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  canEditPreview,
  formatPreviewDate,
  loadPostPreview,
  previewCaption,
  previewPlatforms,
  savedSlideText,
  type PreviewData,
  type PreviewPlatform,
} from "@/lib/post-preview";
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
import { signPostMediaStrict } from "@/lib/storage-url";
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
  const [busy, setBusy] = useState<ReviewDecision | "visualizar" | "editar" | null>(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const post = preview?.post ?? null;
  const [slide, setSlide] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [platform, setPlatform] = useState<PreviewPlatform | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ legenda: "", legenda_instagram: "", legenda_linkedin: "" });
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

  const carregarPrevia = async () => {
    const data = await loadPostPreview(id, {
      fetchPost: async (postId) => {
        const { data, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
        return { data: data as unknown as PostRow | null, error };
      },
      signOne: signPostMediaStrict,
    });
    setPreview(data);
    setCurrentStatus(data.post.status);
    return data;
  };

  // A prévia abre na hora (com carregamento) e mostra o erro DENTRO do modal, com "Tentar novamente".
  const visualizar = async () => {
    if (busy === "visualizar") return;
    setBusy("visualizar");
    setOpen(true);
    setLoadError(null);
    setEditing(false);
    setSlide(0);
    try {
      const data = await carregarPrevia();
      setPlatform(previewPlatforms(data.post)[0] ?? null);
    } catch (error) {
      setPreview(null);
      setLoadError(error instanceof Error ? error.message : "Não foi possível abrir o post.");
    } finally {
      setBusy(null);
    }
  };

  const salvarEdicao = async () => {
    if (!post || lock.current || !canEditPreview(currentStatus)) return;
    lock.current = true;
    setBusy("editar");
    try {
      const { data, error } = await supabase
        .from("posts")
        .update(draft)
        .eq("id", id)
        .eq("status", currentStatus)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message || "O post mudou. Reabra a prévia.");
      setPreview((prev) => (prev ? { ...prev, post: data as unknown as PostRow } : prev));
      setEditing(false);
      window.dispatchEvent(
        new CustomEvent(POST_REVIEW_CHANGED, { detail: { id, status: currentStatus } }),
      );
      toast.success("Textos salvos. O post não foi publicado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar os textos.");
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
  const images = preview?.media ?? [];
  const slideFalhou = preview?.mediaFalhas.includes(slide) ?? false;
  const slideAusente = preview?.mediaAusente.includes(slide) ?? false;
  const caption = post ? previewCaption(post, platform) : "";
  const platforms = post ? previewPlatforms(post) : [];
  const slideText = post ? savedSlideText(post.legenda, slide) : null;
  return (
    <div className="w-full min-w-0 space-y-2 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap gap-2" aria-label="Revisão do post" aria-busy={busy !== null}>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 px-3 text-sm"
          disabled={busy === "visualizar"}
          aria-haspopup="dialog"
          onClick={visualizar}
        >
          {busy === "visualizar" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Eye className="h-4 w-4 mr-1" />
          )}
          Visualizar post
        </Button>
        <Button
          size="sm"
          className="min-h-11 flex-1 px-3 text-sm font-semibold order-first"
          disabled={blocked || !canReview(currentStatus)}
          onClick={() => decidir("aceitar")}
        >
          {busy === "aceitar" ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Aprovar post
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 px-3 text-sm"
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
              ? "Aprovado / rascunho — não publicado"
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
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy || busy === "visualizar") setOpen(value);
        }}
      >
        <DialogContent
          className="max-w-3xl w-[calc(100%-1rem)] max-h-[90dvh] overflow-y-auto p-4 sm:p-6"
          onKeyDown={(event) => {
            if (editing || event.target instanceof HTMLTextAreaElement || images.length < 2) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setSlide(
                (i) => (i + (event.key === "ArrowRight" ? 1 : -1) + images.length) % images.length,
              );
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Visualizar post completo</DialogTitle>
            <DialogDescription>
              {!post && (loadError ? "Erro ao carregar" : "Carregando dados reais do post…")}
              {post && `${post.tipo_post} · ${post.formato_midia}`}
              {post && ` · ${platforms.map((p) => (p === "instagram" ? "Instagram" : "LinkedIn")).join(" / ") || "Plataforma não definida"}`}
              {post && ` · ${formatPreviewDate(post.data_agendamento)}`}
            </DialogDescription>
          </DialogHeader>
          <div
            className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-border bg-background pb-3"
            aria-label="Ações da prévia"
          >
            <Button
              variant="outline"
              disabled={blocked || editing || !canEditPreview(currentStatus)}
              onClick={() => {
                if (!post) return;
                setDraft({
                  legenda: post.legenda || "",
                  legenda_instagram: post.legenda_instagram ?? post.legenda ?? "",
                  legenda_linkedin: post.legenda_linkedin ?? post.legenda ?? "",
                });
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button
              disabled={blocked || editing || !canReview(currentStatus)}
              onClick={() => decidir("aceitar")}
            >
              {busy === "aceitar" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Aprovar post
            </Button>
            <Button
              variant="outline"
              disabled={blocked || editing || !canReview(currentStatus)}
              onClick={() => setConfirm(true)}
            >
              <X className="h-4 w-4" />
              Negar
            </Button>
            <span className="w-full text-xs text-muted-foreground" role="status">
              {currentStatus === "PendenteAprovacao"
                ? "Aguardando aprovação"
                : currentStatus === "Rascunho"
                  ? "Aprovado / rascunho — não publicado"
                  : currentStatus === "Arquivado"
                    ? "Negado / arquivado"
                    : currentStatus}
            </span>
          </div>
          {editing && (
            <section className="space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Texto original / textos dos slides</span>
                <Textarea
                  rows={8}
                  value={draft.legenda}
                  onChange={(e) => setDraft((d) => ({ ...d, legenda: e.target.value }))}
                />
              </label>
              {platforms.map((p) => (
                <label key={p} className="block space-y-1">
                  <span className="text-sm font-semibold">
                    Legenda {p === "instagram" ? "Instagram" : "LinkedIn"} e hashtags
                  </span>
                  <Textarea
                    rows={6}
                    value={draft[p === "instagram" ? "legenda_instagram" : "legenda_linkedin"]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [p === "instagram" ? "legenda_instagram" : "legenda_linkedin"]:
                          e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button disabled={blocked} onClick={salvarEdicao}>
                  <Save className="h-4 w-4" />
                  Salvar textos
                </Button>
                <Button variant="outline" disabled={blocked} onClick={() => setEditing(false)}>
                  Cancelar edição
                </Button>
              </div>
            </section>
          )}
          <div className="space-y-4">
            {platforms.length > 1 && (
              <div className="flex gap-2" aria-label="Plataforma da prévia">
                {platforms.map((p) => (
                  <Button
                    key={p}
                    variant={platform === p ? "default" : "outline"}
                    aria-pressed={platform === p}
                    onClick={() => setPlatform(p)}
                  >
                    {p === "instagram" ? "Instagram" : "LinkedIn"}
                  </Button>
                ))}
              </div>
            )}
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
            {post?.tipo_post === "Carrossel" && (
              <section aria-live="polite">
                <h3 className="font-semibold">Texto do slide {slide + 1}</h3>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {slideText || "Texto deste slide não está identificado na legenda salva."}
                </p>
              </section>
            )}
            <section>
              <h3 className="font-semibold">
                Legenda e hashtags
                {platform ? ` — ${platform === "instagram" ? "Instagram" : "LinkedIn"}` : ""}
              </h3>
              <p className="text-sm whitespace-pre-wrap break-words">
                {caption || "Sem legenda disponível."}
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
