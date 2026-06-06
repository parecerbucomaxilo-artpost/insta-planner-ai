import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Flame, TrendingUp, Film, Image as ImgIcon, FileText, CheckCircle2 } from "lucide-react";
import type { PostRow } from "@/lib/posts-types";

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Eye; label: string; value: string | number; accent?: string }) {
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

export function InsightsPanel({ posts }: { posts: PostRow[] }) {
  const totalViews = useMemo(() => posts.reduce((s, p) => s + (p.visualizacoes ?? 0), 0), [posts]);
  const publicados = posts.filter((p) => p.status === "Publicado").length;
  const reels = posts.filter((p) => p.formato_midia === "Vídeo/Reels").length;
  const viral = posts.filter((p) => (p.visualizacoes ?? 0) >= 500).length;
  const avgViews = posts.length ? Math.round(totalViews / posts.length) : 0;

  const ranked = useMemo(
    () => [...posts].sort((a, b) => (b.visualizacoes ?? 0) - (a.visualizacoes ?? 0)).slice(0, 10),
    [posts],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Insights de Performance
        </h2>
        <p className="text-sm text-muted-foreground">Acompanhe visualizações e descubra quais posts viralizaram.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Visualizações totais" value={totalViews.toLocaleString("pt-BR")} />
        <StatCard icon={FileText} label="Média por post" value={avgViews.toLocaleString("pt-BR")} />
        <StatCard icon={CheckCircle2} label="Publicados" value={publicados} accent="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={Film} label="Reels / Vídeos" value={reels} accent="bg-violet-500/10 text-violet-600" />
      </div>

      {viral > 0 && (
        <Card className="p-4 border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <Flame className="h-6 w-6 text-amber-500" />
            <div>
              <p className="font-semibold text-sm">{viral} post{viral > 1 ? "s" : ""} viralizando!</p>
              <p className="text-xs text-muted-foreground">Atingiram 500+ visualizações.</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Mais visualizados
        </h3>
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados ainda — crie e publique posts para começar a medir.</p>
        ) : (
          <ul className="space-y-2">
            {ranked.map((p, i) => {
              const thumb = p.url_imagem ?? p.imagens_carrossel?.[0] ?? null;
              const isVideo = p.formato_midia === "Vídeo/Reels";
              const isViral = (p.visualizacoes ?? 0) >= 500;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isViral ? "border-amber-500/50 bg-amber-500/5" : "hover:bg-accent/40"
                  }`}
                >
                  <span className="text-xs font-bold w-5 text-center text-muted-foreground">{i + 1}</span>
                  <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {thumb ? (
                      isVideo ? (
                        <Film className="h-5 w-5 text-violet-500" />
                      ) : (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      )
                    ) : (
                      <ImgIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{p.tipo_post}</Badge>
                      {isVideo && (
                        <Badge className="text-[10px] bg-violet-500 hover:bg-violet-500 text-white">
                          <Film className="h-3 w-3 mr-0.5" /> Reels
                        </Badge>
                      )}
                      {isViral && (
                        <Badge className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 animate-pulse">
                          🔥 500+ Views!
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm line-clamp-1 mt-0.5">
                      {p.legenda || <span className="text-muted-foreground">(sem legenda)</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold leading-none">
                      {(p.visualizacoes ?? 0).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">views</p>
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
