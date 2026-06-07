import { useState, useMemo, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateImage } from "@/lib/ai/generate-image.functions";
import { suggestIdea } from "@/lib/ai/suggest-idea.functions";
import { dispatchAlbato } from "@/lib/webhooks/albato.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sparkles, X, Loader2, Plus, Wand2, Image as ImgIcon, Instagram, Linkedin, Stamp, Film, Image as PictureIcon } from "lucide-react";
import { toast } from "sonner";
import { PostPreview } from "./PostPreview";
import { cn } from "@/lib/utils";
import type { Network, FormatoMidia } from "@/lib/posts-types";
import type { Perfil } from "@/components/ProfileSettings";
import { applyWatermark } from "@/lib/watermark";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";


type Tipo = "Post Único" | "Carrossel";
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
};

export function PostComposer({ onCreated, perfil }: { onCreated: () => void; perfil: Perfil | null }) {
  const genImage = useServerFn(generateImage);
  const genIdea = useServerFn(suggestIdea);
  const sendAlbato = useServerFn(dispatchAlbato);

  // Redes
  const [networks, setNetworks] = useState<Network[]>(["instagram"]);

  // Marca d'água com a logo do perfil
  const [watermark, setWatermark] = useState(false);

  const [tipo, setTipo] = useState<Tipo>("Post Único");
  const [formato, setFormato] = useState<FormatoMidia>("Imagem");


  // Legendas por rede
  const [legendaIg, setLegendaIg] = useState("");
  const [legendaLi, setLegendaLi] = useState("");
  const [activeLegendaTab, setActiveLegendaTab] = useState<Network>("instagram");

  const [prompt, setPrompt] = useState("");
  const [imageMode, setImageMode] = useState<"auto" | "manual">("auto");
  const [orientacoes, setOrientacoes] = useState("");
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

  const maxCarousel = 10;

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

  const enforcedCarrossel = useMemo(() => carrossel.slice(0, maxCarousel), [carrossel]);
  const enforcedPrompts = useMemo(() => carouselPrompts.slice(0, maxCarousel), [carouselPrompts]);

  const handleSuggestIdea = async () => {
    if (networks.length === 0) return toast.error("Selecione ao menos uma rede social");
    setLoadingIdea(true);
    try {
      const r = await genIdea({ data: { networks } });
      setTema(r.tema);
      if (r.legenda_instagram) setLegendaIg(r.legenda_instagram);
      if (r.legenda_linkedin) setLegendaLi(r.legenda_linkedin);
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

  // Marca d'água por rede.
  const watermarkLogo = useMemo<string | null>(() => {
    if (!perfil) return null;
    const activeNet = networks[0];
    if (activeNet === "linkedin") return perfil.linkedin_foto_url ?? perfil.url_logo ?? null;
    if (activeNet === "instagram") return perfil.instagram_foto_url ?? perfil.url_logo ?? null;
    return perfil.instagram_foto_url ?? perfil.linkedin_foto_url ?? perfil.url_logo ?? null;
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

  // Constrói um prompt visual médico/ético a partir da legenda da rede ativa.
  const buildAutoPrompt = (baseText: string): string => {
    const caption = (baseText || tema || "").trim().slice(0, 600);
    return [
      "Professional medical illustration / clean editorial photography for a dental social media post.",
      "Specialty: Oral & Maxillofacial Surgery and Hospital Dentistry (CTBMF).",
      "Aesthetic: modern hospital environment, clinical blue / white / soft grey palette, soft natural lighting, infographic-friendly, minimal and respectful.",
      "STRICTLY FORBIDDEN: visible blood, open wounds, graphic surgery, identifiable patients, gore, distressing content.",
      "Composição quadrada otimizada para feed do Instagram / LinkedIn.",
      `Conteúdo de referência (não escreva o texto na imagem, apenas inspire o visual): "${caption}"`,
    ].join(" ");
  };

  const buildManualPrompt = (userText: string): string => {
    const safe = (userText || "").trim().slice(0, 800);
    return [
      "Imagem profissional e ética para post de Odontologia (CTBMF / Hospitalar).",
      "Sem sangue, sem ferimentos, sem pacientes identificáveis, estética clean e respeitosa.",
      "Composição quadrada otimizada para feed do Instagram / LinkedIn.",
      `Orientações do usuário: ${safe}`,
    ].join(" ");
  };

  const handleGenerateSingle = async () => {
    const captionForAuto = legendaIg || legendaLi;
    if (imageMode === "auto" && !captionForAuto.trim() && !tema.trim()) {
      return toast.error("Gere a legenda primeiro (ou troque para 'Fornecer Minhas Orientações').");
    }
    if (imageMode === "manual" && !orientacoes.trim()) {
      return toast.error("Descreva o que você quer ver na imagem.");
    }
    const finalPrompt = imageMode === "auto"
      ? buildAutoPrompt(captionForAuto)
      : buildManualPrompt(orientacoes);
    setPrompt(finalPrompt);
    setLoadingAi(true);
    try {
      const { dataUrl } = await genImage({ data: { prompt: finalPrompt } });
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
    const pageOrientation = carouselPrompts[index] ?? "";
    const captionForAuto = legendaIg || legendaLi;
    if (imageMode === "manual" && !pageOrientation.trim()) {
      return toast.error(`Descreva o que quer ver na página ${index + 1}.`);
    }
    if (imageMode === "auto" && !captionForAuto.trim() && !tema.trim()) {
      return toast.error("Gere a legenda primeiro (ou troque para 'Fornecer Minhas Orientações').");
    }
    const finalPrompt = imageMode === "auto"
      ? buildAutoPrompt(`${captionForAuto}\n\nPágina ${index + 1} do carrossel.`)
      : buildManualPrompt(pageOrientation);
    setLoadingPage(index);
    try {
      const { dataUrl } = await genImage({ data: { prompt: finalPrompt } });
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
      return toast.error(`Máximo ${maxCarousel} páginas`);
    setCarouselPrompts((p) => [...p, ""]);
  };

  const removeCarouselPage = (i: number) => {
    setCarouselPrompts((p) => p.filter((_, idx) => idx !== i));
    setCarrossel((p) => p.filter((_, idx) => idx !== i));
  };

  const updatePagePrompt = (i: number, v: string) => {
    setCarouselPrompts((p) => p.map((x, idx) => (idx === i ? v : x)));
  };

  const primaryLegenda = legendaIg || legendaLi || "";

  const handleSave = async (forceAgendar = false) => {
    if (networks.length === 0) return toast.error("Selecione ao menos uma rede social");
    if (tipo === "Post Único" && !imagem) return toast.error("Gere uma imagem via Gemini");
    const filledCarousel = enforcedCarrossel.filter(Boolean);
    if (tipo === "Carrossel" && filledCarousel.length === 0) return toast.error("Gere ao menos a Página 1");

    const agendamentoIso = data
      ? new Date(data).toISOString()
      : forceAgendar
        ? new Date().toISOString()
        : null;
    const finalStatus: Status = forceAgendar
      ? "Agendado"
      : data && status === "Rascunho"
        ? "Agendado"
        : status;

    setSaving(true);
    const { data: inserted, error } = await supabase.from("posts").insert({
      tipo_post: tipo,
      estilo_layout: "Padrão",
      formato_midia: formato,
      legenda: primaryLegenda,
      legenda_instagram: networks.includes("instagram") ? legendaIg : null,
      legenda_linkedin: networks.includes("linkedin") ? legendaLi : null,
      postar_instagram: networks.includes("instagram"),
      postar_linkedin: networks.includes("linkedin"),
      url_imagem: tipo === "Post Único" ? imagem : null,
      imagens_carrossel: tipo === "Carrossel" ? filledCarousel : [],
      data_agendamento: agendamentoIso,
      status: finalStatus,
      prompt_ia: tipo === "Carrossel" ? enforcedPrompts.join("\n---\n") : prompt || null,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(forceAgendar ? "Post agendado!" : "Post salvo!");

    // Dispara webhook Albato (não bloqueia o fluxo)
    try {
      const mediaUrl = tipo === "Post Único" ? imagem : filledCarousel[0] ?? null;
      const r = await sendAlbato({
        data: {
          media_url: mediaUrl,
          caption: primaryLegenda,
          data_agendamento: agendamentoIso,
          post_id: inserted?.id,
          status: finalStatus,
        },
      });
      if (r.ok) toast.success("Webhook Albato enviado ✓");
      else toast.error(`Albato respondeu status ${r.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? `Albato: ${e.message}` : "Falha no webhook Albato");
    }

    setLegendaIg(""); setLegendaLi("");
    setPrompt(""); setImagem(null); setCarrossel([]);
    setCarouselPrompts([""]); setData(""); setStatus("Rascunho");
    setTema(""); setFormato("Imagem"); setOrientacoes("");
    onCreated();
  };

  // Para a prévia escolher legenda da rede ativa
  const previewLegenda =
    visibleLegendaTab === "instagram" ? legendaIg : legendaLi;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="space-y-6">
        {/* SELETOR DE REDES */}
        <Card className="p-5">
          <Label className="text-sm font-semibold">Onde publicar?</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Selecione uma ou mais redes — a IA adapta cada texto.
          </p>
          <div className="grid grid-cols-2 gap-2">
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
            <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Textos por GPT-5
            </span>
          </Label>
          <div className="mt-2 mb-3 rounded-md border bg-card/60 p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Especialidade fixa</span>
            <p className="text-sm font-medium mt-0.5 leading-snug">
              Odontologia — Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar
            </p>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              ✍️ Temas, legendas e prompts de imagem escritos pelo <strong>GPT-5 (OpenAI)</strong> — tom técnico no LinkedIn, humanizado no Instagram. 🎨 As imagens são geradas pelo <strong>Google Gemini</strong> a partir do prompt criado pelo GPT-5.
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
                O arquivo MP4 será processado como <strong>Reels no Instagram</strong> e como <strong>postagem de vídeo no LinkedIn</strong>. Carrossel está desabilitado para vídeo.
              </p>
            )}
          </div>

          <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="Post Único">Post Único</TabsTrigger>
              <TabsTrigger value="Carrossel" disabled={formato === "Vídeo/Reels"}>
                Carrossel
              </TabsTrigger>
            </TabsList>

            {/* POST ÚNICO */}
            <TabsContent value="Post Único" className="mt-4 space-y-4">
              {formato === "Imagem" ? (
                <div className="space-y-3 rounded-lg border bg-accent/30 p-4">
                  <Label className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" /> Geração de Imagem
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                      100% Google Gemini
                    </span>
                  </Label>

                  {/* Seletor de modo */}
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "auto", label: "Gerar Automaticamente por IA", hint: "Usa a legenda do post." },
                      { id: "manual", label: "Fornecer Minhas Orientações", hint: "Você descreve em PT." },
                    ] as const).map((m) => {
                      const active = imageMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setImageMode(m.id)}
                          className={cn(
                            "flex flex-col items-start text-left p-3 rounded-lg border-2 transition-all",
                            active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          <span className="text-xs font-semibold">{m.label}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{m.hint}</span>
                        </button>
                      );
                    })}
                  </div>

                  {imageMode === "auto" ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        Prompt automático (somente leitura) — gerado a partir da legenda da rede ativa.
                      </p>
                      <Textarea
                        value={buildAutoPrompt(legendaIg || legendaLi)}
                        readOnly
                        rows={3}
                        className="bg-muted/40 text-xs cursor-not-allowed"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Suas orientações</Label>
                      <Textarea
                        value={orientacoes}
                        onChange={(e) => setOrientacoes(e.target.value)}
                        rows={3}
                        placeholder="Digite o que você quer ver na imagem (ex: cores, elementos, estilo)"
                      />
                    </div>
                  )}

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
                        Será publicado como Reels no Instagram e vídeo no LinkedIn.
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
                  {imageMode === "auto"
                    ? "Modo automático: cada página usa a legenda como base."
                    : "Modo manual: descreva o que quer ver em cada página."}
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

                  {imageMode === "auto" ? (
                    <Textarea
                      value={buildAutoPrompt(`${legendaIg || legendaLi}\n\nPágina ${i + 1} do carrossel.`)}
                      readOnly
                      rows={2}
                      className="bg-muted/40 text-xs cursor-not-allowed"
                    />
                  ) : (
                    <Textarea
                      value={p}
                      onChange={(e) => updatePagePrompt(i, e.target.value)}
                      rows={2}
                      placeholder={`O que mostrar na página ${i + 1}? (cores, elementos, estilo)`}
                    />
                  )}

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
            </TabsContent>
          </Tabs>

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
              </Tabs>
            </div>
          )}


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

          <Button onClick={() => handleSave(false)} disabled={saving} size="lg" variant="outline" className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar como Rascunho
          </Button>

          <div className="rounded-lg border-2 border-blue-500/40 bg-blue-500/5 p-4 space-y-2">
            <Label htmlFor="data-agendamento" className="text-base font-semibold text-blue-700 dark:text-blue-300">
              📅 Escolha o Dia e Horário da Postagem
            </Label>
            <Input
              id="data-agendamento"
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-12 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Se deixar em branco, o post será agendado para o momento em que clicar abaixo.
            </p>
          </div>

          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            size="lg"
            className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            Agendar Post
          </Button>
        </Card>
      </div>

      {visibleLegendaTab && (
        <div className="lg:sticky lg:top-24 h-fit space-y-2">
          <Label className="text-xs uppercase text-muted-foreground tracking-wider block">
            Prévia ao vivo · {NETWORK_META[visibleLegendaTab].label}
          </Label>
          <PostPreview
            estilo="Padrão"
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
