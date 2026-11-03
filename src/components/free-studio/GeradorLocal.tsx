import { useEffect, useState } from "react";
import { StudioPublishActions } from "./StudioPublishActions";
import { toast } from "sonner";
import { Wand2, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGOS_DISPONIVEIS, type LogoKey } from "@/lib/logos-catalog";
import { PERFIS, legendaDoPerfil, type PerfilId } from "@/lib/studio-profiles";
import {
  OBJETIVOS, modeloLegenda, gerarGanchos, sugerirHashtags,
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

type Ident = { fundo1: string; fundo2: string; destaque: string; texto: string; logo: LogoKey; assinatura: string };
const identDe = (id: PerfilId): Ident => ({ ...PERFIS[id].paleta, logo: PERFIS[id].logo, assinatura: PERFIS[id].assinatura });

function carregar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
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

function desenhar(w: number, h: number, cor: Ident, titulo: string, sub: string, rodape: string, foto: HTMLImageElement | null, logo: HTMLImageElement | null) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cor.fundo1); g.addColorStop(1, cor.fundo2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (foto) {
    const esc = Math.max(w / foto.width, h / foto.height);
    ctx.drawImage(foto, (w - foto.width * esc) / 2, (h - foto.height * esc) / 2, foto.width * esc, foto.height * esc);
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, cor.fundo1 + "66"); v.addColorStop(1, cor.fundo1 + "ee");
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }
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
  if (logo) {
    const lh = base * 0.14, lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, w - m - lw, m, lw, lh);
  }
  try { return c.toDataURL("image/jpeg", 0.92); } catch { return null; }
}


export function GeradorLocal({ perfil, tema }: { perfil: PerfilId; tema: string }) {
  const [tipo, setTipo] = useState<Tipo>("ig-feed");
  useEffect(() => { setImagens([]); setLegenda(""); }, [perfil, tema]);
  const [objetivo, setObjetivo] = useState<Objetivo>("educativo");
  const [legenda, setLegenda] = useState("");
  const [imagens, setImagens] = useState<string[]>([]);
  const [foto, setFoto] = useState<HTMLImageElement | null>(null);
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    const t = tema.trim();
    if (!t) { setGerando(false); toast.error("Confirme um tema antes de gerar."); return; }
    const cfg = TIPOS[tipo];
    const id = identDe(perfil);
    const tags = sugerirHashtags(t, cfg.rede);
    setLegenda(legendaDoPerfil(modeloLegenda(objetivo, t, cfg.rede), perfil) + (tags.length && cfg.rede !== "google" ? `\n\n${tags.join(" ")}` : ""));
    const ganchos = gerarGanchos(t);
    const urlLogo = LOGOS_DISPONIVEIS.find((l) => l.key === id.logo)?.url;
    let logo = urlLogo ? await carregar(urlLogo) : null;
    const slides = cfg.slides === 1 ? [{ t: ganchos[0], s: "" }] : [
      { t: ganchos[0], s: "Arraste para o lado →" },
      { t: ganchos[4], s: "[Explicação simples do tema]" },
      { t: ganchos[1], s: "[Sinal 1 · Sinal 2 · Sinal 3]" },
      { t: ganchos[5], s: "Cada caso exige avaliação individual por um profissional habilitado." },
      { t: "Salve este post para consultar depois", s: perfil === "chico" ? "Saiba mais pelo link da bio" : PERFIS[perfil].telefone ? `📞 ${PERFIS[perfil].telefone}` : "" },
    ];
    const n = slides.length;
    const fazer = () => slides.map((s, i) => {
      const extremo = i === 0 || i === n - 1;
      return desenhar(cfg.w, cfg.h, id, s.t, s.s, extremo ? id.assinatura : `${i + 1}/${n}`, foto, extremo ? logo : null);
    });
    let out = fazer();
    if (out.some((x) => !x)) { logo = null; out = fazer(); toast.warning(id.logo === "nenhuma" ? "Não foi possível exportar esta imagem." : "Não foi possível aplicar a logo nesta imagem; adicione-a manualmente."); }
    setImagens(out.filter((x): x is string => !!x));
    setGerando(false);
    toast.success("Imagem e legenda geradas com a identidade do planner.");
  };

  const enviarFoto = (f?: File) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => setFoto(i);
    i.src = url;
  };

  const baixar = (url: string, i: number) => {
    const a = document.createElement("a");
    a.href = url; a.download = `${tipo}-${i + 1}.jpg`; a.click();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4" /> Gerar imagens e legendas — modelos locais, sem IA</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Tipo de postagem</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIPOS) as Tipo[]).map((k) => (
              <Button key={k} size="sm" variant={tipo === k ? "default" : "outline"} onClick={() => setTipo(k)}>{TIPOS[k].nome}</Button>
            ))}
          </div>
        </div>
        <p className="text-sm">Perfil: <strong>{PERFIS[perfil].nome}</strong> — cores, {PERFIS[perfil].logo !== "nenhuma" && "logo oficial, "}assinatura e temas deste perfil.</p>
        <div className="space-y-1.5">
          <Label>Objetivo</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(OBJETIVOS) as Objetivo[]).map((o) => (
              <Button key={o} size="sm" variant={objetivo === o ? "secondary" : "outline"} onClick={() => setObjetivo(o)}>{OBJETIVOS[o]}</Button>
            ))}
          </div>
        </div>
        <p className="text-sm">Tema: {tema ? <strong>{tema}</strong> : <span className="text-muted-foreground">confirme um tema acima</span>}</p>
        <div className="space-y-1.5">
          <Label htmlFor="gl-foto">Foto de fundo (opcional, fica só no seu navegador)</Label>
          <div className="flex gap-2">
            <Input id="gl-foto" type="file" accept="image/*" onChange={(e) => enviarFoto(e.target.files?.[0])} />
            {foto && <Button variant="ghost" onClick={() => setFoto(null)}>Remover</Button>}
          </div>
        </div>
        <Button className="w-full" disabled={gerando || !tema} onClick={gerar}><Wand2 className="mr-1.5 h-4 w-4" /> Gerar imagens e legendas</Button>
        <p className="text-xs text-muted-foreground">Gerado por modelos fixos no seu navegador, sem IA e sem créditos. Carrossel do feed = 5 slides. Cores, {PERFIS[perfil].logo !== "nenhuma" && "logo real e "}assinatura seguem o planner escolhido; complete os trechos entre colchetes.</p>

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
            <StudioPublishActions content={{ perfil, tema, texto: legenda, imagens, formato: tipo === "ig-feed" ? "Carrossel" : tipo === "ig-stories" ? "Story" : "Post Único", rede: TIPOS[tipo].rede }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
