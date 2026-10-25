import { toast } from "sonner";
import { NIVEL_LABEL, type ModeloInfo } from "@/lib/ai-models";

/** Rótulo do modelo com a indicação de custo (Grátis com limites / Requer chave gratuita / Pago / Sem IA). */
export function ModelLabel({ m }: { m: ModeloInfo }) {
  return (
    <span title={m.nota ?? NIVEL_LABEL[m.nivel]}>
      {m.label} <span className="opacity-70 font-normal">· {NIVEL_LABEL[m.nivel]}</span>
    </span>
  );
}

/** Mostra avisos do servidor (ex.: imagem trocada por fundo liso, legenda sem IA). */
export function showAvisos(out: unknown) {
  const avisos = (out as { avisos?: string[] } | null)?.avisos;
  if (Array.isArray(avisos)) for (const a of avisos) toast.warning(a, { duration: 12000 });
}
