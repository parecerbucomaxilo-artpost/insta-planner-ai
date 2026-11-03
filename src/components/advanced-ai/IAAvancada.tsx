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
import { MODELOS_IA, MODELOS_IMAGEM, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from "@/lib/ai-models";
import { LOGOS_DISPONIVEIS } from "@/lib/logos-catalog";
import {
  MARCAS, REDES_IA, VARIANTES, AJUSTES, FORMATOS_IA, LIMITE_REDE,
  type Marca, type RedeIA, type Variante, type Ajuste, type FormatoIA, type Briefing, type Resultado,
} from "@/lib/advanced-ai";
import { gerarTextoAvancado, gerarImagemAvancada } from "@/lib/advanced-ai.functions";

const CORES: Record<Marca, { texto: string; destaque: string; sombra: string }> = {
  drfm: { texto: "#ffffff", destaque: "#2dd4ff", sombra: "#0c2340" },
  lactbmf: { texto: "#ffffff", destaque: "#c92e28", sombra: "#000000" },
};

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
  const ctx = c.getContext("2d")!;
  const foto = await carregar(img.base);
  if (foto) {
    const e = Math.max(f.w / foto.width, f.h / foto.height);
    ctx.drawImage(foto, (f.w - foto.width * e) / 2, (f.h - foto.height * e) / 2, foto.width * e, foto.height * e);
  }
  const cor = CORES[marca];
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
    toast.warning("A logo oficial não pôde ser aplicada nesta exportação.");
    return img.base;
  }
}

async function copiar(t: string) {
  try { await navigator.clipboard.writeText(t); toast.success("Copiado!"); } catch { toast.error("Não foi possível copiar."); }
}

export function IAAvancada() {
  const textoFn = useServerFn(gerarTextoAvancado);
  const imagemFn = useServerFn(gerarImagemAvancada);
  const [b, setB] = useState<Briefing>({ marca: "drfm", tema: "", objetivo: "Educar", rede: "instagram", formato: "Post único", nivel: "leigo", tamanho: "medio", tom: "", cta: "" });
  const [variantes, setVariantes] = useState<Variante[]>(["media"]);
  const [modeloTexto, setModeloTexto] = useState<string>(DEFAULT_TEXT_MODEL);
  const [modeloImagem, setModeloImagem] = useState<string>(DEFAULT_IMAGE_MODEL);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [formato, setFormato] = useState<FormatoIA>("feed");
  const [slides, setSlides] = useState(5);
  const [imgs, setImgs] = useState<Record<string, Img>>({});
  const [prontas, setProntas] = useState<Record<string, string>>({});
  const fim = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Briefing>(k: K, v: Briefing[K]) => setB((s) => ({ ...s, [k]: v }));
  const trocarMarca = (m: Marca) => setB((s) => ({ ...s, marca: m, nivel: MARCAS[m].nivel, rede: m === "lactbmf" && s.rede === "google" ? "instagram" : s.rede }));

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
    setOcupado(true); setErro("");
    try { await acao(); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg); toast.error(msg);
    } finally { setOcupado(false); }
  };

  const gerarTexto = (ajuste?: Ajuste) => {
    if (b.tema.trim().length < 3) { toast.error("Informe o tema."); return; }
    const anterior = ajuste && res ? Object.entries(res.variantes).map(([k, v]) => `[${k}]\n${v}`).join("\n\n") : undefined;
    confirmar(ajuste ? `Ajustar texto: ${AJUSTES[ajuste]}` : "Gerar texto com IA", () =>
      executar(async () => {
        const r = await textoFn({ data: { briefing: b, variantes, ajuste, anterior, modelo: modeloTexto } });
        setRes(r);
        setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }));
  };

  const gerarImagem = (tipo: "capa" | "unico" | "slide", n?: number) => {
    if (b.tema.trim().length < 3) { toast.error("Informe o tema."); return; }
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
            <Label>Perfil / marca</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MARCAS) as Marca[]).map((m) => (
                <Button key={m} size="sm" variant={b.marca === m ? "default" : "outline"} onClick={() => trocarMarca(m)}>{MARCAS[m].nome}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Público: {MARCAS[b.marca].publico}. Paleta, logo, assinatura e CTAs seguem as regras já configuradas deste perfil.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ia-tema">Tema</Label>
              <Input id="ia-tema" value={b.tema} onChange={(e) => set("tema", e.target.value)} placeholder="Ex.: fratura de mandíbula em acidentes de moto" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ia-obj">Objetivo</Label>
              <select id="ia-obj" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={b.objetivo} onChange={(e) => set("objetivo", e.target.value)}>
                {["Educar", "Prevenir", "Orientar", "Informar", "Fortalecer autoridade"].map((o) => <option key={o}>{o}</option>)}
              </select>
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
              <Input id="ia-cta" value={b.cta} onChange={(e) => set("cta", e.target.value)} placeholder={b.rede === "linkedin" ? "Ex.: Fale comigo no WhatsApp" : "Ex.: Saiba mais pelo link da bio"} />
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
              <Label htmlFor="ia-mt">Modelo de texto</Label>
              <select id="ia-mt" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={modeloTexto} onChange={(e) => setModeloTexto(e.target.value)}>
                {MODELOS_IA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={ocupado} onClick={() => gerarTexto()}>
                {ocupado ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />} Gerar texto com IA
              </Button>
            </div>
          </div>
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
              <Label htmlFor="ia-mi">Modelo de imagem</Label>
              <select id="ia-mi" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={modeloImagem} onChange={(e) => setModeloImagem(e.target.value)}>
                {MODELOS_IMAGEM.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
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
          <p className="text-xs text-muted-foreground">A IA gera a imagem sem texto e sem logo. A headline abaixo e a logo oficial do perfil são aplicadas pelo app como camadas, então o texto sai exatamente como você escreveu.</p>
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
