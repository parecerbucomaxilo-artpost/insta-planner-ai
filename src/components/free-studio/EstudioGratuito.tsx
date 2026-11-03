import { ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TextStudio } from "./TextStudio";
import { ImageStudio } from "./ImageStudio";
import { GeradorLocal } from "./GeradorLocal";
import { EscolhaTema } from "./EscolhaTema";
import { IAAvancada } from "@/components/advanced-ai/IAAvancada";

import { useModoGeracao } from "@/components/GenerationMode";
import { useEffect, useState } from "react";
import { PERFIS, PERFIS_IDS, PERFIL_STORAGE, lerPerfilSalvo, type PerfilId } from "@/lib/studio-profiles";

/** Dois modos separados: ferramentas locais (sem IA) e IA Avançada (gateway real, pode consumir créditos). */
export function EstudioGratuito() {
  const [modo, trocar] = useModoGeracao();
  const [perfil, setPerfil] = useState<PerfilId>("chico");
  useEffect(() => { setPerfil(lerPerfilSalvo(localStorage.getItem(PERFIL_STORAGE))); }, []);
  const [tema, setTema] = useState("");
  const escolher = (p: PerfilId) => { setPerfil(p); setTema(""); localStorage.setItem(PERFIL_STORAGE, p); };
  const P = PERFIS[perfil];

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Estúdio</h2>
        <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Modo do estúdio">
          <Button role="radio" aria-checked={modo === "gratuito"} variant={modo === "gratuito" ? "default" : "outline"} onClick={() => trocar("gratuito")}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Gratuito — sem créditos de IA
          </Button>
          <Button role="radio" aria-checked={modo === "ia"} variant={modo === "ia" ? "default" : "outline"} onClick={() => trocar("ia")}>
            <Sparkles className="mr-1.5 h-4 w-4" /> IA Avançada — pode consumir créditos Lovable AI
          </Button>
        </div>
        <p className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
          {modo === "gratuito"
            ? <><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Modo ativo: Gratuito. Tudo funciona no seu navegador com modelos e regras fixas — não é inteligência artificial e não usa créditos. Imagens não saem do seu aparelho. Nada é publicado ou salvo no Planner.</>
            : <><Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Modo ativo: IA Avançada. Usa os modelos de IA reais já conectados ao Planner. Cada geração pede confirmação e pode consumir créditos. Nada é publicado ou salvo automaticamente.</>}
        </p>
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium" id="estudio-perfil">Perfil</p>
        <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-labelledby="estudio-perfil">
          {PERFIS_IDS.map((id) => (
            <Button key={id} role="radio" aria-checked={perfil === id} variant={perfil === id ? "default" : "outline"} onClick={() => escolher(id)}>{PERFIS[id].nome}</Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Público: {P.publico}. Texto, imagens, cores, {P.logo !== "nenhuma" && "logo oficial, "}chamada e assinatura seguem este perfil.</p>
        {P.faltando.length > 0 && <p className="text-xs text-muted-foreground">Ainda não configurado neste perfil: {P.faltando.join(", ")}. Esses itens ficam em branco até serem informados.</p>}
      </div>
      <EscolhaTema key={perfil} perfil={perfil} modo={modo} aprovado={tema} onAprovar={setTema} />
      {modo === "gratuito" ? (
        <>
          <GeradorLocal perfil={perfil} tema={tema} />
          <Tabs defaultValue="texto">
            <TabsList>
              <TabsTrigger value="texto">Texto</TabsTrigger>
              <TabsTrigger value="imagem">Imagem</TabsTrigger>
            </TabsList>
            <TabsContent value="texto" className="mt-4"><TextStudio perfil={perfil} tema={tema} /></TabsContent>
            <TabsContent value="imagem" className="mt-4"><ImageStudio perfil={perfil} /></TabsContent>
          </Tabs>
        </>
      ) : <IAAvancada perfil={perfil} tema={tema} />}
    </section>
  );
}
