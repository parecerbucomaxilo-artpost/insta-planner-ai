import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar as CalIcon, Image as ImgIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PostRow } from "@/lib/posts-types";

const statusColor: Record<string, string> = {
  Rascunho: "bg-[var(--status-draft)]",
  Agendado: "bg-[var(--status-scheduled)]",
  Publicado: "bg-[var(--status-published)]",
  Erro: "bg-[var(--status-error)]",
};

export function PostsList({ posts, onChange }: { posts: PostRow[]; onChange: () => void }) {
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Post excluído"); onChange(); }
  };

  if (posts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ImgIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Nenhum post ainda. Crie o primeiro!</p>
      </Card>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((p) => {
        const thumb = p.url_imagem ?? p.imagens_carrossel?.[0] ?? null;
        return (
          <Card key={p.id} className="overflow-hidden flex flex-col">
            <div className="aspect-square bg-muted relative">
              {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : (
                <div className="h-full flex items-center justify-center text-muted-foreground"><ImgIcon className="h-8 w-8" /></div>
              )}
              <Badge className={`absolute top-2 left-2 text-white ${statusColor[p.status]}`}>{p.status}</Badge>
              {p.tipo_post === "Carrossel" && (
                <Badge variant="secondary" className="absolute top-2 right-2">{p.imagens_carrossel?.length ?? 0} imgs</Badge>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col gap-2">
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{p.tipo_post}</Badge>
                <Badge variant="outline" className="text-xs">{p.estilo_layout}</Badge>
              </div>
              <p className="text-sm line-clamp-3 flex-1">{p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}</p>
              {p.data_agendamento && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalIcon className="h-3 w-3" /> {format(new Date(p.data_agendamento), "Pp", { locale: ptBR })}
                </p>
              )}
              <Button variant="ghost" size="sm" className="self-end text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
