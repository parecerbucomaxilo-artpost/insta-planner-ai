import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Film, Image as ImgIcon, FileText, CheckCircle2, Clock, AlertCircle, Instagram, Linkedin } from "lucide-react";
import type { PostRow } from "@/lib/posts-types";

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof CheckCircle2; label: string; value: string | number; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}

const fmtData = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

export function InsightsPanel({ posts }: { posts: PostRow[] }) {
  const publicados = useMemo(() => posts.filter((p) => p.status === "Publicado"), [posts]);
  const agendados = useMemo(() => posts.filter((p) => p.status === "Agendado"), [posts]);
  const rascunhos = useMemo(() => posts.filter((p) => p.status === "Rascunho" || p.status === "PendenteAprovacao"), [posts]);
  const erros = useMemo(() => posts.filter((p) => p.status === "Erro").length, [posts]);
  const reels = useMemo(() => publicados.filter((p) => p.formato_midia === "Vídeo/Reels").length, [publicados]);
  const carrosseis = useMemo(() => publicados.filter((p) => p.tipo_post === "Carrossel").length, [publicados]);

  const porConta = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of publicados) {
      const k = (p as any).instagram_conta || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [publicados]);

  const recentes = useMemo(
    () => [...publicados].sort((a, b) => {
      const da = new Date((a as any).data_publicacao || a.created_at || 0).getTime();
      const db = new Date((b as any).data_publicacao || b.created_at || 0).getTime();
      return db - da;
    }).slice(0, 20),
    [publicados],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Desempenho
        </h2>
        <p className="text-sm text-muted-foreground">Visão geral das publicações registradas no Planner.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} label="Publicados" value={publicados.length} accent="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={Clock} label="Agendados" value={agendados.length} accent="bg-blue-500/10 text-blue-600" />
        <StatCard icon={FileText} label="Rascunhos / Pendentes" value={rascunhos.length} accent="bg-amber-500/10 text-amber-600" />
        <StatCard icon={AlertCircle} label="Com erro" value={erros} accent="bg-red-500/10 text-red-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ImgIcon} label="Carrosséis publicados" value={carrosseis} />
        <StatCard icon={Film} label="Reels / Vídeos" value={reels} accent="bg-violet-500/10 text-violet-600" />
        <StatCard icon={Instagram} label="Contas ativas" value={porConta.length} accent="bg-pink-500/10 text-pink-600" />
        <StatCard icon={Linkedin} label="Total no banco" value={posts.length} />
      </div>

      {porConta.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Instagram className="h-4 w-4" /> Publicações por conta
          </h3>
          <ul className="space-y-2">
            {porConta.map(([conta, n]) => (
              <li key={conta} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">@{conta}</span>
                <Badge variant="secondary">{n}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Últimas publicações ({publicados.length} no total)
        </h3>
        {recentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma publicação registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {recentes.map((p) => {
              const thumb = p.url_imagem ?? p.imagens_carrossel?.[0] ?? null;
              const isVideo = p.formato_midia === "Vídeo/Reels";
              return (
                <li key={p.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/40 transition-colors">
                  <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {thumb ? (
                      isVideo ? <Film className="h-5 w-5 text-violet-500" /> : <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImgIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{p.tipo_post}</Badge>
                      {(p as any).instagram_conta && (
                        <Badge variant="secondary" className="text-[10px]">@{(p as any).instagram_conta}</Badge>
                      )}
                    </div>
                    <p className="text-sm line-clamp-1 mt-0.5">
                      {p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{fmtData((p as any).data_publicacao || p.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
