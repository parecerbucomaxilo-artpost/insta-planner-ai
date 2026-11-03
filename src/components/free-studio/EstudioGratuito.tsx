import { ShieldCheck, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TextStudio } from "./TextStudio";
import { ImageStudio } from "./ImageStudio";
import { GeradorLocal } from "./GeradorLocal";
import { EscolhaTema } from "./EscolhaTema";
import { IAAvancada } from "@/components/advanced-ai/IAAvancada";

import { useModoGeracao } from "@/components/GenerationMode";
import { useEffect, useState } from "react";
import { StudioMaterial, useStudioMaterial } from "./StudioMaterial";
import { useUsuarioAtual, limparMidiaEstudio } from "@/lib/studio-media";
import { OBJETIVOS_ESTUDIO } from "@/lib/studio-context";
import { Label } from "@/components/ui/label";
import { PERFIS, PERFIS_IDS, PERFIL_STORAGE, lerPerfilSalvo, type PerfilId } from "@/lib/studio-profiles";

/** Dois modos separados: ferramentas locais (sem IA) e IA Avançada (gateway real, pode consumir créditos). */
export function EstudioGratuito() {
  const [modo, trocar] = useModoGeracao();
  const [perfil, setPerfil] = useState<PerfilId>("chico");
  useEffect(() => { setPerfil(lerPerfilSalvo(localStorage.getItem(PERFIL_STORAGE))); }, []);
  const uid = useUsuarioAtual();
  const escolher = (p: PerfilId) => { setPerfil(p); localStorage.setItem(PERFIL_STORAGE, p); };
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
            ? <><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Modo ativo: Gratuito. A criação usa modelos e regras locais, sem IA nem créditos. Somente ao confirmar Salvar rascunho, Agendar ou Publicar, o conteúdo selecionado é enviado ao Planner/conta social.</>
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
      <StudioMaterial key={`${uid ?? "visitante"}:${perfil}`} userId={uid} perfil={perfil}>
        <Ferramentas perfil={perfil} modo={modo} uid={uid} />
      </StudioMaterial>
    </section>
  );
}

function Ferramentas({ perfil, modo, uid }: { perfil: PerfilId; modo: "gratuito" | "ia"; uid: string | null }) {
  const { material, alterar, novo } = useStudioMaterial();
  const { tema, objetivo } = material;
  return <div className="space-y-4">
    <section className="space-y-3 border-b pb-4" aria-label="Contexto do material">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Material atual</h3>
        <Button variant="outline" size="sm" onClick={() => { if (uid) limparMidiaEstudio(uid, perfil); novo(); }}><Plus className="mr-1 h-4 w-4" />Novo material</Button>
      </div>
      <Label htmlFor="studio-objetivo">Objetivo</Label>
      <select id="studio-objetivo" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={objetivo} onChange={e => alterar("objetivo", e.target.value)}>
        <option value="">Selecione o objetivo</option>
        {objetivo && !OBJETIVOS_ESTUDIO.includes(objetivo) && <option value={objetivo}>{objetivo}</option>}
        {OBJETIVOS_ESTUDIO.map(o => <option key={o}>{o}</option>)}
      </select>
      <EscolhaTema key={material.id} perfil={perfil} modo={modo} aprovado={tema} objetivo={objetivo} onAprovar={v => alterar("tema", v)} />
      <p className="text-sm" aria-label="Resumo do material"><strong>Tema:</strong> {tema || "Não escolhido"} · <strong>Objetivo:</strong> {objetivo || "Não escolhido"}</p>
    </section>
    <div key={material.id}>
      <div className={modo === "gratuito" ? "space-y-4" : "hidden"}>
        <GeradorLocal perfil={perfil} tema={tema} objetivo={objetivo} />
        <Tabs defaultValue="texto">
          <TabsList><TabsTrigger value="texto">Texto</TabsTrigger><TabsTrigger value="imagem">Imagem</TabsTrigger></TabsList>
          <TabsContent value="texto" forceMount className="mt-4 data-[state=inactive]:hidden"><TextStudio perfil={perfil} tema={tema} objetivo={objetivo} /></TabsContent>
          <TabsContent value="imagem" forceMount className="mt-4 data-[state=inactive]:hidden"><ImageStudio perfil={perfil} tema={tema} /></TabsContent>
        </Tabs>
      </div>
      {modo === "ia" && <IAAvancada perfil={perfil} tema={tema} objetivo={objetivo} />}
    </div>
  </div>;
}
