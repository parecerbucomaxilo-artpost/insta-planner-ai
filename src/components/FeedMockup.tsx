import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, Share, Twitter } from "lucide-react";
import type { Perfil } from "@/components/ProfileSettings";
import { signPostMediaUrls } from "@/lib/storage-url";

type Mode = "instagram" | "x";

type Props = {
  mode: Mode;
  imagem: string | null;
  texto: string;
  perfil: Perfil | null;
  loading?: boolean;
};

/** Frame de smartphone (mockup). */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="relative rounded-[2.4rem] border border-slate-300 bg-slate-100 p-2 shadow-elevated">
        <div className="rounded-[1.9rem] bg-card overflow-hidden border border-slate-200/70">
          <div className="relative h-6 flex items-center justify-center">
            <div className="absolute top-1 left-1/2 -translate-x-1/2 h-1.5 w-16 rounded-full bg-slate-300" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FeedMockup({ mode, imagem, texto, perfil, loading }: Props) {
  const [recentImgs, setRecentImgs] = useState<string[]>([]);
  const [isPublishedReal, setIsPublishedReal] = useState(false);

  useEffect(() => {
    if (mode !== "instagram") return;
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, url_imagem, imagens_carrossel, url_imagem_cache, url_imagem_cache_expires_at, imagens_carrossel_cache, imagens_carrossel_cache_expires_at, status")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data) return;
      
      if (data.length > 0 && data[0].status === "Publicado") {
        setIsPublishedReal(true);
      } else {
        setIsPublishedReal(false);
      }

      const imgs: string[] = [];
      for (const row of await Promise.all(data.map((post) => signPostMediaUrls(post)))) {
        const r = row as { url_imagem: string | null; imagens_carrossel: unknown };
        if (r.url_imagem) imgs.push(r.url_imagem);
        if (Array.isArray(r.imagens_carrossel)) {
          for (const x of r.imagens_carrossel) if (typeof x === "string") imgs.push(x);
        }
        if (imgs.length >= 9) break;
      }
      setRecentImgs(imgs.slice(0, 8));
    };

    fetchPosts();
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, [mode, imagem]);

  if (mode === "instagram") {
    const cells: (string | null)[] = [imagem, ...recentImgs];
    while (cells.length < 9) cells.push(null);
    return (
      <PhoneFrame>
        {/* IG header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <div className="h-9 w-9 rounded-full ring-2 ring-pink-500 p-0.5">
            <div className="h-full w-full rounded-full overflow-hidden bg-muted">
              {perfil?.instagram_foto_url || perfil?.url_logo ? (
                <img src={perfil.instagram_foto_url ?? perfil.url_logo ?? ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-pink-500 to-orange-400" />
              )}
            </div>
          </div>
          <div className="text-sm font-semibold">
            {perfil?.instagram_arroba ? `@${perfil.instagram_arroba.replace(/^@+/, "")}` : "@seu_perfil"}
          </div>
          <div className="ml-auto flex gap-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span className="border-b-2 border-foreground pb-1.5">Posts</span>
            <span className="pb-1.5">Reels</span>
            <span className="pb-1.5">Tags</span>
          </div>
        </div>

        {/* Grid 3x3 */}
        <div className="grid grid-cols-3 gap-px bg-border">
          {cells.slice(0, 9).map((src, i) => (
            <div key={i} className={cn("aspect-square bg-muted relative", i === 0 && "ring-2 ring-primary ring-inset z-10")}>
              {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
              )}
              {i === 0 && (
                <span className={cn(
                  "absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold",
                  isPublishedReal ? "bg-emerald-500 text-white" : "bg-amber-500 text-white shadow-sm"
                )}>
                  {isPublishedReal ? "feed" : "rascunho"}
                </span>
              )}
              {i === 0 && loading && (
                <div className="absolute inset-0 bg-card/60 backdrop-blur-[2px] animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </PhoneFrame>
    );
  }

  // X (Twitter) timeline
  const handle = perfil?.arroba_usuario
    ? `@${perfil.arroba_usuario.replace(/^@+/, "")}`
    : "@dr_ctbmf";
  const nome = perfil?.nome_profissional || perfil?.linkedin_nome || "Seu Perfil";

  const ghosts = [
    { nome: "CTBMF Brasil", handle: "@ctbmf_br", texto: "Novo consenso sobre manejo de fraturas mandibulares publicado este mês. Vale a leitura para o plantão." },
    { nome: "Hospitalar Today", handle: "@hospitalar", texto: "Anestesia geral em pacientes sistêmicos: checklist atualizado pela SBA disponível no portal." },
  ];

  return (
    <PhoneFrame>
      <div className="bg-card">
        <div className="flex items-center gap-3 px-3 py-2.5 border-b">
          <Twitter className="h-4 w-4" />
          <span className="text-sm font-semibold">Para você</span>
        </div>

        {/* Tweet ativo */}
        <article className="px-3 py-3 border-b border-border ring-2 ring-primary/40 ring-inset">
          <div className="flex gap-2.5">
            <div className="h-9 w-9 rounded-full overflow-hidden flex-shrink-0 bg-slate-300">
              {perfil?.instagram_foto_url || perfil?.url_logo ? (
                <img src={perfil.instagram_foto_url ?? perfil.url_logo ?? ""} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[13px]">
                <span className="font-bold truncate">{nome}</span>
                <span className="text-muted-foreground truncate">{handle} · agora</span>
              </div>
              <p className="text-[13px] whitespace-pre-wrap leading-snug mt-0.5 min-h-[40px]">
                {texto || (loading ? "Gerando…" : "Seu tweet aparecerá aqui.")}
              </p>
              {imagem && (
                <div className="mt-2 rounded-2xl overflow-hidden border">
                  <img src={imagem} alt="" className="w-full aspect-video object-cover" />
                </div>
              )}
              <div className="flex items-center gap-6 mt-2 text-muted-foreground text-[11px]">
                <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 12</span>
                <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> 24</span>
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> 184</span>
                <span className="flex items-center gap-1 ml-auto"><Share className="h-3.5 w-3.5" /></span>
              </div>
            </div>
          </div>
        </article>

        {ghosts.map((g, i) => (
          <article key={i} className="px-3 py-3 border-b border-border opacity-60">
            <div className="flex gap-2.5">
              <div className="h-9 w-9 rounded-full bg-slate-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[13px]">
                  <span className="font-bold truncate">{g.nome}</span>
                  <span className="text-muted-foreground truncate">{g.handle} · 2h</span>
                </div>
                <p className="text-[13px] leading-snug mt-0.5">{g.texto}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </PhoneFrame>
  );
}
