import { ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TextStudio } from "./TextStudio";
import { ImageStudio } from "./ImageStudio";

/** Ferramentas 100% locais: sem IA, sem chaves, sem envio de arquivos para fora do navegador. */
export function EstudioGratuito() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Estúdio Gratuito</h2>
        <p className="mt-1 flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Tudo aqui funciona no seu navegador, sem custo e sem usar créditos de IA. As sugestões vêm de modelos e regras fixas, não de inteligência artificial, e suas imagens não são enviadas para nenhum serviço. Nada é publicado ou salvo no Planner.
        </p>
      </div>
      <Tabs defaultValue="texto">
        <TabsList>
          <TabsTrigger value="texto">Texto</TabsTrigger>
          <TabsTrigger value="imagem">Imagem</TabsTrigger>
        </TabsList>
        <TabsContent value="texto" className="mt-4"><TextStudio /></TabsContent>
        <TabsContent value="imagem" className="mt-4"><ImageStudio /></TabsContent>
      </Tabs>
    </section>
  );
}
