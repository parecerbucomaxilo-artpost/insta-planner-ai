import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Download, Copy, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OBJETIVOS, PLANNERS_TEMAS, sortearTema, modeloLegenda, gerarGanchos, sugerirHashtags,
  type Objetivo, type PlannerTemas, type RedeTexto,
} from "@/lib/free-studio";

/** Tipos de postagem por rede. Carrossel = 5 slides (padrão do projeto). */
const TIPOS = {
  "ig-feed": { nome: "Instagram Feed / Carrossel", rede: "instagram" as RedeTexto, w: 1080, h: 1350, slides: 5 },
  "ig-stories": { nome: "Instagram Stories / Reels", rede: "instagram" as RedeTexto, w: 1080, h: 1920, slides: 1 },
  linkedin: { nome: "LinkedIn", rede: "linkedin" as RedeTexto, w: 1200, h: 628, slides: 1 },
  google: { nome: "Google Business", rede: "google" as RedeTexto, w: 1200, h: 900, slides: 1 },
} as const;
type Tipo = keyof typeof TIPOS;

/** Paletas de marca usadas apenas no desenho local (Canvas). Liga não usa azul/ciano. */
function paleta(planner: PlannerTemas) {
  return planner === "liga"
    ? { fundo1: "#000000", fundo2: "#545454", destaque: "#c92e28", texto: "#ffffff" }
    : { fundo1: "#0c2340", fundo2: "#000000", destaque: "#2dd4ff", texto: "#ffffff" };
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width > max && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function desenhar(w: number, h: number, planner: PlannerTemas, titulo: string, sub: string, rodape: string) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const cor = paleta(planner);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cor.fundo1); g.addColorStop(1, cor.fundo2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const m = Math.round(Math.min(w, h) * 0.08);
  const base = Math.min(w, h);
  ctx.fillStyle = cor.destaque;
  ctx.fillRect(m, m, base * 0.12, base * 0.012);
  ctx.fillStyle = cor.texto;
  ctx.textBaseline = "top";
  let tam = base * 0.085;
  ctx.font = `800 ${tam}px system-ui, Arial, sans-serif`;
  let linhas = quebrar(ctx, titulo, w - m * 2);
  while (linhas.length > 5 && tam > 24) { tam *= 0.9; ctx.font = `800 ${tam}px system-ui, Arial, sans-serif`; linhas = quebrar(ctx, titulo, w - m * 2); }
  let y = h * 0.3;
  for (const l of linhas) { ctx.fillText(l, m, y); y += tam * 1.15; }
  if (sub) {
    const ts = base * 0.04;
    ctx.font = `500 ${ts}px system-ui, Arial, sans-serif`;
    ctx.globalAlpha = 0.9;
    y += ts;
    for (const l of quebrar(ctx, sub, w - m * 2).slice(0, 4)) { ctx.fillText(l, m, y); y += ts * 1.3; }
    ctx.globalAlpha = 1;
  }
  if (rodape) {
    const tr = base * 0.028;
    ctx.font = `600 ${tr}px system-ui, Arial, sans-serif`;
    ctx.fillStyle = cor.destaque;
    ctx.fillText(rodape, m, h - m - tr);
  }
  return c.toDataURL("image/jpeg", 0.92);
}

const ASSINATURA = "Prof. Francisco Menezes | CROSP 53318";

export function GeradorLocal() {
  const [tipo, setTipo] = useState<Tipo>("ig-feed");
  const [planner, setPlanner] = useState<PlannerTemas>("chico");
  const [objetivo, setObjetivo] = useState<Objetivo>("educativo");
  const [tema, setTema] = useState("");
  const [legenda, setLegenda] = useState("");
  const [imagens, setImagens] = useState<string[]>([]);

  const gerar = () => {
    const t = tema.trim() || sortearTema(planner, []);
    setTema(t);
    const cfg = TIPOS[tipo];
    const tags = sugerirHashtags(t, cfg.rede);
    setLegenda(modeloLegenda(objetivo, t, cfg.rede) + (tags.length ? `\n\n${tags.join(" ")}` : ""));
    const ganchos = gerarGanchos(t);
    const assinar = planner !== "liga";
    if (cfg.slides === 1) {
      setImagens([desenhar(cfg.w, cfg.h, planner, ganchos[0], "", assinar ? ASSINATURA : "")]);
    } else {
      const slides = [
        { t: ganchos[0], s: "Arraste para o lado →" },
        { t: ganchos[4], s: "[Explicação simples do tema]" },
        { t: ganchos[1], s: "[Sinal 1 · Sinal 2 · Sinal 3]" },
        { t: ganchos[5], s: "Cada caso exige avaliação individual por um profissional habilitado." },
        { t: "Salve este post para consultar depois", s: "Saiba mais pelo link da bio" },
      ];
      setImagens(slides.map((s, i) => desenhar(cfg.w, cfg.h, planner, s.t, s.s, assinar && (i === 0 || i === 4) ? ASSINATURA : `${i + 1}/5`)));
    }
    toast.success("Imagem e legenda geradas com modelos fixos.");
  };

  const baixar = (url: string, i: number) => {
    const a = document.createElement("a");
    a.href = url; a.download = `${tipo}-${i + 1}.jpg`; a.click();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4" /> Gerar imagens e legendas</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Tipo de postagem</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIPOS) as Tipo[]).map((k) => (
              <Button key={k} size="sm" variant={tipo === k ? "default" : "outline"} onClick={() => setTipo(k)}>{TIPOS[k].nome}</Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Planner</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLANNERS_TEMAS) as PlannerTemas[]).map((p) => (
              <Button key={p} size="sm" variant={planner === p ? "secondary" : "outline"} onClick={() => setPlanner(p)}>{PLANNERS_TEMAS[p].nome}</Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Objetivo</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(OBJETIVOS) as Objetivo[]).map((o) => (
              <Button key={o} size="sm" variant={objetivo === o ? "secondary" : "outline"} onClick={() => setObjetivo(o)}>{OBJETIVOS[o]}</Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema (vazio = sorteado do planner)" aria-label="Tema" />
          <Button variant="outline" onClick={() => setTema(sortearTema(planner, [tema]))}><Shuffle className="mr-1.5 h-4 w-4" /> Sortear tema</Button>
        </div>
        <Button className="w-full" onClick={gerar}><Wand2 className="mr-1.5 h-4 w-4" /> Gerar imagens e legendas</Button>
        <p className="text-xs text-muted-foreground">Gerado por modelos fixos no seu navegador, sem IA e sem créditos. Carrossel do feed = 5 slides. A logo não é desenhada; complete os trechos entre colchetes.</p>

        {imagens.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {imagens.map((src, i) => (
                <div key={i} className="shrink-0 space-y-1">
                  <img src={src} alt={`Slide ${i + 1}`} className="h-64 w-auto rounded-md border" />
                  <Button size="sm" variant="outline" className="w-full" onClick={() => baixar(src, i)}><Download className="mr-1.5 h-4 w-4" /> Baixar {imagens.length > 1 ? i + 1 : ""}</Button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gl-legenda">Legenda</Label>
              <Textarea id="gl-legenda" rows={10} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(legenda).then(() => toast.success("Copiado!"), () => toast.error("Não foi possível copiar."))}>
                <Copy className="mr-1.5 h-4 w-4" /> Copiar legenda
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
