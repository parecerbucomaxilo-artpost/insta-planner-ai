import { useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateImage } from "@/lib/ai/generate-image.functions";
import { suggestIdea } from "@/lib/ai/suggest-idea.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sparkles, Upload, X, Loader2, Plus, Wand2, Image as ImgIcon } from "lucide-react";
import { toast } from "sonner";
import { PostPreview } from "./PostPreview";

type Tipo = "Post Único" | "Carrossel";
type Estilo = "Padrão" | "Estilo X";
type Status = "Rascunho" | "Agendado" | "Publicado";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function PostComposer({ onCreated }: { onCreated: () => void }) {
  const genImage = useServerFn(generateImage);
  const genIdea = useServerFn(suggestIdea);

  const [tipo, setTipo] = useState<Tipo>("Post Único");
  const [estilo, setEstilo] = useState<Estilo>("Padrão");
  const [legenda, setLegenda] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [carrossel, setCarrossel] = useState<string[]>([]);
  const [carouselPrompts, setCarouselPrompts] = useState<string[]>([""]);
  const [data, setData] = useState("");
  const [status, setStatus] = useState<Status>("Rascunho");
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Ideia com IA
  const [niche, setNiche] = useState("");
  const [tema, setTema] = useState("");
  const [loadingIdea, setLoadingIdea] = useState(false);

  const handleSuggestIdea = async () => {
    if (!niche.trim()) return toast.error("Digite um nicho ou assunto");
    setLoadingIdea(true);
    try {
      const r = await genIdea({ data: { niche } });
      setTema(r.tema);
      setLegenda(r.legenda);
      setPrompt(r.prompt_imagem);
      if (tipo === "Carrossel") {
        setCarouselPrompts((arr) => {
          const next = [...arr];
          next[0] = r.prompt_imagem;
          return next;
        });
      }
      toast.success("Ideia gerada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar ideia");
    } finally {
      setLoadingIdea(false);
    }
  };

  const handleGenerateSingle = async () => {
    if (!prompt.trim()) return toast.error("Escreva um prompt primeiro");
    setLoadingAi(true);
    try {
      const { dataUrl } = await genImage({ data: { prompt } });
      setImagem(dataUrl);
      toast.success("Imagem gerada via Gemini!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGeneratePage = async (index: number) => {
    const p = carouselPrompts[index];
    if (!p?.trim()) return toast.error(`Escreva o prompt da página ${index + 1}`);
    setLoadingPage(index);
    try {
      const { dataUrl } = await genImage({ data: { prompt: p } });
      setCarrossel((arr) => {
        const next = [...arr];
        next[index] = dataUrl;
        return next;
      });
      toast.success(`Página ${index + 1} gerada!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setLoadingPage(null);
    }
  };

  const handleUploadSingle = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImagem(await fileToDataUrl(file));
    e.target.value = "";
  };

  const addCarouselPage = () => {
    if (carouselPrompts.length >= 10) return toast.error("Máximo 10 páginas");
    setCarouselPrompts((p) => [...p, ""]);
  };

  const removeCarouselPage = (i: number) => {
    setCarouselPrompts((p) => p.filter((_, idx) => idx !== i));
    setCarrossel((p) => p.filter((_, idx) => idx !== i));
  };

  const updatePagePrompt = (i: number, v: string) => {
    setCarouselPrompts((p) => p.map((x, idx) => (idx === i ? v : x)));
  };

  const handleSave = async () => {
    if (tipo === "Post Único" && !imagem) return toast.error("Gere uma imagem via Gemini");
    const filledCarousel = carrossel.filter(Boolean);
    if (tipo === "Carrossel" && filledCarousel.length === 0) return toast.error("Gere ao menos a Página 1");
    setSaving(true);
    const { error } = await supabase.from("posts").insert({
      tipo_post: tipo,
      estilo_layout: estilo,
      legenda,
      url_imagem: tipo === "Post Único" ? imagem : null,
      imagens_carrossel: tipo === "Carrossel" ? filledCarousel : [],
      data_agendamento: data ? new Date(data).toISOString() : null,
      status: data && status === "Rascunho" ? "Agendado" : status,
      prompt_ia: tipo === "Carrossel" ? carouselPrompts.join("\n---\n") : prompt || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Post salvo!");
    setLegenda(""); setPrompt(""); setImagem(null); setCarrossel([]);
    setCarouselPrompts([""]); setData(""); setStatus("Rascunho");
    setNiche(""); setTema("");
    onCreated();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="space-y-6">
        {/* Ideia com IA */}
        <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Wand2 className="h-5 w-5 text-primary" /> Gerar Ideia com IA
          </Label>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Diga o nicho — a IA cria tema, legenda com hashtags e prompt de imagem.
          </p>
          <div className="flex gap-2">
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex: Moda, Finanças, Confeitaria..."
              onKeyDown={(e) => e.key === "Enter" && handleSuggestIdea()}
            />
            <Button onClick={handleSuggestIdea} disabled={loadingIdea}>
              {loadingIdea ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Sugerir Tema e Legenda</span>
            </Button>
          </div>
          {tema && (
            <div className="mt-3 p-3 rounded-md bg-card border text-sm">
              <span className="text-xs uppercase text-muted-foreground">Tema sugerido</span>
              <p className="font-medium mt-0.5">{tema}</p>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-5">
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="Post Único">Post Único</TabsTrigger>
              <TabsTrigger value="Carrossel">Carrossel</TabsTrigger>
            </TabsList>

            {/* POST ÚNICO */}
            <TabsContent value="Post Único" className="mt-4 space-y-4">
              <div className="space-y-2 rounded-lg border bg-accent/30 p-4">
                <Label className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" /> Prompt da Imagem
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                    100% Google Gemini
                  </span>
                </Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  placeholder="Ex: pôr do sol sobre montanhas, estilo cinematográfico"
                />
                <Button onClick={handleGenerateSingle} disabled={loadingAi} className="w-full">
                  {loadingAi ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando via Gemini...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem via Gemini</>
                  )}
                </Button>
              </div>

              {imagem ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={imagem} alt="prévia" className="w-full aspect-square object-cover" />
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8" onClick={() => setImagem(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors">
                  <ImgIcon className="h-10 w-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">A imagem gerada aparecerá aqui</span>
                  <span className="text-xs text-muted-foreground mt-1">ou clique para enviar manualmente</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadSingle} />
                </label>
              )}
            </TabsContent>

            {/* CARROSSEL */}
            <TabsContent value="Carrossel" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Gere cada página do carrossel com um prompt diferente — todas via Gemini.
                </p>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {carouselPrompts.length}/10
                </span>
              </div>

              {carouselPrompts.map((p, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">Página {i + 1}</span>
                    {carouselPrompts.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-7 w-7 text-muted-foreground"
                        onClick={() => removeCarouselPage(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <Textarea
                    value={p}
                    onChange={(e) => updatePagePrompt(i, e.target.value)}
                    rows={2}
                    placeholder={`Prompt da página ${i + 1}...`}
                  />

                  <div className="flex gap-2 items-start">
                    {carrossel[i] ? (
                      <img src={carrossel[i]} alt="" className="h-20 w-20 rounded-md object-cover border" />
                    ) : (
                      <div className="h-20 w-20 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground">
                        <ImgIcon className="h-5 w-5" />
                      </div>
                    )}
                    <Button
                      onClick={() => handleGeneratePage(i)}
                      disabled={loadingPage === i}
                      variant={carrossel[i] ? "outline" : "default"}
                      className="flex-1"
                      size="sm"
                    >
                      {loadingPage === i ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> {carrossel[i] ? "Regerar via Gemini" : `Gerar Página ${i + 1} via Gemini`}</>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}

              {carouselPrompts.length < 10 && (
                <Button variant="outline" onClick={addCarouselPage} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar página {carouselPrompts.length + 1}
                </Button>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Estilo do Layout</Label>
            <Select value={estilo} onValueChange={(v) => setEstilo(v as Estilo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Padrão">Padrão (Instagram)</SelectItem>
                <SelectItem value="Estilo X">Estilo X (Twitter)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Legenda</Label>
            <Textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={5} placeholder="Escreva sua legenda..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de Agendamento</Label>
              <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rascunho">Rascunho</SelectItem>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Publicado">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Post
          </Button>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 h-fit">
        <Label className="text-xs uppercase text-muted-foreground tracking-wider mb-2 block">Prévia ao vivo</Label>
        <PostPreview
          estilo={estilo}
          legenda={legenda}
          imagem={tipo === "Post Único" ? imagem : carrossel.filter(Boolean)[0] ?? null}
          carrossel={tipo === "Carrossel" ? carrossel.filter(Boolean) : []}
          tipo={tipo}
        />
      </div>
    </div>
  );
}
