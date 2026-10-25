import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { NIVEL_LABEL, modeloLiberado, type ModeloInfo, type StatusProvedores } from "@/lib/ai-models";
import { getAIProvidersStatus } from "@/lib/ai-status.functions";

/** Retorna função que diz se o modelo está BLOQUEADO (pago sem chave/aceite). */
export function useModeloBloqueado() {
  const fetchStatus = useServerFn(getAIProvidersStatus);
  const [s, setS] = useState<StatusProvedores | null>(null);
  useEffect(() => {
    fetchStatus().then(setS).catch(() => setS(null));
  }, [fetchStatus]);
  return (m: ModeloInfo) => !modeloLiberado(m, s);
}

/** Aviso exibido ao escolher um modelo pago ainda bloqueado (pode ser selecionado, mas não gera). */
export function avisarSeBloqueado(m: ModeloInfo, bloqueado: boolean) {
  if (!bloqueado) return;
  const nome = m.id.startsWith("openai/") ? "ChatGPT (API oficial da OpenAI)" : m.label;
  const segredo = m.id.startsWith("openai/") ? "OPENAI_API_KEY e OPENAI_ACEITO_COBRANCA=sim" : "GEMINI_API_KEY e GEMINI_ACEITO_COBRANCA=sim";
  toast.warning(
    `${nome} selecionado, mas bloqueado: cadastre ${segredo} em Configurações do projeto → Secrets. A assinatura não libera a API e o uso pode ser cobrado.`,
    { duration: 12000 },
  );
}

/** Rótulo do modelo com a indicação de custo (Grátis com limites / Requer chave gratuita / Pago / Sem IA). */
export function ModelLabel({ m }: { m: ModeloInfo }) {
  return (
    <span title={m.nota ?? NIVEL_LABEL[m.nivel]}>
      {m.label}
      {m.subtitulo ? <span className="block text-[10px] font-normal opacity-80">{m.subtitulo}</span> : " "}
      <span className="opacity-70 font-normal">· {NIVEL_LABEL[m.nivel]}</span>
    </span>
  );
}

/** Mostra avisos do servidor (ex.: imagem trocada por fundo liso, legenda sem IA). */
export function showAvisos(out: unknown) {
  const avisos = (out as { avisos?: string[] } | null)?.avisos;
  if (Array.isArray(avisos)) for (const a of avisos) toast.warning(a, { duration: 12000 });
}
