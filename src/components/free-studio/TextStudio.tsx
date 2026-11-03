import { PERFIS, legendaDoPerfil, type PerfilId } from "@/lib/studio-profiles";
import { StudioPublishActions } from "./StudioPublishActions";
import { useMidiaEstudio, conteudoComMidia, limparMidiaEstudio, useUsuarioAtual } from "@/lib/studio-media";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Lightbulb, ListChecks, Hash, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LIMITES_REDE, OBJETIVOS, CTAS_PERMITIDOS, ESTRUTURA_LEGENDA,
  statusRede, modeloLegenda, gerarGanchos, sugerirHashtags, revisarTexto,
  type RedeTexto, type Objetivo, type PlannerTemas,
} from "@/lib/free-studio";

const REDES = Object.keys(LIMITES_REDE) as RedeTexto[];

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
  }
}

export function TextStudio({ perfil, tema }: { perfil: PerfilId; tema: string }) {
  const [texto, setTexto] = useState("");
  const [rede, setRede] = useState<RedeTexto>("instagram");
  const [objetivo, setObjetivo] = useState<Objetivo>("educativo");

  const ganchos = useMemo(() => gerarGanchos(tema), [tema]);
  const hashtags = useMemo(() => sugerirHashtags(tema, rede), [tema, rede]);
  const problemas = useMemo(() => revisarTexto(texto), [texto]);
  const uid = useUsuarioAtual();
  const midiaSel = useMidiaEstudio(perfil, uid);
  const midia = midiaSel && midiaSel.rede === rede ? midiaSel : null;

  const inserir = (trecho: string, noInicio = false) =>
    setTexto((t) => (noInicio ? `${trecho}\n\n${t}` : t ? `${t.trimEnd()}\n\n${trecho}` : trecho));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Editor de legenda</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tema confirmado</Label>
              <p className="text-sm">{tema ? <strong>{tema}</strong> : <span className="text-muted-foreground">confirme um tema acima</span>} · Perfil: {PERFIS[perfil].nome}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Rede</Label>
              <div className="flex flex-wrap gap-2">
                {REDES.map((r) => (
                  <Button key={r} type="button" size="sm" variant={rede === r ? "default" : "outline"} onClick={() => setRede(r)}>{LIMITES_REDE[r].nome}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Modelo pronto por objetivo</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OBJETIVOS) as Objetivo[]).map((o) => (
                <Button key={o} type="button" size="sm" variant={objetivo === o ? "secondary" : "outline"} onClick={() => {
                  setObjetivo(o);
                  if (!tema) { toast.error("Confirme um tema antes."); return; }
                  setTexto(legendaDoPerfil(modeloLegenda(o, tema, rede), perfil));
                }}>{OBJETIVOS[o]}</Button>
              ))}
            </div>
          </div>

          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={14} placeholder="Escreva ou cole sua legenda aqui…" aria-label="Texto da legenda" />

          <div className="grid gap-2 sm:grid-cols-3">
            {REDES.map((r) => {
              const s = statusRede(texto, r);
              const lim = LIMITES_REDE[r];
              return (
                <div key={r} className={`rounded-md border p-2 text-sm ${s.excedeu || s.hashtagsExcedeu ? "border-destructive text-destructive" : ""}`}>
                  <div className="font-medium">{lim.nome}</div>
                  <div>{s.usado} / {s.limite} caracteres</div>
                  <div className="text-xs text-muted-foreground">
                    {s.excedeu ? `${-s.restante} acima do limite` : `${s.restante} restantes`} · {lim.hashtagsMax === 0 ? "hashtags não recomendadas" : `${s.hashtags}/${lim.hashtagsMax} hashtags`}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Prévia antes do “mais” no {LIMITES_REDE[rede].nome}: “{texto.slice(0, LIMITES_REDE[rede].visivel)}{texto.length > LIMITES_REDE[rede].visivel ? "…" : ""}”</p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => copiar(texto)} disabled={!texto}><Copy className="mr-1.5 h-4 w-4" /> Copiar texto</Button>
            <Button type="button" variant="outline" onClick={() => setTexto("")} disabled={!texto}>Limpar</Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> Revisão básica (regras locais)</Label>
            {!texto.trim() ? <p className="text-sm text-muted-foreground">Escreva algo para revisar.</p>
              : problemas.length === 0 ? <p className="text-sm">Nenhum problema encontrado pelas regras básicas. Revise também manualmente.</p>
              : <ul className="space-y-1 text-sm">{problemas.map((p, i) => (
                  <li key={i} className="flex gap-2"><Badge variant={p.tipo === "marca" ? "destructive" : "outline"}>{p.tipo}</Badge><span>{p.mensagem}</span></li>
                ))}</ul>}
          </div>
          {midia ? <div className="flex flex-wrap items-center gap-2 text-sm"><img src={midia.imagens[0]} alt="Arte anexada" className="h-14 w-auto rounded border" /><span>{midia.imagens.length} imagem(ns) do Estúdio de Imagens anexada(s) · {midia.formato}</span><Button type="button" size="sm" variant="ghost" onClick={() => uid && limparMidiaEstudio(uid, perfil)}>Remover</Button></div>
            : <p className="text-sm text-muted-foreground">{midiaSel ? `A arte selecionada é para ${midiaSel.rede}; troque a rede ou selecione outra arte.` : "Nenhuma imagem anexada. Para Instagram, selecione uma arte no Estúdio de Imagens."}</p>}
          <StudioPublishActions content={conteudoComMidia({ perfil, tema, texto, rede }, midia)} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4" /> Ideias de títulos e ganchos</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {ganchos.length === 0 ? <p className="text-sm text-muted-foreground">Informe um tema para ver ideias a partir de modelos fixos.</p>
              : ganchos.map((g) => (
                <button key={g} type="button" onClick={() => inserir(g, true)} className="block w-full rounded-md border px-2 py-1.5 text-left text-sm hover:bg-accent">{g}</button>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Estrutura de legenda</CardTitle></CardHeader>
          <CardContent><ol className="list-decimal space-y-1 pl-5 text-sm">{ESTRUTURA_LEGENDA.map((e) => <li key={e.etapa}><strong>{e.etapa}:</strong> {e.dica}</li>)}</ol></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">CTAs permitidas — {LIMITES_REDE[rede].nome}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {CTAS_PERMITIDOS[rede].map((c) => (
              <button key={c} type="button" onClick={() => inserir(c)} className="block w-full rounded-md border px-2 py-1.5 text-left text-sm hover:bg-accent">{c}</button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Hash className="h-4 w-4" /> Hashtags sugeridas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {hashtags.length === 0 ? <p className="text-sm text-muted-foreground">{rede === "google" ? "O Google Business não usa hashtags." : "Informe um tema."}</p> : (
              <>
                <div className="flex flex-wrap gap-1.5">{hashtags.map((h) => <Badge key={h} variant="secondary">{h}</Badge>)}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => inserir(hashtags.join(" "))}>Inserir no texto</Button>
                  <Button size="sm" variant="outline" onClick={() => copiar(hashtags.join(" "))}>Copiar</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
