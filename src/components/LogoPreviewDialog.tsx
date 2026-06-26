import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { previewPostWithLogo } from "@/lib/preview-overlay.functions";

export function LogoPreviewDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const preview = useServerFn(previewPostWithLogo);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [account, setAccount] = useState<string>("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open || !postId) return;
    setImages([]);
    setIdx(0);
    setLoading(true);
    preview({ data: { id: postId } })
      .then((r) => {
        setImages(r.images || []);
        setAccount(r.account || "");
      })
      .catch((e: any) => {
        toast.error(e?.message || "Falha ao gerar pré-visualização.");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, postId]);

  const total = images.length;
  const safeIdx = Math.min(idx, Math.max(0, total - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Pré-visualização com logo
          </DialogTitle>
          <DialogDescription>
            {account
              ? <>Conta: <span className="font-medium">@{account}</span> — confira como a publicação sairá com a logo aplicada.</>
              : "Confira como a publicação sairá com a logo aplicada."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Aplicando logo…</span>
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">Sem imagem disponível.</span>
            </div>
          ) : (
            <>
              <img src={images[safeIdx]} alt={`Slide ${safeIdx + 1}`} className="w-full h-full object-cover" />
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIdx((i) => (i - 1 + total) % total)}
                    aria-label="Anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdx((i) => (i + 1) % total)}
                    aria-label="Próximo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
                    {safeIdx + 1} / {total}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
