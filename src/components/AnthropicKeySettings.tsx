import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Check, X, AlertTriangle } from "lucide-react";
import { getAIProvidersStatus } from "@/lib/ai-status.functions";
import {
  MODELOS_IA,
  MODELOS_IMAGEM,
  modeloLiberado,
  provedorDoModelo,
  type StatusProvedores,
} from "@/lib/ai-models";
import { ModelLabel } from "@/components/ModelLabel";
import { cn } from "@/lib/utils";

// Chaves ficam SOMENTE nos segredos do servidor; esta tela mostra apenas o status (booleanos).
type Linha = { ok: (s: StatusProvedores) => boolean; secret: string; nome: string; link: string; nivel: string };

const LINHAS: Linha[] = [
  { ok: (s) => s.gemini, secret: "GEMINI_API_KEY", nome: "Gemini API (Google AI Studio)", link: "https://aistudio.google.com/apikey", nivel: "Texto: camada gratuita com limites diários do Google, quando a conta é elegível. Imagem: paga." },
  { ok: (s) => s.geminiPagoLiberado, secret: "GEMINI_ACEITO_COBRANCA", nome: "Aceite de cobrança do Gemini (imagem)", link: "https://ai.google.dev/gemini-api/docs/pricing", nivel: 'Valor "sim" libera imagens pagas do Gemini. Custos variáveis por imagem.' },
  { ok: (s) => s.openai, secret: "OPENAI_API_KEY", nome: "ChatGPT / OpenAI API", link: "https://platform.openai.com/api-keys", nivel: "Paga por uso (créditos pré-pagos na plataforma OpenAI). Sem camada gratuita garantida." },
  { ok: (s) => s.openaiPagoLiberado, secret: "OPENAI_ACEITO_COBRANCA", nome: "Aceite de cobrança da OpenAI", link: "https://openai.com/api/pricing", nivel: 'Valor "sim" libera texto e imagem da OpenAI. Custos variáveis por token/imagem.' },
  { ok: (s) => s.groq, secret: "GROQ_API_KEY", nome: "Groq", link: "https://console.groq.com/keys", nivel: "Chave gratuita, limites por minuto e por dia." },
  { ok: (s) => s.pollinations, secret: "POLLINATIONS_API_KEY", nome: "Pollinations", link: "https://enter.pollinations.ai", nivel: "Imagem funciona sem chave (1 a cada 45 s); com chave gratuita há mais cota." },
];

export function AnthropicKeySettings() {
  const fetchStatus = useServerFn(getAIProvidersStatus);
  const [status, setStatus] = useState<StatusProvedores | null>(null);
  const [provedor, setProvedor] = useState<"gemini" | "openai">("gemini");
  const [tarefa, setTarefa] = useState<"texto" | "imagem">("texto");

  useEffect(() => {
    try {
      window.localStorage.removeItem("anthropic_api_key");
    } catch {
      /* ignore */
    }
    fetchStatus()
      .then((s) => setStatus(s as StatusProvedores))
      .catch(() => setStatus(null));
  }, [fetchStatus]);

  const lista = (tarefa === "texto" ? MODELOS_IA : MODELOS_IMAGEM).filter((m) => provedorDoModelo(m.id) === provedor);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Configurações de IA</h2>
        <p className="text-sm text-muted-foreground">
          Padrão: cobrança zero (modelos gratuitos). Opções pagas ficam desativadas até você cadastrar a chave
          e o aceite de cobrança em Configurações do projeto → Secrets.
        </p>
      </div>

      <Card className="p-4 flex gap-3 text-xs border-destructive/40">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <p>
          A assinatura familiar do Gemini (Google One) e a assinatura do ChatGPT (Plus, Team ou familiar) <b>não</b>{" "}
          liberam uso de API. O app usa apenas as APIs oficiais com chave própria — não usa o site nem o app do
          Gemini ou do ChatGPT.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Ferramentas Gemini e ChatGPT/OpenAI</h3>
        <div className="flex flex-wrap gap-2">
          {(["gemini", "openai"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setProvedor(p)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-semibold border", provedor === p ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
              {p === "gemini" ? "Gemini" : "ChatGPT / OpenAI"}
            </button>
          ))}
          <span className="w-px bg-border mx-1" />
          {(["texto", "imagem"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTarefa(t)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-semibold border", tarefa === t ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
              {t === "texto" ? "Texto" : "Imagem"}
            </button>
          ))}
        </div>
        <ul className="space-y-2 text-xs">
          {lista.map((m) => {
            const ok = modeloLiberado(m, status) && (provedor !== "gemini" || !!status?.gemini);
            return (
              <li key={m.id} className="flex gap-2">
                {ok ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <ModelLabel m={m} /> — <span className="font-medium">{ok ? "ativo" : "desativado"}</span>
                  <div className="text-muted-foreground">{m.nota}</div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          Escolha o modelo no seletor de cada planner. Pagos nunca entram no modo "Automático grátis".
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Status das conexões</h3>
        {LINHAS.map((l) => {
          const ok = status ? l.ok(status) : false;
          return (
            <div key={l.secret} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
              {ok ? <Check className="h-4 w-4 mt-1 text-primary" /> : <X className="h-4 w-4 mt-1 text-muted-foreground" />}
              <div className="text-sm">
                <div className="font-semibold">
                  {l.nome}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({status === null ? "verificando…" : ok ? "configurado" : "não configurado"})
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Segredo: <code>{l.secret}</code> ·{" "}
                  <a href={l.link} target="_blank" rel="noreferrer" className="underline">site oficial</a>
                </div>
                <div className="text-xs text-muted-foreground">{l.nivel}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
