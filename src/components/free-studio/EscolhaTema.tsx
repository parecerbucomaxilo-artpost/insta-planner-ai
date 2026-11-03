import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, ListChecks, RefreshCw, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useGuardaIA } from "@/components/GenerationMode";
import { ModoGratuitoError, type ModoGeracao } from "@/lib/generation-mode";
import { sugerirTemasIA } from "@/lib/advanced-ai.functions";
import { sugerirTemasLocais, type Sugestao, type RedeTema } from "@/lib/theme-suggest";
import { PERFIS, type PerfilId } from "@/lib/studio-profiles";

type Props = { perfil: PerfilId; modo: ModoGeracao; aprovado: string; objetivo: string; onAprovar: (tema: string) => void };

/** "Quem escolhe o tema?" — nada é gerado antes de o usuário confirmar um tema. */
export function EscolhaTema({ perfil, modo, aprovado, objetivo, onAprovar }: Props) {
  const sugerirFn = useGuardaIA("Sugerir temas com IA", useServerFn(sugerirTemasIA));
  const [quem, setQuem] = useState<"eu" | "ia">("eu");
  const [manual, setManual] = useState(aprovado);
  const [rede, setRede] = useState<RedeTema>("instagram");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [jaSugeridos, setJaSugeridos] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const sugerir = async () => {
    setErro("");
    if (modo === "ia" && !objetivo) { setErro("Escolha o objetivo do material acima."); return; }
    const evitar = [...jaSugeridos, ...(aprovado ? [aprovado] : [])].slice(-30);
    if (modo === "gratuito") {
      const s = sugerirTemasLocais(perfil, rede, evitar);
      if (!s.length) { setErro("As regras locais já sugeriram todos os temas da lista deste perfil nesta sessão."); return; }
      setSugestoes(s); setJaSugeridos((v) => [...v, ...s.map((x) => x.tema)]);
      return;
    }
    setOcupado(true);
    try {
      const s = await sugerirFn({ data: { perfil, objetivo, rede, quantidade: 4, evitar } });
      setSugestoes(s); setJaSugeridos((v) => [...v, ...s.map((x) => x.tema)]);
    } catch (e) {
      if (e instanceof ModoGratuitoError) return;
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg); toast.error(msg);
    } finally { setOcupado(false); }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium" id="quem-tema">Quem escolhe o tema?</p>
      <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-labelledby="quem-tema">
        <Button role="radio" aria-checked={quem === "eu"} size="sm" variant={quem === "eu" ? "default" : "outline"} onClick={() => setQuem("eu")}>Eu escolho</Button>
        <Button role="radio" aria-checked={quem === "ia"} size="sm" variant={quem === "ia" ? "default" : "outline"} onClick={() => setQuem("ia")}>
          {modo === "ia" ? "IA escolhe" : "IA escolhe (no Gratuito: sugestões por regras)"}
        </Button>
      </div>

      {quem === "eu" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Tema" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={`Tema para ${PERFIS[perfil].nome}`} />
          <Button disabled={manual.trim().length < 3} onClick={() => { onAprovar(manual.trim()); toast.success("Tema confirmado."); }}><Check className="mr-1.5 h-4 w-4" /> Usar este tema</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="tema-rede">Rede</Label>
              <select id="tema-rede" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={rede} onChange={(e) => setRede(e.target.value as RedeTema)}>
                <option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="google">Google Business</option>
              </select>
            </div>
          </div>
          <Button variant={sugestoes.length ? "outline" : "default"} disabled={ocupado} onClick={sugerir}>
            {ocupado ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : sugestoes.length ? <RefreshCw className="mr-1.5 h-4 w-4" /> : modo === "ia" ? <Sparkles className="mr-1.5 h-4 w-4" /> : <ListChecks className="mr-1.5 h-4 w-4" />}
            {sugestoes.length ? "Gerar outras sugestões" : modo === "ia" ? "Pedir sugestões à IA" : "Ver sugestões por regras"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {modo === "ia"
              ? "A IA considera perfil, público, objetivo, rede e o histórico dos seus posts para não repetir assuntos. Pede confirmação antes e pode consumir créditos."
              : "Modo Gratuito: estas sugestões vêm de regras locais (lista do perfil, sem repetir nesta sessão). Não é IA e não usa créditos."}
          </p>
          {erro && <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/50 p-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{erro}</p>}
          <ul className="space-y-2">
            {sugestoes.map((s) => (
              <li key={s.tema} className="space-y-1 rounded-md border p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{s.tema}</p>
                  <Badge variant="outline">{s.origem === "ia" ? "IA" : "Regras"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Por quê: {s.motivo}</p>
                {(s.formato || s.abordagem) && <p className="text-xs text-muted-foreground">Sugestão: {[s.formato, s.abordagem].filter(Boolean).join(" · ")}</p>}
                <Button size="sm" variant={aprovado === s.tema ? "secondary" : "outline"} onClick={() => { onAprovar(s.tema); toast.success("Tema confirmado."); }}>
                  <Check className="mr-1.5 h-4 w-4" /> {aprovado === s.tema ? "Tema escolhido" : "Escolher este tema"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
