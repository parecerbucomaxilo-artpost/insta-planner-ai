import { Posts7Dias } from "@/components/Posts7Dias";
import { startGenerationProgress } from "@/lib/generation-progress";
import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Instagram, Loader2, Trash2, CalendarClock, Wand2, Zap, CalendarDays, Check, X, Image as ImageIcon, Layers, Film, RotateCcw, ScanEye, Copy, ExternalLink, Download, Sparkles, Stethoscope } from "lucide-react";
import { LogoPreviewDialog } from "@/components/LogoPreviewDialog";
import { toast } from "sonner";
import { uploadPostImage } from "@/lib/storage-utils";
import { getAuthedUserId } from "@/lib/auth-utils";
import { signPostMediaUrls } from "@/lib/storage-url";
import { generateSinglePost, generateWeekThemes, generateCaptionOnly, approvePost, discardPost, MODELOS_IA, MODELOS_IMAGEM } from "@/lib/ai-post.functions";
import { cn } from "@/lib/utils";
import { LOGOS_DISPONIVEIS, type LogoKey } from "@/lib/logos-catalog";

type ModeloIA = (typeof MODELOS_IA)[number]["id"];
type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];
import { publishInstagramNow } from "@/lib/social/instagram-publish.functions";
import { ensurePublicationDestinationProfile, getPublicationDestination, saveManualInstagramToken } from "@/lib/publication-destination.functions";
import type { PostRow } from "@/lib/posts-types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createMetaOAuthStartUrl } from "@/lib/meta-oauth.functions";

const ACCOUNT_KEY = "planner_simplificado_conta_v1";
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";
type Quando = "agora" | "data" | "7dias";
type Modo = "feed" | "carrossel" | "stories" | "semana";

interface PlannerSimplificadoProps {
  contaFixa?: string;        // se setado, trava a conta (sem seletor)
  storageKey?: string;       // chave alternativa do localStorage
  audiencia?: "estudantes-graduacao" | "geral" | "chico-drfm";
  permiteTipoLiga?: boolean; // habilita seletor "tipo Chico / tipo Liga"
}

export function PlannerSimplificado({ contaFixa, storageKey, audiencia = "estudantes-graduacao", permiteTipoLiga = false }: PlannerSimplificadoProps = {}) {
  const genSingle = useServerFn(generateSinglePost);
  const genWeek = useServerFn(generateWeekThemes);
  const genCaption = useServerFn(generateCaptionOnly);
  const approveFn = useServerFn(approvePost);
  const discardFn = useServerFn(discardPost);
  const publishIg = useServerFn(publishInstagramNow);
  const fetchDestino = useServerFn(getPublicationDestination);
  const saveManualToken = useServerFn(saveManualInstagramToken);
  const ensureDestino = useServerFn(ensurePublicationDestinationProfile);
  const startMetaOAuth = useServerFn(createMetaOAuthStartUrl);

  const [conta, setConta] = useState<string>("");
  const [contaInput, setContaInput] = useState<string>("");
  const [destinoStatus, setDestinoStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [destinoModo, setDestinoModo] = useState<"meta" | "missing">("missing");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [metaConnectPath, setMetaConnectPath] = useState<string>("");
  const [metaOauthUrl, setMetaOauthUrl] = useState<string>("");
  const [copiedMetaUrl, setCopiedMetaUrl] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualIgId, setManualIgId] = useState("");
  const [savingManualToken, setSavingManualToken] = useState(false);


  // Geração local sem IA paga
  const [modo, setModo] = useState<Modo>("feed");
  const [modelo, setModelo] = useState<ModeloIA>("local/sem-custo");
  const [modeloImagem, setModeloImagem] = useState<ModeloImagem>("local/sem-custo");
  const [especialidade, setEspecialidade] = useState<"CTBMF" | "Odontologia Hospitalar" | "Ambas" | "Temas Diversos">("CTBMF");
  const defaultLogoKey: LogoKey = audiencia === "estudantes-graduacao" ? "liga-ctbmf" : "planner";
  const [logoKeys, setLogoKeys] = useState<LogoKey[]>([defaultLogoKey]);
  const [tema, setTema] = useState("");
  const [quando, setQuando] = useState<Quando>("agora");
  const [data, setData] = useState<string>("");
  const [hora, setHora] = useState<string>("09:00");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; legenda: string; urls: string[]; slideLegendas?: string[] } | null>(null);
  const [temas, setTemas] = useState<Array<{ rede: string; tipo?: string; formato?: string; quando?: string; tema: string; gancho: string }> | null>(null);

  // Manual
  const [legenda, setLegenda] = useState("");
  const [temaManual, setTemaManual] = useState("");
  const [gerandoLegenda, setGerandoLegenda] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);

  const lsKey = storageKey ?? ACCOUNT_KEY;
  const [tipoPostagem, setTipoPostagem] = useState<"chico" | "liga">("chico");
  const isLiga = conta === LIGA_ACCOUNT;
  const usarTipoLiga = permiteTipoLiga && tipoPostagem === "liga";
  const effectiveAudiencia: typeof audiencia = usarTipoLiga ? "estudantes-graduacao" : audiencia;
  const effectiveConta = usarTipoLiga ? LIGA_ACCOUNT : conta;
  const canPublishAutomatically = destinoStatus === "ok";


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

  // Carrega destino Meta/token configurado para esta conta
  useEffect(() => {
    if (!conta) { setDestinoStatus("missing"); setDestinoModo("missing"); return; }
    setDestinoStatus("loading");
    (async () => {
      try {
        const destino = await fetchDestino({ data: { conta } });
        setDestinoStatus(destino.status);
        setDestinoModo(destino.mode);
      } catch (e: any) {
        setDestinoStatus("missing");
        setDestinoModo("missing");
        toast.error(e.message || "Erro ao carregar destino.");
      }
    })();
  }, [conta, fetchDestino]);

  const conectarMetaConta = async () => {
    if (!conta) return toast.error("Selecione uma conta primeiro.");
    try {
      const destino = await ensureDestino({ data: { conta } });
      const trocarFacebook = conta === LIGA_ACCOUNT;
      const r = await startMetaOAuth({
        data: {
          perfilId: destino.id,
          targetAccount: conta,
          forceReauth: trocarFacebook,
          logoutFacebookFirst: trocarFacebook,
        },
      });
      const manualUrl = trocarFacebook ? (r.loginUrl || r.privateAuthUrl || r.url) : r.url;
      const params = new URLSearchParams({ account: conta, next: r.url });
      if (r.loginUrl) params.set("login", r.loginUrl);
      if (r.privateAuthUrl) params.set("privateNext", r.privateAuthUrl);
      const connectPath = `/meta-connect?${params.toString()}`;
      setMetaOauthUrl(manualUrl);
      setMetaConnectPath(connectPath);
      const opened = window.open(connectPath, "_blank", "noopener,noreferrer");
      if (opened) {
        toast.success(trocarFacebook ? "Abri a conexão da Liga em nova aba." : "Abri a conexão Meta em nova aba.");
      } else {
        toast.info(trocarFacebook ? "Clique em 'Abrir conexão da Liga' que apareceu abaixo." : "Clique no botão 'Abrir conexão Meta' que apareceu abaixo.");
      }
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
    return "Publicado diretamente no Instagram.";
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
    await supabase.from("posts").update({ instagram_conta: effectiveConta } as any).eq("id", postId);
  };

  const handleGerar = async (opts?: { conjugado?: boolean; forcarEspecialidade?: "CTBMF" | "Odontologia Hospitalar" | "Ambas" | "Temas Diversos" }) => {
    if (!conta) return toast.error("Selecione uma conta do Instagram.");
    setBusy(true);
    const tid = "local-simple";
    const labelModo = modo === "carrossel" ? "carrossel" : modo === "stories" ? "story" : "post de feed";
    toast.loading(`Gerador local criando ${labelModo}${opts?.conjugado ? " conjugado" : ""}...`, { id: tid });
    try {
      const iso = buildAgendamentoIso();
      const tipo = modo === "stories" ? "stories" : "feed";
      const formato = modo === "carrossel" ? "Carrossel" : modo === "stories" ? "Story" : "Post Único";
      const especialidadeReq = opts?.conjugado ? "Ambas" : (opts?.forcarEspecialidade ?? especialidade);
      const temaBase = tema.trim();
      const temaReq = opts?.conjugado
        ? (temaBase
            ? `${temaBase} — abordagem conjugada CTBMF + Odontologia Hospitalar (mostrar interface consultório-hospital)`
            : "Tema conjugado CTBMF + Odontologia Hospitalar: caso que exige manejo cirúrgico bucomaxilofacial em ambiente hospitalar (ex.: paciente com comorbidade, trauma facial, infecção odontogênica grave, cirurgia sob anestesia geral)")
        : opts?.forcarEspecialidade === "Odontologia Hospitalar"
          ? (temaBase
              ? `${temaBase} — foco Odontologia Hospitalar (ambiente hospitalar, paciente sistêmico, centro cirúrgico)`
              : "Tema de Odontologia Hospitalar: atendimento odontológico em ambiente hospitalar (UTI, enfermaria, centro cirúrgico), paciente com comorbidade, prevenção de PAV, protocolo pré-operatório, foco infeccioso odontogênico.")
          : temaBase;
      const stopP = startGenerationProgress(tid, "Gerando post", formato === "Carrossel");
      const out = await genSingle({ data: {
        tema: temaReq,
        especialidade: especialidadeReq,
        rede: "instagram",
        tipo,
        formato,
        quando: iso,
        ambasRedes: false,
        audiencia: effectiveAudiencia,
        modelo,
        modeloImagem,
        logoKeys,
      } as any }).finally(stopP);
      await marcarConta(out.id);
      setPreview({ id: out.id, legenda: out.legenda, urls: out.urls, slideLegendas: (out as any).slideLegendas });
      setTema("");
      toast.success("Pré-visualize abaixo.", { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Falha na geração.", { id: tid });
    } finally { setBusy(false); }
  };

  const handleSemana = async () => {
    if (!conta) return toast.error("Selecione uma conta do Instagram.");
    setBusy(true);
    const tid = "local-week-simple";
    toast.loading("Gerador local planejando 7 dias...", { id: tid });
    try {
      const out = await genWeek({ data: { especialidade, modelo, temaGuia: tema.trim() } as any });
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
      const stopP = startGenerationProgress(tid, "Gerando post", t.formato === "Carrossel");
      const out = await genSingle({ data: {
        tema: t.tema, especialidade,
        rede: (t.rede === "estilo-x" ? "estilo-x" : "instagram") as any,
        tipo: t.tipo as any, formato: t.formato as any, quando: t.quando,
        ambasRedes: false,
        audiencia: effectiveAudiencia,
        modelo,
        modeloImagem,
        logoKeys,
      } as any }).finally(stopP);
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
          toast.success("Sem conexão ativa: salvei o post e deixei pronto para publicação manual.", { id: tid });
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
      const status = shouldAutoPublish ? "Agendado" : quando === "agora" ? "Rascunho" : "Agendado";
      const { data: ins, error } = await supabase.from("posts").insert({
        user_id: uid, tipo_post: "Post Único",
        legenda, url_imagem: url,
        postar_instagram: true, postar_linkedin: false,
        status, data_agendamento: iso ?? null,
        estilo_layout: "Padrão", instagram_conta: effectiveConta,
      } as any).select("id").single();
      if (error) throw error;
      if (shouldAutoPublish && ins?.id) {
        const out = await publishIg({ data: { id: ins.id } });
        assertPublishOk(out);
        toast.success(publishSuccessMessage(out));
      } else if (quando === "agora") {
        await copiarTexto(legenda, "Legenda copiada para publicar manualmente.");
        toast.success("Post salvo para publicação manual.");
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

  const toggleLogoKey = (key: LogoKey) => {
    setLogoKeys((current) => {
      if (key === "nenhuma") return ["nenhuma"];
      const withoutNone = current.filter((item) => item !== "nenhuma");
      if (withoutNone.includes(key)) {
        const next = withoutNone.filter((item) => item !== key);
        return next.length ? next : ["nenhuma"];
      }
      return [...withoutNone, key];
    });
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

      {permiteTipoLiga && (
        <Card className="p-5 space-y-3 border-2 border-indigo-200 bg-indigo-50/30">
          <Label className="text-sm font-semibold">Tipo de postagem</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipoPostagem("chico")}
              className={cn(
                "px-3 py-3 rounded-md text-sm font-semibold border-2 transition-all text-left",
                tipoPostagem === "chico" ? "border-indigo-500 bg-white text-indigo-900 shadow" : "border-zinc-200 bg-white/60 text-zinc-600 hover:border-indigo-300"
              )}
            >
              👨‍⚕️ Tipo Chico
              <div className="text-[11px] font-normal text-zinc-500 mt-0.5">Conteúdo científico do Prof. Francisco — paleta azul navy + ciano, assinatura CROSP.</div>
            </button>
            <button
              type="button"
              onClick={() => setTipoPostagem("liga")}
              className={cn(
                "px-3 py-3 rounded-md text-sm font-semibold border-2 transition-all text-left",
                tipoPostagem === "liga" ? "border-emerald-500 bg-white text-emerald-900 shadow" : "border-zinc-200 bg-white/60 text-zinc-600 hover:border-emerald-300"
              )}
            >
              🎓 Tipo Liga
              <div className="text-[11px] font-normal text-zinc-500 mt-0.5">Didático para graduação — identidade da Liga, com seleção manual da logo oficial no dashboard. Publica via @drfranciscomenezes convidando @lactbmf como colaboradora.</div>
            </button>
          </div>
          {usarTipoLiga && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
              ✅ Criativo Liga ativo. O post sai pelo perfil do Prof. Francisco com convite de coautoria para a Liga.
            </p>
          )}
        </Card>
      )}


      {conta && (
          <Card className={`p-5 space-y-3 border-2 ${destinoStatus === "ok" ? "border-emerald-200 bg-emerald-50/30" : "border-amber-300 bg-amber-50/40"}`}>
          <Label className="text-sm font-semibold flex items-center gap-2">
            Destino de publicação de @{conta}
            {destinoStatus === "ok" && <Badge className="bg-emerald-600">Meta conectada</Badge>}
            {destinoStatus === "missing" && <Badge variant="destructive">Não conectado</Badge>}
          </Label>
          {destinoStatus === "missing" && (
            <div className="rounded-md border border-amber-200 bg-white/70 p-3 text-xs text-amber-950 space-y-1">
              <p className="font-semibold">Conectar Instagram @{conta} pelo Meta:</p>
              {isLiga ? (
                <>
                  <p>1. <strong>Saia do Facebook</strong> no navegador (ou abra uma janela anônima) — senão o Meta vai usar a conta do Prof. Francisco automaticamente.</p>
                  <p>2. Clique em "Conectar Liga pelo Facebook/Meta" abaixo e <strong>entre com o Facebook que administra a Página vinculada ao @{conta}</strong>.</p>
                  <p>3. Aceite as permissões. O app valida que a conta é exatamente @{conta} antes de salvar o token.</p>
                </>
              ) : (
                <p>clique em "Conectar Instagram @{conta}" abaixo, faça login com a conta Facebook que administra essa página e aceite as permissões. O app salva o token e passa a publicar direto, sem Make.</p>
              )}
            </div>
          )}
          {destinoModo === "meta" && (
            <p className="text-xs text-emerald-800">✅ Publicação direta Meta ativa para @{conta}.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={conectarMetaConta} className={isLiga ? "bg-blue-700 hover:bg-blue-800" : undefined} variant={isLiga ? "default" : "secondary"}>
              <Instagram className="w-4 h-4 mr-1" /> {isLiga ? "Conectar Liga pelo Facebook/Meta" : `Conectar Instagram @${conta}`}
            </Button>
            {metaConnectPath && (
              <Button asChild variant="outline">
                <a href={metaConnectPath} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> {isLiga ? "Abrir conexão da Liga" : "Abrir conexão Meta"}
                </a>
              </Button>
            )}
            {metaOauthUrl && (
              <Button type="button" variant="outline" onClick={copiarMetaOAuthUrl}>
                {copiedMetaUrl ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedMetaUrl ? "Link copiado" : "Copiar link Meta"}
              </Button>
            )}
          </div>
          {metaConnectPath && (
            <p className="text-xs text-zinc-600">
              Se o navegador bloquear a abertura, use “Copiar link Meta” e cole o link diretamente na barra do navegador, fora do preview.
            </p>
          )}
          {isLiga && destinoStatus === "ok" && (
            <p className="text-xs text-emerald-800 font-medium">
              Liga conectada: os posts desta aba serão publicados diretamente em @lactbmf.anhanguerasbo.
            </p>
          )}
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

          {/* Especialidade do post */}
          <Card className="p-5 space-y-3">
            <Label className="text-sm font-semibold">Especialidade</Label>
            <div className="grid grid-cols-2 gap-2">
              <QuandoBtn
                active={especialidade === "CTBMF"}
                onClick={() => setEspecialidade("CTBMF")}
                icon={<Sparkles className="w-4 h-4" />}
                label="CTBMF"
              />
              <QuandoBtn
                active={especialidade === "Odontologia Hospitalar"}
                onClick={() => setEspecialidade("Odontologia Hospitalar")}
                icon={<Sparkles className="w-4 h-4" />}
                label="Hospitalar"
              />
              <QuandoBtn
                active={especialidade === "Ambas"}
                onClick={() => setEspecialidade("Ambas")}
                icon={<Sparkles className="w-4 h-4" />}
                label="Ambas"
              />
              <QuandoBtn
                active={especialidade === "Temas Diversos"}
                onClick={() => setEspecialidade("Temas Diversos")}
                icon={<Sparkles className="w-4 h-4" />}
                label="Temas Diversos"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Define o foco das legendas e imagens geradas. "Temas Diversos" respeita datas, eventos, homenagens e assuntos fora da saúde/odontologia.</p>
          </Card>

          <Card className="p-5 space-y-3 border-2 border-dashed border-primary/20 bg-primary/5">
            <Label className="text-sm font-semibold">Sugira o tema do post ou da semana</Label>
            <Textarea
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder={effectiveAudiencia === "estudantes-graduacao"
                ? "Ex.: caiu na prova: sutura simples; curiosidade sobre nervo alveolar inferior; evento da Liga."
                : especialidade === "Temas Diversos"
                  ? "Ex.: homenagem aos combatentes de 1932; Dia do Trabalho; evento institucional; acontecimento atual."
                  : "Ex.: dor no siso, ATM travada, bruxismo, odontologia hospitalar, cirurgia sob anestesia geral."
              }
              rows={3}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Se preencher, esse tema guia a imagem e a legenda. Se deixar vazio, o app escolhe automaticamente sem repetir assuntos próximos.</p>
          </Card>

          {/* Seleção de LOGO (overlay aplicado na arte gerada) */}
          <Card className="p-5 space-y-3">
            <Label className="text-sm font-semibold">Logos do post</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOGOS_DISPONIVEIS.map((l) => {
                const active = logoKeys.includes(l.key);
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => toggleLogoKey(l.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border p-2 text-left transition",
                      active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:bg-muted",
                    )}
                  >
                    <div className="w-10 h-10 shrink-0 rounded bg-[#0c2340] flex items-center justify-center overflow-hidden">
                      {l.url ? (
                        <img src={l.url} alt={l.label} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <X className="w-4 h-4 text-white/70" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                        {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <span className="truncate">{l.label}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{l.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">Você pode marcar mais de uma logo. O sistema aplica as logos selecionadas em faixa no rodapé; a IA não desenha logo.</p>
          </Card>






          {/* Bloco Quando — usado pelo gerador local e manual (oculto no modo semana) */}
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

          {/* Gerador local */}
          <Card className="p-5 space-y-4 border-2 border-dashed border-indigo-200 bg-indigo-50/30">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-indigo-900">
                Gerar post completo — {modo === "feed" ? "Post de Feed" : modo === "carrossel" ? "Carrossel" : modo === "stories" ? "Stories" : "Programação 7 dias"}
              </h3>
            </div>

            <Posts7Dias
              especialidade={especialidade}
              temaGuia={tema}
              gerar={async (item, formato) => {
                const out = await genSingle({ data: {
                  tema: item.tema, especialidade, rede: "instagram",
                  tipo: formato === "Story" ? "stories" : "feed", formato, quando: item.quando,
                  ambasRedes: false, audiencia: effectiveAudiencia, modelo, modeloImagem, logoKeys,
                } as any });
                await marcarConta(out.id);
                return { id: out.id, urls: out.urls, legenda: out.legenda };
              }}
            />

            <div className="space-y-1.5">
              <Label className="text-xs">Gerador de texto</Label>
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
              <Label className="text-xs">Gerador de imagem</Label>
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
                <Button onClick={() => handleGerar()} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Criar {modo === "carrossel" ? "carrossel" : modo === "stories" ? "story" : "post"} com imagem + legenda {modelo === "local/sem-custo" ? "pelo app" : "pela IA"}
                </Button>
                <Button
                  onClick={() => handleGerar({ forcarEspecialidade: "Odontologia Hospitalar" })}
                  disabled={busy}
                  variant="secondary"
                  className="w-full border-2 border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Stethoscope className="w-4 h-4 mr-2" />}
                  Gerar tema — Odontologia Hospitalar
                </Button>
                <Button
                  onClick={() => handleGerar({ conjugado: true })}
                  disabled={busy}
                  variant="secondary"
                  className="w-full border-2 border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Stethoscope className="w-4 h-4 mr-2" />}
                  Gerar tema conjugado — CTBMF + Odontologia Hospitalar
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-indigo-800">O gerador local monta um cronograma fixo de 7 dias só para Instagram, sem cobrança.</p>
                <Button onClick={handleSemana} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarDays className="w-4 h-4 mr-2" />}
                  Gerar 7 dias sem IA paga
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


          {/* Preview do gerador local */}
          {preview && (
            <Card className="p-5 space-y-3 border-2 border-emerald-200 bg-emerald-50/30">
              <h3 className="font-semibold text-emerald-900">Pré-visualização</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  {preview.urls.length > 1 ? (
                    <>
                      <div className="flex flex-col gap-4">

                        {preview.urls.map((u, i) => (
                          <div key={i} className="rounded-md border bg-white/80 overflow-hidden">
                            <div className="relative">
                              <img src={u} alt={`Slide ${i + 1}`} className="w-full object-contain max-h-[85vh] bg-slate-50" />
                              <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                {i + 1}/{preview.urls.length}
                              </span>
                              <Button
                                type="button" size="sm" variant="secondary"
                                className="absolute bottom-1 right-1 h-6 px-2 text-[10px]"
                                onClick={() => baixarMidia(u, `post-${conta}-${preview.id}-${i + 1}.png`)}
                              >
                                <Download className="w-3 h-3 mr-1" />Slide {i + 1}
                              </Button>
                            </div>
                            {preview.slideLegendas?.[i] && (
                              <p className="p-2 text-[11px] leading-snug text-slate-700">
                                {preview.slideLegendas[i]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-emerald-900/70">Carrossel com {preview.urls.length} slides — todos serão publicados na ordem.</p>
                    </>
                  ) : (
                    preview.urls[0] && <img src={preview.urls[0]} alt="" className="rounded-md w-full object-contain max-h-[85vh] bg-slate-50" />
                  )}
                </div>
                <Textarea value={preview.legenda} readOnly rows={12} className="text-xs" />
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
                  <p className="font-semibold">Conexão indisponível: conecte a conta @${conta} pelo Meta ou publique manualmente.</p>
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
                <Label>Sugira um tema (opcional) para a IA escrever a legenda</Label>
                <div className="flex gap-2">
                  <Input
                    value={temaManual}
                    onChange={(e) => setTemaManual(e.target.value)}
                    placeholder="Ex.: dor no siso, ATM travada, ronco..."
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={gerandoLegenda || !temaManual.trim()}
                    onClick={async () => {
                      const tid = "gen-caption";
                      setGerandoLegenda(true);
                      toast.loading("Gerando legenda com IA...", { id: tid });
                      try {
                        const out = await genCaption({
                          data: {
                            tema: temaManual.trim(),
                            rede: "instagram",
                            formato: modo === "carrossel" ? "Carrossel" : modo === "stories" ? "Story" : "Post Único",
                            especialidade,
                            audiencia: effectiveAudiencia === "estudantes-graduacao" ? "estudantes-graduacao" : effectiveAudiencia === "chico-drfm" ? "chico-drfm" : "geral",
                            modelo,
                          },
                        });
                        setLegenda(out.legenda);
                        toast.success(out.via === "ia" ? "Legenda gerada pela IA." : "Legenda gerada (modo local).", { id: tid });
                      } catch (e: any) {
                        toast.error(e?.message || "Falha ao gerar legenda.", { id: tid });
                      } finally {
                        setGerandoLegenda(false);
                      }
                    }}
                  >
                    {gerandoLegenda ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" />IA</>}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea rows={6} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
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
                        <Badge variant="outline">{p.status === "EnviadoMake" ? "Pendente Meta" : p.status}</Badge>
                        {p.data_agendamento && <span>{format(new Date(p.data_agendamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                      </div>
                    </div>
                    {p.status === "Erro" && !isLiga && (
                      <Button variant="outline" size="sm" onClick={() => tentarNovamente(p.id)} disabled={busy}>
                        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                        Re-tentar
                      </Button>
                    )}
                    {p.status === "EnviadoMake" && !isLiga && (
                      <Button variant="outline" size="sm" onClick={() => tentarNovamente(p.id)} disabled={busy} title="Tentar publicar pela Meta">
                        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                        Publicar Meta
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
