import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Perfil } from "@/components/ProfileSettings";
import type { Network } from "@/lib/posts-types";

type Props = {
  estilo: "Padrão";
  legenda: string;
  imagem: string | null;
  carrossel: string[];
  tipo: "Post Único" | "Carrossel";
  perfil?: Perfil | null;
  network?: Network;
  loading?: boolean;
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
  // instagram (default)
  const h = perfil.instagram_arroba || perfil.arroba_usuario || "meu_perfil";
  return {
    nome: perfil.nome_profissional || h,
    handle: h,
    foto: perfil.instagram_foto_url ?? perfil.url_logo ?? null,
  };
}

export function PostPreview({ legenda, imagem, carrossel, tipo, perfil, network, loading }: Props) {
  const identity = identityFor(network, perfil);
  return <InstagramPreview legenda={legenda} imagem={imagem} carrossel={carrossel} tipo={tipo} identity={identity} loading={loading} />;
}

function InstagramPreview({
  legenda, imagem, carrossel, tipo, identity, loading,
}: {
  legenda: string; imagem: string | null; carrossel: string[]; tipo: "Post Único" | "Carrossel"; identity: Identity; loading?: boolean;
}) {
  const images = tipo === "Carrossel" ? carrossel : imagem ? [imagem] : [];
  const initial = (identity.handle || "M").trim().charAt(0).toUpperCase() || "M";
  return (
    <Card className="overflow-hidden max-w-sm mx-auto card-elevated animate-in fade-in duration-300">
      <div className="flex items-center gap-3 p-3.5">
        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[var(--instagram-from)] via-[var(--instagram-via)] to-[var(--instagram-to)] p-[2px]">
          <div className="h-full w-full rounded-full bg-card flex items-center justify-center overflow-hidden text-xs font-bold">
            {identity.foto ? <img src={identity.foto} alt="" className="h-full w-full object-cover" /> : initial}
          </div>
        </div>
        <div className="flex-1 text-sm font-semibold">{identity.handle}</div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="relative aspect-square bg-muted">
        {loading && !images[0] ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : images[0] ? (
          <img src={images[0]} alt="" className="w-full h-full object-cover animate-in fade-in duration-500" />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
        )}
        {tipo === "Carrossel" && images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">1/{images.length}</div>
        )}
      </div>
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-4">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="h-6 w-6 ml-auto" />
        </div>
        {loading && !legenda ? (
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : legenda ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            <span className="font-semibold mr-1.5">{identity.handle}</span>
            {legenda}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

