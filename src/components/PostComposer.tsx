import { useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateImage } from "@/lib/ai/generate-image.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sparkles, Upload, X, Loader2, Plus } from "lucide-react";
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
  const [tipo, setTipo] = useState<Tipo>("Post Único");
  const [estilo, setEstilo] = useState<Estilo>("Padrão");
  const [legenda, setLegenda] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [carrossel, setCarrossel] = useState<string[]>([]);
  const [data, setData] = useState("");
  const [status, setStatus] = useState<Status>("Rascunho");
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("Escreva um prompt primeiro");
    setLoadingAi(true);
    try {
      const { dataUrl } = await genImage({ data: { prompt } });
      if (tipo === "Post Único") setImagem(dataUrl);
      else {
        if (carrossel.length >= 10) return toast.error("Máximo 10 imagens no carrossel");
        setCarrossel((p) => [...p, dataUrl]);
      }
      toast.success("Imagem gerada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (tipo === "Post Único") {
      setImagem(await fileToDataUrl(files[0]));
    } else {
      const room = 10 - carrossel.length;
      const slice = files.slice(0, room);
      const urls = await Promise.all(slice.map(fileToDataUrl));
      setCarrossel((p) => [...p, ...urls]);
    }
    e.target.value = "";
  };

  const removeCarrossel = (i: number) => setCarrossel((p) => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (tipo === "Post Único" && !imagem) return toast.error("Adicione uma imagem");
    if (tipo === "Carrossel" && carrossel.length === 0) return toast.error("Adicione imagens ao carrossel");
    setSaving(true);
    const { error } = await supabase.from("posts").insert({
      tipo_post: tipo,
      estilo_layout: estilo,
      legenda,
      url_imagem: tipo === "Post Único" ? imagem : null,
      imagens_carrossel: tipo === "Carrossel" ? carrossel : [],
      data_agendamento: data ? new Date(data).toISOString() : null,
      status: data && status === "Rascunho" ? "Agendado" : status,
      prompt_ia: prompt || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Post salvo!");
    setLegenda(""); setPrompt(""); setImagem(null); setCarrossel([]); setData(""); setStatus("Rascunho");
    onCreated();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <Card className="p-6 space-y-5">
        <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="Post Único">Post Único</TabsTrigger>
            <TabsTrigger value="Carrossel">Carrossel</TabsTrigger>
          </TabsList>

          <TabsContent value="Post Único" className="mt-4">
            {imagem ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img src={imagem} alt="prévia" className="w-full aspect-square object-cover" />
                <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8" onClick={() => setImagem(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Clique para enviar uma imagem</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            )}
          </TabsContent>

          <TabsContent value="Carrossel" className="mt-4">
            <div className="grid grid-cols-3 gap-2">
              {carrossel.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeCarrossel(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs rounded px-1.5">{i + 1}</div>
                </div>
              ))}
              {carrossel.length < 10 && (
                <label className="aspect-square border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:bg-accent">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{carrossel.length}/10 imagens</p>
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
          <Textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={4} placeholder="Escreva sua legenda..." />
        </div>

        <div className="space-y-2 rounded-lg border bg-accent/30 p-4">
          <Label className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Prompt da Imagem (Gemini)</Label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Ex: pôr do sol sobre montanhas, estilo cinematográfico" />
          <Button onClick={handleGenerate} disabled={loadingAi} className="w-full">
            {loadingAi ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem via Gemini</>}
          </Button>
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

      <div className="lg:sticky lg:top-6 h-fit">
        <Label className="text-xs uppercase text-muted-foreground tracking-wider mb-2 block">Prévia ao vivo</Label>
        <PostPreview
          estilo={estilo}
          legenda={legenda}
          imagem={tipo === "Post Único" ? imagem : carrossel[0] ?? null}
          carrossel={tipo === "Carrossel" ? carrossel : []}
          tipo={tipo}
        />
      </div>
    </div>
  );
}
