import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Instagram, Loader2, Trash2, CalendarClock, Wand2, Zap, CalendarDays, Check, X, Image as ImageIcon, Layers, Film, RotateCcw, ScanEye, Copy, ExternalLink, Download } from "lucide-react";
import { LogoPreviewDialog } from "@/components/LogoPreviewDialog";
import { toast } from "sonner";
import { uploadPostImage } from "@/lib/storage-utils";
import { getAuthedUserId } from "@/lib/auth-utils";
import { signPostMediaUrls } from "@/lib/storage-url";
import { generateSinglePost, generateWeekThemes, approvePost, discardPost, MODELOS_IA, MODELOS_IMAGEM } from "@/lib/ai-post.functions";
import { cn } from "@/lib/utils";

type ModeloIA = (typeof MODELOS_IA)[number]["id"];
type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];
import { publishInstagramNow } from "@/lib/social/instagram-publish.functions";
import { ensurePublicationDestinationProfile, getPublicationDestination, saveManualInstagramToken, savePublicationDestination } from "@/lib/publication-destination.functions";
import type { PostRow } from "@/lib/posts-types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createInstagramOAuthStartUrl, createMetaOAuthStartUrl } from "@/lib/meta-oauth.functions";

const ACCOUNT_KEY = "planner_simplificado_conta_v1";
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";
type Quando = "agora" | "data" | "7dias";
type Modo = "feed" | "carrossel" | "stories" | "semana";

interface PlannerSimplificadoProps {
  contaFixa?: string;        // se setado, trava a conta (sem seletor)
  storageKey?: string;       // chave alternativa do localStorage
  audiencia?: "estudantes-graduacao" | "geral" | "chico-drfm";
}

export function PlannerSimplificado({ contaFixa, storageKey, audiencia = "estudantes-graduacao" }: PlannerSimplificadoProps = {}) {
  const genSingle = useServerFn(generateSinglePost);
  const genWeek = useServerFn(generateWeekThemes);
  const approveFn = useServerFn(approvePost);
  const discardFn = useServerFn(discardPost);
  const publishIg = useServerFn(publishInstagramNow);
  const fetchDestino = useServerFn(getPublicationDestination);
  const saveDestino = useServerFn(savePublicationDestination);
  const saveManualToken = useServerFn(saveManualInstagramToken);
  const ensureDestino = useServerFn(ensurePublicationDestinationProfile);
  const startMetaOAuth = useServerFn(createMetaOAuthStartUrl);
  const startInstagramOAuth = useServerFn(createInstagramOAuthStartUrl);

  const [conta, setConta] = useState<string>("");
  const [contaInput, setContaInput] = useState<string>("");
  const [destinoUrl, setDestinoUrl] = useState<string>("");
  const [destinoStatus, setDestinoStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [destinoModo, setDestinoModo] = useState<"meta" | "webhook" | "missing">("missing");
  const [savingDestino, setSavingDestino] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [metaConnectPath, setMetaConnectPath] = useState<string>("");
  const [metaOauthUrl, setMetaOauthUrl] = useState<string>("");
  const [copiedMetaUrl, setCopiedMetaUrl] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualIgId, setManualIgId] = useState("");
  const [savingManualToken, setSavingManualToken] = useState(false);


  // Geração IA
  const [modo, setModo] = useState<Modo>("feed");
  const [modelo, setModelo] = useState<ModeloIA>("groq/llama-3.3-70b-versatile");
  const [modeloImagem, setModeloImagem] = useState<ModeloImagem>("pollinations/flux");
  const [tema, setTema] = useState("");
  const [quando, setQuando] = useState<Quando>("agora");
  const [data, setData] = useState<string>("");
  const [hora, setHora] = useState<string>("09:00");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; legenda: string; urls: string[] } | null>(null);
  const [temas, setTemas] = useState<Array<{ rede: string; tipo?: string; formato?: string; quando?: string; tema: string; gancho: string }> | null>(null);

  // Manual
  const [legenda, setLegenda] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);

  const lsKey = storageKey ?? ACCOUNT_KEY;
  const isLiga = conta === LIGA_ACCOUNT;
  const canPublishAutomatically = destinoStatus === "ok" && !isLiga;

  useEffect(() => {
    if (contaFixa) { setConta(contaFixa); setContaInput(contaFixa); return; }
    try {
      const c = window.localStorage.getItem(lsKey) || "";
      setConta(c); setContaInput(c);
    } catch { /* ignore */ }
  }, [contaFixa, lsKey]);

  const normalize = (v: string) => v.trim().replace(/^@+/, "").toLowerCase();

  const salvarConta = () => {
    const n = normalize(contaInput);
    if (!n) return toast.error("Informe o @ da conta.");
    setConta(n);
    try { window.localStorage.setItem(lsKey, n); } catch { /* ignore */ }
    toast.success(`Conta @${n} selecionada.`);
  };

  // Carrega destino (webhook/token Meta) configurado para esta conta
  useEffect(() => {
    if (!conta) { setDestinoStatus("missing"); setDestinoModo("missing"); setDestinoUrl(""); return; }
    setDestinoStatus("loading");
    (async () => {
      try {
        const destino = await fetchDestino({ data: { conta } });
        setDestinoUrl(destino.webhookUrl);
        setDestinoStatus(destino.status);
        setDestinoModo(destino.mode);
      } catch (e: any) {
        setDestinoUrl("");
        setDestinoStatus("missing");
        setDestinoModo("missing");
        toast.error(e.message || "Erro ao carregar destino.");
      }
    })();
  }, [conta, fetchDestino]);

  const salvarDestino = async () => {
    if (!conta) return toast.error("Selecione uma conta primeiro.");
    const url = destinoUrl.trim();
    if (!/^https?:\/\//i.test(url)) return toast.error("Cole uma URL de webhook válida (https://...).");
    setSavingDestino(true);
    try {
      const destino = await saveDestino({ data: { conta, webhookUrl: url } });
      setDestinoUrl(destino.webhookUrl);
      setDestinoStatus(destino.status);
      toast.success(`Destino salvo para @${conta}.`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar destino.");
    } finally { setSavingDestino(false); }
  };

  const conectarMetaConta = async () => {
    if (!conta) return toast.error("Selecione uma conta primeiro.");
    try {
      const destino = await ensureDestino({ data: { conta } });
      const trocarFacebook = conta === LIGA_ACCOUNT;
      const r = trocarFacebook
        ? await startInstagramOAuth({ data: { perfilId: destino.id, targetAccount: conta } })
        : await startMetaOAuth({ data: { perfilId: destino.id, targetAccount: conta } });
      const manualUrl = r.url;
      setMetaOauthUrl(manualUrl);
      setMetaConnectPath(`/meta-connect?account=${encodeURIComponent(conta)}&next=${encodeURIComponent(r.url)}`);
      toast.info(trocarFacebook ? "Clique em 'Abrir conexão Instagram' para entrar direto na conta da Liga." : "Clique no botão 'Abrir conexão Meta' que apareceu abaixo.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao iniciar conexão Meta.");
    }
  };

  const copiarMetaOAuthUrl = async () => {
    if (!metaOauthUrl) return toast.error("Prepare a conexão Meta primeiro.");
    try {
      await navigator.clipboard.writeText(metaOauthUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = metaOauthUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedMetaUrl(true);
    window.setTimeout(() => setCopiedMetaUrl(false), 1800);
    toast.success("Link Meta copiado. Cole na barra do navegador fora do preview.");
  };

  const salvarTokenManual = async () => {
    if (!conta) return toast.error("Selecione uma conta primeiro.");
    const token = manualToken.trim();
    const igBusinessId = manualIgId.trim();
    if (!token || !igBusinessId) return toast.error("Cole o Access Token e o IG Business Account ID.");
    setSavingManualToken(true);
    try {
      await saveManualToken({ data: { conta, accessToken: token, igBusinessId } });
      setDestinoStatus("ok");
      setDestinoModo("meta");
      setManualToken("");
      toast.success(`Token manual salvo para @${conta}.`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar token manual.");
    } finally {
      setSavingManualToken(false);
    }
  };

  const assertPublishOk = (out: Awaited<ReturnType<typeof publishIg>>) => {
    if (out && "ok" in out && out.ok === false) {
      throw new Error("error" in out ? out.error : "Falha ao publicar no Instagram.");
    }
  };

  const publishSuccessMessage = (out: Awaited<ReturnType<typeof publishIg>>) => {
    if (out && "via" in out && out.via === "meta") return "Publicado diretamente no Instagram.";
    return "Enviado ao webhook próprio da conta. Confira a execução antes de considerar publicado.";
  };

  const baixarMidia = async (url: string, nome: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Não foi possível baixar a imagem.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast.error(e.message || "Falha ao baixar.");
    }
  };

  const copiarTexto = async (texto: string, mensagem = "Texto copiado.") => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    toast.success(mensagem);
  };


  const carregar = useCallback(async () => {
    if (!conta) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("posts").select("*")
      .eq("instagram_conta", conta)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro ao carregar posts.");
    else if (data) {
      const signed = await Promise.all((data as unknown as PostRow[]).map(signPostMediaUrls));
      setPosts(signed as PostRow[]);
    }
    setLoading(false);
  }, [conta]);

  useEffect(() => { carregar(); }, [carregar]);

  const buildAgendamentoIso = (): string | undefined => {
    if (quando !== "data") return undefined;
    if (!data) throw new Error("Escolha uma data.");
    const [hh, mm] = hora.split(":").map(Number);
    const d = new Date(data);
    d.setHours(hh || 9, mm || 0, 0, 0);
    if (d.getTime() < Date.now()) throw new Error("A data/hora deve estar no futuro.");
    return d.toISOString();
  };

  const marcarConta = async (postId: string) => {
    await supabase.from("posts").update({ instagram_conta: conta } as any).eq("id", postId);
  };

  const handleGerar = async () => {
    if (!conta) return toast.error("Selecione uma conta do Instagram.");
    setBusy(true);
    const tid = "ai-simple";
    const labelModo = modo === "carrossel" ? "carrossel" : modo === "stories" ? "story" : "post de feed";
    toast.loading(`IA criando ${labelModo}...`, { id: tid });
    try {
      const iso = buildAgendamentoIso();
      const tipo = modo === "stories" ? "stories" : "feed";
      const formato = modo === "carrossel" ? "Carrossel" : modo === "stories" ? "Story" : "Post Único";
      const out = await genSingle({ data: {
        tema: tema.trim(),
        especialidade: "CTBMF",
        rede: "instagram",
        tipo,
        formato,
        quando: iso,
        ambasRedes: false,
        audiencia,
        modelo,
        modeloImagem,
      } as any });
      await marcarConta(out.id);
      setPreview({ id: out.id, legenda: out.legenda, urls: out.urls });
      setTema("");
      toast.success("Pré-visualize abaixo.", { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Falha na geração.", { id: tid });
    } finally { setBusy(false); }
  };

  const handleSemana = async () => {
    if (!conta) return toast.error("Selecione uma conta do Instagram.");
    setBusy(true);
    const tid = "ai-week-simple";
    toast.loading("IA planejando 7 dias...", { id: tid });
    try {
      const out = await genWeek({ data: { especialidade: "CTBMF", modelo } as any });
      // Filtra apenas slots do Instagram para a conta simplificada
      const igOnly = (out.temas as any[]).filter((t) => t.rede === "instagram" || t.rede === "estilo-x");
      setTemas(igOnly);
      toast.success(`${igOnly.length} temas para Instagram. Aprove para gerar.`, { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Falha no cronograma.", { id: tid });
    } finally { setBusy(false); }
  };

  const aprovarTema = async (t: { rede: string; tipo?: string; formato?: string; quando?: string; tema: string }) => {
    const tid = `aprov-${t.tema}`;
    toast.loading(`Gerando: ${t.tema.slice(0, 40)}...`, { id: tid });
    try {
      const out = await genSingle({ data: {
        tema: t.tema, especialidade: "CTBMF",
        rede: (t.rede === "estilo-x" ? "estilo-x" : "instagram") as any,
        tipo: t.tipo as any, formato: t.formato as any, quando: t.quando,
        ambasRedes: false,
        audiencia,
        modelo,
        modeloImagem,
      } as any });
      await marcarConta(out.id);
      await approveFn({ data: { id: out.id, acao: "agendar" } });
      setTemas((prev) => prev?.filter((x) => x.tema !== t.tema) ?? null);
      toast.success("Agendado!", { id: tid });
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Falha", { id: tid });
    }
  };

  const decidirPreview = async (acao: "publicar" | "agendar" | "arquivar") => {
    if (!preview) return;
    const tid = "preview-decide";
    toast.loading(acao === "publicar" ? "Publicando..." : "Salvando...", { id: tid });
    try {
      if (acao === "publicar") {
        if (!canPublishAutomatically) {
          await approveFn({ data: { id: preview.id, acao: "arquivar" } });
          await copiarTexto(preview.legenda, "Legenda copiada para publicar manualmente.");
          toast.success(isLiga ? "Liga em modo manual: salvei o post e copiei a legenda." : "Sem conexão ativa: salvei o post e deixei pronto para publicação manual.", { id: tid });
          setPreview(null);
          carregar();
          return;
        }
        await approveFn({ data: { id: preview.id, acao: "arquivar" } });
        const out = await publishIg({ data: { id: preview.id } });
        assertPublishOk(out);
        toast.success(publishSuccessMessage(out), { id: tid });
      } else {
        await approveFn({ data: { id: preview.id, acao } });
        toast.success("Salvo!", { id: tid });
      }
      setPreview(null);
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Falha", { id: tid });
    }
  };

  const descartarPreview = async () => {
    if (!preview) return;
    try { await discardFn({ data: { id: preview.id } }); } catch { /* ignore */ }
    setPreview(null);
    toast.success("Descartado.");
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreviewImg(URL.createObjectURL(f)); }
  };

  const salvarManual = async () => {
    if (!conta) return toast.error("Selecione uma conta do Instagram.");
    if (!legenda.trim()) return toast.error("Escreva uma legenda.");
    if (!file) return toast.error("Selecione uma imagem.");
    setSavingManual(true);
    try {
      const uid = await getAuthedUserId();
      if (!uid) throw new Error("Você precisa estar logado.");
      const url = await uploadPostImage(file, uid);
      const iso = buildAgendamentoIso();
      const shouldAutoPublish = quando === "agora" && canPublishAutomatically;
      const status = shouldAutoPublish ? "Agendado" : quando === "agora" ? "Arquivado" : "Agendado";
      const { data: ins, error } = await supabase.from("posts").insert({
        user_id: uid, tipo_post: "Post Único",
        legenda, url_imagem: url,
        postar_instagram: true, postar_linkedin: false,
        status, data_agendamento: iso ?? null,
        estilo_layout: "Padrão", instagram_conta: conta,
      } as any).select("id").single();
      if (error) throw error;
      if (shouldAutoPublish && ins?.id) {
        const out = await publishIg({ data: { id: ins.id } });
        assertPublishOk(out);
        toast.success(publishSuccessMessage(out));
      } else if (quando === "agora") {
        await copiarTexto(legenda, "Legenda copiada para publicar manualmente.");
        toast.success(isLiga ? "Liga em modo manual: post salvo, imagem pronta para baixar e legenda copiada." : "Post salvo para publicação manual.");
      } else {
        toast.success("Post agendado!");
      }
      setLegenda(""); setFile(null); setPreviewImg(null);
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar.");
    } finally { setSavingManual(false); }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído."); carregar(); }
  };

  const tentarNovamente = async (id: string) => {
    setBusy(true);
    const tid = `retry-${id}`;
    toast.loading("Tentando publicar novamente...", { id: tid });
    try {
      const out = await publishIg({ data: { id } });
      assertPublishOk(out);
      toast.success(publishSuccessMessage(out), { id: tid });
      carregar();
    } catch (e: any) {
      toast.error(e.message || "Falha na re-tentativa.", { id: tid });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="p-5 space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Instagram className="w-4 h-4" /> Conta do Instagram
        </Label>
        {contaFixa ? (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">Conta fixa: <Badge variant="secondary">@{contaFixa}</Badge></div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
                <Input value={contaInput} onChange={(e) => setContaInput(e.target.value)} placeholder="minha_nova_conta" className="pl-7" />
              </div>
              <Button onClick={salvarConta}>Usar esta conta</Button>
            </div>
            {conta && <div className="text-xs text-zinc-500 flex items-center gap-1.5">Filtro ativo: <Badge variant="secondary">@{conta}</Badge></div>}
          </>
        )}
      </Card>

      {conta && (
        <Card className={`p-5 space-y-3 border-2 ${!isLiga && destinoStatus === "ok" ? "border-emerald-200 bg-emerald-50/30" : "border-amber-300 bg-amber-50/40"}`}>
          <Label className="text-sm font-semibold flex items-center gap-2">
            Destino de publicação de @{conta}
            {isLiga && <Badge className="bg-amber-600">Manual seguro</Badge>}
            {!isLiga && destinoStatus === "ok" && <Badge className="bg-emerald-600">Configurado</Badge>}
            {!isLiga && destinoStatus === "missing" && <Badge variant="destructive">Não configurado</Badge>}
          </Label>
          {isLiga ? (
            <div className="rounded-md border border-amber-200 bg-white/80 p-3 text-xs text-amber-950 space-y-1">
              <p className="font-semibold">Modo manual obrigatório para a Liga:</p>
              <p>como a conexão Facebook/Make não está funcionando, o app não tentará publicar automaticamente. Ele salva o criativo, copia a legenda e libera o download da imagem para postar diretamente no Instagram @lactbmf.anhanguerasbo.</p>
              <p className="font-semibold">Isso evita qualquer envio para @drfranciscomenezes.</p>
            </div>
          ) : destinoStatus === "missing" && (
            <p className="text-xs text-amber-900">
              ⚠️ Sem destino próprio para esta conta, a publicação será bloqueada para evitar envio para outro Instagram.
              {` Conecte a Meta oficial ou cadastre um webhook próprio de @${conta}.`}
            </p>
          )}
          {!isLiga && destinoStatus === "missing" && (
            <div className="rounded-md border border-amber-200 bg-white/70 p-3 text-xs text-amber-950 space-y-1">
              <p className="font-semibold">Modo seguro sem conexão:</p>
              <p>ao aprovar, o app salva o post, copia a legenda e libera o download da imagem para publicar manualmente no Instagram correto.</p>
            </div>
          )}
          {!isLiga && destinoModo === "meta" && (
            <p className="text-xs text-emerald-800">Publicação direta Meta ativa para @{conta}. O Make não será usado.</p>
          )}
          {!isLiga && destinoModo === "webhook" && (
            <p className="text-xs text-emerald-800">Webhook exclusivo ativo para @{conta}. O app enviará sempre com a conta de destino obrigatória.</p>
          )}
          {!isLiga && <div className="flex flex-wrap gap-2">
            <Button onClick={conectarMetaConta} variant="secondary">
              <Instagram className="w-4 h-4 mr-1" /> {`Preparar conexão Meta @${conta}`}
            </Button>
            {metaConnectPath && (
              <Button asChild variant="outline">
                <a href={metaConnectPath} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Abrir conexão Meta
                </a>
              </Button>
            )}
            {metaOauthUrl && (
              <Button type="button" variant="outline" onClick={copiarMetaOAuthUrl}>
                {copiedMetaUrl ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedMetaUrl ? "Link copiado" : "Copiar link Meta"}
              </Button>
            )}
          </div>}
          {metaConnectPath && (
            <p className="text-xs text-zinc-600">
              Se o navegador bloquear a abertura, use “Copiar link Meta” e cole o link diretamente na barra do navegador, fora do preview.
            </p>
          )}
          {!isLiga && <div className="flex gap-2">
            <Input
              value={destinoUrl}
              onChange={(e) => setDestinoUrl(e.target.value)}
              placeholder="https://hook.us2.make.com/..."
              className="flex-1"
            />
            <Button onClick={salvarDestino} disabled={savingDestino}>
              {savingDestino ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar destino"}
            </Button>
          </div>}
        </Card>
      )}

      {conta && (
        <>

          {/* Módulo de post */}
          <Card className="p-5 space-y-3">
            <Label className="text-sm font-semibold">Módulo</Label>
            <div className="grid grid-cols-4 gap-2">
              <QuandoBtn active={modo === "feed"} onClick={() => setModo("feed")} icon={<ImageIcon className="w-4 h-4" />} label="Feed" />
              <QuandoBtn active={modo === "carrossel"} onClick={() => setModo("carrossel")} icon={<Layers className="w-4 h-4" />} label="Carrossel" />
              <QuandoBtn active={modo === "stories"} onClick={() => setModo("stories")} icon={<Film className="w-4 h-4" />} label="Stories" />
              <QuandoBtn active={modo === "semana"} onClick={() => { setModo("semana"); setQuando("7dias"); }} icon={<CalendarDays className="w-4 h-4" />} label="7 dias" />
            </div>
          </Card>

          {/* Bloco Quando — usado por IA e manual (oculto no modo semana) */}
          {modo !== "semana" && (
            <Card className="p-5 space-y-3">
              <Label className="text-sm font-semibold">Quando publicar</Label>
              <div className="grid grid-cols-2 gap-2">
                <QuandoBtn active={quando === "agora"} onClick={() => setQuando("agora")} icon={<Zap className="w-4 h-4" />} label="Agora" />
                <QuandoBtn active={quando === "data"} onClick={() => setQuando("data")} icon={<CalendarClock className="w-4 h-4" />} label="Calendário" />
              </div>
              {quando === "data" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              )}
            </Card>
          )}

          {/* IA */}
          <Card className="p-5 space-y-4 border-2 border-dashed border-indigo-200 bg-indigo-50/30">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">
                Gerar com IA — {modo === "feed" ? "Post de Feed" : modo === "carrossel" ? "Carrossel" : modo === "stories" ? "Stories" : "Programação 7 dias"}
              </h3>
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
            </div>
            {modo !== "semana" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Tema (opcional — deixe vazio para a IA escolher)</Label>
                  <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: cirurgia de siso, ATM, bruxismo..." />
                </div>
                <Button onClick={handleGerar} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  IA criar {modo === "carrossel" ? "carrossel" : modo === "stories" ? "story" : "post"} {quando === "agora" ? "(publicar após aprovar)" : "(agendar após aprovar)"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-indigo-800">A IA monta um cronograma fixo de 7 dias só para Instagram.</p>
                <Button onClick={handleSemana} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarDays className="w-4 h-4 mr-2" />}
                  Gerar 7 dias com IA
                </Button>
                {temas && temas.length > 0 && (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {temas.map((t) => {
                      const dt = t.quando ? new Date(t.quando) : null;
                      const dow = dt ? ["dom","seg","ter","qua","qui","sex","sáb"][dt.getDay()] : "";
                      const hhmm = dt ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}` : "";
                      return (
                        <div key={t.tema} className="flex items-start gap-2 p-2 bg-white rounded-md border border-indigo-100">
                          <span className="text-[10px] font-bold text-indigo-600 w-16 uppercase">{dow} {hhmm}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.tema}</p>
                            <p className="text-xs text-zinc-500 truncate">{t.gancho}</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => aprovarTema(t)}>
                            <Check className="w-4 h-4 text-emerald-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Card>


          {/* Preview da IA */}
          {preview && (
            <Card className="p-5 space-y-3 border-2 border-emerald-200 bg-emerald-50/30">
              <h3 className="font-semibold text-emerald-900">Pré-visualização</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {preview.urls[0] && <img src={preview.urls[0]} alt="" className="rounded-md w-full object-cover" />}
                <Textarea value={preview.legenda} readOnly rows={8} className="text-xs" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {quando === "agora" ? (
                  <Button onClick={() => decidirPreview("publicar")} className="bg-emerald-600 hover:bg-emerald-700 col-span-2">
                    <Zap className="w-4 h-4 mr-1" /> {canPublishAutomatically ? "Publicar agora" : "Salvar para postar manual"}
                  </Button>
                ) : (
                  <Button onClick={() => decidirPreview("agendar")} className="bg-emerald-600 hover:bg-emerald-700 col-span-2">
                    <CalendarClock className="w-4 h-4 mr-1" /> Agendar
                  </Button>
                )}
                <Button variant="outline" onClick={descartarPreview}>
                  <X className="w-4 h-4 mr-1" /> Descartar
                </Button>
              </div>
              {!canPublishAutomatically && (
                <div className="rounded-md border border-amber-200 bg-white/80 p-3 space-y-2 text-xs text-amber-950">
                  <p className="font-semibold">{isLiga ? "Liga em modo manual: publique diretamente no Instagram da Liga." : `Conexão indisponível: publique manualmente na conta @${conta}.`}</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.urls[0] && (
                      <Button type="button" size="sm" variant="outline" onClick={() => baixarMidia(preview.urls[0], `post-${conta}-${preview.id}.png`)}>
                        <Download className="w-4 h-4 mr-1" /> Baixar imagem
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => copiarTexto(preview.legenda, "Legenda copiada.")}>
                      <Copy className="w-4 h-4 mr-1" /> Copiar legenda
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Manual */}
          {modo !== "semana" && (
            <Card className="p-5 space-y-4">
              <h3 className="text-base font-semibold">Ou crie manualmente</h3>
              <div className="space-y-2">
                <Label>Imagem</Label>
                <Input type="file" accept="image/*" onChange={onFile} />
                {previewImg && <img src={previewImg} alt="Prévia" className="rounded-md max-h-64 object-cover" />}
              </div>
              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea rows={4} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
              </div>
              <Button onClick={salvarManual} disabled={savingManual} className="w-full" variant="outline">
                {savingManual ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : quando === "agora" ? <Zap className="w-4 h-4 mr-2" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                {quando === "agora" && !canPublishAutomatically ? "Salvar para postar manual" : quando === "agora" ? "Publicar agora" : "Agendar"}
              </Button>
            </Card>
          )}

          {/* Lista */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Publicações de @{conta}</h3>
              <span className="text-xs text-zinc-500">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum post ainda.</p>
            ) : (
              <ul className="space-y-3">
                {posts.map((p) => (
                  <li key={p.id} className="flex gap-3 border rounded-md p-3">
                    {p.url_imagem && <img src={p.url_imagem} alt="" className="w-16 h-16 rounded object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{p.legenda || "(sem legenda)"}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                        <Badge variant="outline">{p.status}</Badge>
                        {p.data_agendamento && <span>{format(new Date(p.data_agendamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                      </div>
                    </div>
                    {p.status === "Erro" && (
                      <Button variant="outline" size="sm" onClick={() => tentarNovamente(p.id)} disabled={busy}>
                        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                        Re-tentar
                      </Button>
                    )}
                    {p.status === "EnviadoMake" && !isLiga && (
                      <Button variant="outline" size="sm" onClick={() => tentarNovamente(p.id)} disabled={busy} title="Enviar novamente para o webhook Make da Liga">
                        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                        Reenviar Make
                      </Button>
                    )}
                    {p.url_imagem && (
                      <Button variant="outline" size="icon" onClick={() => baixarMidia(p.url_imagem!, `post-${conta}-${p.id}.png`)} disabled={busy} aria-label="Baixar imagem para publicar manualmente" title="Baixar imagem para publicar manualmente">
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => copiarTexto(p.legenda || "", "Legenda copiada.")} disabled={busy || !p.legenda} aria-label="Copiar legenda" title="Copiar legenda">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setPreviewId(p.id)} disabled={busy} aria-label="Pré-visualizar com logo" title="Pré-visualizar com logo">
                      <ScanEye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => excluir(p.id)} disabled={busy}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <LogoPreviewDialog postId={previewId} open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)} />
        </>
      )}
    </div>
  );
}

function QuandoBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border-2 text-sm font-semibold transition-all ${
        active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white"
      }`}
    >
      {icon} {label}
    </button>
  );
}
