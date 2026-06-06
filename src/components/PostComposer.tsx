import { useState, useMemo, type ChangeEvent } from "react";
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
import { Sparkles, X, Loader2, Plus, Wand2, Image as ImgIcon, Instagram, Linkedin, Twitter, Stamp, Film, Image as PictureIcon } from "lucide-react";
import { toast } from "sonner";
import { PostPreview } from "./PostPreview";
import { cn } from "@/lib/utils";
import type { Network, FormatoMidia } from "@/lib/posts-types";
import type { Perfil } from "@/components/ProfileSettings";
import { applyWatermark } from "@/lib/watermark";
import { Checkbox } from "@/components/ui/checkbox";


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

const NETWORK_META: Record<Network, { label: string; Icon: typeof Instagram; color: string }> = {
  instagram: { label: "Instagram", Icon: Instagram, color: "from-pink-500 to-purple-500" },
  linkedin: { label: "LinkedIn", Icon: Linkedin, color: "from-sky-600 to-blue-700" },
  x: { label: "X (Twitter)", Icon: Twitter, color: "from-neutral-700 to-black" },
};

export function PostComposer({ onCreated, perfil }: { onCreated: () => void; perfil: Perfil | null }) {
  const genImage = useServerFn(generateImage);
  const genIdea = useServerFn(suggestIdea);

  // Redes
  const [networks, setNetworks] = useState<Network[]>(["instagram"]);

  // Marca d'água com a logo do perfil
  const [watermark, setWatermark] = useState(false);

  const [tipo, setTipo] = useState<Tipo>("Post Único");
  const [estilo, setEstilo] = useState<Estilo>("Padrão");
  const [formato, setFormato] = useState<FormatoMidia>("Imagem");


  // Legendas por rede
  const [legendaIg, setLegendaIg] = useState("");
  const [legendaLi, setLegendaLi] = useState("");
  const [legendaX, setLegendaX] = useState("");
  const [activeLegendaTab, setActiveLegendaTab] = useState<Network>("instagram");

  const [prompt, setPrompt] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [carrossel, setCarrossel] = useState<string[]>([]);
  const [carouselPrompts, setCarouselPrompts] = useState<string[]>([""]);
  const [data, setData] = useState("");
  const [status, setStatus] = useState<Status>("Rascunho");
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  
  const [tema, setTema] = useState("");
  const [loadingIdea, setLoadingIdea] = useState(false);

  // Limite de imagens do carrossel: 4 se X selecionado, senão 10
  const maxCarousel = networks.includes("x") ? 4 : 10;

  const toggleNetwork = (n: Network) => {
    setNetworks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  };


  // Garante que aba ativa esteja entre as selecionadas
  const visibleLegendaTab = useMemo<Network | null>(
    () =>
      networks.length === 0
        ? null
        : networks.includes(activeLegendaTab)
        ? activeLegendaTab
        : networks[0],
    [networks, activeLegendaTab],
  );

  // Se X está selecionado, trim carrossel para 4
  const enforcedCarrossel = useMemo(() => carrossel.slice(0, maxCarousel), [carrossel, maxCarousel]);
  const enforcedPrompts = useMemo(() => carouselPrompts.slice(0, maxCarousel), [carouselPrompts, maxCarousel]);

  const handleSuggestIdea = async () => {
    if (networks.length === 0) return toast.error("Selecione ao menos uma rede social");
    setLoadingIdea(true);
    try {
      const r = await genIdea({ data: { networks } });
      setTema(r.tema);
      if (r.legenda_instagram) setLegendaIg(r.legenda_instagram);
      if (r.legenda_linkedin) setLegendaLi(r.legenda_linkedin);
      if (r.legenda_x) setLegendaX(r.legenda_x);
      setPrompt(r.prompt_imagem);
      if (tipo === "Carrossel") {
        setCarouselPrompts((arr) => {
          const next = [...arr];
          next[0] = r.prompt_imagem;
          return next;
        });
      }
      toast.success("Ideia adaptada para cada rede!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar ideia");
    } finally {
      setLoadingIdea(false);
    }
  };

  // Escolhe a logo da primeira rede selecionada; usuário pode reordenar via toggle
  const watermarkLogo = useMemo<string | null>(() => {
    if (!perfil) return null;
    const activeNet = networks[0];
    const byNet =
      activeNet === "linkedin" ? perfil.linkedin_foto_url :
      activeNet === "x" ? perfil.x_foto_url :
      activeNet === "instagram" ? perfil.instagram_foto_url :
      null;
    return byNet ?? perfil.instagram_foto_url ?? perfil.linkedin_foto_url ?? perfil.x_foto_url ?? perfil.url_logo ?? null;
  }, [perfil, networks]);

  const maybeWatermark = async (src: string): Promise<string> => {
    if (!watermark || !watermarkLogo) return src;
    try {
      return await applyWatermark(src, watermarkLogo);
    } catch {
      toast.error("Falha ao aplicar marca d'água — salvando sem.");
      return src;
    }
  };

  const handleGenerateSingle = async () => {
    if (!prompt.trim()) return toast.error("Escreva um prompt primeiro");
    setLoadingAi(true);
    try {
      const { dataUrl } = await genImage({ data: { prompt } });
      const finalUrl = await maybeWatermark(dataUrl);
      setImagem(finalUrl);
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
      const finalUrl = await maybeWatermark(dataUrl);
      setCarrossel((arr) => {
        const next = [...arr];
        next[index] = finalUrl;
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
    if (file) {
      if (formato === "Vídeo/Reels" && !file.type.startsWith("video/")) {
        toast.error("Envie um arquivo de vídeo (MP4).");
        e.target.value = "";
        return;
      }
      if (formato === "Imagem" && !file.type.startsWith("image/")) {
        toast.error("Envie uma imagem.");
        e.target.value = "";
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error("Arquivo grande demais (máx 25MB).");
        e.target.value = "";
        return;
      }
      setImagem(await fileToDataUrl(file));
    }
    e.target.value = "";
  };

  const addCarouselPage = () => {
    if (carouselPrompts.length >= maxCarousel)
      return toast.error(`Máximo ${maxCarousel} páginas${networks.includes("x") ? " (limite do X)" : ""}`);
    setCarouselPrompts((p) => [...p, ""]);
  };

  const removeCarouselPage = (i: number) => {
    setCarouselPrompts((p) => p.filter((_, idx) => idx !== i));
    setCarrossel((p) => p.filter((_, idx) => idx !== i));
  };

  const updatePagePrompt = (i: number, v: string) => {
    setCarouselPrompts((p) => p.map((x, idx) => (idx === i ? v : x)));
  };

  const primaryLegenda = legendaIg || legendaLi || legendaX || "";

  const handleSave = async () => {
    if (networks.length === 0) return toast.error("Selecione ao menos uma rede social");
    if (tipo === "Post Único" && !imagem) return toast.error("Gere uma imagem via Gemini");
    const filledCarousel = enforcedCarrossel.filter(Boolean);
    if (tipo === "Carrossel" && filledCarousel.length === 0) return toast.error("Gere ao menos a Página 1");
    if (networks.includes("x") && legendaX.length > 280) return toast.error("Texto do X excede 280 caracteres");

    setSaving(true);
    const { error } = await supabase.from("posts").insert({
      tipo_post: tipo,
      estilo_layout: estilo,
      formato_midia: formato,
      legenda: primaryLegenda,
      legenda_instagram: networks.includes("instagram") ? legendaIg : null,
      legenda_linkedin: networks.includes("linkedin") ? legendaLi : null,
      legenda_x: networks.includes("x") ? legendaX : null,
      postar_instagram: networks.includes("instagram"),
      postar_linkedin: networks.includes("linkedin"),
      postar_x: networks.includes("x"),
      url_imagem: tipo === "Post Único" ? imagem : null,
      imagens_carrossel: tipo === "Carrossel" ? filledCarousel : [],
      data_agendamento: data ? new Date(data).toISOString() : null,
      status: data && status === "Rascunho" ? "Agendado" : status,
      prompt_ia: tipo === "Carrossel" ? enforcedPrompts.join("\n---\n") : prompt || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Post salvo!");
    setLegendaIg(""); setLegendaLi(""); setLegendaX("");
    setPrompt(""); setImagem(null); setCarrossel([]);
    setCarouselPrompts([""]); setData(""); setStatus("Rascunho");
    setTema("");
    onCreated();
  };

  // Para a prévia escolher legenda da rede ativa
  const previewLegenda =
    visibleLegendaTab === "instagram" ? legendaIg :
    visibleLegendaTab === "linkedin" ? legendaLi :
    legendaX;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="space-y-6">
        {/* SELETOR DE REDES */}
        <Card className="p-5">
          <Label className="text-sm font-semibold">Onde publicar?</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Selecione uma ou mais redes — a IA adapta cada texto.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(NETWORK_META) as Network[]).map((n) => {
              const { label, Icon, color } = NETWORK_META[n];
              const active = networks.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleNetwork(n)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <div className={cn("h-8 w-8 rounded-md bg-gradient-to-br flex items-center justify-center text-white", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">{label}</span>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Marca d'água */}
          <div className="mt-4 pt-4 border-t flex items-start gap-3">
            <Checkbox
              id="watermark"
              checked={watermark}
              onCheckedChange={(v) => setWatermark(Boolean(v))}
              disabled={!watermarkLogo}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="watermark" className="flex items-center gap-1.5 cursor-pointer text-sm">
                <Stamp className="h-3.5 w-3.5" /> Inserir marca d'água/logo na imagem
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {watermarkLogo
                  ? `Usará a logo de ${NETWORK_META[networks[0] ?? "instagram"].label} (canto inferior direito).`
                  : "Salve uma foto/logo em Configurações do Perfil para habilitar."}
              </p>
            </div>
            {watermarkLogo && (
              <img src={watermarkLogo} alt="" className="h-8 w-8 rounded border object-cover" />
            )}
          </div>
        </Card>


        {/* Ideia com IA — Nicho fixo */}
        <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Wand2 className="h-5 w-5 text-primary" /> Gerar Ideia com IA
          </Label>
          <div className="mt-2 mb-3 rounded-md border bg-card/60 p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Especialidade fixa</span>
            <p className="text-sm font-medium mt-0.5 leading-snug">
              Odontologia — Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar
            </p>
          </div>
          <Button onClick={handleSuggestIdea} disabled={loadingIdea} className="w-full">
            {loadingIdea ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando ideia clínica...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Sugerir Tema e Legenda</>
            )}
          </Button>
          {tema && (
            <div className="mt-3 p-3 rounded-md bg-card border text-sm">
              <span className="text-xs uppercase text-muted-foreground">Tema sugerido</span>
              <p className="font-medium mt-0.5">{tema}</p>
            </div>
          )}
        </Card>


        <Card className="p-6 space-y-5">
          {/* FORMATO DE MÍDIA */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Formato da mídia</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["Imagem", "Vídeo/Reels"] as FormatoMidia[]).map((f) => {
                const Icon = f === "Vídeo/Reels" ? Film : PictureIcon;
                const active = formato === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFormato(f); setImagem(null); if (f === "Vídeo/Reels") setTipo("Post Único"); }}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", f === "Vídeo/Reels" && "text-violet-500")} />
                    {f === "Imagem" ? "Imagem estática" : "Vídeo / Reels"}
                  </button>
                );
              })}
            </div>
            {formato === "Vídeo/Reels" && (
              <p className="text-[11px] text-muted-foreground rounded-md bg-violet-500/10 border border-violet-500/20 p-2.5 leading-relaxed">
                <Film className="h-3 w-3 inline mr-1 text-violet-600" />
                O arquivo MP4 será processado como <strong>Reels no Instagram</strong> e como <strong>postagem de vídeo no LinkedIn e X</strong>. Carrossel está desabilitado para vídeo.
              </p>
            )}
          </div>

          <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="Post Único">Post Único</TabsTrigger>
              <TabsTrigger value="Carrossel" disabled={formato === "Vídeo/Reels"}>
                Carrossel
                {networks.includes("x") && (
                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">máx 4 (X)</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* POST ÚNICO */}
            <TabsContent value="Post Único" className="mt-4 space-y-4">
              {formato === "Imagem" ? (
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
              ) : (
                <div className="rounded-lg border bg-violet-500/5 p-4 text-sm text-muted-foreground">
                  <Film className="h-4 w-4 inline mr-1.5 text-violet-600" />
                  Faça upload do arquivo MP4 abaixo. A geração via IA é exclusiva para imagens.
                </div>
              )}

              {imagem ? (
                <div className="relative rounded-lg overflow-hidden border">
                  {formato === "Vídeo/Reels" ? (
                    <video src={imagem} controls className="w-full aspect-square object-cover bg-black" />
                  ) : (
                    <img src={imagem} alt="prévia" className="w-full aspect-square object-cover" />
                  )}
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8" onClick={() => setImagem(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                  {formato === "Vídeo/Reels" && (
                    <Badge className="absolute top-2 left-2 bg-violet-500 hover:bg-violet-500 text-white">
                      <Film className="h-3 w-3 mr-1" /> Reels
                    </Badge>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors">
                  {formato === "Vídeo/Reels" ? (
                    <>
                      <Film className="h-10 w-10 text-violet-500 mb-2" />
                      <span className="text-sm font-medium">Enviar vídeo (MP4)</span>
                      <span className="text-xs text-muted-foreground mt-1 text-center px-4">
                        Será publicado como Reels no Instagram e vídeo no LinkedIn / X.
                      </span>
                    </>
                  ) : (
                    <>
                      <ImgIcon className="h-10 w-10 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">A imagem gerada aparecerá aqui</span>
                      <span className="text-xs text-muted-foreground mt-1">ou clique para enviar manualmente</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={formato === "Vídeo/Reels" ? "video/mp4,video/*" : "image/*"}
                    className="hidden"
                    onChange={handleUploadSingle}
                  />
                </label>
              )}
            </TabsContent>


            {/* CARROSSEL */}
            <TabsContent value="Carrossel" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Gere cada página com um prompt diferente — todas via Gemini.
                </p>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {enforcedPrompts.length}/{maxCarousel}
                </span>
              </div>

              {enforcedPrompts.map((p, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">Página {i + 1}</span>
                    {enforcedPrompts.length > 1 && (
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
                    {enforcedCarrossel[i] ? (
                      <img src={enforcedCarrossel[i]} alt="" className="h-20 w-20 rounded-md object-cover border" />
                    ) : (
                      <div className="h-20 w-20 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground">
                        <ImgIcon className="h-5 w-5" />
                      </div>
                    )}
                    <Button
                      onClick={() => handleGeneratePage(i)}
                      disabled={loadingPage === i}
                      variant={enforcedCarrossel[i] ? "outline" : "default"}
                      className="flex-1"
                      size="sm"
                    >
                      {loadingPage === i ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> {enforcedCarrossel[i] ? "Regerar via Gemini" : `Gerar Página ${i + 1} via Gemini`}</>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}

              {enforcedPrompts.length < maxCarousel && (
                <Button variant="outline" onClick={addCarouselPage} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar página {enforcedPrompts.length + 1}
                </Button>
              )}
              {networks.includes("x") && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Limite de 4 imagens imposto pelo X (Twitter).
                </p>
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

          {/* LEGENDAS POR REDE */}
          {networks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Selecione ao menos uma rede social acima para editar legendas.
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Legendas por rede</Label>
              <Tabs value={visibleLegendaTab ?? undefined} onValueChange={(v) => setActiveLegendaTab(v as Network)}>
                <TabsList className="w-full" style={{ gridTemplateColumns: `repeat(${networks.length}, minmax(0, 1fr))`, display: "grid" }}>
                  {networks.map((n) => {
                    const { label, Icon } = NETWORK_META[n];
                    return (
                      <TabsTrigger key={n} value={n} className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {networks.includes("instagram") && (
                  <TabsContent value="instagram" className="mt-3">
                    <Textarea
                      value={legendaIg}
                      onChange={(e) => setLegendaIg(e.target.value)}
                      rows={6}
                      placeholder="Legenda do Instagram com hashtags ao final..."
                    />
                  </TabsContent>
                )}
                {networks.includes("linkedin") && (
                  <TabsContent value="linkedin" className="mt-3">
                    <Textarea
                      value={legendaLi}
                      onChange={(e) => setLegendaLi(e.target.value)}
                      rows={6}
                      placeholder="Post profissional para LinkedIn..."
                    />
                  </TabsContent>
                )}
                {networks.includes("x") && (
                  <TabsContent value="x" className="mt-3 space-y-1">
                    <Textarea
                      value={legendaX}
                      onChange={(e) => setLegendaX(e.target.value.slice(0, 280))}
                      rows={4}
                      placeholder="Tweet curto (máx 280)..."
                    />
                    <p className={cn(
                      "text-xs text-right",
                      legendaX.length > 260 ? "text-destructive font-medium" : "text-muted-foreground",
                    )}>
                      {legendaX.length}/280
                    </p>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}


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

      {visibleLegendaTab && (
        <div className="lg:sticky lg:top-24 h-fit space-y-2">
          <Label className="text-xs uppercase text-muted-foreground tracking-wider block">
            Prévia ao vivo · {NETWORK_META[visibleLegendaTab].label}
          </Label>
          <PostPreview
            estilo={visibleLegendaTab === "x" ? "Estilo X" : estilo}
            legenda={previewLegenda}
            imagem={tipo === "Post Único" ? imagem : enforcedCarrossel.filter(Boolean)[0] ?? null}
            carrossel={tipo === "Carrossel" ? enforcedCarrossel.filter(Boolean) : []}
            tipo={tipo}
            perfil={perfil}
            network={visibleLegendaTab}
          />
        </div>
      )}

    </div>
  );
}
