import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, Eye, EyeOff, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "anthropic_api_key";

export function getStoredAnthropicKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AnthropicKeySettings() {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    const v = getStoredAnthropicKey();
    if (v) {
      setKey(v);
      setHasSaved(true);
    }
  }, []);

  const save = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      toast.error("Cole sua chave antes de salvar.");
      return;
    }
    if (!trimmed.startsWith("sk-ant-")) {
      toast.error("Formato inválido. A chave da Anthropic começa com 'sk-ant-'.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, trimmed);
    setHasSaved(true);
    toast.success("Chave salva localmente neste navegador.");
  };

  const clear = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setKey("");
    setHasSaved(false);
    toast.success("Chave removida.");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Configurações de IA</h2>
        <p className="text-sm text-muted-foreground">
          Conecte sua chave do Claude (Anthropic) para gerar textos com o modelo Claude 3.5 Sonnet.
          Sem chave configurada, o app continua funcionando em modo de demonstração (texto simulado).
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Chave de API Anthropic</h3>
            <p className="text-xs text-muted-foreground">
              Obtenha em console.anthropic.com → Settings → API Keys
            </p>
          </div>
          {hasSaved && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check className="h-3.5 w-3.5" /> Configurada
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Token (sk-ant-...)</Label>
          <div className="flex gap-2">
            <Input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              autoComplete="off"
              spellCheck={false}
            />
            <Button variant="outline" size="icon" onClick={() => setShow((s) => !s)} type="button">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Armazenada apenas no seu navegador (localStorage). Enviada de forma segura para o backend
            apenas durante as requisições de geração de texto.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} className="flex-1">
            <Check className="h-4 w-4 mr-2" /> Salvar chave
          </Button>
          {hasSaved && (
            <Button onClick={clear} variant="outline" className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Remover
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
