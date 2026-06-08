import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Check, MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";

export function DirectReplyCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value.trim()) {
      toast.error("Gere a legenda primeiro para ter a mensagem de Direct.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Mensagem copiada — cole no Direct.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Card className="p-4 border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.04] to-transparent space-y-3 card-elevated">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
          <MessageCircleHeart className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Label className="text-sm font-semibold leading-tight">
            Mensagem de Resposta Rápida (Direct)
          </Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Para a secretária ou o médico copiarem e enviarem a quem comentar ou chamar no Direct.
          </p>
        </div>
        <Button
          size="sm"
          variant={copied ? "default" : "outline"}
          onClick={handleCopy}
          className="h-8"
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
          ) : (
            <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>
          )}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Será preenchido automaticamente quando você gerar uma legenda com a IA."
        className="resize-none text-sm bg-card"
      />
    </Card>
  );
}
