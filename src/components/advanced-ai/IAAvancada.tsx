import { useRascunhoStudio, useStudioMaterial } from "@/components/free-studio/StudioMaterial";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Copy, Download, ImageIcon, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PROVEDORES_IA, modelosDoProvedor, padraoDoProvedor, provedorDoModelo, type ProvedorIA } from "@/lib/ai-models";
import { montarPacote, type PacoteCriacao } from "@/lib/advanced-ai";
import { LOGOS_DISPONIVEIS } from "@/lib/logos-catalog";
import {
  MARCAS, REDES_IA, VARIANTES, AJUSTES, FORMATOS_IA, LIMITE_REDE,
  type Marca, type RedeIA, type Variante, type Ajuste, type FormatoIA, type Briefing, type Resultado,
} from "@/lib/advanced-ai";
import { gerarTextoAvancado, gerarImagemAvancada, statusOpenAIDireto } from "@/lib/advanced-ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { aplicarDashboard, contextoDashboard, perfilDashboardDe, type ContextoDashboard } from "@/lib/dashboard-context";
import { midiaPadrao, type MidiaEnvio } from "@/lib/studio-media";
import { StudioPublishActions } from "@/components/free-studio/StudioPublishActions";

const cores = (m: Marca) => ({ texto: MARCAS[m].paleta.texto, destaque: MARCAS[m].paleta.destaque, sombra: MARCAS[m].paleta.fundo1 });

type Pendente = { titulo: string; acao: () => Promise<void> };
type Img = { chave: string; nome: string; base: string; headline: string };

function carregar(src: string, cors = false): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const i = new Image();
    if (cors) i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

function linhas(ctx: CanvasRenderingContext2D, t: string, max: number) {
  const out: string[] = []; let a = "";
  for (const p of t.split(/\s+/).filter(Boolean)) {
    const n = a ? `${a} ${p}` : p;
    if (ctx.measureText(n).width > max && a) { out.push(a); a = p; } else a = n;
  }
  if (a) out.push(a);
  return out;
}

/** Compõe imagem da IA + headline real (camada editável) + logo oficial do perfil. */
async function compor(img: Img, formato: FormatoIA, marca: Marca): Promise<string> {
  const f = FORMATOS_IA[formato];
  const c = document.createElement("canvas"); c.width = f.w; c.height = f.h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem para exportação.");
  const foto = await carregar(img.base);
  if (foto) {
    const e = Math.max(f.w / foto.width, f.h / foto.height);
    ctx.drawImage(foto, (f.w - foto.width * e) / 2, (f.h - foto.height * e) / 2, foto.width * e, foto.height * e);
  }
  const cor = cores(marca);
  const m = Math.min(f.w, f.h) * 0.08;
  if (img.headline.trim()) {
    const g = ctx.createLinearGradient(0, f.h * 0.5, 0, f.h);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, cor.sombra + "e6");
    ctx.fillStyle = g; ctx.fillRect(0, f.h * 0.5, f.w, f.h * 0.5);
    let tam = Math.min(f.w, f.h) * 0.075;
    ctx.font = `800 ${tam}px system-ui, Arial, sans-serif`;
    let ls = linhas(ctx, img.headline, f.w - m * 2);
    while (ls.length > 4 && tam > 20) { tam *= 0.9; ctx.font = `800 ${tam}px system-ui, Arial, sans-serif`; ls = linhas(ctx, img.headline, f.w - m * 2); }
    let y = f.h - m - ls.length * tam * 1.15;
    ctx.fillStyle = cor.destaque; ctx.fillRect(m, y - tam * 0.5, tam * 1.5, tam * 0.12);
    ctx.fillStyle = cor.texto; ctx.textBaseline = "top";
    for (const l of ls) { ctx.fillText(l, m, y); y += tam * 1.15; }
  }
  const url = LOGOS_DISPONIVEIS.find((l) => l.key === MARCAS[marca].logo)?.url;
  const logo = url ? await carregar(url, true) : null;
  if (logo) {
    const lh = Math.min(f.w, f.h) * 0.13;
    ctx.drawImage(logo, f.w - m - (logo.width / logo.height) * lh, m, (logo.width / logo.height) * lh, lh);
  }
  try { return c.toDataURL("image/jpeg", 0.92); } catch {
    toast.warning(MARCAS[marca].logo === "nenhuma" ? "Não foi possível compor esta exportação." : "A logo oficial não pôde ser aplicada nesta exportação.");
    return img.base;
  }
}

async function copiar(t: string) {
  try { await navigator.clipboard.writeText(t); toast.success("Copiado!"); } catch { toast.error("Não foi possível copiar."); }
}

export function IAAvancada({ perfil, tema, objetivo }: { perfil: Marca; tema: string; objetivo: string }) {
  const textoFn = useServerFn(gerarTextoAvancado);
  const imagemFn = useServerFn(gerarImagemAvancada);
  const { preencher } = useStudioMaterial();
  const [rascunhoB, setB] = useRascunhoStudio<Briefing>("ia.briefing", { marca: perfil, telefone: MARCAS[perfil].telefone, tema: "", objetivo: "", contexto: "", rede: "instagram", formato: "Post único", nivel: MARCAS[perfil].nivel, tamanho: "medio", tom: "", cta: "" });
  const b: Briefing = { ...rascunhoB, tema, objetivo };
  const [variantes, setVariantes] = useState<Variante[]>(["media"]);
  // OpenAI é o provedor principal deste modo; Gemini segue disponível no seletor.
  const [modeloTexto, setModeloTexto] = useState<string>(() => padraoDoProvedor("text", "openai"));
  const [modeloImagem, setModeloImagem] = useState<string>(() => padraoDoProvedor("image", "openai"));
  const [pacote, setPacote] = useRascunhoStudio<PacoteCriacao | null>("ia.pacote", null);
  const emCurso = useRef(false);
  const statusFn = useServerFn(statusOpenAIDireto);
  const [chaveOpenAI, setChaveOpenAI] = useState<boolean | null>(null);
  useEffect(() => { statusFn().then((r) => setChaveOpenAI(r.configurada)).catch(() => setChaveOpenAI(false)); }, [statusFn]);
  const usaDireto = provedorDoModelo(modeloTexto) === "openai-direto" || provedorDoModelo(modeloImagem) === "openai-direto";
  const bloqueioChave = (m: string) => provedorDoModelo(m) === "openai-direto" && chaveOpenAI !== true;
  const avisoChave = "OpenAI (chave própria) não configurada: adicione o segredo OPENAI_API_KEY nas configurações do projeto (Secrets) ou escolha outro provedor.";
  const [res, setRes] = useRascunhoStudio<Resultado | null>("ia.resultado", null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [formato, setFormato] = useState<FormatoIA>("feed");
  const [slides, setSlides] = useState(5);
  const [imgs, setImgs] = useRascunhoStudio<Record<string, Img>>("ia.imagens", {});
  const [prontas, setProntas] = useState<Record<string, string>>({});
  const [varianteEnvio, setVarianteEnvio] = useState<string>("media");
  const [midiaEnvio, setMidiaEnvioRaw] = useState<MidiaEnvio>("nenhuma");
  const midiaEscolhida = useRef(false);
  const setMidiaEnvio = (m: MidiaEnvio) => { midiaEscolhida.current = true; setMidiaEnvioRaw(m); };
  const fim = useRef<HTMLDivElement>(null);
  // Sem isto, a imagem gerada nunca chegava à publicação: o seletor ficava em "Sem imagem" (0 imagens).
  useEffect(() => { if (!midiaEscolhida.current) setMidiaEnvioRaw(midiaPadrao(prontas, slides)); }, [prontas, slides]);
  useEffect(() => { midiaEscolhida.current = false; }, [perfil]);

  const editados = useRef(new Set<"objetivo" | "tom" | "contexto">());
  const [dash, setDash] = useState<ContextoDashboard | null>(null);
  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) => {
    if (k === "objetivo" || k === "tom" || k === "contexto") editados.current.add(k);
    setB((s) => ({ ...s, [k]: v }));
  };
  useEffect(() => {
    let vivo = true;
    setDash(null); editados.current.clear();
    
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("perfil_usuario").select("user_id,nome_profissional,arroba_usuario,instagram_arroba,cro_uf,subespecialidades,tom_voz").eq("user_id", u.user.id);
      if (!vivo) return;
      const c = contextoDashboard(perfilDashboardDe(data ?? [], perfil, u.user.id));
      setDash(c);
      preencher({ objetivo: c.objetivo });
      setB((s) => aplicarDashboard(s, { ...c, objetivo: "" }, editados.current));
    })();
    return () => { vivo = false; };
  }, [perfil]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const i of Object.values(imgs)) out[i.chave] = await compor(i, formato, b.marca);
      if (vivo) setProntas(out);
    })();
    return () => { vivo = false; };
  }, [imgs, formato, b.marca]);

  const confirmar = (titulo: string, acao: () => Promise<void>) => setPendente({ titulo, acao });

  const executar = async (acao: () => Promise<void>) => {
    if (emCurso.current) return; // evita chamada duplicada por clique duplo
    emCurso.current = true;
    setOcupado(true); setErro("");
    try { await acao(); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg); toast.error(msg);
    } finally { emCurso.current = false; setOcupado(false); }
  };

  const criarComOpenAI = () => {
    if (b.tema.trim().length < 3) { toast.error("Confirme um tema antes de gerar."); return; }
    if (!b.objetivo.trim()) { toast.error("Informe o objetivo da postagem (não há objetivo cadastrado no Dashboard)."); return; }
    const provOpenAI: ProvedorIA = provedorDoModelo(modeloTexto) === "openai-direto" || (provedorDoModelo(modeloTexto) === "google" && chaveOpenAI) ? "openai-direto" : "openai";
    const mt = provedorDoModelo(modeloTexto) === provOpenAI ? modeloTexto : padraoDoProvedor("text", provOpenAI);
    const mi = provedorDoModelo(modeloImagem) === provOpenAI ? modeloImagem : padraoDoProvedor("image", provOpenAI);
    if (bloqueioChave(mt)) { toast.error(avisoChave); return; }
    setModeloTexto(mt); setModeloImagem(mi);
    const vars: Variante[] = variantes.includes("media") ? variantes : ["media", ...variantes];
    confirmar("Criar com OpenAI: conceito, texto da arte, legenda, CTA e hashtags (a imagem só é gerada depois, com outro clique)", () =>
      executar(async () => {
        const r = await textoFn({ data: { briefing: b, variantes: vars, modelo: mt } });
        setPacote(montarPacote(r, "media", b.cta));
        setRes(r);
        setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }));
  };

  const gerarTexto = (ajuste?: Ajuste) => {
    if (bloqueioChave(modeloTexto)) { toast.error(avisoChave); return; }
    if (b.tema.trim().length < 3) { toast.error("Confirme um tema antes de gerar."); return; }
    if (!b.objetivo.trim()) { toast.error("Informe o objetivo da postagem (não há objetivo cadastrado no Dashboard)."); return; }
    const anterior = ajuste && res ? Object.entries(res.variantes).map(([k, v]) => `[${k}]\n${v}`).join("\n\n") : undefined;
    confirmar(ajuste ? `Ajustar texto: ${AJUSTES[ajuste]}` : "Gerar texto com IA", () =>
      executar(async () => {
        const r = await textoFn({ data: { briefing: b, variantes, ajuste, anterior, modelo: modeloTexto } });
        setRes(r);
        setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }));
  };

  const gerarImagem = (tipo: "capa" | "unico" | "slide", n?: number) => {
    if (bloqueioChave(modeloImagem)) { toast.error(avisoChave); return; }
    if (b.tema.trim().length < 3) { toast.error("Confirme um tema antes de gerar."); return; }
    if (!b.objetivo.trim()) { toast.error("Escolha o objetivo do material acima."); return; }
    const chave = tipo === "slide" ? `slide-${n}` : tipo;
    const nome = tipo === "capa" ? "Capa" : tipo === "unico" ? "Post único" : `Slide ${n}`;
    const existe = !!imgs[chave];
    confirmar(existe ? `Gerar nova imagem e SUBSTITUIR "${nome}"` : `Gerar imagem: ${nome}`, () =>
      executar(async () => {
        const textoSlide = imgs[chave]?.headline || undefined;
        const r = await imagemFn({ data: { briefing: b, formato, tipo, slide: n, textoSlide, modelo: modeloImagem } });
        setImgs((s) => ({ ...s, [chave]: { chave, nome, base: r.imagem, headline: s[chave]?.headline ?? (tipo === "slide" ? "" : res?.titulo ?? "") } }));
      }));
  };

  const baixar = (chave: string) => {
    const a = document.createElement("a"); a.href = prontas[chave]; a.download = `${chave}-${formato}.jpg`; a.click();
  };

  const alvo = Object.keys(VARIANTES) as Variante[];
  const tecnico = b.nivel === "tecnico";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Briefing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Perfil ativo: {MARCAS[b.marca].nome}</Label>
            <p className="text-xs text-muted-foreground">Público: {MARCAS[b.marca].publico}. Paleta, {MARCAS[b.marca].logo !== "nenhuma" && "logo oficial, "}assinatura e chamadas seguem este perfil (troque no seletor de perfil acima).</p>
            {b.marca !== "chico" && (
              <div className="space-y-1">
                <Label htmlFor="ia-tel">Telefone do perfil</Label>
                <Input id="ia-tel" value={b.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="Não configurado — informe para incluir na legenda" />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="ia-ctx">Contexto do Dashboard</Label>
                <Button type="button" size="sm" variant="outline" disabled={!dash} onClick={() => dash && setB((s) => aplicarDashboard(s, { ...dash, objetivo: "" }, editados.current, true))}>Usar dados do Dashboard</Button></div>
              <Input id="ia-ctx" value={b.contexto} onChange={(e) => set("contexto", e.target.value)} placeholder={dash && !dash.nome && !dash.area ? "Nada cadastrado no Dashboard para este perfil" : "Nome e área de atuação do Dashboard"} />

            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-rede">Rede</Label>
              <select id="ia-rede" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={b.rede} onChange={(e) => set("rede", e.target.value as RedeIA)}>
                {(Object.keys(REDES_IA) as RedeIA[]).map((r) => <option key={r} value={r}>{REDES_IA[r]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-fmt">Formato</Label>
              <select id="ia-fmt" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={b.formato} onChange={(e) => set("formato", e.target.value)}>
                {["Post único", "Carrossel", "Story", "Artigo LinkedIn", "Publicação Google"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-niv">Nível técnico</Label>
              <select id="ia-niv" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={b.nivel} onChange={(e) => set("nivel", e.target.value as Briefing["nivel"])}>
                <option value="leigo">Leigo (paciente)</option><option value="intermediario">Intermediário</option><option value="tecnico">Técnico (acadêmico)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-tam">Tamanho</Label>
              <select id="ia-tam" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={b.tamanho} onChange={(e) => set("tamanho", e.target.value as Briefing["tamanho"])}>
                <option value="curto">Curto</option><option value="medio">Médio</option><option value="longo">Longo</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-tom">Tom (opcional)</Label>
              <Input id="ia-tom" value={b.tom} onChange={(e) => set("tom", e.target.value)} placeholder={tecnico ? "Ex.: científico e objetivo" : "Ex.: acolhedor e claro"} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ia-cta">Chamada desejada (opcional, só CTAs permitidas)</Label>
              <Input id="ia-cta" value={b.cta} onChange={(e) => set("cta", e.target.value)} placeholder={MARCAS[b.marca].ctaPadrao ? `Ex.: ${MARCAS[b.marca].ctaPadrao}` : "Sem chamada padrão configurada"} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>O que gerar (menos itens = menos consumo)</Label>
            <div className="flex flex-wrap gap-2">
              {alvo.map((v) => {
                const on = variantes.includes(v);
                return <Button key={v} size="sm" variant={on ? "secondary" : "outline"} aria-pressed={on}
                  onClick={() => setVariantes((s) => on ? (s.length > 1 ? s.filter((x) => x !== v) : s) : [...s, v])}>{VARIANTES[v]}</Button>;
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ia-pt">Provedor de texto</Label>
              <select id="ia-pt" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={provedorDoModelo(modeloTexto)} onChange={(e) => setModeloTexto(padraoDoProvedor("text", e.target.value as ProvedorIA))}>
                {(Object.keys(PROVEDORES_IA) as ProvedorIA[]).map((p) => <option key={p} value={p}>{PROVEDORES_IA[p]}</option>)}
              </select>
              <Label htmlFor="ia-mt">Modelo de texto</Label>
              <select id="ia-mt" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={modeloTexto} onChange={(e) => setModeloTexto(e.target.value)}>
                {modelosDoProvedor("text", provedorDoModelo(modeloTexto)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <Button className="w-full" disabled={ocupado} onClick={criarComOpenAI}>
                {ocupado ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />} CRIAR COM OPENAI
              </Button>
              <Button className="w-full" variant="outline" disabled={ocupado} onClick={() => gerarTexto()}>
                Gerar só o texto
              </Button>
            </div>
          </div>
          {usaDireto && chaveOpenAI === false && <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{avisoChave}</p>}
          {usaDireto && chaveOpenAI && <p className="text-xs text-muted-foreground">Chave própria: cada geração é cobrada direto na sua conta OpenAI (separada da assinatura do ChatGPT).</p>}
          <p className="text-xs text-muted-foreground">Sem pesquisa bibliográfica ao vivo: a IA não cita referências. Cada geração pode consumir créditos Lovable AI; o custo exato não é medido aqui.</p>
          {erro && <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/50 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{erro}</p>}
        </CardContent>
      </Card>

      {res && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado da IA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold">{res.titulo}</p>
              <p className="text-sm text-muted-foreground">{res.ideiaCentral}</p>
            </div>
            {pacote && (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p className="font-semibold">Pacote OpenAI</p>
                <p><strong>Conceito:</strong> {pacote.conceito || "—"}</p>
                <p><strong>Texto da arte:</strong> {pacote.textoArte}</p>
                <p><strong>CTA:</strong> {pacote.cta || "incluída na legenda"}</p>
                <p><strong>Hashtags:</strong> {pacote.hashtags.join(" ") || "—"}</p>
                <p className="text-muted-foreground">A legenda está abaixo. A imagem não foi gerada: use “Gerar imagem com OpenAI” (pede confirmação de créditos). O texto da arte e a logo entram como camada por cima da imagem.</p>
                <Button size="sm" disabled={ocupado} onClick={() => gerarImagem("unico")}>Gerar imagem com {PROVEDORES_IA[provedorDoModelo(modeloImagem)]}</Button>
              </div>
            )}
            {res.precisaFonte && <p className="rounded-md border p-2 text-sm"><AlertTriangle className="mr-1 inline h-4 w-4" />Este tema precisa de fonte verificável antes de publicar. {res.observacoes}</p>}
            {Object.entries(res.variantes).map(([k, v]) => (
              <div key={k} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>{VARIANTES[k as Variante] ?? k}</Label>
                  <span className={`text-xs ${v.length > LIMITE_REDE[b.rede] ? "text-destructive" : "text-muted-foreground"}`}>{v.length}/{LIMITE_REDE[b.rede]}</span>
                </div>
                <Textarea rows={8} value={v} onChange={(e) => setRes({ ...res, variantes: { ...res.variantes, [k]: e.target.value } })} />
                <Button size="sm" variant="outline" onClick={() => copiar(v + (res.hashtags.length && b.rede !== "google" ? `\n\n${res.hashtags.join(" ")}` : ""))}><Copy className="mr-1.5 h-4 w-4" /> Copiar</Button>
              </div>
            ))}
            {res.hashtags.length > 0 && <p className="text-sm">{res.hashtags.join(" ")}</p>}
            {res.auditoria.length > 0 && (
              <div className="space-y-1">
                <Label>Auditoria editorial</Label>
                <div className="flex flex-wrap gap-1.5">
                  {res.auditoria.map((a) => <Badge key={a.criterio} variant={a.ok ? "secondary" : "destructive"} title={a.nota}>{a.ok ? "✓" : "✗"} {a.criterio}</Badge>)}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Ajustar sem perder o briefing</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(AJUSTES) as Ajuste[]).map((a) => <Button key={a} size="sm" variant="outline" disabled={ocupado} onClick={() => gerarTexto(a)}>{AJUSTES[a]}</Button>)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> Imagens com IA</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ia-pi">Provedor de imagem</Label>
              <select id="ia-pi" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={provedorDoModelo(modeloImagem)} onChange={(e) => setModeloImagem(padraoDoProvedor("image", e.target.value as ProvedorIA))}>
                {(Object.keys(PROVEDORES_IA) as ProvedorIA[]).map((p) => <option key={p} value={p}>{PROVEDORES_IA[p]}</option>)}
              </select>
              <Label htmlFor="ia-mi">Modelo de imagem</Label>
              <select id="ia-mi" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={modeloImagem} onChange={(e) => setModeloImagem(e.target.value)}>
                {modelosDoProvedor("image", provedorDoModelo(modeloImagem)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-fi">Formato</Label>
              <select id="ia-fi" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={formato} onChange={(e) => setFormato(e.target.value as FormatoIA)}>
                {(Object.keys(FORMATOS_IA) as FormatoIA[]).map((f) => <option key={f} value={f}>{FORMATOS_IA[f].nome}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-ns">Slides do carrossel</Label>
              <Input id="ia-ns" type="number" min={2} max={10} value={slides} onChange={(e) => setSlides(Math.max(2, Math.min(10, Number(e.target.value) || 5)))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={ocupado} onClick={() => gerarImagem("unico")}>Post único</Button>
            <Button size="sm" disabled={ocupado} onClick={() => gerarImagem("capa")}>Capa</Button>
            {Array.from({ length: slides - 1 }, (_, i) => i + 2).map((n) => (
              <Button key={n} size="sm" variant="outline" disabled={ocupado} onClick={() => gerarImagem("slide", n)}>Slide {n}</Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">A IA gera a imagem sem texto e sem logo. A headline abaixo{MARCAS[b.marca].logo !== "nenhuma" && " e a logo oficial do perfil"} é aplicada pelo app como camada, então o texto sai exatamente como você escreveu.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.values(imgs).map((i) => (
              <div key={i.chave} className="space-y-2 rounded-md border p-2">
                <p className="text-sm font-medium">{i.nome}</p>
                {prontas[i.chave] ? <img src={prontas[i.chave]} alt={i.nome} className="w-full rounded" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                <Input value={i.headline} placeholder="Headline (camada editável)" aria-label={`Headline ${i.nome}`}
                  onChange={(e) => setImgs((s) => ({ ...s, [i.chave]: { ...i, headline: e.target.value } }))} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!prontas[i.chave]} onClick={() => baixar(i.chave)}><Download className="mr-1.5 h-4 w-4" /> Baixar</Button>
                  <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => i.chave.startsWith("slide-") ? gerarImagem("slide", Number(i.chave.slice(6))) : gerarImagem(i.chave as "capa" | "unico")}>Regenerar</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <section className="space-y-3 border-t pt-4" aria-label="Conteúdo selecionado para publicação">
        <h3 className="font-semibold">Conteúdo para publicação</h3>
        <Label htmlFor="ia-variante-envio">Texto selecionado</Label>
        <select id="ia-variante-envio" className="h-10 w-full rounded-md border bg-background px-2" value={varianteEnvio} onChange={e => setVarianteEnvio(e.target.value)}>
          <option value="">Sem texto</option>
          {res && Object.keys(res.variantes).map(k => <option key={k} value={k}>{VARIANTES[k as Variante] ?? k}</option>)}
        </select>
        <Label htmlFor="ia-midia-envio">Imagem selecionada</Label>
        <select id="ia-midia-envio" className="h-10 w-full rounded-md border bg-background px-2" value={midiaEnvio} onChange={e => setMidiaEnvio(e.target.value as typeof midiaEnvio)}>
          <option value="nenhuma">Sem imagem</option><option value="unico">Post único</option><option value="capa">Capa</option><option value="carrossel">Carrossel — capa + slides em ordem</option>
        </select>
        <StudioPublishActions content={{ perfil, tema, rede: b.rede, texto: (res?.variantes[varianteEnvio as Variante] ?? "") + (res?.variantes[varianteEnvio as Variante] && res.hashtags.length && b.rede !== "google" ? "\n\n" + res.hashtags.join(" ") : ""), imagens: midiaEnvio === "nenhuma" ? [] : midiaEnvio === "carrossel" ? [prontas.capa, ...Array.from({ length: slides - 1 }, (_, i) => prontas[`slide-${i + 2}`])].filter((s): s is string => !!s) : prontas[midiaEnvio] ? [prontas[midiaEnvio]] : [], midiaPendente: midiaEnvio !== "nenhuma" && (midiaEnvio === "carrossel" ? !prontas.capa || Array.from({ length: slides - 1 }, (_, i) => prontas[`slide-${i + 2}`]).some(s => !s) : !prontas[midiaEnvio]), formato: midiaEnvio === "carrossel" ? "Carrossel" : b.formato === "Artigo LinkedIn" ? "Artigo LinkedIn" : formato === "story" ? "Story" : "Post Único" }} />
      </section>
      <div ref={fim} />

      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendente?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>Esta ação chama a IA real e pode consumir créditos Lovable AI. O custo exato não é medido no app. Nada será publicado ou salvo automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const p = pendente; setPendente(null); void p?.acao(); }}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
