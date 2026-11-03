import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Undo2, Redo2, RotateCcw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGOS_DISPONIVEIS } from "@/lib/logos-catalog";
import { PERFIS, type PerfilId } from "@/lib/studio-profiles";
import { StudioPublishActions } from "./StudioPublishActions";
import type { StudioContent } from "@/lib/studio-publication";
import { definirMidiaEstudio, persistirArteCanvas, useUsuarioAtual } from "@/lib/studio-media";
import { uploadPostImage } from "@/lib/storage-utils";
import { useRascunhoStudio } from "./StudioMaterial";

const FORMATOS = {
  feed: { nome: "Instagram feed 4:5", w: 1080, h: 1350 },
  stories: { nome: "Stories/Reels 9:16", w: 1080, h: 1920 },
  linkedin: { nome: "LinkedIn 1.91:1", w: 1200, h: 628 },
  google: { nome: "Google 4:3", w: 1200, h: 900 },
} as const;
type Formato = keyof typeof FORMATOS;

const FILTROS = {
  nenhum: { nome: "Nenhum", css: "" },
  pb: { nome: "Preto e branco", css: "grayscale(1)" },
  sepia: { nome: "Sépia", css: "sepia(0.6)" },
  frio: { nome: "Frio", css: "hue-rotate(-12deg) saturate(1.1)" },
  quente: { nome: "Quente", css: "sepia(0.25) saturate(1.15)" },
  suave: { nome: "Suave", css: "contrast(0.9) brightness(1.05)" },
} as const;
type Filtro = keyof typeof FILTROS;

const FONTES = [
  { nome: "Sem serifa", css: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" },
  { nome: "Serifada", css: "Georgia, 'Times New Roman', serif" },
  { nome: "Impacto", css: "'Arial Black', Impact, sans-serif" },
  { nome: "Mono", css: "ui-monospace, 'Courier New', monospace" },
];


type Ajustes = {
  formato: Formato; zoom: number; offX: number; offY: number;
  brilho: number; contraste: number; saturacao: number; filtro: Filtro;
  texto: string; fonte: number; tamanho: number; cor: string; negrito: boolean;
  alinhamento: CanvasTextAlign; posY: number; sombra: boolean;
};

const INICIAL: Ajustes = {
  formato: "feed", zoom: 1, offX: 0, offY: 0, brilho: 100, contraste: 100, saturacao: 100, filtro: "nenhum",
  texto: "", fonte: 0, tamanho: 72, cor: "#ffffff", negrito: true, alinhamento: "center", posY: 80, sombra: true,
};

function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, max: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(teste).width > max && atual) { linhas.push(atual); atual = palavra; } else atual = teste;
    }
    linhas.push(atual);
  }
  return linhas;
}

export function ImageStudio({ perfil, tema = "" }: { perfil: PerfilId; tema?: string }) {
  const uid = useUsuarioAtual();
  const [salvandoArte, setSalvandoArte] = useState(false);
  const [selecionada, setSelecionada] = useRascunhoStudio<StudioContent | null>("imagem.selecionada", null);
  const P = PERFIS[perfil];
  const CORES_MARCA = Array.from(new Set([P.paleta.texto, P.paleta.destaque, P.paleta.fundo1, P.paleta.fundo2]));
  const [comLogo, setComLogo] = useRascunhoStudio("imagem.logo", true);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setLogo(null);
    const url = LOGOS_DISPONIVEIS.find((l) => l.key === P.logo)?.url;
    if (!url) return;
    const i = new Image(); i.crossOrigin = "anonymous";
    let ativo = true;
    i.onload = () => { if (ativo) setLogo(i); }; i.src = url;
    return () => { ativo = false; };
  }, [P.logo]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [nomeArquivo, setNomeArquivo] = useRascunhoStudio("imagem.nome", "imagem");
  const [origem, setOrigem] = useRascunhoStudio("imagem.origem", "");
  useEffect(() => {
    if (!origem) return;
    const i = new Image();
    let vivo = true;
    i.onload = () => { if (vivo) setImg(i); };
    i.src = origem;
    return () => { vivo = false; };
  }, [origem]);
  const [a, setA] = useRascunhoStudio<Ajustes>("imagem.ajustes", INICIAL);
  const [hist, setHist] = useState<Ajustes[]>([INICIAL]);
  const [idx, setIdx] = useState(0);
  const [tipo, setTipo] = useState<"image/png" | "image/jpeg">("image/jpeg");
  const arrasto = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pularHist = useRef(false);

  // Registra no histórico após uma pausa nas alterações (permite desfazer/refazer).
  useEffect(() => {
    if (pularHist.current) { pularHist.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setHist((h) => {
        if (JSON.stringify(h[idx]) === JSON.stringify(a)) return h;
        const novo = [...h.slice(0, idx + 1), a].slice(-50);
        setIdx(novo.length - 1);
        return novo;
      });
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [a]); // eslint-disable-line react-hooks/exhaustive-deps

  const irPara = (i: number) => { pularHist.current = true; setIdx(i); setA(hist[i]); };
  const set = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) => setA((s) => ({ ...s, [k]: v }));

  const desenhar = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { w: W, h: H } = FORMATOS[a.formato];
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = P.paleta.fundo1;
    ctx.fillRect(0, 0, W, H);
    if (img) {
      const escala = Math.max(W / img.naturalWidth, H / img.naturalHeight) * a.zoom;
      const dw = img.naturalWidth * escala, dh = img.naturalHeight * escala;
      const x = (W - dw) / 2 + a.offX * Math.max(0, (dw - W) / 2);
      const y = (H - dh) / 2 + a.offY * Math.max(0, (dh - H) / 2);
      ctx.filter = `brightness(${a.brilho}%) contrast(${a.contraste}%) saturate(${a.saturacao}%) ${FILTROS[a.filtro].css}`.trim();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, x, y, dw, dh);
      ctx.filter = "none";
    }
    if (a.texto.trim()) {
      const margem = W * 0.08;
      ctx.font = `${a.negrito ? "700" : "400"} ${a.tamanho}px ${FONTES[a.fonte].css}`;
      ctx.textAlign = a.alinhamento;
      ctx.textBaseline = "middle";
      ctx.fillStyle = a.cor;
      if (a.sombra) { ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = a.tamanho * 0.25; ctx.shadowOffsetY = a.tamanho * 0.05; }
      const linhas = quebrarLinhas(ctx, a.texto, W - margem * 2);
      const alturaLinha = a.tamanho * 1.18;
      const total = alturaLinha * linhas.length;
      let cy = (H * a.posY) / 100 - total / 2 + alturaLinha / 2;
      cy = Math.min(Math.max(cy, margem + alturaLinha / 2), H - margem - total + alturaLinha / 2);
      const x = a.alinhamento === "left" ? margem : a.alinhamento === "right" ? W - margem : W / 2;
      linhas.forEach((l, i) => ctx.fillText(l, x, cy + i * alturaLinha));
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    if (P.logo !== "nenhuma" && comLogo && logo) {
      const m = Math.min(W, H) * 0.06, lh = Math.min(W, H) * 0.12, lw = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, W - m - lw, m, lw, lh);
    }
  }, [a, img, comLogo, logo, P.logo, P.paleta.fundo1]);

  useEffect(() => { desenhar(); }, [desenhar]);
  const primeiraComposicao = useRef(true);
  useEffect(() => { if (primeiraComposicao.current) { primeiraComposicao.current = false; return; } setSelecionada(null); }, [a, origem, comLogo]);

  const carregar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setOrigem(reader.result);
      setNomeArquivo(file.name.replace(/\.[^.]+$/, "") || "imagem");
      setA((s) => ({ ...s, zoom: 1, offX: 0, offY: 0 }));
    };
    reader.onerror = () => toast.error("Não foi possível abrir esta imagem.");
    reader.readAsDataURL(file);
  };

  const baixar = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) { toast.error("Falha ao gerar o arquivo."); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${nomeArquivo}-${a.formato}.${tipo === "image/png" ? "png" : "jpg"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Imagem baixada.");
    }, tipo, 0.92);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, offX: a.offX, offY: a.offY };
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = arrasto.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    setA((s) => ({ ...s, offX: clamp(d.offX + ((e.clientX - d.x) / r.width) * 2), offY: clamp(d.offY + ((e.clientY - d.y) / r.height) * 2) }));
  };
  const onUp = () => { arrasto.current = null; };

  const fmt = FORMATOS[a.formato];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> Prévia — {fmt.nome} ({fmt.w}×{fmt.h})</CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" aria-label="Desfazer" disabled={idx === 0} onClick={() => irPara(idx - 1)}><Undo2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Refazer" disabled={idx >= hist.length - 1} onClick={() => irPara(idx + 1)}><Redo2 className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-center rounded-md bg-muted p-3">
            <canvas
              ref={canvasRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              className={`h-auto max-h-[70vh] w-auto max-w-full touch-none rounded shadow ${img ? "cursor-move" : ""}`}
              aria-label="Prévia da imagem editada"
            />
          </div>
          {!img && <p className="text-center text-sm text-muted-foreground">Envie uma imagem do seu dispositivo para começar. Ela não sai do seu navegador.</p>}
          {img && <p className="text-center text-xs text-muted-foreground">Arraste a imagem para ajustar o recorte. A área a 8% das bordas é a margem segura do texto.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { carregar(e.target.files?.[0]); e.target.value = ""; }} />
            <Button onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-4 w-4" /> {img ? "Trocar imagem" : "Enviar imagem"}</Button>
            <div className="flex gap-1">
              <Button size="sm" variant={tipo === "image/jpeg" ? "secondary" : "outline"} onClick={() => setTipo("image/jpeg")}>JPEG</Button>
              <Button size="sm" variant={tipo === "image/png" ? "secondary" : "outline"} onClick={() => setTipo("image/png")}>PNG</Button>
            </div>
            <Button variant="default" onClick={baixar} disabled={!img && !a.texto.trim()}><Download className="mr-1.5 h-4 w-4" /> Baixar</Button>
            <Button variant="outline" disabled={salvandoArte || (!img && !a.texto.trim()) || !tema} onClick={async () => {
              if (!uid) { toast.error("Entre na sua conta para anexar a arte à publicação."); return; }
              const c = canvasRef.current;
              if (!c) return;
              setSalvandoArte(true);
              try {
                // Canvas final (texto, logo e filtros) → arquivo → armazenamento do app. Nada é publicado aqui.
                const url = await persistirArteCanvas(() => new Promise(r => c.toBlob(r, "image/jpeg", 0.92)), f => uploadPostImage(f, uid));
                const sel: StudioContent = { perfil, tema, texto: "", imagens: [url], formato: a.formato === "stories" ? "Story" : "Post Único", rede: a.formato === "linkedin" ? "linkedin" : a.formato === "google" ? "google" : "instagram" };
                setSelecionada(sel);
                definirMidiaEstudio({ userId: uid, perfil, tema, imagens: sel.imagens, formato: sel.formato, rede: sel.rede });
                toast.success("Arte salva e anexada. Ela também aparece no Estúdio de Texto para publicar com a legenda.");
              } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a arte selecionada."); }
              finally { setSalvandoArte(false); }
            }}>{salvandoArte ? "Salvando arte…" : "Selecionar arte para publicação"}</Button>
            <Button variant="ghost" onClick={() => setA({ ...INICIAL, formato: a.formato })}><RotateCcw className="mr-1.5 h-4 w-4" /> Redefinir ajustes</Button>
          </div>
          {selecionada && <StudioPublishActions content={{ ...selecionada, tema }} />}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Formato e recorte</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FORMATOS) as Formato[]).map((f) => (
                <Button key={f} size="sm" variant={a.formato === f ? "default" : "outline"} onClick={() => set("formato", f)} className="h-auto whitespace-normal py-1.5">{FORMATOS[f].nome}</Button>
              ))}
            </div>
            <Ajuste rotulo="Zoom" valor={a.zoom} min={1} max={3} passo={0.01} mostrar={`${Math.round(a.zoom * 100)}%`} onChange={(v) => set("zoom", v)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cor e filtros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Ajuste rotulo="Brilho" valor={a.brilho} min={50} max={150} passo={1} mostrar={`${a.brilho}%`} onChange={(v) => set("brilho", v)} />
            <Ajuste rotulo="Contraste" valor={a.contraste} min={50} max={150} passo={1} mostrar={`${a.contraste}%`} onChange={(v) => set("contraste", v)} />
            <Ajuste rotulo="Saturação" valor={a.saturacao} min={0} max={200} passo={1} mostrar={`${a.saturacao}%`} onChange={(v) => set("saturacao", v)} />
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FILTROS) as Filtro[]).map((f) => (
                <Button key={f} size="sm" variant={a.filtro === f ? "secondary" : "outline"} onClick={() => set("filtro", f)}>{FILTROS[f].nome}</Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Texto sobre a imagem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={a.texto} onChange={(e) => set("texto", e.target.value)} rows={3} placeholder="Título curto e revisado" aria-label="Texto sobre a imagem" />
            <div className="flex flex-wrap gap-1.5">
              {FONTES.map((f, i) => (
                <Button key={f.nome} size="sm" variant={a.fonte === i ? "secondary" : "outline"} onClick={() => set("fonte", i)} style={{ fontFamily: f.css }}>{f.nome}</Button>
              ))}
              <Button size="sm" variant={a.negrito ? "secondary" : "outline"} onClick={() => set("negrito", !a.negrito)} className="font-bold">N</Button>
              <Button size="sm" variant={a.sombra ? "secondary" : "outline"} onClick={() => set("sombra", !a.sombra)}>Sombra</Button>
            </div>
            <Ajuste rotulo="Tamanho" valor={a.tamanho} min={24} max={200} passo={1} mostrar={`${a.tamanho}px`} onChange={(v) => set("tamanho", v)} />
            <Ajuste rotulo="Posição vertical" valor={a.posY} min={0} max={100} passo={1} mostrar={`${a.posY}%`} onChange={(v) => set("posY", v)} />
            <div className="flex gap-1.5">
              {([["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]] as const).map(([v, n]) => (
                <Button key={v} size="sm" variant={a.alinhamento === v ? "secondary" : "outline"} onClick={() => set("alinhamento", v)}>{n}</Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="fs-cor" className="text-sm">Cor</Label>
              <Input id="fs-cor" type="color" value={a.cor} onChange={(e) => set("cor", e.target.value)} className="h-9 w-14 p-1" />
              {CORES_MARCA.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => set("cor", c)} className="h-7 w-7 rounded-full border" style={{ backgroundColor: c }} />
              ))}
            </div>
            {P.logo !== "nenhuma" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={comLogo} onChange={(e) => setComLogo(e.target.checked)} /> Aplicar logo oficial do perfil {P.nome}</label>}
            <p className="text-xs text-muted-foreground">Cores seguem o perfil {P.nome}.{P.logo !== "nenhuma" && " A logo é o arquivo oficial, nunca redesenhada."}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Ajuste({ rotulo, valor, min, max, passo, mostrar, onChange }: { rotulo: string; valor: number; min: number; max: number; passo: number; mostrar: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm"><Label>{rotulo}</Label><span className="text-muted-foreground">{mostrar}</span></div>
      <Slider value={[valor]} min={min} max={max} step={passo} onValueChange={(v) => onChange(v[0] ?? valor)} aria-label={rotulo} />
    </div>
  );
}
