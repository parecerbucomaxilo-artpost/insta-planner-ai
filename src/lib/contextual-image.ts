export interface VisualBrief {
  postId: string;
  slideIndex: number;
  total: number;
  tema: string;
  titulo: string;
  texto: string;
  objetivo: string;
  publico: string;
  contexto: string;
  identidade: string;
}

export function extractFinalSlides(caption: string, total: number): string[] {
  const matches = [
    ...caption.matchAll(
      /^\s*\**Slide\s*(\d+)\s*\**\s*[:\-–—.)]?\s*([\s\S]*?)(?=^\s*\**Slide\s*\d+\b|(?![\s\S]))/gim,
    ),
  ];
  const slides = Array.from({ length: total }, (_, i) => {
    const match = matches.find((m) => Number(m[1]) === i + 1);
    return match?.[2]?.replace(/\*+/g, "").trim() || "";
  });
  if (slides.some((text) => text.length < 10) || new Set(slides).size !== total) {
    throw new Error(
      `O texto final deve conter ${total} slides distintos e completos antes de gerar imagens.`,
    );
  }
  return slides;
}

export function buildVisualBrief(b: VisualBrief): string {
  if (!b.tema.trim() || !b.texto.trim())
    throw new Error("Tema e texto final são obrigatórios para gerar a imagem.");
  return `BRIEF VISUAL EXCLUSIVO — SLIDE ${b.slideIndex + 1}/${b.total}
TEMA EXATO: ${b.tema}
TÍTULO DESTE SLIDE: ${b.titulo}
TEXTO FINAL DESTE SLIDE (fonte de verdade, não usar o texto de outro slide):
${b.texto}
OBJETIVO: ${b.objetivo}
PÚBLICO: ${b.publico}
CONTEXTO: ${b.contexto}
DEVE APARECER: o sujeito, a estrutura anatômica ou o objeto EXPLICITAMENTE citado no texto acima, em uma cena literal que mostre a ação, condição ou relação descrita. Se o texto descreve mecanismo, mostrar esse mecanismo; se descreve cuidado, mostrar esse cuidado específico; se descreve sinais, mostrar esses sinais sem afirmar diagnóstico. A chamada de fechamento deve continuar ilustrando o assunto, não substituir a cena por publicidade.
NÃO DEVE APARECER: outra doença, outro procedimento, anatomia ou instrumento sem relação com este texto; paciente sorrindo genérico; radiografia aleatória; decoração como assunto; gradiente sem cena; imagem de demonstração; sangue, exposição invasiva, anatomia deformada, antes/depois ou promessa de resultado. Não escolher aleatoriamente a cena ou usar um roteiro clínico padrão no lugar deste texto.
IDENTIDADE VISUAL (somente aparência, nunca substitui o assunto): ${b.identidade}
LOGOTIPOS: não desenhar nem imitar marcas, não escrever "LOGO" como substituto e não reservar espaços ou placeholders de marca. Referências visuais, se presentes, orientam só identidade, nunca o assunto.
TEXTO NA ARTE: português brasileiro correto. ${b.slideIndex === 0 ? `Renderizar somente o título exato: "${b.titulo}".` : b.slideIndex === b.total - 1 ? 'Somente "Link na Bio", sem telefone ou promessa.' : "Sem texto embutido; a mensagem está no texto final do slide."}
Não inventar credenciais, informações clínicas, dados científicos ou símbolos de marca.`;
}

export interface BoundImage {
  postId: string;
  slideIndex: number;
  publicUrl: string;
  signedUrl: string;
}

export function validateImageBindings(
  postId: string,
  total: number,
  results: BoundImage[],
): BoundImage[] {
  if (results.length !== total)
    throw new Error("Carrossel incompleto; nenhuma imagem substituta será salva.");
  const ordered = [...results].sort((a, b) => a.slideIndex - b.slideIndex);
  ordered.forEach((image, i) => {
    if (
      image.postId !== postId ||
      image.slideIndex !== i ||
      !image.publicUrl.startsWith("https://") ||
      !image.signedUrl.startsWith("https://")
    ) {
      throw new Error("Imagem vinculada ao post/slide incorreto; salvamento bloqueado.");
    }
  });
  if (new Set(ordered.map((r) => r.publicUrl)).size !== total)
    throw new Error("URL repetida entre slides; salvamento bloqueado.");
  return ordered;
}

export async function generateBoundImage(
  brief: VisualBrief,
  generate: (prompt: string) => Promise<string>,
  save: (base64: string, postId: string, slideIndex: number) => Promise<BoundImage>,
): Promise<BoundImage> {
  const prompt = buildVisualBrief(brief);
  if (prompt.length > 28000)
    throw new Error(
      "Brief muito extenso; reduza o conteúdo antes de tentar novamente. Nada foi truncado.",
    );
  const base64 = await generate(prompt);
  if (!base64.trim()) throw new Error("O gerador não retornou imagem contextual. Tente novamente.");
  const result = await save(base64, brief.postId, brief.slideIndex);
  if (result.postId !== brief.postId || result.slideIndex !== brief.slideIndex)
    throw new Error("Resultado associado ao slide incorreto.");
  return result;
}
