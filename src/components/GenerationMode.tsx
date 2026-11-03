import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type ModoGeracao, lerModo, definirModo, ouvirModo, carregarModoSalvo, registrarConfirmador, comGuardaIA,
} from "@/lib/generation-mode";

export function useModoGeracao(): [ModoGeracao, (m: ModoGeracao) => void] {
  const [modo, setModo] = useState<ModoGeracao>(lerModo());
  useEffect(() => {
    carregarModoSalvo(localStorage);
    setModo(lerModo());
    return ouvirModo(setModo);
  }, []);
  return [modo, (m) => definirModo(m, localStorage)];
}

/** Envolve uma server function de IA com a guarda de modo + confirmação de créditos. */
export function useGuardaIA<A extends unknown[], R>(acao: string, fn: (...a: A) => Promise<R>) {
  return useMemo(() => comGuardaIA(acao, fn), [acao, fn]);
}

export function SeletorModoGeracao() {
  const [modo, setModo] = useModoGeracao();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Modo de geração">
        <Button size="sm" role="radio" aria-checked={modo === "gratuito"} variant={modo === "gratuito" ? "default" : "outline"} onClick={() => setModo("gratuito")}>
          <ShieldCheck className="mr-1.5 h-4 w-4" /> Gratuito — sem créditos de IA
        </Button>
        <Button size="sm" role="radio" aria-checked={modo === "ia"} variant={modo === "ia" ? "default" : "outline"} onClick={() => setModo("ia")}>
          <Sparkles className="mr-1.5 h-4 w-4" /> IA Avançada — pode consumir créditos Lovable AI
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {modo === "ia"
          ? "Modo ativo: IA Avançada. Planners, composer e semana geram legenda e imagem com os modelos de IA reais; cada lote pede confirmação de créditos."
          : "Modo ativo: Gratuito. Os botões que usam IA ficam bloqueados (nada é gerado por modelo fixo no lugar). Use o Estúdio para ferramentas locais — modelo fixo, não é IA."}
      </p>
    </div>
  );
}

/** Diálogo único de confirmação de créditos, montado uma vez na tela principal. */
export function ConfirmacaoIAHost() {
  const [pedido, setPedido] = useState<{ acao: string; responder: (ok: boolean) => void } | null>(null);
  useEffect(() => {
    registrarConfirmador((acao) => new Promise((responder) => setPedido({ acao, responder })));
  }, []);
  const fechar = (ok: boolean) => { pedido?.responder(ok); setPedido(null); };
  return (
    <AlertDialog open={!!pedido} onOpenChange={(o) => !o && fechar(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pedido?.acao} com IA</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação chama os modelos de IA reais e pode consumir créditos Lovable AI (o custo exato não é medido no app). A confirmação vale por 10 minutos para lotes, como a semana inteira. Nada é publicado automaticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => fechar(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => fechar(true)}>Continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
