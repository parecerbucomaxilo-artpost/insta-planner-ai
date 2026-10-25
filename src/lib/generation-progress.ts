import { toast } from "sonner";

/**
 * Mostra o progresso da geração no aviso de carregamento (tempo decorrido + etapa típica).
 * As etapas são estimadas pelo tempo: o servidor escreve o texto primeiro e depois gera as imagens.
 * Retorna uma função para parar a atualização.
 */
export function startGenerationProgress(toastId: string | number, titulo: string, carrossel = false) {
  const inicio = Date.now();
  const render = () => {
    const s = Math.round((Date.now() - inicio) / 1000);
    const etapa = s < 12 ? "escrevendo o texto" : s < 20 ? "planejando as cenas a partir do texto" : carrossel ? "gerando as imagens dos slides em paralelo" : "gerando a imagem";
    toast.loading(`${titulo} — ${etapa}… (${s} s)`, { id: toastId });
  };
  render();
  const t = setInterval(render, 1000);
  return () => clearInterval(t);
}
