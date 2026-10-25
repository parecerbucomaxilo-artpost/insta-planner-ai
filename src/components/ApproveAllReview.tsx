import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { signPostMediaStrict } from "@/lib/storage-url";
import type { PostRow } from "@/lib/posts-types";
import {
  formatPreviewDate,
  loadPostPreview,
  previewCaption,
  previewPlatforms,
  savedSlideText,
  type PreviewData,
} from "@/lib/post-preview";
import {
  duplicadosNoLote,
  marcarVisto,
  podeAprovar,
  problemasPrevia,
  POST_REVIEW_CHANGED,
  PROBLEMA_LABEL,
  type ProblemaPrevia,
} from "@/lib/post-review";

type Item = { id: string; data?: PreviewData; erro?: string };

/**
 * "Aprovar tudo" com revisão obrigatória: cada post/slot aparece individualmente com a
 * prévia real; a confirmação final só habilita depois que todos foram vistos. Duplicados
 * ficam bloqueados; mídia/texto inválido só passa com "ignorar" explícito por post.
 */
export function ApproveAllReview({
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [slide, setSlide] = useState(0);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setItems(ids.map((id) => ({ id })));
    setIdx(0);
    setSlide(0);
    setVistos(new Set());
    setIgnorados(new Set());
    (async () => {
      for (const id of ids) {
        try {
          const data = await loadPostPreview(id, {
            fetchPost: async (postId) => {
              const { data, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
              return { data: data as unknown as PostRow | null, error };
            },
            signOne: signPostMediaStrict,
          });
          if (vivo) setItems((xs) => xs.map((x) => (x.id === id ? { id, data } : x)));
        } catch (e) {
          if (vivo) setItems((xs) => xs.map((x) => (x.id === id ? { id, erro: e instanceof Error ? e.message : "Falha ao carregar" } : x)));
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [open, ids]);

  const dups = useMemo(() => {
    const carregados = items.map((i) => i.data?.post);
    const idxs = duplicadosNoLote(carregados.map((p) => p ?? { legenda: "" }));
    return new Set(idxs.filter((i) => carregados[i]).map((i) => items[i].id));
  }, [items]);

  const problemasDe = (it: Item): ProblemaPrevia[] => {
    if (!it.data) return [];
    const p = problemasPrevia(it.data);
    return dups.has(it.id) ? [...p, "duplicado"] : p;
  };

  const atual = items[idx];
  useEffect(() => {
    setSlide(0);
    if (atual?.data && !vistos.has(atual.id)) {
      marcarVisto(atual.id);
      setVistos((s) => new Set(s).add(atual.id));
    }
  }, [atual?.id, atual?.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const aprovaveis = items.filter(
    (it) => it.data && podeAprovar({ visto: vistos.has(it.id), problemas: problemasDe(it), ignorado: ignorados.has(it.id) }),
  );
  const todosVistos = items.length > 0 && items.every((it) => vistos.has(it.id) || it.erro);
  const bloqueados = items.length - aprovaveis.length;

  const confirmar = async () => {
    if (!todosVistos || saving) return;
    setSaving(true);
    let ok = 0;
    for (const it of aprovaveis) {
      // Mesmo guarda do card: só sai de PendenteAprovacao; aprovar = Rascunho (não publica).
      const { data, error } = await supabase
        .from("posts")
        .update({ status: "Rascunho" })
        .eq("id", it.id)
        .eq("status", "PendenteAprovacao")
        .select("id")
        .maybeSingle();
      if (!error && data) {
        ok++;
        window.dispatchEvent(new CustomEvent(POST_REVIEW_CHANGED, { detail: { id: it.id, status: "Rascunho" } }));
      }
    }
    setSaving(false);
    toast.success(`${ok} post(s) aprovados como rascunho. Nada foi publicado.${bloqueados ? ` ${bloqueados} ficaram pendentes (bloqueados).` : ""}`);
    onOpenChange(false);
    onDone?.();
  };

  const d = atual?.data;
  const post = d?.post;
  const probs = atual ? problemasDe(atual) : [];
  const img = d?.media[slide] ?? null;
  const plat = post ? previewPlatforms(post)[0] ?? null : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-4xl w-[calc(100%-1rem)] max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Revisar antes de aprovar tudo</DialogTitle>
          <DialogDescription>
            Confira cada post individualmente. A confirmação final só libera depois de ver todos ({vistos.size}/{items.length} vistos).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1" aria-label="Posts do lote">
          {items.map((it, i) => {
            const pr = problemasDe(it);
            return (
              <Button
                key={it.id}
                size="sm"
                variant={i === idx ? "default" : "outline"}
                className="min-h-9 px-2 text-xs"
                onClick={() => setIdx(i)}
                aria-label={`Post ${i + 1}${pr.length ? " com problema" : ""}${vistos.has(it.id) ? ", visto" : ""}`}
              >
                {i + 1}
                {pr.length > 0 && <AlertTriangle className="ml-1 h-3 w-3 text-destructive" />}
                {vistos.has(it.id) && pr.length === 0 && <Check className="ml-1 h-3 w-3" />}
              </Button>
            );
          })}
        </div>

        {atual && !d && !atual.erro && (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando dados reais do post…</p>
        )}
        {atual?.erro && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">Não foi possível carregar este post: {atual.erro}. Ele não será aprovado.</p>}

        {post && d && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {img ? (
                  <img src={img} alt={`Slide ${slide + 1}`} className="h-full w-full object-contain" />
                ) : (
                  <p className="flex flex-col items-center gap-2 p-4 text-center text-sm text-destructive">
                    <ImageOff className="h-6 w-6" />
                    {d.mediaFalhas.includes(slide) ? "Imagem salva não carregou" : "Slide sem imagem salva"}
                  </p>
                )}
              </div>
              {d.media.length > 1 && (
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="outline" onClick={() => setSlide((s) => (s - 1 + d.media.length) % d.media.length)} aria-label="Slide anterior"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs">Slide {slide + 1} de {d.media.length}</span>
                  <Button size="sm" variant="outline" onClick={() => setSlide((s) => (s + 1) % d.media.length)} aria-label="Próximo slide"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
              {d.media.length > 1 && (
                <p className="rounded-md bg-muted p-2 text-xs"><strong>Texto do slide {slide + 1}:</strong> {savedSlideText(post.legenda, slide) ?? "sem texto próprio identificado"}</p>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {post.tipo_post} · {post.formato_midia} · {previewPlatforms(post).map((p) => (p === "instagram" ? "Instagram" : "LinkedIn")).join(" / ") || "Plataforma não definida"} · {formatPreviewDate(post.data_agendamento)}
              </p>
              {probs.length > 0 && (
                <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs">
                  <ul className="list-disc pl-4">{probs.map((p) => <li key={p}>{PROBLEMA_LABEL[p]}</li>)}</ul>
                  {probs.includes("duplicado") ? (
                    <p className="mt-1 font-semibold text-destructive">Duplicado: não será aprovado. Negue-o no card.</p>
                  ) : (
                    <label className="mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ignorados.has(atual.id)}
                        onChange={(e) => setIgnorados((s) => { const n = new Set(s); if (e.target.checked) n.add(atual.id); else n.delete(atual.id); return n; })}
                      />
                      Ignorar e aprovar este post mesmo assim
                    </label>
                  )}
                </div>
              )}
              <pre className="max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border p-2 font-sans text-sm">{previewCaption(post, plat) || "(sem legenda)"}</pre>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background pt-3">
          <div className="flex gap-2">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Anterior</Button>
            <Button variant="outline" disabled={idx >= items.length - 1} onClick={() => setIdx((i) => i + 1)}>Próximo</Button>
          </div>
          <Button disabled={!todosVistos || saving || aprovaveis.length === 0} onClick={confirmar}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
            {todosVistos ? `Confirmar aprovação de ${aprovaveis.length}` : `Veja todos para liberar (${vistos.size}/${items.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
