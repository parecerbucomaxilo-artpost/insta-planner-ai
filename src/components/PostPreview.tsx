import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Perfil } from "@/components/ProfileSettings";
import type { Network } from "@/lib/posts-types";

type Props = {
  estilo: "Padrão" | "Estilo X";
  legenda: string;
  imagem: string | null;
  carrossel: string[];
  tipo: "Post Único" | "Carrossel";
  perfil?: Perfil | null;
  network?: Network;
};

type Identity = { nome: string; handle: string; foto: string | null };

function identityFor(network: Network | undefined, perfil?: Perfil | null): Identity {
  if (!perfil) return { nome: "Meu Perfil", handle: "meu_perfil", foto: null };
  if (network === "linkedin") {
    return {
      nome: perfil.linkedin_nome || perfil.nome_profissional || "Meu Perfil",
      handle: perfil.linkedin_nome || perfil.nome_profissional || "meu_perfil",
      foto: perfil.linkedin_foto_url ?? perfil.url_logo ?? null,
    };
  }
  if (network === "x") {
    const h = perfil.x_arroba || perfil.arroba_usuario || "meu_perfil";
    return {
      nome: perfil.linkedin_nome || perfil.nome_profissional || h,
      handle: h,
      // X SEMPRE usa a foto pessoal do X — nunca a logo corporativa.
      foto: perfil.x_foto_url ?? null,
    };
  }
  // instagram (default)
  const h = perfil.instagram_arroba || perfil.arroba_usuario || "meu_perfil";
  return {
    nome: perfil.nome_profissional || h,
    handle: h,
    foto: perfil.instagram_foto_url ?? perfil.url_logo ?? null,
  };
}

export function PostPreview({ estilo, legenda, imagem, carrossel, tipo, perfil, network }: Props) {
  const identity = identityFor(network, perfil);
  if (estilo === "Estilo X")
    return <TweetPreview legenda={legenda} imagem={imagem} carrossel={carrossel} identity={identityFor("x", perfil)} />;
  return <InstagramPreview legenda={legenda} imagem={imagem} carrossel={carrossel} tipo={tipo} identity={identity} />;
}

function InstagramPreview({
  legenda, imagem, carrossel, tipo, identity,
}: {
  legenda: string; imagem: string | null; carrossel: string[]; tipo: "Post Único" | "Carrossel"; identity: Identity;
}) {
  const images = tipo === "Carrossel" ? carrossel : imagem ? [imagem] : [];
  const initial = (identity.handle || "M").trim().charAt(0).toUpperCase() || "M";
  return (
    <Card className="overflow-hidden max-w-sm mx-auto">
      <div className="flex items-center gap-3 p-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[var(--instagram-from)] via-[var(--instagram-via)] to-[var(--instagram-to)] p-[2px]">
          <div className="h-full w-full rounded-full bg-card flex items-center justify-center overflow-hidden text-xs font-bold">
            {identity.foto ? <img src={identity.foto} alt="" className="h-full w-full object-cover" /> : initial}
          </div>
        </div>
        <div className="flex-1 text-sm font-semibold">{identity.handle}</div>
        <MoreHorizontal className="h-5 w-5" />
      </div>
      <div className="relative aspect-square bg-muted">
        {images[0] ? (
          <img src={images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
        )}
        {tipo === "Carrossel" && images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">1/{images.length}</div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="h-6 w-6 ml-auto" />
        </div>
        {legenda && (
          <p className="text-sm whitespace-pre-wrap">
            <span className="font-semibold mr-1.5">{identity.handle}</span>
            {legenda}
          </p>
        )}
      </div>
    </Card>
  );
}

function TweetPreview({
  legenda, imagem, carrossel, identity,
}: {
  legenda: string; imagem: string | null; carrossel: string[]; identity: Identity;
}) {
  const images = carrossel.length ? carrossel : imagem ? [imagem] : [];
  const initial = identity.nome.trim().charAt(0).toUpperCase() || "M";
  return (
    <Card className="p-4 max-w-md mx-auto bg-card">
      <div className="flex gap-3">
        <div className="h-11 w-11 rounded-full bg-foreground flex-shrink-0 flex items-center justify-center text-background font-bold overflow-hidden">
          {identity.foto ? <img src={identity.foto} alt="" className="h-full w-full object-cover" /> : initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-bold">{identity.nome}</span>
            <BadgeCheck className="h-4 w-4 text-[oklch(0.6_0.18_250)]" />
            <span className="text-muted-foreground">@{identity.handle} · agora</span>
          </div>
          <p className="text-[15px] leading-snug mt-1 whitespace-pre-wrap">
            {legenda || <span className="text-muted-foreground">Sua legenda aparecerá aqui...</span>}
          </p>
          {images.length > 0 && (
            <div className={`mt-3 rounded-2xl overflow-hidden border grid gap-0.5 ${images.length === 1 ? "" : "grid-cols-2"}`}>
              {images.slice(0, 4).map((src, i) => (
                <img key={i} src={src} alt="" className={`w-full object-cover ${images.length === 1 ? "max-h-96" : "aspect-square"}`} />
              ))}
            </div>
          )}
          <div className="flex justify-between mt-3 max-w-xs text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> 0</span>
            <span className="flex items-center gap-1.5">↻ 0</span>
            <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> 0</span>
            <span className="flex items-center gap-1.5"><Send className="h-4 w-4" /></span>
          </div>
        </div>
      </div>
    </Card>
  );
}
