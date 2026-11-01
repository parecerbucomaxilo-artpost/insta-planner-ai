import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CLAUDE_REFERENCE_MODEL, MODELOS_IA, MODELOS_IMAGEM } from "@/lib/ai-models";

export function AnthropicKeySettings() {
  const [cleared, setCleared] = useState(false);
  const removeLegacyKey = () => {
    // Remove by name only: never read or display the previously stored secret.
    try {
      window.localStorage.removeItem("anthropic_api_key");
      setCleared(true);
    } catch {
      toast.error("Não foi possível remover a chave antiga deste navegador.");
    }
  };
  useEffect(() => { removeLegacyKey(); }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold">Configurações de IA</h2>
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Lovable AI · OpenAI e Google</h3>
        <p className="text-sm text-muted-foreground">Texto e imagem usam o modelo escolhido no planner. Falhas aparecem como erros, nunca como respostas simuladas.</p>
        <div className="text-sm space-y-2">
          <p>Texto: {MODELOS_IA.map(m => m.label).join(" · ")}</p>
          <p>Imagem: {MODELOS_IMAGEM.map(m => m.label).join(" · ")}</p>
        </div>
      </Card>
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Anthropic Claude · não conectado</h3>
        <p className="text-sm text-muted-foreground">Claude Sonnet 5 ({CLAUDE_REFERENCE_MODEL}) está no catálogo do Lovable AI, mas não participa da geração deste aplicativo. A antiga configuração de chave não tinha conexão com o gerador.</p>
        <p className="text-sm text-muted-foreground">Nenhuma chave é solicitada, exibida ou salva neste navegador.</p>
        <Button variant="outline" onClick={removeLegacyKey} disabled={cleared}>
          <Trash2 className="h-4 w-4 mr-2" />{cleared ? "Chave antiga removida deste navegador" : "Remover chave antiga deste navegador"}
        </Button>
      </Card>
    </div>
  );
}