/** Image generation reads the actual approved caption/slide, not a second AI summary. */
export function visualReferences(caption: string, slides: readonly string[]) {
  const scene = caption.trim();
  if (!scene) throw new Error("Legenda vazia: não há referência real para a imagem.");
  const perSlide = slides.map((slide, index) => {
    const text = slide.trim();
    if (!text) throw new Error(`Slide ${index + 1} vazio: não há referência real para a imagem.`);
    return text;
  });
  return { scene, perSlide };
}