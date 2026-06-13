import { useState, useCallback, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2, Image as ImageIcon, Send, Check, Instagram, Linkedin, Layers, Square, Clock, Zap, MessageCircle, Wand2, CalendarDays, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { uploadPostImage } from "@/lib/storage-utils";
import { getAuthedUserId } from "@/lib/auth-utils";
import { XStyleIcon } from "@/components/icons/XStyleIcon";
import { BRANDING } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { generateSinglePost, generateWeekThemes, discardPost, approvePost, MODELOS_IA, MODELOS_IMAGEM } from "@/lib/ai-post.functions";
type ModeloIA = (typeof MODELOS_IA)[number]["id"];
type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Network = "instagram" | "linkedin";
type Formato = "Post Único" | "Carrossel" | "Estilo X";
type Quando = "agora" | "7dias" | "data";


const FORMATOS: { id: Formato; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "Post Único", label: "Post Único", icon: Square, desc: "1 imagem" },
  { id: "Carrossel", label: "Carrossel", icon: Layers, desc: "Até 10 slides" },
  { id: "Estilo X", label: "Estilo X", icon: XStyleIcon, desc: "Tweet visual (1-3 slides 16:9)" },
];

export function PostComposer({ onCreated }: { onCreated: () => void }) {
  const [networks, setNetworks] = useState<Network[]>(["instagram"]);
  const [formato, setFormato] = useState<Formato>("Post Único");
  const [quando, setQuando] = useState<Quando>("agora");
  const [legenda, setLegenda] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dataAgendada, setDataAgendada] = useState<Date | undefined>(undefined);
  const [horaAgendada, setHoraAgendada] = useState("09:00");


  const toggleNetwork = (n: Network) => {
    setNetworks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToUpload(file);
      setFileName(file.name);
      setImagem(URL.createObjectURL(file));
    }
  };

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (networks.length === 0) return toast.error("Escolha pelo menos uma rede.");
    if (!legenda.trim()) return toast.error("Escreva uma legenda primeiro.");
    if (!fileToUpload) return toast.error("Selecione uma imagem primeiro.");

    setSaving(true);
    const tId = "post-saving-toast";
    toast.loading(quando === "agora" ? "Publicando..." : "Agendando...", { id: tId });

    try {
      const publicUrl = await uploadPostImage(fileToUpload);
      const userId = await getAuthedUserId();
      if (!userId) throw new Error("Você precisa estar logado.");

      const tipoDb = formato === "Estilo X" ? "Carrossel" : formato;

      let dataAgendamentoIso: string | null = null;
      if (quando === "data") {
        if (!dataAgendada) throw new Error("Escolha uma data.");
        const [hh, mm] = horaAgendada.split(":").map(Number);
        const d = new Date(dataAgendada);
        d.setHours(hh || 9, mm || 0, 0, 0);
        if (d.getTime() < Date.now()) throw new Error("A data/hora deve ser no futuro.");
        dataAgendamentoIso = d.toISOString();
      }

      const { error: dbError } = await supabase.from("posts").insert({
        user_id: userId,
        tipo_post: tipoDb,
        legenda,
        url_imagem: publicUrl,
        postar_instagram: networks.includes("instagram"),
        postar_linkedin: networks.includes("linkedin"),
        status: quando === "agora" ? "Publicado" : "Agendado",
        data_agendamento: dataAgendamentoIso,
        estilo_layout: formato === "Estilo X" ? "Estilo X" : "Padrão",
      } as any);

      if (dbError) throw dbError;

      toast.success(quando === "agora" ? "Post publicado!" : "Post agendado!", { id: tId });
      setLegenda(""); setImagem(null); setFileToUpload(null); setFileName(null);
      setDataAgendada(undefined);
      onCreated();
    } catch (e: any) {
      console.error("Erro:", e);
      toast.error(e.message || "Falha ao salvar.", { id: tId });
    } finally {
      setSaving(false);
    }
  }, [legenda, fileToUpload, networks, formato, quando, saving, onCreated, dataAgendada, horaAgendada]);


  return (
    <Card className="p-6 space-y-6 max-w-4xl mx-auto border-zinc-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-zinc-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          Novo Post
        </h2>
        <p className="text-xs text-zinc-500">{BRANDING.nome} — {BRANDING.cro}</p>
      </div>

      <AiGenerationPanel onCreated={onCreated} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-zinc-400 uppercase tracking-wider">ou crie manualmente</span></div>
      </div>



      {/* Redes — botões separados com ícones e cores */}
      <div className="space-y-2">
        <Label>Publicar em</Label>
        <div className="grid grid-cols-2 gap-3">
          <NetworkButton
            active={networks.includes("instagram")}
            onClick={() => toggleNetwork("instagram")}
            icon={<Instagram className="w-5 h-5" />}
            label="Instagram"
            activeClass="bg-gradient-to-tr from-fuchsia-500 via-pink-500 to-orange-400 text-white border-transparent shadow-md"
          />
          <NetworkButton
            active={networks.includes("linkedin")}
            onClick={() => toggleNetwork("linkedin")}
            icon={<Linkedin className="w-5 h-5" />}
            label="LinkedIn"
            activeClass="bg-[#0a66c2] text-white border-transparent shadow-md"
          />
        </div>
      </div>

      {/* Formato — 3 botões */}
      <div className="space-y-2">
        <Label>Formato</Label>
        <div className="grid grid-cols-3 gap-3">
          {FORMATOS.map(({ id, label, icon: Icon, desc }) => {
            const active = formato === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFormato(id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 transition-all",
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                    : "border-zinc-200 hover:border-zinc-300 text-zinc-600",
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[10px] opacity-75">{desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quando — Postar agora, Agendar data ou Programar 7 dias */}
      <div className="space-y-2">
        <Label>Postar quando?</Label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setQuando("agora")}
            className={cn(
              "flex items-center gap-2 justify-center p-3 rounded-lg border-2 font-semibold transition-all",
              quando === "agora"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
            )}
          >
            <Zap className="w-4 h-4" /> Agora
          </button>
          <button
            type="button"
            onClick={() => setQuando("data")}
            className={cn(
              "flex items-center gap-2 justify-center p-3 rounded-lg border-2 font-semibold transition-all",
              quando === "data"
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
            )}
          >
            <CalendarIcon className="w-4 h-4" /> Escolher data
          </button>
          <button
            type="button"
            onClick={() => setQuando("7dias")}
            className={cn(
              "flex items-center gap-2 justify-center p-3 rounded-lg border-2 font-semibold transition-all",
              quando === "7dias"
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
            )}
          >
            <Clock className="w-4 h-4" /> Próximos 7 dias
          </button>
        </div>

        {quando === "data" && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal min-w-[220px]",
                    !dataAgendada && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dataAgendada
                    ? format(dataAgendada, "PPP", { locale: ptBR })
                    : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataAgendada}
                  onSelect={setDataAgendada}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={horaAgendada}
              onChange={(e) => setHoraAgendada(e.target.value)}
              className="w-[130px]"
            />
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Legenda</Label>
            <Textarea
              placeholder="Digite sua legenda..."
              className="min-h-[150px] resize-none"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
            />
            <p className="text-[11px] text-zinc-500 flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> CTA padrão: <span className="font-medium">{BRANDING.ctaInstagram}</span> · WhatsApp {BRANDING.whatsappNumero}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mídia</Label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:bg-zinc-50 transition-colors">
              <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
              <p className="text-sm text-zinc-500">Selecionar imagem</p>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
            {fileName && (
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> {fileName}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 border-l pl-6 border-zinc-100">
          <Label>Prévia</Label>
          <div className="aspect-square w-full rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50 flex items-center justify-center relative">
            {imagem ? (
              <>
                <img src={imagem} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">
                  {BRANDING.nome} — {BRANDING.cro}
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-12 h-12 text-zinc-200 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Preview da imagem</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
        <Button variant="outline" onClick={() => onCreated()}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} className="min-w-[180px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {quando === "agora" ? "Publicar Agora" : "Agendar"}
        </Button>
      </div>
    </Card>
  );
}

function AiGenerationPanel({ onCreated }: { onCreated: () => void }) {
  const [tema, setTema] = useState("");
  const [especialidade, setEspecialidade] = useState<"CTBMF" | "Odontologia Hospitalar" | "Ambas">("CTBMF");
  const [rede, setRede] = useState<"instagram" | "linkedin" | "estilo-x">("instagram");
  const [inserirLogo, setInserirLogo] = useState(true);
  const [modelo, setModelo] = useState<ModeloIA>("google/gemini-3-flash-preview");
  const [modeloImagem, setModeloImagem] = useState<ModeloImagem>("google/gemini-3.1-flash-image-preview");
  const [ambasRedes, setAmbasRedes] = useState(false);
  const [busy, setBusy] = useState<null | "single" | "week">(null);
  const [temas, setTemas] = useState<Array<{ dia: number; rede: string; tipo?: string; formato?: string; quando?: string; tema: string; gancho: string }> | null>(null);
  const [preview, setPreview] = useState<{ id: string; legenda: string; urls: string[] } | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [discarding, setDiscarding] = useState(false);
  const genSingle = useServerFn(generateSinglePost);
  const genWeek = useServerFn(generateWeekThemes);
  const discardFn = useServerFn(discardPost);
  const approveFn = useServerFn(approvePost);
  const [approving, setApproving] = useState<null | "arquivar" | "agendar" | "publicar">(null);


  const handleSingle = async () => {
    const temaTrim = tema.trim();
    setBusy("single");
    const tid = "ai-single";
    toast.loading(temaTrim ? "IA criando legenda + imagem..." : "IA escolhendo tema, legenda e imagem...", { id: tid });
    try {
      const out = await genSingle({ data: { tema: temaTrim, especialidade, rede, inserirLogo, modelo, modeloImagem, ambasRedes } });
      toast.success("Pré-visualize abaixo antes de publicar.", { id: tid });
      setTema("");
      setPreviewIdx(0);
      setPreview({ id: out.id, legenda: out.legenda, urls: out.urls });
      // Não chama onCreated() — post fica pendente até aprovação/descarte no preview.
    } catch (e: any) {
      toast.error(e.message || "Falha na geração.", { id: tid });
    } finally {
      setBusy(null);
    }
  };

  const handleWeek = async () => {
    setBusy("week");
    const tid = "ai-week";
    toast.loading("IA planejando 7 dias (cronograma fixo)...", { id: tid });
    try {
      const out = await genWeek({ data: { especialidade, modelo } });
      setTemas(out.temas as any);
      toast.success(`${out.temas.length} slots gerados. Aprove para criar imagem + agendar.`, { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Falha no cronograma.", { id: tid });
    } finally {
      setBusy(null);
    }
  };

  const approveTheme = async (t: { rede: string; tipo?: string; formato?: string; quando?: string; tema: string }) => {
    const r = (t.rede === "linkedin" ? "linkedin" : t.rede === "estilo-x" ? "estilo-x" : "instagram") as
      | "instagram" | "linkedin" | "estilo-x";
    const tid = `ai-approve-${t.tema}`;
    toast.loading(`Gerando: ${t.tema.slice(0, 40)}...`, { id: tid });
    try {
      const out = await genSingle({ data: { tema: t.tema, especialidade, rede: r, tipo: t.tipo as any, formato: t.formato as any, quando: t.quando, inserirLogo, modelo, modeloImagem, ambasRedes } });
      toast.success(t.quando ? "Agendado! Pré-visualize abaixo." : "Gerado! Pré-visualize abaixo.", { id: tid });
      setTemas((prev) => prev?.filter((x) => x.tema !== t.tema) ?? null);
      setPreviewIdx(0);
      setPreview({ id: out.id, legenda: out.legenda, urls: out.urls });
      // Não chama onCreated() — fica pendente até aprovação no preview.
    } catch (e: any) {
      toast.error(e.message || "Falha", { id: tid });
    }
  };

  const approveAll = async () => {
    if (!temas) return;
    setBusy("week");
    for (const t of temas) {
      // sequencial para não estourar rate-limit de imagem
      // eslint-disable-next-line no-await-in-loop
      await approveTheme(t);
    }
    setBusy(null);
  };

  return (
    <Card className="p-5 space-y-4 border-2 border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-cyan-50/30">
      <div className="flex items-center gap-2">
        <Wand2 className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-indigo-900">Gerar com IA</h3>
        <span className="text-xs text-indigo-600/70">Gemini + GPT-image-2 · estilo médico premium</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Tema do post <span className="text-zinc-400 font-normal">(opcional — deixe em branco para a IA escolher)</span></Label>
          <Input
            placeholder="Ex.: Dor do siso que irradia para o ouvido — ou deixe vazio"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Especialidade</Label>
          <select
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value as any)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option>CTBMF</option>
            <option>Odontologia Hospitalar</option>
            <option>Ambas</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["instagram", "linkedin", "estilo-x"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRede(r)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5",
              rede === r ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-zinc-200 text-zinc-600",
            )}
          >
            {r === "instagram" && <Instagram className="w-3.5 h-3.5" />}
            {r === "linkedin" && <Linkedin className="w-3.5 h-3.5" />}
            {r === "estilo-x" && <XStyleIcon className="w-3.5 h-3.5" />}
            {r === "estilo-x" ? "Estilo X" : r === "linkedin" ? "LinkedIn" : "Instagram"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Inserir logo Planner Chico nos criativos?</Label>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          <button
            type="button"
            onClick={() => setInserirLogo(true)}
            className={cn(
              "flex items-center gap-1.5 justify-center px-3 py-2 rounded-md border-2 font-semibold text-sm transition-all",
              inserirLogo
                ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white",
            )}
          >
            <Check className="w-3.5 h-3.5" /> Sim, com logo
          </button>
          <button
            type="button"
            onClick={() => setInserirLogo(false)}
            className={cn(
              "flex items-center gap-1.5 justify-center px-3 py-2 rounded-md border-2 font-semibold text-sm transition-all",
              !inserirLogo
                ? "border-zinc-500 bg-zinc-700 text-white shadow-sm"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white",
            )}
          >
            Sem logo
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Modelo de IA (texto)</Label>
        <div className="flex flex-wrap gap-2">
          {MODELOS_IA.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModelo(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold border transition-all",
                modelo === m.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          Modelo de texto para legenda/tema. Imagem é configurada abaixo.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Modelo de IA (imagem)</Label>
        <div className="flex flex-wrap gap-2">
          {MODELOS_IMAGEM.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeloImagem(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold border transition-all",
                modeloImagem === m.id
                  ? "bg-fuchsia-600 text-white border-fuchsia-600 shadow-sm"
                  : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          Nano Banana é até 5x mais rápido que GPT-image-2. Use GPT-image-2 só para criativos finais premium.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Publicar em</Label>
        <button
          type="button"
          onClick={() => setAmbasRedes((v) => !v)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border-2 font-semibold text-sm transition-all",
            ambasRedes
              ? "border-emerald-500 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-[#0a66c2] text-white shadow-sm"
              : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white",
          )}
        >
          <Instagram className="w-4 h-4" /> + <Linkedin className="w-4 h-4" />
          {ambasRedes ? "Publicando em AMBAS as redes" : "Postar em Instagram E LinkedIn ao mesmo tempo"}
          {ambasRedes && <Check className="w-4 h-4" />}
        </button>
      </div>






      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        <Button
          onClick={handleSingle}
          disabled={busy !== null}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {busy === "single" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
          {tema.trim() ? "Gerar 1 post (legenda + imagem)" : "IA escolhe tema + gera tudo"}
        </Button>
        <Button
          onClick={handleWeek}
          disabled={busy !== null}
          variant="outline"
          className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
        >
          {busy === "week" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarDays className="w-4 h-4 mr-2" />}
          Programar 7 dias com IA
        </Button>
      </div>
      <p className="text-[11px] text-indigo-700/80 bg-indigo-50/60 rounded-md p-2 leading-relaxed">
        <strong>Cronograma fixo (seg-sáb):</strong> IG feed 09h / 15h / 19h · IG stories 08h / 13h / 17h · LinkedIn 09h e 17h30.
        <br />
        <strong>Domingo:</strong> mensagem especial automática (IG 10h + story 9h · LinkedIn 11h).
      </p>

      {temas && temas.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-indigo-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-900">
              {temas.length} slots no cronograma fixo — aprove para gerar imagem + agendar:
            </p>
            <Button size="sm" variant="default" onClick={approveAll} disabled={busy !== null} className="bg-emerald-600 hover:bg-emerald-700">
              {busy === "week" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Aprovar tudo
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1.5">
            {temas.map((t) => {
              const dt = t.quando ? new Date(t.quando) : null;
              const dow = dt ? ["dom","seg","ter","qua","qui","sex","sáb"][dt.getDay()] : "";
              const hhmm = dt ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}` : "";
              return (
                <div key={`${t.dia}-${t.tema}`} className="flex items-start gap-2 p-2 bg-white rounded-md border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 w-20 leading-tight uppercase">
                    {dow} {hhmm}<br />
                    <span className="text-zinc-500 font-medium normal-case">{t.rede} {t.tipo}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.tema}</p>
                    <p className="text-xs text-zinc-500 truncate">{t.gancho}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => approveTheme(t)}>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do post</DialogTitle>
            <DialogDescription>
              Confira a legenda e {preview && preview.urls.length > 1 ? `os ${preview.urls.length} cards` : "a imagem"} antes de publicar. Você pode descartar e gerar novamente.
            </DialogDescription>
          </DialogHeader>
          {preview && (() => {
            const total = preview.urls.length;
            const safeIdx = Math.min(previewIdx, total - 1);
            const goPrev = () => setPreviewIdx((i) => (Math.min(i, total - 1) - 1 + total) % total);
            const goNext = () => setPreviewIdx((i) => (Math.min(i, total - 1) + 1) % total);
            return (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="relative rounded-md overflow-hidden border bg-zinc-100 aspect-square">
                    <img src={preview.urls[safeIdx]} alt={`slide ${safeIdx + 1}`} className="w-full h-full object-contain" />
                    <span className="absolute top-2 left-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded">
                      {safeIdx + 1}/{total}
                    </span>
                    {total > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={goPrev}
                          aria-label="Slide anterior"
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          aria-label="Próximo slide"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {preview.urls.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPreviewIdx(i)}
                              aria-label={`Ir para slide ${i + 1}`}
                              className={`h-2 w-2 rounded-full transition ${i === safeIdx ? "bg-white" : "bg-white/50 hover:bg-white/80"}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {total > 1 && (
                    <div className="grid grid-cols-5 gap-1.5">
                      {preview.urls.map((u, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreviewIdx(i)}
                          className={`relative rounded overflow-hidden border-2 transition ${i === safeIdx ? "border-indigo-500" : "border-transparent opacity-70 hover:opacity-100"}`}
                        >
                          <img src={u} alt={`miniatura ${i + 1}`} className="w-full h-full object-cover aspect-square" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Legenda</Label>
                  <Textarea value={preview.legenda} readOnly rows={14} className="text-sm resize-none" />
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            <Button
              variant="destructive"
              disabled={discarding || approving !== null}
              onClick={async () => {
                if (!preview) return;
                setDiscarding(true);
                try {
                  await discardFn({ data: { id: preview.id } });
                  toast.success("Post descartado.");
                  setPreview(null);
                } catch (e: any) {
                  toast.error(e.message || "Falha ao descartar.");
                } finally {
                  setDiscarding(false);
                }
              }}
            >
              {discarding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Descartar
            </Button>
            {(["arquivar", "agendar", "publicar"] as const).map((acao) => (
              <Button
                key={acao}
                disabled={discarding || approving !== null}
                onClick={async () => {
                  if (!preview) return;
                  setApproving(acao);
                  try {
                    await approveFn({ data: { id: preview.id, acao } });
                    toast.success(
                      acao === "publicar" ? "Publicado!" : acao === "agendar" ? "Agendado!" : "Arquivado em Rascunho.",
                    );
                    setPreview(null);
                    onCreated();
                  } catch (e: any) {
                    toast.error(e.message || "Falha ao aprovar.");
                  } finally {
                    setApproving(null);
                  }
                }}
                className={
                  acao === "publicar"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : acao === "agendar"
                      ? "bg-violet-600 hover:bg-violet-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                }
              >
                {approving === acao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {acao === "arquivar" ? "Arquivar (rascunho)" : acao === "agendar" ? "Agendar" : "Publicar agora"}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

  );
}


function NetworkButton({
  active, onClick, icon, label, activeClass,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; activeClass: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 p-3 rounded-lg border-2 font-semibold transition-all",
        active ? activeClass : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white",
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <Check className="w-4 h-4" />}
    </button>
  );
}
