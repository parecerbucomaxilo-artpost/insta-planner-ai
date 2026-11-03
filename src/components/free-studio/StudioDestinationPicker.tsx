import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";
import { comPrazo, type DestinationList } from "@/lib/studio-destinations";
import type { StudioDestination } from "@/lib/studio-publication";

export function StudioDestinationPicker({ carregar, destino, onChange, onConectar, disabled, onReady }: {
  carregar: () => Promise<DestinationList>; destino: StudioDestination; onChange: (d: StudioDestination) => void;
  onConectar: () => void; disabled?: boolean; onReady: (ready: boolean) => void;
}) {
  const [lista, setLista] = useState<DestinationList>({ contas: [], avisos: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [open, setOpen] = useState(false);
  const callbacks = useRef({ carregar, onChange, onReady });
  callbacks.current = { carregar, onChange, onReady };
  const request = useRef(0);
  const load = async () => {
    const id = ++request.current;
    setLoading(true); setErro(""); setLista({ contas: [], avisos: [] }); callbacks.current.onReady(false);
    callbacks.current.onChange({ ...destino, conta: "", conectado: false });
    try {
      const result = await comPrazo(callbacks.current.carregar);
      if (id !== request.current) return;
      setLista(result); callbacks.current.onReady(true);
    } catch (e) { if (id === request.current) setErro(e instanceof Error ? e.message : "Não foi possível carregar as contas."); }
    finally { if (id === request.current) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { request.current++; }; }, []);
  const options = lista.contas.filter(d => d.canal === destino.canal);
  const chosen = options.find(d => d.conta === destino.conta);
  return <section className="min-w-0 space-y-2" aria-label="Escolha de destino">
    <Label htmlFor="studio-canal">Canal suportado</Label>
    <Select value={destino.canal} disabled={disabled} onValueChange={canal => onChange({ canal: canal as StudioDestination["canal"], conta: "", conectado: false })}>
      <SelectTrigger id="studio-canal"><SelectValue /></SelectTrigger>
      <SelectContent className="z-[60]"><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="linkedin">LinkedIn</SelectItem><SelectItem value="google">Google Business — somente rascunho</SelectItem></SelectContent>
    </Select>
    <Label htmlFor="studio-conta">Conta social de destino</Label>
    <Select open={open} onOpenChange={setOpen} value={chosen?.id ?? ""} disabled={disabled} onValueChange={id => {
      const selected = options.find(d => d.id === id);
      if (selected) onChange(selected);
    }}>
      <SelectTrigger id="studio-conta" aria-label="Conta social de destino"><SelectValue placeholder={loading ? "Carregando contas…" : "Escolher conta autorizada"} /></SelectTrigger>
      <SelectContent className="z-[60]">
        {options.map(d => <SelectItem key={d.id} value={d.id}>{d.nome} · autorizado</SelectItem>)}
        {!options.length && <SelectItem value="indisponivel" disabled>{loading ? "Carregando contas…" : erro ? "Erro ao carregar contas" : "Nenhuma conta autorizada neste canal"}</SelectItem>}
      </SelectContent>
    </Select>
    {loading && <p role="status" className="flex gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Verificando contas e conexões…</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {!loading && !erro && !options.length && <p role="status" className="text-sm">Nenhuma conta autorizada disponível para {destino.canal}. Um canal suportado não significa uma conta conectada.</p>}
    {chosen && <p role="status" className="break-words text-sm font-medium">Conta selecionada: {chosen.nome} · {chosen.canal}</p>}
    {lista.avisos.map(a => <p key={a} className="text-xs text-muted-foreground">{a}</p>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled || loading} onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />Carregar novamente</Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onConectar}>Conectar redes sociais</Button>
    </div>
  </section>;
}