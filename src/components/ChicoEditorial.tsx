import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PAUTAS_CHICO, EIXOS_CHICO, conteudoEditorialChico, type FormatoEditorial } from "@/lib/chico-editorial";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function ChicoEditorial({ onTema }: { onTema: (tema: string) => void }) {
  const [eixo, setEixo] = useState("");
  const [selecionada, setSelecionada] = useState(PAUTAS_CHICO[0].id);
  const [formato, setFormato] = useState<FormatoEditorial>("Carrossel");
  const pauta = PAUTAS_CHICO.find(p => p.id === selecionada) ?? PAUTAS_CHICO[0];
  const texto = conteudoEditorialChico(pauta.tema, formato) ?? "";
  return <section className="space-y-3 border-t pt-4" aria-label="Linha editorial CTBMF">
    <h3 className="font-semibold">Cirurgia e Traumatologia Bucomaxilofacial</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="chico-eixo">Eixo editorial</Label><select id="chico-eixo" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={eixo} onChange={e => { const nome = e.target.value; setEixo(nome); const first = PAUTAS_CHICO.find(p => !nome || p.eixo === nome); if (first) { setSelecionada(first.id); setFormato(first.formato); } }}><option value="">Todos os eixos</option>{EIXOS_CHICO.map(e => <option key={e.id}>{e.nome}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="chico-pauta">Pauta</Label><select id="chico-pauta" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={selecionada} onChange={e => { setSelecionada(e.target.value); const p = PAUTAS_CHICO.find(p => p.id === e.target.value); if (p) setFormato(p.formato); }}>{PAUTAS_CHICO.filter(p => !eixo || p.eixo === eixo).map(p => <option key={p.id} value={p.id}>{p.tema}</option>)}</select></div>
    </div>
    <div className="flex flex-wrap gap-2">{(["Carrossel", "Post único", "Roteiro de reel", "Stories"] as FormatoEditorial[]).map(f => <Button key={f} size="sm" variant={formato === f ? "secondary" : "outline"} aria-pressed={formato === f} onClick={() => setFormato(f)}>{f}</Button>)}</div>
    <p className="text-sm font-medium">{pauta.abordagem}</p>
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{texto}</p>
    <p className="text-sm text-muted-foreground"><strong>Direção visual:</strong> {pauta.visual}</p>
    <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => onTema(pauta.tema)}><Check className="mr-2 h-4 w-4" /> Usar pauta como tema</Button><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(texto).then(() => toast.success("Conteúdo copiado."), () => toast.error("Não foi possível copiar."))}><Copy className="mr-2 h-4 w-4" /> Copiar conteúdo</Button></div>
  </section>;
}