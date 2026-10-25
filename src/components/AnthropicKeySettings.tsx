import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { getAIProvidersStatus } from "@/lib/ai-status.functions";
import { MODELOS_IA, MODELOS_IMAGEM } from "@/lib/ai-models";
import { ModelLabel } from "@/components/ModelLabel";

// Antes: a chave Anthropic era salva no navegador e nunca usada na geração.
// Agora: chaves ficam só nos segredos do servidor; aqui mostramos apenas o status.
const PROVEDORES = [
  { key: "gemini", secret: "GEMINI_API_KEY", nome: "Google Gemini API", onde: "aistudio.google.com → Get API key", nivel: "Requer chave gratuita — limite diário de pedidos definido pelo Google" },
  { key: "groq", secret: "GROQ_API_KEY", nome: "Groq", onde: "console.groq.com → API Keys", nivel: "Requer chave gratuita — limites por minuto e por dia" },
  { key: "pollinations", secret: "POLLINATIONS_API_KEY", nome: "Pollinations (texto e imagem)", onde: "enter.pollinations.ai → Keys", nivel: "Imagem funciona sem chave (1 imagem a cada 45 s); com chave gratuita há mais cota" },
  { key: "lovable", secret: "LOVABLE_API_KEY", nome: "Lovable AI (modelos pagos)", onde: "já gerenciada pelo projeto", nivel: "Pago — consome créditos do workspace" },
] as const;

export function AnthropicKeySettings() {
  const fetchStatus = useServerFn(getAIProvidersStatus);
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    try { window.localStorage.removeItem("anthropic_api_key"); } catch { /* ignore */ }
    fetchStatus().then(setStatus).catch(() => setStatus({}));
  }, [fetchStatus]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Configurações de IA</h2>
        <p className="text-sm text-muted-foreground">
          O app usa primeiro as opções gratuitas. As chaves ficam guardadas com segurança no servidor:
          adicione-as em Configurações do projeto → Secrets, com o nome indicado abaixo.
        </p>
      </div>

      <Card className="p-5 space-y-3">
        {PROVEDORES.map((p) => {
          const ok = status?.[p.key];
          return (
            <div key={p.key} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
              {ok ? <Check className="h-4 w-4 mt-1 text-primary" /> : <X className="h-4 w-4 mt-1 text-muted-foreground" />}
              <div className="text-sm">
                <div className="font-semibold">{p.nome} <span className="text-xs font-normal text-muted-foreground">({status === null ? "verificando…" : ok ? "configurada" : "não configurada"})</span></div>
                <div className="text-xs text-muted-foreground">Nome do segredo: <code>{p.secret}</code> · Obter em: {p.onde}</div>
                <div className="text-xs text-muted-foreground">{p.nivel}</div>
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="p-5 space-y-2 text-xs">
        <h3 className="font-semibold text-sm">Modelos disponíveis</h3>
        <p className="font-medium">Texto</p>
        <ul className="list-disc pl-5 space-y-0.5">{MODELOS_IA.map((m) => <li key={m.id}><ModelLabel m={m} />{m.nota ? ` — ${m.nota}` : ""}</li>)}</ul>
        <p className="font-medium pt-2">Imagem</p>
        <ul className="list-disc pl-5 space-y-0.5">{MODELOS_IMAGEM.map((m) => <li key={m.id}><ModelLabel m={m} />{m.nota ? ` — ${m.nota}` : ""}</li>)}</ul>
      </Card>
    </div>
  );
}
